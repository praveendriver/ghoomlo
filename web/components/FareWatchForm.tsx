"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { fareWatchSignupAction } from "@/app/actions/fare-watch";
import type { FormState } from "@/app/actions/state";
import { DESTINATIONS, MAX_CUSTOM_DAYS, MAX_CUSTOM_WINDOWS, MAX_WISHLIST } from "@/lib/fare-watch";
import { nearestCity, pointFor } from "@/lib/places";
import type { Point } from "@/lib/places";
import { CITIES, SCHOOLS } from "@/lib/schools";
import type { City } from "@/lib/schools";
import { calendarMonths, schoolEntry, windowsFor } from "@/lib/windows";
import { FareMap } from "./FareMap";
import { PlacePicker } from "./PlacePicker";
import { SubmitButton } from "./SubmitButton";
import { YearCalendar } from "./YearCalendar";
import type { CustomWindow } from "./YearCalendar";

const CITY_KEY = "ghoomlo-city";

function readSavedCity(): City | "" {
  try {
    const saved = localStorage.getItem(CITY_KEY);
    return saved && (CITIES as readonly string[]).includes(saved) ? (saved as City) : "";
  } catch {
    return "";
  }
}

export function FareWatchForm({ today }: { today: string }) {
  const [state, action] = useActionState<FormState, FormData>(fareWatchSignupAction, {});
  const [city, setCity] = useState<City | "">("");
  const [locating, setLocating] = useState<"idle" | "busy" | "failed" | "far">("idle");
  const [school, setSchool] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  // Every offered window starts picked; parents untick what doesn't suit them.
  const [unpicked, setUnpicked] = useState<string[]>([]);
  const [custom, setCustom] = useState<CustomWindow[]>([]);
  const datesDialog = useRef<HTMLDialogElement>(null);

  const schoolName = school === "other" ? "" : school;
  const windows = useMemo(() => (city ? windowsFor(city, schoolName, today) : []), [city, schoolName, today]);
  const chosen = windows.filter((w) => !unpicked.includes(w.id)).map((w) => w.id);
  const months = useMemo(() => calendarMonths(today), [today]);
  const hasSchoolDates = Boolean(city && schoolName && schoolEntry(city, schoolName)?.status === "found");
  const fe = state.fieldErrors ?? {};

  const pickCity = (c: City | "") => {
    setCity(c);
    setSchool("");
    setUnpicked([]);
    try {
      if (c) localStorage.setItem(CITY_KEY, c);
    } catch {
      /* storage can be unavailable; the choice still works for this visit */
    }
  };

  const locate = (quiet: boolean) => {
    if (!("geolocation" in navigator)) return setLocating(quiet ? "idle" : "failed");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = nearestCity(CITIES, { lat: pos.coords.latitude, lon: pos.coords.longitude });
        pickCity(near.city);
        setLocating(near.km > 250 ? "far" : "idle");
      },
      () => setLocating(quiet ? "idle" : "failed"),
      { maximumAge: 3_600_000, timeout: 10_000 },
    );
  };

  // Use a city chosen before, or the browser's location if the visitor has
  // already allowed it. Never trigger a permission prompt without a tap.
  useEffect(() => {
    const saved = readSavedCity();
    if (saved) {
      queueMicrotask(() => setCity(saved));
      return;
    }
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (p.state === "granted") locate(true);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const toggleWindow = (id: string) => setUnpicked(unpicked.includes(id) ? unpicked.filter((u) => u !== id) : [...unpicked, id]);

  const origin = city ? pointFor(city) : null;
  const placePoints = picked.map(pointFor).filter((p): p is Point => Boolean(p));
  const chosenLabels = [...custom.map(() => "your dates"), ...windows.filter((w) => chosen.includes(w.id)).map((w) => w.label.replace(/ \(take .*\)$/, ""))];

  return (
    <form action={action} className="stack fw-form" noValidate>
      {/* Hidden from people; catches automated form-fillers. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="school" value={school} />

      <div className="fare-map-wrap">
        <FareMap origin={origin} places={placePoints} />
        <div className="city-pill">
          <label htmlFor="homeCity">Flying from</label>
          <select
            id="homeCity"
            name="homeCity"
            value={city}
            onChange={(e) => pickCity(e.target.value as City | "")}
            aria-invalid={fe.homeCity ? true : undefined}
          >
            <option value="">Choose your city</option>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button type="button" className="locate" onClick={() => locate(false)} aria-label="Use my location" title="Use my location">
            {locating === "busy" ? "…" : "📍"}
          </button>
        </div>
      </div>
      {(fe.homeCity || locating === "failed" || locating === "far") && (
        <p className={fe.homeCity ? "error-text" : "hint"} role="status">
          {fe.homeCity
            ? "Choose the city you fly from, or tap 📍."
            : locating === "failed"
              ? "We couldn't get your location. Choose your city instead."
              : `We picked ${city}, the nearest city we cover. Change it if that's wrong.`}
        </p>
      )}

      <fieldset className="stack-sm">
        <legend className="fw-q">Where would you love to go?</legend>
        <PlacePicker places={DESTINATIONS} picked={picked} max={MAX_WISHLIST} onChange={setPicked} />
        {fe.wishlist && (
          <span className="error-text" role="alert">
            {fe.wishlist}
          </span>
        )}
      </fieldset>

      {city && (
        <div className="dates-line">
          <span className="dates-icon" aria-hidden="true">
            🗓️
          </span>
          <span className="dates-text">
            <strong>
              {chosenLabels.length ? `${chosenLabels.length} holiday ${chosenLabels.length === 1 ? "window" : "windows"} picked` : "No dates picked yet"}
            </strong>
            <span className="small muted">
              {chosenLabels.length ? chosenLabels.slice(0, 4).join(", ") + (chosenLabels.length > 4 ? ` and ${chosenLabels.length - 4} more` : "") : "Pick at least one."}
            </span>
          </span>
          <button type="button" className="btn quiet" onClick={() => datesDialog.current?.showModal()}>
            Change
          </button>
        </div>
      )}
      {fe.windowIds && (
        <span className="error-text" role="alert">
          {fe.windowIds}
        </span>
      )}

      <div className="stack-sm">
        <label htmlFor="email" className="fw-q">
          Where should we send alerts?
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

      {city && (
        <dialog
          ref={datesDialog}
          className="ycal-dialog"
          aria-labelledby="dates-title"
          onClick={(e) => {
            if (e.target === datesDialog.current) datesDialog.current?.close();
          }}
        >
          <div className="ycal-panel stack">
            <div className="row between">
              <h3 id="dates-title">When could you travel?</h3>
              <button type="button" className="btn quiet" onClick={() => datesDialog.current?.close()}>
                Done
              </button>
            </div>
            <div className="stack-sm">
              <label htmlFor="school-pick" className="small">
                <strong>Your child&apos;s school</strong> (optional, for exact holiday dates)
              </label>
              <select
                id="school-pick"
                value={school}
                onChange={(e) => {
                  setSchool(e.target.value);
                  setUnpicked([]);
                }}
              >
                <option value="">Not now</option>
                {SCHOOLS[city].map((s) => (
                  <option key={s}>{s}</option>
                ))}
                <option value="other">My school isn&apos;t listed</option>
              </select>
              {school === "other" && <input type="text" name="schoolOther" aria-label="School name" placeholder="Type the school's name" maxLength={120} />}
              <span className="hint">
                {hasSchoolDates
                  ? "We found your school's holiday dates and picked them for you."
                  : "We've picked the usual school holidays and long weekends for you. Untick any that don't suit, or add your own dates."}
              </span>
            </div>
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
          </div>
        </dialog>
      )}
    </form>
  );
}
