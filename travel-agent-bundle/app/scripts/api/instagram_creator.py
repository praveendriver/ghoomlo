#!/usr/bin/env python3
"""Instagram creator → recent posts/reels JSON on stdout.

Usage:
  instagram_creator.py --handle bruisedpassports --since 2024-01-01 --max 20

Uses instagrapi (mobile-API). Requires INSTAGRAM_USER + INSTAGRAM_PASS in
.workspace/secrets.local.md OR a pre-bootstrapped session at
.workspace/.influencer-cache/instagram/<user>.session.json.

To bootstrap interactively (one-time, handles 2FA / challenges):
  python3 scripts/api/instagram_session_bootstrap.py

Throttling:
  - 6-10s sleep between item fetches
  - Hard cap default 20/run/handle
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, load_secrets, print_json, require  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SESSION_DIR = ROOT / ".workspace" / ".influencer-cache" / "instagram"


def get_client(user: str, password: str):
    try:
        from instagrapi import Client
        from instagrapi.exceptions import LoginRequired
    except ImportError:
        eprint("instagrapi not installed; pip install instagrapi")
        return None

    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    session_file = SESSION_DIR / f"{user}.session.json"

    cl = Client()
    cl.delay_range = [6, 10]

    if session_file.exists():
        try:
            cl.load_settings(session_file)
            cl.login(user, password)  # validates session
            cl.get_timeline_feed()
            return cl
        except Exception as e:
            eprint(f"cached session invalid ({type(e).__name__}: {e}); re-login")

    try:
        cl.login(user, password)
        cl.dump_settings(session_file)
        return cl
    except Exception as e:
        eprint(f"instagram login failed: {type(e).__name__}: {e}")
        return None


def main():
    p = argparse.ArgumentParser(description="Instagram creator scraper (instagrapi)")
    p.add_argument("--handle", required=True)
    p.add_argument("--since", help="YYYY-MM-DD")
    p.add_argument("--max", type=int, default=20)
    args = p.parse_args()

    secrets = load_secrets()
    user, password = require(secrets, "INSTAGRAM_USER", "INSTAGRAM_PASS")

    cl = get_client(user, password)
    if cl is None:
        print_json([])
        return 0

    cutoff = None
    if args.since:
        try:
            cutoff = datetime.strptime(args.since, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    handle = args.handle.lstrip("@")
    try:
        user_id = cl.user_id_from_username(handle)
    except Exception as e:
        eprint(f"profile lookup failed for {handle}: {type(e).__name__}: {e}")
        print_json([])
        return 0

    try:
        medias = cl.user_medias(user_id, amount=args.max)
    except Exception as e:
        eprint(f"media enumeration failed for {handle}: {type(e).__name__}: {e}")
        print_json([])
        return 0

    out = []
    for m in medias:
        ts = m.taken_at.replace(tzinfo=timezone.utc) if m.taken_at.tzinfo is None else m.taken_at
        if cutoff and ts < cutoff:
            break

        # media_type: 1=photo, 2=video, 8=album
        # product_type: "feed" / "clips" (reels) / "igtv"
        is_reel = (m.media_type == 2 and getattr(m, "product_type", "") == "clips")
        kind = "reel" if is_reel else ("video" if m.media_type == 2 else ("album" if m.media_type == 8 else "post"))

        location_name = None
        try:
            if m.location:
                location_name = m.location.name
        except Exception:
            pass

        hashtags = []
        if m.caption_text:
            hashtags = [w[1:] for w in m.caption_text.split() if w.startswith("#")][:30]

        video_url = None
        try:
            if m.media_type == 2 and m.video_url:
                video_url = str(m.video_url)
        except Exception:
            pass

        out.append({
            "post_id": m.code,
            "type": kind,
            "caption": (m.caption_text or "")[:2000],
            "hashtags": hashtags,
            "location": location_name,
            "url": f"https://www.instagram.com/p/{m.code}/",
            "published": ts.isoformat(),
            "likes": m.like_count,
            "video_url": video_url,
        })
        time.sleep(random.uniform(2.0, 4.0))  # politeness; instagrapi already adds delay_range

    print_json(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
