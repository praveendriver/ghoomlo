"use server";

import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { endSession, requireUser } from "@/lib/auth/session";
import { deleteUser, findUserByEmail } from "@/lib/data/users";
import type { FormState } from "./state";

export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const record = await findUserByEmail(user.email);
  const password = String(form.get("password") ?? "");
  if (!record || !(await verifyPassword(password, record.passwordHash))) {
    return { error: "That password is not correct. Nothing was deleted." };
  }
  await endSession();
  await deleteUser(user.id);
  redirect("/?deleted=1");
}
