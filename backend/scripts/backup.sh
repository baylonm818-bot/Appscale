#!/usr/bin/env bash
# backup.sh — AppScale MySQL database backup
# Usage: ./backup.sh
# Outputs a timestamped gzip dump to ./backups/

set -euo pipefail

# Load .env if present (for local dev)
if [ -f "$(dirname "$0")/../.env" ]; then
  set -o allexport
  source "$(dirname "$0")/../.env"
  set +o allexport
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-appscale_db}"

BACKUP_DIR="$(dirname "$0")/../backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTFILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[Backup] Starting backup of $DB_NAME → $OUTFILE"

MYSQL_PWD="$DB_PASSWORD" mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip > "$OUTFILE"

echo "[Backup] Done. File: $OUTFILE ($(du -h "$OUTFILE" | cut -f1))"

# Keep only last 30 backups
ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true
echo "[Backup] Old backups pruned (kept latest 30)."
