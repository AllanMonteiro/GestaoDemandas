"""adicionar responsavel_id em atividades_subdemanda

Revision ID: 0024_atividade_responsavel
Revises: 0023_demanda_anexo_obs
Create Date: 2026-05-31
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0024_atividade_responsavel'
down_revision: Union[str, None] = '0023_demanda_anexo_obs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'atividades_subdemanda',
        sa.Column('responsavel_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_atividade_responsavel',
        'atividades_subdemanda',
        'usuarios',
        ['responsavel_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_atividade_responsavel', 'atividades_subdemanda', type_='foreignkey')
    op.drop_column('atividades_subdemanda', 'responsavel_id')
