import "server-only";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Itinerary } from "@/lib/itinerary/schema";
import type { TripInput } from "@/lib/validation";

// Every function takes the owner's userId and filters on it. A trip or plan id
// alone is never enough to read or change a row.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ownTrip = (userId: string, tripId: string) =>
  and(eq(schema.trips.id, tripId), eq(schema.trips.userId, userId));

export async function listTrips(userId: string) {
  return db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.userId, userId))
    .orderBy(desc(schema.trips.createdAt));
}

export async function getTrip(userId: string, tripId: string) {
  if (!UUID.test(tripId)) return null;
  const rows = await db.select().from(schema.trips).where(ownTrip(userId, tripId)).limit(1);
  return rows[0] ?? null;
}

export async function createTrip(userId: string, input: TripInput): Promise<string> {
  const [row] = await db
    .insert(schema.trips)
    .values({ userId, ...input })
    .returning({ id: schema.trips.id });
  return row.id;
}

export async function moveTripDates(
  userId: string,
  tripId: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  if (!UUID.test(tripId)) return;
  await db.update(schema.trips).set({ startDate, endDate }).where(ownTrip(userId, tripId));
}

export async function deleteTrip(userId: string, tripId: string): Promise<void> {
  if (!UUID.test(tripId)) return;
  await db.delete(schema.trips).where(ownTrip(userId, tripId));
}

export async function latestItinerary(userId: string, tripId: string) {
  if (!UUID.test(tripId)) return null;
  const rows = await db
    .select()
    .from(schema.itineraries)
    .where(and(eq(schema.itineraries.tripId, tripId), eq(schema.itineraries.userId, userId)))
    .orderBy(desc(schema.itineraries.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Saves a plan only if the trip belongs to the user. Returns false otherwise. */
export async function saveItinerary(
  userId: string,
  tripId: string,
  plan: { model: string; startDate: string; endDate: string; data: Itinerary },
): Promise<boolean> {
  if (!(await getTrip(userId, tripId))) return false;
  await db.insert(schema.itineraries).values({ userId, tripId, ...plan });
  return true;
}

export async function removeItineraryItem(
  userId: string,
  itineraryId: string,
  itemId: string,
): Promise<void> {
  if (!UUID.test(itineraryId)) return;
  await db.transaction(async (tx) => {
    const own = and(eq(schema.itineraries.id, itineraryId), eq(schema.itineraries.userId, userId));
    const [row] = await tx.select().from(schema.itineraries).where(own).for("update");
    if (!row) return;
    const data: Itinerary = {
      ...row.data,
      days: row.data.days.map((d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) })),
    };
    await tx.update(schema.itineraries).set({ data }).where(own);
  });
}

export const DAILY_PLAN_LIMIT = 10;

export async function plansInLastDay(userId: string): Promise<number> {
  const since = new Date(Date.now() - 86_400_000);
  const rows = await db
    .select({ n: count() })
    .from(schema.itineraries)
    .where(and(eq(schema.itineraries.userId, userId), gt(schema.itineraries.createdAt, since)));
  return rows[0].n;
}
