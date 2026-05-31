"""rename demanda_eventos_v2 to demanda_eventos

Revision ID: 0016_rename_demanda_eventos
Revises: 0015_demandas_prof
Create Date: 2026-05-07 00:00:00
"""

from typing import Sequence, Union

from alembic import op


revision: str = '0016_rename_demanda_eventos'
down_revision: Union[str, None] = '0015_demandas_prof'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table('demanda_eventos_v2', 'demanda_eventos')
    op.execute('ALTER INDEX IF EXISTS ix_demanda_eventos_v2_id RENAME TO ix_demanda_eventos_id')
    op.execute(
        'ALTER INDEX IF EXISTS ix_demanda_eventos_v2_demanda_id RENAME TO ix_demanda_eventos_demanda_id'
    )


def downgrade() -> None:
    op.rename_table('demanda_eventos', 'demanda_eventos_v2')
    op.execute('ALTER INDEX IF EXISTS ix_demanda_eventos_id RENAME TO ix_demanda_eventos_v2_id')
    op.execute(
        'ALTER INDEX IF EXISTS ix_demanda_eventos_demanda_id RENAME TO ix_demanda_eventos_v2_demanda_id'
    )
