import type { FieldErrors } from "@/lib/validation";

/** Shape returned by form actions for `useActionState`. */
export type FormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  /** Submitted text values, echoed back so the form is not wiped on an error. */
  values?: Record<string, string>;
  saved?: boolean;
};

export function textValues(form: FormData, omit: string[] = ["password", "next"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string" && !omit.includes(k) && !k.startsWith("$")) out[k] = v;
  }
  return out;
}
