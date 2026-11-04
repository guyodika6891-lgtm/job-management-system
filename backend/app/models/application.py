
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Application(Base):
    __tablename__ = "applications"

    __table_args__ = (
        UniqueConstraint(
            "job_id",
            "applicant_id",
            name="uq_job_applicant",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    applicant_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(20), default="other", nullable=False
    )
    resume_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resume_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    job: Mapped["Job"] = relationship(back_populates="applications")
    applicant: Mapped["User"] = relationship(
        back_populates="applications"
    )
