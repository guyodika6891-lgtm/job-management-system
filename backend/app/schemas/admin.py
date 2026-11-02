from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


AdminManagedRole = Literal["job_seeker", "employer"]


class AdminUserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: AdminManagedRole
    company_name: str | None = Field(default=None, min_length=2, max_length=150)

    @model_validator(mode="after")
    def require_company_for_employers(self):
        self.full_name = self.full_name.strip()
        if len(self.full_name) < 2:
            raise ValueError("Full name must contain at least two non-space characters.")
        if self.company_name is not None:
            self.company_name = self.company_name.strip()
        if self.role == "employer" and not self.company_name:
            raise ValueError("Company name is required for employer accounts.")
        if self.role == "job_seeker" and self.company_name:
            raise ValueError("Job seeker accounts cannot have a company name.")
        return self


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    role: AdminManagedRole | None = None
    company_name: str | None = Field(default=None, min_length=2, max_length=150)
    is_active: bool | None = None


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    company_name: str | None
    is_active: bool
    created_at: datetime


class AdminUserPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AdminUserResponse]


class AdminOverview(BaseModel):
    total_users: int
    active_users: int
    job_seekers: int
    employers: int
    admins: int
    total_jobs: int
    open_jobs: int
    total_applications: int
    pending_applications: int


class AdminJobResponse(BaseModel):
    id: int
    title: str
    company: str
    location: str
    status: str
    employer_id: int
    employer_name: str
    created_at: datetime
    applications_count: int


class AdminJobPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AdminJobResponse]


class AdminJobStatusUpdate(BaseModel):
    status: Literal["open", "closed"]


class AdminApplicationResponse(BaseModel):
    id: int
    status: str
    applied_at: datetime
    applicant_id: int
    applicant_name: str
    applicant_email: EmailStr
    job_id: int
    job_title: str
    company: str
    location: str
    employer_name: str


class AdminApplicationPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AdminApplicationResponse]


class AdminSystemStatus(BaseModel):
    api_name: str
    api_version: str
    api_status: str
    database_status: str
    configuration_source: str
