from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ApplicationMessage(Base):
    __tablename__ = "application_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
