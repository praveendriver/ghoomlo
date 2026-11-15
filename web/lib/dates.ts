import type { BlockedDate } from "@/lib/validation";

const DAY_MS = 86_400_000;

function toMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}
function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIso(toMs(iso) + days * DAY_MS);
}

export function tripLengthDays(startDate: string, endDate: string): number {
  return Math.round((toMs(endDate) - toMs(startDate)) / DAY_MS) + 1;
}

export function eachDate(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  for (let ms = toMs(startDate); ms <= toMs(endDate); ms += DAY_MS) out.push(toIso(ms));
  return out;
}

/** Blocked dates that fall inside the travel window (inclusive). */
export function conflicts(startDate: string, endDate: string, blocked: BlockedDate[]): BlockedDate[] {
  return blocked
    .filter((b) => b.date >= startDate && b.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type DateWindow = { startDate: string; endDate: string; shiftDays: number };

/**
 * Same-length windows within ±flexDays of the chosen dates that avoid every
 * blocked date and do not start in the past. Closest shifts first.
 */
export function feasibleWindows(
  startDate: string,
  endDate: string,
  flexDays: number,
  blocked: BlockedDate[],
  today: string,
): DateWindow[] {
  const out: DateWindow[] = [];
  for (let shift = -flexDays; shift <= flexDays; shift++) {
    const s = addDays(startDate, shift);
    const e = addDays(endDate, shift);
    if (s < today) continue;
    if (conflicts(s, e, blocked).length === 0) out.push({ startDate: s, endDate: e, shiftDays: shift });
  }
  return out.sort((a, b) => Math.abs(a.shiftDays) - Math.abs(b.shiftDays) || a.shiftDays - b.shiftDays);
}

export function todayIso(): string {
  // India has a single time zone; the product is India-first.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(toMs(iso)));
}

export function formatRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}
