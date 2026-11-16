import { z } from "zod";

/**
 * What the model returns. Kept to plain types and enums so it works as a
 * structured-output schema.
 */
export const draftItemSchema = z.object({
  timeOfDay: z.enum(["morning", "midday", "afternoon", "evening"]),
  kind: z.enum(["activity", "meal", "travel", "rest"]),
  title: z.string(),
  description: z.string(),
  placeName: z
    .string()
    .nullable()
    .describe("Name of a specific real place, or null when the item is not tied to one place."),
  estimatedCostInr: z
    .number()
    .nullable()
    .describe("Rough total cost for the whole party in INR, or null if you cannot estimate it."),
  durationMinutes: z.number().nullable(),
  fitNote: z
    .string()
    .describe("One sentence on how this suits the household's constraints, or an empty string."),
  checkBeforeYouGo: z
    .array(z.string())
    .describe("Specific things the traveller must confirm for this item, such as opening days or booking."),
});

export const draftSchema = z.object({
  summary: z.string(),
  days: z.array(
    z.object({
      dayNumber: z.number(),
      title: z.string(),
      items: z.array(draftItemSchema),
    }),
  ),
  thingsToVerify: z.array(z.object({ topic: z.string(), why: z.string() })),
  assumptions: z.array(z.string()),
});
export type ItineraryDraft = z.infer<typeof draftSchema>;

/** What we store: the draft plus stable ids and the calendar date of each day. */
export type ItineraryItem = z.infer<typeof draftItemSchema> & {
  id: string;
  /** Map coordinates from a place search, when the place was found near the destination. */
  location?: { lat: number; lng: number } | null;
};
export type ItineraryDay = { dayNumber: number; date: string; title: string; items: ItineraryItem[] };
export type Itinerary = {
  summary: string;
  days: ItineraryDay[];
  thingsToVerify: { topic: string; why: string }[];
  assumptions: string[];
};
