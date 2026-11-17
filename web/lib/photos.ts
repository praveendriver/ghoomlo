import type { StaticImageData } from "next/image";
import agra from "@/images/dest-agra.jpg";
import andamans from "@/images/dest-andamans.jpg";
import bali from "@/images/dest-bali.jpg";
import dubai from "@/images/dest-dubai.jpg";
import kashmir from "@/images/dest-kashmir.jpg";
import maldives from "@/images/dest-maldives.jpg";
import manali from "@/images/dest-manali.jpg";
import singapore from "@/images/dest-singapore.jpg";
import thailand from "@/images/dest-thailand.jpg";
import varanasi from "@/images/dest-varanasi.jpg";
import vietnam from "@/images/dest-vietnam.jpg";
import goa from "@/images/goa.jpg";
import hawaMahal from "@/images/hawa-mahal.jpg";
import hero from "@/images/hero.jpg";
import jaipur from "@/images/jaipur.jpg";
import kerala from "@/images/kerala.jpg";
import ladakh from "@/images/ladakh.jpg";
import udaipur from "@/images/udaipur.jpg";

export const PHOTOS = { hero, goa, kerala, udaipur, jaipur, ladakh, hawaMahal };

const BY_DESTINATION: [RegExp, StaticImageData][] = [
  [/\bgoa\b/i, goa],
  [/\b(kerala|kochi|cochin|munnar|alleppey|alappuzha)\b/i, kerala],
  [/\budaipur\b/i, udaipur],
  [/\bjaipur\b/i, jaipur],
  [/\b(ladakh|leh|nubra)\b/i, ladakh],
];

/** A mood photo for a destination we have one for, otherwise null. */
export function photoFor(destination: string): StaticImageData | null {
  return BY_DESTINATION.find(([pattern]) => pattern.test(destination))?.[1] ?? null;
}

/** Card photos for the fare-watch destination picker, keyed by the names in DESTINATIONS. */
export const DESTINATION_PHOTOS: Record<string, StaticImageData> = {
  Goa: goa,
  Kerala: kerala,
  Jaipur: jaipur,
  Udaipur: udaipur,
  Kashmir: kashmir,
  Ladakh: ladakh,
  Manali: manali,
  Andamans: andamans,
  Agra: agra,
  Varanasi: varanasi,
  Dubai: dubai,
  Singapore: singapore,
  Thailand: thailand,
  Bali: bali,
  Maldives: maldives,
  Vietnam: vietnam,
};
