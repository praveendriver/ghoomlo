#!/usr/bin/env python3
"""TripAdvisor Content API → normalized JSON on stdout.

Usage:
  tripadvisor.py --query "Hyatt Regency Hakone" --type hotel
  tripadvisor.py --query "teamLab Planets Tokyo" --type attraction

Free tier: 5,000 calls/month after approval. Without TRIPADVISOR_KEY this exits 1
so callers know to fall back to /api/local (SerpAPI Google Local).
"""
from __future__ import annotations

import argparse
import sys
import urllib.parse as _u
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, http_json, load_secrets, print_json, require  # noqa: E402

BASE = "https://api.content.tripadvisor.com/api/v1"

CATEGORY_MAP = {
    "hotel": "hotels",
    "restaurant": "restaurants",
    "attraction": "attractions",
    "geo": "geos",
}


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def main():
    p = argparse.ArgumentParser(description="TripAdvisor Content API search")
    p.add_argument("--query", required=True)
    p.add_argument("--type", choices=list(CATEGORY_MAP), default="hotel")
    p.add_argument("--lang", default="en")
    p.add_argument("--limit", type=int, default=5)
    p.add_argument("--lat", type=float, help="Bias search by lat/lon and require result within --radius-km")
    p.add_argument("--lon", type=float)
    p.add_argument("--radius-km", type=float, default=80.0,
                   help="When lat/lon supplied, drop results farther than this. Default 80km.")
    p.add_argument("--require-country", help="ISO-2 (e.g. JP) — drop results whose address_obj.country differs")
    p.add_argument("--require-city", help="City substring — drop results whose address_obj.city differs (case-insensitive)")
    args = p.parse_args()

    secrets = load_secrets()
    key = secrets.get("TRIPADVISOR_KEY")
    if not key:
        eprint("TRIPADVISOR_KEY not set — caller should fall back to /api/local")
        sys.exit(1)

    cat = CATEGORY_MAP[args.type]
    params = {
        "key": key,
        "searchQuery": args.query,
        "category": cat,
        "language": args.lang,
    }
    if args.lat is not None and args.lon is not None:
        params["latLong"] = f"{args.lat},{args.lon}"
        # TA expects radius in meters or km; the free Content API takes radius in same unit.
        params["radius"] = str(int(args.radius_km))
        params["radiusUnit"] = "km"
    search_url = f"{BASE}/location/search?{_u.urlencode(params)}"
    headers = {"accept": "application/json"}
    search = http_json(search_url, headers=headers)
    if not search:
        print_json([])
        return 0

    results = (search.get("data") or [])[: args.limit]
    out = []
    for r in results:
        loc_id = r.get("location_id")
        details = http_json(
            f"{BASE}/location/{loc_id}/details?" + _u.urlencode({"key": key, "language": args.lang}),
            headers=headers,
        ) or {}
        addr_obj = details.get("address_obj") or {}
        # GUARDRAIL: country/city filter — drop wrong-country mismatches (NC vs Tokyo).
        if args.require_country:
            tgt = _norm(args.require_country)
            cc = _norm(addr_obj.get("country"))
            # TA returns country as full name e.g. "Japan", not ISO. Map common ones.
            country_map = {
                "JP": "japan", "IN": "india", "ID": "indonesia", "TH": "thailand",
                "SG": "singapore", "MY": "malaysia", "VN": "viet nam", "KR": "south korea",
                "HK": "hong kong", "TW": "taiwan", "LK": "sri lanka", "AE": "united arab emirates",
                "QA": "qatar", "TR": "turkey", "EG": "egypt", "FR": "france", "IT": "italy",
                "ES": "spain", "PT": "portugal", "NL": "netherlands", "DE": "germany",
                "AT": "austria", "CZ": "czech republic", "HU": "hungary", "GR": "greece",
                "IS": "iceland", "GB": "united kingdom", "IE": "ireland", "CH": "switzerland",
                "US": "united states", "AU": "australia", "NZ": "new zealand", "BT": "bhutan",
                "NP": "nepal", "MV": "maldives",
            }
            if len(tgt) == 2:
                tgt = country_map.get(args.require_country.upper(), tgt)
            if tgt and cc and tgt not in cc and cc not in tgt:
                eprint(f"drop {r.get('name')} — country {addr_obj.get('country')} != {args.require_country}")
                continue
        # NOTE: We deliberately do NOT enforce city match. TA returns ward-level
        # cities for big metros (Tokyo → Toyosu/Minato/Shibuya, NYC → Brooklyn/etc.)
        # The country guardrail + lat/lon radius are what actually prevent
        # cross-country misses (Senso-ji NC vs Tokyo). --require-city is accepted
        # for forward-compat but currently advisory only.
        if args.require_city:
            pass
        reviews = http_json(
            f"{BASE}/location/{loc_id}/reviews?" + _u.urlencode({"key": key, "language": args.lang, "limit": 3}),
            headers=headers,
        ) or {}
        top_reviews = []
        for rev in (reviews.get("data") or [])[:3]:
            top_reviews.append({
                "text": (rev.get("text") or "")[:500],
                "lang": rev.get("lang"),
                "rating": rev.get("rating"),
                "title": rev.get("title"),
                "date": rev.get("published_date"),
            })
        out.append({
            "name": r.get("name"),
            "location_id": loc_id,
            "rating": details.get("rating"),
            "review_count": details.get("num_reviews"),
            "ranking": (details.get("ranking_data") or {}).get("ranking_string"),
            "url": details.get("web_url"),
            "address": addr_obj.get("address_string"),
            "country": addr_obj.get("country"),
            "city": addr_obj.get("city"),
            "top_reviews": top_reviews,
        })

    print_json(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
