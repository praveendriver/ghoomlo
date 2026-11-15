import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanDays, VerifyList } from "@/components/PlanView";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { UseIdeaForm } from "@/components/UseIdeaForm";
import { currentUser } from "@/lib/auth/session";
import { getHousehold } from "@/lib/data/household";
import { todayIso } from "@/lib/dates";
import { findIdea } from "@/lib/ideas";

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

  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />
      <main className="stack">
        <div className="stack-sm">
          <p>
            <Link href="/">← All sample plans</Link>
          </p>
          <h1>{idea.title}</h1>
          <p className="muted">{idea.tagline}</p>
        </div>

        <section className="card stack" aria-labelledby="use-h">
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
      </main>
      <SiteFooter />
    </>
  );
}
