import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="card stack">
      <h1>Create your account</h1>
      <AuthForm mode="signup" />
      <p className="small muted">
        Already have one? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
