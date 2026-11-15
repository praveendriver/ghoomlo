# India-wide trip planner — product brief

**Status:** Working hypothesis, pending user research  
**Product:** Consumer travel planning assistant  
**Initial market assumption:** Family travelers across India, with travelers choosing their own departure city. Initial language support and localization scope must be validated.  
**Long-term ambition:** Serve travelers across markets, origins, and travel styles

## Product summary

The product helps travelers turn a set of real-world constraints into a practical trip plan they can trust. It learns a household’s preferences—such as pace, food requirements, accessibility needs, budget, loyalty programs, and past trips—then helps compare destinations, compare flight and accommodation offers across available booking providers, build an itinerary, monitor selected prices, and prepare for departure.

The product should make clear what is verified, what is an estimate, what price was observed and when, and what needs checking. It should link travelers to providers to book; it will not initially sell or ticket travel itself. “Best price” means the best comparable offer found in the providers the product can access for the traveler’s exact search—not every offer in the market or a guarantee of the lowest possible price.

## The problem hypothesis

Planning a good trip may mean reconciling scattered, changing information with personal constraints. Generic itineraries may overlook those constraints, while manual research can make it hard to compare options and distinguish current facts from assumptions. This is a hypothesis to test through interviews and observation of recent planning, not a confirmed market finding.

## First customer hypothesis

**Primary hypothesis:** Families in India planning a multi-day leisure trip, often around school calendars, with several travelers’ preferences and a meaningful budget.

**Initial design partner profile:** Families from multiple Indian cities planning domestic and nearby international trips. The first release must support user-selected departure cities across India; the imported bundle's Bengaluru (BLR) examples are prototype data, not a product default.

**Later audiences:** Couples, groups of friends, solo travelers, and travelers with specific dietary, accessibility, or loyalty needs. These are expansion opportunities, not MVP promises.

## Core promise

**A trip plan that fits your people, compares the travel options you can actually book, and shows you what to verify before you rely on it.**

## Main user journey

1. Create a traveler profile: home airport, household members, travel pace, budget range, dietary and accessibility needs, and optional loyalty programs.
2. Describe a trip: preferred dates, movable dates, hard blocks (such as school or important work), trip length, interests, and budget; optionally mark external dependencies such as a pending visa. Compare price grids for feasible date windows as part of choosing dates.
3. Compare a small set of destinations or trip options, with reasons, trade-offs, and source freshness visible.
4. After choosing a destination, review a source-linked digest of recurring themes and disagreements across travel videos about places to visit, food/shopping, route times, visual recognition, and creator-reported reactions.
5. Compare bookable flight and accommodation options for the traveler’s exact dates and party size, including cash prices, trip-specific preferences (such as beachfront location), loyalty earning/qualifying-night value, and available redemption options where data access allows. Show total price, departure-time trade-offs, conditions, provider, freshness, and booking link.
6. Optionally watch an exact or flexible-date flight/stay search against a target price and receive a clear, timely alert or opted-in reminder to revisit the decision.
7. Build and edit a day-by-day plan, including realistic travel time, meals, and alternatives.
8. Review a preparation checklist and save or share the plan.
9. After travel, optionally record what worked so the next plan improves.

## MVP scope

### Include

