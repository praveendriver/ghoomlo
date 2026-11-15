"use server";

import { redirect } from "next/navigation";
import { currentUser, requireUser } from "@/lib/auth/session";
import { createTrip, saveItinerary } from "@/lib/data/trips";
import { addDays, todayIso } from "@/lib/dates";
import { findIdea, ideaToItinerary, SAMPLE_MODEL } from "@/lib/ideas";
import { MAX_INTENT_CHARS } from "@/lib/prefill";
import { prepareTripFromText } from "@/lib/start";
import { saveIntent } from "@/lib/start-cookies";
import type { FormState } from "./state";

/** The "describe your trip" box on the home page. Works signed in or out. */
export async function startFromTextAction(_prev: FormState, form: FormData): Promise<FormState> {
  const text = String(form.get("text") ?? "").trim().slice(0, MAX_INTENT_CHARS);
  if (text.length < 3) return { error: "Tell us a little about the trip you have in mind." };

  const user = await currentUser();
  if (!user) {
    await saveIntent(text);
    redirect("/signup?start=1");
  }
  await prepareTripFromText(user.id, text);
  redirect("/trips/new");
}

/** Copy a sample plan into the signed-in user's trips. */
export async function useIdeaAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const idea = findIdea(String(form.get("slug")));
  if (!idea) return { error: "That sample plan no longer exists." };

  const values = { startDate: String(form.get("startDate") ?? ""), origin: String(form.get("origin") ?? "").trim() };
  const fieldErrors: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.startDate) || Number.isNaN(Date.parse(values.startDate))) {
    fieldErrors.startDate = "Choose a start date";
  } else if (values.startDate < todayIso()) {
    fieldErrors.startDate = "Start date is in the past";
  }
  if (values.origin.length < 2 || values.origin.length > 80) {
    fieldErrors.origin = "Enter where you are travelling from";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const endDate = addDays(values.startDate, idea.days.length - 1);
  const tripId = await createTrip(user.id, {
    destination: idea.destination,
    origin: values.origin,
    startDate: values.startDate,
    endDate,
    flexDays: 0,
    blockedDates: [],
    pendingDependencies: "",
    budgetInr: null,
    notes: "",
  });
  await saveItinerary(user.id, tripId, {
    model: SAMPLE_MODEL,
    startDate: values.startDate,
    endDate,
    data: ideaToItinerary(idea, values.startDate),
  });
  redirect(`/trips/${tripId}`);
}
