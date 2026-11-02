from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.auth import get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models import (
    Application,
    ApplicationMessage,
    Interview,
    Job,
    Notification,
    SavedJob,
    SavedSearch,
    User,
)
from app.schemas.admin import (
    AdminApplicationPage,
    AdminApplicationResponse,
    AdminJobPage,
    AdminJobResponse,
    AdminJobStatusUpdate,
    AdminOverview,
    AdminSystemStatus,
    AdminUserCreate,
    AdminUserPage,
    AdminUserResponse,
    AdminUserUpdate,
)

router = APIRouter(prefix="/api/admin", tags=["Administration"])
UserEmployer = aliased(User)


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only system administrators can access this resource.",
        )
    return current_user


def count_rows(db: Session, model) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def ensure_active_admin_remains(db: Session, user: User) -> None:
    if user.role != "admin" or not user.is_active:
        return
    active_admin_ids = db.scalars(
        select(User.id)
        .where(
            User.role == "admin",
            User.is_active.is_(True),
        )
        .order_by(User.id)
        .with_for_update()
    ).all()
    if not any(admin_id != user.id for admin_id in active_admin_ids):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The last active administrator cannot be disabled, demoted, or deleted.",
        )


def delete_job_records(db: Session, job_ids: list[int]) -> None:
    if not job_ids:
        return
    application_ids = select(Application.id).where(Application.job_id.in_(job_ids))
    db.execute(delete(Interview).where(Interview.application_id.in_(application_ids)))
    db.execute(
        delete(ApplicationMessage).where(
            ApplicationMessage.application_id.in_(application_ids)
        )
    )
    db.execute(
        delete(Notification).where(Notification.application_id.in_(application_ids))
    )
    db.execute(delete(SavedJob).where(SavedJob.job_id.in_(job_ids)))
    db.execute(delete(Application).where(Application.id.in_(application_ids)))
    db.execute(delete(Job).where(Job.id.in_(job_ids)))


def delete_user_records(db: Session, user: User) -> None:
    job_ids = list(
        db.scalars(select(Job.id).where(Job.employer_id == user.id)).all()
    )
    application_ids = select(Application.id).where(
        or_(
            Application.applicant_id == user.id,
            Application.job_id.in_(job_ids) if job_ids else False,
        )
    )

    db.execute(
        delete(Interview).where(
            or_(
                Interview.application_id.in_(application_ids),
                Interview.created_by == user.id,
            )
        )
    )
    db.execute(
        delete(ApplicationMessage).where(
            or_(
                ApplicationMessage.application_id.in_(application_ids),
                ApplicationMessage.sender_id == user.id,
            )
        )
    )
    db.execute(
        delete(Notification).where(
            or_(
                Notification.application_id.in_(application_ids),
                Notification.user_id == user.id,
            )
        )
    )
    db.execute(
        delete(SavedJob).where(
            or_(
                SavedJob.user_id == user.id,
                SavedJob.job_id.in_(job_ids) if job_ids else False,
            )
        )
    )
    db.execute(delete(SavedSearch).where(SavedSearch.user_id == user.id))
    db.execute(delete(Application).where(Application.id.in_(application_ids)))
    db.execute(delete(Job).where(Job.employer_id == user.id))
    db.delete(user)


@router.get("/overview", response_model=AdminOverview)
def get_admin_overview(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return AdminOverview(
        total_users=count_rows(db, User),
        active_users=db.scalar(
            select(func.count(User.id)).where(User.is_active.is_(True))
        )
        or 0,
        job_seekers=db.scalar(
            select(func.count(User.id)).where(User.role == "job_seeker")
        )
        or 0,
        employers=db.scalar(
            select(func.count(User.id)).where(User.role == "employer")
        )
        or 0,
        admins=db.scalar(
            select(func.count(User.id)).where(
                User.role == "admin", User.is_active.is_(True)
            )
        )
        or 0,
        total_jobs=count_rows(db, Job),
        open_jobs=db.scalar(
            select(func.count(Job.id)).where(Job.status == "open")
        )
        or 0,
        total_applications=count_rows(db, Application),
        pending_applications=db.scalar(
            select(func.count(Application.id)).where(Application.status == "pending")
        )
        or 0,
    )


@router.get("/system", response_model=AdminSystemStatus)
def get_system_status(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    db.execute(select(1))
    return AdminSystemStatus(
        api_name="Job Management System API",
        api_version="1.0.0",
        api_status="healthy",
        database_status="connected",
        configuration_source="Deployment environment (backend/.env)",
    )


@router.get("/users", response_model=AdminUserPage)
def list_users(
    q: str | None = Query(default=None, max_length=150),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    statement = select(User)
    if q and q.strip():
        term = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                User.company_name.ilike(term),
            )
        )
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    users = db.scalars(
        statement.order_by(User.created_at.desc(), User.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return AdminUserPage(
        total=total,
        limit=limit,
        offset=offset,
        items=[AdminUserResponse.model_validate(user) for user in users],
    )


@router.post(
    "/users",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    user_data: AdminUserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    email = str(user_data.email).lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    user = User(
        full_name=user_data.full_name.strip(),
        email=email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        company_name=user_data.company_name.strip()
        if user_data.company_name
        else None,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if db.scalar(select(User.id).where(User.email == email)) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        raise
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    update: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    changes = update.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update.",
        )
    if any(
        value is None and field != "company_name"
        for field, value in changes.items()
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Updated user fields cannot be null.",
        )
    if "full_name" in changes:
        changes["full_name"] = changes["full_name"].strip()
        if len(changes["full_name"]) < 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Full name must contain at least two non-space characters.",
            )

    next_role = changes.get("role", user.role)
    next_active = changes.get("is_active", user.is_active)
    next_company = changes.get("company_name", user.company_name)
    if next_company is not None:
        next_company = next_company.strip()
    if next_role == "employer" and not next_company:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Add a company name before changing this account to an employer.",
        )
    if next_role == "job_seeker":
        if "company_name" in changes and changes["company_name"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Job seeker accounts cannot have a company name.",
            )
        changes["company_name"] = None
    elif "company_name" in changes:
        changes["company_name"] = next_company
        if next_company is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Company name cannot be empty for employer accounts.",
            )

    if user.id == admin.id and (
        next_role != "admin" or not next_active
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot disable or change your own administrator account.",
        )
    if user.role == "admin" and (
        next_role != "admin" or not next_active
    ):
        ensure_active_admin_remains(db, user)

    for field, value in changes.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot delete your own administrator account.",
        )
    ensure_active_admin_remains(db, user)
    delete_user_records(db, user)
    db.commit()
    return None


