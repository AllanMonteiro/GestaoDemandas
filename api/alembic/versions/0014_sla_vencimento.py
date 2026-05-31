"""adiciona sla_vencimento em gestao_demandas

Revision ID: 0014_sla_vencimento
Revises: 0013_gestao_demandas
Create Date: 2026-05-06 11:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0014_sla_vencimento'
down_revision: Union[str, None] = '0013_gestao_demandas'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'gestao_demandas',
        sa.Column('sla_vencimento', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f('ix_gestao_demandas_sla_vencimento'),
        'gestao_demandas',
        ['sla_vencimento'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_gestao_demandas_sla_vencimento'), table_name='gestao_demandas')
    op.drop_column('gestao_demandas', 'sla_vencimento')