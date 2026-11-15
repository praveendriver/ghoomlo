"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "@/app/actions/account";
import type { FormState } from "@/app/actions/state";
import { describe, Field } from "./Field";
import { SubmitButton } from "./SubmitButton";

export function DeleteAccountForm() {
  const [state, action] = useActionState<FormState, FormData>(deleteAccountAction, {});
  return (
    <form action={action} className="stack-sm">
      <Field id="password" label="Enter your password to confirm" error={state.error}>
        <input type="password" name="password" autoComplete="current-password" required {...describe("password", false, state.error)} />
      </Field>
      <div>
        <SubmitButton className="btn danger" pendingLabel="Deleting…">
          Delete my account and all my data
        </SubmitButton>
      </div>
    </form>
  );
}
