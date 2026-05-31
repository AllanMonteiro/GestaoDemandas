"""criar tabela de historico das demandas de projeto

Revision ID: 0020_demanda_hist
Revises: 0019_tarefa_schema
Create Date: 2026-05-07 18:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0020_demanda_hist'
down_revision: Union[str, None] = '0019_tarefa_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


demanda_historico_tipo_enum = sa.Enum(
    'comentario',
    'status',
    'anexo',
    'sistema',
    name='demanda_historico_tipo_enum',
    native_enum=False,
)


def upgrade() -> None:
    op.create_table(
        'demandas_historico',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('demanda_id', sa.Integer(), nullable=False),
        sa.Column('tipo', demanda_historico_tipo_enum, nullable=False),
        sa.Column('conteudo', sa.Text(), nullable=False),
        sa.Column('old_status', sa.String(length=50), nullable=True),
        sa.Column('new_status', sa.String(length=50), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['demanda_id'], ['tarefas_projeto.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_demandas_historico_id'), 'demandas_historico', ['id'], unique=False)
    op.create_index(op.f('ix_demandas_historico_demanda_id'), 'demandas_historico', ['demanda_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_demandas_historico_demanda_id'), table_name='demandas_historico')
    op.drop_index(op.f('ix_demandas_historico_id'), table_name='demandas_historico')
    op.drop_table('demandas_historico')
