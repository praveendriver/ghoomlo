"use server";

import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { endSession, startSession } from "@/lib/auth/session";
import {
  clearLoginFailures,
  createUser,
  findUserByEmail,
  MAX_LOGIN_FAILURES,
  recentLoginFailures,
  recordLoginFailure,
} from "@/lib/data/users";
import { safeNext } from "@/lib/prefill";
import { prepareTripFromText } from "@/lib/start";
import { takeIntent } from "@/lib/start-cookies";
import { fieldErrors, loginSchema, signupSchema } from "@/lib/validation";
import { textValues } from "./state";
import type { FormState } from "./state";

/**
 * Where to send someone who has just signed in. If they typed a trip
 * description before signing in, that takes priority over everything else.
 */
async function continueAfterAuth(userId: string, next: unknown, fallback: string): Promise<never> {
  const intent = await takeIntent();
  if (intent) {
    await prepareTripFromText(userId, intent);
    redirect("/trips/new");
  }
  redirect(safeNext(next) ?? fallback);
}

export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = textValues(form);
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const { name, email, password } = parsed.data;
  const user = await createUser({ name, email, passwordHash: await hashPassword(password) });
  if (!user) {
    return { fieldErrors: { email: "An account with this email already exists. Try signing in." }, values };
  }
  await startSession(user.id);
  return continueAfterAuth(user.id, form.get("next"), "/");
}

// Verified against when the email is unknown, so response time does not reveal
// whether an account exists.
const DUMMY_HASH = hashPassword("ghoomlo-timing-placeholder");

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = textValues(form);
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const { email, password } = parsed.data;
  if ((await recentLoginFailures(email)) >= MAX_LOGIN_FAILURES) {
    return { error: "Too many failed attempts. Wait 15 minutes and try again.", values };
  }
  const user = await findUserByEmail(email);
  const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
  if (!user || !ok) {
    await recordLoginFailure(email);
    return { error: "That email and password do not match.", values };
  }
  await clearLoginFailures(email);
  await startSession(user.id);
  return continueAfterAuth(user.id, form.get("next"), "/trips");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}
