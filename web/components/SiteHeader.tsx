import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="topbar">
      <Link href={signedIn ? "/trips" : "/"} className="brand">
        ghoom<span>lo</span>
      </Link>
      <nav className="nav" aria-label="Main">
        {signedIn ? (
          <>
            <Link href="/trips">Trips</Link>
            <Link href="/household">Household</Link>
            <Link href="/account">Account</Link>
            <form action={logoutAction}>
              <button type="submit">Sign out</button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Create account</Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site small muted">
      Ghoomlo drafts plans; it does not sell or book travel. Always confirm prices, opening hours, and
      entry rules with the provider or an official source.
    </footer>
  );
}
