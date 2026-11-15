# India-wide trip planner — staged product and launch plan

**Planning basis:** The imported bundle is a personal local travel planner. This plan treats it as a source of product ideas and reusable material, not as a production service ready to expose publicly.

## Launch strategy

Prove a trustworthy trip-planning experience for users across India before expanding internationally or adding booking transactions. The pilot should recruit from multiple Indian cities and support user-selected origins; it should bound destination coverage based on reliable data rather than center the product on one city. Expand by evidence: users complete plans, trust the information, return for another trip, and the service can support them at sustainable cost.

## Stage 0 — Product discovery and ownership

**Goal:** Confirm the customer, their planning pain, and what can legally and safely become a commercial product.

**Work:**

- Use [DISCOVERY_NOTES.md](DISCOVERY_NOTES.md) as a first interview signal, then ask the traveler for a specific recent trip walkthrough and booking decision before treating the journey as understood.
- Continue the Goa-in-October walkthrough, starting with date selection, and map each next step to the actual tool, decision, and information need.
- Prototype date selection with school/work hard blocks and price grids side by side; test whether this helps users find feasible, lower-cost windows.
- Run an initial round of 10–15 interviews with people who recently planned a multi-day trip. Recruit across Indian regions and metro/non-metro origins, and include varied household structures, budgets, languages, dietary needs, and access needs. This is exploratory research, not a statistically representative India-wide survey.
- Validate the commercial path for flight and accommodation comparison early: contact potential inventory partners, confirm approval requirements, India coverage, price-refresh/caching rights, alert usage, attribution, redirect requirements, and economics. Do not assume public API access or that scraping is permitted.
- Map what travelers need to compare: total price, taxes/fees, baggage, stops/times, room occupancy, meals, cancellation/refundability, loyalty benefits, and booking-provider reliability.
- Ask what “cost is too high” means for users (flight, stay, or whole trip) and which timing evidence they trust (recent history, target alerts, flexible-date grid, or a fare-high/low signal). Validate whether they need search coverage, affordability context, or a booking-timing recommendation.
- Explore how travelers use travel videos and map context in decisions: what they search for, how they verify a place and its location, and how these signals connect to price and trip feasibility.
- Prototype a post-destination-selection video digest that groups repeated themes and disagreements across creators on places to visit, food/shopping, route times, visual recognition, appeal, and stated opinions; show source counts, links/timestamps, and test whether it helps users decide faster without mistaking anecdotes for verified facts.
- Validate visa research needs per traveler/passport and trip date; establish which official sources users trust and how they need the information presented without collecting unnecessary passport data.
- Validate whether and how travelers compare points with cash. Treat award inventory as a separate partner-access problem; where the product cannot confirm it live, link to the provider for verification or accept a user-entered award quote and label it accordingly.
- Explore how travelers define date flexibility: hard no-travel dates, movable dates, school/work commitments, and unresolved dependencies such as visas. Test whether a calendar/window view prevents irrelevant price alerts.
- Map their current planning steps, tools, failure points, and moments when they need authoritative confirmation.
- Keep an opportunity-to-outcome map linking observed needs to candidate solutions and tests. Test the working promise and a clickable or concierge prototype using real recent trip scenarios.
- Continue short research cycles during design, pilot, and launch; combine generative interviews with evaluative usability testing and product feedback.
- Inventory the bundle: source code, API terms, model/tool dependencies, photos, saved pages, personal information, credentials, and licenses.
- Identify which assets are personal examples, which can be reused, and which need replacement or permission.
- Pick a first target user and a small destination set based on interview evidence and source coverage; recruit across multiple Indian origins.

**Exit gate:** A specific user segment, top three jobs, India-wide pilot scope, and MVP scope are documented; no credential or personal-data material is carried into product environments; asset ownership and reuse questions have an owner and resolution path.

**Commercial dependency:** Price comparison is a product requirement, but launch coverage depends on signed provider access and permitted use. If access is unavailable, keep the feature as a prototype or use clearly labelled outbound search links; do not scrape provider sites or present estimated fares as live offers.

## Stage 1 — Product definition and service design

**Goal:** Make the planning journey and trust expectations concrete before building a public service, including for users outside major metros and under constrained connectivity.

**Work:**

