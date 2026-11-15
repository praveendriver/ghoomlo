import "server-only";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { eachDate } from "@/lib/dates";
import type { HouseholdInput, TripInput } from "@/lib/validation";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { draftSchema } from "./schema";
import type { Itinerary, ItineraryDraft } from "./schema";

export const ITINERARY_MODEL = "claude-opus-5-5";

export type GenerateResult =
  | { ok: true; itinerary: Itinerary; model: string }
  | { ok: false; error: string };

/** Minimal surface of the SDK we use, so tests can supply a stand-in. */
export type DraftClient = {
  beta: { messages: { parse: Anthropic["beta"]["messages"]["parse"] } };
};

export function isGenerationConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * Attach ids and calendar dates, and make the draft line up with the trip:
 * exactly one day per date, in order. Returns null if the day count is wrong.
 */
export function finaliseDraft(draft: ItineraryDraft, trip: TripInput): Itinerary | null {
  const dates = eachDate(trip.startDate, trip.endDate);
  if (draft.days.length !== dates.length) return null;
  return {
    summary: draft.summary,
    thingsToVerify: draft.thingsToVerify,
    assumptions: draft.assumptions,
    days: draft.days.map((day, i) => ({
      dayNumber: i + 1,
      date: dates[i],
      title: day.title,
      items: day.items.map((item) => ({ ...item, id: randomUUID() })),
    })),
  };
}

export async function generateItinerary(
  trip: TripInput,
  household: HouseholdInput | null,
  client?: DraftClient,
): Promise<GenerateResult> {
  if (!client && !isGenerationConfigured()) {
    return { ok: false, error: "Plan drafting is not set up on this server yet." };
  }
  const anthropic = client ?? new Anthropic();
  try {
    const response = await anthropic.beta.messages.parse({
      model: ITINERARY_MODEL,
      max_tokens: 20000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(draftSchema) },
      // If the primary model declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(trip, household) }],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "We could not draft a plan for this trip. Try changing the trip notes." };
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return { ok: false, error: "The plan came back incomplete. Please try again." };
    }
    const itinerary = finaliseDraft(response.parsed_output, trip);
    if (!itinerary) {
      return { ok: false, error: "The plan did not cover every day of the trip. Please try again." };
    }
    return { ok: true, itinerary, model: response.model };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "We are handling a lot of requests right now. Try again in a minute." };
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("Itinerary generation credentials rejected", err.status);
      return { ok: false, error: "Plan drafting is not set up correctly on this server." };
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return { ok: false, error: "We could not reach the planning service. Please try again." };
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Itinerary generation failed", err.status, err.message);
      return { ok: false, error: "Something went wrong while drafting the plan. Please try again." };
    }
    throw err;
  }
}
