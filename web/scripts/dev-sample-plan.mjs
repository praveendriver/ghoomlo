// Development helper: attaches a placeholder plan to a trip so the plan screen
// can be worked on without an API key. Usage:
//   node --env-file=.env.local scripts/dev-sample-plan.mjs <trip-id>
// The content is deliberately generic; it names no real places.
import { randomUUID } from "node:crypto";
import pg from "pg";

if (process.env.NODE_ENV === "production") throw new Error("Development only.");
const tripId = process.argv[2];
if (!tripId) throw new Error("Pass a trip id.");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query("SELECT user_id, start_date::text, end_date::text FROM trips WHERE id = $1", [tripId]);
if (!rows[0]) throw new Error("No such trip.");
const { user_id, start_date, end_date } = rows[0];

const item = (timeOfDay, kind, title, extra = {}) => ({
  id: randomUUID(),
  timeOfDay,
  kind,
  title,
  description: "Sample text for layout work only.",
  placeName: null,
  estimatedCostInr: null,
  durationMinutes: null,
  fitNote: "",
  checkBeforeYouGo: [],
  ...extra,
});
const days = [];
for (let d = new Date(`${start_date}T00:00:00Z`), n = 1; d <= new Date(`${end_date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1), n++) {
  days.push({
    dayNumber: n,
    date: d.toISOString().slice(0, 10),
    title: `Sample day ${n}`,
    items: [
      item("morning", "activity", "Sample activity", {
        placeName: "Sample Place",
        durationMinutes: 150,
        estimatedCostInr: 1200,
        fitNote: "Sample note on how this suits the household.",
        checkBeforeYouGo: ["Sample thing to confirm", "Another thing to confirm"],
      }),
      item("midday", "meal", "Sample lunch", { estimatedCostInr: 1800 }),
      item("afternoon", "rest", "Sample rest"),
    ],
  });
}
const data = {
  summary: "SAMPLE PLAN — placeholder content for development, not a real itinerary.",
  days,
  thingsToVerify: [{ topic: "Sample topic", why: "Sample reason to confirm it." }],
  assumptions: ["Sample assumption."],
};
await client.query(
  "INSERT INTO itineraries (trip_id, user_id, model, start_date, end_date, data) VALUES ($1, $2, 'dev-sample', $3, $4, $5)",
  [tripId, user_id, start_date, end_date, JSON.stringify(data)],
);
await client.end();
console.log("Sample plan added.");
