#!/usr/bin/env bash
#
# Aegis AI — restore the database (and optionally assets) from an archive made
# by backup-db.sh. DESTRUCTIVE: overwrites the current database.
#
# Usage:
#   scripts/restore-db.sh <db-backup.(sqlite|sql).gz> [assets-backup.tar.gz]
#   FORCE=1 scripts/restore-db.sh ...        # skip the confirmation prompt
#
# Config: DATABASE_URL (same meaning as backup-db.sh).
set -euo pipefail

DB_BACKUP="${1:?usage: restore-db.sh <db-backup.gz> [assets-backup.tar.gz]}"
ASSETS_BACKUP="${2:-}"
DATABASE_URL="${DATABASE_URL:-file:./backend/prisma/dev.db}"

log() { printf '[restore %s] %s\n' "$(date +%H:%M:%S)" "$*"; }

[[ -f "$DB_BACKUP" ]] || { log "ERROR: backup not found: $DB_BACKUP"; exit 1; }

# Integrity check against the sidecar checksum, if present.
if [[ -f "$DB_BACKUP.sha256" ]]; then
  want="$(cat "$DB_BACKUP.sha256")"; have="$(sha256sum "$DB_BACKUP" | awk '{print $1}')"
  [[ "$want" == "$have" ]] || { log "ERROR: checksum mismatch — archive corrupt"; exit 1; }
  log "checksum OK"
fi

if [[ "${FORCE:-0}" != "1" ]]; then
  read -r -p "This OVERWRITES the current database ($DATABASE_URL). Continue? [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || { log "aborted"; exit 1; }
fi

if [[ "$DATABASE_URL" == postgres://* || "$DATABASE_URL" == postgresql://* ]]; then
  log "restoring PostgreSQL from $DB_BACKUP"
  gunzip -c "$DB_BACKUP" | psql "$DATABASE_URL"
else
  db="${DATABASE_URL#file:}"; db="${db%%\?*}"
  if [[ -f "$db" ]]; then
    pre="$db.pre-restore-$(date +%Y%m%d-%H%M%S)"
    cp "$db" "$pre"; log "saved current DB -> $pre"
  fi
  mkdir -p "$(dirname "$db")"
  gunzip -c "$DB_BACKUP" > "$db"
  log "restored SQLite -> $db"
fi

if [[ -n "$ASSETS_BACKUP" ]]; then
  [[ -f "$ASSETS_BACKUP" ]] || { log "ERROR: assets backup not found: $ASSETS_BACKUP"; exit 1; }
  if [[ -f "$ASSETS_BACKUP.sha256" ]]; then
    want="$(cat "$ASSETS_BACKUP.sha256")"; have="$(sha256sum "$ASSETS_BACKUP" | awk '{print $1}')"
    [[ "$want" == "$have" ]] || { log "ERROR: assets checksum mismatch"; exit 1; }
  fi
  # Archives store absolute paths (leading '/' stripped by tar), so extract at
  # root to return files to their recorded location. Override with RESTORE_ROOT
  # to relocate (e.g. cross-host restore into a staging tree).
  log "extracting assets from $ASSETS_BACKUP (overwrites uploads + Layer-3 memory)"
  tar -xzf "$ASSETS_BACKUP" -C "${RESTORE_ROOT:-/}"
fi

log "restore complete."
