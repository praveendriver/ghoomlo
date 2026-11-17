import { z } from "zod";
import { CITIES } from "@/lib/schools";

/** Every sign-up is watched for all of these; alerts are tagged with one. */
export const BREAKS = [
  "Winter break (December)",
  "Summer break (April to June)",
  "Dussehra and Diwali break",
  "Long weekends",
] as const;

/** Places offered as picture cards. Photos are matched by name in lib/photos.ts. */
export const DESTINATIONS = [
  "Goa",
  "Kerala",
  "Jaipur",
  "Udaipur",
  "Kashmir",
  "Ladakh",
  "Manali",
  "Andamans",
  "Agra",
  "Varanasi",
  "Dubai",
  "Singapore",
  "Thailand",
  "Bali",
  "Maldives",
  "Vietnam",
] as const;
export const MAX_WISHLIST = 5;

const city = z.enum(CITIES, { error: "Pick your city" });
const destination = z.enum(DESTINATIONS);

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254)),
  homeCity: city,
  school: z.string().trim().min(2, "Pick or type your child's school").max(120),
  wishlist: z
    .array(destination)
    .min(1, "Pick at least one place")
    .max(MAX_WISHLIST, `Pick up to ${MAX_WISHLIST} places`)
    .transform((list) => [...new Set(list)]),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const alertSchema = z.object({
  origin: city,
  destination,
  breakLabel: z.enum(BREAKS),
  priceInr: z.coerce.number().int().min(100, "Enter the fare in rupees").max(10_000_000),
  seenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date you saw this fare"),
  source: z.string().trim().min(2, "Say where you saw it").max(80),
  // Where the tracked link sends people. Only secure web addresses are accepted.
  targetUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((u) => {
      try {
        return new URL(u).protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a full https:// booking link"),
});
export type AlertInput = z.infer<typeof alertSchema>;

/** A sign-up should hear about an alert when it leaves from their city for a place on their wishlist. */
export function matches(
  signup: { homeCity: string; wishlist: string[]; breaks: string[] },
  alert: { origin: string; destination: string; breakLabel: string },
): boolean {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return (
    same(signup.homeCity, alert.origin) &&
    signup.wishlist.some((w) => same(w, alert.destination)) &&
    signup.breaks.includes(alert.breakLabel)
  );
}

/** How many of these records were created in the last `days` days. */
export function countRecent(rows: { createdAt: Date }[], days: number): number {
  const cutoff = Date.now() - days * 86_400_000;
  return rows.filter((r) => r.createdAt.getTime() > cutoff).length;
}
