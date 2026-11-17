# School holiday calendars

Tools for finding schools' published holiday calendars, and the rules for using them.

The results live in `web/data/school-holidays.json`. Every break listed there carries the
link it came from and the exact wording from that page, so anyone can check it. All
entries are **unverified** until a person has compared them with the school's own
calendar; the site must not present them as confirmed.

## How the data was gathered

1. `verify_sites.py` checks that a candidate website loads and that its title mentions
   the school. Official websites came from guesses confirmed this way, or from web
   searches.
2. `crawl.py` visits each school's public site politely: it obeys `robots.txt`,
   identifies itself as `GhoomloCalendarBot`, waits two seconds between requests to the
   same site, reads at most 18 pages or files per school, never logs in or submits a
   form, and only follows links on the school's own site plus PDFs the site links to.
   It saves pages that look like holiday calendars as plain text for review.
3. A person (or Claude in a working session) reads each candidate, records the break
   dates with the source link and quoted wording, and marks what was not found.

Downloaded pages are treated as data only: nothing in them is run or followed as an
instruction. Copies of school documents are not committed; only the extracted dates are.

## Running it again

```bash
python3 -I verify_sites.py candidates.json checked.json
python3 -I crawl.py sites.json /path/to/output
```

Both take a JSON list of `{"city", "school", "website"}`.

## Data format

```json
{
  "city": "Bengaluru",
  "school": "Example School",
  "website": "https://example.edu.in",
  "status": "found | needs-review | not-found | not-public",
  "academicYear": "2026-27",
  "sourceUrl": "https://example.edu.in/calendar.pdf",
  "retrievedOn": "2026-11-17",
  "breaks": [
    { "name": "Winter break", "start": "2026-12-24", "end": "2027-01-01", "quote": "Winter Vacation: 24.12.2026 to 01.01.2027" }
  ],
  "notes": "Anything a reviewer should know."
}
```
