import type { Metadata } from "next";
import { DeleteAccountForm } from "@/components/DeleteAccountForm";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="stack">
      <h1>Account</h1>
      <div className="card stack-sm">
        <h2>Signed in as</h2>
        <p>
          {user.name} · {user.email}
        </p>
      </div>
      <div className="card stack-sm">
        <h2>Your data</h2>
        <p className="muted">
          Download everything Ghoomlo holds about you — your household details, trips, and plans — as a
          single file.
        </p>
        <div>
          {/* A plain link: this is a file download, not a page navigation. */}
          <a href="/api/account/export" className="btn" download>
            Download my data
          </a>
        </div>
      </div>
      <div className="card stack-sm">
        <h2>Delete account</h2>
        <p className="muted">
          This permanently removes your account, household details, trips, and plans. It cannot be undone.
        </p>
        <DeleteAccountForm />
      </div>
    </div>
  );
}
