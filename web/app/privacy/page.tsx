import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth/session";
import { isRecordingUsage } from "@/components/Clarity";

export const metadata: Metadata = { title: "Privacy notice" };

export default async function PrivacyPage() {
  const user = await currentUser();
  return (
    <>
      <SiteHeader signedIn={Boolean(user)} narrow />
      <main className="shell narrow page stack">
        <h1>Privacy notice</h1>
        <p className="muted">What Ghoomlo collects, why, and how to have it deleted.</p>

        <section className="stack-sm">
          <h2>Fare watch</h2>
          <p>
            When you sign up we keep your email address, the city you fly from, your child&apos;s school, and
            your wishlist of places. We use these only to decide which fare alerts to email you.
          </p>
          <p>
            When you open a link in one of our alerts, we record that it was opened and, where the link is
            personal to you, that it was you. This tells us which alerts are useful.
          </p>
          <p>
            To stop alerts and delete all of this, use the &quot;Stop my fare watch&quot; link shown when you
            signed up, or reply &quot;stop&quot; to any alert email.
          </p>
        </section>

        <section className="stack-sm">
          <h2>Trip planning accounts</h2>
          <p>
            If you create an account we keep your name, email and a scrambled form of your password, plus any
            household details, trips and plans you add. Travellers are stored as age groups, not names or
            dates of birth. You can download or delete everything from the <Link href="/account">Account</Link>{" "}
            page.
          </p>
          <p>
            To draft a plan, your trip and household details are sent to Anthropic&apos;s AI service. Place
            names in a plan are sent to OpenStreetMap to find them on a map, and your browser loads map
            images from OpenStreetMap.
          </p>
        </section>

        {isRecordingUsage() && (
          <section className="stack-sm">
            <h2>How the site is used</h2>
            <p>
              We use Microsoft Clarity to record how pages are used: taps, scrolling and screens visited.
              What you type into forms is masked.
            </p>
          </section>
        )}

        <section className="stack-sm">
          <h2>What we do not do</h2>
          <p>We do not sell your details or share them with advertisers.</p>
        </section>
      </main>
      <SiteFooter narrow />
    </>
  );
}
