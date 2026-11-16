import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

export function Brand() {
  return (
    <Link href="/" className="brand">
      ghoom<span>lo</span>
    </Link>
  );
}

/** `overlay` places the header on top of a photo hero instead of on the page background. */
export function SiteHeader({ signedIn, overlay = false }: { signedIn: boolean; overlay?: boolean }) {
  return (
    <div className="shell">
      <header className={overlay ? "topbar" : "topbar solid"}>
        <Brand />
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
              <Link href="/signup" className="pill">
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="site">
      <div className="shell stack-sm">
        <Brand />
        <p className="small">
          Ghoomlo drafts trip plans; it does not sell or book travel. Always confirm prices, opening hours,
          and entry rules with the provider or an official source.
        </p>
      </div>
    </footer>
  );
}
