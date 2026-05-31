"""gestao standalone de demandas

Revision ID: 0013_gestao_demandas
Revises: 0012_atividades_subdemanda
Create Date: 2026-05-06 10:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0013_gestao_demandas'
down_revision: Union[str, None] = '0012_atividades_subdemanda'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

gestao_status_enum = sa.Enum(
    'nova', 'triagem', 'aguardando_info', 'aprovada',
    'execucao', 'validacao', 'concluida', 'cancelada',
    name='gestao_status_enum',
    native_enum=False,
)

gestao_prioridade_enum = sa.Enum(
    'baixa', 'media', 'alta', 'critica',
    name='gestao_prioridade_enum',
    native_enum=False,
)


def upgrade() -> None:
    op.create_table(
        'gestao_demandas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('solicitante_id', sa.Integer(), nullable=True),
        sa.Column('responsavel_id', sa.Integer(), nullable=True),
        sa.Column('setor', sa.String(length=100), nullable=True),
        sa.Column('prioridade', gestao_prioridade_enum, nullable=False, server_default='media'),
        sa.Column('status', gestao_status_enum, nullable=False, server_default='nova'),
        sa.Column('prazo', sa.Date(), nullable=True),
        sa.Column('data_abertura', sa.Date(), nullable=False, server_default=sa.text('CURRENT_DATE')),
        sa.Column('data_conclusao', sa.Date(), nullable=True),
        sa.Column('motivo_cancelamento', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['solicitante_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['responsavel_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_gestao_demandas_id'), 'gestao_demandas', ['id'], unique=False)
    op.create_index(op.f('ix_gestao_demandas_solicitante_id'), 'gestao_demandas', ['solicitante_id'], unique=False)
    op.create_index(op.f('ix_gestao_demandas_responsavel_id'), 'gestao_demandas', ['responsavel_id'], unique=False)
    op.create_index(op.f('ix_gestao_demandas_prazo'), 'gestao_demandas', ['prazo'], unique=False)
    op.alter_column('gestao_demandas', 'status', server_default=None)
    op.alter_column('gestao_demandas', 'prioridade', server_default=None)

    op.create_table(
        'demanda_eventos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('demanda_id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=True),
        sa.Column('tipo_evento', sa.String(length=50), nullable=False),
        sa.Column('campo_alterado', sa.String(length=100), nullable=True),
        sa.Column('valor_anterior', sa.Text(), nullable=True),
        sa.Column('valor_novo', sa.Text(), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['demanda_id'], ['gestao_demandas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_demanda_eventos_id'), 'demanda_eventos', ['id'], unique=False)
    op.create_index(op.f('ix_demanda_eventos_demanda_id'), 'demanda_eventos', ['demanda_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_demanda_eventos_demanda_id'), table_name='demanda_eventos')
    op.drop_index(op.f('ix_demanda_eventos_id'), table_name='demanda_eventos')
    op.drop_table('demanda_eventos')

    op.drop_index(op.f('ix_gestao_demandas_prazo'), table_name='gestao_demandas')
    op.drop_index(op.f('ix_gestao_demandas_responsavel_id'), table_name='gestao_demandas')
    op.drop_index(op.f('ix_gestao_demandas_solicitante_id'), table_name='gestao_demandas')
    op.drop_index(op.f('ix_gestao_demandas_id'), table_name='gestao_demandas')
    op.drop_table('gestao_demandas')
