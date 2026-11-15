import "server-only";
import { and, count, eq, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function findUserByEmail(email: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return rows[0] ?? null;
}

/** Returns null when the email is already registered. */
export async function createUser(input: { email: string; name: string; passwordHash: string }) {
  const rows = await db
    .insert(schema.users)
    .values(input)
    .onConflictDoNothing({ target: schema.users.email })
    .returning({ id: schema.users.id });
  return rows[0] ?? null;
}

/** Removes the account and, by cascade, every session, profile, trip, and plan. */
export async function deleteUser(userId: string): Promise<void> {
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

const LOCKOUT_WINDOW_MS = 15 * 60_000;
export const MAX_LOGIN_FAILURES = 5;

export async function recentLoginFailures(email: string): Promise<number> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
  const rows = await db
    .select({ n: count() })
    .from(schema.loginFailures)
    .where(and(eq(schema.loginFailures.email, email), gt(schema.loginFailures.createdAt, since)));
  return rows[0].n;
}

export async function recordLoginFailure(email: string): Promise<void> {
  await db.insert(schema.loginFailures).values({ email });
}

export async function clearLoginFailures(email: string): Promise<void> {
  await db.delete(schema.loginFailures).where(eq(schema.loginFailures.email, email));
}

/** Everything we hold about one account, for the "download my data" feature. */
export async function exportUserData(userId: string) {
  const [user] = await db
    .select({
      email: schema.users.email,
      name: schema.users.name,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  const [household] = await db.select().from(schema.households).where(eq(schema.households.userId, userId));
  const trips = await db.select().from(schema.trips).where(eq(schema.trips.userId, userId));
  const itineraries = await db.select().from(schema.itineraries).where(eq(schema.itineraries.userId, userId));
  const strip = <T extends { userId: string }>(row: T): Omit<T, "userId"> => {
    const copy: Partial<T> = { ...row };
    delete copy.userId;
    return copy as Omit<T, "userId">;
  };
  return {
    exportedAt: new Date().toISOString(),
    account: user ?? null,
    household: household ? strip(household) : null,
    trips: trips.map(strip),
    plans: itineraries.map(strip),
  };
}
