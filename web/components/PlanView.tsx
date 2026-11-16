import { removeItemAction } from "@/app/actions/trips";
import { formatDate } from "@/lib/dates";
import type { ItineraryItem } from "@/lib/itinerary/schema";
import { DaySketch } from "./DaySketch";
import { SubmitButton } from "./SubmitButton";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const TIME_LABEL = { morning: "Morning", midday: "Midday", afternoon: "Afternoon", evening: "Evening" } as const;
const KIND_LABEL = { activity: "Activity", meal: "Meal", travel: "Travel", rest: "Rest" } as const;

// Simple line icons, one per kind of plan item.
const ICONS: Record<ItineraryItem["kind"], React.ReactNode> = {
  activity: <path d="M4 20h16M6 20V10m4 10V10m4 10V10m4 10V10M3 10h18L12 4 3 10z" />,
  meal: <path d="M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 1-3 3.5-3 7h3m0-7v18" />,
  travel: <path d="M5 16v2m14-2v2M3 12l2-5.5A2 2 0 0 1 7 5h10a2 2 0 0 1 2 1.5L21 12v4H3v-4zm3.5 1.5h.01m10.99 0h.01" />,
  rest: <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />,
};

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

/** Activities and meals are the day's stops: they get a numbered pin on the sketch. */
const isStop = (item: Item) => item.kind === "activity" || item.kind === "meal";

function ItemCard({
  item,
  stopNumber,
  showTime,
  destination,
  removable,
}: {
  item: Item;
  stopNumber: number | null;
  showTime: boolean;
  destination: string;
  removable?: Removable;
}) {
  return (
    <li className="stop">
      <span className="stop-time">{showTime ? TIME_LABEL[item.timeOfDay] : <span className="sr-only">{TIME_LABEL[item.timeOfDay]}</span>}</span>
      <div className={`item kind-${item.kind}`}>
        <span className="item-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[item.kind]}
          </svg>
          {stopNumber && <span className="item-num">{stopNumber}</span>}
        </span>
        <div className="item-body">
          <div className="item-head">
            <h4>
              {stopNumber && <span className="sr-only">Stop {stopNumber}: </span>}
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
          {item.placeName && (
            <p className="item-place">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              {item.placeName} ·{" "}
              <a href={mapsSearchUrl(item.placeName, destination)} target="_blank" rel="noopener noreferrer">
                Search on Google Maps<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          )}
          <div className="item-meta">
            <span className="badge kind">{KIND_LABEL[item.kind]}</span>
            {item.placeName && <span className="badge unverified">Place not verified</span>}
            {item.durationMinutes != null && <span className="badge est">Est. {duration(item.durationMinutes)}</span>}
            {item.estimatedCostInr != null && <span className="badge est">Est. {inr.format(item.estimatedCostInr)}</span>}
          </div>
          <p>{item.description}</p>
          {item.fitNote && <p className="small muted item-note">{item.fitNote}</p>}
          {item.checkBeforeYouGo.length > 0 && (
            <div className="small item-note">
              <strong>Check before you go</strong>
              <ul>
                {item.checkBeforeYouGo.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
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
      {days.map((day, i) => {
        const stops = day.items.filter(isStop);
        let stopCount = 0;
        return (
          <section className="day" key={i} aria-labelledby={`day-${i + 1}`}>
            <DaySketch id={`sketch-${i + 1}`} seed={`${destination}-${i}-${day.title}`} stops={stops.map((s) => s.title)} />
            <div className="day-head">
              <h3 id={`day-${i + 1}`}>
                <span className="day-num">
                  Day {i + 1}
                  {day.date && ` · ${formatDate(day.date)}`}
                </span>
                {day.title}
              </h3>
            </div>
            {day.items.length === 0 ? (
              <p className="muted small">Nothing planned for this day.</p>
            ) : (
              <ul className="timeline">
                {day.items.map((item, j) => (
                  <ItemCard
                    key={item.id ?? j}
                    item={item}
                    stopNumber={isStop(item) ? ++stopCount : null}
                    showTime={j === 0 || day.items[j - 1].timeOfDay !== item.timeOfDay}
                    destination={destination}
                    removable={removable}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
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
