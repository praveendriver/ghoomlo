---
name: itinerary-builder
description: Builds a day-by-day family itinerary for a chosen destination + date window. Balances food (Michelin / regional specialties / markets / cooking class), culture & heritage (museums, old town, guides), adventure & outdoor (kid-age-appropriate), wellness & slow travel (spa, nature, downtime), and authentic-shopping (artisan markets, regional craft). Family of 4 with kids ages 6 and 9 — paces by trip length (slow for 7+ days, balanced for 4-5 days). Use after the user has picked a destination + dates from the orchestrator.
icon: list-checks
color: Green
related_server_ids:
  - gsheets
---

# Itinerary Builder

## When to Use

Activate when:
- The user has confirmed destination + date window (typically Checkpoint 2 of [[plan-vacation]]).
- User asks "build me a day-by-day plan for {destination}".

Do NOT activate for:
- Destination selection ([[destination-curator]])
- Booking flights/hotels ([[travel-deals-finder]])

## Required Inputs

1. `destination`: city + country
2. `depart_date`, `return_date` (YYYY-MM-DD)
3. Travelers (default from `.workspace/user_travel_prefs.md`: 2 adults + kids 6, 9)
4. Theme weights (default: food + culture + adventure + wellness + shopping, all enabled). User can suppress any per run.

## Workflow

```
Itinerary Progress:
- [ ] Step 1: Compute pace + day count
- [ ] Step 2: Research anchor experiences per theme
- [ ] Step 2.5: Pull cached influencer corpus for verbatim quotes
- [ ] Step 3: Layout days (anchor + meal + downtime, with creator quotes inline)
- [ ] Step 4: Add reservations checklist
- [ ] Step 5: Write to tracker tab + return summary
```

### Step 1: Pace + Day Count

```
length = return_date - depart_date  (inclusive of return travel day)
if length >= 7:  pace = "slow"      (1 anchor activity per day)
elif length in [4,5,6]: pace = "balanced" (2 anchors/day, free evening)
else (length <=3): pace = "tight"   (2 anchors/day, no rest day)
```

Day 1 = travel-in. Last day = travel-out. Anchors only on full days.

### Step 2: Anchor Research (per theme)

For each theme below, surface 2-3 candidates with kid-suitability tagged.

**Window-specific weather** (do this once up front; affects every theme):
```
python3 scripts/api/weather_forecast.py --lat {LAT} --lon {LON} \
    --start {DEPART} --end {RETURN} --aqi
```
Use the daily output to flag rain-likely days (precip_prob > 50) for indoor backup, and AQI > 3 for masks/limited outdoor time.

**Food & dining**
- `Bash`:
  ```
  python3 scripts/api/foursquare_places.py --query "vegetarian" \
      --near "{city}, {country}" --kid-friendly --limit 15
  ```
  Use the `name`, `rating`, `price_tier`, `hours_today`, `address` fields. Falls back to `web_search`: `best restaurants {city} family friendly {month year} michelin` if Foursquare returns `[]` or thin results (tier-2 Indian cities).
- `web_search`: `regional specialties {city} {country} food markets`
- Always include 1 cooking class option if available (1-3 hr session, kid-OK).

**Culture & heritage**
- `Bash`:
  ```
  python3 scripts/api/foursquare_places.py --query "museum" \
      --near "{city}, {country}" --category museum --limit 10
  ```
  Repeat with `--category landmark` and `--category park`. Falls back to `web_search`: `top museums and heritage sites {city} kid friendly`.
- Include at least one local-guide option (private 3-4 hr walking tour).

**Adventure & outdoor (age-gated for 6/9)**
- Allowed for both kids: hiking <5km easy, snorkeling (calm water), cable car, wildlife/safari (vehicle), beach, ski-school for ages 6+.
- NOT recommended (note as "not for this trip"): scuba (min 10), heli-tours, ATV, white-water rafting class III+.

**Wellness & slow travel**
- One half-day "do nothing" / pool / spa block per 4 days.
- Family spa option if available.

