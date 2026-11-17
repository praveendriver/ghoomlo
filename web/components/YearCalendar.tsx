"use client";

import { useRef, useState } from "react";
import { formatWindow, HOLIDAYS, inWindow } from "@/lib/windows";
import type { TravelWindow } from "@/lib/windows";

const MONTH = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const pad = (n: number) => String(n).padStart(2, "0");

const KIND_TEXT = {
  school: "Your school",
  state: "State calendar",
  "long-weekend": "Long weekend",
} as const;

/**
 * The offered travel windows as cards to tick, with a button that opens a
 * twelve-month calendar in a pop-up. Tapping a shaded day there ticks the
 * same window, so the two always agree.
 */
export function YearCalendar({
  months,
  windows,
  selected,
  onToggle,
}: {
  months: { year: number; month: number }[];
  windows: TravelWindow[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const holidayOn = new Map(
    HOLIDAYS.filter((h) => h.type === "gazetted").map((h) => [h.date, h.name]),
  );
  const windowOn = (iso: string) => windows.find((w) => inWindow(iso, w));

  const dialog = useRef<HTMLDialogElement>(null);
  const [showAll, setShowAll] = useState(false);
  const FIRST = 6;
  // Always show anything already picked, even when the list is folded.
  const visible = showAll ? windows : windows.filter((w, i) => i < FIRST || selected.includes(w.id));
  const kinds = new Set(windows.map((w) => w.kind));
  const picked = windows.filter((w) => selected.includes(w.id)).length;

  return (
    <div className="stack-sm">
      <div className="row between">
        <span className="small muted" role="status">
          {picked ? `${picked} picked` : "Tick the times that suit you."}
        </span>
        <button
          type="button"
          className="btn quiet"
          onClick={() => dialog.current?.showModal()}
        >
          See on a calendar
        </button>
      </div>
      <ul className="win-list">
        {visible.map((w) => (
          <li key={w.id}>
            <label className={`win ${w.kind}`}>
              <input type="checkbox" name="window" value={w.id} checked={selected.includes(w.id)} onChange={() => onToggle(w.id)} />
              <span className="win-text">
                <strong>{w.label}</strong>
                <span className="win-dates">
                  {formatWindow(w)}
                  <span className={`win-tag ${w.kind}`}>{KIND_TEXT[w.kind]}</span>
                  {w.sourceUrl && (
                    <a href={w.sourceUrl} target="_blank" rel="noopener noreferrer" className="win-src">
                      Source<span className="sr-only"> for {w.label} (opens in a new tab)</span>
                    </a>
                  )}
                </span>
              </span>
            </label>
          </li>
        ))}
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
        {kinds.has("long-weekend") && "Long weekends are built from the central government holiday list, so check your school is closed."}
      </p>

      <dialog
        ref={dialog}
        className="ycal-dialog"
        aria-labelledby="ycal-title"
        onClick={(e) => {
          // A click on the backdrop (outside the panel) closes the pop-up.
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="ycal-panel stack">
          <div className="row between">
            <h3 id="ycal-title">Your year at a glance</h3>
            <button
              type="button"
              className="btn quiet"
              onClick={() => dialog.current?.close()}
              autoFocus
            >
              Done
            </button>
          </div>
          <p className="small muted">
            Tap a shaded day to pick or unpick that window.
          </p>
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
                      <span className="ycal-dow" key={i}>
                        {d}
                      </span>
                    ))}
                    {Array.from({ length: lead }, (_, i) => (
                      <span key={`b${i}`} />
                    ))}
                    {Array.from({ length: days }, (_, i) => {
                      const iso = `${year}-${pad(month)}-${pad(i + 1)}`;
                      const w = windowOn(iso);
                      const cls = [
                        "ycal-day",
                        w ? `on ${w.kind}` : "",
                        w && selected.includes(w.id) ? "picked" : "",
                        holidayOn.has(iso) ? "holiday" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return w ? (
                        <button
                          type="button"
                          key={iso}
                          className={cls}
                          aria-pressed={selected.includes(w.id)}
                          aria-label={`${iso}: ${w.label}`}
                          onClick={() => onToggle(w.id)}
                          title={`${w.label}${holidayOn.has(iso) ? ` · ${holidayOn.get(iso)}` : ""}`}
                        >
                          {i + 1}
                        </button>
                      ) : (
                        <span
                          key={iso}
                          className={cls}
                          title={holidayOn.get(iso)}
                        >
                          {i + 1}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ycal-key small muted">
            <span>
              <i className="sw school" /> Your school&apos;s break
            </span>
            <span>
              <i className="sw state" /> State calendar (guide)
            </span>
            <span>
              <i className="sw long-weekend" /> Long weekend
            </span>
            <span>
              <i className="sw dot" /> Public holiday
            </span>
          </div>
        </div>
      </dialog>
    </div>
  );
}
