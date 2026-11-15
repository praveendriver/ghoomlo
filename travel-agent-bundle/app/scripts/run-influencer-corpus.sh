#!/bin/bash
# Weekly influencer-corpus refresh — invoked by launchd / crontab.
# Runs corpus_builder.py --full and logs by date.
#
# Schedule recommendation (manual cron):
#   0 5 * * 0  /Users/malhar.gupta/projects/personal/travel\ agent/scripts/run-influencer-corpus.sh
# (Sundays at 05:00 — keeps the daily fare-tracker run untouched.)

set -euo pipefail

PROJECT_DIR="/Users/malhar.gupta/projects/personal/travel agent"
LOG_DIR="$HOME/Library/Logs/travel-agent"
DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/influencer-corpus-$DATE.log"

mkdir -p "$LOG_DIR"

{
  echo "==== influencer-corpus run: $(date -Iseconds) ===="
  cd "$PROJECT_DIR"
  python3 "$PROJECT_DIR/scripts/influencers/corpus_builder.py" \
      --full \
      --max-per-source 8 \
      --skip-instagram \
      2>&1
  echo "==== exit code: $? ===="
} >> "$LOG_FILE" 2>&1
