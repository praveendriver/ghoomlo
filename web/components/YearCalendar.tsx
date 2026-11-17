"use client";

import { formatWindow, HOLIDAYS, inWindow } from "@/lib/windows";
import type { TravelWindow } from "@/lib/windows";

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const pad = (n: number) => String(n).padStart(2, "0");

const KIND_TEXT = { school: "Your school", state: "State calendar", "long-weekend": "Long weekend" } as const;

/**
 * Twelve small months with the offered travel windows shaded and public
 * holidays dotted, plus a list of the windows to tick. The list is the main
 * control; tapping a shaded day in the calendar does the same thing.
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
  const holidayOn = new Map(HOLIDAYS.filter((h) => h.type === "gazetted").map((h) => [h.date, h.name]));
  const windowOn = (iso: string) => windows.find((w) => inWindow(iso, w));

  return (
    <div className="stack">
      <div className="ycal" aria-hidden="true">
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
                  const cls = ["ycal-day", w ? `on ${w.kind}` : "", w && selected.includes(w.id) ? "picked" : "", holidayOn.has(iso) ? "holiday" : ""]
                    .filter(Boolean)
                    .join(" ");
                  return w ? (
                    <button type="button" key={iso} className={cls} tabIndex={-1} onClick={() => onToggle(w.id)} title={`${w.label}${holidayOn.has(iso) ? ` · ${holidayOn.get(iso)}` : ""}`}>
                      {i + 1}
                    </button>
                  ) : (
                    <span key={iso} className={cls} title={holidayOn.get(iso)}>
                      {i + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="ycal-key small muted" aria-hidden="true">
        <span><i className="sw school" /> Your school&apos;s break</span>
        <span><i className="sw state" /> State calendar (guide)</span>
        <span><i className="sw long-weekend" /> Long weekend</span>
        <span><i className="sw dot" /> Public holiday</span>
      </div>

      <ul className="win-list">
        {windows.map((w) => (
          <li key={w.id}>
            <label className={`win ${w.kind}`}>
              <input type="checkbox" name="window" value={w.id} checked={selected.includes(w.id)} onChange={() => onToggle(w.id)} />
              <span className="win-text">
                <span className="win-top">
                  <strong>{w.label}</strong>
                  <span className={`win-tag ${w.kind}`}>{KIND_TEXT[w.kind]}</span>
                </span>
                <span className="win-dates">{formatWindow(w)}</span>
                <span className="small muted">
                  {w.basis}
                  {w.sourceUrl && (
                    <>
                      {" "}
                      <a href={w.sourceUrl} target="_blank" rel="noopener noreferrer">
                        Source<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </>
                  )}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
