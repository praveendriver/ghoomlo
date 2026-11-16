// Looks up map coordinates for every named place in the sample plans and
// writes lib/idea-locations.json. Re-run after editing lib/ideas.ts:
//   npx tsx scripts/geocode-ideas.ts
// Review the printed matches by eye before committing the file.
import { writeFileSync } from "node:fs";
import { locatePlaces } from "../lib/geo";
import type { LatLng } from "../lib/geo";
import { IDEAS } from "../lib/ideas";

let last = 0;
const names = new Map<string, string>();
async function lookup(query: string): Promise<LatLng | null> {
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Ghoomlo/0.1 (trip planner)" },
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const [row] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!row) return null;
  names.set(`${Number(row.lat)},${Number(row.lon)}`, row.display_name);
  return { lat: Number(row.lat), lng: Number(row.lon) };
}

async function main() {
  const out: Record<string, Record<string, LatLng>> = {};
  for (const idea of IDEAS) {
    const places = idea.days.flatMap((d) => d.items.flatMap((i) => (i.placeName ? [i.placeName] : [])));
    const found = await locatePlaces(idea.destination, places, lookup);
    out[idea.slug] = Object.fromEntries(found);
    for (const place of new Set(places)) {
      const hit = found.get(place);
      console.log(`${idea.destination} | ${place} -> ${hit ? `${hit.lat.toFixed(4)},${hit.lng.toFixed(4)}  ${names.get(`${hit.lat},${hit.lng}`)}` : "NOT FOUND or too far"}`);
    }
  }
  writeFileSync(new URL("../lib/idea-locations.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
}
main();
