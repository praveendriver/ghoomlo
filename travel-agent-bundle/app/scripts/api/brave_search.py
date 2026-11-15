#!/usr/bin/env python3
"""Brave Search → normalized JSON on stdout.

Usage:
  brave_search.py --query "best vegetarian restaurants Tokyo 2025 blog" --count 10

Used by corpus_builder to discover NEW blog posts about a destination beyond the
seed watchlist. 2,000 free queries/month — keep `--count` modest.
"""
from __future__ import annotations

import argparse
import sys
import urllib.parse as _u
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, http_json, load_secrets, print_json, require  # noqa: E402

BASE = "https://api.search.brave.com/res/v1/web/search"


def main():
    p = argparse.ArgumentParser(description="Brave Search")
    p.add_argument("--query", required=True)
    p.add_argument("--count", type=int, default=10)
    p.add_argument("--country", default="IN")
    p.add_argument("--lang", default="en")
    p.add_argument("--freshness", help="pd / pw / pm / py — past day/week/month/year")
    args = p.parse_args()

    secrets = load_secrets()
    (key,) = require(secrets, "BRAVE_KEY")

    params = {
        "q": args.query,
        "count": min(args.count, 20),
        "country": args.country,
        "search_lang": args.lang,
        "safesearch": "moderate",
    }
    if args.freshness:
        params["freshness"] = args.freshness

    headers = {"Accept": "application/json", "X-Subscription-Token": key}
    data = http_json(f"{BASE}?{_u.urlencode(params)}", headers=headers)
    if not data:
        print_json([])
        return 0
    web = (data.get("web") or {}).get("results") or []
    out = []
    for r in web:
        out.append({
            "url": r.get("url"),
            "title": r.get("title"),
            "snippet": r.get("description"),
            "host": (r.get("meta_url") or {}).get("hostname"),
            "age": r.get("age"),
        })
    print_json(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
