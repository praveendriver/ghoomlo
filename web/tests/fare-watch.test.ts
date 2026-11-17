import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { csvRow } from "@/lib/csv";
import {
  createAlert,
  findAlert,
  findSignupByToken,
  listAlerts,
  listSignups,
  recordClick,
  removeSignup,
  saveSignup,
} from "@/lib/data/fare-watch";
import { db } from "@/lib/db";
import { alertSchema, BREAKS, matches, signupSchema } from "@/lib/fare-watch";

const form = {
  email: " Asha@Example.com ",
  homeCity: "Bengaluru",
  school: "Example Public School, Whitefield",
  wishlist: ["Goa", "Goa", "Kerala"],
};
const alert = {
  origin: "Bengaluru",
  destination: "Goa",
  breakLabel: BREAKS[0],
  priceInr: "4200",
  seenOn: "2026-11-17",
  source: "Airline website",
  targetUrl: "https://example.com/flights?from=BLR&to=GOI",
};

describe("sign-up form rules", () => {
  it("normalises email and removes duplicate places", () => {
    const parsed = signupSchema.parse(form);
    expect(parsed.email).toBe("asha@example.com");
    expect(parsed.wishlist).toEqual(["Goa", "Kerala"]);
  });

  it("needs a listed city, a school, one to five listed places", () => {
    expect(signupSchema.safeParse({ ...form, homeCity: "Atlantis" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...form, school: "" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...form, wishlist: [] }).success).toBe(false);
    expect(signupSchema.safeParse({ ...form, wishlist: ["Narnia"] }).success).toBe(false);
    expect(signupSchema.safeParse({ ...form, wishlist: ["Goa", "Kerala", "Jaipur", "Udaipur", "Agra", "Bali"] }).success).toBe(false);
  });

  it("accepts only listed places and https booking links for alerts", () => {
    expect(alertSchema.safeParse(alert).success).toBe(true);
    expect(alertSchema.safeParse({ ...alert, destination: "Narnia" }).success).toBe(false);
    for (const targetUrl of ["http://example.com", "javascript:alert(1)", "example.com", ""]) {
      expect(alertSchema.safeParse({ ...alert, targetUrl }).success).toBe(false);
    }
  });
});

describe("matching alerts to people", () => {
  const person = { homeCity: "Bengaluru ", wishlist: ["goa", "Kerala"], breaks: [BREAKS[0]] };
  it("needs the same city, a wishlist place and a chosen break, ignoring case", () => {
    expect(matches(person, { origin: "Bengaluru", destination: "Goa", breakLabel: BREAKS[0] })).toBe(true);
    expect(matches(person, { origin: "Mumbai", destination: "Goa", breakLabel: BREAKS[0] })).toBe(false);
    expect(matches(person, { origin: "Bengaluru", destination: "Jaipur", breakLabel: BREAKS[0] })).toBe(false);
    expect(matches(person, { origin: "Bengaluru", destination: "Goa", breakLabel: BREAKS[1] })).toBe(false);
  });
});

describe("spreadsheet export", () => {
  it("quotes commas and defuses cells a spreadsheet would run as a formula", () => {
    expect(csvRow(["a,b", '=HYPERLINK("x")', 3, null])).toBe(`"a,b","'=HYPERLINK(""x"")",3,`);
  });
});

describe("stored sign-ups and tracked links", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: path.resolve("drizzle") });
  });
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE fare_watch_signups, fare_alerts CASCADE`);
  });
  afterAll(async () => {
    await db.$client.end();
  });

  it("keeps one record per email, updates it on a second sign-up, and watches every break", async () => {
    const token = await saveSignup(signupSchema.parse(form));
    const again = await saveSignup(signupSchema.parse({ ...form, wishlist: ["Ladakh"] }));
    expect(again).toBe(token);
    const all = await listSignups();
    expect(all).toHaveLength(1);
    expect(all[0].wishlist).toEqual(["Ladakh"]);
    expect(all[0].breaks).toEqual([...BREAKS]);
  });

  it("deletes the record on unsubscribe and rejects unknown tokens", async () => {
    const token = await saveSignup(signupSchema.parse(form));
    expect(await removeSignup("not-a-real-token")).toBe(false);
    expect(await removeSignup(token)).toBe(true);
    expect(await findSignupByToken(token)).toBeNull();
    expect(await listSignups()).toEqual([]);
  });

  it("counts link opens, and known people separately from anonymous opens", async () => {
    const token = await saveSignup(signupSchema.parse(form));
    const code = await createAlert(alertSchema.parse(alert));
    const saved = (await findAlert(code))!;
    await recordClick(saved.id, token);
    await recordClick(saved.id, token);
    await recordClick(saved.id, null);
    await recordClick(saved.id, "made-up-token");
    const [row] = await listAlerts();
    expect(row).toMatchObject({ clicks: 4, people: 1 });

    // Unsubscribing keeps the click totals but forgets who clicked.
    await removeSignup(token);
    expect((await listAlerts())[0]).toMatchObject({ clicks: 4, people: 0 });
    expect(await findAlert("nope")).toBeNull();
  });
});