- Prototype onboarding, household profiles, trip setup, destination comparison, itinerary review, and sharing on mobile.
- Test whether users understand source, estimate, uncertainty, and last-checked labels.
- Test the core tasks on mobile with people across the selected user cohorts; include keyboard, screen-reader, zoom, and touch-target checks. Set WCAG 2.2 AA as the design and verification target, then validate with people who use assistive technologies.
- Make an explicit language decision from research. Do not imply multilingual coverage unless translated UI, generated content, source material, and support have been tested together.
- Define what profile data is optional, where it is used, how long it is kept, and how users can remove it.
- Define user support, correction/reporting, and escalation paths for bad information.
- Choose a small initial provider set and record coverage, terms, cost, and fallback behavior for each.
- Define offer normalization and comparison rules for the same dates, party size, cabin/room occupancy, currency, taxes/fees, baggage or inclusions, cancellation, refundability, and points required versus cash saved. Record ranking logic and commercial disclosures.
- Test hotel comparisons that include direct-booking loyalty earnings/qualifying nights alongside third-party cash rates; distinguish confirmed benefits from estimates and show channel eligibility.
- Define user budget and price sorting behavior: show lowest suitable options and total-cost details where available, while making exclusions and incomplete supplier coverage explicit.
- Design price watches around user-selected thresholds and exact or flexible dates, excluding hard blocked dates and respecting unresolved dependencies. Start from the user's stated preference for a daily check and alert on every observed drop; specify what counts as a comparable flight/stay, provider-permitted polling cadence, notification channels, quiet hours, deduplication, stale-price handling, optional revisit reminders, opt-out, and deletion. Test whether reminders help with date/work delays without creating unwanted urgency.
- Where partner terms permit, record comparable observed quotes to power a price-history view, flexible-date grid, and contextual high/low label. Show date range, sample count, supplier scope, and insufficient-data states; do not present these historical signals as a forecast.
- Decide how users can save/export trips without unexpectedly exposing household details.

**Exit gate:** Target users can complete the main flow in prototype sessions; core fields and data handling are documented; provider and model costs are estimated for the pilot.

## Stage 2 — Secure multi-user MVP

**Goal:** Replace the single-user local setup with a controlled pilot service.

**Work:**

- Build account management, household profiles, trip storage, authorization, and tenant isolation.
- Build a production web/API boundary; do not expose the current local proxy or Claude CLI bridge publicly.
- Implement provider adapters with server-side secrets, caching, timeouts, quotas, and graceful error states.
- Add explicit source and freshness metadata to itinerary claims and links.
- Implement contracted supplier/aggregator integrations for flight and lodging search, redirects, refreshed availability where supported, and user-configured price watches. Treat loyalty awards as confirmed only from a current authorized source; otherwise provide direct verification links or a clearly labelled user-entered comparison. Store only the minimum search and alert data required; honor provider retention and caching terms.
- Add a coverage-aware results view that says which suppliers were searched, distinguishes live from indicative results, compares total cost and key conditions, identifies commissioned placements, and never claims exhaustive “best in market” coverage without evidence.
- Add plan editing, save/share/print, account export/deletion, feedback/reporting, and basic support operations.
- Establish staging and production environments, backups, monitoring, error reporting, and incident response.
- Define user-facing service level objectives for plan creation, successful retrieval, and core trip access; agree error-budget and incident policies before public launch.
- Use OWASP ASVS 5.0.0 as the security verification baseline, selecting an appropriate level and documenting any accepted gaps.
- Create an evaluation set covering factuality, stale data, itinerary feasibility, dietary and accessibility constraints, and injection or abuse cases.
- Evaluate video research synthesis for source attribution, distinct-creator counting, extraction precision, coverage bias, disagreement visibility, sponsorship context, and separation of creator opinion from verified facts.
- Also test route-time freshness and whether creator matching based on the user's past place/experience choices is useful and understandable. Do not use facial-expression inference to claim a creator's emotion or sincerity.
- Create price-quality evaluations for quote freshness, price changes on provider handoff, comparable-offer correctness, missing fees, duplicated inventory, exact/flexible-date match quality, blocked-date conflicts, historical sample sufficiency, high/low context accuracy, alert timeliness, stale/duplicate alerts, and supplier coverage by route.
- Review privacy, security, accessibility, API terms, image rights, and applicable legal obligations with qualified specialists before pilot use.

**Exit gate:** A release candidate passes a documented security review against the selected OWASP ASVS baseline; account isolation and deletion are verified; high-impact claims and price coverage have clear limitations and source cues; critical journeys are evaluated on representative trip cases and user cohorts; mobile accessibility issues are triaged against WCAG 2.2 AA; support can respond to pilot reports. Price display, refresh, caching, alerts, and affiliate disclosures comply with signed partner terms and applicable market rules. Any remaining high-severity privacy, security, or factuality risk blocks release.

## Stage 3 — Closed pilot

**Goal:** Learn whether the MVP makes trip planning materially easier for real households.

**Pilot shape:** Invite 25–50 households across the chosen India-wide cohorts. This is a learning pilot, not a population-representative sample. Keep destinations and supported data corridors bounded and disclose that coverage. Provide a feedback channel and review early plans closely.

**Measure:**

