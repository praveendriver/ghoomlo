import { z } from "zod";

export const PACES = ["relaxed", "balanced", "packed"] as const;
export const DIETS = [
  "none",
  "vegetarian",
  "vegetarian_no_egg",
  "vegan",
  "jain",
  "halal",
  "other",
] as const;
export const AGE_GROUPS = ["infant", "child", "teen", "adult", "senior"] as const;
export const BLOCK_KINDS = ["school", "work", "other"] as const;
export const INTERESTS = [
  "Food",
  "Culture and history",
  "Nature",
  "Beaches",
  "Mountains",
  "Wildlife",
  "Adventure",
  "Temples and pilgrimage",
  "Shopping",
  "Wellness",
] as const;

export const DIET_LABELS: Record<(typeof DIETS)[number], string> = {
  none: "No restriction",
  vegetarian: "Vegetarian (eggs fine)",
  vegetarian_no_egg: "Vegetarian, no egg",
  vegan: "Vegan",
  jain: "Jain",
  halal: "Halal",
  other: "Other (describe below)",
};
export const AGE_LABELS: Record<(typeof AGE_GROUPS)[number], string> = {
  infant: "Infant (under 2)",
  child: "Child (2–12)",
  teen: "Teen (13–17)",
  adult: "Adult",
  senior: "Senior (60+)",
};
export const PACE_LABELS: Record<(typeof PACES)[number], string> = {
  relaxed: "Relaxed — one or two things a day",
  balanced: "Balanced",
  packed: "Packed — see as much as possible",
};

export const MAX_TRIP_DAYS = 10;
export const MAX_FLEX_DAYS = 3;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Enter a valid date");

export const travellerSchema = z.object({
  ageGroup: z.enum(AGE_GROUPS),
});
export type Traveller = z.infer<typeof travellerSchema>;

export const blockedDateSchema = z.object({
  date: isoDate,
  kind: z.enum(BLOCK_KINDS),
});
export type BlockedDate = z.infer<typeof blockedDateSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254)),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(200, "Use at most 200 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password").max(200),
});

export const householdSchema = z.object({
  homeCity: z.string().trim().min(2, "Enter the city you usually travel from").max(80),
  travellers: z.array(travellerSchema).min(1, "Add at least one traveller").max(12),
  pace: z.enum(PACES),
  diet: z.enum(DIETS),
  dietNotes: z.string().trim().max(500),
  accessibilityNotes: z.string().trim().max(500),
  interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
});
export type HouseholdInput = z.infer<typeof householdSchema>;

export const tripSchema = z
  .object({
    destination: z.string().trim().min(2, "Enter where you want to go").max(80),
    origin: z.string().trim().min(2, "Enter where you are travelling from").max(80),
    startDate: isoDate,
    endDate: isoDate,
    flexDays: z.coerce.number().int().min(0).max(MAX_FLEX_DAYS),
    blockedDates: z.array(blockedDateSchema).max(60),
    pendingDependencies: z.string().trim().max(300),
    budgetInr: z
      .union([z.literal(""), z.coerce.number().int().min(1000, "Enter at least ₹1,000").max(100_000_000)])
      .transform((v) => (v === "" ? null : v)),
    notes: z.string().trim().max(1000),
  })
  .superRefine((t, ctx) => {
    if (t.endDate < t.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Return date is before the start date" });
      return;
    }
    const days = (Date.parse(t.endDate) - Date.parse(t.startDate)) / 86_400_000 + 1;
    if (days > MAX_TRIP_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: `Trips can be up to ${MAX_TRIP_DAYS} days for now`,
      });
    }
  });
export type TripInput = z.infer<typeof tripSchema>;

export type FieldErrors = Record<string, string>;

/** First message per top-level field, for showing next to form inputs. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
