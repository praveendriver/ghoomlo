"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { fareWatchSignupAction } from "@/app/actions/fare-watch";
import type { FormState } from "@/app/actions/state";
import { DESTINATIONS, MAX_WISHLIST } from "@/lib/fare-watch";
import { DESTINATION_PHOTOS } from "@/lib/photos";
import { CITIES, SCHOOLS } from "@/lib/schools";
import type { City } from "@/lib/schools";
import { SubmitButton } from "./SubmitButton";

export function FareWatchForm() {
  const [state, action] = useActionState<FormState, FormData>(fareWatchSignupAction, {});
  const [city, setCity] = useState<City | "">("");
  const [school, setSchool] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const fe = state.fieldErrors ?? {};
  const full = picked.length >= MAX_WISHLIST;

  return (
    <form action={action} className="stack-lg fw-form" noValidate>
      {/* Hidden from people; catches automated form-fillers. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset className="stack-sm">
        <legend className="fw-step">
          <span>1</span> Where do you fly from?
        </legend>
        <div className="checks">
          {CITIES.map((c) => (
            <label className="check" key={c}>
              <input
                type="radio"
                name="homeCity"
                value={c}
                checked={city === c}
                onChange={() => {
                  setCity(c);
                  setSchool("");
                }}
              />
              {c}
            </label>
          ))}
        </div>
        {fe.homeCity && (
          <span className="error-text" role="alert">
            {fe.homeCity}
          </span>
        )}
      </fieldset>

      <div className="stack-sm">
        <label htmlFor="school" className="fw-step">
          <span>2</span> Your child&apos;s school
        </label>
        <select
          id="school"
          name="school"
          value={school}
          disabled={!city}
          onChange={(e) => setSchool(e.target.value)}
          aria-invalid={fe.school ? true : undefined}
          aria-describedby={fe.school ? "school-error" : "school-hint"}
        >
          <option value="">{city ? "Choose a school" : "Pick your city first"}</option>
          {city && SCHOOLS[city].map((s) => <option key={s}>{s}</option>)}
          {city && <option value="other">My school isn&apos;t listed</option>}
        </select>
        {school === "other" && (
          <input type="text" name="schoolOther" aria-label="School name" placeholder="Type the school's name" maxLength={120} autoFocus />
        )}
        <span className="hint" id="school-hint">
          So we can time alerts around its holidays.
        </span>
        {fe.school && (
          <span className="error-text" id="school-error" role="alert">
            {fe.school}
          </span>
        )}
      </div>

      <fieldset className="stack-sm">
        <legend className="fw-step">
          <span>3</span> Where would you love to go?
        </legend>
        <span className="hint" role="status">
          Pick up to {MAX_WISHLIST}. {picked.length > 0 && `${picked.length} picked.`}
        </span>
        <div className="pick-grid">
          {DESTINATIONS.map((place) => {
            const on = picked.includes(place);
            return (
              <label className="pick" key={place}>
                <input
                  type="checkbox"
                  name="wishlist"
                  value={place}
                  checked={on}
                  disabled={!on && full}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, place] : picked.filter((p) => p !== place))}
                />
                <Image src={DESTINATION_PHOTOS[place]} alt="" fill sizes="(max-width: 600px) 45vw, 190px" />
                <span className="pick-tick" aria-hidden="true">
                  ✓
                </span>
                <span className="pick-name">{place}</span>
              </label>
            );
          })}
        </div>
        {fe.wishlist && (
          <span className="error-text" role="alert">
            {fe.wishlist}
          </span>
        )}
      </fieldset>

      <div className="stack-sm">
        <label htmlFor="email" className="fw-step">
          <span>4</span> Where should we send alerts?
        </label>
        <div className="fw-submit">
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Your email address"
            defaultValue={state.values?.email}
            required
            aria-invalid={fe.email ? true : undefined}
            aria-describedby={fe.email ? "email-error" : "email-note"}
          />
          <SubmitButton className="btn accent" pendingLabel="Setting up…">
            Set alerts
          </SubmitButton>
        </div>
        {fe.email && (
          <span className="error-text" id="email-error" role="alert">
            {fe.email}
          </span>
        )}
        <span className="hint" id="email-note">
          By setting alerts you agree to get fare emails from Ghoomlo. Stop any time. <a href="/privacy">Privacy notice</a>.
        </span>
      </div>
    </form>
  );
}
