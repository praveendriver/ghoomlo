#!/bin/bash
# Weekly recommendation refresh — invoked by launchd Sunday 9 AM.
# Runs the destination-curator chain in non-interactive Claude Code.

set -euo pipefail

PROJECT_DIR="/Users/malhar.gupta/projects/personal/travel agent"
LOG_DIR="$HOME/Library/Logs/travel-agent"
DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/recommendations-$DATE.log"
CLAUDE_BIN="/Users/malhar.gupta/.local/bin/claude"

mkdir -p "$LOG_DIR"

{
  echo "==== recommendations refresh: $(date -Iseconds) ===="
  cd "$PROJECT_DIR"
  "$CLAUDE_BIN" -p "Refresh trips/_shared/data/recommendations.json with the latest 6-month outlook (today onwards).

Re-run the destination scoring chain. Inputs:
1. Read .workspace/user_travel_prefs.md for hard rules (vegetarian, school, BLR, hotel tier, ₹7L Lux cap).
2. Read .workspace/loyalty.md for current Bonvoy/Hilton/Hyatt balances + Marriott 40K cert (expires 2026-12-31).
3. Read .workspace/school_calendar_cache.md for TISB term + holiday windows.
4. Read trips/_shared/data/visited.json (12-month exclusion + lifetime visit history).
5. Read trips/_shared/data/wishlist.json + favorites.json.

Score each candidate (0-100). Surface 5-7 recommendations + a passed_over list. Match the existing JSON schema exactly: id, destination, country, iata, window, nights, type, score, headline, rationale (5 bullets), est_cost, loyalty_play, warnings, tags.

Overwrite trips/_shared/data/recommendations.json. Bump generated_at to today and next_refresh to next Sunday 09:00 IST. Do not modify trips/index.html unless schema changed." \
    --output-format text \
    --allowed-tools "Read,Write,Edit,WebFetch,WebSearch,Bash" \
    2>&1
  echo "==== exit code: $? ===="
} >> "$LOG_FILE" 2>&1
