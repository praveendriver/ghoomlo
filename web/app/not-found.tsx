import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell narrow page stack" style={{ paddingTop: 96 }}>
      <p className="eyebrow">Page not found</p>
      <h1>We could not find that page</h1>
      <p className="muted">It may have been deleted, or the link may be wrong.</p>
      <div>
        <Link href="/" className="btn primary">
          Go to the start
        </Link>
      </div>
    </main>
  );
}
