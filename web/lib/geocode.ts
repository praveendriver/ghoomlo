import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { locatePlaces } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import type { Itinerary } from "@/lib/itinerary/schema";

// Place search uses OpenStreetMap's public Nominatim service. Its usage policy
// allows at most one request a second, requires results to be cached, and
// requires an identifying User-Agent. It is suitable for a pilot, not for
// launch traffic: swap `searchNominatim` for a paid provider before then.
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Ghoomlo/0.1 (trip planner)";
const MIN_GAP_MS = 1100;

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

/** Null means "no match"; a thrown error means the service could not be reached. */
async function searchNominatim(query: string): Promise<LatLng | null> {
  const run = async () => {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const url = `${ENDPOINT}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Place search failed with status ${res.status}`);
    const rows = (await res.json()) as { lat: string; lon: string }[];
    const lat = Number(rows[0]?.lat);
    const lng = Number(rows[0]?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

/** Cached lookup. Failures to reach the service are not cached and count as "not found". */
async function lookup(rawQuery: string): Promise<LatLng | null> {
  const query = rawQuery.trim().toLowerCase().slice(0, 200);
  const [cached] = await db.select().from(schema.geocodes).where(eq(schema.geocodes.query, query));
  if (cached) return cached.lat != null && cached.lng != null ? { lat: cached.lat, lng: cached.lng } : null;
  try {
    const hit = await searchNominatim(query);
    await db
      .insert(schema.geocodes)
      .values({ query, lat: hit?.lat ?? null, lng: hit?.lng ?? null })
      .onConflictDoNothing();
    return hit;
  } catch (err) {
    console.error("Place search unavailable", err instanceof Error ? err.message : err);
    return null;
  }
}

export function isGeocodingEnabled(): boolean {
  return process.env.GEOCODING !== "off";
}

/** Add map coordinates to every plan item whose place can be found near the destination. */
export async function addLocations(plan: Itinerary, destination: string): Promise<Itinerary> {
  if (!isGeocodingEnabled()) return plan;
  const names = plan.days.flatMap((d) => d.items.flatMap((i) => (i.placeName ? [i.placeName] : [])));
  const found = await locatePlaces(destination, names, lookup);
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      items: day.items.map((item) => ({ ...item, location: (item.placeName && found.get(item.placeName)) || null })),
    })),
  };
}