**Shopping for authentic regional specialties**
- `Bash`:
  ```
  python3 scripts/api/foursquare_places.py --query "market" \
      --near "{city}, {country}" --category market --limit 10
  ```
  Then `web_search`: `artisan markets {city} regional craft authentic` for editorial picks Foursquare misses.
- Avoid generic mall recommendations. Tag items by craft type (textile / ceramic / metalwork / spice / etc.).

### Step 2.5: Influencer corpus + TripAdvisor cross-reference

For each candidate anchor (museum, restaurant, neighborhood, hotel), look up:

1. **Cached influencer corpus** — `trips/_shared/data/influencer-content.json`.
   - Find any item where `places_mentioned[].name` matches the anchor name
     (case-insensitive substring OK).
   - If found, capture the `quote`, `creator`, `url`, `sentiment`. These render
     as a `<blockquote class="influencer-quote">` inside the day-row HTML.
   - Drop quotes with `sentiment: "negative"` unless they're useful warnings.

2. **TripAdvisor ratings** (when key approved) —
   `python3 scripts/api/tripadvisor.py --query "{anchor}" --type {hotel|restaurant|attraction}`.
   Merge `rating + review_count + ranking` into the day-row metadata. If the
   script exits 1 (no key yet), fall back to the existing
   `python3 scripts/api/foursquare_places.py` + `/api/local` (Google Local) flow.

Both signals are **enrichments**, never gatekeepers. Pace rules and pricing
remain primary. Render the influencer quote as a subtle pull-quote, not a
headline.

### Step 3: Day Layout

Per day produce:
```
Day N — {weekday} {date}
Morning   : {anchor 1} (theme, ~Xhr, kid-rating)
Lunch     : {restaurant} ({cuisine}, ~₹/head)
Afternoon : {anchor 2 or downtime}
Dinner    : {restaurant or "hotel rest"}
Notes     : {transit time, reservation needed, weather backup}
```

Pace rules:
- Slow pace: morning anchor only; afternoon = downtime/pool. One "all-day" excursion every 3-4 days.
- Balanced: anchor morning + anchor afternoon. Evening free.
- Tight: anchor morning + anchor afternoon, fast lunch.

Always include a **weather backup** for outdoor anchors. Always include **walk distance** flags (>3km flat = annoying for the 6yo).

### Step 4: Reservations Checklist

For every anchor or restaurant that needs booking, list it separately with:
- What to book
- How far in advance
- Direct link / phone
- Cancellation policy if known

Output as a sub-section the user can act on independently.

### Step 5: Write to Sheet + Summary

1. New tab in Travel Deals Tracker: `Itinerary — {destination} {month}`.
2. Columns: `Day | Date | Time | Activity | Theme | Cuisine/Type | Cost Est (₹) | Booking Status | Notes`.
3. Append a `Reservations` block beneath the day-by-day rows.
4. Return a short summary to the user:
   > "Built {N}-day itinerary for {dest}. {pace} pace. {M} reservations needed (top 3: ...). Full tab in tracker."

## Failure Modes & Guardrails

- **Source uncertainty**: if a restaurant or activity isn't confirmed open at the time of travel, mark it `verify` rather than dropping it.
- **Age-inappropriate suggestion**: never include age-gated activities the 6yo can't do without a parent-only fallback for the rest of the family.
- **Over-packing**: if the layout exceeds the pace rule, drop the lowest-priority anchor and note it as "optional add-back".
- **Conflicting holidays at destination**: check whether destination holidays affect openings (museums often closed Mondays, Eid/Christmas closures). Use the `hours_today` field from `foursquare_places.py` first; if missing, fall back to `web_search`: `{museum/site} opening hours {date}`.

## Triggering Modes

- **Standalone**: user says "build itinerary for Lisbon Aug 13-17".
- **Chain**: invoked by [[plan-vacation]] after Checkpoint 2.

See `references/age_gates.md` for the kid-suitability quick reference and `references/pace_examples.md` for worked layouts.
