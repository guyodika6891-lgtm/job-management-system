from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import Job, SavedJob, User
from app.schemas.job import JobResponse

router = APIRouter(prefix="/api/saved-jobs", tags=["Saved jobs"])


def require_job_seeker(user: User) -> None:
    if user.role != "job_seeker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only job seekers can manage saved jobs.",
        )


@router.get("/", response_model=list[JobResponse])
def get_saved_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_job_seeker(current_user)
    return db.scalars(
        select(Job)
        .join(SavedJob, SavedJob.job_id == Job.id)
        .where(SavedJob.user_id == current_user.id, Job.status == "open")
        .order_by(SavedJob.created_at.desc())
    ).all()


@router.post("/{job_id}", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def save_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_job_seeker(current_user)
    job = db.get(Job, job_id)
    if job is None or job.status != "open":
        raise HTTPException(status_code=404, detail="Open job not found.")

    saved_job = db.scalar(
        select(SavedJob).where(
            SavedJob.user_id == current_user.id,
            SavedJob.job_id == job_id,
        )
    )
    if saved_job is not None:
        raise HTTPException(status_code=409, detail="This job is already saved.")

    db.add(SavedJob(user_id=current_user.id, job_id=job_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This job is already saved.")
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_saved_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_job_seeker(current_user)
    saved_job = db.scalar(
        select(SavedJob).where(
            SavedJob.user_id == current_user.id,
            SavedJob.job_id == job_id,
        )
    )
    if saved_job is None:
        raise HTTPException(status_code=404, detail="Saved job not found.")

    db.delete(saved_job)
    db.commit()
    return None