- Profile completion and successful first-plan completion.
- Time to first usable plan and how much editing users need.
- User-reported usefulness and confidence.
- Incorrect/stale fact reports and which providers or content types caused them.
- Price-search coverage, comparable-offer quality, price changes on provider handoff, alert timeliness, stale alert rate, opt-outs, and partner referrals by provider.
- History coverage and comparability, usefulness of high/low labels, observed price-drop notification delay, and whether checking cadence is both useful and within partner/cost limits.
- Whether flexible-date watches and opted-in revisit reminders help users who report date uncertainty or competing demands; notification fatigue and opt-outs.
- Repeat planning, plan sharing, and user referrals.
- Model/provider cost per completed plan and support effort per household.
- Task success, time to complete, errors, and drop-off on the core planning journey.
- Differences in failures, plan quality, and support needs by origin type, access needs, and supported language.

**Exit gate:** Users in each recruited cohort complete the core tasks without hands-on intervention for routine cases; serious trust or privacy issues are resolved; pre-agreed task success, plan usefulness, factuality, reliability, and cost thresholds are met; costs have a plausible path to sustainable unit economics. Thresholds and cohort breakdowns are documented before pilot results are reviewed.

Price-comparison exit condition: users can understand why offers differ and verify the total with the provider; exact and flexible-date price-watch alerts meet pre-agreed freshness and usefulness thresholds; opted-in reminders are found useful and do not create unacceptable notification fatigue; partner coverage and terms support the routes and lodging use cases advertised.

## Stage 4 — Public India launch

**Goal:** Open access gradually with honest geographic and capability boundaries.

**Work:**

- Launch a public website with clear supported-market coverage, product limitations, privacy controls, and support contact.
- Add onboarding that lets users understand and edit personalization before the first generated plan.
- Publish content and growth experiments around useful planning problems rather than unsupported “book your whole trip” claims.
- Add capacity controls, abuse monitoring, provider quota alerts, and a human process for urgent service incidents.
- Publish service availability and response expectations consistent with observed performance; review user-facing SLOs and error budgets regularly.
- Test monetization only with clear disclosure and separation from recommendation ranking.
- Review user feedback and data-provider quality weekly during the initial release and maintain ongoing discovery with users.

**Exit gate:** Reliability, support response, user trust, repeat usage, and cost measures remain within predefined operating targets for several release cycles, with no unresolved high-severity accessibility, privacy, security, or factuality issue.

## Stage 5 — Expand markets and capabilities

**Goal:** Add markets one at a time without pretending that worldwide coverage is uniform.

**Expansion order:**

1. Deepen destination coverage within India, prioritizing places where data coverage and support are strong.
2. Add a small set of international routes based on user demand and reliable source coverage.
3. Add languages, currencies, local travel norms, and market-specific support as each market is validated.
4. Consider booking, payments, native apps, and richer collaboration only after the planning product has repeat use and operating readiness.

**Market launch checklist:** Validate local source coverage and freshness; entry-rule sourcing; currency and date handling; language quality; user support; applicable privacy, consumer, and travel regulations; provider rights and commercial terms; and local payment/referral requirements.

## Workstream checklist

| Workstream | First deliverable |
|---|---|
| Customer research | Interview guide, recruiting criteria, and synthesized findings |
| Product design | Mobile prototype and trust-language comprehension findings |
| Engineering | Multi-tenant architecture proposal and threat model |
| Data | Provider coverage matrix, terms, cost, freshness, and fallback plan |
| Price comparison | Offer normalization, ranking/disclosures, partner access, alert rules, price-quality evaluation |
| Quality | Trip evaluation set and release thresholds |
| Privacy and legal | Data map, retention/deletion policy, market review questions |
| Operations | Support process, incident playbook, monitoring and quota alerts |
| Business | Monetization experiments and unit-economics model |
| Brand and growth | Name/trademark review, positioning tests, launch content plan |

## Immediate next actions

1. Treat [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) as the current product hypothesis, not a final commitment.
2. Continue the founder/user discovery interview and test the family-travel problem statement with other travelers.
3. In parallel, contact flight and lodging providers/affiliate programs to confirm what comparison, deep-link, and alert use they will permit for a new India-wide product.
4. Create an asset and data inventory from the archive, keeping secrets and personal records out of any shared or deployed repository.
5. Produce a mobile-first prototype for itinerary planning, offer comparison, and price watch setup.
6. After discovery and partner feasibility checks, turn the validated scope into a technical architecture and implementation backlog.

## Decisions to make after discovery

- Is the first user segment families broadly, or a narrower group such as families with dietary constraints or points balances?
- Which Indian departure cities and destination corridors should be prioritized first within the India-wide launch?
- Which destinations can the product support with dependable current information?
- Will the first paid value be collaboration, deeper research, ongoing trip support, or something else?
- Which legal entity, privacy framework, and commercial terms are needed for the first public market?

