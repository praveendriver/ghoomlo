"use client";

import { useActionState } from "react";
import { useIdeaAction } from "@/app/actions/start";
import type { FormState } from "@/app/actions/state";
import { describe, Field } from "./Field";
import { SubmitButton } from "./SubmitButton";

export function UseIdeaForm({ slug, defaultOrigin, today, days }: { slug: string; defaultOrigin: string; today: string; days: number }) {
  const [state, action] = useActionState<FormState, FormData>(useIdeaAction, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="slug" value={slug} />
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <div className="grid-2">
        <Field id="startDate" label="Start date" hint={`The plan runs for ${days} days from this date.`} error={fe.startDate}>
          <input type="date" name="startDate" min={today} defaultValue={v.startDate} required {...describe("startDate", true, fe.startDate)} />
        </Field>
        <Field id="origin" label="Travelling from" error={fe.origin}>
          <input type="text" name="origin" defaultValue={v.origin ?? defaultOrigin} required {...describe("origin", false, fe.origin)} />
        </Field>
      </div>
      <div>
        <SubmitButton pendingLabel="Adding…">Use this plan</SubmitButton>
      </div>
    </form>
  );
}
