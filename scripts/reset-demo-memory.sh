#!/usr/bin/env bash
#
# Give the demo account a clean advisor, so a rehearsal does not become the
# demo's opening state.
#
# The advisor remembers. That is the product — and it means every practice run
# leaves the demo account mid-conversation, with a profile already filled in
# from whatever was typed last time. Rehearse three times and the real demo
# opens with the advisor skipping its questions and quoting a budget nobody in
# the room heard the customer give.
#
# So this clears the layer-3 memory for one customer: conversation history,
# domain profiles, cached recommendations, session state. The database is not
# touched — policies, documents and notifications stay exactly as
# `seed-demo.js` wrote them, because those are the account's history, not the
# conversation's.
#
# Everything removed is copied to a timestamped folder first. Nothing is
# deleted outright.
#
#   ./scripts/reset-demo-memory.sh                       # demo@aegisdemo.in
#   DEMO_EMAIL=someone@example.com ./scripts/reset-demo-memory.sh
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMAIL="${DEMO_EMAIL:-demo@aegisdemo.in}"
LAYER3="$ROOT/Aegis-AI/layer3"
BACKUPS="$ROOT/.demo-memory-backups"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }

# The customer id the AI engine files memory under is the account's user id,
# so it has to be read from the database rather than guessed.
USER_ID="$(cd "$ROOT/backend" && node -e "
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const u=await p.user.findUnique({where:{email:process.argv[1]}});
process.stdout.write(u?u.id:'');await p.\$disconnect();})()" "$EMAIL" 2>/dev/null)"

if [ -z "$USER_ID" ]; then
  warn "no account found for $EMAIL — nothing to reset"
  exit 1
fi

bold "Resetting advisor memory for $EMAIL"
echo "  customer id: $USER_ID"

mapfile -t FILES < <(find "$LAYER3" -name "*${USER_ID}*" -type f 2>/dev/null)

if [ "${#FILES[@]}" -eq 0 ]; then
  ok "already clean — no memory files for this customer"
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUPS/$STAMP"
mkdir -p "$DEST"
for f in "${FILES[@]}"; do
  cp --parents "$f" "$DEST" 2>/dev/null
done
ok "backed up ${#FILES[@]} files → $DEST"

for f in "${FILES[@]}"; do rm -f "$f"; done
ok "cleared ${#FILES[@]} memory files"

echo
bold "Done — the advisor now meets this customer for the first time."
echo "  Restore with:  cp -r $DEST/* /"
