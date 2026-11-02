from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import Application, ApplicationMessage, Job, Notification, User
from app.schemas.application_message import (
    ApplicationMessageCreate,
    ApplicationMessageResponse,
)

router = APIRouter(prefix="/api/applications", tags=["Application messages"])


def get_participant_application(
    application_id: int, db: Session, current_user: User
) -> Application:
    application = db.scalar(
        select(Application)
        .join(Job, Application.job_id == Job.id)
        .where(Application.id == application_id)
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    if current_user.id not in (application.applicant_id, application.job.employer_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the applicant and job owner can access this conversation.",
        )
    return application


@router.get(
    "/{application_id}/messages",
    response_model=list[ApplicationMessageResponse],
)
def get_messages(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_participant_application(application_id, db, current_user)
    return db.scalars(
        select(ApplicationMessage)
        .where(ApplicationMessage.application_id == application_id)
        .order_by(ApplicationMessage.created_at.asc(), ApplicationMessage.id.asc())
        .limit(200)
    ).all()


@router.post(
    "/{application_id}/messages",
    response_model=ApplicationMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    application_id: int,
    message_data: ApplicationMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = get_participant_application(application_id, db, current_user)
    body = message_data.body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="Message cannot be blank.")

    message = ApplicationMessage(
        application_id=application.id,
        sender_id=current_user.id,
        body=body,
    )
    recipient_id = (
        application.job.employer_id
        if current_user.id == application.applicant_id
        else application.applicant_id
    )
    db.add(message)
    db.add(
        Notification(
            user_id=recipient_id,
            application_id=application.id,
            message=f"New message about {application.job.title} from {current_user.full_name}.",
        )
    )
    db.commit()
    db.refresh(message)
    return message
