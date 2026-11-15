"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/state";
import { createTripAction } from "@/app/actions/trips";
import { BLOCK_KINDS, MAX_FLEX_DAYS, MAX_TRIP_DAYS } from "@/lib/validation";
import type { BlockedDate } from "@/lib/validation";
import { describe, Field } from "./Field";
import { SubmitButton } from "./SubmitButton";

const KIND_LABELS: Record<BlockedDate["kind"], string> = { school: "School", work: "Work", other: "Other" };

export function TripForm({ defaultOrigin, today }: { defaultOrigin: string; today: string }) {
  const [state, action] = useActionState<FormState, FormData>(createTripAction, {});
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const update = (i: number, patch: Partial<BlockedDate>) =>
    setBlocked(blocked.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="blockedDates" value={JSON.stringify(blocked.filter((b) => b.date))} />

      <div className="grid-2">
        <Field id="destination" label="Where to?" hint="A city or region, such as Goa or Udaipur." error={fe.destination}>
          <input type="text" name="destination" defaultValue={v.destination} required {...describe("destination", true, fe.destination)} />
        </Field>
        <Field id="origin" label="Travelling from" error={fe.origin}>
          <input type="text" name="origin" defaultValue={v.origin ?? defaultOrigin} required {...describe("origin", false, fe.origin)} />
        </Field>
      </div>

      <div className="grid-2">
        <Field id="startDate" label="Start date" error={fe.startDate}>
          <input type="date" name="startDate" min={today} defaultValue={v.startDate} required {...describe("startDate", false, fe.startDate)} />
        </Field>
        <Field id="endDate" label="Return date" hint={`Up to ${MAX_TRIP_DAYS} days for now.`} error={fe.endDate}>
          <input type="date" name="endDate" min={today} defaultValue={v.endDate} required {...describe("endDate", true, fe.endDate)} />
        </Field>
      </div>

      <Field
        id="flexDays"
        label="How flexible are these dates?"
        hint="If your dates clash with a blocked day, we will suggest nearby dates within this range."
        error={fe.flexDays}
      >
        <select name="flexDays" defaultValue={v.flexDays ?? "0"} {...describe("flexDays", true, fe.flexDays)}>
          <option value="0">Fixed dates</option>
          {Array.from({ length: MAX_FLEX_DAYS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Up to {n} {n === 1 ? "day" : "days"} earlier or later
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="stack-sm">
        <legend className="legend">Days you cannot travel (optional)</legend>
        <span className="hint">School days, important meetings, and anything else that cannot move.</span>
        {blocked.map((b, i) => (
          <div className="list-row" key={i}>
            <input
              type="date"
              aria-label={`Blocked day ${i + 1} date`}
              value={b.date}
              onChange={(e) => update(i, { date: e.target.value })}
            />
            <select
              aria-label={`Blocked day ${i + 1} reason`}
              value={b.kind}
              onChange={(e) => update(i, { kind: e.target.value as BlockedDate["kind"] })}
            >
              {BLOCK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn quiet"
              onClick={() => setBlocked(blocked.filter((_, j) => j !== i))}
              aria-label={`Remove blocked day ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="btn quiet"
            disabled={blocked.length >= 60}
            onClick={() => setBlocked([...blocked, { date: "", kind: "school" }])}
          >
            + Add a blocked day
          </button>
        </div>
        {fe.blockedDates && (
          <span className="error-text" role="alert">
            {fe.blockedDates}
          </span>
        )}
      </fieldset>

      <Field
        id="pendingDependencies"
        label="Anything still undecided? (optional)"
        hint="For example: waiting on a visa, or leave not yet approved."
        error={fe.pendingDependencies}
      >
        <input type="text" name="pendingDependencies" maxLength={300} defaultValue={v.pendingDependencies} {...describe("pendingDependencies", true, fe.pendingDependencies)} />
      </Field>

      <Field
        id="budgetInr"
        label="Total budget in ₹ (optional)"
        hint="For everyone travelling, including travel and stay."
        error={fe.budgetInr}
      >
        <input type="number" name="budgetInr" inputMode="numeric" min={1000} step={1000} defaultValue={v.budgetInr} {...describe("budgetInr", true, fe.budgetInr)} />
      </Field>

      <Field
        id="notes"
        label="What do you want from this trip? (optional)"
        hint="Must-sees, things to avoid, the occasion — in your own words."
        error={fe.notes}
      >
        <textarea name="notes" maxLength={1000} defaultValue={v.notes} {...describe("notes", true, fe.notes)} />
      </Field>

      <div>
        <SubmitButton pendingLabel="Saving…">Save trip</SubmitButton>
      </div>
    </form>
  );
}
