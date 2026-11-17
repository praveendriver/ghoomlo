"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createAlert, deleteAlert, removeSignup, saveSignup } from "@/lib/data/fare-watch";
import { alertSchema, signupSchema } from "@/lib/fare-watch";
import { fieldErrors } from "@/lib/validation";
import { textValues } from "./state";
import type { FormState } from "./state";

export async function fareWatchSignupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = textValues(form);
  // A field real people never see or fill in; automated form-fillers usually do.
  if (String(form.get("website") ?? "") !== "") redirect("/fare-watch/thanks");

  const listed = String(form.get("school") ?? "");
  const parsed = signupSchema.safeParse({
    email: form.get("email"),
    homeCity: form.get("homeCity") ?? "",
    school: listed === "other" ? form.get("schoolOther") : listed,
    wishlist: form.getAll("wishlist"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const token = await saveSignup(parsed.data);
  redirect(`/fare-watch/thanks?t=${encodeURIComponent(token)}`);
}

export async function unsubscribeAction(form: FormData): Promise<void> {
  await removeSignup(String(form.get("token") ?? ""));
  redirect("/fare-watch/unsubscribe?done=1");
}

export async function createAlertAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const values = textValues(form);
  const parsed = alertSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  await createAlert(parsed.data);
  revalidatePath("/admin/fare-watch");
  return { saved: true };
}

export async function deleteAlertAction(form: FormData): Promise<void> {
  await requireAdmin();
  await deleteAlert(String(form.get("code") ?? ""));
  revalidatePath("/admin/fare-watch");
}
