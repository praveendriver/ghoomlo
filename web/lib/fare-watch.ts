import { z } from "zod";

export const BREAKS = [
  "Winter break (December)",
  "Summer break (April to June)",
  "Dussehra and Diwali break",
  "Long weekends",
] as const;

export const BOARDS = ["CBSE", "ICSE", "IB", "IGCSE", "State board", "Other"] as const;

export const HOME_CITIES = [
  "Bengaluru",
  "Mumbai",
  "Delhi NCR",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Kochi",
] as const;

export const WISHLIST_IDEAS = ["Goa", "Kerala", "Jaipur", "Udaipur", "Ladakh", "Andamans", "Dubai", "Singapore"] as const;
export const MAX_WISHLIST = 5;

const place = z.string().trim().min(2).max(60);

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254)),
  homeCity: z.string().trim().min(2, "Enter the city you fly from").max(60),
  school: z.string().trim().min(2, "Enter your child's school").max(120),
  board: z.union([z.literal(""), z.enum(BOARDS)]).transform((v) => v || null),
  breaks: z.array(z.enum(BREAKS)).min(1, "Pick at least one break"),
  wishlist: z
    .array(place)
    .min(1, "Add at least one place")
    .max(MAX_WISHLIST, `Add up to ${MAX_WISHLIST} places`)
    .transform((list) => [...new Map(list.map((p) => [p.toLowerCase(), p])).values()]),
  travellers: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(12)])
    .transform((v) => (v === "" ? null : v)),
  consent: z.literal("yes", { error: "Please agree so we can email you" }),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const alertSchema = z.object({
  origin: z.string().trim().min(2).max(60),
  destination: z.string().trim().min(2).max(60),
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

/** A signup should hear about an alert when it leaves from their city for a place on their wishlist. */
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
