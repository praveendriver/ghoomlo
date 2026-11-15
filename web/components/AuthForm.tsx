"use client";

import { useActionState } from "react";
import { loginAction, signupAction } from "@/app/actions/auth";
import type { FormState } from "@/app/actions/state";
import { describe, Field } from "./Field";
import { SubmitButton } from "./SubmitButton";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(
    mode === "signup" ? signupAction : loginAction,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="stack" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      {mode === "signup" && (
        <Field id="name" label="Your name" error={fe.name}>
          <input type="text" name="name" autoComplete="name" defaultValue={v.name} required {...describe("name", false, fe.name)} />
        </Field>
      )}
      <Field id="email" label="Email" error={fe.email}>
        <input type="email" name="email" autoComplete="email" defaultValue={v.email} required {...describe("email", false, fe.email)} />
      </Field>
      <Field
        id="password"
        label="Password"
        hint={mode === "signup" ? "At least 10 characters." : undefined}
        error={fe.password}
      >
        <input
          type="password"
          name="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          {...describe("password", mode === "signup", fe.password)}
        />
      </Field>
      <SubmitButton pendingLabel="One moment…">{mode === "signup" ? "Create account" : "Sign in"}</SubmitButton>
    </form>
  );
}
