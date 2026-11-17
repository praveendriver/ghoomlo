import type { Metadata } from "next";
import Image from "next/image";
import { FareWatchForm } from "@/components/FareWatchForm";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { PHOTOS } from "@/lib/photos";

export const metadata: Metadata = {
  title: "School-holiday fare watch",
  description: "Tell us your child's school and where you want to go. We email you when we spot a good fare for the holidays.",
};

const STEPS = [
  ["Pick your school, dates and places", "We show your school's breaks and the year's long weekends. Tick the ones you'd travel in, and up to five places."],
  ["We keep an eye on fares", "A person on our team checks fares for those places around the school holidays."],
  ["You get an email when we spot a good one", "It says the fare, where and when we saw it, and has a link to book. The booking site confirms the final price."],
] as const;

export default async function FareWatchPage() {
  const user = await currentUser();
  return (
    <>
      <main>
        <div className="hero compact on-photo">
          <Image src={PHOTOS.goa} alt="" fill priority placeholder="blur" sizes="100vw" />
          <SiteHeader signedIn={Boolean(user)} overlay narrow />
          <div className="shell narrow hero-grid">
            <div className="stack-sm">
              <p className="eyebrow">School-holiday fare watch</p>
              <h1>
                Holiday flights, <em>before the prices climb.</em>
              </h1>
              <p className="hero-lede" style={{ marginTop: 0 }}>
                Tell us your child&apos;s school and where you would love to go. We email you when we spot a
                good fare for the holidays.
              </p>
            </div>
          </div>
        </div>
        <div className="shell narrow page stack-lg" style={{ paddingTop: 0 }}>
          <section className="card raised lift stack" aria-labelledby="signup-h">
            <div className="stack-sm">
              <h2 id="signup-h">Start your fare watch</h2>
              <p className="muted">Free. No account needed. Takes a minute.</p>
            </div>
            <FareWatchForm today={todayIso()} />
          </section>

          <section className="features" aria-label="How it works">
            {STEPS.map(([title, body], i) => (
              <div className="feature stack-sm" key={title}>
                <span className="feature-num">0{i + 1}</span>
                <h3>{title}</h3>
                <p className="muted">{body}</p>
              </div>
            ))}
          </section>

          <p className="small muted">
            This is an early version. Fares are checked by hand, so we will not catch every drop, and a fare
            can change between our email and your booking. We do not sell tickets.
          </p>
        </div>
      </main>
      <SiteFooter narrow />
    </>
  );
}
