#!/usr/bin/env bash
set -euo pipefail

# Remove a worktree, its herdr workspace, and (optionally) the branch.
#
# Usage: remove-worktree.sh <branch> [--delete-branch]
#
# What it does:
#   1. Kills any agent running in the worktree
#   2. Closes the herdr workspace and removes the checkout (herdr worktree remove)
#   3. Falls back to `git worktree remove` if the checkout still exists
#   4. With --delete-branch: deletes the local branch (-D)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/herdr-lib.sh"

BRANCH="${1:?Usage: remove-worktree.sh <branch> [--delete-branch]}"
DELETE_BRANCH=false
if [ "${2:-}" = "--delete-branch" ]; then
  DELETE_BRANCH=true
fi

WORKTREE_PATH="$(worktree_dir_for_branch "$BRANCH")"

# --- 1. Kill agent if running ---
PANE_ID=$(find_agent_pane_for_dir "$WORKTREE_PATH")
if [ -n "$PANE_ID" ]; then
  echo "[remove-worktree] Killing agent in pane $PANE_ID..."
  "$SCRIPT_DIR/kill-agent.sh" "$PANE_ID" 2>/dev/null || true
fi

# --- 2. Remove via herdr if the worktree is open as a workspace ---
WS_ID=$(herdr worktree list --cwd "$REPO_ROOT" --json 2>/dev/null | \
  jq -r --arg path "$WORKTREE_PATH" \
  '.result.worktrees[]? | select(.path == $path) | .open_workspace_id // empty' | head -1)

if [ -n "$WS_ID" ]; then
  echo "[remove-worktree] Closing herdr workspace $WS_ID and removing worktree..."
  herdr worktree remove --workspace "$WS_ID" --force >/dev/null 2>&1 || true
fi

# --- 3. Fallback: remove via git ---
if [ -d "$WORKTREE_PATH" ]; then
  git worktree remove "$WORKTREE_PATH" 2>/dev/null || \
    git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || {
      echo "[remove-worktree] Worktree removal failed, trying manual cleanup..."
      rm -rf "$WORKTREE_PATH" 2>/dev/null || true
    }
fi
git worktree prune

# --- 4. Delete branch ---
if [ "$DELETE_BRANCH" = true ]; then
  echo "[remove-worktree] Deleting branch $BRANCH..."
  git branch -D "$BRANCH" 2>/dev/null || echo "[remove-worktree] Branch already gone."
fi

echo "[remove-worktree] Done."
