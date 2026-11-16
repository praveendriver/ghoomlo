# Ghoomlo web app

The multi-user Ghoomlo product: accounts, a household profile, trips with blocked and flexible dates, and an AI-drafted day-by-day plan with every unverified detail labelled.

Built with Next.js (App Router), Postgres, and Drizzle. Plans are drafted through the Anthropic API.

## Run it locally

You need Node 22+ and Postgres 16+.

```bash
docker compose up -d        # from the repo root: starts Postgres with dev and test databases
cd web
cp .env.example .env.local  # then add ANTHROPIC_API_KEY to draft real plans
npm install
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Without `ANTHROPIC_API_KEY` everything works except drafting a plan; the trip page says so.

To work on the plan screen without a key, attach placeholder content to a trip:

```bash
node --env-file=.env.local scripts/dev-sample-plan.mjs <trip-id>
```

## Deploy

`render.yaml` at the repo root describes a Render web service and Postgres database. `npm run start:prod` applies migrations and then starts the server, so any Node host with a `DATABASE_URL` works the same way.

## Checks

```bash
npm test          # unit and database tests; uses TEST_DATABASE_URL and wipes it
npm run typecheck
npm run lint
npm run build
```

## Layout

| Path | What lives there |
|---|---|
| `app/` | Pages, server actions (`app/actions/`), and the data-export route |
| `components/` | Forms and shared UI |
| `lib/db/` | Schema and connection; migrations are generated into `drizzle/` |
| `lib/data/` | All database access. Every function takes the owner's user id and filters on it |
| `lib/auth/` | Password hashing (scrypt) and cookie sessions stored hashed in Postgres |
| `lib/itinerary/` | Prompt, output schema, the plan-drafting call, and the free-text reader |
| `lib/ideas.ts` | The sample plans shown on the home page |
| `images/` | Destination photos and their sources (`images/README.md`); `lib/photos.ts` maps them to destinations |
| `lib/dates.ts` | Blocked-date clash detection and nearby feasible windows |
| `tests/` | Vitest suites, including cross-account isolation |

After changing `lib/db/schema.ts`, run `npm run db:generate` and commit the new file in `drizzle/`.

## Product rules the code enforces

- Sample plans show no prices and are labelled as samples, not as AI drafts or verified plans.
- A plan never claims to be verified. Places carry a "not verified" badge, costs and durations an "estimate" badge, and each plan lists what to confirm.
- The app never invents links. The only outbound link is a Google Maps search for a place name.
- A plan cannot be drafted for dates that include a day the traveller marked unavailable.
- Travellers are stored as age groups only. Users can download or delete everything from the Account page.
