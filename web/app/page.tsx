import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth/session";

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  if (await currentUser()) redirect("/trips");
  const { deleted } = await searchParams;
  return (
    <>
      <SiteHeader signedIn={false} />
      <main className="stack">
        {deleted && (
          <p className="notice ok" role="status">
            Your account and all its data have been deleted.
          </p>
        )}
        <section className="hero">
          <h1>A trip plan that fits your family — and tells you what to check.</h1>
          <p className="muted">
            Tell Ghoomlo who is travelling, what you eat, how fast you like to go, and which days are off
            limits. Get a day-by-day draft built around those constraints, with every estimate and
            unverified detail clearly marked.
          </p>
          <div className="row" style={{ marginTop: 20 }}>
            <Link href="/signup" className="btn primary">
              Create a free account
            </Link>
            <Link href="/login" className="btn">
              Sign in
            </Link>
          </div>
        </section>
        <section className="features" aria-label="What Ghoomlo does">
          <div className="card stack-sm">
            <h2>Built around your people</h2>
            <p className="muted">Food rules, access needs, children and seniors are treated as constraints, not afterthoughts.</p>
          </div>
          <div className="card stack-sm">
            <h2>Dates that actually work</h2>
            <p className="muted">Mark school days and meetings as blocked. If your dates clash, see the nearest dates that do not.</p>
          </div>
          <div className="card stack-sm">
            <h2>Honest about what it knows</h2>
            <p className="muted">Plans are drafted by AI. Places are marked unverified, costs are marked as estimates, and you get a list of what to confirm.</p>
          </div>
        </section>
        <p className="notice info small">
          Ghoomlo is in early development. It does not show live prices or availability, and it does not
          book travel.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
