from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import Application, Interview, Job, Notification, User
from app.schemas.interview import InterviewCreate, InterviewDecision, InterviewResponse

router = APIRouter(prefix="/api", tags=["Interviews"])


def get_participant_application(
    application_id: int, db: Session, current_user: User
) -> Application:
    application = db.scalar(
        select(Application)
        .options(joinedload(Application.job))
        .where(Application.id == application_id)
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    if current_user.id not in (application.applicant_id, application.job.employer_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the applicant and job owner can access interviews.",
        )
    return application


@router.get(
    "/applications/{application_id}/interviews",
    response_model=list[InterviewResponse],
)
def get_interviews(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_participant_application(application_id, db, current_user)
    return db.scalars(
        select(Interview)
        .where(Interview.application_id == application_id)
        .order_by(Interview.scheduled_at.desc())
    ).all()


@router.get("/interviews/me", response_model=list[InterviewResponse])
def get_my_upcoming_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    statement = (
        select(Interview)
        .join(Application, Interview.application_id == Application.id)
        .join(Job, Application.job_id == Job.id)
        .where(
            Interview.scheduled_at >= datetime.now(timezone.utc),
            Interview.status.in_(("proposed", "accepted")),
        )
        .order_by(Interview.scheduled_at.asc())
    )
    if current_user.role == "employer":
        statement = statement.where(Job.employer_id == current_user.id)
    else:
        statement = statement.where(Application.applicant_id == current_user.id)
    return db.scalars(statement).all()


@router.post(
    "/applications/{application_id}/interviews",
    response_model=InterviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def schedule_interview(
    application_id: int,
    interview_data: InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = get_participant_application(application_id, db, current_user)
    if current_user.role != "employer" or application.job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the employer for this job can invite a candidate to interview.",
        )
    if application.status in ("rejected", "withdrawn"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An interview cannot be scheduled for a closed application.",
        )

    interview = Interview(
        application_id=application.id,
        scheduled_at=interview_data.scheduled_at,
        note=interview_data.note.strip() if interview_data.note else None,
        created_by=current_user.id,
    )
    db.add(interview)
    db.add(
        Notification(
            user_id=application.applicant_id,
            application_id=application.id,
            message=f"You have an interview invitation for {application.job.title}.",
        )
    )
    db.commit()
    db.refresh(interview)
    return interview


@router.patch("/interviews/{interview_id}/response", response_model=InterviewResponse)
def respond_to_interview(
    interview_id: int,
    decision: InterviewDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interview = db.scalar(
        select(Interview)
        .options(joinedload(Interview.application).joinedload(Application.job))
        .where(Interview.id == interview_id)
    )
    if interview is None:
        raise HTTPException(status_code=404, detail="Interview invitation not found.")
    if interview.application.applicant_id != current_user.id or current_user.role != "job_seeker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the invited job seeker can respond to this interview.",
        )
    if interview.status != "proposed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This interview invitation has already been answered.",
        )

    interview.status = decision.status
    interview.responded_at = datetime.now(timezone.utc)
    db.add(
        Notification(
            user_id=interview.application.job.employer_id,
            application_id=interview.application_id,
            message=f"The candidate {decision.status} the interview for {interview.application.job.title}.",
        )
    )
    db.commit()
    db.refresh(interview)
    return interview
