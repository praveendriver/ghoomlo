"use client";

import { useActionState } from "react";
import { generatePlanAction } from "@/app/actions/trips";
import type { PlanState } from "@/app/actions/trips";

export function GeneratePlan({
  tripId,
  label,
  disabledReason,
}: {
  tripId: string;
  label: string;
  disabledReason?: string;
}) {
  const [state, action, pending] = useActionState<PlanState, FormData>(generatePlanAction, {});
  return (
    <form action={action} className="stack-sm no-print">
      <input type="hidden" name="tripId" value={tripId} />
      <div>
        <button type="submit" className="btn primary" disabled={pending || Boolean(disabledReason)} aria-busy={pending}>
          {pending ? "Drafting your plan…" : label}
        </button>
      </div>
      <p className="small muted" role="status">
        {pending ? "This usually takes a minute or two. You can keep this page open." : disabledReason}
      </p>
      {state.error && !pending && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
