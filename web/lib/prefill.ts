import { MAX_FLEX_DAYS, MAX_TRIP_DAYS } from "@/lib/validation";
import { tripLengthDays } from "@/lib/dates";

/** Values for the new-trip form, keyed by field name. All optional. */
export type TripPrefill = Partial<
  Record<"destination" | "origin" | "startDate" | "endDate" | "flexDays" | "budgetInr" | "notes", string>
>;

export const MAX_INTENT_CHARS = 600;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (v: unknown): v is string =>
  typeof v === "string" && ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const text = (v: unknown, max: number): string | undefined => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s.length >= 2 ? s : undefined;
};

/**
 * Keep only values the trip form would accept. Anything doubtful is dropped so
 * the traveller fills it in, rather than being shown a guess as if it were theirs.
 */
export function normalisePrefill(raw: Record<string, unknown>, today: string): TripPrefill {
  const out: TripPrefill = {};
  const destination = text(raw.destination, 80);
  const origin = text(raw.origin, 80);
  const notes = text(raw.notes, 1000);
  if (destination) out.destination = destination;
  if (origin) out.origin = origin;
  if (notes) out.notes = notes;

  if (validDate(raw.startDate) && raw.startDate >= today) {
    out.startDate = raw.startDate;
    if (
      validDate(raw.endDate) &&
      raw.endDate >= raw.startDate &&
      tripLengthDays(raw.startDate, raw.endDate) <= MAX_TRIP_DAYS
    ) {
      out.endDate = raw.endDate;
    }
  }
  if (typeof raw.flexDays === "number" && Number.isInteger(raw.flexDays) && raw.flexDays > 0) {
    out.flexDays = String(Math.min(raw.flexDays, MAX_FLEX_DAYS));
  }
  if (typeof raw.budgetInr === "number" && raw.budgetInr >= 1000 && raw.budgetInr <= 100_000_000) {
    out.budgetInr = String(Math.round(raw.budgetInr));
  }
  return out;
}

/** Only same-site paths are allowed as a post-sign-in destination. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\/(?![/\\])[^\\\s]*$/.test(value) ? value : null;
}
