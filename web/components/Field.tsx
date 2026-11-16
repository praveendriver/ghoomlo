export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {/* Below the input, so side-by-side fields line up whether or not they have a hint. */}
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="error-text" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** Props that tie an input to its hint and error for assistive technology. */
export function describe(id: string, hint: boolean, error?: string) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return { id, "aria-describedby": ids || undefined, "aria-invalid": error ? true : undefined } as const;
}
