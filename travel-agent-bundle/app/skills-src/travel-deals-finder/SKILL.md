---
name: travel-deals-finder
description: Researches flight + 5-star hotel options from Bangalore (BLR) for given destinations and date windows, prioritizing Marriott then Hilton properties. Produces a ranked tabular report (top 3 per destination), saves results to a monthly-sectioned Google Sheet tracker, and emails the report to a recipient. Use when the user asks for travel deal scans, monthly travel options, or fare/hotel reports from Bangalore.
icon: plane
color: Teal
related_server_ids:
  - gsheets
  - gmail
---

# Travel Deals Finder

## When to Use

Activate this skill when the user wants:
- A monthly travel deals report from Bangalore (BLR)
- Flight + 5-star hotel combos ranked by total cost
- Marriott / Hilton property options for membership rewards
- A Google Sheet tracker + email digest of options

Do NOT activate for:
- Curating destinations (that's a separate skill)
- Picking travel dates around holidays (that's a separate skill)

## Required Inputs

This skill assumes upstream skills/inputs provide:

1. **`destinations`**: list of destinations (city names, IATA optional)
2. **`date_options`**: list of `{depart_date, return_date}` pairs. Trip lengths vary (e.g., 3, 5, 7 days)
3. **`report_month`**: label for the sheet section, e.g. "May 2026"

Fixed parameters (do not ask the user):
- Origin: **Bangalore (BLR)**
- Travelers: **1 adult**
- Cabin: **all classes** (economy, premium economy, business — capture cheapest in each)
- Hotel: **5-star only**, Marriott brands first, Hilton brands second
- Nights: **trip length minus 1**
- Ranking: **total cost ascending**
- Options per destination: **top 3**
- Email recipient: `malhar.gupta@gmail.com`

## Workflow

```
Travel Deals Progress:
- [ ] Step 1: Validate inputs
- [ ] Step 2: Research flights for each destination × date combo
- [ ] Step 3: Research Marriott (then Hilton) hotels for each combo
- [ ] Step 4: Build ranked top-3 per destination
- [ ] Step 5: Update Google Sheet tracker (new section for the month)
- [ ] Step 6: Send email digest with table + sheet link
```

### Step 1: Validate Inputs

Confirm `destinations`, `date_options`, and `report_month` are present. If any is missing, ask the user before proceeding. Do not invent destinations or dates.

### Step 2: Flight Research

For each `(destination, depart_date, return_date)` combo:

**API-first**:
1. `Bash`:
   ```
   python3 scripts/api/amadeus_flights.py --origin BLR --dest {DEST_IATA} \
       --depart {DEPART} --return {RETURN} --adults {pax} --currency INR --max 5
   ```
   Re-run with `--cabin PREMIUM_ECONOMY` and `--cabin BUSINESS` to capture all three cabins.
2. From each JSON list, take the cheapest `price_total` per cabin.

**WebSearch fallback** (only if all three Amadeus calls return `[]` or error):
1. `web_search`: `flights Bangalore to {destination} {depart_date} return {return_date} cheapest`
2. `web_fetch` on Skyscanner / Google Flights / MakeMyTrip / Cleartrip for a range.

Always include a **direct booking link** in the output regardless of source:
- Google Flights: `https://www.google.com/travel/flights?q=Flights%20to%20{DEST}%20from%20BLR%20on%20{DEPART}%20through%20{RETURN}`
- Skyscanner: `https://www.skyscanner.co.in/transport/flights/blr/{DEST_IATA}/{YYMMDD_DEP}/{YYMMDD_RET}/?adults=1`

Capture: cheapest economy, cheapest premium-economy, cheapest business (if shown). If a class is unavailable in the data, mark `—`.

Reference: `references/url_templates.md` for exact URL formats and IATA lookup tips.

### Step 3: Hotel Research (Marriott → Hilton fallback)

For each combo, look for **5-star** properties. Check Marriott FIRST. Only fall back to Hilton if no Marriott property exists in that city.

**API-first**:
1. `Bash`:
   ```
   python3 scripts/api/amadeus_hotels.py --city {DEST_CITY_IATA} \
       --checkin {DEP_DATE} --checkout {RET_DATE} \
       --chain MC --rating 5 --adults 2 --rooms 1 --currency INR
   ```
   Filter the returned rows by Marriott's 5-star luxury brands first (see allowlist below).
2. If the Marriott call returns `[]`, retry with `--chain HH` for Hilton.
3. Use the cheapest matching row's `total` for hotel cost. The script's `total` is already nights × nightly rate for the date range.

**WebSearch fallback** (only if both Amadeus calls return `[]`):
1. `web_search`: `Marriott 5 star hotels in {destination} {month year}` to identify property names.
2. `web_fetch` on the search URLs below for an estimated per-night rate; multiply by `(trip_length - 1)` nights.

**Always include in output** (regardless of source) for the user to click through:
- Marriott search: `https://www.marriott.com/search/findHotels.mi?destinationAddress.destination={CITY}&fromDate={DEP_DATE}&toDate={RET_DATE}&numberOfRooms=1&numberOfAdults=1`
- Hilton search: `https://www.hilton.com/en/search/?query={CITY}&arrivalDate={DEP_DATE}&departureDate={RET_DATE}&numAdults%5B0%5D=1`

Marriott luxury 5-star brand allowlist: **Ritz-Carlton, St. Regis, JW Marriott, W Hotels, Marriott Hotels, Le Méridien, Westin, Renaissance, Sheraton, The Luxury Collection, Autograph Collection**.

Hilton 5-star brand allowlist: **Waldorf Astoria, Conrad, LXR, Hilton Hotels & Resorts, Signia**.

Always include the property name + the search link (not a fabricated hotel URL).

Reference: `references/hotel_brands.md` for the full Marriott/Hilton 5-star brand allowlists.

### Step 4: Rank Top 3 per Destination

For each destination, compute **total trip cost = cheapest_flight + total_hotel_cost** across all date options, then take the top 3 cheapest combos. If fewer than 3 viable combos exist, return whatever is available.

**Tie-breaker — influencer mentions**: when two combos are within ₹5K of each
other on total cost, prefer the property with creator mentions in the cached
corpus (`trips/_shared/data/influencer-content.json`). Look for the hotel name
in `places_mentioned[].name`; positive sentiment wins. Never override price or
loyalty footprint — this is a tie-breaker only.

### Step 5: Update Google Sheet Tracker

Use the gsheets server.

1. **First run only**: create the tracker.
   - `gsheets__create-sheet` with title `"Travel Deals Tracker"`. Save the URL — store it in `/home/user/.workspace/travel_deals_tracker_url.txt` so future runs reuse it.
2. **Every run**: add a new sheet tab named `{report_month}` (e.g. `"May 2026"`) via `gsheets__add-sheet`.
3. Write the data with `gsheets__batch-update`. Use these columns:

   | Destination | Depart | Return | Nights | Flight (Eco) | Flight (PE) | Flight (Biz) | Hotel Brand | Hotel Property | Hotel/Night | Hotel Total | Total Cost | Flight Link | Hotel Link |

4. Format the header row bold with `gsheets__format_cells` and freeze the first row (via header formatting). Apply currency formatting (`#,##0`) to cost columns.
5. Sort the data range by Total Cost ascending using `gsheets__sort_range`.

### Step 6: Email Digest

Use the gmail server (`gmail__send_email` or equivalent).

- **To**: `malhar.gupta@gmail.com`
- **Subject**: `Travel Deals — {report_month} (Top picks from BLR)`
- **Body** (HTML): include:
  1. One-line summary: "X destinations, Y date combos analyzed."
  2. **Table** with one row per top combo (Destination, Dates, Nights, Flight, Hotel, Total, Links).
  3. **Direct link** to the Google Sheet tracker, with a note: "See the `{report_month}` tab for the full breakdown."
  4. Reminder line: "All hotels are Marriott Bonvoy or Hilton Honors eligible 5-star properties."

Reference: `assets/email_template.html` for the HTML scaffold.

## Output Expectations

Produce:
1. New month-named tab in the Google Sheet tracker, populated and sorted
2. Email sent to `malhar.gupta@gmail.com` with HTML table + tracker link
3. A short conversation summary back to the user: "Sent {N} options across {M} destinations to malhar.gupta@gmail.com. Tracker: {url}"

## Failure Modes & Guardrails

- If `web_fetch` is blocked (CAPTCHA / 403), still emit the **search URLs** so the recipient can click through. Mark price as "Check link" rather than fabricating a number.
- Never invent flight numbers, hotel names, or exact prices. If unsure, give a range (`₹X–Y`) sourced from `web_search` snippets and label it as "estimated".
- If no Marriott AND no Hilton 5-star exists in a destination, mark hotel row as "No qualifying property" and skip that destination's hotel cost.
- Always quote prices in **INR (₹)**. Convert if a source returns USD using a same-day rate from web_search.
- Do not exceed 3 combos per destination in the email; full data lives in the sheet.

## Data Sources

Skill calls these wrappers (added in `scripts/api/`):
- `amadeus_flights.py` — Self-Service flight-offers, free 2K calls/mo. Requires `AMADEUS_CLIENT_ID` + `AMADEUS_CLIENT_SECRET`.
- `amadeus_hotels.py` — hotel-offers by city + chain code (`MC`=Marriott, `HH`=Hilton).
- WebSearch + WebFetch remain as automatic fallback when keys are missing or API returns nothing.

Optional upgrade for richer / live snapshots:
- **SerpAPI Google Flights / Hotels** ($75/mo for 5K searches) — wire into `server/proxy.py` (already templated) and switch the Bash calls to `curl localhost:8889/api/flights?...`.

Keys live in `.workspace/secrets.local.md`; see `API_SETUP.md`.
