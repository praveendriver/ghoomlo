"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getHousehold } from "@/lib/data/household";
import {
  createTrip,
  DAILY_PLAN_LIMIT,
  deleteTrip,
  getTrip,
  moveTripDates,
  plansInLastDay,
  removeItineraryItem,
  saveItinerary,
} from "@/lib/data/trips";
import { conflicts, feasibleWindows, todayIso } from "@/lib/dates";
import { addLocations } from "@/lib/geocode";
import { generateItinerary } from "@/lib/itinerary/generate";
import { clearPrefill } from "@/lib/start-cookies";
import { fieldErrors, householdSchema, tripSchema } from "@/lib/validation";
import { textValues } from "./state";
import type { FormState } from "./state";

export async function createTripAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = textValues(form);
  let blockedDates: unknown = null;
  try {
    blockedDates = JSON.parse(String(form.get("blockedDates") ?? "[]"));
  } catch {
    /* falls through to a validation error */
  }
  const parsed = tripSchema.safeParse({
    destination: form.get("destination"),
    origin: form.get("origin"),
    startDate: form.get("startDate"),
    endDate: form.get("endDate"),
    flexDays: form.get("flexDays") ?? "0",
    blockedDates,
    pendingDependencies: form.get("pendingDependencies") ?? "",
    budgetInr: form.get("budgetInr") ?? "",
    notes: form.get("notes") ?? "",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if (parsed.data.startDate < todayIso()) {
    return { fieldErrors: { startDate: "Start date is in the past" }, values };
  }

  const id = await createTrip(user.id, parsed.data);
  await clearPrefill();
  redirect(`/trips/${id}`);
}

export async function deleteTripAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await deleteTrip(user.id, String(form.get("tripId")));
  redirect("/trips");
}

/** Shift the trip to one of the windows that avoids the blocked dates. */
export async function moveTripAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const tripId = String(form.get("tripId"));
  const shift = Number(form.get("shiftDays"));
  const trip = await getTrip(user.id, tripId);
  if (!trip) return;
  // Recomputed here rather than trusted from the form.
  const target = feasibleWindows(
    trip.startDate,
    trip.endDate,
    trip.flexDays,
    trip.blockedDates,
    todayIso(),
  ).find((w) => w.shiftDays === shift);
  if (!target) return;
  await moveTripDates(user.id, tripId, target.startDate, target.endDate);
  revalidatePath(`/trips/${tripId}`);
}

export type PlanState = { error?: string };

export async function generatePlanAction(_prev: PlanState, form: FormData): Promise<PlanState> {
  const user = await requireUser();
  const tripId = String(form.get("tripId"));
  const trip = await getTrip(user.id, tripId);
  if (!trip) return { error: "This trip no longer exists." };

  if (conflicts(trip.startDate, trip.endDate, trip.blockedDates).length > 0) {
    return { error: "These dates include a day you marked as unavailable. Change the dates first." };
  }
  if ((await plansInLastDay(user.id)) >= DAILY_PLAN_LIMIT) {
    return { error: `You can draft up to ${DAILY_PLAN_LIMIT} plans a day. Try again tomorrow.` };
  }

  const stored = await getHousehold(user.id);
  const household = stored ? householdSchema.safeParse(stored) : null;
  const result = await generateItinerary(trip, household?.success ? household.data : null);
  if (!result.ok) return { error: result.error };

  await saveItinerary(user.id, tripId, {
    model: result.model,
    startDate: trip.startDate,
    endDate: trip.endDate,
    data: await addLocations(result.itinerary, trip.destination),
  });
  revalidatePath(`/trips/${tripId}`);
  return {};
}

export async function removeItemAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await removeItineraryItem(user.id, String(form.get("itineraryId")), String(form.get("itemId")));
  revalidatePath(`/trips/${String(form.get("tripId"))}`);
}
