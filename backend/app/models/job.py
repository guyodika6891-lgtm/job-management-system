
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str] = mapped_column(String(150), nullable=False)
    location: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    salary: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="open", nullable=False
    )
    employer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    employer: Mapped["User"] = relationship(back_populates="jobs")
    applications: Mapped[list["Application"]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
    )
