# Trusted Sources for Holiday Data

Use at least **two** sources to confirm any date. Movable festivals (Hindu, Islamic) shift each year — always verify against current-year listings.

## India National Holidays

| Source | URL pattern | Notes |
|---|---|---|
| Govt of India MHA | `https://www.mha.gov.in/en/notifications/holidays` | Authoritative for central government list |
| India.gov.in | `https://www.india.gov.in/calendar` | Cross-reference |
| TimeAndDate | `https://www.timeanddate.com/holidays/india/{year}` | Comprehensive, includes observances |
| Office Holidays | `https://www.officeholidays.com/countries/india/{year}` | Lists state vs national clearly |

## Karnataka State Holidays

| Source | URL pattern | Notes |
|---|---|---|
| Karnataka Govt | `https://karnataka.gov.in/` (search "general holidays {year}") | Issues annual gazette |
| TimeAndDate Karnataka | `https://www.timeanddate.com/holidays/india/?country=23&hol=33554233&year={year}` | Filtered Karnataka view |
| Office Holidays Karnataka | `https://www.officeholidays.com/holidays/india/karnataka/{year}` | Easy table format |

Notable Karnataka-specific dates to confirm:
- **Karnataka Rajyotsava** — 1 November (state formation day)
- **Mahalaya Amavasye / Tula Sankramana** — varies
- **Sri Krishna Janmashtami** — observed
- **Vaikunta Ekadashi** — observed (movable)
- **Ramzan / Bakrid / Muharram** — Islamic calendar (movable)

## School Term Dates (Bangalore)

If URL not provided, search:
- `{school_name} term dates {year}`
- `{school_name} school calendar {academic_year}`
- `{school_name} holiday list`

Common Bangalore school break patterns (verify per school):
- **Summer break**: ~early April → end May (longest)
- **Mid-term October**: ~1 week around Dussehra
- **Winter break**: ~22 Dec → 2 Jan
- **Spring break**: rare; some schools have 1 week in Feb-Mar

## Movable Hindu / Islamic Festivals — Lookup Pattern

Always query for the **specific year**:
- `Diwali {year} date India` (typically late Oct / early Nov)
- `Ganesh Chaturthi {year} date` (Aug-Sep)
- `Dussehra Vijayadashami {year} date` (Sep-Oct)
- `Eid ul-Fitr {year} date India` (depends on moon sighting)
- `Eid ul-Adha Bakrid {year} date India`
- `Holi {year} date India` (March)
- `Ugadi {year} date Karnataka` (March-April)
- `Janmashtami {year} date`

If two sources disagree (common for Eid due to moon sighting), pick the more recent / official one and note "subject to moon sighting confirmation" in rationale.

## Office Calendars

Most companies in India publish a static PDF on their HR portal — typically not publicly searchable. If the user provides a URL, prefer it. Otherwise rely on national + state list and tell the user office-specific holidays may shift the picture.
