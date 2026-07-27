#!/usr/bin/env bash
# ==============================================================================
# Script: pull_spark_updates.sh
# Location: ~/work/jediller.github.io/gemini/bin/pull_spark_updates.sh
# Purpose: Sync work.bin to ~/work/bin (local only) and pull DailyBrowser updates 
#          from Google Drive to push to GitHub.
# ==============================================================================

set -euo pipefail

REPO_DIR="$HOME/work/jediller.github.io/gemini"
BIN_DIR="$HOME/work/bin"
DRIVE_GEMINI="gdrive:jediller.github.io/gemini"
DRIVE_WORK_BIN="gdrive:work.bin"
LOG_FILE="$HOME/work/tmp/pull_spark_updates.log"
TODAY=$(date +%Y%m%d)

mkdir -p "$HOME/work/tmp" "$BIN_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting Daily Drive Sync & GitHub Push..."

# ------------------------------------------------------------------------------
# 1. Sync work.bin to /home/john/work/bin & apply executable permissions
# ------------------------------------------------------------------------------
log "Syncing work.bin from Google Drive to /home/john/work/bin..."
rclone copy "${DRIVE_WORK_BIN}" "$BIN_DIR" >> "$LOG_FILE" 2>&1 || log "Notice: work.bin sync completed with warnings."

log "Applying execute permissions (chmod +x) to files in /home/john/work/bin..."
chmod -R +x "$BIN_DIR" 2>/dev/null || true

# ------------------------------------------------------------------------------
# 2. Sync DailyBrowser subdirectories from Google Drive
# ------------------------------------------------------------------------------
log "Pulling DailyBrowser updates from Google Drive..."
cd "$REPO_DIR"

rclone copy "${DRIVE_GEMINI}/result" "$REPO_DIR/result" --drive-export-formats txt >> "$LOG_FILE" 2>&1
rclone copy "${DRIVE_GEMINI}/query" "$REPO_DIR/query" --drive-export-formats txt >> "$LOG_FILE" 2>&1
rclone copy "${DRIVE_GEMINI}/history" "$REPO_DIR/history" --drive-export-formats txt >> "$LOG_FILE" 2>&1
rclone copy "${DRIVE_GEMINI}/web" "$REPO_DIR/web" >> "$LOG_FILE" 2>&1
rclone copy "${DRIVE_GEMINI}/stage" "$REPO_DIR/stage" >> "$LOG_FILE" 2>&1

# Touch local text files to update system timestamps
find "$REPO_DIR/result" "$REPO_DIR/query" "$REPO_DIR/history" -type f -name "*.txt" -exec touch {} + 2>/dev/null || true

# ------------------------------------------------------------------------------
# 3. Stage and push repository changes to GitHub (excludes work.bin)
# ------------------------------------------------------------------------------
log "Checking for Git changes in repository..."
git add result/ query/ history/ web/ stage/

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if git diff-index --quiet HEAD --; then
    log "No unstaged repository changes detected."
else
    git commit -m "Automated update for ${TODAY}" >> "$LOG_FILE" 2>&1 || true
    log "Committed local repository changes."
fi

log "Pushing local commits to origin/${BRANCH}..."
git push origin "${BRANCH}" >> "$LOG_FILE" 2>&1
log "Successfully pushed updates to GitHub."

log "Sync completed."