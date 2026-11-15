#!/usr/bin/env python3
"""One-time interactive Instagram login → cached session for instagrapi.

Run this from a terminal (interactive — handles 2FA prompts):
  python3 scripts/api/instagram_session_bootstrap.py

After it succeeds, instagram_creator.py will reuse the cached session.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, load_secrets, require  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SESSION_DIR = ROOT / ".workspace" / ".influencer-cache" / "instagram"


def main():
    try:
        from instagrapi import Client
    except ImportError:
        eprint("instagrapi not installed; pip install instagrapi")
        return 1

    secrets = load_secrets()
    user, password = require(secrets, "INSTAGRAM_USER", "INSTAGRAM_PASS")

    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    session_file = SESSION_DIR / f"{user}.session.json"

    cl = Client()
    cl.delay_range = [4, 8]

    # 2FA handler: prompts at terminal
    def _on_2fa(_):
        return input("\nEnter 2FA code from authenticator/SMS: ").strip()

    cl.challenge_code_handler = lambda u, choice: input(
        f"\nInstagram sent a {choice} code to '{u}'. Paste code: "
    ).strip()
    cl.change_password_handler = lambda u: ""  # no-op

    print(f"Logging in as {user}…")
    try:
        cl.login(user, password, verification_code="")
    except Exception as e:
        msg = str(e)
        if "two_factor" in msg.lower() or "2fa" in msg.lower():
            code = input("2FA required. Enter code: ").strip()
            try:
                cl.login(user, password, verification_code=code)
            except Exception as e2:
                eprint(f"2FA login failed: {e2}")
                return 1
        else:
            eprint(f"login failed: {type(e).__name__}: {e}")
            return 1

    cl.dump_settings(session_file)
    print(f"OK — session saved to {session_file}")
    print(f"Logged in user_id: {cl.user_id}")
    print("Now retry: python3 scripts/api/instagram_creator.py --handle bruisedpassports --max 2")
    return 0


if __name__ == "__main__":
    sys.exit(main())
