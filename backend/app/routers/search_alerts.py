from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.models import Job, Notification, SavedSearch, User
from app.schemas.saved_search import SavedSearchCreate, SavedSearchResponse

router = APIRouter(prefix="/api/search-alerts", tags=["Job alerts"])


def require_job_seeker(user: User) -> None:
    if user.role != "job_seeker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only job seekers can manage job alerts.",
        )


@router.get("/", response_model=list[SavedSearchResponse])
def get_search_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_job_seeker(current_user)
    return db.scalars(
        select(SavedSearch)
        .where(SavedSearch.user_id == current_user.id)
        .order_by(SavedSearch.created_at.desc())
    ).all()


@router.post("/", response_model=SavedSearchResponse, status_code=status.HTTP_201_CREATED)
def create_search_alert(
    alert_data: SavedSearchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_job_seeker(current_user)
    values = alert_data.model_dump()
    for field in ("q", "location", "company", "salary"):
        if values[field] is not None:
            values[field] = values[field].strip() or None

    if not any(values[field] for field in ("q", "location", "company", "salary")):
        raise HTTPException(status_code=422, detail="Add at least one search filter.")

    alert = SavedSearch(user_id=current_user.id, **values)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_search_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_job_seeker(current_user)
    alert = db.get(SavedSearch, alert_id)
    if alert is None or alert.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Job alert not found.")

    db.delete(alert)
    db.commit()
    return None


def notify_matching_searches(db: Session, job: Job) -> None:
    alerts = db.scalars(select(SavedSearch)).all()
    searchable = {
        "q": (job.title, job.company, job.description),
        "location": (job.location,),
        "company": (job.company,),
        "salary": (job.salary or "",),
    }

    for alert in alerts:
        matches = True
        for field, values in searchable.items():
            term = getattr(alert, field)
            if term and not any(term.casefold() in value.casefold() for value in values):
                matches = False
                break
        if matches:
            db.add(
                Notification(
                    user_id=alert.user_id,
                    message=f'New job match for "{alert.name}": {job.title} at {job.company}.',
                )
            )
