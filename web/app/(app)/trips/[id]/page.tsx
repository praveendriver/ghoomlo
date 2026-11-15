import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTripAction, moveTripAction, removeItemAction } from "@/app/actions/trips";
import { GeneratePlan } from "@/components/GeneratePlan";
import { PrintButton } from "@/components/PrintButton";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth/session";
import { getHousehold } from "@/lib/data/household";
import { getTrip, latestItinerary } from "@/lib/data/trips";
import { conflicts, feasibleWindows, formatDate, formatRange, todayIso, tripLengthDays } from "@/lib/dates";
import { isGenerationConfigured } from "@/lib/itinerary/generate";
import type { ItineraryItem } from "@/lib/itinerary/schema";

export const metadata: Metadata = { title: "Trip" };
// Drafting a plan can take a couple of minutes.
export const maxDuration = 300;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const KIND_LABEL = { school: "school", work: "work", other: "other commitment" } as const;
const TIME_LABEL = { morning: "Morning", midday: "Midday", afternoon: "Afternoon", evening: "Evening" } as const;

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ") || "0 min";
}

function mapsSearchUrl(place: string, destination: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place}, ${destination}`)}`;
}

function Item({ item, destination, tripId, itineraryId }: { item: ItineraryItem; destination: string; tripId: string; itineraryId: string }) {
  return (
    <li className="item">
      <div className="item-head">
        <h4 style={{ margin: 0, fontSize: "1rem" }}>
          <span className="muted small">{TIME_LABEL[item.timeOfDay]} · </span>
          {item.title}
        </h4>
        <form action={removeItemAction} className="no-print">
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="itineraryId" value={itineraryId} />
          <input type="hidden" name="itemId" value={item.id} />
          <SubmitButton className="btn quiet" pendingLabel="Removing…">
            Remove<span className="sr-only"> {item.title}</span>
          </SubmitButton>
        </form>
      </div>
      <div className="item-meta">
        <span className="badge kind">{item.kind}</span>
        {item.placeName && <span className="badge unverified">Place not verified</span>}
        {item.durationMinutes != null && <span className="badge est">Est. {duration(item.durationMinutes)}</span>}
        {item.estimatedCostInr != null && <span className="badge est">Est. {inr.format(item.estimatedCostInr)}</span>}
      </div>
      <p>{item.description}</p>
      {item.placeName && (
        <p className="small" style={{ marginTop: 6 }}>
          {item.placeName} ·{" "}
          <a href={mapsSearchUrl(item.placeName, destination)} target="_blank" rel="noopener noreferrer">
            Search on Google Maps<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}
      {item.fitNote && (
        <p className="small muted" style={{ marginTop: 6 }}>
          {item.fitNote}
        </p>
      )}
      {item.checkBeforeYouGo.length > 0 && (
        <div className="small" style={{ marginTop: 8 }}>
          <strong>Check before you go</strong>
          <ul>
            {item.checkBeforeYouGo.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const trip = await getTrip(user.id, id);
  if (!trip) notFound();

  const [plan, household] = await Promise.all([latestItinerary(user.id, id), getHousehold(user.id)]);
  const clash = conflicts(trip.startDate, trip.endDate, trip.blockedDates);
  const alternatives = clash.length
    ? feasibleWindows(trip.startDate, trip.endDate, trip.flexDays, trip.blockedDates, todayIso())
    : [];
  const stale = plan && (plan.startDate !== trip.startDate || plan.endDate !== trip.endDate);
  const disabledReason = clash.length
    ? "Fix the date clash above before drafting a plan."
    : !isGenerationConfigured()
      ? "Plan drafting is not set up on this server yet."
      : undefined;

  return (
    <div className="stack">
      <div className="stack-sm">
        <p className="no-print">
          <Link href="/trips">← Your trips</Link>
        </p>
        <h1>{trip.destination}</h1>
        <dl className="facts">
          <div>
            <dt>Dates</dt>
            <dd>
              {formatRange(trip.startDate, trip.endDate)} ({tripLengthDays(trip.startDate, trip.endDate)} days)
            </dd>
          </div>
          <div>
            <dt>From</dt>
            <dd>{trip.origin}</dd>
          </div>
          {trip.budgetInr != null && (
            <div>
              <dt>Budget</dt>
              <dd>{inr.format(trip.budgetInr)}</dd>
            </div>
          )}
          {household && (
            <div>
              <dt>Travellers</dt>
              <dd>{household.travellers.length}</dd>
            </div>
          )}
        </dl>
      </div>

      {clash.length > 0 && (
        <div className="notice warn stack-sm" role="alert">
          <strong>These dates include {clash.length === 1 ? "a day" : "days"} you cannot travel</strong>
          <ul>
            {clash.map((b) => (
              <li key={`${b.date}-${b.kind}`}>
                {formatDate(b.date)} — {KIND_LABEL[b.kind]}
              </li>
            ))}
          </ul>
          {alternatives.length > 0 ? (
            <>
              <p>Dates of the same length that avoid them, within your flexibility:</p>
              <div className="row">
                {alternatives.map((w) => (
                  <form action={moveTripAction} key={w.shiftDays}>
                    <input type="hidden" name="tripId" value={trip.id} />
                    <input type="hidden" name="shiftDays" value={w.shiftDays} />
                    <SubmitButton className="btn" pendingLabel="Moving…">
                      Move to {formatRange(w.startDate, w.endDate)}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </>
          ) : (
            <p>
              No dates within your flexibility avoid them. Delete this trip and create it again with
              different dates.
            </p>
          )}
        </div>
      )}

      {trip.pendingDependencies && (
        <p className="notice info">
          <strong>Still undecided:</strong> {trip.pendingDependencies}. Hold off on non-refundable bookings
          until this is settled.
        </p>
      )}
      {!household && (
        <p className="notice info no-print">
          No household details yet, so a plan would assume two adults. <Link href="/household">Add your household</Link>.
        </p>
      )}

      {!plan ? (
        <section className="card stack" aria-labelledby="plan-h">
          <h2 id="plan-h">Day-by-day plan</h2>
          <p className="muted">
            Draft a plan for these dates, built around your household. It is written by AI from general
            knowledge, so treat it as a starting point to check, not as confirmed facts.
          </p>
          <GeneratePlan tripId={trip.id} label="Draft my plan" disabledReason={disabledReason} />
        </section>
      ) : (
        <section className="stack" aria-labelledby="plan-h">
          <div className="row between">
            <h2 id="plan-h">Day-by-day plan</h2>
            <div className="no-print">
              <PrintButton />
            </div>
          </div>
          {stale && (
            <p className="notice warn" role="status">
              This plan was written for {formatRange(plan.startDate, plan.endDate)}, but the trip dates have
              changed. Draft a new plan to match.
            </p>
          )}
          <div className="notice warn">
            <strong>Drafted by AI — nothing here has been checked against live sources.</strong>
            <p className="small" style={{ marginTop: 4 }}>
              Places may have closed or moved, and costs and durations are rough estimates. Confirm opening
              hours, prices, bookings, and entry rules with the provider before you rely on them. Drafted{" "}
              {formatDate(plan.createdAt.toISOString().slice(0, 10))}.
            </p>
          </div>
          <p>{plan.data.summary}</p>

          {plan.data.days.map((day) => (
            <section className="day" key={day.dayNumber} aria-labelledby={`day-${day.dayNumber}`}>
              <div className="day-head">
                <h3 id={`day-${day.dayNumber}`}>
                  Day {day.dayNumber} · {day.title}
                </h3>
                <span className="muted small">{formatDate(day.date)}</span>
              </div>
              {day.items.length === 0 ? (
                <p className="muted small">Nothing planned for this day.</p>
              ) : (
                <ul className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {day.items.map((item) => (
                    <Item key={item.id} item={item} destination={trip.destination} tripId={trip.id} itineraryId={plan.id} />
                  ))}
                </ul>
              )}
            </section>
          ))}

          {plan.data.thingsToVerify.length > 0 && (
            <div className="card stack-sm">
              <h3>Confirm before you book</h3>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {plan.data.thingsToVerify.map((t, i) => (
                  <li key={i}>
                    <strong>{t.topic}</strong> — {t.why}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.data.assumptions.length > 0 && (
            <div className="card stack-sm">
              <h3>What this plan assumed</h3>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {plan.data.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <GeneratePlan tripId={trip.id} label="Draft a new plan" disabledReason={disabledReason} />
        </section>
      )}

      <form action={deleteTripAction} className="no-print">
        <input type="hidden" name="tripId" value={trip.id} />
        <SubmitButton className="btn danger" pendingLabel="Deleting…">
          Delete this trip
        </SubmitButton>
      </form>
    </div>
  );
}
