"use client";

import { useActionState, useState } from "react";
import { startFromTextAction } from "@/app/actions/start";
import type { FormState } from "@/app/actions/state";

const EXAMPLES = [
  "A relaxed 5-day beach break in November from Delhi, two adults and a 7-year-old, vegetarian",
  "Long weekend in the hills from Bengaluru with my parents, nothing strenuous",
  "4 days in Rajasthan for a family of four, about ₹1,20,000 in total",
];

export function StartBox({ maxLength }: { maxLength: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(startFromTextAction, {});
  const [text, setText] = useState("");
  return (
    <form action={action} className="start-box stack-sm">
      <label htmlFor="start-text" className="sr-only">
        Describe the trip you have in mind
      </label>
      <textarea
        id="start-text"
        name="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={maxLength}
        rows={3}
        placeholder="Describe your trip: where, when, who is going, and anything that matters to you…"
        aria-describedby={state.error ? "start-error" : undefined}
      />
      {state.error && (
        <span className="error-text" id="start-error" role="alert">
          {state.error}
        </span>
      )}
      <div className="row between">
        <span className="small muted" role="status">
          {pending ? "Reading your trip…" : "We turn this into a trip you can check and edit."}
        </span>
        <button type="submit" className="btn primary" disabled={pending} aria-busy={pending}>
          Start planning
        </button>
      </div>
      <div className="stack-sm">
        <span className="small muted">Or try one of these:</span>
        <div className="checks">
          {EXAMPLES.map((example) => (
            <button type="button" key={example} className="chip" onClick={() => setText(example)}>
              {example}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
