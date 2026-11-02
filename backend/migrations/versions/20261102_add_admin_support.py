"""add admin support and active user status

Revision ID: 20261102_admin
Revises: 20261102_tools
Create Date: 2026-11-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261102_admin"
down_revision: Union[str, Sequence[str], None] = "20261102_tools"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "is_active")