- Responsive web app with account creation and household profiles.
- User-selected home airport/departure city, with support and research across multiple Indian origins.
- Editable preferences and constraints, with explicit controls over what is saved.
- Trip creation and a guided planning flow with user checkpoints.
- A destination research digest that groups recurring themes and differing views across multiple travel videos, shows source links/timestamps and the number/date range of sources, and labels creator opinions as anecdotal rather than verified facts. It should help users judge practical details (food, shopping products, route time, recognizable visual cues), personal appeal, and creator relevance.
- Flight and accommodation price comparison from contracted or approved providers, with search parameters preserved so results are meaningfully comparable.
- Sort and filter comparable options by lowest cash cost, total cost where available, departure-time suitability, location preferences, loyalty earnings/qualifying nights, and fit to the traveler's trip-specific priorities; explain coverage and trade-offs so “lowest” is not mistaken for “best for everyone.”
- Cash-versus-points comparison for redemptions available from permitted providers or entered by the traveler; show points required alongside cash saved, and never imply award space exists without a current source. Let travelers make the trade-off without requiring a complex points valuation.
- User-configured price watches for exact or flexible-date flight and accommodation searches that respect hard blocked dates and external dependencies, with alert thresholds, sensible notification controls, pause/delete controls, and a visible last-checked time.
- Price timing tools: recent observed price history, flexible-date price grids, alerts for observed drops and user-set thresholds, and high/low context versus comparable history when the data is sufficient. These describe observed data and do not predict future prices.
- Itinerary editing, day-level organization, map links, and printable/shareable output.
- Budget estimates with currency and assumptions shown.
- Clear source, last-checked time, confidence, and estimate labels for time-sensitive facts.
- Manual links to booking providers; no claim that a price or room is bookable until confirmed by the provider.
- Transparent ranking and monetization disclosures. Commission, sponsored placement, or provider coverage must not silently change what “best” means.
- Recheck or refresh availability when users follow a result where the provider supports it; explain that final price and availability are confirmed by the booking provider.
- Feedback collection, support contact, and account/data deletion.

### Defer

- Booking, payment processing, ticket issuance, or guarantees about availability.
- Predictive claims such as “this is the cheapest day to book” or “prices will fall” until prediction quality is measured and clearly explained.
- Broad, destination-wide fare scans and predictive “buy now / wait” advice. The MVP watchlist covers user-selected, comparable flights or stays against explicit price targets.
- Broad social platform ingestion, continuous creator monitoring, and generic recommendation feeds. Any initial video digest must use permitted sources and bounded coverage.
- Native mobile apps, offline synchronization, and complex group collaboration.
- Worldwide coverage claims. Start with a bounded market and expand by validated destination and data coverage.

## Trust and product rules

- Never invent places, hours, prices, availability, visa rules, or links.
- Distinguish verified facts, estimates, and unknowns in the interface.
- Show source and freshness for facts that can change; direct users to authoritative sources for high-impact details such as entry requirements.
- Show the searched traveler count/ages, dates, currency, included taxes/fees where available, baggage or room conditions, cancellation terms, provider, and whether the result is live or indicative. Do not compare unlike offers as though they were equivalent.
- Define “price is right” as a user-set target in the first release. Let users choose exact dates or a flexible window where provider data permits. Price alerts and any reminder to revisit a decision should be actionable, opt-in, appropriately timed, and easy to stop.
- Provide price history and high/low context only where the product has permission to retain/use comparable observations and sufficient coverage. Show sample count, date range, and supplier scope; otherwise say history is insufficient. Keep observed-history context distinct from a forecast or “buy now” recommendation.
- Default watched-price behavior should check once daily and alert on every newly observed drop, matching this initial user signal, with user controls for thresholds, frequency/digest, quiet hours, and pause. The provider-permitted polling cadence must be stated honestly.
- Treat loyalty points as a potential way to reduce trip cost, not as savings by default. Show points required and cash saved against a comparable cash option, and label award availability as confirmed only when a current provider source confirms it; otherwise link users to verify directly or let them enter a quote.
- Show loyalty earning and qualifying-night estimates only when supported by current program and booking-channel rules; clearly flag when third-party bookings may not earn the same benefits as direct bookings.
- Tell users which providers are included and how commercial relationships affect results. Do not say “lowest” or “best in market” when coverage is partial.
- Treat diet, accessibility, medical, and child-related needs as constraints users can review and correct. Do not imply safety from a weak or missing data signal.
- Distinguish hard date constraints from flexible preferences and unresolved dependencies. Never recommend a watched travel date that conflicts with dates the user marked unavailable.
- Keep the user in control of saved preferences, sharing, and deletion.
- Explain the limitations of recommendations and identify when a human or provider should confirm a detail.
- For creator or social content, show the original source and date where known; disclose sponsorship when known and do not present anecdotal content as verified fact.
- Treat repeated creator mentions as evidence of what creators discuss, not proof that a place is safe, suitable, or objectively “best.” Preserve source diversity, disagreements, dates, and sponsorship context; respect platform and content-use terms.
- Use creator-stated opinions and linked video context when describing a reaction. Do not infer sincerity, enjoyment, or personality from facial expressions; let users decide whether a creator's style/preferences match theirs using clear, user-controlled criteria.
- Treat route duration mentioned in a video as creator-reported and potentially stale; distinguish it from map/provider estimates and label both sources and observation dates.

