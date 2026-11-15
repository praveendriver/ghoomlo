---
name: budget-envelope
description: Tracks per-category trip budget caps (flights / hotel / activities / food / transfers) against actual + projected spend in INR. Default tier is Lux (₹2.5L flight / ₹3L hotel / ₹1.5L other = ₹7L total) for family of 4. Warns when projected total exceeds caps and suggests targeted swaps (cabin downgrade, alternate property, drop a night). Use during planning to size the trip and during/after the trip to log actuals.
icon: piggy-bank
color: Indigo
related_server_ids:
  - gsheets
---

# Budget Envelope

## When to Use

- During planning: size up "is this trip within budget?" before booking.
- During the trip: log actuals (food, activities, transfers).
- After the trip: produce a budget vs actuals reconciliation.

## Required Inputs

1. `trip_id` (e.g., `Tokyo-Aug2026`) — used as the row key
2. Caps (default Lux, override per trip):
   - Flights: ₹2,50,000
   - Hotel: ₹3,00,000
   - Activities: ₹50,000
   - Food: ₹60,000
   - Transfers: ₹40,000
   - **Total**: ₹7,00,000
3. Inputs from upstream skills:
   - Cheapest paid flight + cheapest hotel from [[travel-deals-finder]]
   - Itinerary cost estimates from [[itinerary-builder]]

## Workflow

```
Budget Envelope Progress:
- [ ] Step 1: Initialize trip budget row
- [ ] Step 2: Aggregate projected spend by category
- [ ] Step 3: Compare to caps
- [ ] Step 4: If over, suggest swaps
- [ ] Step 5: Save to Budget tab
- [ ] Step 6 (in-trip): Log actuals
- [ ] Step 7 (post-trip): Reconcile
```

### Step 1: Initialize

`Budget` tab schema (one row per trip, plus per-category sub-rows):
```
Trip ID | Category | Cap ₹ | Projected ₹ | Actual ₹ | Variance ₹ | Variance % | Status
```

For a new trip, create the parent row + 5 category rows + a Total row.

### Step 2: Aggregate Projection

| Category | Source |
|---|---|
| Flights | `cheapest_economy_total × pax` (or PE/biz total if user picked that). |
| Hotel | `nightly_rate × (nights)`. Add resort fees + occupancy taxes. |
| Activities | Sum of [[itinerary-builder]] anchor cost estimates × pax. |
| Food | Default ₹2,500/person/day × pax × days; override if itinerary has explicit restaurant prices. |
| Transfers | Airport ↔ hotel both ways + intra-city (rough estimate, ₹4-8K/day). |

### Step 3: Compare

Compute variance per category. Set Status:
- `OK` if `projected ≤ cap`
- `WARN` if `cap < projected ≤ cap × 1.10`
- `OVER` if `projected > cap × 1.10`

Compute Total row separately — total may be OK even if one category is WARN/OVER.

### Step 4: Swap Suggestions (when OVER)

Targeted suggestions (don't propose changing the destination):

| Category over | First suggestion | Second suggestion |
|---|---|---|
| Flights | Drop premium cabin → economy | Shift dates ±2 days using [[fare-tracker]] history |
| Hotel | Drop 1 night | Switch to a 4-star Marriott/Hilton (relax 5-star constraint with user OK) or use points (route to [[hotel-cash-vs-points]]) |
| Activities | Drop the lowest-priority itinerary anchor | Skip cooking class / private guide |
| Food | Mix one self-catered hotel breakfast/day if Bonvoy elite breakfast is unavailable | Plan 1-2 lunches at hotel club lounge |
| Transfers | Use airport rail/metro instead of taxi | Single airport transfer + public transit intra-city |

Output a `Swap Plan` block under the trip row:
```
Total over by ₹X.
- Swap 1: ___ saves ~₹Y
- Swap 2: ___ saves ~₹Z
After swaps: ₹{new total} (Status: OK / WARN)
```

### Step 5: Save

Write/update the trip's rows in the Budget tab. Also update the trip's row in the monthly Travel Deals Tracker tab with `Budget Status` and `Projected Total`.

### Step 6: In-Trip Logging

User can ask "log ₹3,200 dinner Tokyo" → append to a `Trip Spend` tab:
```
Date | Trip ID | Category | Description | Amount ₹ | Pax | Notes
```

Recompute the trip's `Actual ₹` aggregate after each log.

### Step 7: Post-Trip Reconciliation

Invoked by [[post-trip-logger]]. Produces a final variance report:
```
{trip_id} actual ₹{X} vs cap ₹{Y} = {± %}
- Flights ₹X (cap Y): variance Z
- Hotel ...
Lessons: {1-2 bullets — e.g., food over by 30%, transfers under}
```

Append the lessons to a `Budget Lessons` tab to inform future trip caps.

## Failure Modes & Guardrails

- **No projection inputs**: tell the user which inputs are missing instead of guessing. (e.g., "I don't have hotel total — run travel-deals-finder first.")
- **Currency mix-ups**: store everything in INR. Convert with same-day rate + record the rate used.
- **Don't auto-apply swaps**: always present them and wait for user OK before changing the booking shortlist.
- **Don't change caps silently**: if the user wants a different tier, write the new caps to the trip's row but log the change in Notes.

## Triggering Modes

- **Per-trip**: invoked by [[plan-vacation]] Phase 5.
- **Standalone**: "what's my budget look like for {trip_id}?"
- **Logging**: "log {amount} {category} for {trip_id}" — single-row append.

See `references/category_heuristics.md` for default INR-per-day numbers by destination type.
