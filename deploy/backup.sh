#!/usr/bin/env bash
#
# Back up the database AND the images. Both, or neither is worth having:
# attendance rows point at face photos by path, and a database restored beside
# an empty storage volume is a system where nobody is enrolled.
#
#   ./deploy/backup.sh [destination-dir]     (default: ./backups)
#
# Put it on a cron:
#   20 2 * * *  cd /www/wwwroot/intern-attendance && ./deploy/backup.sh >> /var/log/attendance-backup.log 2>&1
#
# A backup that has never been restored is a hypothesis. deploy/RESTORE.md is
# the other half of this file; read it before you need it.
set -euo pipefail

cd "$(dirname "$0")/.."

DEST="${1:-./backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

mkdir -p "$DEST"

# ---------------------------------------------------------------- database
# pg_dump inside the container, so no client version has to match the server.
# --format=custom because it restores selectively and compresses; plain SQL of
# a year of attendance is large and can only be restored whole.
echo "==> database"
"${COMPOSE[@]}" exec -T db pg_dump \
  --username=attendance --dbname=attendance \
  --format=custom --compress=9 --no-owner --no-privileges \
  > "$DEST/db-$STAMP.dump.part"
mv "$DEST/db-$STAMP.dump.part" "$DEST/db-$STAMP.dump"

# ------------------------------------------------------------------ images
# Straight out of the volume via a throwaway container, so this works whether
# or not the API is running. Biometric images: keep the destination off any
# path nginx serves.
echo "==> images"
docker run --rm \
  -v intern-attendance_storage-data:/data:ro \
  -v "$(cd "$DEST" && pwd)":/backup \
  alpine:3 tar -czf "/backup/storage-$STAMP.tar.gz.part" -C /data . \
  && mv "$DEST/storage-$STAMP.tar.gz.part" "$DEST/storage-$STAMP.tar.gz"

# ------------------------------------------------------------------- prune
# Only whole pairs are pruned, and only after both of today's exist — a partial
# run must never take the last good backup with it.
if [ -f "$DEST/db-$STAMP.dump" ] && [ -f "$DEST/storage-$STAMP.tar.gz" ]; then
  find "$DEST" -maxdepth 1 -name 'db-*.dump' -mtime "+$KEEP_DAYS" -delete
  find "$DEST" -maxdepth 1 -name 'storage-*.tar.gz' -mtime "+$KEEP_DAYS" -delete
  # Interrupted runs leave these behind; they are never restorable.
  find "$DEST" -maxdepth 1 -name '*.part' -mtime +1 -delete
fi

echo
ls -lh "$DEST/db-$STAMP.dump" "$DEST/storage-$STAMP.tar.gz"
echo
echo "Keep a copy OFF this machine. A backup on the same disk as the database"
echo "survives a mistake but not a dead disk, and only one of those is rare."
