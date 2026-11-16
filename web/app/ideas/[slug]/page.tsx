import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanDays, VerifyList } from "@/components/PlanView";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { UseIdeaForm } from "@/components/UseIdeaForm";
import { currentUser } from "@/lib/auth/session";
import { getHousehold } from "@/lib/data/household";
import { todayIso } from "@/lib/dates";
import { findIdea } from "@/lib/ideas";
import { photoFor } from "@/lib/photos";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const idea = findIdea((await params).slug);
  return idea ? { title: idea.title, description: idea.summary } : {};
}

export default async function IdeaPage({ params }: Props) {
  const { slug } = await params;
  const idea = findIdea(slug);
  if (!idea) notFound();
  const user = await currentUser();
  const household = user ? await getHousehold(user.id) : null;

  const photo = photoFor(idea.destination);

  return (
    <>
      <main>
        <div className="hero compact on-photo" style={{ background: idea.tone }}>
          {photo && <Image src={photo} alt="" fill priority placeholder="blur" sizes="100vw" />}
          <SiteHeader signedIn={Boolean(user)} overlay narrow />
          <div className="shell narrow hero-grid">
            <div className="stack-sm">
              <p>
                <Link href="/" style={{ color: "#fff" }}>
                  ← All sample plans
                </Link>
              </p>
              <p className="eyebrow">Sample plan · {idea.days.length} days</p>
              <h1>{idea.title}</h1>
              <p className="hero-lede" style={{ marginTop: 0 }}>
                {idea.tagline}
              </p>
            </div>
          </div>
        </div>
        <div className="shell narrow page stack" style={{ paddingTop: 0 }}>
        <section className="card raised lift stack" aria-labelledby="use-h">
          <h2 id="use-h">Make this plan yours</h2>
          {user ? (
            <UseIdeaForm slug={idea.slug} defaultOrigin={household?.homeCity ?? ""} today={todayIso()} days={idea.days.length} />
          ) : (
            <>
              <p className="muted">
                Save it to your account, set your dates, remove what you do not want, or have it redrafted
                around your family.
              </p>
              <div className="row">
                <Link href={`/signup?next=/ideas/${idea.slug}`} className="btn primary">
                  Create a free account to use it
                </Link>
                <Link href={`/login?next=/ideas/${idea.slug}`} className="btn">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </section>

        <div className="notice warn">
          <strong>A sample plan — a starting point, not checked against live sources.</strong>
          <p className="small" style={{ marginTop: 4 }}>
            It was written for a general traveller, not for your household. Durations are estimates and no
            prices are shown. Confirm opening hours, bookings, and entry rules before you rely on it.
          </p>
        </div>
        <p>{idea.summary}</p>
        <PlanDays days={idea.days} destination={idea.destination} />
        <VerifyList items={idea.thingsToVerify} />
        </div>
      </main>
      <SiteFooter narrow />
    </>
  );
}
