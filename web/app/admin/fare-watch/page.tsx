import type { Metadata } from "next";
import { deleteAlertAction } from "@/app/actions/fare-watch";
import { AlertForm } from "@/components/AlertForm";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth/admin";
import { listAlerts, listSignups } from "@/lib/data/fare-watch";
import { formatDate, todayIso } from "@/lib/dates";
import { countRecent, matches } from "@/lib/fare-watch";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Fare watch admin", robots: { index: false } };

function when(a: { travelStart: string | null; travelEnd: string | null; breakLabel: string | null }): string {
  if (a.travelStart) return `${formatDate(a.travelStart)} to ${formatDate(a.travelEnd ?? a.travelStart)}`;
  return a.breakLabel ?? "Any dates";
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function tally(values: string[]): [string, number][] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const v of values) {
    const key = v.trim().toLowerCase();
    const entry = counts.get(key) ?? { label: v.trim(), n: 0 };
    entry.n++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((e) => [e.label, e.n]);
}

export default async function FareWatchAdminPage() {
  await requireAdmin();
  const [signups, alerts, base] = await Promise.all([listSignups(), listAlerts(), siteUrl()]);
  const places = tally(signups.flatMap((s) => s.wishlist));
  const cities = tally(signups.map((s) => s.homeCity));
  const lastWeek = countRecent(signups, 7);

  return (
    <>
      <SiteHeader signedIn />
      <main className="shell page stack-lg">
        <div className="stack-sm">
          <p className="eyebrow">Admin</p>
          <h1>Fare watch</h1>
          <p className="muted">Only you can see this page.</p>
        </div>

        <section className="stack" aria-labelledby="signups-h">
          <div className="row between">
            <h2 id="signups-h">Sign-ups</h2>
            {signups.length > 0 && (
              <a href="/admin/fare-watch/export" className="btn" download>
                Download as spreadsheet
              </a>
            )}
          </div>
          <div className="stat-row">
            <div className="stat">
              <b>{signups.length}</b>people signed up
            </div>
            <div className="stat">
              <b>{lastWeek}</b>in the last 7 days
            </div>
            <div className="stat">
              <b>{places[0]?.[0] ?? "—"}</b>most wanted place
            </div>
            <div className="stat">
              <b>{cities[0]?.[0] ?? "—"}</b>top home city
            </div>
          </div>
          {places.length > 0 && (
            <p className="small muted">
              Wishlist: {places.slice(0, 12).map(([p, n]) => `${p} (${n})`).join(" · ")}
            </p>
          )}
          {signups.length === 0 ? (
            <p className="card muted">Nobody has signed up yet. Share the page: {base}/fare-watch</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>From</th>
                    <th>School</th>
                    <th>Wishlist</th>
                    <th>Travel windows</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {signups.map((s) => (
                    <tr key={s.id}>
                      <td>{s.email}</td>
                      <td>{s.homeCity}</td>
                      <td>{s.school}</td>
                      <td>{s.wishlist.join(", ")}</td>
                      <td>{s.windows.length ? s.windows.map((w) => w.label).join("; ") : "Any"}</td>
                      <td>{formatDate(s.createdAt.toISOString().slice(0, 10))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="stack" aria-labelledby="new-h">
          <div className="stack-sm">
            <h2 id="new-h">Create a fare alert</h2>
            <p className="muted">
              Enter a fare you have seen yourself. People whose city, wishlist and break match will be listed
              for you to email.
            </p>
          </div>
          <div className="card">
            <AlertForm today={todayIso()} />
          </div>
        </section>

        <section className="stack" aria-labelledby="alerts-h">
          <h2 id="alerts-h">Alerts</h2>
          {alerts.length === 0 && <p className="card muted">No alerts yet.</p>}
          {alerts.map(({ alert, clicks, people }) => {
            const recipients = signups.filter((s) => matches(s, alert));
            const link = `${base}/go/${alert.code}`;
            return (
              <article className="card stack" key={alert.id}>
                <div className="row between">
                  <h3>
                    {alert.origin} → {alert.destination} · {inr.format(alert.priceInr)} per person
                  </h3>
                  <form action={deleteAlertAction}>
                    <input type="hidden" name="code" value={alert.code} />
                    <SubmitButton className="btn quiet danger" pendingLabel="Deleting…">
                      Delete
                    </SubmitButton>
                  </form>
                </div>
                <p className="muted small">
                  {when(alert)} · seen {formatDate(alert.seenOn)} at {alert.source}
                </p>
                <div className="stat-row">
                  <div className="stat">
                    <b>{recipients.length}</b>people to email
                  </div>
                  <div className="stat">
                    <b>{clicks}</b>link opens
                  </div>
                  <div className="stat">
                    <b>{people}</b>known people who opened
                  </div>
                </div>
                <details>
                  <summary>Email to send</summary>
                  <div className="stack-sm" style={{ marginTop: 12 }}>
                    <p className="small muted">
                      Send from your own email with recipients in BCC. For a personal link per person (so you
                      can see who opened it), download the recipient list and use mail merge.
                    </p>
                    <pre className="copy">{`Subject: ${alert.destination} from ${alert.origin}: ${inr.format(alert.priceInr)}, ${when(alert)}

Hello,

We spotted a fare from ${alert.origin} to ${alert.destination}, travelling ${when(alert)}, which fits a time you told us you could travel: ${inr.format(alert.priceInr)} per person, seen on ${formatDate(alert.seenOn)} at ${alert.source}.

Fares change quickly, so the price may differ when you look. The booking site confirms the final price.

See the fare: ${link}

You are getting this because you joined the Ghoomlo fare watch. To stop these emails and delete your details, reply with "stop".`}</pre>
                    <p className="small">
                      <strong>BCC list:</strong> {recipients.length ? recipients.map((r) => r.email).join(", ") : "nobody matches yet"}
                    </p>
                    {recipients.length > 0 && (
                      <div>
                        <a href={`/admin/fare-watch/export?alert=${alert.code}`} className="btn quiet" download>
                          Download recipients with personal links
                        </a>
                      </div>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
