"""add application features

Revision ID: 20261101_features
Revises: d62fddd31fa2
Create Date: 2026-11-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261101_features"
down_revision: Union[str, Sequence[str], None] = "d62fddd31fa2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("company_name", sa.String(length=150), nullable=True))
    op.add_column("applications", sa.Column("resume_filename", sa.String(length=255), nullable=True))
    op.add_column("applications", sa.Column("resume_content_type", sa.String(length=100), nullable=True))
    op.add_column("applications", sa.Column("resume_data", sa.LargeBinary(), nullable=True))
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_id"), "notifications", ["id"], unique=False)
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_id"), table_name="notifications")
    op.drop_table("notifications")
    op.drop_column("applications", "resume_data")
    op.drop_column("applications", "resume_content_type")
    op.drop_column("applications", "resume_filename")
    op.drop_column("users", "company_name")
