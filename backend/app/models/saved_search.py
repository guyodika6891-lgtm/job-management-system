from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    q: Mapped[str | None] = mapped_column(String(150), nullable=True)
    location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    company: Mapped[str | None] = mapped_column(String(150), nullable=True)
    salary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
