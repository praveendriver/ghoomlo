---
name: trip-prep-checklist
description: Generates a destination-specific pre-trip checklist for the family of 4 — visas, vaccinations, travel insurance, forex/cards, eSIM/data, packing list (kid-aware for ages 6 and 9), school leave letters, lounge access, transfer arrangements. Includes deadline-aware items (visa lead times, immunization schedules). Writes to a Trip Prep tab in the Travel Deals Tracker. Use after itinerary is locked, ~6 weeks out from departure.
icon: clipboard-check
color: Red
related_server_ids:
  - gsheets
  - gmail
---

# Trip Prep Checklist

## When to Use

- After [[itinerary-builder]] has finalized the trip
- Typically 4-8 weeks before departure (some items have longer lead times)
- User asks "what do I need to do before {trip}?"

## Required Inputs

1. `trip_id`, `destination_country`, `depart_date`, `return_date`
2. Travelers (default: family of 4 — 2 adults Indian passport + 2 kids ages 6, 9 Indian passport)
3. School name(s) for leave letters

## Workflow

```
Trip Prep Progress:
- [ ] Step 1: Visa lookup
- [ ] Step 2: Vaccination + health
- [ ] Step 3: Insurance
- [ ] Step 4: Money + cards
- [ ] Step 5: Connectivity (eSIM / data)
- [ ] Step 6: Packing list
- [ ] Step 7: School + work paperwork
- [ ] Step 8: Airport + transfers
- [ ] Step 9: Write tab + email reminder
```

### Step 1: Visa

`web_search`: `India passport visa requirements {country} family of 4`. Capture per traveler:
- Visa needed? (none / on-arrival / e-visa / sticker / pre-clearance)
- Lead time (typical processing days)
- Documents required (photos, ITRs, hotel bookings, cover letter)
- Fee per person in INR

If lead time + buffer > days-until-departure, flag URGENT.

### Step 2: Vaccination + Health

`web_search`: `travel vaccinations {country} India CDC requirements`. List:
- Required (e.g., yellow fever certificate for some)
- Recommended (typhoid, hep A, MMR boosters)
- Kid-specific schedule check (especially for 6yo with possibly incomplete boosters)
- Malaria prophylaxis if relevant

Always recommend a GP/travel-clinic visit ≥4 weeks pre-trip.

### Step 3: Insurance

- Single-trip family policy quote: ICICI Lombard / TATA AIG / Care / Bajaj Allianz
- Key inclusions: medical evacuation, COVID coverage, baggage, trip cancellation
- Schengen/USA destinations have minimum coverage thresholds — flag these
- Existing card-included insurance (HDFC Infinia / Amex Plat) — verify coverage; usually need to supplement for family

### Step 4: Money + Cards

- Forex card recommendation: Niyo, BookMyForex, IndusInd, etc. — current best rates via `web_search`
- Cash to carry: ~$200 equivalent local currency for first 24 hr
- Notify primary credit cards of travel (online via app for most)
- Confirm zero/low forex markup card to lead with (Infinia / Magnus / Reserve depending on user's wallet)

### Step 5: Connectivity

- eSIM options: Airalo / Nomad / Holafly + carrier roaming compare
- Pick: 1 line for a parent (primary), shared with family via hotspot
- Indian roaming pack sometimes cheapest on Jio/Airtel for short trips — compare

### Step 6: Packing List

Kid-aware list (ages 6, 9). Generate from a template tailored to:
- Climate at destination — run:
  ```
  python3 scripts/api/weather_forecast.py --lat {LAT} --lon {LON} \
      --start {DEPART} --end {RETURN} --aqi
  ```
  Use `temp_max_c` / `temp_min_c` to pick layers, `precip_prob` to decide rain gear, `aqi_avg` ≥ 4 to add masks. Falls back to `web_search` weather for travel month if Open-Meteo errors (e.g., dates out of forecast horizon).
- Activity profile from itinerary (beach gear, ski layers, formal dinner)
- Standard family must-haves

Sub-sections:
1. Documents (passports, OCI, visa printouts, insurance card, school leave letter, hotel confirmations, return ticket printout)
2. Health (kid medicines, ORS, paracetamol, sunscreen kid-safe, insect repellent, hand sanitizer, first-aid mini)
3. Electronics (universal adapter for the country, multi-USB, charging cables, power bank ≤100Wh, kid tablet)
4. Clothes (climate-specific layered list)
5. Kid-specific (small bag for cabin, comfort toy, snacks for flight, motion sickness band/medicine for 6yo)
6. Activity gear (per itinerary anchors)

### Step 7: School + Work Paperwork

- School leave letter — generate a draft (date range, parent contact, makeup-work plan). Tab the user can copy from.
- Out-of-office for the working adult(s) — reminder to set 1 week before departure.

### Step 8: Airport + Transfers

- BLR airport: lounge access (Plaza Premium / domestic vs international terminal — depends on card). Confirm guests count.
- Pre-book airport drop (Uber Reserve / Mybyk / car service).
- Confirm arrival transfer at destination — hotel pickup vs taxi vs metro.
- Family-of-4 luggage allowance check — multiply baggage limit.

### Step 9: Write Tab + Email

`Trip Prep — {destination} {month}` tab. Schema:
```
Category | Item | Owner | Deadline | Status | Notes
```

`Owner` = adult-1 / adult-2 / "shared". `Status` defaults to `Todo`.

Send an email to malhar.gupta@gmail.com with the **top 5 deadlines** by date so it's actionable on phone.

## Deadline Priority Heuristics

| Item | Lead time |
|---|---|
| Visa (sticker) | 4-8 weeks |
| Visa (e-visa) | 1-2 weeks |
| Yellow fever / specific vaccines | 4-6 weeks (some need 2 doses) |
| Insurance | 2-4 weeks (some Schengen embassies want it for visa) |
| Forex card top-up | 1-2 weeks |
| eSIM purchase | 1 week (digital, can be later) |
| Packing | day before |
| School leave letter | 2 weeks |

If any deadline is already passed, mark URGENT and surface in red in the email.

## Failure Modes & Guardrails

- **Don't quote visa rules from old sources** — embassy site preferred. If it's an unusual destination, ask the user to confirm with the embassy/VFS.
- **Vaccines for kids**: never recommend dosing; always say "check with pediatrician using {country}'s vaccine list".
- **Insurance**: never recommend a specific policy without surfacing 3 options + key inclusions.
- **Don't auto-buy anything** — only generate the checklist and links.

## Triggering Modes

- Invoked by [[plan-vacation]] Phase 7.
- Standalone: "build prep checklist for {trip_id}".
- Re-run safe — overwrites the existing tab if invoked again (with a backup copy of prior).

See `references/visa_quick_lookup.md` for common destinations from India.
