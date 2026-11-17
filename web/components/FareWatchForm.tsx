"use client";

import { useActionState, useState } from "react";
import { fareWatchSignupAction } from "@/app/actions/fare-watch";
import type { FormState } from "@/app/actions/state";
import { BOARDS, BREAKS, HOME_CITIES, MAX_WISHLIST, WISHLIST_IDEAS } from "@/lib/fare-watch";
import { describe, Field } from "./Field";
import { SubmitButton } from "./SubmitButton";

export function FareWatchForm() {
  const [state, action] = useActionState<FormState, FormData>(fareWatchSignupAction, {});
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [breaks, setBreaks] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const full = wishlist.length >= MAX_WISHLIST;

  const add = (raw: string) => {
    const place = raw.trim();
    if (place.length < 2 || full) return;
    if (!wishlist.some((w) => w.toLowerCase() === place.toLowerCase())) setWishlist([...wishlist, place]);
    setDraft("");
  };

  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="wishlist" value={JSON.stringify(wishlist)} />
      {/* Hidden from people; catches automated form-fillers. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid-2">
        <Field id="email" label="Your email" hint="Where we send fare alerts." error={fe.email}>
          <input type="email" name="email" autoComplete="email" defaultValue={v.email} required {...describe("email", true, fe.email)} />
        </Field>
        <Field id="homeCity" label="City you fly from" error={fe.homeCity}>
          <input type="text" name="homeCity" list="home-cities" defaultValue={v.homeCity} required {...describe("homeCity", false, fe.homeCity)} />
          <datalist id="home-cities">
            {HOME_CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="grid-2">
        <Field id="school" label="Your child's school" hint="So alerts match its holidays. Name and area is enough." error={fe.school}>
          <input type="text" name="school" defaultValue={v.school} required {...describe("school", true, fe.school)} />
        </Field>
        <Field id="board" label="Board (optional)" error={fe.board}>
          <select name="board" defaultValue={v.board ?? ""} {...describe("board", false, fe.board)}>
            <option value="">Not sure</option>
            {BOARDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="stack-sm">
        <legend className="legend">Which breaks do you want fares for?</legend>
        <div className="checks">
          {BREAKS.map((name) => (
            <label className="check" key={name}>
              <input
                type="checkbox"
                name="breaks"
                value={name}
                checked={breaks.includes(name)}
                onChange={(e) => setBreaks(e.target.checked ? [...breaks, name] : breaks.filter((b) => b !== name))}
              />
              {name}
            </label>
          ))}
        </div>
        {fe.breaks && (
          <span className="error-text" role="alert">
            {fe.breaks}
          </span>
        )}
      </fieldset>

      <fieldset className="stack-sm">
        <legend className="legend">Where would you like to go?</legend>
        <span className="hint">Add up to {MAX_WISHLIST} places. We only alert you about these.</span>
        {wishlist.length > 0 && (
          <ul className="checks" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {wishlist.map((place) => (
              <li key={place} className="tag">
                {place}
                <button type="button" onClick={() => setWishlist(wishlist.filter((w) => w !== place))} aria-label={`Remove ${place}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="list-row single">
          <input
            type="text"
            aria-label="Add a place"
            placeholder={full ? "That's the maximum" : "Type a place and press Add"}
            value={draft}
            disabled={full}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
          />
          <button type="button" className="btn quiet" disabled={full || draft.trim().length < 2} onClick={() => add(draft)}>
            Add
          </button>
        </div>
        <div className="checks">
          {WISHLIST_IDEAS.filter((p) => !wishlist.includes(p)).map((place) => (
            <button type="button" key={place} className="chip" disabled={full} onClick={() => add(place)}>
              + {place}
            </button>
          ))}
        </div>
        {fe.wishlist && (
          <span className="error-text" role="alert">
            {fe.wishlist}
          </span>
        )}
      </fieldset>

      <Field id="travellers" label="How many of you travel? (optional)" hint="So we can show the fare for your whole family." error={fe.travellers}>
        <input type="number" name="travellers" inputMode="numeric" min={1} max={12} defaultValue={v.travellers} style={{ maxWidth: 160 }} {...describe("travellers", true, fe.travellers)} />
      </Field>

      <div className="stack-sm">
        <label className="consent">
          <input type="checkbox" name="consent" value="yes" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Email me fare alerts for these places. I can stop at any time. See our <a href="/privacy">privacy notice</a>.
          </span>
        </label>
        {fe.consent && (
          <span className="error-text" role="alert">
            {fe.consent}
          </span>
        )}
      </div>

      <div>
        <SubmitButton className="btn accent" pendingLabel="Signing you up…">
          Start my fare watch
        </SubmitButton>
      </div>
    </form>
  );
}
