"""analise de nao conformidade com 5 porques e swot

Revision ID: 0010_analise_nc
Revises: 0009_monitoramentos
Create Date: 2026-02-22 16:45:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0010_analise_nc'
down_revision: Union[str, None] = '0009_monitoramentos'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


status_analise_nc_enum = sa.Enum(
    'aberta',
    'em_analise',
    'concluida',
    name='status_analise_nc_enum',
    native_enum=False,
)


def upgrade() -> None:
    op.create_table(
        'analises_nao_conformidade',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('programa_id', sa.Integer(), nullable=False),
        sa.Column('auditoria_ano_id', sa.Integer(), nullable=False),
        sa.Column('avaliacao_id', sa.Integer(), nullable=False),
        sa.Column('demanda_id', sa.Integer(), nullable=True),
        sa.Column('titulo_problema', sa.String(length=255), nullable=False),
        sa.Column('contexto', sa.Text(), nullable=True),
        sa.Column('porque_1', sa.Text(), nullable=True),
        sa.Column('porque_2', sa.Text(), nullable=True),
        sa.Column('porque_3', sa.Text(), nullable=True),
        sa.Column('porque_4', sa.Text(), nullable=True),
        sa.Column('porque_5', sa.Text(), nullable=True),
        sa.Column('causa_raiz', sa.Text(), nullable=True),
        sa.Column('acao_corretiva', sa.Text(), nullable=True),
        sa.Column('swot_forcas', sa.Text(), nullable=True),
        sa.Column('swot_fraquezas', sa.Text(), nullable=True),
        sa.Column('swot_oportunidades', sa.Text(), nullable=True),
        sa.Column('swot_ameacas', sa.Text(), nullable=True),
        sa.Column(
            'status_analise',
            status_analise_nc_enum,
            nullable=False,
            server_default='aberta',
        ),
        sa.Column('responsavel_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['programa_id'], ['programas_certificacao.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['auditoria_ano_id'], ['auditorias_ano.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['avaliacao_id'], ['avaliacoes_indicador.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['demanda_id'], ['demandas.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['responsavel_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.alter_column('analises_nao_conformidade', 'status_analise', server_default=None)
    op.create_index(op.f('ix_analises_nao_conformidade_id'), 'analises_nao_conformidade', ['id'], unique=False)
    op.create_index(
        op.f('ix_analises_nao_conformidade_programa_id'),
        'analises_nao_conformidade',
        ['programa_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_analises_nao_conformidade_auditoria_ano_id'),
        'analises_nao_conformidade',
        ['auditoria_ano_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_analises_nao_conformidade_avaliacao_id'),
        'analises_nao_conformidade',
        ['avaliacao_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_analises_nao_conformidade_demanda_id'),
        'analises_nao_conformidade',
        ['demanda_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_analises_nao_conformidade_responsavel_id'),
        'analises_nao_conformidade',
        ['responsavel_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_analises_nao_conformidade_responsavel_id'), table_name='analises_nao_conformidade')
    op.drop_index(op.f('ix_analises_nao_conformidade_demanda_id'), table_name='analises_nao_conformidade')
    op.drop_index(op.f('ix_analises_nao_conformidade_avaliacao_id'), table_name='analises_nao_conformidade')
    op.drop_index(op.f('ix_analises_nao_conformidade_auditoria_ano_id'), table_name='analises_nao_conformidade')
    op.drop_index(op.f('ix_analises_nao_conformidade_programa_id'), table_name='analises_nao_conformidade')
    op.drop_index(op.f('ix_analises_nao_conformidade_id'), table_name='analises_nao_conformidade')
    op.drop_table('analises_nao_conformidade')
