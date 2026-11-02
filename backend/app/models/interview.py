from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="proposed", nullable=False)
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
