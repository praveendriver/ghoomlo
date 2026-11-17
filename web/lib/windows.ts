import publicHolidays from "@/data/public-holidays.json";
import schoolHolidays from "@/data/school-holidays.json";
import stateCalendars from "@/data/state-school-calendars.json";

/**
 * A stretch of days a family might travel in, built from the school's own
 * published breaks, the state's announced school breaks, and public holidays
 * that make a long weekend. Every window says where it came from.
 */
export type TravelWindow = {
  id: string;
  label: string;
  start: string;
  /** Null when only the start has been published. */
  end: string | null;
  kind: "school" | "state" | "long-weekend";
  /** Short line for the parent: who says so and how sure we are. */
  basis: string;
  sourceUrl?: string;
};

export type Holiday = { date: string; name: string; type: string };

const DAY = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => toIso(toMs(iso) + n * DAY);
const weekday = (iso: string) => new Date(toMs(iso)).getUTCDay(); // 0 = Sunday

export const HOLIDAYS: Holiday[] = publicHolidays.holidays;

export function schoolEntry(city: string, school: string) {
  return schoolHolidays.schools.find((s) => s.city === city && s.school === school) ?? null;
}

/**
 * Long weekends from gazetted holidays: a holiday on Friday or Monday gives
 * three days; on Thursday or Tuesday, four days if one day is taken off.
 */
export function longWeekends(holidays: Holiday[], today: string): TravelWindow[] {
  const out: TravelWindow[] = [];
  for (const h of holidays) {
    if (h.type !== "gazetted" || h.date < today) continue;
    const d = weekday(h.date);
    let start: string | null = null;
    let end: string | null = null;
    let note = "";
    if (d === 5) [start, end] = [h.date, addDays(h.date, 2)];
    else if (d === 1) [start, end] = [addDays(h.date, -2), h.date];
    else if (d === 4) [start, end, note] = [h.date, addDays(h.date, 3), " (take Friday off)"];
    else if (d === 2) [start, end, note] = [addDays(h.date, -3), h.date, " (take Monday off)"];
    if (!start || !end) continue;
    out.push({
      id: `lw-${h.date}`,
      label: `${h.name} long weekend${note}`,
      start,
      end,
      kind: "long-weekend",
      basis: "Public holiday on the central government list. Check that your school is closed.",
    });
  }
  return out;
}

const overlaps = (a: { start: string; end: string | null }, b: { start: string; end: string | null }) =>
  a.start <= (b.end ?? "9999-12-31") && b.start <= (a.end ?? "9999-12-31");

/** Windows to offer a family, soonest first. Past windows are left out. */
export function windowsFor(city: string, school: string, today: string): TravelWindow[] {
  const entry = schoolEntry(city, school);
  const schoolWindows: TravelWindow[] =
    entry?.status === "found"
      ? entry.breaks
          .filter((b) => b.end >= today)
          .map((b) => ({
            id: `school-${b.start}`,
            label: b.name,
            start: b.start,
            end: b.end,
            kind: "school" as const,
            basis: "From your school's published calendar. Not yet checked by us.",
            sourceUrl: entry.sourceUrl,
          }))
      : [];

  // State breaks are only a guide when the school's own dates are unknown.
  const stateWindows: TravelWindow[] = schoolWindows.length
    ? []
    : stateCalendars.breaks
        .filter((b) => b.city === city && (b.end ?? b.start) >= today)
        .map((b) => ({
          id: `state-${b.start}`,
          label: b.name,
          start: b.start,
          end: b.end,
          kind: "state" as const,
          basis: `${b.appliesTo}. Your school may differ.`,
          sourceUrl: b.sourceUrl,
        }));

  const breaks = [...schoolWindows, ...stateWindows];
  const weekends = longWeekends(HOLIDAYS, today).filter((w) => !breaks.some((b) => overlaps(b, w)));
  return [...breaks, ...weekends].sort((a, b) => a.start.localeCompare(b.start));
}

/** Months to draw in the year calendar: this month and the next eleven. */
export function calendarMonths(today: string): { year: number; month: number }[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const idx = m - 1 + i;
    return { year: y + Math.floor(idx / 12), month: (idx % 12) + 1 };
  });
}

export function inWindow(iso: string, w: { start: string; end: string | null }): boolean {
  return iso >= w.start && iso <= (w.end ?? w.start);
}

const DAY_LABEL = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatWindow(w: { start: string; end: string | null }): string {
  const s = DAY_LABEL.format(new Date(`${w.start}T00:00:00Z`));
  if (!w.end) return `from ${s}`;
  if (w.end === w.start) return s;
  return `${s} – ${DAY_LABEL.format(new Date(`${w.end}T00:00:00Z`))}`;
}
