import { describe, expect, it } from "vitest";
import climate from "@/data/climate.json";
import { customWindowsSchema, DESTINATIONS } from "@/lib/fare-watch";
import { suggestFor } from "@/lib/suggest";
import { themeFor } from "@/lib/theme";

describe("weather suggestions", () => {
  it("has twelve months of data for every origin city and destination", () => {
    for (const place of [...DESTINATIONS, "Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune", "Kolkata"]) {
      const p = (climate.places as Record<string, { months: unknown[] }>)[place];
      expect(p, place).toBeDefined();
      expect(p.months).toHaveLength(12);
    }
  });

  it("suggests a warm, dry place for late December from cold Delhi, and says why", () => {
    const [tip] = suggestFor({ start: "2026-12-24" }, "Delhi NCR", ["Goa", "Jaipur"], DESTINATIONS);
    expect(tip.tone).toBe("good");
    expect(tip.text).toMatch(/^Goa suits Dec: about 30°C by day and dry, while Delhi NCR is about 23°C\.$/);
  });

  it("warns about a picked place that is very wet in that month", () => {
    const tips = suggestFor({ start: "2027-01-23" }, "Mumbai", ["Goa", "Bali"], DESTINATIONS);
    expect(tips.some((t) => t.tone === "warn" && t.text.startsWith("Bali is very wet then"))).toBe(true);
  });

  it("never uses places whose data is marked unreliable", () => {
    const tips = suggestFor({ start: "2027-05-15" }, "Delhi NCR", ["Manali", "Ladakh", "Kashmir"], DESTINATIONS);
    expect(tips).toEqual([]);
  });
});

describe("themes", () => {
  it("matches festivals and seasons by name, with a fallback", () => {
    expect(themeFor("Christmas break", "school").emoji).toBe("🎄");
    expect(themeFor("Diwali break", "school").tone).toBe("diwali");
    expect(themeFor("Holi long weekend (take Monday off)", "long-weekend").tone).toBe("holi");
    expect(themeFor("Republic Day long weekend", "long-weekend").tone).toBe("tricolour");
    expect(themeFor("Your dates", "custom").tone).toBe("custom");
    expect(themeFor("Something else", "school").tone).toBe("plain");
  });
});

describe("your own dates", () => {
  const schema = customWindowsSchema("2026-11-17");
  it("accepts future trips in order", () => {
    expect(schema.safeParse([{ start: "2027-02-12", end: "2027-02-16" }]).success).toBe(true);
  });
  it("rejects past, reversed, too-long, too-far and too-many trips", () => {
    expect(schema.safeParse([{ start: "2026-11-01", end: "2026-11-05" }]).success).toBe(false);
    expect(schema.safeParse([{ start: "2027-02-16", end: "2027-02-12" }]).success).toBe(false);
    expect(schema.safeParse([{ start: "2027-01-01", end: "2027-04-01" }]).success).toBe(false);
    expect(schema.safeParse([{ start: "2028-06-01", end: "2028-06-05" }]).success).toBe(false);
    expect(schema.safeParse(Array.from({ length: 7 }, (_, i) => ({ start: `2027-03-0${i + 1}`, end: `2027-03-0${i + 1}` }))).success).toBe(false);
  });
});
