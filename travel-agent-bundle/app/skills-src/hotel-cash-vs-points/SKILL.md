---
name: hotel-cash-vs-points
description: For a chosen Marriott or Hilton 5-star property + dates, compares the cash rate vs the award (points) cost. Surfaces 5th-night-free, off-peak/standard/peak rate variations, points + cash blended rates, and elite benefits. Outputs a clear PAY / REDEEM / BLEND recommendation with cents-per-point math. Use after travel-deals-finder picks a hotel, before booking.
icon: hotel
color: Pink
related_server_ids:
  - gsheets
---

# Hotel Cash vs Points

## When to Use

- Evaluating a specific 5-star hotel + date range
- Deciding whether to book paid or use Bonvoy/Honors points
- [[plan-vacation]] Phase 4, after [[travel-deals-finder]]

Do NOT use for:
- Picking the property ([[travel-deals-finder]] does this)
- Airline points ([[points-miles-optimizer]])

## Required Inputs

1. `property_name` + `brand` (Marriott or Hilton)
2. `check_in`, `check_out` (YYYY-MM-DD)
3. `nights` (computed)
4. `pax` + `room_count` (default: 1 room family-of-4 if connecting / 2 rooms otherwise)
5. Cash rate (from [[travel-deals-finder]])
6. User's Bonvoy / Honors point balance (from `.workspace/loyalty.md`)

## Workflow

```
Cash vs Points Progress:
- [ ] Step 1: Pull award-night cost per night
- [ ] Step 2: Apply 5th-night-free if applicable
- [ ] Step 3: Check points + cash blended rates
- [ ] Step 4: Apply elite benefits (suite night awards, breakfast)
- [ ] Step 5: Compute cents-per-point
- [ ] Step 6: Recommend
```

### Step 1: Award Cost per Night

**Cash side** (do this first to anchor cpp math):
1. Run `Bash`:
   ```
   python3 scripts/api/amadeus_hotels.py --city {IATA_CITY} \
       --checkin {CHECK_IN} --checkout {CHECK_OUT} \
       --chain {MC|HH} --rating 5 --adults {pax} --currency INR
   ```
   `MC` for Marriott Bonvoy, `HH` for Hilton Honors.
2. Find the row matching the property the user picked; use its `total` for the cash side.
3. Fall back to `web_fetch` on marriott.com / hilton.com only if Amadeus returns `[]` for that property.

**Award (points) side** — Amadeus does not expose award pricing, so this stays manual:

- **Marriott Bonvoy**: dynamic pricing since 2022. Look up per-night points cost on marriott.com for each night in the window. Capture range (min/max).
- **Hilton Honors**: also dynamic. Look up per-night cost on hilton.com.

Use `web_fetch` on the property page with the date params, or `web_search`: `{property} Bonvoy points per night {month year}`.

### Step 2: 5th-Night-Free

**Marriott**: Bonvoy elites get every **5th award night free** when booked as a single 5-night reservation (not points + cash, not free-night certs).
- If `nights >= 5`: total points = sum of cheapest 4 nights for every 5-night block.
- Worked example: 7 nights with per-night costs [50,50,50,60,60,70,70]K → free night = lowest of any 5-night window. Bonvoy applies the lowest-cost night free per 5-night block.

**Hilton**: every **5th night free** for Honors members (no elite required, but standard award rate only).

### Step 3: Points + Cash Blends

Marriott offers **points + cash** rates (e.g., ½ points + ½ cash). Useful when user wants to extend a low balance. Compute the blended cost:
```
blend_cost_INR = (points_used × value_per_point_INR) + cash_portion_INR
```
Compare blend vs full cash and full points.

Hilton has **Points & Money** sliders — same logic.

### Step 4: Elite Benefits

If user is Bonvoy Titanium / Hilton Diamond etc., add:
- Free breakfast (₹3-5K/day value for family of 4)
- Suite Night Awards / suite upgrades
- 4pm late checkout (saves a half-day rate sometimes)
- Lounge access

These shift the cents-per-point math meaningfully — bake into the verdict.

### Step 5: Cents per Point (₹/point)

```
cash_total_INR     = nightly cash × nights (or use TDF price)
points_total       = sum after 5th-night-free
extras_value_INR   = breakfast value + lounge value (if applicable)
effective_value    = (cash_total - taxes_not_on_points) + extras_value
cpp_INR_per_point  = effective_value / points_total
```

### Step 6: Recommendation

Decision rule:
- **REDEEM** if cpp ≥ ₹0.55 per Bonvoy point or ₹0.40 per Honors point
- **PAY** if cpp ≤ ₹0.35 (Bonvoy) / ₹0.25 (Honors)
- **BLEND** if cpp is in between AND balance is constrained
- Always **PAY** when cash rate has elite-rate or AAA/Marriott Bonvoy member rate that's exceptional

Output:

```
{property} | {nights}n | {cash_total} cash | {points_total} pts | cpp ₹{X}
- 5th-night-free: yes/no, saves {N} pts
- Elite extras: breakfast ₹{Y}/day, lounge access
- Source balance: {user balance} → covers ✅ / requires top-up ❌
- Verdict: PAY / REDEEM / BLEND ({split})
- Reasoning: {one-line why}
```

Append to the trip's row in Travel Deals Tracker (columns `Hotel Points Cost`, `5th-Night-Free Saving`, `Hotel Recommended Path`).

## Failure Modes & Guardrails

- **Award availability check**: dynamic-priced does not equal always-available. Verify standard award space.
- **Don't ignore taxes/resort fees** on cash side — Hilton resort fees often applies even on award nights. Marriott award nights typically waive taxes outside the US.
- **Points expiry**: if user's Bonvoy/Honors points expire within 12 months, lean toward REDEEM.
- **Free-night certs**: if user has Marriott 35K/50K/85K free-night certs, evaluate using a cert before raw points.
- **Not enough balance**: never recommend redemption above current balance + transferable feeder pool.

## Triggering Modes

- **Per-property**: invoked once per shortlisted hotel.
- **Bulk**: when comparing 3 hotels for the same trip, summarize best path across all three.

See `references/award_charts.md` for typical points cost ranges by region/brand.
