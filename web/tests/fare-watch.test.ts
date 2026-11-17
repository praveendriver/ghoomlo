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
  windowIds: ["lw-2027-01-26"],
};
const windows = [{ id: "lw-2027-01-26", label: "Republic Day long weekend", start: "2027-01-23", end: "2027-01-26", kind: "long-weekend" as const, basis: "" }];
const alert = {
  origin: "Bengaluru",
  destination: "Goa",
  travelStart: "2027-01-23",
  travelEnd: "2027-01-26",
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
    expect(alertSchema.safeParse({ ...alert, travelEnd: "2027-01-01" }).success).toBe(false);
    for (const targetUrl of ["http://example.com", "javascript:alert(1)", "example.com", ""]) {
      expect(alertSchema.safeParse({ ...alert, targetUrl }).success).toBe(false);
    }
  });
});

describe("matching alerts to people", () => {
  const person = { homeCity: "Bengaluru ", wishlist: ["goa", "Kerala"], windows: [{ start: "2026-12-19", end: "2027-01-03" }] };
  const goa = { origin: "bengaluru", destination: "Goa" };
  it("needs the same city and a wishlist place, ignoring case", () => {
    expect(matches(person, { ...goa, travelStart: "2026-12-20", travelEnd: "2026-12-27" })).toBe(true);
    expect(matches(person, { ...goa, origin: "Mumbai", travelStart: "2026-12-20", travelEnd: "2026-12-27" })).toBe(false);
    expect(matches(person, { ...goa, destination: "Jaipur", travelStart: "2026-12-20", travelEnd: "2026-12-27" })).toBe(false);
  });
  it("needs the trip to fit inside a picked window", () => {
    expect(matches(person, { ...goa, travelStart: "2026-12-18", travelEnd: "2026-12-24" })).toBe(false);
    expect(matches(person, { ...goa, travelStart: "2026-12-28", travelEnd: "2027-01-05" })).toBe(false);
    expect(matches(person, { ...goa, travelStart: "2027-01-03", travelEnd: "2027-01-03" })).toBe(true);
  });
  it("treats an open-ended window as fitting any trip that starts inside it", () => {
    const summer = { ...person, windows: [{ start: "2027-04-11", end: null }] };
    expect(matches(summer, { ...goa, travelStart: "2027-05-01", travelEnd: "2027-05-08" })).toBe(true);
    expect(matches(summer, { ...goa, travelStart: "2027-04-01", travelEnd: "2027-04-05" })).toBe(false);
  });
  it("lets people with no picked windows hear about any dates", () => {
    expect(matches({ ...person, windows: [] }, { ...goa, travelStart: "2027-06-01", travelEnd: "2027-06-05" })).toBe(true);
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
    const token = await saveSignup(signupSchema.parse(form), windows);
    const again = await saveSignup(signupSchema.parse({ ...form, wishlist: ["Ladakh"] }), windows);
    expect(again).toBe(token);
    const all = await listSignups();
    expect(all).toHaveLength(1);
    expect(all[0].wishlist).toEqual(["Ladakh"]);
    expect(all[0].breaks).toEqual([...BREAKS]);
    expect(all[0].windows).toEqual([{ id: "lw-2027-01-26", label: "Republic Day long weekend", start: "2027-01-23", end: "2027-01-26", kind: "long-weekend" }]);
  });

  it("deletes the record on unsubscribe and rejects unknown tokens", async () => {
    const token = await saveSignup(signupSchema.parse(form), windows);
    expect(await removeSignup("not-a-real-token")).toBe(false);
    expect(await removeSignup(token)).toBe(true);
    expect(await findSignupByToken(token)).toBeNull();
    expect(await listSignups()).toEqual([]);
  });

  it("counts link opens, and known people separately from anonymous opens", async () => {
    const token = await saveSignup(signupSchema.parse(form), windows);
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
