---
name: holiday-date-picker
description: Picks 3 travel date windows from Bangalore for the next 3 months, optimizing around Indian national holidays, Karnataka state holidays, school term breaks, and office holidays. Bridges single-day holidays with weekends to build 4-day long weekends with 1 day of PTO; uses spring/summer/winter school breaks for 5-7 day trips. Always asks the user for blackout dates before recommending. Outputs depart/return date pairs with rationale, ready for travel-deals-finder. Use when the user asks for travel date ideas, monthly trip windows, or long-weekend options.
icon: calendar-days
color: Blue
---

# Holiday Date Picker

## When to Use

Activate when the user wants:
- Travel date suggestions for the next 3 months
- Long-weekend trip windows around Indian / Karnataka holidays
- Date options aligned with school breaks
- Inputs to feed into `destination-curator` or `travel-deals-finder`

Do NOT activate for:
- Picking destinations (`destination-curator`)
- Researching flight/hotel costs (`travel-deals-finder`)

## Required Inputs

Resolve in this order. Persist anything stable in `/home/user/.workspace/`:

| Input | Source | Storage |
|---|---|---|
| Look-ahead window | Always today → today + 3 months | computed each run |
| Indian national + Karnataka holidays | Web search (see `references/sources.md`) | computed each run |
| School name(s) | Ask user once | `/home/user/.workspace/school_names.txt` |
| School holiday calendar URL | Ask user once (optional) | `/home/user/.workspace/school_holidays_url.txt` |
| Office holiday calendar URL | Ask user once (optional) | `/home/user/.workspace/office_holidays_url.txt` |
| Blackout dates | Ask user **each run** | passed in per run |

If a URL is missing, fall back to `web_search` using the school/company name + "term dates" or "holiday calendar".

## Workflow

```
Date Picker Progress:
- [ ] Step 1: Resolve user context (schools, offices, blackouts)
- [ ] Step 2: Gather holiday data for the 3-month window
- [ ] Step 3: Identify long weekends and break windows
- [ ] Step 4: Apply blackout filter
- [ ] Step 5: Score and pick top 3 with rationale
```

### Step 1: Resolve User Context

**First read** `/home/user/.workspace/user_travel_prefs.md` for persistent rules (e.g., "kids must not miss school"). Apply those as hard constraints throughout — for the kids-in-school rule, treat every school day as a blackout day, so PTO-bridge patterns are only valid when the bridge day is also a school holiday.

1. Read persisted files from `.workspace/`. If any are missing, ask the user (one focused question per missing item):
   - "Which school(s) should I check for term dates?"
   - "Do you have a direct URL for your school's holiday calendar? (optional)"
   - "Any direct URL for your office holiday calendar? (optional — share company name if not)"
2. **Always ask each run**: "Any blackout dates in the next 3 months I should avoid?"
3. Default location context: **Bangalore, Karnataka, India**.

### Step 2: Gather Holiday Data

Compute the window: `start = today`, `end = today + 90 days`.

Fetch holidays from multiple sources for accuracy:

1. **Indian national + Karnataka holidays**:
   - **API-first**: `Bash`:
     ```
     python3 scripts/api/calendarific_holidays.py --country IN --year {YEAR} --location KA
     ```
     Returns `[{date, name, type, scope, description}]` for both national + Karnataka-state holidays in one call. If the window crosses a year boundary, run twice and concatenate.
   - **Fallback** (if Calendarific key missing or returns `[]`):
     - `web_search`: `India public holidays {month year} Karnataka`
     - `web_search`: `Karnataka government holidays {year}`
     - Cross-reference at least 2 sources before accepting a date. See `references/sources.md` for trusted sites.
2. **Hindu / regional festivals** (often state-specific):
   - Calendarific output covers most movable festival dates (Ganesh Chaturthi, Dussehra, Diwali, Eid, Good Friday) — check there first.
   - `web_search`: `Karnataka festivals {month year} holiday` only for items Calendarific misses (very local observances).
3. **School term dates**:
   - If URL provided → `web_fetch` it.
   - Else → `web_search`: `{school_name} term dates {year}` or `{school_name} school holidays {year}`.
   - Capture: spring break, summer break, autumn/mid-term, winter break.
4. **Office holidays**:
   - If URL provided → `web_fetch` it.
   - Else → `web_search`: `{company_name} India holiday calendar {year}` (often unavailable; fall back to national + state list).

Build a unified list: `[{date, name, type: national|state|festival|school_break|office}]`.

