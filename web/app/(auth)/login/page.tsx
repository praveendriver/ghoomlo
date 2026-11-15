import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { safeNext } from "@/lib/prefill";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next) ?? undefined;
  return (
    <div className="card stack">
      <h1>Sign in</h1>
      <AuthForm mode="login" next={next} />
      <p className="small muted">
        New here? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Create an account</Link>
      </p>
    </div>
  );
}
