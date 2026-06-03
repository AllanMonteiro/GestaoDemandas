"""adicionar icone em atividades_setores_config e atividades_subatividades_config

Revision ID: 0025_icone_atividades
Revises: 0024_atividade_responsavel
Create Date: 2026-06-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0025_icone_atividades'
down_revision: Union[str, None] = '0024_atividade_responsavel'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'atividades_setores_config',
        sa.Column('icone', sa.String(20), nullable=True),
    )
    op.add_column(
        'atividades_subatividades_config',
        sa.Column('icone', sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('atividades_setores_config', 'icone')
    op.drop_column('atividades_subatividades_config', 'icone')
