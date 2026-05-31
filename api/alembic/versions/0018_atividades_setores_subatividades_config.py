"""catalogo de setores e subatividades para atividades

Revision ID: 0018_ativ_setor_subatv
Revises: 0017_performance_indexes
Create Date: 2026-05-07 17:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0018_ativ_setor_subatv'
down_revision: Union[str, None] = '0017_performance_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('atividades_subdemanda', sa.Column('setor', sa.String(length=120), nullable=True))
    op.add_column('atividades_subdemanda', sa.Column('subatividade', sa.String(length=120), nullable=True))
    op.create_index(op.f('ix_atividades_subdemanda_setor'), 'atividades_subdemanda', ['setor'], unique=False)
    op.create_index(op.f('ix_atividades_subdemanda_subatividade'), 'atividades_subdemanda', ['subatividade'], unique=False)

    op.create_table(
        'atividades_setores_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nome', name='uq_atividade_setor_config_nome'),
        sa.CheckConstraint('ordem >= 0', name='ck_atividade_setor_config_ordem_nonnegative'),
    )
    op.create_index(op.f('ix_atividades_setores_config_id'), 'atividades_setores_config', ['id'], unique=False)
    op.create_index(op.f('ix_atividades_setores_config_nome'), 'atividades_setores_config', ['nome'], unique=True)
    op.alter_column('atividades_setores_config', 'ativo', server_default=None)
    op.alter_column('atividades_setores_config', 'ordem', server_default=None)

    op.create_table(
        'atividades_subatividades_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('setor_id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['setor_id'], ['atividades_setores_config.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('setor_id', 'nome', name='uq_atividade_subatividade_config_setor_nome'),
        sa.CheckConstraint('ordem >= 0', name='ck_atividade_subatividade_config_ordem_nonnegative'),
    )
    op.create_index(op.f('ix_atividades_subatividades_config_id'), 'atividades_subatividades_config', ['id'], unique=False)
    op.create_index(op.f('ix_atividades_subatividades_config_setor_id'), 'atividades_subatividades_config', ['setor_id'], unique=False)
    op.alter_column('atividades_subatividades_config', 'ativo', server_default=None)
    op.alter_column('atividades_subatividades_config', 'ordem', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_atividades_subatividades_config_setor_id'), table_name='atividades_subatividades_config')
    op.drop_index(op.f('ix_atividades_subatividades_config_id'), table_name='atividades_subatividades_config')
    op.drop_table('atividades_subatividades_config')

    op.drop_index(op.f('ix_atividades_setores_config_nome'), table_name='atividades_setores_config')
    op.drop_index(op.f('ix_atividades_setores_config_id'), table_name='atividades_setores_config')
    op.drop_table('atividades_setores_config')

    op.drop_index(op.f('ix_atividades_subdemanda_subatividade'), table_name='atividades_subdemanda')
    op.drop_index(op.f('ix_atividades_subdemanda_setor'), table_name='atividades_subdemanda')
    op.drop_column('atividades_subdemanda', 'subatividade')
    op.drop_column('atividades_subdemanda', 'setor')
