"""modulo de gestao de projetos e tarefas

Revision ID: 0011_projetos_tarefas
Revises: 0010_analise_nc
Create Date: 2026-02-24 09:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0011_projetos_tarefas'
down_revision: Union[str, None] = '0010_analise_nc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


projeto_status_enum = sa.Enum(
    'planejamento',
    'em_andamento',
    'pausado',
    'concluido',
    'cancelado',
    name='projeto_status_enum',
    native_enum=False,
)

projeto_prioridade_enum = sa.Enum(
    'baixa',
    'media',
    'alta',
    'critica',
    name='projeto_prioridade_enum',
    native_enum=False,
)

tarefa_status_enum = sa.Enum(
    'backlog',
    'a_fazer',
    'em_andamento',
    'em_revisao',
    'concluida',
    'bloqueada',
    name='tarefa_status_enum',
    native_enum=False,
)

tarefa_prioridade_enum = sa.Enum(
    'baixa',
    'media',
    'alta',
    'critica',
    name='tarefa_prioridade_enum',
    native_enum=False,
)


def upgrade() -> None:
    op.create_table(
        'projetos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('codigo', sa.String(length=50), nullable=False),
        sa.Column('nome', sa.String(length=150), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('status', projeto_status_enum, nullable=False, server_default='planejamento'),
        sa.Column('prioridade', projeto_prioridade_enum, nullable=False, server_default='media'),
        sa.Column('progresso', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('data_inicio', sa.Date(), nullable=True),
        sa.Column('data_fim_prevista', sa.Date(), nullable=True),
        sa.Column('data_fim_real', sa.Date(), nullable=True),
        sa.Column('gerente_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['gerente_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('codigo'),
        sa.CheckConstraint('progresso >= 0 AND progresso <= 100', name='ck_projeto_progresso_range'),
    )
    op.create_index(op.f('ix_projetos_id'), 'projetos', ['id'], unique=False)
    op.create_index(op.f('ix_projetos_codigo'), 'projetos', ['codigo'], unique=True)
    op.create_index(op.f('ix_projetos_data_fim_prevista'), 'projetos', ['data_fim_prevista'], unique=False)
    op.create_index(op.f('ix_projetos_gerente_id'), 'projetos', ['gerente_id'], unique=False)
    op.alter_column('projetos', 'status', server_default=None)
    op.alter_column('projetos', 'prioridade', server_default=None)

    op.create_table(
        'tarefas_projeto',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('projeto_id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('status', tarefa_status_enum, nullable=False, server_default='backlog'),
        sa.Column('prioridade', tarefa_prioridade_enum, nullable=False, server_default='media'),
        sa.Column('responsavel_id', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('completed_at', sa.Date(), nullable=True),
        sa.Column('estimativa_horas', sa.Integer(), nullable=True),
        sa.Column('horas_registradas', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['projeto_id'], ['projetos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['responsavel_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('horas_registradas >= 0', name='ck_tarefa_horas_registradas_nonnegative'),
        sa.CheckConstraint('estimativa_horas IS NULL OR estimativa_horas >= 0', name='ck_tarefa_estimativa_nonnegative'),
    )
    op.create_index(op.f('ix_tarefas_projeto_id'), 'tarefas_projeto', ['id'], unique=False)
    op.create_index(op.f('ix_tarefas_projeto_projeto_id'), 'tarefas_projeto', ['projeto_id'], unique=False)
    op.create_index(op.f('ix_tarefas_projeto_responsavel_id'), 'tarefas_projeto', ['responsavel_id'], unique=False)
    op.create_index(op.f('ix_tarefas_projeto_due_date'), 'tarefas_projeto', ['due_date'], unique=False)
    op.alter_column('tarefas_projeto', 'status', server_default=None)
    op.alter_column('tarefas_projeto', 'prioridade', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_tarefas_projeto_due_date'), table_name='tarefas_projeto')
    op.drop_index(op.f('ix_tarefas_projeto_responsavel_id'), table_name='tarefas_projeto')
    op.drop_index(op.f('ix_tarefas_projeto_projeto_id'), table_name='tarefas_projeto')
    op.drop_index(op.f('ix_tarefas_projeto_id'), table_name='tarefas_projeto')
    op.drop_table('tarefas_projeto')

    op.drop_index(op.f('ix_projetos_gerente_id'), table_name='projetos')
    op.drop_index(op.f('ix_projetos_data_fim_prevista'), table_name='projetos')
    op.drop_index(op.f('ix_projetos_codigo'), table_name='projetos')
    op.drop_index(op.f('ix_projetos_id'), table_name='projetos')
    op.drop_table('projetos')
