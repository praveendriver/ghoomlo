#!/usr/bin/env python3
"""Social Blade page scrape → JSON on stdout.

Usage:
  social_blade.py --handle @tanyakhanijow

Polite scrape (User-Agent set, 1 req cached for 7 days). Public page only —
extracts subscriber count, 30-day growth, and the channel "grade" if present.

This is a heuristic data source — Social Blade pages change shape periodically.
Fail-soft: returns whatever fields it can parse, blanks for the rest.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, print_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = ROOT / ".workspace" / ".influencer-cache" / "socialblade"
CACHE_TTL = 7 * 24 * 3600  # 7 days


def cache_path(handle: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9_]", "_", handle)
    return CACHE_DIR / f"{safe}.json"


def load_cached(handle: str):
    p = cache_path(handle)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text())
    except Exception:
        return None
    if time.time() - data.get("_fetched_at", 0) > CACHE_TTL:
        return None
    return data


def save_cache(handle: str, data: dict):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    data["_fetched_at"] = time.time()
    cache_path(handle).write_text(json.dumps(data, indent=2))


def fetch(url: str) -> str | None:
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 yatra/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        eprint(f"socialblade fetch failed: {e}")
        return None


def parse(html: str) -> dict:
    out = {"subs": None, "growth_30d": None, "grade": None}
    # Subscriber count: typical pattern <p id="youtube-stats-header-subs">123,456</p>
    m = re.search(r'id=["\']youtube-stats-header-subs["\'][^>]*>([\d,\.KMB\s]+)', html)
    if m:
        out["subs"] = m.group(1).strip()
    # Grade: typical <p id="rawUser">B+</p>
    m = re.search(r'<p id=["\']rawUser["\'][^>]*>([A-Z][\+\-]?)</p>', html)
    if m:
        out["grade"] = m.group(1)
    # 30-day growth — Social Blade renders these in a table; pull anything that looks like the row.
    m = re.search(r'30 ?Day[^<]*</[^>]+>\s*<[^>]+>\s*<[^>]+>\s*([+\-]?[\d,]+)', html, re.I)
    if m:
        out["growth_30d"] = m.group(1)
    return out


def main():
    p = argparse.ArgumentParser(description="Social Blade scrape (polite)")
    p.add_argument("--handle", required=True, help="@channel or username")
    p.add_argument("--platform", choices=["youtube", "instagram"], default="youtube")
    p.add_argument("--no-cache", action="store_true")
    args = p.parse_args()

    cache_key = f"{args.platform}:{args.handle}"
    if not args.no_cache:
        cached = load_cached(cache_key)
        if cached:
            print_json(cached)
            return 0

    handle = args.handle.lstrip("@")
    if args.platform == "youtube":
        url = f"https://socialblade.com/youtube/c/{handle}"
    else:
        url = f"https://socialblade.com/instagram/user/{handle}"

    html = fetch(url)
    if not html:
        out = {"handle": args.handle, "platform": args.platform, "subs": None, "growth_30d": None, "grade": None, "error": "fetch failed"}
        print_json(out)
        return 0

    parsed = parse(html)
    parsed.update({"handle": args.handle, "platform": args.platform, "url": url})
    save_cache(cache_key, parsed)
    # Politeness sleep — even on cache miss, don't hammer if a caller loops.
    time.sleep(5)
    print_json(parsed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
