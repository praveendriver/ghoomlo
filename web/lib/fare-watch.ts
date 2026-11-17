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
  windowIds: z.array(z.string().max(40)).max(40),
  wishlist: z
    .array(destination)
    .min(1, "Pick at least one place")
    .max(MAX_WISHLIST, `Pick up to ${MAX_WISHLIST} places`)
    .transform((list) => [...new Set(list)]),
});
export type SignupInput = z.infer<typeof signupSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date");

export const alertSchema = z
  .object({
    origin: city,
    destination,
    travelStart: isoDate,
    travelEnd: isoDate,
    priceInr: z.coerce.number().int().min(100, "Enter the fare in rupees").max(10_000_000),
    seenOn: isoDate,
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
  })
  .refine((a) => a.travelEnd >= a.travelStart, { path: ["travelEnd"], message: "Return is before departure" });
export type AlertInput = z.infer<typeof alertSchema>;

type WindowLike = { start: string; end: string | null };

/**
 * A sign-up should hear about an alert when it leaves from their city for a
 * place on their wishlist, and the trip fits a window they picked. People who
 * picked no windows (older sign-ups) hear about every date.
 */
export function matches(
  signup: { homeCity: string; wishlist: string[]; windows?: WindowLike[] },
  alert: { origin: string; destination: string; travelStart?: string | null; travelEnd?: string | null },
): boolean {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  if (!same(signup.homeCity, alert.origin) || !signup.wishlist.some((w) => same(w, alert.destination))) return false;
  const windows = signup.windows ?? [];
  if (!windows.length || !alert.travelStart) return true;
  const end = alert.travelEnd ?? alert.travelStart;
  // Departure must fall inside the window, and the return no later than its end when the end is known.
  return windows.some((w) => alert.travelStart! >= w.start && alert.travelStart! <= (w.end ?? "9999-12-31") && (!w.end || end <= w.end));
}

/** How many of these records were created in the last `days` days. */
export function countRecent(rows: { createdAt: Date }[], days: number): number {
  const cutoff = Date.now() - days * 86_400_000;
  return rows.filter((r) => r.createdAt.getTime() > cutoff).length;
}

/** Dates a parent adds themselves on the year calendar or the cards. */
export const MAX_CUSTOM_WINDOWS = 6;
export const MAX_CUSTOM_DAYS = 60;

export function customWindowsSchema(today: string) {
  const last = new Date(Date.parse(`${today}T00:00:00Z`) + 400 * 86_400_000).toISOString().slice(0, 10);
  return z
    .array(
      z
        .object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
        .refine((w) => w.end >= w.start, "The last day is before the first")
        .refine((w) => w.start >= today && w.end <= last, "Pick dates within the next year")
        .refine(
          (w) => (Date.parse(w.end) - Date.parse(w.start)) / 86_400_000 + 1 <= MAX_CUSTOM_DAYS,
          `Keep each trip to ${MAX_CUSTOM_DAYS} days or fewer`,
        ),
    )
    .max(MAX_CUSTOM_WINDOWS, `Add up to ${MAX_CUSTOM_WINDOWS} of your own dates`);
}
