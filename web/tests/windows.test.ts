import { describe, expect, it } from "vitest";
import { nearestCity } from "@/lib/places";
import { CITIES } from "@/lib/schools";
import { calendarMonths, formatWindow, longWeekends, windowsFor } from "@/lib/windows";

describe("longWeekends", () => {
  const h = (date: string, name = "X") => ({ date, name, type: "gazetted" });
  it("builds three- and four-day weekends around Monday, Friday, Tuesday and Thursday holidays", () => {
    const out = longWeekends([h("2027-01-26"), h("2027-03-26"), h("2027-05-17"), h("2027-05-20"), h("2027-08-25")], "2026-11-17");
    expect(out.map((w) => [w.start, w.end])).toEqual([
      ["2027-01-23", "2027-01-26"], // Tuesday: Sat to Tue, take Monday off
      ["2027-03-26", "2027-03-28"], // Friday: Fri to Sun
      ["2027-05-15", "2027-05-17"], // Monday: Sat to Mon
      ["2027-05-20", "2027-05-23"], // Thursday: Thu to Sun, take Friday off
    ]); // Wednesday holidays make no long weekend
    expect(out[0].label).toContain("take Monday off");
  });
  it("skips restricted holidays and past dates", () => {
    expect(longWeekends([{ date: "2027-01-15", name: "Pongal", type: "restricted" }, h("2026-01-26")], "2026-11-17")).toEqual([]);
  });
});

describe("windowsFor", () => {
  it("offers a school's own future breaks when we have them, and drops weekends inside them", () => {
    const w = windowsFor("Delhi NCR", "Sardar Patel Vidyalaya", "2026-11-17");
    const school = w.filter((x) => x.kind === "school");
    expect(school.map((x) => x.label)).toEqual(["Winter break"]);
    expect(w.some((x) => x.kind === "state")).toBe(false);
    expect(w.some((x) => x.kind === "long-weekend" && x.start <= "2027-01-17" && (x.end ?? "") >= "2027-01-01")).toBe(false);
  });
  it("falls back to the state calendar when the school's dates are unknown", () => {
    const w = windowsFor("Delhi NCR", "Some School Not In Our List", "2026-11-17");
    expect(w.some((x) => x.kind === "state" && x.start === "2027-01-01")).toBe(true);
    expect(w.some((x) => x.kind === "long-weekend")).toBe(true);
  });
  it("is sorted by start date and gives every window a unique id", () => {
    const w = windowsFor("Hyderabad", "Manthan School", "2026-11-17");
    expect([...w].sort((a, b) => a.start.localeCompare(b.start))).toEqual(w);
    expect(new Set(w.map((x) => x.id)).size).toBe(w.length);
  });
});

describe("calendar helpers", () => {
  it("lists twelve months starting this month, across the year end", () => {
    const m = calendarMonths("2026-11-17");
    expect(m[0]).toEqual({ year: 2026, month: 11 });
    expect(m[2]).toEqual({ year: 2027, month: 1 });
    expect(m).toHaveLength(12);
  });
  it("formats open-ended and single-day windows", () => {
    expect(formatWindow({ start: "2027-04-11", end: null })).toMatch(/^from 11 Apr/);
    expect(formatWindow({ start: "2027-03-26", end: "2027-03-28" })).toMatch(/26 Mar.*28 Mar/);
  });
});


describe("typical windows and location", () => {
  it("offers Christmas and summer as typical windows when a school's dates are unknown", () => {
    const w = windowsFor("Mumbai", "", "2026-11-17");
    expect(w.filter((x) => x.kind === "typical").map((x) => x.label)).toEqual(["Christmas and New Year", "Summer holidays"]);
  });
  it("skips typical windows that the state calendar already covers, and when the school's dates are known", () => {
    expect(windowsFor("Delhi NCR", "", "2026-11-17").some((x) => x.id === "typical-2026-12")).toBe(false);
    expect(windowsFor("Delhi NCR", "Sardar Patel Vidyalaya", "2026-11-17").some((x) => x.kind === "typical")).toBe(false);
  });
  it("finds the nearest supported city", () => {
    expect(nearestCity(CITIES, { lat: 28.46, lon: 77.03 }).city).toBe("Delhi NCR"); // Gurugram
    expect(nearestCity(CITIES, { lat: 19.2, lon: 72.97 }).city).toBe("Mumbai"); // Thane
    const far = nearestCity(CITIES, { lat: 26.85, lon: 80.95 }); // Lucknow
    expect(far.km).toBeGreaterThan(250);
  });
});
