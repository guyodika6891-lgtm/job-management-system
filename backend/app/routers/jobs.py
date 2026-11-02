from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import Application, Job, User
from app.routers.search_alerts import notify_matching_searches
from app.schemas.analytics import EmployerAnalytics, JobAnalyticsItem
from app.schemas.job import JobCreate, JobResponse, JobUpdate

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


def require_employer(current_user: User) -> None:
    if current_user.role != "employer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can manage job listings.",
        )


@router.post(
    "/",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_job(
    job_data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_employer(current_user)

    new_job = Job(
        title=job_data.title,
        company=job_data.company,
        location=job_data.location,
        description=job_data.description,
        salary=job_data.salary,
        employer_id=current_user.id,
    )

    db.add(new_job)
    db.flush()
    notify_matching_searches(db, new_job)
    db.commit()
    db.refresh(new_job)

    return new_job


@router.get("/mine", response_model=list[JobResponse])
def get_my_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_employer(current_user)
    return db.scalars(
        select(Job)
        .where(Job.employer_id == current_user.id)
        .order_by(Job.created_at.desc())
    ).all()


@router.get("/mine/{job_id}", response_model=JobResponse)
def get_my_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_employer(current_user)
    job = db.get(Job, job_id)
    if job is None or job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )
    return job


@router.get("/", response_model=list[JobResponse])
def get_jobs(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None, max_length=150),
    location: str | None = Query(default=None, max_length=150),
    company: str | None = Query(default=None, max_length=150),
    salary: str | None = Query(default=None, max_length=100),
):
    statement = (
        select(Job)
        .where(Job.status == "open")
    )

    if q and q.strip():
        term = f"%{q.strip()}%"
        statement = statement.where(
            Job.title.ilike(term)
            | Job.company.ilike(term)
            | Job.description.ilike(term)
        )
    if location and location.strip():
        statement = statement.where(Job.location.ilike(f"%{location.strip()}%"))
    if company and company.strip():
        statement = statement.where(Job.company.ilike(f"%{company.strip()}%"))
    if salary and salary.strip():
        statement = statement.where(Job.salary.ilike(f"%{salary.strip()}%"))

    statement = statement.order_by(Job.created_at.desc()).limit(limit).offset(offset)
    jobs = db.scalars(statement).all()
    return jobs


@router.get("/analytics", response_model=EmployerAnalytics)
def get_employer_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_employer(current_user)
    rows = db.execute(
        select(
            Job.id,
            Job.title,
            Job.status,
            func.count(Application.id).label("applications"),
            func.coalesce(
                func.sum(case((Application.status == "pending", 1), else_=0)), 0
            ).label("pending"),
            func.coalesce(
                func.sum(case((Application.status == "accepted", 1), else_=0)), 0
            ).label("accepted"),
            func.coalesce(
                func.sum(case((Application.status == "rejected", 1), else_=0)), 0
            ).label("rejected"),
        )
        .outerjoin(Application, Application.job_id == Job.id)
        .where(Job.employer_id == current_user.id)
        .group_by(Job.id, Job.title, Job.status)
        .order_by(Job.created_at.desc())
    ).all()

    jobs = [
        JobAnalyticsItem(
            job_id=row.id,
            title=row.title,
            status=row.status,
            applications=row.applications,
            pending=row.pending,
            accepted=row.accepted,
            rejected=row.rejected,
        )
        for row in rows
    ]
    return EmployerAnalytics(
        total_jobs=len(jobs),
        open_jobs=sum(job.status == "open" for job in jobs),
        total_applications=sum(job.applications for job in jobs),
        pending_applications=sum(job.pending for job in jobs),
        accepted_applications=sum(job.accepted for job in jobs),
        rejected_applications=sum(job.rejected for job in jobs),
        jobs=jobs,
    )


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
):
    job = db.get(Job, job_id)

    if job is None or job.status != "open":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    return job

@router.patch("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: int,
    job_data: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.get(Job, job_id)

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    require_employer(current_user)
    if job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own job listings.",
        )

    update_data = job_data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update.",
        )

    for field, value in update_data.items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)

    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.get(Job, job_id)

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )

    require_employer(current_user)
    if job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own job listings.",
        )

    db.delete(job)
    db.commit()

    return None
