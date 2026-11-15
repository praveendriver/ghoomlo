#!/bin/bash
# Daily fare-tracker runner — invoked by launchd.
# Runs the fare-tracker skill in non-interactive Claude Code, logs output by date.

set -euo pipefail

PROJECT_DIR="/Users/malhar.gupta/projects/personal/travel agent"
LOG_DIR="$HOME/Library/Logs/travel-agent"
DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/fare-tracker-$DATE.log"
CLAUDE_BIN="/Users/malhar.gupta/.local/bin/claude"

mkdir -p "$LOG_DIR"

{
  echo "==== fare-tracker run: $(date -Iseconds) ===="
  cd "$PROJECT_DIR"
  "$CLAUDE_BIN" -p "Run the fare-tracker skill in 'check' mode against all active watches in the Travel Deals Tracker. If there are no active watches, exit cleanly with 'no watches'. Snapshot prices, append to Fare History, evaluate baselines, and email + log to Fare Alerts only if a drop triggers. Return a one-line summary." \
    --output-format text \
    --allowed-tools "WebFetch,WebSearch,Bash(python3 scripts/api/*),Bash(python3 scripts/api/youtube_*),Bash(python3 scripts/api/instagram_*),Bash(python3 scripts/api/blog_*),Bash(python3 scripts/api/tripadvisor.py),Bash(python3 scripts/influencers/*),mcp__plugin_google-workspace_vmcp-google-workspace__read_sheet_values,mcp__plugin_google-workspace_vmcp-google-workspace__modify_sheet_values,mcp__plugin_google-workspace_vmcp-google-workspace__list_spreadsheets,mcp__plugin_google-workspace_vmcp-google-workspace__send_gmail_message,mcp__plugin_google-workspace_vmcp-google-workspace__draft_gmail_message" \
    2>&1
  echo "==== exit code: $? ===="
} >> "$LOG_FILE" 2>&1
