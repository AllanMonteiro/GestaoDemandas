"""analises estruturadas de demanda por metodologia

Revision ID: 0021_demanda_analises_metodologias
Revises: 0020_demanda_hist
Create Date: 2026-05-07 20:15:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0021_demanda_anal'
down_revision: Union[str, None] = '0020_demanda_hist'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


demanda_analise_metodo_enum = sa.Enum(
    '5_PORQUES',
    '4W2H',
    '5W2H',
    'ISHIKAWA',
    'GUT',
    'ESFORCO_IMPACTO',
    'PDCA',
    name='demanda_analise_metodo_enum',
    native_enum=False,
)

demanda_analise_status_enum = sa.Enum(
    'rascunho',
    'em_analise',
    'plano_definido',
    'em_execucao',
    'concluido',
    'cancelado',
    name='demanda_analise_status_enum',
    native_enum=False,
)


def upgrade() -> None:
    op.create_table(
        'demanda_analises',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('demanda_id', sa.Integer(), nullable=False),
        sa.Column('metodo', demanda_analise_metodo_enum, nullable=False),
        sa.Column('problema', sa.Text(), nullable=True),
        sa.Column('causa_raiz', sa.Text(), nullable=True),
        sa.Column('status', demanda_analise_status_enum, nullable=False, server_default='rascunho'),
        sa.Column('responsavel_id', sa.Integer(), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['demanda_id'], ['demandas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['responsavel_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_demanda_analises_id'), 'demanda_analises', ['id'], unique=False)
    op.create_index(op.f('ix_demanda_analises_demanda_id'), 'demanda_analises', ['demanda_id'], unique=False)
    op.create_index(op.f('ix_demanda_analises_metodo'), 'demanda_analises', ['metodo'], unique=False)
    op.create_index(op.f('ix_demanda_analises_status'), 'demanda_analises', ['status'], unique=False)
    op.create_index(op.f('ix_demanda_analises_responsavel_id'), 'demanda_analises', ['responsavel_id'], unique=False)
    op.alter_column('demanda_analises', 'status', server_default=None)

    op.create_table(
        'demanda_analise_campos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('analise_id', sa.Integer(), nullable=False),
        sa.Column('chave', sa.String(length=100), nullable=False),
        sa.Column('valor', sa.Text(), nullable=True),
        sa.Column('ordem', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['analise_id'], ['demanda_analises.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_demanda_analise_campos_id'), 'demanda_analise_campos', ['id'], unique=False)
    op.create_index(op.f('ix_demanda_analise_campos_analise_id'), 'demanda_analise_campos', ['analise_id'], unique=False)
    op.create_index(op.f('ix_demanda_analise_campos_chave'), 'demanda_analise_campos', ['chave'], unique=False)
    op.alter_column('demanda_analise_campos', 'ordem', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_demanda_analise_campos_chave'), table_name='demanda_analise_campos')
    op.drop_index(op.f('ix_demanda_analise_campos_analise_id'), table_name='demanda_analise_campos')
    op.drop_index(op.f('ix_demanda_analise_campos_id'), table_name='demanda_analise_campos')
    op.drop_table('demanda_analise_campos')

    op.drop_index(op.f('ix_demanda_analises_responsavel_id'), table_name='demanda_analises')
    op.drop_index(op.f('ix_demanda_analises_status'), table_name='demanda_analises')
    op.drop_index(op.f('ix_demanda_analises_metodo'), table_name='demanda_analises')
    op.drop_index(op.f('ix_demanda_analises_demanda_id'), table_name='demanda_analises')
    op.drop_index(op.f('ix_demanda_analises_id'), table_name='demanda_analises')
    op.drop_table('demanda_analises')
