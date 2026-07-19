# Aegis AI — operations scripts

Backup & restore for all persistent state: **database**, **uploaded documents**,
and the **Layer-3 conversational memory / customer profiles**.

| File | Purpose |
|---|---|
| `backup-db.sh` | Create a timestamped, gzipped, checksummed backup + prune old ones |
| `restore-db.sh` | Restore DB (+ optional assets) from an archive (destructive) |
| `aegis-backup.service` / `.timer` | systemd units for scheduled daily backups |

## What is backed up
- **Database** — SQLite file (consistent `sqlite3 .backup` when available, else a
  gzip file copy) or PostgreSQL (`pg_dump`), selected from `DATABASE_URL`.
- **Uploads** — `UPLOADS_DIR` (customer documents).
- **Layer-3 memory** — `MEMORY_DIR` (conversations, profiles, intelligence, rec cache).

Each archive gets a `.sha256` sidecar; `restore-db.sh` verifies it before restoring.

## Config (env)
| Var | Default | Notes |
|---|---|---|
| `BACKUP_DIR` | `./backups` | output directory |
| `RETENTION_DAYS` | `14` | prune archives older than this |
| `DATABASE_URL` | dev SQLite | `file:PATH` or `postgres(ql)://…` |
| `UPLOADS_DIR` | `backend/src/uploads` | |
| `MEMORY_DIR` | `Aegis-AI/layer3` | |

## Local / host usage
```bash
scripts/backup-db.sh                       # -> ./backups/db-*.sqlite.gz + assets-*.tar.gz
FORCE=1 scripts/restore-db.sh backups/db-20260101-023000.sqlite.gz \
        backups/assets-20260101-023000.tar.gz
```

## Production (docker-compose.prod.yml, named volumes)
State is split across volumes (DB + uploads on the backend, memory on the AI
engine), so back each up with a throwaway container. Example (adjust the
project prefix shown by `docker volume ls`):
```bash
TS=$(date +%Y%m%d-%H%M%S); mkdir -p backups
for v in backend_db backend_uploads ai_conversations ai_sessions \
         ai_profiles ai_intelligence ai_rec_cache; do
  docker run --rm -v "salesbots_${v}:/data:ro" -v "$PWD/backups:/backup" alpine \
    tar czf "/backup/${v}-${TS}.tar.gz" -C /data .
done
```
PostgreSQL (when the `postgres` profile is enabled):
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backups/pg-$(date +%F).sql.gz
```

## Scheduling
**systemd (recommended):**
```bash
sudo cp scripts/aegis-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now aegis-backup.timer
systemctl list-timers aegis-backup.timer     # verify next run
```
**cron alternative:**
```cron
30 2 * * *  cd /opt/aegis && BACKUP_DIR=/var/backups/aegis ./scripts/backup-db.sh >> /var/log/aegis-backup.log 2>&1
```

## Off-host copy (important)
A backup on the same disk does not survive disk loss. Sync `BACKUP_DIR` to
object storage / another host, e.g. nightly:
```bash
aws s3 sync /var/backups/aegis s3://your-bucket/aegis-backups/ --delete
```

## Recovery checklist
1. Stop writers: `docker compose -f docker-compose.prod.yml stop backend ai`.
2. Restore DB: `FORCE=1 DATABASE_URL=… scripts/restore-db.sh <db-archive>`.
3. Restore assets (if needed): pass the `assets-*.tar.gz` as the 2nd arg, or
   extract each volume archive into its volume with a throwaway container.
4. `prisma migrate deploy` (schema catch-up, if restoring an older dump).
5. Start services; confirm `/health/ready` is 200 and spot-check data.
