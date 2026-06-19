#!/usr/bin/env bash
# Backup diario de PostgreSQL. Agregar a cron:
#   0 3 * * * /opt/lch/deploy/backup-db.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/lch}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

if [[ -f .env.production ]]; then
  # shellcheck disable=SC1091
  source .env.production
fi

STAMP=$(date +%Y-%m-%d_%H%M)
FILE="$BACKUP_DIR/lch_stock_${STAMP}.sql.gz"

docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-lch}" "${POSTGRES_DB:-lch_stock}" | gzip > "$FILE"

find "$BACKUP_DIR" -name 'lch_stock_*.sql.gz' -mtime +"$RETAIN_DAYS" -delete

echo "Backup: $FILE ($(du -h "$FILE" | cut -f1))"