### Step 3: Identify Long Weekends and Break Windows

For each holiday in the window, check the day of week and bridge with weekends:

| Holiday falls on | Strategy | Trip pattern (depart → return) | PTO |
|---|---|---|---|
| Friday | Depart Thu evening | Thu → Sun (4 days, 3 nights) | 0 |
| Monday | Depart Fri evening | Fri → Mon (4 days, 3 nights) | 0 |
| Tuesday | Bridge Mon | Fri → Tue (5 days, 4 nights) | 1 |
| Thursday | Bridge Fri | Thu → Sun (4 days, 3 nights) | 1 |
| Wednesday | Bridge Mon-Tue OR Thu-Fri | 5-day option | 2 |
| Saturday/Sunday | Limited bridge — skip unless 2 holidays cluster | — | — |

For school break windows (e.g., 7-day summer/spring/winter break overlapping the window):
- Propose a 5-7 day trip aligned with the break.
- Departure preferred: night before the break starts (e.g., depart Fri evening if break begins Sat).
- PTO calculation = weekdays in the trip span minus holidays minus break days.

**Departure timing rule**: when a holiday starts on day X, departure date = X − 1 (depart the previous evening). Capture as the depart date (booking flights for evening of X−1).

### Step 4: Apply Blackout Filter

Remove any candidate window where the trip span overlaps a user-supplied blackout date by even one day. If a candidate is partially blocked, do not try to truncate — drop it and move on.

### Step 5: Score and Pick Top 3

Score each candidate (higher is better):

| Signal | Points |
|---|---|
| Length 4 days (long weekend, 0 PTO) | +5 |
| Length 5 days (1 PTO bridge) | +6 |
| Length 6-7 days (school break aligned) | +7 |
| Length 8-10 days (major break + bridge) | +5 (high PTO cost penalty kicks in) |
| Each PTO day required | −1 |
| Aligns with a major festival worth experiencing somewhere | +2 |
| Includes school break (family-friendly) | +2 |
| Departs Thu / Fri evening (preferred) | +1 |

Pick top 3 with **length variety** when possible: ideally one short (4d), one medium (5-6d), one longer (7d+). If the calendar only supports short windows, return what's available.

If fewer than 3 windows qualify, return what's available and note it.

## Output Format

Return a Python-readable list:

```python
date_options = [
    {
        "depart": "2026-08-13",        # YYYY-MM-DD
        "return": "2026-08-17",
        "nights": 4,
        "length_days": 5,
        "pto_days": 1,
        "rationale": "Independence Day (Fri 15 Aug) + bridge Mon 17 Aug. Depart Thu evening 13 Aug."
    },
    {
        "depart": "2026-09-11",
        "return": "2026-09-14",
        "nights": 3,
        "length_days": 4,
        "pto_days": 0,
        "rationale": "Ganesh Chaturthi (Mon 14 Sep) — natural long weekend. Depart Fri evening."
    },
    {
        "depart": "2026-10-15",
        "return": "2026-10-21",
        "nights": 6,
        "length_days": 7,
        "pto_days": 2,
        "rationale": "School autumn mid-term break + Dussehra. Family-friendly window."
    }
]
```

Plus a short user-facing summary:
> "Picked 3 windows for the next 3 months: 4-day Independence Day weekend (1 PTO), 4-day Ganesh Chaturthi long weekend (0 PTO), 7-day school autumn break (2 PTO). All clear of your blackout dates."

## Failure Modes & Guardrails

- **Holiday source disagreement**: if 2 sources disagree on a date, prefer the **government source** (mha.gov.in, karnataka.gov.in, or the user's office calendar). Note the conflict in the rationale.
- **No school name yet**: ask once, but don't block — proceed with national + state + office data and tell the user school breaks are unavailable until they share the school.
- **All windows blacked out**: return zero options and explain. Do not invent windows.
- **Movable festivals**: Hindu/Islamic dates shift yearly. Always verify with current-year sources, never assume last year's date.
- **Never depart same-day as the holiday**: always depart the **evening before** the first day off.
- **Karnataka-specific holidays** (e.g., Karnataka Rajyotsava on 1 Nov) must be included — not just national ones.

## Triggering Modes

- **One-off**: user asks "what are good travel dates in the next 3 months" → run end-to-end.
- **Monthly chain**: invoked first in the chain, output flows into `destination-curator` and then `travel-deals-finder`.

See `references/sources.md` for trusted holiday data sources and `references/long_weekend_patterns.md` for worked examples.
