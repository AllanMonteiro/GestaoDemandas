#!/usr/bin/env bash
# Cria um dump do banco PostgreSQL com timestamp.
# Uso: ./scripts/backup.sh [destino]
# Exemplo: ./scripts/backup.sh ./backups
#
# Variáveis de ambiente (ou .env):
#   DATABASE_URL  postgresql+psycopg://user:pass@host:5432/db
#   BACKUP_DIR    diretório de saída (padrão: ./backups)

set -euo pipefail

BACKUP_DIR="${1:-${BACKUP_DIR:-./backups}}"
mkdir -p "$BACKUP_DIR"

# Aceita tanto postgresql+psycopg:// quanto postgresql://
RAW_URL="${DATABASE_URL:-}"
if [[ -z "$RAW_URL" ]]; then
  echo "Erro: DATABASE_URL não definido." >&2
  exit 1
fi

# Normaliza o scheme para pg_dump (remove "+psycopg" se presente)
PG_URL="${RAW_URL/+psycopg/}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARQUIVO="$BACKUP_DIR/demandas_${TIMESTAMP}.dump"

echo "Iniciando backup → $ARQUIVO"
pg_dump --format=custom --no-acl --no-owner "$PG_URL" > "$ARQUIVO"
echo "Backup concluído: $ARQUIVO ($(du -sh "$ARQUIVO" | cut -f1))"
