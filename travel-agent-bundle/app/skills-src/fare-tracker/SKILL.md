---
name: fare-tracker
description: Periodically logs fare snapshots for watched routes, computes baselines (rolling 30-day median, lowest-seen-6-months, same-dates-last-year), and alerts when current price drops meaningfully below baselines. Writes to the Fare History and Fare Alerts tabs of the Travel Deals Tracker. Sends email alerts to malhar.gupta@gmail.com. Designed to run on a daily cron + on-demand. Use to set up a watch, run a single check, or review baselines.
icon: line-chart
color: Cyan
related_server_ids:
  - gsheets
  - gmail
---

# Fare Tracker

## When to Use

Three modes:

1. **Watch a route**: user says "watch BLR → NRT for Aug 13-17", or invoked from [[plan-vacation]] when a destination/window is shortlisted.
2. **Run a check**: scheduled via Cron, or on-demand "check my fares now".
3. **Review baselines**: "is this a good price for {route} {dates}?" — one-off question without setup.

## Required Inputs

For setup (mode 1):
- `route`: e.g., `BLR-NRT` (origin-destination, IATA)
- `depart_date`, `return_date` (or "monthly window"=`Aug 2026` for flexible)
- `cabin`: economy / PE / business (default: economy + PE alongside)
- `pax`: default 4
- `alert_threshold_pct`: how much below baseline triggers an alert (default 15%)

Persistence: watches stored as rows in the `Fare Watches` tab of Travel Deals Tracker. Schema:
```
Watch ID | Route | Depart | Return | Cabin | Pax | Baseline Days | Threshold % | Status | Created | Last Checked
```

## Workflow

```
Fare Tracker Progress:
- [ ] Step 1: Resolve mode (setup / check / review)
- [ ] Step 2: Fetch current price snapshot
- [ ] Step 3: Append to Fare History
- [ ] Step 4: Compute 3 baselines
- [ ] Step 5: Compare + decide on alert
- [ ] Step 6: Email + log to Fare Alerts (if triggered)
```

### Step 1: Mode Resolution

- **Setup**: append a row to `Fare Watches`. Status = `Active`. Then run a first snapshot.
- **Check**: read all `Status=Active` rows; for each, run steps 2-6.
- **Review**: read existing `Fare History` rows for the matching route/dates; skip step 3.

### Step 2: Current Snapshot

Use the same flight research as [[travel-deals-finder]] but focused on price only.

**API-first** (preferred):
1. Run `Bash`:
   ```
   python3 scripts/api/amadeus_flights.py --origin {ORIGIN} --dest {DEST} \
       --depart {DEPART} --return {RETURN} --adults {pax} --currency INR --max 5
   ```
2. Parse JSON. Take the cheapest offer's `price_total` per cabin captured (re-run with `--cabin PREMIUM_ECONOMY` and `--cabin BUSINESS` if those cabins are watched).
3. Record `Source = amadeus` plus a Google Flights booking link assembled from the route + dates.

**WebSearch fallback** (only if the script exits non-zero or returns `[]`):
1. `web_search`: `flights {origin} to {destination} {depart} return {return} cheapest`
2. `web_fetch` on Skyscanner / Google Flights for an INR price.
3. Record `Source = web` and the source URL.

Capture: cheapest economy, cheapest PE, cheapest business (if requested), snapshot timestamp.

If neither path returns a price (CAPTCHA / blocked / Amadeus quota), append a `source=unavailable` row — do not fabricate.

### Step 3: Append to Fare History

Tab `Fare History` schema:
```
Snapshot Date | Route | Depart | Return | Cabin | Price ₹ | Pax | Source | Notes
```

`Source` is one of `amadeus` (API path) or `web` (WebSearch fallback) or `unavailable` — used for trust-weighting baselines later.

Append one row per cabin captured. Currency = INR.

### Step 4: Compute Baselines

Read all prior `Fare History` rows for the same Route+Depart+Return+Cabin.

```
baseline_30d_median = median of snapshots in last 30 days
baseline_low_6m     = MIN(price) over last 180 days
baseline_yoy        = lookup snapshot ~365 days ago (±14 days) for same route + same departure/return month-day
```

If insufficient history (<5 snapshots in last 30d), mark each missing baseline `n/a` rather than guessing.

### Step 5: Decide Alert

Trigger an alert when ANY of:
- Current price ≤ `(1 - threshold_pct) × baseline_30d_median`
- Current price ≤ `baseline_low_6m × 1.02` (within 2% of all-time low)
- Current price < `baseline_yoy × 0.85` (15% better than same time last year)

Also surface an INFO event (no email, only log) when current price drops 10-15% below 30d median — useful for trending awareness.

### Step 6: Alert Channels

When triggered:
1. **Append** row to `Fare Alerts` tab:
   ```
   Date | Route | Depart | Return | Cabin | Current ₹ | 30d Median | Low 6m | YoY | Triggers | Booking Link
   ```
2. **Email** malhar.gupta@gmail.com:
   - Subject: `🔔 Fare alert — {route} {depart}-{return} at ₹{X}`
   - Body: short table with all 3 baselines side-by-side + Skyscanner/Google Flights direct booking links.
   - Include the trigger reason.

If multiple watches trigger in one cron run, send a **single digest** email — never spam multiple alerts.

## Cron Setup (one-time)

Recommend the user create a daily check at a sensible time:

```
CronCreate "fare-check" cron="0 8 * * *" command="invoke fare-tracker check"
```

Add a manual override: `/check-fares` slash command or "run fare tracker now" invocation.

## Manual Override (on-demand)

User says: "run fare tracker now" → execute mode `check` against all active watches and report inline.

## Failure Modes & Guardrails

- **No history yet**: first snapshot logs but never alerts. Tell the user "logged baseline — alerts begin once 5+ snapshots exist."
- **Source rate-limited**: write `source=unavailable` row and skip alert math. Don't double-charge the user with a missing-data alert.
- **Date in past**: auto-archive the watch (Status=Expired) once `depart_date` < today.
- **Major holiday spike**: surface but don't alert on price spikes — this skill is for drops only. Price-up info goes to console output only.
- **Don't fabricate prices**: if no price returned, do not guess from a range. Skip.

## Output

After a `check` run, return a one-liner:
> "Checked {N} watches. {M} alerts triggered. New 6-month low on {route} → emailed."

After `setup`, return:
> "Watching {route} {depart}-{return}. First snapshot logged at ₹{X}. Cron will check daily; baselines kick in after 5 snapshots."

## Triggering Modes

- **Cron daily**: see above.
- **Per-trip auto-watch**: invoked by [[plan-vacation]] Phase 3 — auto-creates watches for the top-3 combos so the user keeps tracking even if not booked yet.
- **Manual**: user-driven setup or check.

See `references/baseline_logic.md` for the alert threshold rationale and edge cases.
