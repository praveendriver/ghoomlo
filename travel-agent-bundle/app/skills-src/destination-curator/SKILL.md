---
name: destination-curator
description: Curates up to 3 travel destinations from Bangalore for a given month or date window. Pulls candidates from the user's wishlist Google Sheet, Conde Nast Traveller, and TripAdvisor, then ranks them by weather (favoring shoulder season), notable events/festivals, and 12-month visit history. Outputs city + country + IATA + one-line rationale, ready to feed into travel-deals-finder. Use when the user asks "where should I go", wants monthly destination picks, or needs candidates before running a fare scan.
icon: compass
color: Orange
related_server_ids:
  - gsheets
---

# Destination Curator

## When to Use

Activate when the user wants:
- Travel destination ideas for a specific month or date window
- A monthly "where should I go next" pick
- Candidates to feed into the `travel-deals-finder` skill
- Shoulder-season recommendations or event-driven trip ideas

Do NOT activate for:
- Picking specific dates/holidays (separate skill)
- Looking up flights or hotels (`travel-deals-finder`)

## Required Inputs

1. **`travel_window`** — a target month or date range (e.g., "July 2026" or "2026-07-10 → 2026-07-20").
2. **`wishlist_sheet_url`** — the user's wishlist Google Sheet URL.
   - On the **first run**, ask the user for it. Store at `/home/user/.workspace/wishlist_sheet_url.txt` for reuse.
   - Expected wishlist columns (flexible): `Destination`, `Country`, `Notes`, `Priority` (optional).

Fixed parameters:
- Origin: **Bangalore (BLR)**
- Max destinations per itinerary: **3** (return fewer if signal is weak)
- Budget tier: **mid to luxury**
- Domestic + international both eligible
- Repeat allowed only after **12 months** since last visit

## Workflow

```
Destination Curator Progress:
- [ ] Step 1: Load wishlist + visit history
- [ ] Step 2: Gather external candidates (Conde Nast, TripAdvisor)
- [ ] Step 2.5: Pull cached influencer corpus (`trips/_shared/data/influencer-content.json`)
- [ ] Step 3: Score by weather, events, recency
- [ ] Step 4: Pick top 3 with rationale
- [ ] Step 5: Log picks to history tab
```

### Step 1: Load Wishlist + Visit History

1. Read the wishlist sheet URL from `/home/user/.workspace/wishlist_sheet_url.txt` if it exists. Otherwise ask the user and persist it.
2. Use `gsheets__batch-get` to read the wishlist (assume `Sheet1!A:D` unless user specifies).
3. Read the **Visit History** tab from the Travel Deals Tracker:
   - Tracker URL is at `/home/user/.workspace/travel_deals_tracker_url.txt` (created by `travel-deals-finder`).
   - If the tab doesn't exist, create it via `gsheets__add-sheet` with name `Visit History` and header row: `Destination | Country | Visit Date | Source | Notes`.
   - Read existing rows to identify destinations visited in the **last 12 months** relative to `travel_window` start date.
4. Build the candidate pool:
   - Start with all wishlist entries
   - Remove anything in the 12-month exclusion list

### Step 2: Gather External Candidates

Augment the wishlist with current editorial picks. Use `web_search` then `web_fetch` selectively.

1. **Conde Nast Traveller**:
   - Query: `site:cntraveller.com OR site:cntraveller.in best places to visit {month year}`
   - Also try: `site:cntraveller.in {month year} destinations India`
2. **TripAdvisor**:
   - Query: `site:tripadvisor.com best destinations {month year}`
   - Also: `tripadvisor travelers choice {year} {region}`
3. **Weather / shoulder season check**:
   - **Per-candidate forecast** (preferred): for each candidate already on the shortlist, run:
     ```
     python3 scripts/api/weather_forecast.py --lat {LAT} --lon {LON} \
         --start {window_start} --end {window_end}
     ```
     Use the returned daily highs/lows + precip to score: `temp_max_c` between 18-30 with `precip_prob` < 40 = shoulder-season-good.
   - **Editorial signal** (still useful for discovery, complements API): `web_search`: `best weather destinations {month year} shoulder season Asia Europe`. Prefer destinations explicitly described as "shoulder season", "off-peak", or "ideal weather" for the target month.
