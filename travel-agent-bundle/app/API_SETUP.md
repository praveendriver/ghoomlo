# API Setup Guide

Order of operations: **start with the free no-auth tier** (already wired in), then add free-signup APIs as you need depth, then SerpAPI when you want live fares + hotel rates.

Each entry has: what it gives you, exact signup steps, where the key goes, how to test, what file uses it.

---

## Tier 0 — Already integrated (no action needed)

These work in the browser today. No keys, no setup.

### ✅ Open-Meteo — weather forecasts
- **Endpoint**: `https://api.open-meteo.com/v1/forecast`
- **Why**: forecasted weather for the actual travel window (not climate averages)
- **Limits**: 10,000 requests/day, no auth
- **Used by**: rec cards (window-specific weather signal), itinerary builder
- **Test it**: open https://api.open-meteo.com/v1/forecast?latitude=9.93&longitude=78.12&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia/Kolkata&forecast_days=7 in your browser

### ✅ Overpass / OpenStreetMap — vegetarian restaurants + POIs
- **Endpoint**: `https://overpass-api.de/api/interpreter`
- **Why**: real veg restaurants near a hotel with `diet:vegetarian=yes` tag, opening hours where contributors filled them in
- **Limits**: rate-limited but no key. Be polite (1-2 req/sec, cache results).
- **Used by**: itinerary builder restaurant rows
- **Test it**: paste this URL — https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%3B(node%5B%22amenity%22%3D%22restaurant%22%5D%5B%22diet%3Avegetarian%22%3D%22yes%22%5D(around%3A1500%2C9.9195%2C78.1193)%3B)%3Bout%20body%2010%3B
- **Tradeoffs**: coverage is uneven — major Indian cities are well-tagged; tier-3 towns less so. Hours field exists but only ~30% of records have it.

### ✅ Wikipedia REST — destination summaries
- **Endpoint**: `https://en.wikipedia.org/api/rest_v1/page/summary/{Title}`
- **Why**: clean structured city/site summaries with thumbnails and a 1-line description
- **Limits**: no auth, very generous
- **Used by**: rec cards (fallback intro paragraph), itinerary anchors

### ✅ REST Countries — country metadata
- **Endpoint**: `https://restcountries.com/v3.1/name/{country}`
- **Why**: currency, languages, region — useful for prep checklist
- **Used by**: trip-prep auto-fill

### ✅ Frankfurter — currency conversion
- **Endpoint**: `https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR`
- **Why**: convert non-INR prices for budget envelope
- **Limits**: free, no auth, no rate limit on docs
- **Used by**: budget-envelope INR conversions

### ✅ Pexels CDN — destination imagery
- **No API call** — direct image URLs are stable. We harvest them once during page generation by visiting `https://www.pexels.com/search/<query>/`
- **Already used**: every rec card has a Pexels photo

---

## Tier 1 — Free with signup (3 minutes each)

### 🟡 Calendarific — Indian + Karnataka public holidays (Nager doesn't cover IN)
- **Why**: complements the TISB school cache with national/state holidays
- **Signup**: https://calendarific.com/signup → free tier = 1000 calls/month
- **Steps**:
  1. Sign up with email
  2. Confirm email → dashboard shows API key
  3. Copy key
  4. Add to `.workspace/secrets.local.md`:
     ```
     CALENDARIFIC_KEY=your_key_here
     ```
- **Test**: `curl "https://calendarific.com/api/v2/holidays?api_key=YOUR_KEY&country=IN&year=2026"`
- **Used by**: holiday-date-picker (replaces hardcoded Karnataka holidays)

### 🟡 Geoapify — places + geocoding (alternative to Overpass with hours)
- **Why**: cleaner places API than raw Overpass; restaurant hours more often filled in
- **Signup**: https://www.geoapify.com/ → free tier = 3000 requests/day
- **Steps**:
  1. Sign up with email
  2. Create a project → API keys page
  3. Add to secrets:
     ```
     GEOAPIFY_KEY=your_key_here
     ```
- **Used by**: itinerary builder (richer place metadata)
- **Tradeoff vs Overpass**: cleaner data but lower volume cap

### 🟡 Foursquare Places (Personalization API) — restaurant data with veg flags
- **Why**: well-curated restaurant database with photos, hours, ratings, popular dishes
- **Signup**: https://developer.foursquare.com → free tier = 100K calls/month
- **Steps**:
  1. Create developer account
  2. Create a project → get OAuth API key
  3. Add to secrets:
     ```
     FOURSQUARE_KEY=your_key_here
     ```
