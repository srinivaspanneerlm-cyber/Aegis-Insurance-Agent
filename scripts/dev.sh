#!/usr/bin/env bash
#
# Start the whole application for a demo, from one terminal.
#
# Three services have to come up in order — the AI engine, then the backend
# that calls it, then the front end that calls the backend — and each needs a
# different incantation (a virtualenv here, npm there). Typing all of that into
# three panels is fine on a quiet afternoon and miserable five minutes before a
# demo, which is exactly when a port turns out to still be held by yesterday's
# run.
#
# So this frees the ports first, starts everything, waits until each one
# actually answers, and says plainly whether it is safe to open the browser.
#
#   ./scripts/dev.sh          start everything
#   ./scripts/dev.sh stop     stop everything
#   ./scripts/dev.sh status   is it up?
#
# Ports are deliberately fixed. Google sign-in only authorises
# http://localhost:3000, and the backend only accepts that origin, so a service
# moved to a spare port looks like it started and then fails at login.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS="${TMPDIR:-/tmp}/aegis-dev-logs"
mkdir -p "$LOGS"

AI_PORT=8000
API_PORT=5000
WEB_PORT=3000

bold()  { printf "\033[1m%s\033[0m\n" "$1"; }
ok()    { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn()  { printf "  \033[33m!\033[0m %s\n" "$1"; }
fail()  { printf "  \033[31m✗\033[0m %s\n" "$1"; }

# Whoever is holding a port, by port alone. Never a process-name pattern: those
# match other people's terminals, and once matched this script's own command
# line too.
pid_on() { ss -tlnp 2>/dev/null | grep ":$1 " | grep -oP 'pid=\K[0-9]+' | head -1; }

free_port() {
  local port="$1" pid
  pid="$(pid_on "$port")"
  if [ -n "$pid" ]; then
    kill "$pid" 2>/dev/null
    sleep 1
    pid="$(pid_on "$port")"
    [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null
    ok "freed :$port"
  fi
}

# Poll until the service answers, rather than sleeping a hopeful number of
# seconds — a cold Next build can take a minute on a laptop and four on a busy
# one, and a fixed wait is wrong on both.
wait_for() {
  local name="$1" url="$2" limit="${3:-180}" waited=0
  while [ "$waited" -lt "$limit" ]; do
    if curl -sf -m 3 "$url" >/dev/null 2>&1; then
      ok "$name is up ($((waited))s)"
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  fail "$name did not answer within ${limit}s — see $LOGS"
  return 1
}

cmd_stop() {
  bold "Stopping"
  for p in "$WEB_PORT" "$API_PORT" "$AI_PORT"; do free_port "$p"; done
  ok "all ports free"
}

cmd_status() {
  bold "Status"
  for spec in "AI engine:$AI_PORT:/health" "Backend:$API_PORT:/health" "Frontend:$WEB_PORT:/"; do
    local name="${spec%%:*}" rest="${spec#*:}" port path
    port="${rest%%:*}"; path="${rest#*:}"
    local code
    code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://localhost:$port$path" 2>/dev/null)"
    if [ "$code" = "200" ]; then ok "$name  :$port"
    elif [ -n "$(pid_on "$port")" ]; then warn "$name  :$port — running, not answering yet"
    else fail "$name  :$port — down"; fi
  done
}

cmd_start() {
  bold "Freeing ports"
  for p in "$WEB_PORT" "$API_PORT" "$AI_PORT"; do free_port "$p"; done
  ok "ports clear"

  bold "Starting services"

  # AI engine first: the backend calls it, and a backend that boots without it
  # falls back to canned replies rather than failing loudly.
  ( cd "$ROOT/ai-python" && \
    { source venv/bin/activate 2>/dev/null || source .venv/bin/activate 2>/dev/null; } && \
    nohup python main.py > "$LOGS/ai.log" 2>&1 & )
  ok "AI engine starting   → $LOGS/ai.log"

  ( cd "$ROOT/backend" && nohup npm run dev > "$LOGS/backend.log" 2>&1 & )
  ok "backend starting     → $LOGS/backend.log"

  ( cd "$ROOT/frontend" && nohup npm run dev > "$LOGS/frontend.log" 2>&1 & )
  ok "frontend starting    → $LOGS/frontend.log"

  bold "Waiting"
  wait_for "AI engine" "http://localhost:$AI_PORT/health" 120
  wait_for "Backend"   "http://localhost:$API_PORT/health" 120
  wait_for "Frontend"  "http://localhost:$WEB_PORT" 180

  # The first request to a route is what compiles it, so the demo's opening
  # screens are warmed here instead of in front of an audience.
  bold "Warming the demo screens"
  for path in / /login /advisor /policies; do
    curl -s -o /dev/null -m 180 "http://localhost:$WEB_PORT$path" 2>/dev/null
    ok "compiled $path"
  done

  echo
  bold "Ready — http://localhost:$WEB_PORT"
  echo "  sign in with the demo account, then ask the advisor about cover"
  echo "  stop it with: ./scripts/dev.sh stop"
}

case "${1:-start}" in
  stop)   cmd_stop ;;
  status) cmd_status ;;
  start)  cmd_start ;;
  *) echo "usage: $0 [start|stop|status]"; exit 1 ;;
esac
