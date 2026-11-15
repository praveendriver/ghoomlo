import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTripAction, moveTripAction } from "@/app/actions/trips";
import { GeneratePlan } from "@/components/GeneratePlan";
import { PlanDays, VerifyList } from "@/components/PlanView";
import { PrintButton } from "@/components/PrintButton";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth/session";
import { getHousehold } from "@/lib/data/household";
import { getTrip, latestItinerary } from "@/lib/data/trips";
import { conflicts, feasibleWindows, formatDate, formatRange, todayIso, tripLengthDays } from "@/lib/dates";
import { isGenerationConfigured } from "@/lib/itinerary/generate";
import { SAMPLE_MODEL } from "@/lib/ideas";

export const metadata: Metadata = { title: "Trip" };
// Drafting a plan can take a couple of minutes.
export const maxDuration = 300;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const KIND_LABEL = { school: "school", work: "work", other: "other commitment" } as const;

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
            <strong>
              {plan.model === SAMPLE_MODEL
                ? "A sample plan — a starting point, not checked against live sources."
                : "Drafted by AI — nothing here has been checked against live sources."}
            </strong>
            <p className="small" style={{ marginTop: 4 }}>
              Places may have closed or moved, and costs and durations are rough estimates. Confirm opening
              hours, prices, bookings, and entry rules with the provider before you rely on them.{" "}
              {plan.model === SAMPLE_MODEL
                ? "It was not written for your household; draft a new plan below to fit it to you."
                : `Drafted ${formatDate(plan.createdAt.toISOString().slice(0, 10))}.`}
            </p>
          </div>
          <p>{plan.data.summary}</p>
          <PlanDays
            days={plan.data.days}
            destination={trip.destination}
            removable={{ tripId: trip.id, itineraryId: plan.id }}
          />
          <VerifyList items={plan.data.thingsToVerify} />
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
          <GeneratePlan
            tripId={trip.id}
            label={plan.model === SAMPLE_MODEL ? "Redraft this for my household" : "Draft a new plan"}
            disabledReason={disabledReason}
          />
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
