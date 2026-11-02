from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int | None
    message: str
    created_at: datetime
    read_at: datetime | None
