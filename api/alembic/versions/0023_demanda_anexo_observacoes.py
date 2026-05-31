"""adicionar observacoes em anexos de demanda

Revision ID: 0023_demanda_anexo_observacoes
Revises: 0022_subdemandas_vinculadas_demanda
Create Date: 2026-05-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0023_demanda_anexo_obs'
down_revision: Union[str, None] = '0022_sub_vinculadas'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('demanda_anexos', sa.Column('observacoes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('demanda_anexos', 'observacoes')
