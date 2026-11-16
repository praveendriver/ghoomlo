import type { StaticImageData } from "next/image";
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
