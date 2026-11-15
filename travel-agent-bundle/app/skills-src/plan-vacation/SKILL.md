---
name: plan-vacation
description: End-to-end orchestrator for the personal travel-planner suite. Runs holiday-date-picker → destination-curator → [user picks 1 of 3] → travel-deals-finder → points-miles-optimizer → hotel-cash-vs-points → budget-envelope → itinerary-builder → trip-prep-checklist, with explicit user checkpoints between phases. Use when the user asks "plan my next vacation", "what should I do for my next trip", or wants a fully-orchestrated plan from Bangalore for the family.
icon: route
color: Purple
related_server_ids:
  - gsheets
  - gmail
---

# Plan Vacation (Orchestrator)

## When to Use

Activate when the user wants a **complete vacation plan** end-to-end, not just one slice. Examples:
- "Plan my next family trip"
- "What should we do for the next school break?"
- "Run the travel agent end-to-end"

Do NOT activate when the user wants a single skill in isolation (e.g., "just check fares to Tokyo") — invoke that skill directly.

## Required Inputs

The orchestrator gathers these by running upstream skills. Defaults pulled from `.workspace/user_travel_prefs.md`:
- Origin: BLR
- Travelers: family of 4 (kids ages 6, 9 — must not miss school)
- Hotel tier: 5-star, Marriott → Hilton fallback
- Budget tier: Lux (₹7L per trip, per-category caps)
- Cabin: economy headline, promote PE/biz only on never-seen-before deals

Per-run inputs the user supplies at checkpoints (see workflow).

## Workflow (with checkpoints)

```
Plan Vacation Progress:
- [ ] Phase 1: Pick date windows (holiday-date-picker)
- [ ] Phase 2: Curate destinations (destination-curator)
- [ ] CHECKPOINT 1: User picks 1 destination + 1 date window to deep-dive
- [ ] Phase 3: Deals scan (travel-deals-finder, narrowed to chosen dest+window)
- [ ] Phase 4: Points/miles + hotel cash-vs-points review
- [ ] Phase 5: Budget envelope check
- [ ] CHECKPOINT 2: User confirms booking shortlist
- [ ] Phase 6: Itinerary build (itinerary-builder)
- [ ] Phase 7: Trip prep checklist (trip-prep-checklist)
- [ ] Phase 8: Final email digest with full plan + sheet link
```

### Phase 1: Date Windows

Invoke [[holiday-date-picker]]. Always pass:
- look-ahead: today → today + 90 days (default) or user-specified longer horizon
- traveler context: family of 4, kids in school
- ask user for blackout dates this run

If a kid's birthday (July or November) falls in the look-ahead window, the date-picker should prefer (but not force) windows overlapping the birthday week, **only** when school is also out.

### Phase 2: Destination Curation

Invoke [[destination-curator]] with each date window from Phase 1. Returns up to 3 destinations × up to 3 windows = a small grid.

### Checkpoint 1 — User picks the deep-dive

Present the grid as a compact table:

| # | Destination | Window | Length | PTO | Why this combo |
|---|---|---|---|---|---|

Ask: **"Pick one destination + one date window to deep-dive, or say 'shortlist N' to deep-dive multiple."**

Stop and wait for the user. Do NOT proceed without an explicit pick.

### Phase 3: Deals Scan (narrowed)

Invoke [[travel-deals-finder]] with the chosen `destinations` and `date_options` only. Use the same Travel Deals Tracker sheet (URL at `.workspace/travel_deals_tracker_url.txt`).

Pass `report_month` = the month containing the trip start.

### Phase 4: Points + Hotel Cash-vs-Points

For each top-3 combo from Phase 3:
1. Invoke [[points-miles-optimizer]] for the flight leg.
2. Invoke [[hotel-cash-vs-points]] for the chosen Marriott/Hilton property.
3. Append findings to the same sheet row (extra columns: `Award Option`, `Hotel Points Cost`, `Recommended Path`).

### Phase 5: Budget Envelope

Invoke [[budget-envelope]] with the cheapest paid path (and the points path) for each combo. Flag any over-cap categories. Suggest 1-2 swaps if over budget (downgrade cabin, switch property, shorten by 1 night).

### Checkpoint 2 — Booking Shortlist

Show the user the consolidated table with paid total, points total, and budget status. Ask: **"Which option do you want me to build the itinerary around?"**

Wait for explicit pick.

### Phase 6: Itinerary

Invoke [[itinerary-builder]] with the chosen `destination`, `depart_date`, `return_date`, `travelers`, and theme weights from `.workspace/user_travel_prefs.md`. Pace = mix-by-length (slow for 7+ days, balanced for 4-5).

### Phase 7: Prep Checklist

Invoke [[trip-prep-checklist]]. Generates visa/vaccine/forex/eSIM/insurance/packing/school-leave items. Writes to a new `Trip Prep — {destination} {month}` tab.

### Phase 8: Final Email Digest

Email malhar.gupta@gmail.com with:
- Trip summary (dest, dates, travelers, total cost paid + points)
- Day-by-day itinerary (HTML)
- Booking links (flight + hotel)
- Prep-checklist top 5 deadlines
- Link to the full Travel Deals Tracker sheet

## Failure Modes & Guardrails

- **User skips a checkpoint**: do NOT auto-pick. Ask once more, then stop and tell the user "I need a pick to continue."
- **Phase failure**: surface the error, log to `Orchestrator Log` tab, and ask user whether to retry, skip, or abort. Never silently move on.
- **Birthday-window conflict with school**: school always wins. Flag the conflict in the rationale; do not propose pulling the kids out.
- **No tracker URL yet**: run travel-deals-finder's first-run setup before continuing the chain.

## Output Format

A single user-facing summary at the end:
> "Planned: {destination} {dates}. Best path: {paid|points} at ₹{X}. Itinerary in tracker tab `{name}`. Prep checklist in tab `Trip Prep — ...`. Full digest emailed."

## Triggering Modes

- **Full chain** (default): run all 8 phases.
- **Resume**: if user says "continue planning {dest}", read the latest tracker tab and resume from the next unchecked phase.
- **Re-plan**: user says "swap destination" → re-enter at Checkpoint 1.
