#!/usr/bin/env bash
# Restaura um dump do banco PostgreSQL gerado pelo backup.sh.
# Uso: ./scripts/restore.sh <arquivo.dump>
# ATENÇÃO: sobrescreve o banco existente.

set -euo pipefail

ARQUIVO="${1:-}"
if [[ -z "$ARQUIVO" ]]; then
  echo "Uso: $0 <arquivo.dump>" >&2
  exit 1
fi

if [[ ! -f "$ARQUIVO" ]]; then
  echo "Erro: arquivo '$ARQUIVO' não encontrado." >&2
  exit 1
fi

RAW_URL="${DATABASE_URL:-}"
if [[ -z "$RAW_URL" ]]; then
  echo "Erro: DATABASE_URL não definido." >&2
  exit 1
fi

PG_URL="${RAW_URL/+psycopg/}"

echo "Restaurando '$ARQUIVO' → $PG_URL"
echo "ATENÇÃO: este comando irá sobrescrever dados existentes. Pressione Ctrl+C para cancelar (5s)..."
sleep 5

pg_restore --format=custom --no-acl --no-owner --clean --if-exists -d "$PG_URL" "$ARQUIVO"
echo "Restore concluído."
