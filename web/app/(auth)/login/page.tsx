import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="card stack">
      <h1>Sign in</h1>
      <AuthForm mode="login" />
      <p className="small muted">
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </div>
  );
}
