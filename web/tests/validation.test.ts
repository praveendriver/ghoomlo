import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { fieldErrors, signupSchema, tripSchema } from "@/lib/validation";

const trip = {
  destination: "Goa",
  origin: "Pune",
  startDate: "2027-01-09",
  endDate: "2027-01-13",
  flexDays: "1",
  blockedDates: [],
  pendingDependencies: "",
  budgetInr: "",
  notes: "",
};

describe("tripSchema", () => {
  it("accepts a valid trip and turns an empty budget into null", () => {
    const parsed = tripSchema.parse(trip);
    expect(parsed.budgetInr).toBeNull();
    expect(parsed.flexDays).toBe(1);
    expect(tripSchema.parse({ ...trip, budgetInr: "150000" }).budgetInr).toBe(150000);
  });

  it("rejects a return date before the start date", () => {
    const result = tripSchema.safeParse({ ...trip, endDate: "2027-01-08" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).endDate).toMatch(/before/);
  });

  it("rejects trips longer than the limit and impossible dates", () => {
    expect(tripSchema.safeParse({ ...trip, endDate: "2027-01-19" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...trip, startDate: "2027-13-40" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...trip, flexDays: "9" }).success).toBe(false);
  });
});

describe("signup and passwords", () => {
  it("normalises email case and enforces password length", () => {
    const ok = signupSchema.parse({ name: "Asha", email: "  Asha@Example.COM ", password: "long-enough-pw" });
    expect(ok.email).toBe("asha@example.com");
    expect(signupSchema.safeParse({ name: "Asha", email: "a@b.co", password: "short" }).success).toBe(false);
  });

  it("verifies only the right password and never stores it in the clear", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong horse battery", hash)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});
