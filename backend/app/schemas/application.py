from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ApplicantSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str


class ApplicationJobSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    company: str
    location: str
    status: str


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    applicant_id: int
    status: str
    applied_at: datetime
    resume_filename: str | None
    job: ApplicationJobSummary
    applicant: ApplicantSummary


class ApplicationStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|accepted|rejected)$")
