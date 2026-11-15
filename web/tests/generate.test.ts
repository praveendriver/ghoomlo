import { describe, expect, it } from "vitest";
import { finaliseDraft, generateItinerary } from "@/lib/itinerary/generate";
import type { DraftClient } from "@/lib/itinerary/generate";
import { buildUserMessage } from "@/lib/itinerary/prompt";
import type { ItineraryDraft } from "@/lib/itinerary/schema";
import type { HouseholdInput, TripInput } from "@/lib/validation";

const trip: TripInput = {
  destination: "Udaipur",
  origin: "Delhi",
  startDate: "2027-01-09",
  endDate: "2027-01-10",
  flexDays: 0,
  blockedDates: [],
  pendingDependencies: "",
  budgetInr: 60000,
  notes: "",
};
const household: HouseholdInput = {
  homeCity: "Delhi",
  travellers: [{ ageGroup: "adult" }, { ageGroup: "adult" }, { ageGroup: "child" }],
  pace: "relaxed",
  diet: "jain",
  dietNotes: "no root vegetables",
  accessibilityNotes: "",
  interests: ["Food"],
};
const item = {
  timeOfDay: "morning" as const,
  kind: "activity" as const,
  title: "Lakeside walk",
  description: "An easy walk.",
  placeName: null,
  estimatedCostInr: null,
  durationMinutes: 60,
  fitNote: "",
  checkBeforeYouGo: [],
};
const draft = (days: number): ItineraryDraft => ({
  summary: "Two easy days.",
  days: Array.from({ length: days }, (_, i) => ({ dayNumber: 99, title: `Day ${i + 1}`, items: [item, item] })),
  thingsToVerify: [],
  assumptions: [],
});

function stubClient(response: unknown): DraftClient {
  return { beta: { messages: { parse: (async () => response) as never } } };
}

describe("finaliseDraft", () => {
  it("assigns calendar dates, sequential day numbers, and unique item ids", () => {
    const plan = finaliseDraft(draft(2), trip)!;
    expect(plan.days.map((d) => [d.dayNumber, d.date])).toEqual([
      [1, "2027-01-09"],
      [2, "2027-01-10"],
    ]);
    const ids = plan.days.flatMap((d) => d.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(4);
  });

  it("rejects a draft that does not cover every day", () => {
    expect(finaliseDraft(draft(1), trip)).toBeNull();
    expect(finaliseDraft(draft(3), trip)).toBeNull();
  });
});

describe("generateItinerary", () => {
  it("returns a plan from a complete response", async () => {
    const result = await generateItinerary(
      trip,
      household,
      stubClient({ stop_reason: "end_turn", parsed_output: draft(2), model: "test-model" }),
    );
    expect(result).toMatchObject({ ok: true, model: "test-model" });
  });

  it("reports a refusal, a truncated reply, and a wrong day count as errors, not plans", async () => {
    for (const response of [
      { stop_reason: "refusal", parsed_output: null, model: "m" },
      { stop_reason: "max_tokens", parsed_output: draft(2), model: "m" },
      { stop_reason: "end_turn", parsed_output: null, model: "m" },
      { stop_reason: "end_turn", parsed_output: draft(5), model: "m" },
    ]) {
      expect((await generateItinerary(trip, household, stubClient(response))).ok).toBe(false);
    }
  });

  it("says so plainly when no API credentials are configured", async () => {
    expect(await generateItinerary(trip, household)).toEqual({
      ok: false,
      error: "Plan drafting is not set up on this server yet.",
    });
  });
});

describe("buildUserMessage", () => {
  it("includes the household's hard constraints and every trip date", () => {
    const message = buildUserMessage(trip, household);
    expect(message).toContain("Jain — no root vegetables");
    expect(message).toContain("1 × Child (2–12)");
    expect(message).toContain("day 2 = 2027-01-10");
  });

  it("tells the model to state its assumption when there is no household", () => {
    expect(buildUserMessage(trip, null)).toContain("Assume two adults");
  });
});
