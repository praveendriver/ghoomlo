# Ghoomlo

A trip-planning product for Indian families, at the stage of finding out what is worth building. This file is the project's standing memory: read it at the start of a session.

## Who you are working with

The founder is not a software engineer and follows the work from the Claude app. Explain in plain language, lead with the outcome, and say clearly what was and was not checked. They cannot run things locally; the live site is deployed on Render from this repository.

## What exists

- `web/` — the real product (Next.js + Postgres): accounts, household profile, trips with blocked dates, AI-drafted day plans with real maps, five sample plans, photo-led design. Start with `web/README.md`.
- `PRODUCT_BRIEF.md`, `LAUNCH_PLAN.md` — the original hypothesis and staged plan. Hypotheses, not decisions.
- `DISCOVERY_NOTES.md` — the evidence log about users. Thin so far; treat it that way.
- `research/` — study plans, results, idea reviews, and `idea-log.md`, the running list of ideas considered and their status.
- `travel-agent-bundle/` — the founder's earlier personal planning system. Reference material; it contains one family's personal details, so do not copy from it into the product.
- `prototype/` — an early clickable concept with simulated data.

## The open question

What is the reason someone would come to Ghoomlo instead of a chatbot or YouTube? It is not settled. Check `research/idea-log.md` for the current candidates and what has been tested before proposing or building a new direction.

## How to work on product questions

- New idea or "should we…" → use the `idea-review` skill.
- Wanting to find out if people want something → use the `assumption-test` skill.
- Study results arriving → use the `read-results` skill.
- A good review earns a test, not a build. Do not change the product's direction or the brief without the founder saying so.

## Rules the product keeps

- Never invent places, prices, hours, links, or coordinates. Label what is unverified or estimated.
- Respect content and data rights: no scraping of price, booking or content providers, no rehosting creators' videos, provider terms for prices and maps.
- Exception (founder's decision, 17 Nov 2026): schools' public pages may be fetched to find holiday calendars, politely. Obey robots.txt, identify the crawler, wait between requests, read only a few pages per school, never log in or get past a portal, and keep only the holiday dates with a link to where each came from. Dates found this way are unverified until checked.
- Collect the least personal data needed; travellers are stored as age groups only.

## Working conventions

- Run `npm run lint`, `npm run typecheck` and `npm test` in `web/` before pushing, and check changed screens in a browser at phone and desktop widths.
- The big external dependencies before launch are a paid maps and place-search provider and a price-data partner. Neither is in place.
