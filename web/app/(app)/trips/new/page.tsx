import type { Metadata } from "next";
import Link from "next/link";
import { TripForm } from "@/components/TripForm";
import { requireUser } from "@/lib/auth/session";
import { getHousehold } from "@/lib/data/household";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "Plan a new trip" };

export default async function NewTripPage() {
  const user = await requireUser();
  const household = await getHousehold(user.id);
  return (
    <div className="stack">
      <div className="stack-sm">
        <p>
          <Link href="/trips">← Your trips</Link>
        </p>
        <h1>Plan a new trip</h1>
      </div>
      <div className="card">
        <TripForm defaultOrigin={household?.homeCity ?? ""} today={todayIso()} />
      </div>
    </div>
  );
}
