import "server-only";
import { randomBytes } from "node:crypto";
import { count, countDistinct, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { BREAKS } from "@/lib/fare-watch";
import type { AlertInput, SignupInput } from "@/lib/fare-watch";

const { fareWatchSignups: signups, fareAlerts: alerts, fareAlertClicks: clicks } = schema;

/** Creates the signup, or updates the preferences if this email signed up before. Returns the token. */
export async function saveSignup(input: SignupInput): Promise<string> {
  // The short form does not ask about breaks, board or party size: everyone is watched for every break.
  const values = { ...input, breaks: [...BREAKS], board: null, travellers: null };
  const [row] = await db
    .insert(signups)
    .values({ ...values, token: randomBytes(24).toString("base64url") })
    .onConflictDoUpdate({ target: signups.email, set: values })
    .returning({ token: signups.token });
  return row.token;
}

export async function findSignupByToken(token: string) {
  if (!token || token.length > 64) return null;
  const [row] = await db.select().from(signups).where(eq(signups.token, token));
  return row ?? null;
}

/** Deletes everything held for this signup. Returns whether a record was removed. */
export async function removeSignup(token: string): Promise<boolean> {
  if (!token || token.length > 64) return false;
  const rows = await db.delete(signups).where(eq(signups.token, token)).returning({ id: signups.id });
  return rows.length > 0;
}

export async function listSignups() {
  return db.select().from(signups).orderBy(desc(signups.createdAt));
}

export async function createAlert(input: AlertInput): Promise<string> {
  const code = randomBytes(5).toString("base64url");
  await db.insert(alerts).values({ ...input, code });
  return code;
}

export async function deleteAlert(code: string): Promise<void> {
  await db.delete(alerts).where(eq(alerts.code, code));
}

export async function findAlert(code: string) {
  if (!code || code.length > 32) return null;
  const [row] = await db.select().from(alerts).where(eq(alerts.code, code));
  return row ?? null;
}

/** Alerts, newest first, with total clicks and how many distinct subscribers clicked. */
export async function listAlerts() {
  return db
    .select({
      alert: alerts,
      clicks: count(clicks.id),
      people: countDistinct(clicks.signupId),
    })
    .from(alerts)
    .leftJoin(clicks, eq(clicks.alertId, alerts.id))
    .groupBy(alerts.id)
    .orderBy(desc(alerts.createdAt));
}

/** Records one opening of a tracked link. The personal token is optional. */
export async function recordClick(alertId: string, signupToken: string | null): Promise<void> {
  const signup = signupToken ? await findSignupByToken(signupToken) : null;
  await db.insert(clicks).values({ alertId, signupId: signup?.id ?? null });
}
