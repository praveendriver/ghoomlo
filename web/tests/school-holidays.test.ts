import { describe, expect, it } from "vitest";
import data from "@/data/school-holidays.json";
import { SCHOOLS } from "@/lib/schools";

type Entry = (typeof data.schools)[number];
const iso = /^\d{4}-\d{2}-\d{2}$/;

describe("school holiday data", () => {
  it("only lists schools that are in the school picker", () => {
    for (const s of data.schools as Entry[]) {
      expect((SCHOOLS as Record<string, readonly string[]>)[s.city], s.city).toBeDefined();
      expect((SCHOOLS as Record<string, readonly string[]>)[s.city]).toContain(s.school);
    }
  });

  it("gives every found break real dates in order, a source link and quoted wording", () => {
    for (const s of data.schools as Entry[]) {
      if (s.status === "found") {
        expect(s.breaks.length, s.school).toBeGreaterThan(0);
        expect(s.sourceUrl, s.school).toMatch(/^https?:\/\//);
      }
      for (const b of s.breaks) {
        expect(b.start, s.school).toMatch(iso);
        expect(b.end, s.school).toMatch(iso);
        expect(Number.isNaN(Date.parse(b.start))).toBe(false);
        expect(b.start <= b.end, `${s.school} ${b.name}`).toBe(true);
        expect(b.quote.length, `${s.school} ${b.name}`).toBeGreaterThan(5);
      }
    }
  });

  it("has one entry per school", () => {
    const keys = (data.schools as Entry[]).map((s) => `${s.city}|${s.school}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
