import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getHousehold } from "@/lib/data/household";
import { listTrips } from "@/lib/data/trips";
import { formatRange, tripLengthDays } from "@/lib/dates";
import { photoFor } from "@/lib/photos";

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
          Plans drafted for you work best when they know who is travelling.{" "}
          <Link href="/household">Add your household</Link> — it is optional.
        </p>
      )}
      {trips.length === 0 ? (
        <div className="card stack-sm">
          <h2>No trips yet</h2>
          <p className="muted">
            Start with where you want to go and when, or <Link href="/">pick a sample plan</Link> and make it yours.
          </p>
        </div>
      ) : (
        <ul className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {trips.map((t) => {
            const photo = photoFor(t.destination);
            return (
              <li key={t.id}>
                <Link href={`/trips/${t.id}`} className="card card-link trip-row">
                  <span className="trip-thumb">
                    {photo && <Image src={photo} alt="" fill sizes="132px" />}
                  </span>
                  <span className="stack-sm" style={{ gap: 4 }}>
                    <h2>{t.destination}</h2>
                    <span className="muted">
                      {formatRange(t.startDate, t.endDate)} · {tripLengthDays(t.startDate, t.endDate)} days · from {t.origin}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