## What makes this worth building

The bundle already contains a useful planning workflow, itinerary presentation, trip-preparation checklist, and a strong emphasis on practical constraints and information provenance. The product opportunity is to make those capabilities configurable and dependable for many households, rather than expose the current personal setup as-is.

The initial wedge is **constraint-aware trip planning with transparent confidence**, especially for family travel. Loyalty optimization may become a valuable feature, but it should remain optional and should not dominate the first user experience.

### Early discovery evidence

One traveler described researching across Google Flights, Skyscanner, Google Maps, Agoda, Marriott Bonvoy, Air India, loyalty sites, official requirement sources, weather, ground-transport options, YouTube, and Instagram. They reported fragmented research, points-versus-cash comparisons, concern that waiting to book can lead to price increases, and named prices and videos as their leading time/decision pain points (with maps and visa research also significant). In a recent Goa trip planned for October (year unspecified), their first task was choosing dates while checking school dates, office meetings, and flight prices together; after finding a workable window, they booked flights and a hotel. Their hotel priorities were five-star quality, earning Bonvoy points and qualifying nights, and beachfront location for this trip; they paid cash. They chose flights with a reasonable fare and avoided very early or late departures. After choosing a destination, they watch many vloggers to aggregate recurring themes and disagreements, judge food/shopping quality, route times, visual cues, personal appeal, creators’ expressed reactions, and creator similarity. They infer similar taste when a creator chooses places/experiences they have also chosen in the past. This synthesis takes time today. This is an initial qualitative signal (N=1), not a validated segment finding. See [discovery notes](DISCOVERY_NOTES.md).

## Outcomes and success measures

**User outcome to validate:** A traveler can make a trip plan they feel ready to use, with their important constraints reflected and the details they need to verify made clear.

**Candidate outcome metric:** Share of trip-planning users who finish a plan and rate it as usable for their trip. Define “finish,” the rating question, denominator, and observation window before the pilot; compare with task success, time, and qualitative feedback so a self-rating alone does not stand in for quality.

### Funnel and usability

- Share of new users who complete a traveler profile and start a trip.
- Share who reach a usable first itinerary in their first session.
- Time from trip creation to first useful plan.
- Task success and points of confusion for key tasks: set an origin, express constraints, review a source, edit a day, and share or export a plan.
- Time to choose places/activities within a selected destination; whether users understand recurring themes, source counts, and disagreements in the video digest; and whether they can trace claims to original videos.
- Whether users find creator matching based on shared past choices useful and understandable, and whether they can correct or turn off the matching.

### Quality and trust

- User-rated usefulness and factual confidence after reviewing a plan.
- Rate of reported incorrect or stale facts, by fact type and source.
- Price-search coverage, comparable-offer quality, price changes on provider handoff, alert precision/timeliness, alert opt-out rate, and partner conversion by provider.
- History coverage and comparability, high/low label accuracy against the displayed dataset, price-drop notification delay, duplicate/noise rates, and checks-per-watch cost.
- Whether users can identify a lowest-cost suitable option and judge whether it fits their target budget; measure timing-decision confidence without implying predictive accuracy.
- For flexible-date watches, match quality across dates; for reminders, measure whether users find them timely/helpful and whether notification frequency causes opt-outs.
- Constraint misses and severe misinformation reports, reviewed by severity and affected user cohort.
- Quality and task success differences across origins, connectivity conditions, and supported languages.
- Share of high-impact facts with a source and a recent verification timestamp.
- Percentage of users who edit, save, share, or print their plan.

### Retention and business viability

