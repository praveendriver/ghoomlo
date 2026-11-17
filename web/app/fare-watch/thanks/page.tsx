import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth/session";
import { findSignupByToken } from "@/lib/data/fare-watch";
import { formatWindow } from "@/lib/windows";

export const metadata: Metadata = { title: "You are on the fare watch", robots: { index: false } };

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const [user, { t }] = await Promise.all([currentUser(), searchParams]);
  const signup = t ? await findSignupByToken(t) : null;
  return (
    <>
      <SiteHeader signedIn={Boolean(user)} narrow />
      <main className="shell narrow page stack">
        <p className="eyebrow">Fare watch</p>
        <h1>You are on the list.</h1>
        {signup ? (
          <>
            <p>
              We will email <strong>{signup.email}</strong> when we spot a good fare from {signup.homeCity} to{" "}
              {signup.wishlist.join(", ")} that fits one of these times:
            </p>
            <ul className="stack-sm" style={{ margin: 0, paddingLeft: 20 }}>
              {signup.windows.map((w) => (
                <li key={w.id}>
                  <strong>{w.label}</strong> · {formatWindow(w)}
                </li>
              ))}
            </ul>
            <div className="card stack-sm">
              <h3>Keep this link</h3>
              <p className="muted">
                It stops the alerts and deletes your details whenever you want. You can also reply &quot;stop&quot; to any
                alert email.
              </p>
              <p>
                <Link href={`/fare-watch/unsubscribe?t=${encodeURIComponent(signup.token)}`}>Stop my fare watch</Link>
              </p>
            </div>
          </>
        ) : (
          <p>Thank you. We will be in touch when we spot a good fare.</p>
        )}
        <p className="muted">
          While you wait, you can <Link href="/">start planning a trip</Link>.
        </p>
      </main>
      <SiteFooter narrow />
    </>
  );
}
