#!/usr/bin/env python3
"""Import Instagram session cookies from a logged-in browser.

Usage (interactive — values won't show in shell history):
  python3 scripts/api/instagram_session_import.py

You'll be prompted for sessionid, ds_user_id, csrftoken. Paste each, hit Enter.
On success, writes .workspace/.influencer-cache/instagram/<user>.session and prints OK.

Why: instaloader's password login is fingerprinted+blocked by Instagram in
2026. Cookie import sidesteps that by reusing the trust already established
through your browser's normal login.
"""
from __future__ import annotations

import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, load_secrets, require  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SESSION_DIR = ROOT / ".workspace" / ".influencer-cache" / "instagram"


def main():
    try:
        import instaloader
    except ImportError:
        eprint("instaloader not installed; pip install instaloader")
        return 1

    secrets = load_secrets()
    user, _ = require(secrets, "INSTAGRAM_USER", "INSTAGRAM_PASS")

    print(f"Importing browser session for IG user: {user}")
    print("Open instagram.com in your browser, DevTools → Application → Cookies → instagram.com")
    print("Paste these three cookie VALUES (input is hidden):\n")

    sessionid = getpass.getpass("sessionid: ").strip()
    ds_user_id = getpass.getpass("ds_user_id: ").strip()
    csrftoken = getpass.getpass("csrftoken: ").strip()

    if not sessionid or not ds_user_id or not csrftoken:
        eprint("missing one or more cookie values")
        return 1

    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    session_file = SESSION_DIR / f"{user}.session"

    L = instaloader.Instaloader(max_connection_attempts=1)
    L.context._session.cookies.update({
        "sessionid": sessionid,
        "ds_user_id": ds_user_id,
        "csrftoken": csrftoken,
    })

    logged_in_user = L.test_login()
    if not logged_in_user:
        eprint("cookie auth failed — sessionid is invalid or expired. "
               "Re-copy from a fresh browser login.")
        return 1

    if logged_in_user.lower() != user.lower():
        eprint(f"cookie belongs to '{logged_in_user}', not '{user}'. "
               f"Update INSTAGRAM_USER in secrets.local.md or paste cookies for the right account.")
        return 1

    L.context.username = logged_in_user
    L.save_session_to_file(str(session_file))

    print(f"OK — wrote {session_file}")
    print(f"Logged in as: {logged_in_user}")
    print("Now retry: python3 scripts/api/instagram_creator.py --handle bruisedpassports --max 2")
    return 0


if __name__ == "__main__":
    sys.exit(main())
