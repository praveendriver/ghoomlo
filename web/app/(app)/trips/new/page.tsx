import type { Metadata } from "next";
import Link from "next/link";
import { TripForm } from "@/components/TripForm";
import { requireUser } from "@/lib/auth/session";
import { getHousehold } from "@/lib/data/household";
import { todayIso } from "@/lib/dates";
import { readPrefill } from "@/lib/start-cookies";

export const metadata: Metadata = { title: "Plan a new trip" };

export default async function NewTripPage() {
  const user = await requireUser();
  const [household, start] = await Promise.all([getHousehold(user.id), readPrefill()]);
  return (
    <div className="stack">
      <div className="stack-sm">
        <p>
          <Link href="/trips">← Your trips</Link>
        </p>
        <h1>Plan a new trip</h1>
      </div>
      {start && (
        <p className="notice info" role="status">
          {start.understood
            ? "We filled in what we could from your description. Check it, add anything missing, and save."
            : "We kept your description in the notes below. Fill in the destination and dates to continue."}
        </p>
      )}
      <div className="card">
        <TripForm defaultOrigin={household?.homeCity ?? ""} today={todayIso()} initial={start?.prefill} />
      </div>
    </div>
  );
}