- **Used by**: itinerary builder (replaces Overpass for restaurants in well-covered cities)
- **Tradeoff**: India tier-2 coverage is mixed; combine with Overpass

### 🟡 OpenWeatherMap — current conditions + air quality
- **Why**: complements Open-Meteo with AQI (useful for Delhi/winter trips)
- **Signup**: https://openweathermap.org/api → free tier = 60 calls/min
- **Used by**: itinerary builder day-of weather + AQI signal
- **Note**: Open-Meteo + this is fine; you don't need both for forecasting alone

### 🟡 Pexels API key (for richer image search)
- **Why**: lets us script "find the top 5 photos of <city>" instead of one-off URL harvesting
- **Signup**: https://www.pexels.com/api/ → free tier = 200 requests/hour
- **Steps**:
  1. Sign up
  2. Generate API key
  3. Add to secrets:
     ```
     PEXELS_KEY=your_key_here
     ```
- **Used by**: rec card auto-image-refresh, itinerary cover images

---

## Tier 1.5 — Influencer ingestion (free signups)

The corpus builder fans out to YouTube/Instagram/blogs/TripAdvisor and writes `trips/_shared/data/influencer-content.json`. Each underlying script fails soft — no key just means that source is skipped.

### 🟡 YouTube Data API v3 — channel + video discovery
- **Why**: resolve `@handle` → channel ID, list recent uploads cheaply (1 unit/`playlistItems.list`)
- **Cost**: 10,000 units/day free
- **Signup**: https://console.cloud.google.com → create project → enable "YouTube Data API v3" → Credentials → API key
- **Add to** `.workspace/secrets.local.md`:
  ```
  YOUTUBE_API_KEY=your_key_here
  ```
- **Used by**: `scripts/api/youtube_discover.py`
- **Notes**: transcripts come from `youtube-transcript-api` (no key) and Whisper fallback (no key) — neither needs YouTube quota.

### 🟡 Brave Search API — blog discovery beyond the watchlist
- **Why**: find new travel blogs about a target destination that aren't in `.workspace/influencers.yaml`
- **Cost**: 2,000 queries/month free
- **Signup**: https://api.search.brave.com → register → subscription → free plan
- **Add to secrets**:
  ```
  BRAVE_KEY=your_key_here
  ```
- **Used by**: `scripts/api/brave_search.py`

### 🟡 TripAdvisor Content API — ratings + reviews
- **Why**: structured ratings + top reviews for hotels / restaurants / attractions surfaced by influencers
- **Cost**: 5,000 calls/month free (requires application + approval)
- **Signup**: https://www.tripadvisor.com/developers → "Get Started" → fill out the Content API form. Approval can take 1-2 weeks.
- **Add to secrets**:
  ```
  TRIPADVISOR_KEY=your_key_here
  ```
- **Used by**: `scripts/api/tripadvisor.py`. Until approval lands, callers fall back to the existing `/api/local` (SerpAPI Google Local) + Foursquare flow.

### 🟡 DeepL Free — high-quality EU language translation
- **Why**: argos-translate handles common pairs offline; DeepL is the higher-quality fallback for European languages on Wandering creators (Eva zu Beck, etc.)
- **Cost**: 500,000 characters/month free
- **Signup**: https://www.deepl.com/pro-api → "DeepL API Free"
- **Add to secrets**:
  ```
  DEEPL_KEY=your_key_here
  ```
