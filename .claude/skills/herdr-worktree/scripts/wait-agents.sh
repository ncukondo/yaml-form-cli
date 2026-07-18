#!/usr/bin/env bash
set -euo pipefail

# Wait until every given agent has finished its current task.
#
# Usage: wait-agents.sh <target>... [--interval <sec>] [--timeout <sec>]
#   target: herdr pane id (e.g. w13:p2), unique agent name, or terminal id
#   --interval  polling interval in seconds (default: 60)
#   --timeout   give up after this many seconds (default: 0 = no timeout)
#
# Finishes when no target is "working" or "starting" anymore, then prints
# one "<target>  <state>" line per target (idle / permission / gone).
# Exit 0 on success, 1 on timeout, 2 on usage error.
#
# Notes:
# - "gone" means the agent/pane no longer exists; it is treated as finished.
# - "permission" (blocked dialog) also ends the wait: the agent will not
#   progress without intervention, so the orchestrator must inspect it
#   (herdr agent read <target>) rather than keep waiting.
# - "idle" is not proof of success — verify via output or artifacts
#   (see SKILL.md note on startup dialogs).
# - Use this script instead of hand-rolled polling loops: inline loops
#   written for the orchestrator's shell are a known footgun (e.g. zsh does
#   not word-split $VAR, silently turning "poll N agents" into a false
#   "all finished").

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

INTERVAL=60
TIMEOUT=0
TARGETS=()

usage() {
  echo "Usage: wait-agents.sh <target>... [--interval <sec>] [--timeout <sec>]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval)
      INTERVAL="${2:?--interval needs a value}"
      shift 2
      ;;
    --timeout)
      TIMEOUT="${2:?--timeout needs a value}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      TARGETS+=("$1")
      shift
      ;;
  esac
done

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  usage >&2
  exit 2
fi

state_of() {
  local state
  state=$("$SCRIPT_DIR/check-agent-state.sh" "$1" 2>/dev/null) || state="gone"
  echo "$state"
}

START=$(date +%s)
while :; do
  BUSY=()
  for t in "${TARGETS[@]}"; do
    state="$(state_of "$t")"
    case "$state" in
      working|starting) BUSY+=("$t=$state") ;;
    esac
  done
  [[ ${#BUSY[@]} -eq 0 ]] && break
  if (( TIMEOUT > 0 && $(date +%s) - START >= TIMEOUT )); then
    echo "[wait-agents] timeout after ${TIMEOUT}s; still busy: ${BUSY[*]}" >&2
    exit 1
  fi
  sleep "$INTERVAL"
done

echo "[wait-agents] all agents finished:"
for t in "${TARGETS[@]}"; do
  echo "  $t  $(state_of "$t")"
done
