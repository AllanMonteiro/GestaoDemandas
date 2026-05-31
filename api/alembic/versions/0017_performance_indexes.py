"""performance indexes: status, prioridade, prazo

Revision ID: 0017_performance_indexes
Revises: 0016_rename_demanda_eventos
Create Date: 2026-05-07 00:00:00
"""

from typing import Sequence, Union

from alembic import op


revision: str = '0017_performance_indexes'
down_revision: Union[str, None] = '0016_rename_demanda_eventos'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_demandas_status', 'demandas', ['status'])
    op.create_index('ix_demandas_prioridade', 'demandas', ['prioridade'])
    op.create_index('ix_demandas_prazo', 'demandas', ['prazo'])
    op.create_index('ix_tarefas_projeto_status', 'tarefas_projeto', ['status'])
    op.create_index('ix_tarefas_projeto_prioridade', 'tarefas_projeto', ['prioridade'])


def downgrade() -> None:
    op.drop_index('ix_tarefas_projeto_prioridade', table_name='tarefas_projeto')
    op.drop_index('ix_tarefas_projeto_status', table_name='tarefas_projeto')
    op.drop_index('ix_demandas_prazo', table_name='demandas')
    op.drop_index('ix_demandas_prioridade', table_name='demandas')
    op.drop_index('ix_demandas_status', table_name='demandas')