- **Used by**: `scripts/api/translate.py` (only when argos can't handle the source language)

### 🟡 Instagram (throwaway login)
- **Why**: `instaloader` requires an authenticated session for reliable post fetching; use a *separate* account, not your primary one
- **Cost**: free; respect rate-limits (script sleeps 6-10s between posts, caps 20 posts/run/handle)
- **Setup**:
  1. Create a fresh Instagram account (separate email, mobile-confirmed)
  2. Add to secrets:
     ```
     INSTAGRAM_USER=your_throwaway_handle
     INSTAGRAM_PASS=your_throwaway_password
     ```
  3. Sessions are cached at `.workspace/.influencer-cache/instagram/<user>.session` (gitignored)
- **Used by**: `scripts/api/instagram_creator.py`

### 🟢 No-key sources (also part of the pipeline)
- **`youtube-transcript-api`** — pulls captions when available; no key
- **`yt-dlp` + `faster-whisper` `small` CPU** — caption-less video fallback; one-time 460MB model download
- **`feedparser` + `trafilatura`** — blog RSS/Atom + body extraction
- **`argos-translate`** — offline translation, primary translator
- **Social Blade** — public-page scrape with 7-day cache + 5s sleep, no key needed

### Corpus build
Once any subset of the keys above is set, run:
```
python3 scripts/influencers/corpus_builder.py --full --max-per-source 8 --skip-instagram
```
or schedule the wrapper:
```
bash scripts/run-influencer-corpus.sh
```

---

## Tier 2 — Paid (sign up if you want live fare snapshots)

### 🔴 SerpAPI — Google Flights + Hotels + Maps + Local
- **Why**: fixes ~70% of remaining "verify on Maps" placeholders. Live fares with booking tokens. Real Google Maps places data with hours/photos/reviews/popular times.
- **Cost**:
  - $0/mo for 100 free searches (gets you started)
  - $75/mo for 5,000 searches (covers ~10 trip plans/month)
  - $150/mo for 15,000 searches
- **Signup**: https://serpapi.com/users/sign_up
- **Steps**:
  1. Sign up (free 100 searches without credit card)
  2. Dashboard → "Your private API key" → copy
  3. Add to secrets:
     ```
     SERPAPI_KEY=your_key_here
     ```
- **Test it**:
  ```
  curl "https://serpapi.com/search.json?engine=google_flights&departure_id=BLR&arrival_id=NRT&outbound_date=2026-12-15&return_date=2026-12-22&adults=4&currency=INR&api_key=YOUR_KEY"
  ```
- **Used by**:
  - travel-deals-finder (live fare snapshots, replaces estimate ranges)
  - itinerary builder (Maps places with hours + dishes via Google reviews)
  - hotel-cash-vs-points (live hotel rates for paid vs award math)

### 🔴 Amadeus Self-Service APIs
- **Why**: alternative to SerpAPI for flights + hotels + airport transfers. Enterprise-grade data.
- **Cost**: free dev tier = 2,000 calls/month total across endpoints; paid scales up
- **Signup**: https://developers.amadeus.com/register
- **Steps**:
  1. Register → My Self-Service Workspace
  2. Create app → get API Key + API Secret (OAuth client credentials)
  3. Add to secrets:
     ```
     AMADEUS_CLIENT_ID=your_id
     AMADEUS_CLIENT_SECRET=your_secret
     ```
- **Verdict**: pick **either** SerpAPI or Amadeus, not both. SerpAPI is simpler; Amadeus has cleaner schemas.

### 🔴 Kiwi.com Tequila — virtual interlining
- **Why**: cheap multi-airline routings (e.g., BLR → DOH → CDG vs BLR → DXB → CDG).
- **Cost**: free dev = 100 req/day
- **Signup**: https://tequila.kiwi.com/portal/login/signup
- **Verdict**: only worth it if you do a lot of long-haul comparison

### 🟢 (no cost, but install effort) skarlekar/mcp_travelassistant
- **Why**: an MCP server bundling several travel APIs into one tool surface for Claude
- **Cost**: $0 + the underlying API costs (Amadeus, etc.)
- **Setup**:
  1. `git clone https://github.com/skarlekar/mcp_travelassistant ~/code/mcp_travelassistant`
  2. Read its README — most paths require Amadeus credentials anyway
  3. Add to `~/.claude/mcp_settings.json` (project-scoped) per its install guide
  4. Restart Claude Code, run `/mcp` to verify it's loaded
- **Verdict**: try this once you have Amadeus keys. Skip for now.

---

## Where keys live

Single file: `.workspace/secrets.local.md`

```
# Yatra travel agent — local secrets
# Never commit this file.

CALENDARIFIC_KEY=
GEOAPIFY_KEY=
FOURSQUARE_KEY=
OPENWEATHER_KEY=
PEXELS_KEY=
SERPAPI_KEY=
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=
KIWI_KEY=
YOUTUBE_API_KEY=
BRAVE_KEY=
TRIPADVISOR_KEY=
DEEPL_KEY=
INSTAGRAM_USER=
INSTAGRAM_PASS=
```

---

## Recommended sequence

1. **Today** (already done): Open-Meteo, Overpass, Wikipedia, Frankfurter — wired into hub + trip pages.
2. **This week** (3 minutes): sign up for Calendarific (free) — get IN holidays.
3. **This month** ($75): SerpAPI — biggest single accuracy win for fares + restaurants + hotels.
4. **Optional**: Geoapify + Foursquare for richer places data.
5. **Skip indefinitely**: Sabre.

---

## How each integration plugs in

The browser-side hub uses two helper files in `_shared/data-sources.js`:

- `Weather.fetch(lat, lon, fromDate, toDate)` — Open-Meteo
- `Restaurants.search(lat, lon, query, dietVeg)` — Overpass primary, Foursquare fallback if key set
- `Currency.convert(amount, from, to)` — Frankfurter
- `Places.summary(title)` — Wikipedia
- `Holidays.list(country, year)` — Calendarific (returns empty if no key)

For server-side / Claude Code orchestrator skills, the same APIs are reachable via `WebFetch` or future MCP integration.

---

## Free API CLI scripts (used by skills)

The skills shell out to small Python wrappers in `scripts/api/`. Each reads keys from `.workspace/secrets.local.md` (this file) and prints normalized JSON to stdout. If a key is missing the script exits 1 with a clear stderr message and the calling skill falls back to `web_search`.

| Script | Needs | One-line test |
|---|---|---|
| `_lib.py` | — | `python3 scripts/api/_lib.py` (prints loaded key names) |
| `amadeus_flights.py` | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` | `python3 scripts/api/amadeus_flights.py --origin BLR --dest NRT --depart 2026-12-15 --return 2026-12-22 --adults 2` |
| `amadeus_hotels.py` | same | `python3 scripts/api/amadeus_hotels.py --city TYO --checkin 2026-12-15 --checkout 2026-12-22 --chain MC,HH --rating 5` |
| `calendarific_holidays.py` | `CALENDARIFIC_KEY` | `python3 scripts/api/calendarific_holidays.py --country IN --year 2026 --location KA` |
| `foursquare_places.py` | `FOURSQUARE_KEY` | `python3 scripts/api/foursquare_places.py --query "vegetarian" --near "Madurai, India" --kid-friendly` |
| `weather_forecast.py` | none (AQI uses `OPENWEATHER_KEY`) | `python3 scripts/api/weather_forecast.py --lat 35.68 --lon 139.69 --start 2026-06-01 --end 2026-06-07 --aqi` |
| `youtube_discover.py` | `YOUTUBE_API_KEY` | `python3 scripts/api/youtube_discover.py --handles @tanyakhanijow --since 2025-01-01 --max 5` |
| `youtube_transcript.py` | none (Whisper fallback uses local CPU) | `python3 scripts/api/youtube_transcript.py --video-id dQw4w9WgXcQ` |
| `translate.py` | none (DeepL fallback uses `DEEPL_KEY`) | `python3 scripts/api/translate.py --text "Tokyo wa subarashii" --from ja --to en` |
| `blog_feed.py` | — | `python3 scripts/api/blog_feed.py --feed https://www.nomadicmatt.com/feed/ --max 3` |
| `brave_search.py` | `BRAVE_KEY` | `python3 scripts/api/brave_search.py --query "vegetarian Tokyo blog" --count 5` |
| `tripadvisor.py` | `TRIPADVISOR_KEY` | `python3 scripts/api/tripadvisor.py --query "Hyatt Regency Hakone" --type hotel` |
| `social_blade.py` | — | `python3 scripts/api/social_blade.py --handle @tanyakhanijow` |
| `instagram_creator.py` | `INSTAGRAM_USER`, `INSTAGRAM_PASS` | `python3 scripts/api/instagram_creator.py --handle bruisedpassports --max 3` |
| `influencers/corpus_builder.py` | optional (any of the keys above) | `python3 scripts/influencers/corpus_builder.py --for-destination Tokyo --max-per-source 3` |

The browser-side `server/proxy.py` exposes the same APIs at `/api/amadeus/flights`, `/api/amadeus/hotels`, `/api/foursquare/places`, `/api/weather`, `/api/youtube/transcript`, `/api/tripadvisor`, and `/api/influencer-content` so trip pages stay aligned with the CLI.

---

## Privacy note

- All Tier 0 APIs are anonymous — no cookies, no user-identifying data goes out.
- Tier 1 + 2 keys are tied to a free or paid account on each provider. Use a separate email if you want to keep it siloed from your primary inbox.
