"""monitoramento de criterio com notificacoes e resolucoes

Revision ID: 0009_monitoramentos
Revises: 0008_doc_evidencia
Create Date: 2026-02-22 13:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0009_monitoramentos'
down_revision: Union[str, None] = '0008_doc_evidencia'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


status_monitoramento_criterio_enum = sa.Enum(
    'sem_dados',
    'conforme',
    'alerta',
    'critico',
    name='status_monitoramento_criterio_enum',
    native_enum=False,
)

status_notificacao_monitoramento_enum = sa.Enum(
    'aberta',
    'em_tratamento',
    'resolvida',
    'cancelada',
    name='status_notificacao_monitoramento_enum',
    native_enum=False,
)

prioridade_enum = sa.Enum(
    'baixa',
    'media',
    'alta',
    'critica',
    name='prioridade_enum',
    native_enum=False,
)


def upgrade() -> None:
    op.create_table(
        'monitoramentos_criterio',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('programa_id', sa.Integer(), nullable=False),
        sa.Column('auditoria_ano_id', sa.Integer(), nullable=False),
        sa.Column('criterio_id', sa.Integer(), nullable=False),
        sa.Column('mes_referencia', sa.Date(), nullable=False),
        sa.Column(
            'status_monitoramento',
            status_monitoramento_criterio_enum,
            nullable=False,
            server_default='sem_dados',
        ),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['auditoria_ano_id'], ['auditorias_ano.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['criterio_id'], ['criterios.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['programa_id'], ['programas_certificacao.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'programa_id',
            'auditoria_ano_id',
            'criterio_id',
            'mes_referencia',
            name='uq_monitoramento_criterio_mes',
        ),
    )
    op.alter_column('monitoramentos_criterio', 'status_monitoramento', server_default=None)
    op.create_index(op.f('ix_monitoramentos_criterio_id'), 'monitoramentos_criterio', ['id'], unique=False)
    op.create_index(op.f('ix_monitoramentos_criterio_programa_id'), 'monitoramentos_criterio', ['programa_id'], unique=False)
    op.create_index(op.f('ix_monitoramentos_criterio_auditoria_ano_id'), 'monitoramentos_criterio', ['auditoria_ano_id'], unique=False)
    op.create_index(op.f('ix_monitoramentos_criterio_criterio_id'), 'monitoramentos_criterio', ['criterio_id'], unique=False)
    op.create_index(op.f('ix_monitoramentos_criterio_mes_referencia'), 'monitoramentos_criterio', ['mes_referencia'], unique=False)

    op.create_table(
        'notificacoes_monitoramento',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('programa_id', sa.Integer(), nullable=False),
        sa.Column('auditoria_ano_id', sa.Integer(), nullable=False),
        sa.Column('criterio_id', sa.Integer(), nullable=False),
        sa.Column('monitoramento_id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('severidade', prioridade_enum, nullable=False),
        sa.Column(
            'status_notificacao',
            status_notificacao_monitoramento_enum,
            nullable=False,
            server_default='aberta',
        ),
        sa.Column('responsavel_id', sa.Integer(), nullable=True),
        sa.Column('prazo', sa.Date(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['auditoria_ano_id'], ['auditorias_ano.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['criterio_id'], ['criterios.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['monitoramento_id'], ['monitoramentos_criterio.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['programa_id'], ['programas_certificacao.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['responsavel_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.alter_column('notificacoes_monitoramento', 'status_notificacao', server_default=None)
    op.create_index(op.f('ix_notificacoes_monitoramento_id'), 'notificacoes_monitoramento', ['id'], unique=False)
    op.create_index(op.f('ix_notificacoes_monitoramento_programa_id'), 'notificacoes_monitoramento', ['programa_id'], unique=False)
    op.create_index(op.f('ix_notificacoes_monitoramento_auditoria_ano_id'), 'notificacoes_monitoramento', ['auditoria_ano_id'], unique=False)
    op.create_index(op.f('ix_notificacoes_monitoramento_criterio_id'), 'notificacoes_monitoramento', ['criterio_id'], unique=False)
    op.create_index(op.f('ix_notificacoes_monitoramento_monitoramento_id'), 'notificacoes_monitoramento', ['monitoramento_id'], unique=False)
    op.create_index(op.f('ix_notificacoes_monitoramento_responsavel_id'), 'notificacoes_monitoramento', ['responsavel_id'], unique=False)
    op.create_index(op.f('ix_notificacoes_monitoramento_prazo'), 'notificacoes_monitoramento', ['prazo'], unique=False)

    op.create_table(
        'resolucoes_notificacao',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('programa_id', sa.Integer(), nullable=False),
        sa.Column('notificacao_id', sa.Integer(), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=False),
        sa.Column('resultado', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['notificacao_id'], ['notificacoes_monitoramento.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['programa_id'], ['programas_certificacao.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_resolucoes_notificacao_id'), 'resolucoes_notificacao', ['id'], unique=False)
    op.create_index(op.f('ix_resolucoes_notificacao_programa_id'), 'resolucoes_notificacao', ['programa_id'], unique=False)
    op.create_index(op.f('ix_resolucoes_notificacao_notificacao_id'), 'resolucoes_notificacao', ['notificacao_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_resolucoes_notificacao_notificacao_id'), table_name='resolucoes_notificacao')
    op.drop_index(op.f('ix_resolucoes_notificacao_programa_id'), table_name='resolucoes_notificacao')
    op.drop_index(op.f('ix_resolucoes_notificacao_id'), table_name='resolucoes_notificacao')
    op.drop_table('resolucoes_notificacao')

    op.drop_index(op.f('ix_notificacoes_monitoramento_prazo'), table_name='notificacoes_monitoramento')
    op.drop_index(op.f('ix_notificacoes_monitoramento_responsavel_id'), table_name='notificacoes_monitoramento')
    op.drop_index(op.f('ix_notificacoes_monitoramento_monitoramento_id'), table_name='notificacoes_monitoramento')
    op.drop_index(op.f('ix_notificacoes_monitoramento_criterio_id'), table_name='notificacoes_monitoramento')
    op.drop_index(op.f('ix_notificacoes_monitoramento_auditoria_ano_id'), table_name='notificacoes_monitoramento')
    op.drop_index(op.f('ix_notificacoes_monitoramento_programa_id'), table_name='notificacoes_monitoramento')
    op.drop_index(op.f('ix_notificacoes_monitoramento_id'), table_name='notificacoes_monitoramento')
    op.drop_table('notificacoes_monitoramento')

    op.drop_index(op.f('ix_monitoramentos_criterio_mes_referencia'), table_name='monitoramentos_criterio')
    op.drop_index(op.f('ix_monitoramentos_criterio_criterio_id'), table_name='monitoramentos_criterio')
    op.drop_index(op.f('ix_monitoramentos_criterio_auditoria_ano_id'), table_name='monitoramentos_criterio')
    op.drop_index(op.f('ix_monitoramentos_criterio_programa_id'), table_name='monitoramentos_criterio')
    op.drop_index(op.f('ix_monitoramentos_criterio_id'), table_name='monitoramentos_criterio')
    op.drop_table('monitoramentos_criterio')
