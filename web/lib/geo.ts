export type LatLng = { lat: number; lng: number };

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * A place search can match a same-named place elsewhere. Anything further
 * than this from the destination is treated as a wrong match and gets no pin.
 */
export const MAX_KM_FROM_DESTINATION = 350;

export function plausible(place: LatLng, destination: LatLng): boolean {
  return distanceKm(place, destination) <= MAX_KM_FROM_DESTINATION;
}

export type Lookup = (query: string) => Promise<LatLng | null>;

/**
 * Find coordinates for each named place at a destination. Places that cannot
 * be found, or that land implausibly far away, are simply left out.
 */
export async function locatePlaces(
  destination: string,
  placeNames: string[],
  lookup: Lookup,
  maxLookups = 20,
): Promise<Map<string, LatLng>> {
  const found = new Map<string, LatLng>();
  const centre = await lookup(destination);
  if (!centre) return found;
  const unique = [...new Set(placeNames)].slice(0, maxLookups);
  for (const name of unique) {
    const query = name.toLowerCase().includes(destination.toLowerCase()) ? name : `${name}, ${destination}`;
    const hit = await lookup(query);
    if (hit && plausible(hit, centre)) found.set(name, hit);
  }
  return found;
}