4. **Events & festivals**:
   - Query: `notable festivals events {month year} travel destinations`
   - Examples to surface: cherry blossoms (Mar-Apr Japan), Holi (Mar India), Oktoberfest (Sep-Oct Germany), Diwali (Oct-Nov India), Songkran (Apr Thailand), etc.

Capture for each external candidate: city, country, source URL, one-line reason.

### Step 2.5: Influencer corpus (cached, multi-source)

Read `trips/_shared/data/influencer-content.json` (generated weekly by
`scripts/influencers/corpus_builder.py`). For each candidate destination,
filter `items[]` where any `destinations[].name` matches the candidate.

Use the cached corpus to:
- Boost candidates with **3+ recent positive items** by +1 to the score
  (capped — does not override the visit-recency disqualifier).
- Promote a `veg_friendly: true` item over a vague editorial mention.
- Surface 2–3 verbatim quotes (creator + url) as `editorial_signals[]` on the
  recommendation, alongside the existing rationale lines.

Fallback: if the file is missing, empty, or older than 14 days, skip silently
and rely on the existing `web_search` Conde Nast / TripAdvisor flow above.
The pipeline must remain functional when the corpus is unavailable.

### Step 3: Score Candidates

For each candidate, compute a simple score (0-10):

| Signal | Weight | Notes |
|---|---|---|
| On user's wishlist | +4 | Strong preference signal |
| High priority on wishlist | +2 | If priority column flagged |
| Shoulder season / great weather in `travel_window` | +3 | Mark explicitly in rationale |
| Notable event/festival overlaps `travel_window` | +2 | Use exact event name in rationale |
| Featured in Conde Nast / TripAdvisor for the month | +1 | One source = +1, both = +2 |
| ≥3 positive influencer mentions in cached corpus | +1 | Bonus, capped at +1 — never overrides school/visit/loyalty signals |
| Visited in last 12 months | **disqualify** | Skip entirely |
| Last suggested by this skill within 3 months | -2 | Penalty, not disqualifier |

Filter out anything below score 4 unless the wishlist is small.

### Step 4: Pick Top 3 + Rationale

Output up to 3 destinations. Fewer is fine if signal is weak.

For each, return:

```
- City: <name>
- Country: <name>
- IATA: <code>  (use references/iata_quick_lookup.md or web_search if unknown)
- Why this month: <one sentence — weather, event, or wishlist context>
- Sources: [wishlist | cntraveller | tripadvisor | weather | event]
```

If domestic + international mix is naturally available, prefer mixing for variety. If wishlist priority dominates, follow that.

### Step 5: Log Picks to History

Append each suggested destination to the **Suggestion Log** tab in the Travel Deals Tracker:

1. If tab doesn't exist, create with header: `Suggested Date | Destination | Country | Travel Window | Score | Rationale | Status`.
2. Append a row per pick using `gsheets__append-values`. Set `Status` = `Suggested`.
3. The user manually updates `Status` to `Visited` and adds a row to `Visit History` after a trip.

## Output Format

Return a Python-readable list to the calling context:

```python
destinations = [
    {
        "city": "Tokyo",
        "country": "Japan",
        "iata": "NRT",
        "rationale": "Cherry blossom peak overlaps your window; on wishlist (priority).",
        "sources": ["wishlist", "event", "cntraveller"]
    },
    ...
]
```

Plus a short user-facing summary:
> "Picked 3 destinations for {travel_window}: Tokyo (cherry blossoms + wishlist), Lisbon (shoulder season + CN Traveller), Udaipur (festival overlap + wishlist). Logged to tracker."

## Failure Modes & Guardrails

- **Wishlist empty or unreachable**: proceed with external sources only and tell the user.
- **All wishlist entries within 12-month exclusion**: surface external picks and notify the user the wishlist was fully filtered out.
- **No tracker sheet yet**: skip the history filter, but warn that recency tracking is unavailable until the deals-finder runs once or the user provides a tracker URL.
- **Web sources blocked**: fall back to wishlist + general weather knowledge from `web_search` snippets only. Never fabricate festival dates or weather claims — if uncertain, omit that signal.
- **Fewer than 3 viable picks**: return what you have. Do not pad with weak choices.

## Triggering Modes

- **One-off**: user asks "give me 3 destinations for August" → run end-to-end with `travel_window=August 2026`.
- **Monthly chain**: invoked by the upstream scheduler / date-picker skill with a resolved `travel_window`. Output flows directly into `travel-deals-finder`.

Reference `references/scoring_examples.md` for worked scoring examples.
