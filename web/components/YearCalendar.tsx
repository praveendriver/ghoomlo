"use client";

import { useRef, useState } from "react";
import { CLIMATE_CREDIT, suggestFor } from "@/lib/suggest";
import { themeFor } from "@/lib/theme";
import { formatWindow, HOLIDAYS, inWindow } from "@/lib/windows";
import type { TravelWindow } from "@/lib/windows";

export type CustomWindow = { id: string; start: string; end: string };

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const pad = (n: number) => String(n).padStart(2, "0");
const KIND_TEXT = { school: "Your school", state: "State calendar", "long-weekend": "Long weekend", custom: "Your dates" } as const;
const FIRST = 6;

type Props = {
  months: { year: number; month: number }[];
  windows: TravelWindow[];
  custom: CustomWindow[];
  selected: string[];
  today: string;
  origin: string;
  wishlist: string[];
  destinations: readonly string[];
  onToggle: (id: string) => void;
  onAddCustom: (start: string, end: string) => string | null;
  onRemoveCustom: (id: string) => void;
};

/**
 * Travel windows as festive cards to tick, with weather tips, a way to add
 * your own dates, and a twelve-month calendar in a pop-up. The calendar and
 * the cards share one selection, so they always agree.
 */
export function YearCalendar(props: Props) {
  const { months, windows, custom, selected, today, origin, wishlist, destinations, onToggle, onAddCustom, onRemoveCustom } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [firstTap, setFirstTap] = useState<string | null>(null);

  const holidayOn = new Map(HOLIDAYS.filter((h) => h.type === "gazetted").map((h) => [h.date, h.name]));
  const customAsWindows: TravelWindow[] = custom.map((c) => ({ ...c, label: "Your dates", kind: "custom", basis: "Added by you." }));
  const all = [...customAsWindows, ...windows];
  const picked = windows.filter((w) => selected.includes(w.id)).length + custom.length;
  const visible = showAll ? windows : windows.filter((w, i) => i < FIRST || selected.includes(w.id));
  const kinds = new Set(windows.map((w) => w.kind));

  const addFromInputs = () => {
    const err = from && to ? onAddCustom(from, to) : "Pick a first and last day";
    setAddError(err);
    if (!err) {
      setFrom("");
      setTo("");
      setAdding(false);
    }
  };

  const tapDay = (iso: string, w: TravelWindow | undefined) => {
    if (w && !firstTap) {
      if (w.kind === "custom") onRemoveCustom(w.id);
      else onToggle(w.id);
      return;
    }
    if (iso < today) return;
    if (!firstTap) {
      setFirstTap(iso);
      return;
    }
    const [a, b] = firstTap <= iso ? [firstTap, iso] : [iso, firstTap];
    setFirstTap(null);
    setAddError(onAddCustom(a, b));
  };

  const card = (w: TravelWindow) => {
    const theme = themeFor(w.label, w.kind);
    const tips = suggestFor(w, origin, wishlist, destinations);
    const isCustom = w.kind === "custom";
    const on = isCustom || selected.includes(w.id);
    return (
      <li key={w.id}>
        <div className={`win tone-${theme.tone}${on ? " on" : ""}`}>
          <span className="win-emoji" aria-hidden="true">
            {theme.emoji}
          </span>
          <span className="win-text">
            <span className="win-head">
              {isCustom ? (
                <strong>Your dates</strong>
              ) : (
                <label className="win-label">
                  <input type="checkbox" checked={on} onChange={() => onToggle(w.id)} />
                  <strong>{w.label}</strong>
                </label>
              )}
              {isCustom && (
                <button type="button" className="win-remove" onClick={() => onRemoveCustom(w.id)} aria-label={`Remove your dates ${formatWindow(w)}`}>
                  ×
                </button>
              )}
            </span>
            <span className="win-dates">
              {formatWindow(w)}
              <span className={`win-tag ${w.kind}`}>{KIND_TEXT[w.kind]}</span>
              {w.sourceUrl && (
                <a href={w.sourceUrl} target="_blank" rel="noopener noreferrer" className="win-src">
                  Source<span className="sr-only"> for {w.label} (opens in a new tab)</span>
                </a>
              )}
            </span>
            {tips.length > 0 && (
              <span className="win-tip">
                {tips.map((t) => (
                  <span key={t.text} className={t.tone}>
                    <span aria-hidden="true">{t.tone === "good" ? "💡 " : "⚠️ "}</span>
                    {t.text}{" "}
                  </span>
                ))}
              </span>
            )}
          </span>
        </div>
      </li>
    );
  };

  return (
    <div className="stack-sm">
      <input type="hidden" name="custom" value={JSON.stringify(custom.map(({ start, end }) => ({ start, end })))} />
      {windows.filter((w) => selected.includes(w.id)).map((w) => (
        <input key={w.id} type="hidden" name="window" value={w.id} />
      ))}

      <div className="row between">
        <span className="small muted" role="status">
          {picked ? `${picked} picked` : "Tick the times that suit you, or add your own."}
        </span>
        <button type="button" className="btn quiet" onClick={() => dialog.current?.showModal()}>
          📅 See on a calendar
        </button>
      </div>

      <ul className="win-list">
        {customAsWindows.map(card)}
        {visible.map(card)}
        <li>
          {adding ? (
            <div className="win add-form">
              <span className="win-emoji" aria-hidden="true">✈️</span>
              <span className="win-text stack-sm">
                <strong>Add your own dates</strong>
                <span className="add-dates">
                  <label>
                    <span className="small">First day</span>
                    <input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} />
                  </label>
                  <label>
                    <span className="small">Last day</span>
                    <input type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} />
                  </label>
                </span>
                {addError && (
                  <span className="error-text" role="alert">
                    {addError}
                  </span>
                )}
                <span className="row">
                  <button type="button" className="btn quiet" onClick={addFromInputs}>
                    Add these dates
                  </button>
                  <button type="button" className="btn quiet" onClick={() => setAdding(false)}>
                    Cancel
                  </button>
                </span>
              </span>
            </div>
          ) : (
            <button type="button" className="win add" onClick={() => setAdding(true)}>
              <span className="win-emoji" aria-hidden="true">＋</span>
              <span className="win-text">
                <strong>Add your own dates</strong>
                <span className="win-dates">Any days that work for your family</span>
              </span>
            </button>
          )}
        </li>
      </ul>

      {!showAll && windows.length > visible.length && (
        <div>
          <button type="button" className="btn quiet" onClick={() => setShowAll(true)}>
            Show {windows.length - visible.length} more
          </button>
        </div>
      )}
      <p className="win-basis muted">
        {kinds.has("school") && "School breaks come from your school's published calendar and haven't been checked by us yet. "}
        {kinds.has("state") && "State breaks are what the state announced for its schools; your school may differ. "}
        {kinds.has("long-weekend") && "Long weekends are built from the central government holiday list, so check your school is closed. "}
        {CLIMATE_CREDIT}
      </p>

      <dialog
        ref={dialog}
        className="ycal-dialog"
        aria-labelledby="ycal-title"
        onClose={() => setFirstTap(null)}
        onClick={(e) => {
          // A click on the backdrop (outside the panel) closes the pop-up.
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="ycal-panel stack">
          <div className="row between">
            <h3 id="ycal-title">Your year at a glance</h3>
            <button type="button" className="btn quiet" onClick={() => dialog.current?.close()} autoFocus>
              Done
            </button>
          </div>
          <p className="small muted" role="status">
            {firstTap
              ? "Now tap your last day."
              : "Tap a shaded day to pick that window. To add your own dates, tap any other day, then your last day."}
          </p>
          {addError && (
            <p className="error-text" role="alert">
              {addError}
            </p>
          )}
          <div className="ycal">
            {months.map(({ year, month }) => {
              const first = new Date(Date.UTC(year, month - 1, 1));
              const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
              const lead = (first.getUTCDay() + 6) % 7; // weeks start on Monday
              return (
                <div className="ycal-month" key={`${year}-${month}`}>
                  <div className="ycal-title">{MONTH.format(first)}</div>
                  <div className="ycal-grid">
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                      <span className="ycal-dow" key={i} aria-hidden="true">
                        {d}
                      </span>
                    ))}
                    {Array.from({ length: lead }, (_, i) => (
                      <span key={`b${i}`} />
                    ))}
                    {Array.from({ length: days }, (_, i) => {
                      const iso = `${year}-${pad(month)}-${pad(i + 1)}`;
                      const w = all.find((x) => inWindow(iso, x));
                      const past = iso < today;
                      const isPicked = w && (w.kind === "custom" || selected.includes(w.id));
                      const cls = [
                        "ycal-day",
                        w ? `on ${w.kind}` : "",
                        isPicked ? "picked" : "",
                        holidayOn.has(iso) ? "holiday" : "",
                        firstTap === iso ? "first-tap" : "",
                        past ? "past" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      const label = `${iso}${w ? `: ${w.label}` : ""}${holidayOn.has(iso) ? `, ${holidayOn.get(iso)}` : ""}`;
                      return (
                        <button
                          type="button"
                          key={iso}
                          className={cls}
                          disabled={past && !w}
                          aria-pressed={w ? Boolean(isPicked) : firstTap === iso}
                          aria-label={label}
                          title={label}
                          onClick={() => tapDay(iso, w)}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="ycal-key small muted">
            <span><i className="sw school" /> Your school&apos;s break</span>
            <span><i className="sw state" /> State calendar (guide)</span>
            <span><i className="sw long-weekend" /> Long weekend</span>
            <span><i className="sw custom" /> Your dates</span>
            <span><i className="sw dot" /> Public holiday</span>
          </div>
        </div>
      </dialog>
    </div>
  );
}
