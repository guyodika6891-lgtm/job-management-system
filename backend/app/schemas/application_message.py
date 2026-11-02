from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ApplicationMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class ApplicationMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    sender_id: int
    body: str
    created_at: datetime
