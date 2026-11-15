import { describe, expect, it } from "vitest";
import { addDays, conflicts, eachDate, feasibleWindows, tripLengthDays } from "@/lib/dates";
import type { BlockedDate } from "@/lib/validation";

const school = (date: string): BlockedDate => ({ date, kind: "school" });

describe("date helpers", () => {
  it("counts trip days inclusively and across month ends", () => {
    expect(tripLengthDays("2027-01-30", "2027-02-02")).toBe(4);
    expect(tripLengthDays("2027-03-05", "2027-03-05")).toBe(1);
    expect(eachDate("2027-02-27", "2027-03-01")).toEqual(["2027-02-27", "2027-02-28", "2027-03-01"]);
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("finds blocked dates inside the window, including both ends", () => {
    const blocked = [school("2027-01-09"), school("2027-01-10"), school("2027-01-14"), school("2027-01-15")];
    expect(conflicts("2027-01-10", "2027-01-14", blocked).map((b) => b.date)).toEqual([
      "2027-01-10",
      "2027-01-14",
    ]);
  });
});

describe("feasibleWindows", () => {
  it("offers only shifts that avoid every blocked date, nearest first", () => {
    // Trip Sat 9th–Mon 11th; Monday is a school day. Shifting one day earlier clears it.
    const windows = feasibleWindows("2027-01-09", "2027-01-11", 2, [school("2027-01-11")], "2026-12-01");
    expect(windows.map((w) => w.shiftDays)).toEqual([-1, -2]);
    expect(windows[0]).toMatchObject({ startDate: "2027-01-08", endDate: "2027-01-10" });
  });

  it("returns the chosen dates first when they already work", () => {
    expect(feasibleWindows("2027-01-09", "2027-01-11", 1, [], "2026-12-01")[0].shiftDays).toBe(0);
  });

  it("never suggests a window that starts in the past", () => {
    const windows = feasibleWindows("2027-01-09", "2027-01-11", 2, [school("2027-01-11")], "2027-01-08");
    expect(windows.map((w) => w.startDate)).toEqual(["2027-01-08"]);
  });

  it("returns nothing when fixed dates clash", () => {
    expect(feasibleWindows("2027-01-09", "2027-01-11", 0, [school("2027-01-10")], "2026-12-01")).toEqual([]);
  });
});
