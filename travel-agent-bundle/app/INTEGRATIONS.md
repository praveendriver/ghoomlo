# Travel Agent — Integration Roadmap

The current planner uses public web sources via WebFetch + WebSearch. This works for static content (CSVs, school PDFs, Wikipedia, weather averages) but **fails at most live data**: flight fares, hotel availability, restaurant hours, event tickets, traffic. Anti-bot protections on Skyscanner / Google Flights / Maps / Zomato block headless fetches.

Below is a prioritized list of integrations that would meaningfully improve plan accuracy. Each entry is graded on **value × cost × complexity**.

---

## Priority 1 — Will pay back fastest

### 1.1 SerpAPI — Google Flights + Google Hotels + Google Maps + Local
- **What it gives**: live flight fares with booking tokens, hotel rates with availability, Google Maps places (hours, ratings, reviews, photos), local-place searches.
- **Why it matters here**: would replace ~70% of the "verify on Maps" placeholders. Fixes restaurants, real fare snapshots, hotel rates without the anti-bot pain.
- **Cost**: $75/mo for 5K searches, $150/mo for 15K. Plenty for a personal agent.
- **Setup**: API key → 1 night to wire into a `serp_api_client.py` helper used by the orchestrator skills. Each itinerary build uses ~30-50 calls.
- **Tradeoffs**: pricing tier locks in. Not 100% coverage on small-town restaurants in India.
- **Action**: sign up at serpapi.com → store key in `.workspace/secrets.local.md` (gitignored) → patch `travel-deals-finder.skill` and `itinerary-builder.skill` to call SerpAPI's `google_flights` and `google_local` engines.

### 1.2 skarlekar/mcp_travelassistant
- **What it gives**: an MCP server bundling several travel APIs into one tool surface for Claude.
- **Why it matters here**: turns the orchestrator's "I'll fetch this" calls into typed MCP tool calls — no anti-bot, no parsing.
- **Cost**: free, but the underlying APIs (Amadeus, RapidAPI hotel feeds) often need their own keys.
- **Setup**: `git clone github.com/skarlekar/mcp_travelassistant` → wire into `~/.claude/mcp_settings.json` → enable per project → expect a 2-3 day spike to get all required upstream API keys + verify each tool returns useful data for Indian routes.
- **Tradeoffs**: maintenance is on a single individual; if that repo goes stale, you've coupled to it. Audit dependencies before committing.
- **Action**: clone + read its README + run a `claude --mcp travelassistant` session with a one-off "show me BLR↔NRT for July 2026" prompt; if it works, wire it in.

### 1.3 Pexels CDN (already integrated)
- **What it gives**: free, openly-licensed destination imagery via predictable URL patterns.
- **Status**: ✅ now used on recommendation cards. Each rec carries `image: "https://images.pexels.com/photos/.../..."`.
- **Cost**: free. Attribution noted in the JSON.
- **Future**: extend to itinerary cover images (per-trip hero) and per-day landmark photos (e.g., "Meenakshi Temple"). Each search via `pexels.com/search/<query>/`.

---

## Priority 2 — Worth doing if/when you fly more

### 2.1 Sabre Dev Studio — fares, schedules, low-fare search
- **What it gives**: enterprise-grade flight pricing + availability + booking. The same data engine used by airline call centres.
- **Cost**: free dev tier with 100 calls/day; production licensing requires sales conversation. Probably overkill for personal use.
- **When to use**: if you want exact fare math (not estimates) for points-vs-cash decisions on long-haul.
- **Tradeoffs**: complex auth (PCC, EPR), enterprise contracts. SerpAPI is 90% of the value at 5% of the friction.
- **Verdict for now**: skip. Revisit if you ever monetize this or build for the family beyond just yourself.

### 2.2 Kiwi.com Tequila API
- **What it gives**: virtual interlining (bookable multi-airline single-PNR), competitive fares for Asia/Europe, deep links.
- **Cost**: free dev tier (100 req/day), paid scaling.
- **When to use**: long-haul with creative routings (e.g., BLR → DOH → CDG vs BLR → DXB → CDG comparison).
- **Setup**: API key → patch `travel-deals-finder` to optionally call Tequila for international shortlists.
- **Verdict**: nice-to-have but SerpAPI Google Flights covers ~95% of decision-making.

