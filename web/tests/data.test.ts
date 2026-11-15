import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getHousehold, saveHousehold } from "@/lib/data/household";
import {
  createTrip,
  deleteTrip,
  getTrip,
  latestItinerary,
  listTrips,
  moveTripDates,
  removeItineraryItem,
  saveItinerary,
} from "@/lib/data/trips";
import {
  clearLoginFailures,
  createUser,
  deleteUser,
  exportUserData,
  recentLoginFailures,
  recordLoginFailure,
} from "@/lib/data/users";
import { db } from "@/lib/db";
import type { Itinerary } from "@/lib/itinerary/schema";
import type { TripInput } from "@/lib/validation";

const trip: TripInput = {
  destination: "Goa",
  origin: "Pune",
  startDate: "2027-01-09",
  endDate: "2027-01-10",
  flexDays: 1,
  blockedDates: [{ date: "2027-01-11", kind: "school" }],
  pendingDependencies: "",
  budgetInr: null,
  notes: "",
};
const plan = (): Itinerary => ({
  summary: "s",
  thingsToVerify: [],
  assumptions: [],
  days: [
    {
      dayNumber: 1,
      date: "2027-01-09",
      title: "Arrive",
      items: ["a", "b"].map((id) => ({
        id,
        timeOfDay: "morning",
        kind: "activity",
        title: id,
        description: "",
        placeName: null,
        estimatedCostInr: null,
        durationMinutes: null,
        fitNote: "",
        checkBeforeYouGo: [],
      })),
    },
  ],
});

let asha: string;
let ravi: string;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });
});
beforeEach(async () => {
  await db.execute(sql`TRUNCATE users, login_failures CASCADE`);
  asha = (await createUser({ email: "asha@example.com", name: "Asha", passwordHash: "x" }))!.id;
  ravi = (await createUser({ email: "ravi@example.com", name: "Ravi", passwordHash: "x" }))!.id;
});
afterAll(async () => {
  await db.$client.end();
});

describe("accounts", () => {
  it("refuses a second account with the same email", async () => {
    expect(await createUser({ email: "asha@example.com", name: "Other", passwordHash: "y" })).toBeNull();
  });

  it("counts and clears failed sign-ins per email", async () => {
    await recordLoginFailure("asha@example.com");
    await recordLoginFailure("asha@example.com");
    expect(await recentLoginFailures("asha@example.com")).toBe(2);
    expect(await recentLoginFailures("ravi@example.com")).toBe(0);
    await clearLoginFailures("asha@example.com");
    expect(await recentLoginFailures("asha@example.com")).toBe(0);
  });
});

describe("one user's data is invisible to another", () => {
  it("scopes trips to their owner for read, move, and delete", async () => {
    const id = await createTrip(asha, trip);
    expect(await getTrip(asha, id)).toMatchObject({ destination: "Goa" });
    expect(await getTrip(ravi, id)).toBeNull();
    expect(await listTrips(ravi)).toEqual([]);

    await moveTripDates(ravi, id, "2028-01-01", "2028-01-02");
    await deleteTrip(ravi, id);
    expect(await getTrip(asha, id)).toMatchObject({ startDate: "2027-01-09" });
  });

  it("scopes plans to their owner for save, read, and edit", async () => {
    const id = await createTrip(asha, trip);
    const meta = { model: "m", startDate: trip.startDate, endDate: trip.endDate, data: plan() };
    expect(await saveItinerary(ravi, id, meta)).toBe(false);
    expect(await saveItinerary(asha, id, meta)).toBe(true);

    const saved = (await latestItinerary(asha, id))!;
    expect(await latestItinerary(ravi, id)).toBeNull();

    await removeItineraryItem(ravi, saved.id, "a");
    expect((await latestItinerary(asha, id))!.data.days[0].items).toHaveLength(2);
    await removeItineraryItem(asha, saved.id, "a");
    expect((await latestItinerary(asha, id))!.data.days[0].items.map((i) => i.id)).toEqual(["b"]);
  });

  it("treats malformed ids as not found rather than failing", async () => {
    expect(await getTrip(asha, "not-a-uuid")).toBeNull();
    expect(await latestItinerary(asha, "'; drop table trips; --")).toBeNull();
  });
});

describe("household, export, and deletion", () => {
  const household = {
    homeCity: "Pune",
    travellers: [{ ageGroup: "adult" as const }],
    pace: "balanced" as const,
    diet: "vegetarian" as const,
    dietNotes: "",
    accessibilityNotes: "",
    interests: ["Food" as const],
  };

  it("saves and then updates a single household per user", async () => {
    await saveHousehold(asha, household);
    await saveHousehold(asha, { ...household, homeCity: "Nashik" });
    expect((await getHousehold(asha))!.homeCity).toBe("Nashik");
    expect(await getHousehold(ravi)).toBeNull();
  });

  it("exports only the requesting user's data, without the password hash", async () => {
    await saveHousehold(asha, household);
    await createTrip(asha, trip);
    await createTrip(ravi, { ...trip, destination: "Leh" });
    const data = await exportUserData(asha);
    expect(data.trips.map((t) => t.destination)).toEqual(["Goa"]);
    expect(data.household?.homeCity).toBe("Pune");
    expect(JSON.stringify(data)).not.toMatch(/passwordHash|password_hash|Leh/);
  });

  it("deleting an account removes its household, trips, and plans, and nobody else's", async () => {
    await saveHousehold(asha, household);
    const id = await createTrip(asha, trip);
    await saveItinerary(asha, id, { model: "m", startDate: trip.startDate, endDate: trip.endDate, data: plan() });
    const ravisTrip = await createTrip(ravi, trip);

    await deleteUser(asha);
    const left = await db.execute(sql`
      SELECT (SELECT count(*) FROM trips)::int AS trips,
             (SELECT count(*) FROM itineraries)::int AS plans,
             (SELECT count(*) FROM households)::int AS households`);
    expect(left.rows[0]).toEqual({ trips: 1, plans: 0, households: 0 });
    expect(await getTrip(ravi, ravisTrip)).not.toBeNull();
  });
});