- Users who plan another trip within 6–12 months.
- Referral and share-driven signups.
- Cost to serve a completed plan, including model and data-provider costs.
- Support contacts, generation failures, and retries per completed plan.
- Willingness to pay or use a clearly disclosed referral path, tested before scaling.

## Business model hypotheses to test

1. Freemium planning with a paid tier for richer personalization, collaboration, or ongoing trip support.
2. Clearly disclosed referral revenue for bookings initiated with partner providers.
3. A hybrid model, only if users value the paid features and partner economics do not compromise recommendation trust.

Do not choose a model based only on theoretical margins. Validate user willingness to pay, provider terms, and the effect of monetization on perceived independence.

## Product and engineering implications

- Replace family-specific assumptions embedded in pages and scripts with per-account profile data.
- Move from local files and browser storage to an authenticated service with tenant isolation, authorization, backups, and deletion workflows.
- Separate the web client, application API, model orchestration, data-provider adapters, and background work.
- Keep provider credentials server-side; add quotas, rate limits, timeouts, caching, retries, and observability.
- Make recommendations reproducible enough to inspect: retain the relevant inputs, sources, timestamps, and model/version metadata under a defined retention policy.
- Use an evaluation set for itinerary quality, factuality, dietary constraint handling, and unsafe or unsupported claims before release.
- Review all included photos, copied page assets, research material, and third-party API usage rights before commercial distribution.
- Provide privacy notices, consent and deletion flows, security review, and market-specific legal review before public launch.

## Key risks and open decisions

| Decision or risk | Working assumption | How to resolve |
|---|---|---|
| First customer segment | Families planning leisure trips | Run an initial discovery round with 10–15 households, then continue research until the key user needs and differences across cohorts are understood; observe recent planning workflows |
| First geography | India-wide pilot with multi-origin support | Validate demand and data coverage across a representative mix of metro and non-metro origins |
| Product surface | Responsive web first | Test on mobile devices with real trip-planning tasks |
| Monetization | Not settled | Test paid-feature concepts and referral disclosure with pilot users |
| Price inventory access | Not secured | Validate API/affiliate eligibility, supported India markets, permitted price display/caching/alert uses, loyalty/award inventory access, freshness rules, and costs before promising comparison coverage |
| Price alert quality | User-set threshold is the initial hypothesis | Test whether alerts are timely and useful; measure stale alerts, missed changes, opt-outs, and provider click-throughs |
| Booking delay | Uncertain dates and competing work may cause missed booking opportunities | Explore flexible-date windows and optional reminders; do not assume lower prices alone remove the barrier |
| Price timing signals | User wants history, alerts on drops, flexible-date grids, and high/low context for flight/hotel cost | Test which signal changes a booking decision; secure rights and sufficient comparable history before showing high/low labels |
| Booking responsibility | User books with provider | Keep MVP to research, planning, and outbound links |
| Data reliability | Varies by provider and destination | Build per-source coverage and freshness tracking before expanding destinations |
| Existing bundle suitability | Personal prototype, not production-ready | Inventory code, secrets, data rights, and dependencies before reusing components |

## MVP acceptance bar

The pilot is ready when a new user can create an account, enter and edit their household needs, choose an origin anywhere in India, compare supported flight and hotel offers on equivalent terms, create and stop a price watch, generate and revise an itinerary, see source and freshness cues for material claims, save or share a plan, and delete their account. The service must isolate one user’s data from another’s, protect provider credentials, handle provider/model outages gracefully, and have a tested support and incident process. A representative set of users must complete the main tasks in usability sessions, including mobile use and assistive-technology checks; thresholds are set before testing, not after seeing results. If inventory permissions are not secured, the pilot must label price comparison as a prototype and must not imply live market coverage.

## Discovery and decision practice

Treat the customer segment, problem, itinerary workflow, language support, and willingness to pay as hypotheses. Keep an opportunity-to-outcome map, interview and observe travelers continuously, and test risky product and business assumptions with prototypes or concierge trials before committing to expensive implementation. The team should own measurable customer outcomes and choose solutions based on evidence; the feature list is a starting point for experiments, not a delivery contract.

