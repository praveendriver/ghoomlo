import Image from "next/image";
import Link from "next/link";
import { IdeaCarousel } from "@/components/IdeaCarousel";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { StartBox } from "@/components/StartBox";
import { currentUser } from "@/lib/auth/session";
import { PHOTOS } from "@/lib/photos";
import { MAX_INTENT_CHARS } from "@/lib/prefill";

const FEATURES = [
  ["Built around your people", "Food rules, access needs, children and seniors are treated as constraints, not afterthoughts."],
  ["Dates that actually work", "Mark school days and meetings as blocked. If your dates clash, see the nearest dates that do not."],
  ["Honest about what it knows", "Places are marked unverified, costs are marked as estimates, and every plan lists what to confirm."],
] as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await currentUser();
  const { deleted } = await searchParams;
  return (
    <>
      <main>
        <div className="hero on-photo">
          <Image src={PHOTOS.hero} alt="" fill priority placeholder="blur" sizes="100vw" />
          <SiteHeader signedIn={Boolean(user)} overlay />
          <div className="shell hero-grid">
            <div>
              <p className="eyebrow">Trip planning for Indian families</p>
              <h1>
                Where would you <em>like to go?</em>
              </h1>
              <p className="hero-lede">
                Describe the trip in your own words, or start from a sample plan and make it yours.
              </p>
              {user && (
                <p style={{ marginTop: 24 }}>
                  <Link href="/trips" className="btn ghost">
                    Your trips →
                  </Link>
                </p>
              )}
            </div>
            <StartBox maxLength={MAX_INTENT_CHARS} />
          </div>
        </div>

        <div className="shell page stack-lg">
          {deleted && (
            <p className="notice ok" role="status">
              Your account and all its data have been deleted.
            </p>
          )}
          <section aria-labelledby="ideas-h">
            <IdeaCarousel />
          </section>

          <section className="card raised stack-sm" aria-labelledby="fw-h">
            <p className="eyebrow">New</p>
            <h2 id="fw-h">School-holiday fare watch</h2>
            <p className="muted" style={{ maxWidth: "60ch" }}>
              Tell us your child&apos;s school and where you would love to go. We email you when we spot a good
              fare for the holidays.
            </p>
            <div>
              <Link href="/fare-watch" className="btn accent">
                Start my fare watch
              </Link>
            </div>
          </section>

          <p className="statement">
            Plans shaped around
            <span className="pill-photo">
              <Image src={PHOTOS.goa} alt="" fill sizes="160px" />
            </span>
            your people, your dates
            <span className="pill-photo">
              <Image src={PHOTOS.ladakh} alt="" fill sizes="160px" />
            </span>
            and your pace.
          </p>

          <section className="features" aria-label="How Ghoomlo helps">
            {FEATURES.map(([title, body], i) => (
              <div className="feature stack-sm" key={title}>
                <span className="feature-num">0{i + 1}</span>
                <h3>{title}</h3>
                <p className="muted">{body}</p>
              </div>
            ))}
          </section>

          <section className="cta-band on-photo stack" aria-labelledby="cta-h">
            <Image src={PHOTOS.udaipur} alt="" fill sizes="(max-width: 1180px) 100vw, 1180px" />
            <h2 id="cta-h">Start with a single sentence.</h2>
            <p style={{ maxWidth: "44ch" }}>
              Tell us where and who. We will turn it into a trip you can check, edit, and print.
            </p>
            <div>
              <a href="#start" className="btn ghost">
                Describe your trip
              </a>
            </div>
          </section>

          <p className="small muted">
            Ghoomlo is in early development. It does not show live prices or availability, and it does not
            book travel.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
