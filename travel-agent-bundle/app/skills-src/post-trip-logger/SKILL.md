---
name: post-trip-logger
description: After a trip, captures the visit (for the 12-month exclusion in destination-curator), reconciles spend vs budget, logs points earned/burned, and records what worked or didn't (food highlights, kid-friendliness, regrets). Closes the loop so future trips get smarter recommendations. Use within 1-2 weeks of returning.
icon: book-open
color: Brown
related_server_ids:
  - gsheets
---

# Post-Trip Logger

## When to Use

- User returns from a trip and says "log my trip" or "wrap up {trip_id}"
- Within ~2 weeks of return (later is fine but receipts get fuzzy)

## Required Inputs

1. `trip_id` (matches the planning row)
2. `destination`, `country`, `depart_date`, `return_date` (from Travel Deals Tracker)
3. User-narrated highlights / regrets (collected interactively)

## Workflow

```
Post-Trip Progress:
- [ ] Step 1: Append to Visit History
- [ ] Step 2: Reconcile budget actuals
- [ ] Step 3: Log loyalty earnings + burns
- [ ] Step 4: Capture food highlights
- [ ] Step 5: Capture itinerary feedback
- [ ] Step 6: Update wishlist + suggestion log
- [ ] Step 7: Email summary
```

### Step 1: Visit History

Append to `Visit History` tab (created by [[destination-curator]] if not present):
```
Destination | Country | Visit Date (return date) | Source (skill chain) | Notes
```

The 12-month exclusion in [[destination-curator]] reads from this tab — appending here is what closes the loop.

### Step 2: Budget Reconcile

Invoke [[budget-envelope]] in `reconcile` mode. Captures:
- Actual ₹ per category vs cap
- Variance per category
- Total variance
- 1-2 lessons (e.g., "food cap was 30% low for Tokyo — bump to ₹3,500/person/day next East-Asia trip")

Append lessons to the `Budget Lessons` tab. Future trip caps for the same destination should reference these.

### Step 3: Loyalty Ledger

`Loyalty Ledger` tab schema:
```
Date | Trip ID | Program | Direction (Earn/Burn) | Amount | Cash Equivalent ₹ | Notes
```

Capture:
- Bonvoy points earned (nights stayed × elite multiplier)
- Honors / airline miles earned
- Points burned (if redemption used)
- Cash-equivalent value computed at the redemption rates from [[points-miles-optimizer]] / [[hotel-cash-vs-points]]

This ledger answers "what's my real annual travel spend net of points?".

### Step 4: Food Highlights

Ask the user briefly: best meal, most disappointing meal, favorite food market, would-return-to restaurant. Append to `Food Highlights` tab:
```
Date | Destination | Restaurant | Cuisine | Vibe | Cost ₹ | Kid OK | Verdict | Would Return
```

### Step 5: Itinerary Feedback

Ask: which anchor experiences hit / missed? what would you cut? what was the right pace?

Append to `Itinerary Feedback` tab. [[itinerary-builder]] can read this to weight future suggestions for similar destinations.

### Step 6: Update Wishlist + Suggestion Log

- If a destination came from the wishlist: mark its `Status` = `Visited`.
- If new destinations surfaced organically during the trip ("we want to come back to do X"), append them to the wishlist.
- Mark all relevant rows in `Suggestion Log` (created by [[destination-curator]]) as `Visited`.

### Step 7: Email Summary

Send malhar.gupta@gmail.com a short trip recap:
- Trip card: dest, dates, travelers, total ₹ paid + points burned + points earned
- Top 3 food highlights
- Top 3 itinerary highlights
- 1-2 lessons for next trip
- Link to all tabs

## Failure Modes & Guardrails

- **Receipts incomplete**: log what you have, mark categories `partial` rather than guess.
- **Don't double-count**: if a meal was on a hotel resort plan or business card, capture but tag — don't blow the food category.
- **Don't share the email summary externally** — it's user-only.

## Output

> "Logged {trip_id}. Visit appended. Budget actuals: ₹{X} ({±%} vs cap). Earned {Y} Bonvoy pts. Lessons saved. Recap emailed."

## Triggering Modes

- Standalone: "wrap up {trip_id}".
- Optional final step of [[plan-vacation]] (post-return).
