"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { saveHousehold } from "@/lib/data/household";
import { fieldErrors, householdSchema } from "@/lib/validation";
import { textValues } from "./state";
import type { FormState } from "./state";

function parseJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value ?? "[]"));
  } catch {
    return null;
  }
}

export async function saveHouseholdAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = textValues(form);
  const parsed = householdSchema.safeParse({
    homeCity: form.get("homeCity"),
    travellers: parseJson(form.get("travellers")),
    pace: form.get("pace"),
    diet: form.get("diet"),
    dietNotes: form.get("dietNotes") ?? "",
    accessibilityNotes: form.get("accessibilityNotes") ?? "",
    interests: form.getAll("interests"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  await saveHousehold(user.id, parsed.data);
  revalidatePath("/household");
  if (form.get("next") === "trips") redirect("/trips/new");
  return { saved: true, values };
}
