from pydantic import BaseModel


class JobAnalyticsItem(BaseModel):
    job_id: int
    title: str
    status: str
    applications: int
    pending: int
    accepted: int
    rejected: int


class EmployerAnalytics(BaseModel):
    total_jobs: int
    open_jobs: int
    total_applications: int
    pending_applications: int
    accepted_applications: int
    rejected_applications: int
    jobs: list[JobAnalyticsItem]
