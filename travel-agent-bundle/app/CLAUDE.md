# Yatra — personal travel agent: operating guide for any AI coding assistant

This file is the brain of the project. It works for Claude Code (as `CLAUDE.md`) and for
Cursor, Codex, Gemini CLI, etc. (as `AGENTS.md`). Read it fully before doing travel work.

## What this is

A personal travel-planning system for a Bangalore-based family. It does two things:

1. **Plans trips** through a chain of "skills" (instruction files) — dates → destination →
   deals → points → budget → day-by-day itinerary → prep checklist → post-trip log.
2. **Publishes each trip as a rich local web page** — maps, photos, an expandable day-by-day
   timeline, veg restaurants, shopping, and a printable PDF field guide.

The AI is the planner. Python scripts fetch data. A small local server shows the pages.

## Read these first, every time

| File | What it holds |
|---|---|
| `.workspace/user_travel_prefs.md` | Travellers, hard rules, budget caps, pace, themes. **Overrides everything.** |
| `.workspace/loyalty.md` | Hotel/airline/card balances and status. Update when the user gives new numbers. |
| `.workspace/secrets.local.md` | API keys (never print them, never commit). |
| `README.md` | Skill map (the planning chain). |
| `API_SETUP.md`, `INTEGRATIONS.md` | Which data APIs exist, keys, free tiers. |

## Hard rules (non-negotiable)

- **Never fabricate.** No invented restaurant names, hours, prices, flight numbers or links.
  If it can't be verified, say so and use a clearly labelled generic fallback.
- **Label trust on every fact** on trip pages: ✅ verified · ⚠️ unverified / conflicting ·
  ⛔ skip / not on this trip · `EST` estimate (drive times, budgets).
- **Diet: strict lacto-vegetarian.** No meat, fish, egg, fish stock, Maldive fish, dashi/bonito.
  Dairy is fine. Flag hidden-animal-ingredient hazards per cuisine. Non-veg-only famous places = "skip".
- **Hotels:** 5-star. Marriott Bonvoy (Titanium) first, Hilton (Gold) fallback; say so when neither exists.
- **Origin:** BLR. Prices in ₹.
- **Verify every link** you put on a page (HTTP 200, or mark "bot-blocked, unverified").
- **Visa/entry rules per traveller** — passports differ inside the family.
- **Talk to the user in plain English:** lead with the point in one sentence, short paragraphs,
  explain jargon, end with "so you should…". Use they/them for people unless told otherwise.

## Folder map

```
.workspace/            config + research working files (source of truth)
  user_travel_prefs.md, loyalty.md, secrets.local.md
  influencers.yaml     YouTube/Instagram creator watchlist
  *-extract-*.json, _consolidate.py, _resolve.py   creator-research pipeline (see below)
  .content-apis-cache/ .influencer-cache/          rebuildable caches
skills-src/<name>/SKILL.md   planning skills (also packed as <name>.skill zips at root)
  plan-vacation (orchestrator) · holiday-date-picker · destination-curator · travel-deals-finder
  points-miles-optimizer · hotel-cash-vs-points · fare-tracker · budget-envelope
  itinerary-builder · trip-prep-checklist · post-trip-logger
scripts/api/           data CLIs (JSON to stdout): amadeus, tripadvisor, brave, youtube, instagram,
                       foursquare, weather, holidays, translate, blog feeds, social blade
scripts/influencers/   corpus_builder.py + synthesizer.py → trips/_shared/data/synthesis-<city>.json
scripts/run-*.sh       scheduled jobs (fare tracker, influencer corpus, recommendations refresh)
server/proxy.py        serves trips/ at http://localhost:8889/ + /api/* proxy (keys stay server-side)
server/agent_runs.py   runs `claude -p` jobs for the in-page AI buttons (durable runs)
trips/index.html       the hub page listing all trips
trips/_shared/         shared CSS (style.css), site.js, trip-map.js, icons, claude-agent.js, data/*.json
trips/<yyyy-mm-slug>/  one folder per trip (index.html, images/, field guide md/html/pdf)
dumps/                 raw photo dumps (Japan)
```

## Start the site

```bash
python3 server/proxy.py        # then open http://localhost:8889/
```
A trip is at `http://localhost:8889/<trip-slug>/` (no `trips/` prefix — the server roots at `trips/`).

## How a trip page is built (the pattern to copy)

The Japan page (`trips/2026-07-tokyo-koyoto-and-other-famous/index.html`) holds the master
`<head>` with all component CSS. Newer trips (Goa, Sri Lanka) **reuse it** instead of copying CSS:

1. Write the trip-specific body in `trips/<slug>/_<name>_sections.html`
   (hero, photo strip, itinerary timeline, sights, shopping, veg dining, transport, before-you-go, scripts).
