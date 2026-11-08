#!/usr/bin/env bash
# restore.sh — AppScale MySQL database restore
# Usage: ./restore.sh <backup-file.sql.gz>
#
# WARNING: This will DROP and RECREATE the target database.
# Always test on a staging instance before running on production.

set -euo pipefail

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>"
  exit 1
fi

# Load .env if present
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

echo "========================================================"
echo "  RESTORE PROCEDURE — AppScale DB"
echo "  Source  : $BACKUP_FILE"
echo "  Target  : $DB_NAME @ $DB_HOST:$DB_PORT"
echo "========================================================"
echo ""
echo "  ⚠️  WARNING: This will OVERWRITE ALL DATA in $DB_NAME."
echo "  Type 'yes' to continue, anything else to abort:"
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "[Restore] Aborted by user."
  exit 0
fi

echo "[Restore] Dropping and recreating $DB_NAME …"
MYSQL_PWD="$DB_PASSWORD" mysql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "[Restore] Loading backup …"
gunzip -c "$BACKUP_FILE" | MYSQL_PWD="$DB_PASSWORD" mysql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  "$DB_NAME"

echo "[Restore] ✅ Database restored successfully from: $BACKUP_FILE"
