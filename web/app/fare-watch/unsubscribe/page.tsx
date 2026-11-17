import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeAction } from "@/app/actions/fare-watch";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { currentUser } from "@/lib/auth/session";
import { findSignupByToken } from "@/lib/data/fare-watch";

export const metadata: Metadata = { title: "Stop fare watch", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const [user, { t, done }] = await Promise.all([currentUser(), searchParams]);
  const signup = !done && t ? await findSignupByToken(t) : null;
  return (
    <>
      <SiteHeader signedIn={Boolean(user)} narrow />
      <main className="shell narrow page stack">
        <p className="eyebrow">Fare watch</p>
        {done ? (
          <>
            <h1>Your fare watch has stopped.</h1>
            <p>We have deleted your email, school and wishlist. You will not hear from us again.</p>
          </>
        ) : signup ? (
          <>
            <h1>Stop your fare watch?</h1>
            <p>
              This stops alerts to <strong>{signup.email}</strong> and deletes your email, school and wishlist.
            </p>
            {/* A button, not an automatic action, so email scanners that open links cannot unsubscribe people. */}
            <form action={unsubscribeAction}>
              <input type="hidden" name="token" value={signup.token} />
              <SubmitButton className="btn danger" pendingLabel="Stopping…">
                Stop alerts and delete my details
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <h1>This link is no longer active.</h1>
            <p>Your fare watch may already have been stopped.</p>
          </>
        )}
        <p>
          <Link href="/fare-watch">Back to fare watch</Link>
        </p>
      </main>
      <SiteFooter narrow />
    </>
  );
}
