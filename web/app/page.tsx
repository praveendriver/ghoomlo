import Link from "next/link";
import { IdeaCarousel } from "@/components/IdeaCarousel";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { StartBox } from "@/components/StartBox";
import { currentUser } from "@/lib/auth/session";
import { MAX_INTENT_CHARS } from "@/lib/prefill";

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await currentUser();
  const { deleted } = await searchParams;
  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />
      <main className="stack">
        {deleted && (
          <p className="notice ok" role="status">
            Your account and all its data have been deleted.
          </p>
        )}
        <section className="hero stack">
          <div>
            <h1>Where would you like to go?</h1>
            <p className="muted">
              Describe the trip in your own words, or start from a sample plan and make it yours.
            </p>
          </div>
          <StartBox maxLength={MAX_INTENT_CHARS} />
        </section>

        <section className="stack-sm" aria-labelledby="ideas-h">
          <div className="row between">
            <h2 id="ideas-h">Start from a sample plan</h2>
            {user && <Link href="/trips">Your trips →</Link>}
          </div>
          <IdeaCarousel />
        </section>

        <section className="features" aria-label="How Ghoomlo helps">
          <div className="card stack-sm">
            <h3>Built around your people</h3>
            <p className="muted small">Food rules, access needs, children and seniors are treated as constraints, not afterthoughts.</p>
          </div>
          <div className="card stack-sm">
            <h3>Dates that actually work</h3>
            <p className="muted small">Mark school days and meetings as blocked. If your dates clash, see the nearest dates that do not.</p>
          </div>
          <div className="card stack-sm">
            <h3>Honest about what it knows</h3>
            <p className="muted small">Places are marked unverified, costs are marked as estimates, and every plan lists what to confirm.</p>
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
