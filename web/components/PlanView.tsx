import { removeItemAction } from "@/app/actions/trips";
import { formatDate } from "@/lib/dates";
import type { ItineraryItem } from "@/lib/itinerary/schema";
import { SubmitButton } from "./SubmitButton";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const TIME_LABEL = { morning: "Morning", midday: "Midday", afternoon: "Afternoon", evening: "Evening" } as const;

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ") || "0 min";
}

// A search link, never a link to a specific listing: we do not know the listing is right.
function mapsSearchUrl(place: string, destination: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place}, ${destination}`)}`;
}

type Removable = { tripId: string; itineraryId: string };
type Item = Omit<ItineraryItem, "id"> & { id?: string };

function ItemCard({ item, destination, removable }: { item: Item; destination: string; removable?: Removable }) {
  return (
    <li className="item">
      <div className="item-head">
        <h4 style={{ margin: 0, fontSize: "1rem" }}>
          <span className="muted small">{TIME_LABEL[item.timeOfDay]} · </span>
          {item.title}
        </h4>
        {removable && item.id && (
          <form action={removeItemAction} className="no-print">
            <input type="hidden" name="tripId" value={removable.tripId} />
            <input type="hidden" name="itineraryId" value={removable.itineraryId} />
            <input type="hidden" name="itemId" value={item.id} />
            <SubmitButton className="btn quiet" pendingLabel="Removing…">
              Remove<span className="sr-only"> {item.title}</span>
            </SubmitButton>
          </form>
        )}
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

export function PlanDays({
  days,
  destination,
  removable,
}: {
  days: { title: string; date?: string; items: Item[] }[];
  destination: string;
  removable?: Removable;
}) {
  return (
    <>
      {days.map((day, i) => (
        <section className="day" key={i} aria-labelledby={`day-${i + 1}`}>
          <div className="day-head">
            <h3 id={`day-${i + 1}`}>
              <span className="day-num">Day {i + 1}</span>
              {day.title}
            </h3>
            {day.date && <span className="muted small">{formatDate(day.date)}</span>}
          </div>
          {day.items.length === 0 ? (
            <p className="muted small">Nothing planned for this day.</p>
          ) : (
            <ul className="timeline">
              {day.items.map((item, j) => (
                <ItemCard key={item.id ?? j} item={item} destination={destination} removable={removable} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

export function VerifyList({ items }: { items: { topic: string; why: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="card stack-sm">
      <h3>Confirm before you book</h3>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {items.map((t, i) => (
          <li key={i}>
            <strong>{t.topic}</strong> — {t.why}
          </li>
        ))}
      </ul>
    </div>
  );
}
