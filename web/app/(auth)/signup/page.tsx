import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { safeNext } from "@/lib/prefill";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; start?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next) ?? undefined;
  return (
    <div className="stack">
      <h1>Create your account</h1>
      {(params.start || next) && (
        <p className="notice info small">
          {params.start
            ? "We have kept what you wrote. Create an account and we will pick up from there."
            : "Create an account and we will take you straight back to that plan."}
        </p>
      )}
      <AuthForm mode="signup" next={next} />
      <p className="small muted">
        Already have one? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Sign in</Link>
      </p>
    </div>
  );
}
