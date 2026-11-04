"""support Google account recovery and application source analytics

Revision ID: 20261103_google_sources
Revises: 20261102_one_admin
Create Date: 2026-11-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261103_google_sources"
down_revision: Union[str, Sequence[str], None] = "20261102_one_admin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "password_reset_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "applications",
        sa.Column(
            "source",
            sa.String(length=20),
            nullable=False,
            server_default="other",
        ),
    )
    op.alter_column("users", "password_reset_version", server_default=None)
    op.alter_column("applications", "source", server_default=None)


def downgrade() -> None:
    op.drop_column("applications", "source")
    op.drop_column("users", "password_reset_version")
