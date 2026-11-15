import "server-only";
import { allowTextRead } from "@/lib/data/trips";
import { todayIso } from "@/lib/dates";
import { parseTripText } from "@/lib/itinerary/parse";
import { savePrefill } from "@/lib/start-cookies";

/** Read a visitor's free-text trip description and stash the result for the new-trip form. */
export async function prepareTripFromText(userId: string, text: string): Promise<void> {
  const result = (await allowTextRead(userId))
    ? await parseTripText(text, todayIso())
    : { prefill: { notes: text }, understood: false };
  await savePrefill(result.prefill, result.understood);
}
