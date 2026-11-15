import { describe, expect, it } from "vitest";
import { IDEAS, ideaToItinerary } from "@/lib/ideas";
import { parseTripText } from "@/lib/itinerary/parse";
import { normalisePrefill, safeNext } from "@/lib/prefill";
import { MAX_TRIP_DAYS } from "@/lib/validation";

const TODAY = "2026-11-15";

describe("sample plans", () => {
  it("each has a unique slug, fits the trip-length limit, and has something on every day", () => {
    expect(new Set(IDEAS.map((i) => i.slug)).size).toBe(IDEAS.length);
    for (const idea of IDEAS) {
      expect(idea.days.length).toBeGreaterThan(0);
      expect(idea.days.length).toBeLessThanOrEqual(MAX_TRIP_DAYS);
      expect(idea.title).toContain(String(idea.days.length));
      for (const day of idea.days) expect(day.items.length).toBeGreaterThan(0);
    }
  });

  it("show no prices, because none have a checked source", () => {
    for (const idea of IDEAS) {
      for (const item of idea.days.flatMap((d) => d.items)) expect(item.estimatedCostInr).toBeNull();
      expect(JSON.stringify(idea)).not.toMatch(/₹|Rs\.?\s?\d|https?:/);
    }
  });

  it("become a dated plan with unique item ids", () => {
    const plan = ideaToItinerary(IDEAS[0], "2027-02-27");
    expect(plan.days.map((d) => d.date).slice(0, 3)).toEqual(["2027-02-27", "2027-02-28", "2027-03-01"]);
    const ids = plan.days.flatMap((d) => d.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("normalisePrefill", () => {
  it("keeps valid values as form strings", () => {
    expect(
      normalisePrefill(
        { destination: " Goa ", origin: "Delhi", startDate: "2026-12-20", endDate: "2026-12-24", flexDays: 9, budgetInr: 150000.4, notes: "two adults" },
        TODAY,
      ),
    ).toEqual({
      destination: "Goa",
      origin: "Delhi",
      startDate: "2026-12-20",
      endDate: "2026-12-24",
      flexDays: "3",
      budgetInr: "150000",
      notes: "two adults",
    });
  });

  it("drops past dates, impossible dates, over-long trips, and nulls instead of guessing", () => {
    expect(normalisePrefill({ startDate: "2026-01-01", endDate: "2026-01-04" }, TODAY)).toEqual({});
    expect(normalisePrefill({ startDate: "2026-12-40" }, TODAY)).toEqual({});
    expect(normalisePrefill({ startDate: "2026-12-01", endDate: "2026-12-30" }, TODAY)).toEqual({ startDate: "2026-12-01" });
    expect(normalisePrefill({ startDate: "2026-12-05", endDate: "2026-12-01" }, TODAY)).toEqual({ startDate: "2026-12-05" });
    expect(normalisePrefill({ destination: null, budgetInr: 50, flexDays: 0, notes: "" }, TODAY)).toEqual({});
  });
});

describe("parseTripText", () => {
  const stub = (response: unknown) => ({ beta: { messages: { parse: (async () => response) as never } } });

  it("returns the cleaned-up fields from a complete response", async () => {
    const result = await parseTripText(
      "5 days in Goa",
      TODAY,
      stub({ stop_reason: "end_turn", parsed_output: { destination: "Goa", origin: null, startDate: null, endDate: null, flexDays: null, budgetInr: null, notes: "5 days" } }),
    );
    expect(result).toEqual({ understood: true, prefill: { destination: "Goa", notes: "5 days" } });
  });

  it("falls back to keeping the text as notes when unreadable or not configured", async () => {
    const fallback = { understood: false, prefill: { notes: "somewhere warm" } };
    expect(await parseTripText("somewhere warm", TODAY, stub({ stop_reason: "refusal", parsed_output: null }))).toEqual(fallback);
    expect(await parseTripText("somewhere warm", TODAY)).toEqual(fallback);
  });
});

describe("safeNext", () => {
  it("allows same-site paths only", () => {
    expect(safeNext("/ideas/goa-easy-beach-break")).toBe("/ideas/goa-easy-beach-break");
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil.example", "ideas", "", undefined, "/a b"]) {
      expect(safeNext(bad)).toBeNull();
    }
  });
});
