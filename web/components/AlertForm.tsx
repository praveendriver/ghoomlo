"use client";

import { useActionState } from "react";
import { createAlertAction } from "@/app/actions/fare-watch";
import type { FormState } from "@/app/actions/state";
import { BREAKS } from "@/lib/fare-watch";
import { describe, Field } from "./Field";
import { SubmitButton } from "./SubmitButton";

export function AlertForm({ today }: { today: string }) {
  const [state, action] = useActionState<FormState, FormData>(createAlertAction, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="stack" noValidate>
      {state.saved && (
        <p className="notice ok" role="status">
          Alert created. It is listed below with its tracked link.
        </p>
      )}
      <div className="grid-2">
        <Field id="origin" label="From (city)" hint="Must match the city people typed, e.g. Bengaluru." error={fe.origin}>
          <input type="text" name="origin" defaultValue={v.origin} required {...describe("origin", true, fe.origin)} />
        </Field>
        <Field id="destination" label="To (place)" hint="Must match a wishlist place, e.g. Goa." error={fe.destination}>
          <input type="text" name="destination" defaultValue={v.destination} required {...describe("destination", true, fe.destination)} />
        </Field>
      </div>
      <div className="grid-2">
        <Field id="breakLabel" label="For which break" error={fe.breakLabel}>
          <select name="breakLabel" defaultValue={v.breakLabel ?? BREAKS[0]} {...describe("breakLabel", false, fe.breakLabel)}>
            {BREAKS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <Field id="priceInr" label="Fare per person (₹)" error={fe.priceInr}>
          <input type="number" name="priceInr" inputMode="numeric" min={100} defaultValue={v.priceInr} required {...describe("priceInr", false, fe.priceInr)} />
        </Field>
      </div>
      <div className="grid-2">
        <Field id="seenOn" label="Date you saw it" error={fe.seenOn}>
          <input type="date" name="seenOn" max={today} defaultValue={v.seenOn ?? today} required {...describe("seenOn", false, fe.seenOn)} />
        </Field>
        <Field id="source" label="Where you saw it" hint="The site or airline, e.g. IndiGo website." error={fe.source}>
          <input type="text" name="source" defaultValue={v.source} required {...describe("source", true, fe.source)} />
        </Field>
      </div>
      <Field id="targetUrl" label="Booking link" hint="The full https:// address people should land on." error={fe.targetUrl}>
        <input type="text" name="targetUrl" inputMode="url" defaultValue={v.targetUrl} required {...describe("targetUrl", true, fe.targetUrl)} />
      </Field>
      <div>
        <SubmitButton pendingLabel="Creating…">Create alert</SubmitButton>
      </div>
    </form>
  );
}
