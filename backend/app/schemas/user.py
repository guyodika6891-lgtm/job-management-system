
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["job_seeker", "employer", "admin"] = "job_seeker"
    company_name: str | None = Field(default=None, min_length=2, max_length=150)
    admin_registration_code: str | None = Field(default=None, max_length=256)

    @field_validator("company_name", mode="before")
    @classmethod
    def normalize_empty_company_name(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def validate_employer_company(self):
        if self.role == "employer" and not self.company_name:
            raise ValueError("Company name is required for employer accounts.")
        if self.role == "admin" and self.company_name:
            raise ValueError("Administrator accounts cannot have a company name.")
        return self


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    company_name: str | None = None
    is_active: bool