@router.get("/jobs", response_model=AdminJobPage)
def list_jobs(
    q: str | None = Query(default=None, max_length=150),
    job_status: str | None = Query(default=None, alias="status", pattern="^(open|closed)$"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    statement = (
        select(
            Job.id,
            Job.title,
            Job.company,
            Job.location,
            Job.status,
            Job.employer_id,
            User.full_name.label("employer_name"),
            Job.created_at,
            func.count(Application.id).label("applications_count"),
        )
        .join(User, User.id == Job.employer_id)
        .outerjoin(Application, Application.job_id == Job.id)
        .group_by(Job.id, User.full_name)
    )
    if job_status:
        statement = statement.where(Job.status == job_status)
    if q and q.strip():
        term = f"%{q.strip()}%"
        statement = statement.where(
            or_(Job.title.ilike(term), Job.company.ilike(term), User.full_name.ilike(term))
        )

    total = db.scalar(
        select(func.count()).select_from(statement.order_by(None).subquery())
    ) or 0
    rows = db.execute(
        statement.order_by(Job.created_at.desc(), Job.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return AdminJobPage(
        total=total,
        limit=limit,
        offset=offset,
        items=[AdminJobResponse(**row._mapping) for row in rows],
    )


@router.patch("/jobs/{job_id}", response_model=AdminJobResponse)
def update_job_status(
    job_id: int,
    update: AdminJobStatusUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    job.status = update.status
    db.commit()
    row = db.execute(
        select(
            Job.id,
            Job.title,
            Job.company,
            Job.location,
            Job.status,
            Job.employer_id,
            User.full_name.label("employer_name"),
            Job.created_at,
            func.count(Application.id).label("applications_count"),
        )
        .join(User, User.id == Job.employer_id)
        .outerjoin(Application, Application.job_id == Job.id)
        .where(Job.id == job_id)
        .group_by(Job.id, User.full_name)
    ).one()
    return AdminJobResponse(**row._mapping)


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    delete_job_records(db, [job_id])
    db.commit()
    return None


@router.get("/applications", response_model=AdminApplicationPage)
def list_applications(
    q: str | None = Query(default=None, max_length=150),
    application_status: str | None = Query(
        default=None,
        alias="status",
        pattern="^(pending|accepted|rejected|withdrawn)$",
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    statement = (
        select(
            Application.id,
            Application.status,
            Application.applied_at,
            User.id.label("applicant_id"),
            User.full_name.label("applicant_name"),
            User.email.label("applicant_email"),
            Job.id.label("job_id"),
            Job.title.label("job_title"),
            Job.company,
            Job.location,
            UserEmployer.full_name.label("employer_name"),
        )
        .join(User, User.id == Application.applicant_id)
        .join(Job, Job.id == Application.job_id)
        .join(UserEmployer, UserEmployer.id == Job.employer_id)
    )
    if application_status:
        statement = statement.where(Application.status == application_status)
    if q and q.strip():
        term = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                Job.title.ilike(term),
                Job.company.ilike(term),
                UserEmployer.full_name.ilike(term),
            )
        )
    total = db.scalar(
        select(func.count()).select_from(statement.order_by(None).subquery())
    ) or 0
    rows = db.execute(
        statement.order_by(Application.applied_at.desc(), Application.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return AdminApplicationPage(
        total=total,
        limit=limit,
        offset=offset,
        items=[AdminApplicationResponse(**row._mapping) for row in rows],
    )
