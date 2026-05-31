"""alinhar tabela de tarefas_projeto com o modelo atual

Revision ID: 0019_tarefa_schema
Revises: 0018_ativ_setor_subatv
Create Date: 2026-05-07 18:05:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0019_tarefa_schema'
down_revision: Union[str, None] = '0018_ativ_setor_subatv'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('tarefas_projeto', 'status', existing_type=sa.String(length=12), type_=sa.String(length=20), existing_nullable=False)
    op.add_column('tarefas_projeto', sa.Column('solicitante_id', sa.Integer(), nullable=True))
    op.add_column('tarefas_projeto', sa.Column('setor', sa.String(length=100), nullable=True))
    op.add_column('tarefas_projeto', sa.Column('motivo_cancelamento', sa.Text(), nullable=True))
    op.create_foreign_key(
        'tarefas_projeto_solicitante_id_fkey',
        'tarefas_projeto',
        'usuarios',
        ['solicitante_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index(op.f('ix_tarefas_projeto_solicitante_id'), 'tarefas_projeto', ['solicitante_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_tarefas_projeto_solicitante_id'), table_name='tarefas_projeto')
    op.drop_constraint('tarefas_projeto_solicitante_id_fkey', 'tarefas_projeto', type_='foreignkey')
    op.drop_column('tarefas_projeto', 'motivo_cancelamento')
    op.drop_column('tarefas_projeto', 'setor')
    op.drop_column('tarefas_projeto', 'solicitante_id')
    op.alter_column('tarefas_projeto', 'status', existing_type=sa.String(length=20), type_=sa.String(length=12), existing_nullable=False)
