"use client";

import { useActionState, useState } from "react";
import { saveHouseholdAction } from "@/app/actions/household";
import type { FormState } from "@/app/actions/state";
import {
  AGE_GROUPS,
  AGE_LABELS,
  DIET_LABELS,
  DIETS,
  INTERESTS,
  PACE_LABELS,
  PACES,
} from "@/lib/validation";
import type { HouseholdInput, Traveller } from "@/lib/validation";
import { describe, Field } from "./Field";
import { SubmitButton } from "./SubmitButton";

export function HouseholdForm({ initial, firstTime }: { initial: HouseholdInput | null; firstTime: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(saveHouseholdAction, {});
  const [travellers, setTravellers] = useState<Traveller[]>(
    initial?.travellers.length ? initial.travellers : [{ ageGroup: "adult" }, { ageGroup: "adult" }],
  );
  const [interests, setInterests] = useState<string[]>(initial?.interests ?? []);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <form action={action} className="stack" noValidate>
      {state.saved && (
        <p className="notice ok" role="status">
          Saved. New plans will use these details.
        </p>
      )}
      {firstTime && <input type="hidden" name="next" value="trips" />}
      <input type="hidden" name="travellers" value={JSON.stringify(travellers)} />

      <Field id="homeCity" label="Home city" hint="Where you usually start your trips from." error={fe.homeCity}>
        <input
          type="text"
          name="homeCity"
          autoComplete="address-level2"
          defaultValue={v.homeCity ?? initial?.homeCity ?? ""}
          required
          {...describe("homeCity", true, fe.homeCity)}
        />
      </Field>

      <fieldset className="stack-sm">
        <legend className="legend">Who usually travels</legend>
        <span className="hint">Age groups only — we do not need names or dates of birth.</span>
        {travellers.map((t, i) => (
          <div className="list-row single" key={i}>
            <select
              aria-label={`Traveller ${i + 1} age group`}
              value={t.ageGroup}
              onChange={(e) =>
                setTravellers(travellers.map((x, j) => (j === i ? { ageGroup: e.target.value as Traveller["ageGroup"] } : x)))
              }
            >
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {AGE_LABELS[g]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn quiet"
              disabled={travellers.length === 1}
              onClick={() => setTravellers(travellers.filter((_, j) => j !== i))}
              aria-label={`Remove traveller ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="btn quiet"
            disabled={travellers.length >= 12}
            onClick={() => setTravellers([...travellers, { ageGroup: "adult" }])}
          >
            + Add a traveller
          </button>
        </div>
        {fe.travellers && (
          <span className="error-text" role="alert">
            {fe.travellers}
          </span>
        )}
      </fieldset>

      <div className="grid-2">
        <Field id="pace" label="Pace" error={fe.pace}>
          <select name="pace" defaultValue={v.pace ?? initial?.pace ?? "balanced"} {...describe("pace", false, fe.pace)}>
            {PACES.map((p) => (
              <option key={p} value={p}>
                {PACE_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="diet" label="Food" error={fe.diet}>
          <select name="diet" defaultValue={v.diet ?? initial?.diet ?? "none"} {...describe("diet", false, fe.diet)}>
            {DIETS.map((d) => (
              <option key={d} value={d}>
                {DIET_LABELS[d]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="dietNotes" label="Anything else about food (optional)" hint="Allergies, ingredients to avoid, and so on." error={fe.dietNotes}>
        <textarea name="dietNotes" maxLength={500} defaultValue={v.dietNotes ?? initial?.dietNotes ?? ""} {...describe("dietNotes", true, fe.dietNotes)} />
      </Field>
      <Field
        id="accessibilityNotes"
        label="Access needs (optional)"
        hint="For example: wheelchair user, cannot manage many stairs, needs frequent rest."
        error={fe.accessibilityNotes}
      >
        <textarea
          name="accessibilityNotes"
          maxLength={500}
          defaultValue={v.accessibilityNotes ?? initial?.accessibilityNotes ?? ""}
          {...describe("accessibilityNotes", true, fe.accessibilityNotes)}
        />
      </Field>

      <fieldset className="stack-sm">
        <legend className="legend">Interests (optional)</legend>
        <div className="checks">
          {INTERESTS.map((name) => (
            <label className="check" key={name}>
              <input
                type="checkbox"
                name="interests"
                value={name}
                checked={interests.includes(name)}
                onChange={(e) =>
                  setInterests(e.target.checked ? [...interests, name] : interests.filter((x) => x !== name))
                }
              />
              {name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <SubmitButton pendingLabel="Saving…">{firstTime ? "Save and plan a trip" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}
