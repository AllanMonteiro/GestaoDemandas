"""modulo demandas profissional

Revision ID: 0015_modulo_demandas_profissional
Revises: 0014_sla_vencimento
Create Date: 2026-05-06 15:45:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0015_demandas_prof'
down_revision: Union[str, None] = '0014_sla_vencimento'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Adicionar campos de segurança em usuarios
    op.add_column('usuarios', sa.Column('needs_password_change', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('usuarios', sa.Column('failed_login_attempts', sa.Integer(), server_default='0', nullable=False))
    op.add_column('usuarios', sa.Column('is_locked', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('usuarios', sa.Column('last_login', sa.DateTime(timezone=True), nullable=True))

    # 2. Limpar tabelas antigas de gestão de demandas (se existirem)
    # Nota: Em produção, você faria uma migração de dados aqui.
    op.drop_table('demanda_eventos')
    op.drop_table('gestao_demandas')
    op.execute("ALTER TABLE IF EXISTS demandas RENAME TO demandas_fsc")
    op.execute("ALTER INDEX IF EXISTS ix_demandas_id RENAME TO ix_demandas_fsc_id")
    op.execute("ALTER INDEX IF EXISTS ix_demandas_codigo RENAME TO ix_demandas_fsc_codigo")
    op.execute("ALTER INDEX IF EXISTS ix_demandas_responsavel_id RENAME TO ix_demandas_fsc_responsavel_id")
    op.execute("ALTER INDEX IF EXISTS ix_demandas_solicitante_id RENAME TO ix_demandas_fsc_solicitante_id")

    # 3. Criar nova estrutura de demandas
    op.create_table(
        'demandas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('codigo', sa.String(length=20), nullable=False),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('solicitante_id', sa.Integer(), nullable=True),
        sa.Column('responsavel_id', sa.Integer(), nullable=True),
        sa.Column('setor', sa.String(length=100), nullable=True),
        sa.Column('prioridade', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('prazo', sa.Date(), nullable=True),
        sa.Column('data_abertura', sa.Date(), server_default=sa.text('CURRENT_DATE'), nullable=False),
        sa.Column('data_conclusao', sa.Date(), nullable=True),
        sa.Column('motivo_cancelamento', sa.Text(), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['responsavel_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['solicitante_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_demandas_codigo'), 'demandas', ['codigo'], unique=True)
    op.create_index(op.f('ix_demandas_id'), 'demandas', ['id'], unique=False)
    op.create_index(op.f('ix_demandas_responsavel_id'), 'demandas', ['responsavel_id'], unique=False)
    op.create_index(op.f('ix_demandas_solicitante_id'), 'demandas', ['solicitante_id'], unique=False)

    op.create_table(
        'demanda_comentarios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('demanda_id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=True),
        sa.Column('comentario', sa.Text(), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['demanda_id'], ['demandas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_demanda_comentarios_demanda_id'), 'demanda_comentarios', ['demanda_id'], unique=False)
    op.create_index(op.f('ix_demanda_comentarios_id'), 'demanda_comentarios', ['id'], unique=False)

    op.create_table(
        'demanda_eventos_v2',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('demanda_id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=True),
        sa.Column('tipo_evento', sa.String(length=50), nullable=False),
        sa.Column('campo_alterado', sa.String(length=100), nullable=True),
        sa.Column('valor_anterior', sa.Text(), nullable=True),
        sa.Column('valor_novo', sa.Text(), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['demanda_id'], ['demandas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_demanda_eventos_v2_demanda_id'), 'demanda_eventos_v2', ['demanda_id'], unique=False)
    op.create_index(op.f('ix_demanda_eventos_v2_id'), 'demanda_eventos_v2', ['id'], unique=False)

    op.create_table(
        'demanda_anexos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('demanda_id', sa.Integer(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=True),
        sa.Column('nome_arquivo', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=True),
        sa.Column('tamanho', sa.Integer(), nullable=True),
        sa.Column('storage_key', sa.String(length=512), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['demanda_id'], ['demandas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_demanda_anexos_id'), 'demanda_anexos', ['id'], unique=False)
    op.create_index(op.f('ix_demanda_anexos_demanda_id'), 'demanda_anexos', ['demanda_id'], unique=False)


def downgrade() -> None:
    op.drop_table('demanda_anexos')
    op.drop_table('demanda_eventos_v2')
    op.drop_table('demanda_comentarios')
    op.drop_table('demandas')
    
    # Recriar as tabelas antigas (simplificado)
    # op.create_table('gestao_demandas', ...)
    # op.create_table('demanda_eventos', ...)
    
    op.drop_column('usuarios', 'last_login')
    op.drop_column('usuarios', 'is_locked')
    op.drop_column('usuarios', 'failed_login_attempts')
    op.drop_column('usuarios', 'needs_password_change')
