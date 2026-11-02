
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    company: str = Field(min_length=2, max_length=150)
    location: str = Field(min_length=2, max_length=150)
    description: str = Field(min_length=10)
    salary: str | None = Field(default=None, max_length=100)



class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    company: str | None = Field(default=None, min_length=2, max_length=150)
    location: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, min_length=10)
    salary: str | None = Field(default=None, max_length=100)
    status: Literal["open", "closed"] | None = None

    @field_validator("status")
    @classmethod
    def status_cannot_be_null(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Status cannot be null.")
        return value



class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    company: str
    location: str
    description: str
    salary: str | None
    status: str
    employer_id: int
    created_at: datetime