### 2.3 Amadeus Self-Service APIs
- **What it gives**: flight offers, airport transfers, hotel offers, points-of-interest, location lookups.
- **Cost**: free dev tier; paid production.
- **Why this could matter**: the **Points of Interest** + **Hotel Offers** endpoints solve a chunk of the itinerary-builder's "verify on Maps" gap.
- **Setup**: register → API key → wrap in helper.
- **Verdict**: solid candidate if you don't pick SerpAPI. Picking *both* is overkill.

---

## Priority 3 — Long tail / nice-to-have

### 3.1 OpenWeatherMap / Tomorrow.io
- **What it gives**: forecasted weather for the actual travel window (not climate averages from timeanddate.com).
- **Cost**: 1000 calls/day free.
- **When to use**: 2-week-out forecast injection into the itinerary builder for "should I pack rain layers?".
- **Setup**: free API key → patch `destination-curator` weather signal.

### 3.2 OpenAQ — air quality
- **What it gives**: real-time AQI for the destination; useful in Delhi-NCR or Bangkok in winter.
- **Cost**: free.
- **When to use**: if a destination is borderline, AQI can be the tiebreaker for kid-trips.

### 3.3 Google Calendar API
- **What it gives**: write the booked trips to your calendar with full reservations baked in.
- **Cost**: free.
- **When to use**: after booking, push the itinerary to Google Calendar so the family sees it on their phones.
- **Setup**: OAuth via the existing google-workspace MCP server (you already have it enabled).

### 3.4 Embassy / Visa scraping (or VisaHQ API)
- **What it gives**: current visa requirements per origin/destination.
- **Cost**: free indices like passportindex.org work for static rules; live wait times require commercial APIs.
- **When to use**: Schengen / US / Japan trips need fresh data; for VOA destinations like Indonesia, this is overkill.

### 3.5 Foursquare Places API
- **What it gives**: restaurants + venue data with hours, photos, vegetarian flags.
- **Cost**: free dev tier.
- **When to use**: if SerpAPI's Maps coverage is thin in tier-2 Indian cities.

---

## Recommended sequence

1. **This month**: stand up **SerpAPI** ($75/mo). Fixes 70% of the planner's data-quality gaps.
2. **Next month**: try **mcp_travelassistant**; if it adds anything SerpAPI doesn't, keep both.
3. **Later**: add **OpenWeatherMap** for window-specific forecasts.
4. **If/when needed**: Amadeus or Tequila for long-haul shortlist.
5. **Skip indefinitely**: Sabre.

---

## What this fixes vs leaves behind

| Today's gap | After SerpAPI + mcp_travelassistant |
|---|---|
| "verify hours on Maps" placeholders | Real opening hours, ratings, photos |
| Estimated fares ₹X – ₹Y | Live snapshots with booking tokens |
| Unverified hotel pages | Live availability + rates + photos |
| "We don't know if X restaurant is open" | Hours + popular dishes + reviews |
| Fabricated dishes | Top dishes from review data |
| Manual Pexels image curation | Same — unchanged. Pexels stays the right answer for hero imagery (clean license). |

---

## Where keys live (when added)

- `.workspace/secrets.local.md` — never committed (already in `.gitignore` if you create it)
- Format: `SERPAPI_KEY=... \\n KIWI_KEY=... \\n AMADEUS_CLIENT_ID=... \\n AMADEUS_CLIENT_SECRET=...`
- Skills load via `read_secret("SERPAPI_KEY")` helper (to be written)

---

## Honest disclaimer

Until at least SerpAPI is wired in, the planner's:
- **Fares are estimates** (not snapshots)
- **Restaurant data is partially defensible** (chains and famous spots OK; specific dishes for non-chain places are best-effort)
- **Hotel availability is "Booking.com search"** (not live confirmed inventory)

The Pexels images, Google Maps deep-links, and school-PDF references **are accurate** and don't need an API.
