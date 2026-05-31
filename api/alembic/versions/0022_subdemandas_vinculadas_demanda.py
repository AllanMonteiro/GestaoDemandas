"""vincular subdemandas diretamente a demandas

Revision ID: 0022_subdemandas_vinculadas_demanda
Revises: 0021_demanda_analises_metodologias
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0022_sub_vinculadas'
down_revision: Union[str, None] = '0021_demanda_anal'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('demandas', sa.Column('parent_demanda_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_demandas_parent_demanda_id'), 'demandas', ['parent_demanda_id'], unique=False)
    op.create_foreign_key(
        'fk_demandas_parent_demanda_id_demandas',
        'demandas',
        'demandas',
        ['parent_demanda_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint('fk_demandas_parent_demanda_id_demandas', 'demandas', type_='foreignkey')
    op.drop_index(op.f('ix_demandas_parent_demanda_id'), table_name='demandas')
    op.drop_column('demandas', 'parent_demanda_id')
