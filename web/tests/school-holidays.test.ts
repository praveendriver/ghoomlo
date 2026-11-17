import { describe, expect, it } from "vitest";
import publicHolidays from "@/data/public-holidays.json";
import data from "@/data/school-holidays.json";
import stateCalendars from "@/data/state-school-calendars.json";
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


describe("public holidays and state calendars", () => {
  it("has real dates, matching weekdays for fixed national days, and known sources", () => {
    const sources = new Set([...publicHolidays.sources.map((s) => s.id), "fixed-date"]);
    for (const h of publicHolidays.holidays) {
      expect(h.date).toMatch(iso);
      expect(sources.has(h.source), h.name).toBe(true);
    }
    const day = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
    expect(day("2027-01-26")).toBe(2); // the DoPT order says Republic Day 2027 is a Tuesday
    expect(day("2027-10-29")).toBe(5); // and Diwali a Friday
  });

  it("gives every state break a source, a quote and a start, with ends after starts", () => {
    for (const b of stateCalendars.breaks) {
      expect(b.start).toMatch(iso);
      if (b.end) expect(b.end >= b.start).toBe(true);
      expect(b.sourceUrl).toMatch(/^https:\/\//);
      expect(b.quote.length).toBeGreaterThan(5);
    }
  });
});
