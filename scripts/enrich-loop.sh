#!/usr/bin/env bash
set -euo pipefail

# enrich-loop.sh — nightly knowledge base enrichment daemon
# Runs opencode (curator) in a loop during the active window.
# Last 2 hours of the window: one maintenance run per day, then waits.
# Enrichment alternates 80% recent / 20% random.
# Designed to run as a systemd user service — logs go to stdout.
# Idempotent: safe to restart at any point.

WINDOW_START=${WINDOW_START:-0}     # hour (0-23), default 00:00
WINDOW_END=${WINDOW_END:-9}         # hour (0-23), default 09:00
SLEEP_BETWEEN=${SLEEP_BETWEEN:-300} # seconds between enrichment runs — tune based on observed duration

STATE_DIR="${HOME}/.local/share/enrich-loop"
MAINTENANCE_STATE="${STATE_DIR}/maintenance-last-run"

mkdir -p "$STATE_DIR"

current_hour() {
  date '+%H' | sed 's/^0*//'
}

today() {
  date '+%Y-%m-%d'
}

in_window() {
  local hour
  hour=$(current_hour)
  (( hour >= WINDOW_START && hour < WINDOW_END ))
}

in_maintenance_window() {
  local hour
  hour=$(current_hour)
  (( hour >= WINDOW_END - 2 && hour < WINDOW_END ))
}

maintenance_ran_today() {
  [ -f "$MAINTENANCE_STATE" ] && [ "$(cat "$MAINTENANCE_STATE")" = "$(today)" ]
}

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

run_count=0

log "enrich-loop started (window: ${WINDOW_START}:00–${WINDOW_END}:00)"

while true; do
  if ! in_window; then
    sleep 60
    continue
  fi

  if in_maintenance_window; then
    if ! maintenance_ran_today; then
      log "maintenance window — invoking opencode"
      opencode run --agent curator "Run a full knowledge base maintenance audit."
      today > "$MAINTENANCE_STATE"
      log "maintenance run complete"
    else
      sleep 60
    fi
    continue
  fi

  run_count=$(( run_count + 1 ))
  if (( run_count % 5 == 0 )); then
    mode="random"
  else
    mode="recent"
  fi

  log "enrichment run ${run_count} (mode: ${mode}) — invoking opencode"
  opencode run --agent curator "Run one enrichment cycle using ${mode} topic mode."
  log "enrichment run ${run_count} complete (mode: ${mode})"

  sleep "$SLEEP_BETWEEN"
done
