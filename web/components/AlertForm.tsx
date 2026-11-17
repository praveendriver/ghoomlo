"use client";

import { useActionState } from "react";
import { createAlertAction } from "@/app/actions/fare-watch";
import type { FormState } from "@/app/actions/state";
import { DESTINATIONS } from "@/lib/fare-watch";
import { CITIES } from "@/lib/schools";
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
        <Field id="origin" label="From" error={fe.origin}>
          <select name="origin" defaultValue={v.origin ?? CITIES[0]} {...describe("origin", false, fe.origin)}>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field id="destination" label="To" error={fe.destination}>
          <select name="destination" defaultValue={v.destination ?? DESTINATIONS[0]} {...describe("destination", false, fe.destination)}>
            {DESTINATIONS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid-2">
        <Field id="travelStart" label="Departure date" error={fe.travelStart}>
          <input type="date" name="travelStart" min={today} defaultValue={v.travelStart} required {...describe("travelStart", false, fe.travelStart)} />
        </Field>
        <Field id="travelEnd" label="Return date" error={fe.travelEnd}>
          <input type="date" name="travelEnd" min={today} defaultValue={v.travelEnd} required {...describe("travelEnd", false, fe.travelEnd)} />
        </Field>
      </div>
      <div className="grid-2">
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
