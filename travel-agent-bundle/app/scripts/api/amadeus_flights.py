#!/usr/bin/env python3
"""Amadeus Self-Service flight-offers search → normalized JSON on stdout.

Usage:
  amadeus_flights.py --origin BLR --dest NRT --depart 2026-12-15 \
                     --return 2026-12-22 --adults 2 --children 2 --currency INR
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, http_json, load_secrets, post_form, print_json, require  # noqa: E402

BASE = "https://test.api.amadeus.com"
TOKEN_CACHE = Path("/tmp/amadeus_token.json")


def get_token(client_id, client_secret):
    if TOKEN_CACHE.exists():
        try:
            cached = json.loads(TOKEN_CACHE.read_text())
            if cached.get("expires_at", 0) > time.time() + 30:
                return cached["access_token"]
        except Exception:
            pass
    resp = post_form(
        f"{BASE}/v1/security/oauth2/token",
        {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        },
    )
    if not resp or "access_token" not in resp:
        return None
    resp["expires_at"] = time.time() + int(resp.get("expires_in", 1700))
    try:
        TOKEN_CACHE.write_text(json.dumps(resp))
    except Exception:
        pass
    return resp["access_token"]


def normalize(offer):
    itineraries = offer.get("itineraries", [])

    def leg_summary(itin):
        segs = itin.get("segments", [])
        if not segs:
            return None
        return {
            "depart_iso": segs[0].get("departure", {}).get("at"),
            "arrive_iso": segs[-1].get("arrival", {}).get("at"),
            "carrier": segs[0].get("carrierCode"),
            "stops": max(0, len(segs) - 1),
            "segments": [
                f"{s['departure']['iataCode']}→{s['arrival']['iataCode']} {s.get('carrierCode', '')}{s.get('number', '')}"
                for s in segs
            ],
        }

    price = offer.get("price", {})
    return {
        "price_total": price.get("grandTotal") or price.get("total"),
        "currency": price.get("currency"),
        "outbound": leg_summary(itineraries[0]) if itineraries else None,
        "return": leg_summary(itineraries[1]) if len(itineraries) > 1 else None,
        "seats_remaining": offer.get("numberOfBookableSeats"),
        "validating_airlines": offer.get("validatingAirlineCodes", []),
    }


def main():
    p = argparse.ArgumentParser(description="Amadeus flight-offers search")
    p.add_argument("--origin", required=True, help="IATA code, e.g. BLR")
    p.add_argument("--dest", required=True, help="IATA code, e.g. NRT")
    p.add_argument("--depart", required=True, help="YYYY-MM-DD outbound date")
    p.add_argument("--return", dest="ret", help="YYYY-MM-DD return date (omit for one-way)")
    p.add_argument("--adults", type=int, default=2)
    p.add_argument("--children", type=int, default=0)
    p.add_argument("--currency", default="INR")
    p.add_argument("--max", type=int, default=5, help="how many offers to return")
    p.add_argument("--cabin", choices=["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"])
    args = p.parse_args()

    secrets = load_secrets()
    cid, csec = require(secrets, "AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET")

    token = get_token(cid, csec)
    if not token:
        eprint("failed to obtain Amadeus access token")
        return 1

    params = {
        "originLocationCode": args.origin,
        "destinationLocationCode": args.dest,
        "departureDate": args.depart,
        "adults": args.adults,
        "currencyCode": args.currency,
        "max": args.max,
    }
    if args.ret:
        params["returnDate"] = args.ret
    if args.children:
        params["children"] = args.children
    if args.cabin:
        params["travelClass"] = args.cabin

    import urllib.parse as _u
    url = f"{BASE}/v2/shopping/flight-offers?{_u.urlencode(params)}"
    resp = http_json(url, headers={"Authorization": f"Bearer {token}"})
    if not resp or "data" not in resp:
        eprint("no flight offers returned")
        print_json([])
        return 0

    print_json([normalize(o) for o in resp["data"]])
    return 0


if __name__ == "__main__":
    sys.exit(main())
