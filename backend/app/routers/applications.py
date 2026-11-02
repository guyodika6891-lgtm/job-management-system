from pathlib import PurePath
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import Application, Job, Notification, User
from app.schemas.application import (
    ApplicationResponse,
    ApplicationStatusUpdate,
)

router = APIRouter(prefix="/api/applications", tags=["Applications"])
MAX_RESUME_SIZE = 5 * 1024 * 1024
ALLOWED_RESUME_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


async def read_resume(resume: UploadFile | None) -> tuple[str | None, str | None, bytes | None]:
    if resume is None or not resume.filename:
        return None, None, None

    filename = PurePath(resume.filename.replace("\\", "/")).name
    extension = PurePath(filename).suffix.lower()
    content_type = ALLOWED_RESUME_TYPES.get(extension)
    if content_type is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Resume must be a PDF or DOCX file.",
        )
    data = await resume.read(MAX_RESUME_SIZE + 1)
    if len(data) > MAX_RESUME_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume must be 5 MB or smaller.",
        )
    valid_signature = data.startswith(b"%PDF-") if extension == ".pdf" else data.startswith(b"PK")
    if not valid_signature:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="The uploaded file does not match its file type.",
        )
    return filename, content_type, data


@router.post(
    "/jobs/{job_id}",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def apply_to_job(
    job_id: int,
    resume: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "job_seeker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only job seekers can apply to jobs.",
        )

    job = db.get(Job, job_id)
    if job is None or job.status != "open":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Open job not found.",
        )

    existing = db.scalar(
        select(Application).where(
            Application.job_id == job_id,
            Application.applicant_id == current_user.id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied to this job.",
        )

    filename, content_type, resume_data = await read_resume(resume)
    application = Application(
        job_id=job_id,
        applicant_id=current_user.id,
        resume_filename=filename,
        resume_content_type=content_type,
        resume_data=resume_data,
    )
    db.add(application)
    try:
        db.flush()
        db.add(
            Notification(
                user_id=job.employer_id,
                application_id=application.id,
                message=f"{current_user.full_name} applied for {job.title}.",
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied to this job.",
        )

    return db.scalar(
        select(Application)
        .options(joinedload(Application.job), joinedload(Application.applicant))
        .where(Application.id == application.id)
    )


@router.get("/me", response_model=list[ApplicationResponse])
def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "job_seeker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only job seekers can view their applications.",
        )

    return db.scalars(
        select(Application)
        .options(joinedload(Application.job), joinedload(Application.applicant))
        .where(Application.applicant_id == current_user.id)
        .order_by(Application.applied_at.desc())
    ).all()


@router.get("/received", response_model=list[ApplicationResponse])
def get_received_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "employer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can view received applications.",
        )

    return db.scalars(
        select(Application)
        .join(Application.job)
        .options(joinedload(Application.job), joinedload(Application.applicant))
        .where(Job.employer_id == current_user.id)
        .order_by(Application.applied_at.desc())
    ).all()


@router.patch("/{application_id}", response_model=ApplicationResponse)
def update_application_status(
    application_id: int,
    update: ApplicationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "employer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can update application statuses.",
        )

    application = db.scalar(
        select(Application)
        .options(joinedload(Application.job), joinedload(Application.applicant))
        .where(Application.id == application_id)
    )
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found.",
        )
    if application.job.employer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage applications for your own jobs.",
        )

    previous_status = application.status
    application.status = update.status
    if previous_status != update.status:
        application.status = update.status
        db.add(
            Notification(
                user_id=application.applicant_id,
                application_id=application.id,
                message=f"Your application for {application.job.title} was {update.status}.",
            )
        )
    db.commit()
    return db.scalar(
        select(Application)
        .options(joinedload(Application.job), joinedload(Application.applicant))
        .where(Application.id == application_id)
    )


@router.delete("/me/{application_id}", response_model=ApplicationResponse)
def withdraw_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "job_seeker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only job seekers can withdraw applications.",
        )

    application = db.scalar(
        select(Application)
        .options(joinedload(Application.job), joinedload(Application.applicant))
        .where(Application.id == application_id)
    )
    if application is None or application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found.",
        )
    if application.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending applications can be withdrawn.",
        )

    application.status = "withdrawn"
    db.add(
        Notification(
            user_id=application.job.employer_id,
            application_id=application.id,
            message=f"{current_user.full_name} withdrew their application for {application.job.title}.",
        )
    )
    db.commit()
    return db.scalar(
        select(Application)
        .options(joinedload(Application.job), joinedload(Application.applicant))
        .where(Application.id == application_id)
    )


@router.get("/{application_id}/resume")
def download_resume(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = db.scalar(
        select(Application)
        .options(joinedload(Application.job))
        .where(Application.id == application_id)
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    is_applicant = application.applicant_id == current_user.id
    is_job_employer = application.job.employer_id == current_user.id
    if not (is_applicant or is_job_employer):
        raise HTTPException(status_code=403, detail="You cannot access this resume.")
    if not application.resume_data or not application.resume_filename:
        raise HTTPException(status_code=404, detail="No resume was attached.")

    return Response(
        content=application.resume_data,
        media_type=application.resume_content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(application.resume_filename)}",
            "X-Content-Type-Options": "nosniff",
        },
    )
