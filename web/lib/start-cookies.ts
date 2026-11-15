import "server-only";
import { cookies } from "next/headers";
import type { TripPrefill } from "@/lib/prefill";

// Short-lived cookies that carry a visitor's starting point through sign-up
// and onto the new-trip form. They hold only what the visitor typed.
const INTENT = "ghoomlo_intent";
const PREFILL = "ghoomlo_prefill";
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60,
};

export async function saveIntent(text: string): Promise<void> {
  (await cookies()).set(INTENT, text, options);
}

export async function takeIntent(): Promise<string | null> {
  const store = await cookies();
  const text = store.get(INTENT)?.value ?? null;
  if (text) store.delete(INTENT);
  return text;
}

export async function savePrefill(prefill: TripPrefill, understood: boolean): Promise<void> {
  (await cookies()).set(PREFILL, JSON.stringify({ prefill, understood }), options);
}

export async function readPrefill(): Promise<{ prefill: TripPrefill; understood: boolean } | null> {
  const raw = (await cookies()).get(PREFILL)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.prefill === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearPrefill(): Promise<void> {
  (await cookies()).delete(PREFILL);
}
