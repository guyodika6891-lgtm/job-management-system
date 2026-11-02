from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InterviewCreate(BaseModel):
    scheduled_at: datetime
    note: str | None = Field(default=None, max_length=2000)

    @field_validator("scheduled_at")
    @classmethod
    def scheduled_time_must_be_future_and_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Interview time must include a timezone.")
        if value <= datetime.now(timezone.utc):
            raise ValueError("Interview time must be in the future.")
        return value


class InterviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    scheduled_at: datetime
    note: str | None
    status: str
    created_by: int
    created_at: datetime
    responded_at: datetime | None


class InterviewDecision(BaseModel):
    status: str = Field(pattern="^(accepted|declined)$")
