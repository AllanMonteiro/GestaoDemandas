"""documentos vinculados a evidencias

Revision ID: 0008_doc_evidencia
Revises: 0007_aud_padrao_tipo_status
Create Date: 2026-02-22 11:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0008_doc_evidencia'
down_revision: Union[str, None] = '0007_aud_padrao_tipo_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


status_documento_enum = sa.Enum(
    'em_construcao',
    'em_revisao',
    'aprovado',
    'reprovado',
    name='status_documento_enum',
    native_enum=False,
)


def upgrade() -> None:
    op.create_table(
        'documentos_evidencia',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('programa_id', sa.Integer(), nullable=False),
        sa.Column('auditoria_ano_id', sa.Integer(), nullable=False),
        sa.Column('evidencia_id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('conteudo', sa.Text(), nullable=True),
        sa.Column('versao', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status_documento', status_documento_enum, nullable=False, server_default='em_construcao'),
        sa.Column('observacoes_revisao', sa.Text(), nullable=True),
        sa.Column('data_limite', sa.Date(), nullable=True),
        sa.Column('responsavel_id', sa.Integer(), nullable=True),
        sa.Column('revisado_por_id', sa.Integer(), nullable=True),
        sa.Column('data_revisao', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['auditoria_ano_id'], ['auditorias_ano.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['evidencia_id'], ['evidencias.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['programa_id'], ['programas_certificacao.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['responsavel_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['revisado_por_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.alter_column('documentos_evidencia', 'versao', server_default=None)
    op.alter_column('documentos_evidencia', 'status_documento', server_default=None)
    op.create_index(op.f('ix_documentos_evidencia_id'), 'documentos_evidencia', ['id'], unique=False)
    op.create_index(op.f('ix_documentos_evidencia_programa_id'), 'documentos_evidencia', ['programa_id'], unique=False)
    op.create_index(op.f('ix_documentos_evidencia_auditoria_ano_id'), 'documentos_evidencia', ['auditoria_ano_id'], unique=False)
    op.create_index(op.f('ix_documentos_evidencia_evidencia_id'), 'documentos_evidencia', ['evidencia_id'], unique=False)
    op.create_index(op.f('ix_documentos_evidencia_data_limite'), 'documentos_evidencia', ['data_limite'], unique=False)
    op.create_index(op.f('ix_documentos_evidencia_responsavel_id'), 'documentos_evidencia', ['responsavel_id'], unique=False)
    op.create_index(op.f('ix_documentos_evidencia_revisado_por_id'), 'documentos_evidencia', ['revisado_por_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_documentos_evidencia_revisado_por_id'), table_name='documentos_evidencia')
    op.drop_index(op.f('ix_documentos_evidencia_responsavel_id'), table_name='documentos_evidencia')
    op.drop_index(op.f('ix_documentos_evidencia_data_limite'), table_name='documentos_evidencia')
    op.drop_index(op.f('ix_documentos_evidencia_evidencia_id'), table_name='documentos_evidencia')
    op.drop_index(op.f('ix_documentos_evidencia_auditoria_ano_id'), table_name='documentos_evidencia')
    op.drop_index(op.f('ix_documentos_evidencia_programa_id'), table_name='documentos_evidencia')
    op.drop_index(op.f('ix_documentos_evidencia_id'), table_name='documentos_evidencia')
    op.drop_table('documentos_evidencia')
