# Personal Travel Planner — Skill Suite

End-to-end vacation planner for a Bangalore-based family of 4 (kids ages 6 and 9). Optimizes for **enriching** trips (food, culture, adventure, wellness, regional shopping) and **cost-saving** (Marriott/Hilton 5-star, points + miles, fare history, budget envelope).

## Skill Map

```
                              [plan-vacation]   ← orchestrator
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
   [holiday-date-picker]   [destination-curator]   ─── checkpoint 1 ───
            │                        │                        │
            └───────────┬────────────┘                        ▼
                        ▼                          [travel-deals-finder]
                                                              │
                                                ┌─────────────┼─────────────┐
                                                ▼             ▼             ▼
                                  [points-miles-      [hotel-cash-      [fare-tracker]
                                   optimizer]          vs-points]
                                                              │
                                                              ▼
                                                     [budget-envelope]
                                                              │
                                                ─── checkpoint 2 ───
                                                              ▼
                                                     [itinerary-builder]
                                                              ▼
                                                    [trip-prep-checklist]
                                                              ▼
                                                       (trip happens)
                                                              ▼
                                                     [post-trip-logger]
```

## Skills

### Already built (original set)
- **holiday-date-picker** — picks 3 trip date windows in next 90 days around Indian/Karnataka holidays + school breaks; family-of-4 with school constraint.
- **destination-curator** — picks up to 3 destinations from wishlist + Conde Nast + TripAdvisor, scored by weather/events/12-month exclusion.
- **travel-deals-finder** — flights + 5-star Marriott/Hilton hotel scan; ranks top 3 per dest; writes to monthly tab; emails digest.
- **website-scraper** — generic content extractor stub.

### New (this session)
- **plan-vacation** — orchestrator: chains the existing skills + new ones with two user checkpoints.
- **itinerary-builder** — day-by-day plan tuned for kids 6/9; pace by trip length; food + culture + adventure + wellness + shopping.
- **points-miles-optimizer** — best award redemption across Star Alliance + OneWorld + Indian credit-card transfer partners.
- **hotel-cash-vs-points** — Marriott/Hilton paid vs award math; 5th-night-free; points + cash blends; elite extras.
- **fare-tracker** — daily cron + on-demand; logs snapshots; surfaces 3 baselines (30d median / lowest 6m / YoY); emails on drops.
- **budget-envelope** — per-category caps (default Lux ₹7L); projections, swap suggestions when over; in-trip + post-trip reconciliation.
- **trip-prep-checklist** — visa, vaccines, insurance, forex, eSIM, kid-aware packing, school leave letters, transfers.
- **post-trip-logger** — visit history, budget actuals, loyalty ledger, food highlights, itinerary feedback — closes the loop for future planning.

## Persistent Config

`/Users/malhar.gupta/projects/personal/travel agent/.workspace/`:
- `user_travel_prefs.md` — single source of truth for travelers, themes, budget caps, loyalty inventory, alert prefs.
- `travel_deals_tracker_url.txt` — written by `travel-deals-finder` on first run.
- `loyalty.md` — (to be created) detailed program memberships + balances; read by points-miles-optimizer + hotel-cash-vs-points.

The skills also use `/home/user/.workspace/` paths (their original convention). Mirror or symlink as needed.

## Single Google Sheet, Many Tabs

All persistence flows through one **Travel Deals Tracker** sheet:

| Tab | Owner skill | Purpose |
|---|---|---|
| `{Month Year}` | travel-deals-finder | Monthly deals scan output |
| `Visit History` | post-trip-logger | 12-month exclusion source |
| `Suggestion Log` | destination-curator | Tracks what was suggested |
| `Fare Watches` | fare-tracker | Active routes being tracked |
| `Fare History` | fare-tracker | Snapshot log |
| `Fare Alerts` | fare-tracker | Triggered alerts |
| `Budget` | budget-envelope | Caps + projected + actual per trip |
| `Trip Spend` | budget-envelope | Line-item actuals |
| `Budget Lessons` | post-trip-logger | Per-destination cap learnings |
| `Loyalty Ledger` | post-trip-logger | Earn/burn per trip |
| `Food Highlights` | post-trip-logger | Best/worst meals |
| `Itinerary Feedback` | post-trip-logger | What worked / didn't |
| `Itinerary — {Dest} {Month}` | itinerary-builder | Day-by-day plan |
| `Trip Prep — {Dest} {Month}` | trip-prep-checklist | Pre-trip todos |
| `Orchestrator Log` | plan-vacation | Phase audit |

## How to Run

End-to-end: invoke **plan-vacation** → it orchestrates everything with two user checkpoints (pick destination, pick booking option).

Single-skill: invoke any skill directly with its required inputs (each `SKILL.md` lists them).

## Source

`skills-src/<name>/` holds the editable markdown. The `.skill` bundles in this directory are zipped versions for distribution. Re-run from `skills-src/`:

```bash
cd skills-src/<name> && zip -r ../../<name>.skill . -x "*.DS_Store"
```
