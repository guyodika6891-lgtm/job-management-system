"""add saved jobs, alerts, interviews, messages, and analytics support

Revision ID: 20261102_tools
Revises: 20261101_features
Create Date: 2026-11-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261102_tools"
down_revision: Union[str, Sequence[str], None] = "20261101_features"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "job_id", name="uq_saved_job_user_job"),
    )
    op.create_index(op.f("ix_saved_jobs_id"), "saved_jobs", ["id"], unique=False)
    op.create_index(op.f("ix_saved_jobs_job_id"), "saved_jobs", ["job_id"], unique=False)
    op.create_index(op.f("ix_saved_jobs_user_id"), "saved_jobs", ["user_id"], unique=False)

    op.create_table(
        "saved_searches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("q", sa.String(length=150), nullable=True),
        sa.Column("location", sa.String(length=150), nullable=True),
        sa.Column("company", sa.String(length=150), nullable=True),
        sa.Column("salary", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_saved_searches_id"), "saved_searches", ["id"], unique=False)
    op.create_index(
        op.f("ix_saved_searches_user_id"), "saved_searches", ["user_id"], unique=False
    )

    op.create_table(
        "interviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["application_id"], ["applications.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_interviews_id"), "interviews", ["id"], unique=False)
    op.create_index(
        op.f("ix_interviews_application_id"),
        "interviews",
        ["application_id"],
        unique=False,
    )

    op.create_table(
        "application_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["application_id"], ["applications.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_application_messages_id"), "application_messages", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_application_messages_application_id"),
        "application_messages",
        ["application_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_application_messages_application_id"),
        table_name="application_messages",
    )
    op.drop_index(op.f("ix_application_messages_id"), table_name="application_messages")
    op.drop_table("application_messages")
    op.drop_index(op.f("ix_interviews_application_id"), table_name="interviews")
    op.drop_index(op.f("ix_interviews_id"), table_name="interviews")
    op.drop_table("interviews")
    op.drop_index(op.f("ix_saved_searches_user_id"), table_name="saved_searches")
    op.drop_index(op.f("ix_saved_searches_id"), table_name="saved_searches")
    op.drop_table("saved_searches")
    op.drop_index(op.f("ix_saved_jobs_user_id"), table_name="saved_jobs")
    op.drop_index(op.f("ix_saved_jobs_job_id"), table_name="saved_jobs")
    op.drop_index(op.f("ix_saved_jobs_id"), table_name="saved_jobs")
    op.drop_table("saved_jobs")
