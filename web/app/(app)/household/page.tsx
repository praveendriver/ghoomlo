import type { Metadata } from "next";
import { HouseholdForm } from "@/components/HouseholdForm";
import { requireUser } from "@/lib/auth/session";
import { getHousehold } from "@/lib/data/household";
import { householdSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Household" };

export default async function HouseholdPage() {
  const user = await requireUser();
  const stored = await getHousehold(user.id);
  const parsed = stored ? householdSchema.safeParse(stored) : null;
  return (
    <div className="stack">
      <div className="stack-sm">
        <h1>Your household</h1>
        <p className="muted">
          Optional, but plans drafted for you are built around these details. Share only what you want used; you can change or
          delete it at any time.
        </p>
      </div>
      <div className="card">
        <HouseholdForm initial={parsed?.success ? parsed.data : null} firstTime={!stored} />
      </div>
    </div>
  );
}
