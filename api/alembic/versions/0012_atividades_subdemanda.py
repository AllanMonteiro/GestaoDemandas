"""atividades dentro das subdemandas

Revision ID: 0012_atividades_subdemanda
Revises: 0011_projetos_tarefas
Create Date: 2026-02-25 10:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0012_atividades_subdemanda'
down_revision: Union[str, None] = '0011_projetos_tarefas'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


atividade_status_enum = sa.Enum(
    'pendente',
    'concluida',
    name='atividade_status_enum',
    native_enum=False,
)


def upgrade() -> None:
    op.create_table(
        'atividades_subdemanda',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tarefa_id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('status', atividade_status_enum, nullable=False, server_default='pendente'),
        sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tarefa_id'], ['tarefas_projeto.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('ordem >= 0', name='ck_atividade_subdemanda_ordem_nonnegative'),
    )
    op.create_index(op.f('ix_atividades_subdemanda_id'), 'atividades_subdemanda', ['id'], unique=False)
    op.create_index(op.f('ix_atividades_subdemanda_tarefa_id'), 'atividades_subdemanda', ['tarefa_id'], unique=False)
    op.alter_column('atividades_subdemanda', 'status', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_atividades_subdemanda_tarefa_id'), table_name='atividades_subdemanda')
    op.drop_index(op.f('ix_atividades_subdemanda_id'), table_name='atividades_subdemanda')
    op.drop_table('atividades_subdemanda')
