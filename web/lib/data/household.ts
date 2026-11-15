import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { HouseholdInput } from "@/lib/validation";

export async function getHousehold(userId: string) {
  const rows = await db.select().from(schema.households).where(eq(schema.households.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function saveHousehold(userId: string, input: HouseholdInput): Promise<void> {
  const values = { ...input, interests: [...input.interests], updatedAt: new Date() };
  await db
    .insert(schema.households)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: schema.households.userId, set: values });
}
