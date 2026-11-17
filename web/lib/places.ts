import climate from "@/data/climate.json";

/** One representative point per origin city or destination (from data/climate.json). */
export type Point = { name: string; lat: number; lon: number };

const PLACES = climate.places as Record<string, { lat: number; lon: number }>;

export function pointFor(name: string): Point | null {
  const p = PLACES[name];
  return p ? { name, lat: p.lat, lon: p.lon } : null;
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** The supported home city nearest to a location, with how far away it is. */
export function nearestCity<T extends string>(cities: readonly T[], at: { lat: number; lon: number }): { city: T; km: number } {
  return cities
    .map((city) => ({ city, km: Math.round(km(at, PLACES[city])) }))
    .sort((a, b) => a.km - b.km)[0];
}
