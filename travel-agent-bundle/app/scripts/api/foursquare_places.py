#!/usr/bin/env python3
"""Foursquare Places search → normalized JSON on stdout.

Usage:
  foursquare_places.py --query "vegetarian" --near "Madurai, India" \
                       --kid-friendly --limit 10
"""
from __future__ import annotations

import argparse
import sys
import urllib.parse as _u
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, http_json, load_secrets, print_json, require  # noqa: E402

BASE = "https://api.foursquare.com/v3/places/search"

# Foursquare category IDs we care about.
# Full list: https://docs.foursquare.com/data-products/docs/categories
CATEGORIES = {
    "restaurant": "13065",
    "cafe": "13032",
    "museum": "10027",
    "park": "16032",
    "landmark": "16020",
    "shopping": "17000",
    "market": "17069",
}
EXCLUDE_KID_HOSTILE = "13003,13386"  # bars, nightclubs


def normalize(place):
    loc = place.get("location") or {}
    geo = (place.get("geocodes") or {}).get("main") or {}
    hours = place.get("hours") or {}
    return {
        "fsq_id": place.get("fsq_id"),
        "name": place.get("name"),
        "address": loc.get("formatted_address") or loc.get("address"),
        "lat": geo.get("latitude"),
        "lon": geo.get("longitude"),
        "categories": [c.get("name") for c in place.get("categories", [])],
        "rating": place.get("rating"),
        "price_tier": place.get("price"),
        "hours_today": hours.get("display"),
        "open_now": hours.get("open_now"),
        "popularity": place.get("popularity"),
        "website": place.get("website"),
        "fsq_url": f"https://foursquare.com/v/{place.get('fsq_id')}" if place.get("fsq_id") else None,
    }


def main():
    p = argparse.ArgumentParser(description="Foursquare Places search")
    p.add_argument("--query", required=True, help='free text, e.g. "vegetarian"')
    p.add_argument("--near", required=True, help='locality, e.g. "Madurai, India"')
    p.add_argument("--category", choices=sorted(CATEGORIES), help="restrict to a category")
    p.add_argument("--kid-friendly", action="store_true", help="exclude bars/nightclubs")
    p.add_argument("--limit", type=int, default=10)
    p.add_argument("--radius", type=int, help="metres; only valid with --ll")
    p.add_argument("--ll", help="lat,lon — overrides --near for radius queries")
    args = p.parse_args()

    secrets = load_secrets()
    (key,) = require(secrets, "FOURSQUARE_KEY")

    params = {
        "query": args.query,
        "limit": min(args.limit, 50),
        "fields": "fsq_id,name,location,geocodes,categories,rating,price,hours,popularity,website",
    }
    if args.ll:
        params["ll"] = args.ll
        if args.radius:
            params["radius"] = args.radius
    else:
        params["near"] = args.near
    if args.category:
        params["categories"] = CATEGORIES[args.category]
    if args.kid_friendly:
        params["exclude_categories"] = EXCLUDE_KID_HOSTILE

    headers = {"Authorization": key, "accept": "application/json"}
    resp = http_json(f"{BASE}?{_u.urlencode(params)}", headers=headers)
    if not resp or "results" not in resp:
        print_json([])
        return 0
    print_json([normalize(r) for r in resp["results"]])
    return 0


if __name__ == "__main__":
    sys.exit(main())
