"""limit the system to one administrator account

Revision ID: 20261102_one_admin
Revises: 20261102_admin
Create Date: 2026-11-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261102_one_admin"
down_revision: Union[str, Sequence[str], None] = "20261102_admin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_users_single_admin",
        "users",
        ["role"],
        unique=True,
        postgresql_where=sa.text("role = 'admin'"),
        sqlite_where=sa.text("role = 'admin'"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_single_admin", table_name="users")
