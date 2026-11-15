import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getHousehold } from "@/lib/data/household";
import { listTrips } from "@/lib/data/trips";
import { formatRange, tripLengthDays } from "@/lib/dates";

export const metadata: Metadata = { title: "Your trips" };

export default async function TripsPage() {
  const user = await requireUser();
  const [trips, household] = await Promise.all([listTrips(user.id), getHousehold(user.id)]);
  return (
    <div className="stack">
      <div className="row between">
        <h1>Your trips</h1>
        <Link href="/trips/new" className="btn primary">
          Plan a new trip
        </Link>
      </div>
      {!household && (
        <p className="notice info">
          Plans work best when they know who is travelling. <Link href="/household">Set up your household</Link>.
        </p>
      )}
      {trips.length === 0 ? (
        <div className="card stack-sm">
          <h2>No trips yet</h2>
          <p className="muted">Start with where you want to go and when. You can draft a day-by-day plan from there.</p>
        </div>
      ) : (
        <ul className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {trips.map((t) => (
            <li key={t.id}>
              <Link href={`/trips/${t.id}`} className="card card-link">
                <h2>{t.destination}</h2>
                <p className="muted">
                  {formatRange(t.startDate, t.endDate)} · {tripLengthDays(t.startDate, t.endDate)} days · from {t.origin}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
