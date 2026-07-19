#!/usr/bin/env bash
#
# Aegis AI — backup the persistent state: database + uploaded documents +
# Layer-3 conversational memory / customer profiles. Writes timestamped,
# gzipped, checksummed archives and prunes old ones.
#
# Config (env, with sensible repo-root defaults):
#   BACKUP_DIR      where archives are written           (default ./backups)
#   RETENTION_DAYS  delete archives older than this       (default 14)
#   DATABASE_URL    file:PATH (SQLite) or postgres[ql]:// (default dev SQLite)
#   UPLOADS_DIR     customer documents                    (default backend/src/uploads)
#   MEMORY_DIR      Layer-3 memory tree                   (default Aegis-AI/layer3)
#
# Run on the host, in a maintenance container, or from cron/systemd. For the
# prod compose stack (named volumes) see scripts/README.md.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATABASE_URL="${DATABASE_URL:-file:./backend/prisma/dev.db}"
UPLOADS_DIR="${UPLOADS_DIR:-./backend/src/uploads}"
MEMORY_DIR="${MEMORY_DIR:-./Aegis-AI/layer3}"

TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

log() { printf '[backup %s] %s\n' "$(date +%H:%M:%S)" "$*"; }

# ── Database ─────────────────────────────────────────────────────────────────
if [[ "$DATABASE_URL" == postgres://* || "$DATABASE_URL" == postgresql://* ]]; then
  out="$BACKUP_DIR/db-$TS.sql.gz"
  log "PostgreSQL dump -> $out"
  pg_dump "$DATABASE_URL" | gzip > "$out"
else
  db="${DATABASE_URL#file:}"; db="${db%%\?*}"     # strip file: prefix + query
  out="$BACKUP_DIR/db-$TS.sqlite.gz"
  if [[ ! -f "$db" ]]; then
    log "ERROR: SQLite database not found at '$db'"; exit 1
  fi
  if command -v sqlite3 >/dev/null 2>&1; then
    log "SQLite consistent .backup -> $out"
    tmp="$(mktemp)"; sqlite3 "$db" ".backup '$tmp'"; gzip -c "$tmp" > "$out"; rm -f "$tmp"
  else
    # Fallback: file copy. Safe when writes are quiesced; for a guaranteed hot
    # backup install sqlite3 (the .backup path above is then used automatically).
    log "sqlite3 not found — gzip file copy -> $out"
    gzip -c "$db" > "$out"
  fi
fi
sha256sum "$out" | awk '{print $1}' > "$out.sha256"
log "checksum $(cat "$out.sha256")"

# ── Uploads + Layer-3 memory ─────────────────────────────────────────────────
# Resolve to absolute paths so the archive is deterministic: tar strips the
# leading '/', and restore-db.sh extracts with `-C /`, returning each file to
# its recorded absolute location (the container layout under /app is fixed).
assets=()
[[ -d "$UPLOADS_DIR" ]] && assets+=("$(realpath "$UPLOADS_DIR")")
[[ -d "$MEMORY_DIR"  ]] && assets+=("$(realpath "$MEMORY_DIR")")
if [[ ${#assets[@]} -gt 0 ]]; then
  aout="$BACKUP_DIR/assets-$TS.tar.gz"
  log "assets tar -> $aout (${assets[*]})"
  tar -czf "$aout" "${assets[@]}"
  sha256sum "$aout" | awk '{print $1}' > "$aout.sha256"
fi

# ── Retention ────────────────────────────────────────────────────────────────
log "pruning archives older than ${RETENTION_DAYS}d"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*' -o -name 'assets-*' \) \
  -mtime +"$RETENTION_DAYS" -print -delete || true

log "done. Backups in $BACKUP_DIR:"
ls -1t "$BACKUP_DIR" | grep -E '^(db|assets)-' | head -6
