import { describe, expect, it } from "vitest";
import { distanceKm, locatePlaces, MAX_KM_FROM_DESTINATION } from "@/lib/geo";
import type { LatLng } from "@/lib/geo";
import { IDEAS } from "@/lib/ideas";

const JAIPUR = { lat: 26.92, lng: 75.82 };
const DELHI = { lat: 28.61, lng: 77.21 };
const KOCHI = { lat: 9.97, lng: 76.24 };

describe("distanceKm", () => {
  it("is roughly right for known city pairs", () => {
    expect(distanceKm(JAIPUR, DELHI)).toBeGreaterThan(220);
    expect(distanceKm(JAIPUR, DELHI)).toBeLessThan(260);
    expect(distanceKm(JAIPUR, JAIPUR)).toBe(0);
  });
});

describe("locatePlaces", () => {
  const table: Record<string, LatLng | null> = {
    Jaipur: JAIPUR,
    "Amber Fort, Jaipur": { lat: 26.986, lng: 75.85 },
    "City Palace, Jaipur": { lat: 26.926, lng: 75.824 },
    "Lake View Cafe, Jaipur": KOCHI, // a same-named place far away
    "Made Up Place, Jaipur": null,
  };
  const calls: string[] = [];
  const lookup = async (q: string) => {
    calls.push(q);
    return table[q] ?? null;
  };

  it("keeps nearby matches and drops missing or far-away ones", async () => {
    const found = await locatePlaces("Jaipur", ["Amber Fort", "City Palace, Jaipur", "Lake View Cafe", "Made Up Place", "Amber Fort"], lookup);
    expect([...found.keys()]).toEqual(["Amber Fort", "City Palace, Jaipur"]);
    // Destination once, each distinct place once, and no doubled-up destination name.
    expect(calls).toEqual(["Jaipur", "Amber Fort, Jaipur", "City Palace, Jaipur", "Lake View Cafe, Jaipur", "Made Up Place, Jaipur"]);
  });

  it("places nothing when the destination itself cannot be found", async () => {
    expect((await locatePlaces("Nowhereville", ["Amber Fort"], lookup)).size).toBe(0);
  });

  it("caps the number of lookups", async () => {
    let n = 0;
    await locatePlaces("Jaipur", Array.from({ length: 50 }, (_, i) => `P${i}`), async () => (n++, JAIPUR), 5);
    expect(n).toBe(6);
  });
});

describe("sample plan coordinates", () => {
  it("are all in India and close to the other pins of the same plan", () => {
    for (const idea of IDEAS) {
      const pins = idea.days.flatMap((d) => d.items.flatMap((i) => (i.location ? [i.location] : [])));
      expect(pins.length).toBeGreaterThan(2);
      for (const pin of pins) {
        expect(pin.lat).toBeGreaterThan(6);
        expect(pin.lat).toBeLessThan(37);
        expect(pin.lng).toBeGreaterThan(68);
        expect(pin.lng).toBeLessThan(98);
        expect(distanceKm(pin, pins[0])).toBeLessThan(MAX_KM_FROM_DESTINATION);
      }
    }
  });
});
