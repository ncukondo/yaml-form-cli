#!/usr/bin/env bash
set -euo pipefail

# Spawn a Claude agent in a git worktree (created on demand) via herdr.
#
# Usage:
#   spawn-agent.sh <branch> [options] [-- <prompt>]
#
# Examples:
#   # New branch + worktree, start with a task prompt
#   spawn-agent.sh feat/new-feature --create -- "implement the new feature per docs/plan.md"
#
#   # Existing branch (fetched from origin if needed)
#   spawn-agent.sh feat/my-feature --create -- "fix the failing tests"
#
#   # Interactive mode (no prompt, just open Claude)
#   spawn-agent.sh feat/my-feature
#
# Options:
#   --create         Create the worktree if it doesn't exist
#   --pr <number>    Resolve branch from a GitHub PR (requires gh; implies --create)
#   --setup <cmd>    Run <cmd> in the worktree after creation
#                    (default: auto-detect — npm/pnpm/yarn install when a lockfile exists)
#   --no-setup       Skip dependency setup entirely
#
# Worktrees are created under ~/.herdr/worktrees/<repo-name>/<branch-with-dashes>
# (herdr's own convention, so `herdr worktree list` sees them).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/herdr-lib.sh"

BRANCH=""
PR_NUMBER=""
CREATE_WORKTREE=false
SETUP_CMD=""
NO_SETUP=false
PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr) PR_NUMBER="$2"; shift 2 ;;
    --create) CREATE_WORKTREE=true; shift ;;
    --setup) SETUP_CMD="$2"; shift 2 ;;
    --no-setup) NO_SETUP=true; shift ;;
    --) shift; PROMPT="$*"; break ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *)
      if [ -z "$BRANCH" ]; then BRANCH="$1"; else echo "Unexpected argument: $1" >&2; exit 1; fi
      shift ;;
  esac
done

if [ -n "$PR_NUMBER" ]; then
  echo "[spawn-agent] Fetching branch from PR #$PR_NUMBER..."
  BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName --jq '.headRefName' 2>/dev/null) || {
    echo "[spawn-agent] ERROR: Could not get branch for PR #$PR_NUMBER" >&2
    exit 1
  }
  CREATE_WORKTREE=true
fi

if [ -z "$BRANCH" ]; then
  echo "Usage: spawn-agent.sh <branch> [--create] [--pr <n>] [--setup <cmd>|--no-setup] [-- <prompt>]" >&2
  exit 1
fi

WORK_DIR="$(worktree_dir_for_branch "$BRANCH")"

# --- Create worktree if needed ---
if [ ! -d "$WORK_DIR" ]; then
  if [ "$CREATE_WORKTREE" != true ]; then
    echo "[spawn-agent] ERROR: Worktree does not exist: $WORK_DIR (use --create)" >&2
    exit 1
  fi
  echo "[spawn-agent] Creating worktree: $WORK_DIR"
  mkdir -p "$WORKTREE_BASE"
  git fetch origin "$BRANCH" 2>/dev/null || true
  if git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null || \
     git show-ref --verify --quiet "refs/remotes/origin/$BRANCH" 2>/dev/null; then
    git worktree add "$WORK_DIR" "$BRANCH"
  else
    echo "[spawn-agent] Creating new branch: $BRANCH"
    git worktree add "$WORK_DIR" -b "$BRANCH"
  fi

  # --- Dependency setup ---
  if [ "$NO_SETUP" != true ]; then
    if [ -z "$SETUP_CMD" ]; then
      if [ -f "$WORK_DIR/pnpm-lock.yaml" ]; then SETUP_CMD="pnpm install"
      elif [ -f "$WORK_DIR/yarn.lock" ]; then SETUP_CMD="yarn install"
      elif [ -f "$WORK_DIR/package-lock.json" ] || [ -f "$WORK_DIR/package.json" ]; then SETUP_CMD="npm install"
      fi
    fi
    if [ -n "$SETUP_CMD" ]; then
      echo "[spawn-agent] Running setup: $SETUP_CMD"
      (cd "$WORK_DIR" && eval "$SETUP_CMD")
    fi
  fi
else
  echo "[spawn-agent] Using existing worktree: $WORK_DIR"
fi

export LAUNCH_AGENT_LABEL="spawn-agent"
exec "$SCRIPT_DIR/launch-agent.sh" "$WORK_DIR" "$PROMPT"
