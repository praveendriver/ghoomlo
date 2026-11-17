import climate from "@/data/climate.json";

type Month = { high: number; low: number; rainMm: number };
type Place = { point: string; months: Month[]; reliable: boolean };
const PLACES = climate.places as Record<string, Place>;

export const CLIMATE_CREDIT = "Weather from NASA POWER monthly averages, 2001–2025.";

export type Suggestion = { tone: "good" | "warn"; text: string };

const month = (iso: string) => Number(iso.slice(5, 7)) - 1;
const deg = (n: number) => `${Math.round(n)}°C`;
const NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pleasant(m: Month): boolean {
  return m.high >= 22 && m.high <= 33 && m.rainMm < 100;
}
/** Aim warmer when home is cold and cooler when home is hot. */
function target(home: Month | undefined): number {
  if (!home) return 28;
  if (home.high < 24) return 31;
  if (home.high > 34) return 25;
  return 28;
}
function score(m: Month, goal: number): number {
  return -Math.abs(m.high - goal) - m.rainMm / 40;
}
function describe(m: Month): string {
  const rain = m.rainMm < 30 ? "dry" : m.rainMm < 100 ? "a little rain" : "rainy";
  return `about ${deg(m.high)} by day and ${rain}`;
}

/**
 * Weather-based tips for one travel window: the best-suited place (from the
 * family's wishlist when they have picked any) and a warning for any picked
 * place that is very wet or very hot then. Built only from averages; places
 * without reliable data are skipped rather than guessed.
 */
export function suggestFor(window: { start: string }, origin: string, wishlist: string[], candidates: readonly string[]): Suggestion[] {
  const m = month(window.start);
  const home = PLACES[origin]?.months[m];
  const pool = (wishlist.length ? wishlist : candidates).filter((p) => PLACES[p]?.reliable);
  const out: Suggestion[] = [];

  const best = pool
    .map((p) => ({ p, w: PLACES[p].months[m] }))
    .filter(({ w }) => pleasant(w))
    .sort((a, b) => score(b.w, target(home)) - score(a.w, target(home)))[0];
  if (best) {
    let contrast = "";
    if (home && home.high < 24 && best.w.high - home.high >= 5) contrast = `, while ${origin} is about ${deg(home.high)}`;
    else if (home && home.high > 35 && home.high - best.w.high >= 5) contrast = `, a break from ${origin}'s ${deg(home.high)}`;
    out.push({ tone: "good", text: `${best.p} suits ${NAMES[m]}: ${describe(best.w)}${contrast}.` });
  }

  for (const p of wishlist) {
    const w = PLACES[p]?.reliable ? PLACES[p].months[m] : null;
    if (!w || (best && p === best.p)) continue;
    if (w.rainMm >= 200) out.push({ tone: "warn", text: `${p} is very wet then (${w.rainMm} mm).` });
    else if (w.high >= 38) out.push({ tone: "warn", text: `${p} is very hot then (${deg(w.high)}).` });
  }
  return out.slice(0, 2);
}
