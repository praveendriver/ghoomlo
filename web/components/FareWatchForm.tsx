"use client";

import { useActionState, useMemo, useState } from "react";
import { fareWatchSignupAction } from "@/app/actions/fare-watch";
import type { FormState } from "@/app/actions/state";
import { DESTINATIONS, MAX_CUSTOM_DAYS, MAX_CUSTOM_WINDOWS, MAX_WISHLIST } from "@/lib/fare-watch";
import { CITIES, SCHOOLS } from "@/lib/schools";
import type { City } from "@/lib/schools";
import { calendarMonths, schoolEntry, windowsFor } from "@/lib/windows";
import { PlacePicker } from "./PlacePicker";
import { YearCalendar } from "./YearCalendar";
import type { CustomWindow } from "./YearCalendar";
import { SubmitButton } from "./SubmitButton";

export function FareWatchForm({ today }: { today: string }) {
  const [state, action] = useActionState<FormState, FormData>(fareWatchSignupAction, {});
  const [city, setCity] = useState<City | "">("");
  const [school, setSchool] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [custom, setCustom] = useState<CustomWindow[]>([]);
  const addCustom = (start: string, end: string): string | null => {
    if (start < today) return "Pick dates from today onwards";
    if (end < start) return "The last day is before the first";
    if ((Date.parse(end) - Date.parse(start)) / 86_400_000 + 1 > MAX_CUSTOM_DAYS) return `Keep each trip to ${MAX_CUSTOM_DAYS} days or fewer`;
    if (custom.length >= MAX_CUSTOM_WINDOWS) return `Add up to ${MAX_CUSTOM_WINDOWS} of your own dates`;
    const id = `custom-${start}-${end}`;
    if (custom.some((c) => c.id === id)) return "You've already added those dates";
    setCustom([...custom, { id, start, end }].sort((a, b) => a.start.localeCompare(b.start)));
    return null;
  };
  const schoolName = school === "other" ? "" : school;
  const windows = useMemo(() => (city ? windowsFor(city, schoolName, today) : []), [city, schoolName, today]);
  const months = useMemo(() => calendarMonths(today), [today]);
  const hasSchoolDates = Boolean(city && schoolName && schoolEntry(city, schoolName)?.status === "found");
  const toggleWindow = (id: string) => setChosen(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]);
  const fe = state.fieldErrors ?? {};

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
                  setChosen([]);
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
          onChange={(e) => {
            setSchool(e.target.value);
            setChosen([]);
          }}
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
          <span>3</span> When could you travel?
        </legend>
        {!city ? (
          <span className="hint">Pick your city first.</span>
        ) : (
          <>
            <span className="hint">
              {hasSchoolDates
                ? "We found your school's holiday dates. Tick the breaks and long weekends you'd travel in."
                : "We don't have your school's own dates yet, so these are long weekends and any state school breaks announced. Tick the ones that suit you."}
            </span>
            <YearCalendar
              months={months}
              windows={windows}
              custom={custom}
              selected={chosen}
              today={today}
              origin={city}
              wishlist={picked}
              destinations={DESTINATIONS}
              onToggle={toggleWindow}
              onAddCustom={addCustom}
              onRemoveCustom={(id) => setCustom(custom.filter((c) => c.id !== id))}
            />
          </>
        )}
        {fe.windowIds && (
          <span className="error-text" role="alert">
            {fe.windowIds}
          </span>
        )}
      </fieldset>

      <fieldset className="stack-sm">
        <legend className="fw-step">
          <span>4</span> Where would you love to go?
        </legend>
        <PlacePicker places={DESTINATIONS} picked={picked} max={MAX_WISHLIST} onChange={setPicked} />
        {fe.wishlist && (
          <span className="error-text" role="alert">
            {fe.wishlist}
          </span>
        )}
      </fieldset>

      <div className="stack-sm">
        <label htmlFor="email" className="fw-step">
          <span>5</span> Where should we send alerts?
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