2. `trips/<slug>/_assemble.py` stitches: Japan `<head>` (lines 1–1155) with a new `<title>` →
   `<body data-trip-slug="<slug>">` → icon sprite (Japan lines 1158–1194) → sections → close tags.
   It ends with sanity asserts (title, sprite, both maps, map script, defaults).
3. Run `python3 _assemble.py`, then check `http://localhost:8889/<slug>/` returns 200.
4. Add/refresh the trip card in `trips/index.html`.

**Maps (`trips/_shared/trip-map.js`):**
- Mount points: `<div data-trip-map="itinerary">` and `<div data-trip-map="restaurants">`.
- Needs `window.YATRA_TRIP_DEFAULTS = { country:'LK', cities:[{name, lat, lon}, …] }`.
  Day titles must contain the city names so days pin to the right city.
- Restaurant pins: `.veg-card` elements with `data-lat`, `data-lon`, `data-name`, `data-map-scope="restaurants"`.

**Day timeline rows:** `<details class="day">` → `.day-head` (date, title, tags) → `.day-body` with
`.row` items (`.row-time`, `.row-icon`, `.row-content` with `.row-title` + text + `.link-chips`).
Each day must stand alone (transport, meals, warnings inline) so one day can be printed alone.

**Photos:** only free-to-use images (Wikimedia Commons etc.), saved to `trips/<slug>/images/`,
JPEG, ≤ ~1600px. Caption honestly when a photo shows something nearby rather than the place.

## Printable field guide (PDF)

`trips/<slug>/build_guide.py` turns `<NAME>-FIELD-GUIDE.md` → HTML → PDF.
- Uses **Playwright's Chromium** (`python3 -m playwright install chromium`). System Chrome 149
  hangs forever on print — don't switch back to the Chrome CLI.
- Fonts (Fraunces + Inter woff2) must exist in `images/fonts/` or headings fall back to Times.
- Must be readable in black-and-white: shapes/glyphs, never colour alone.
- Shrink photos: `sips -s format jpeg -s formatOptions 70 --resampleWidth 480 in.png --out out.jpg` (macOS).

## Creator research (YouTube + Instagram)

Tools live in `~/.claude/skills/content-apis/scripts/` (installed by setup; keys in its
`secrets.local.md`, or the project's `.workspace/secrets.local.md`, or env vars).

1. Find videos: YouTube Data API search (keep under ~3,000 quota units) and
   `youtube_discover.py --handles @a,@b --since 2024-01-01`. Watchlist: `.workspace/influencers.yaml`.
2. Transcripts: `youtube_transcript.py --video-id X [--whisper-fallback]`. Whisper needs **ffmpeg 7.x on PATH**
   (8.x breaks some audio; missing ffmpeg = silent empty output).
3. Instagram: `instagram_creator.py --handle X`. Password login is often blocked → run
   `instagram_session_import.py` with browser cookies. Don't loop retries.
4. Extract `{name, kind: place|eat|buy, city, note, veg_safety, sources[]}` into
   `.workspace/<trip>-social-extract.json`, consolidate (count distinct creators) into
   `<trip>-social-consolidated.json`, then mark each item: already in plan / fits route / off-route.
5. Cross-check restaurants with `tripadvisor.py --require-country XX --lat --lon` before recommending.

## Points & awards — learned lessons

- qatarairways.com often shows **no partner awards** (e.g. SriLankan). Search **ba.com** with the same Avios.
- Qatar (since Jun 2026) only books awards for people on your "My List" (30-day-old account).
- Air India has no BLR–CMB route and no Star Alliance partner flies India–Colombo.
- Always compare value per point vs cash before burning points; keep Avios for long-haul when value is low.

## Known gaps / gotchas

- The fare tracker isn't provisioned: the "Travel Deals Tracker" Google Sheet isn't set up and no
  Google account is connected, so `check` returns "no watches". Needs a Google Sheets connection first.
- Scheduled jobs (macOS launchd plists) call the `claude` CLI headlessly — `claude` must be on PATH and logged in.
- `.skill` files at the root are zipped copies of `skills-src/`; edit `skills-src/` and re-zip.
- Some skills mention `/home/user/.workspace/` (their original convention) — it means this project's `.workspace/`.

## Using this with a non-Claude AI

- The `skills-src/*/SKILL.md` files are plain Markdown instructions. Point your tool at the right
  one ("follow skills-src/itinerary-builder/SKILL.md") — nothing in them requires Claude.
- Things that DO need the Claude CLI: the in-page AI buttons (`server/agent_runs.py`,
  `trips/_shared/claude-agent.js`) and the scheduled `scripts/run-*.sh` jobs. To use another model,
  replace the `claude -p …` command in those files with your tool's headless command
  (e.g. `codex exec`, `gemini -p`) — the prompts are plain text.
- Claude-only references like "the culture-map agent" or "content-apis skill" just mean
  "read that folder's instructions and use its scripts".
