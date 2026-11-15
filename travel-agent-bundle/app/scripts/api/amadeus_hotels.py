#!/usr/bin/env python3
"""Amadeus Hotel Search → normalized JSON on stdout.

Usage:
  amadeus_hotels.py --city TYO --checkin 2026-12-15 --checkout 2026-12-22 \
                    --adults 2 --children 2 --chain MC,HH --rating 5
"""
from __future__ import annotations

import argparse
import sys
import urllib.parse as _u
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, http_json, load_secrets, print_json, require  # noqa: E402
from amadeus_flights import BASE, get_token  # noqa: E402

# Amadeus chain code mapping. Add more as needed.
CHAIN_CODES = {
    "MC": "Marriott",
    "HH": "Hilton",
    "HY": "Hyatt",
    "IC": "InterContinental",
    "AC": "Accor",
}


def normalize_offer(hotel_entry):
    hotel = hotel_entry.get("hotel", {})
    offers = hotel_entry.get("offers", [])
    cheapest = min(offers, key=lambda o: float(o.get("price", {}).get("total", "inf"))) if offers else {}
    price = cheapest.get("price", {})
    return {
        "name": hotel.get("name"),
        "chain_code": hotel.get("chainCode"),
        "chain_name": CHAIN_CODES.get(hotel.get("chainCode", ""), hotel.get("chainCode")),
        "rating": hotel.get("rating"),
        "city": hotel.get("cityCode"),
        "lat": hotel.get("latitude"),
        "lon": hotel.get("longitude"),
        "total": price.get("total"),
        "currency": price.get("currency"),
        "checkin": cheapest.get("checkInDate"),
        "checkout": cheapest.get("checkOutDate"),
        "room_description": (cheapest.get("room", {}).get("description") or {}).get("text"),
        "offer_id": cheapest.get("id"),
    }


def main():
    p = argparse.ArgumentParser(description="Amadeus hotel offers search")
    p.add_argument("--city", required=True, help="IATA city code, e.g. TYO, PAR, NYC, BLR")
    p.add_argument("--checkin", required=True, help="YYYY-MM-DD")
    p.add_argument("--checkout", required=True, help="YYYY-MM-DD")
    p.add_argument("--adults", type=int, default=2)
    p.add_argument("--children", type=int, default=0)
    p.add_argument("--rooms", type=int, default=1)
    p.add_argument("--chain", help="comma-separated Amadeus chain codes, e.g. MC,HH")
    p.add_argument("--rating", help="comma-separated star ratings, e.g. 4,5")
    p.add_argument("--currency", default="INR")
    p.add_argument("--max", type=int, default=5)
    args = p.parse_args()

    secrets = load_secrets()
    cid, csec = require(secrets, "AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET")
    token = get_token(cid, csec)
    if not token:
        eprint("failed to obtain Amadeus access token")
        return 1

    headers = {"Authorization": f"Bearer {token}"}

    list_params = {"cityCode": args.city}
    if args.chain:
        list_params["chainCodes"] = args.chain
    if args.rating:
        list_params["ratings"] = args.rating
    list_url = f"{BASE}/v1/reference-data/locations/hotels/by-city?{_u.urlencode(list_params)}"
    listing = http_json(list_url, headers=headers)
    if not listing or "data" not in listing or not listing["data"]:
        eprint(f"no hotels found in city {args.city} matching filters")
        print_json([])
        return 0

    hotel_ids = [h["hotelId"] for h in listing["data"][: max(20, args.max * 4)]]

    offer_params = {
        "hotelIds": ",".join(hotel_ids),
        "checkInDate": args.checkin,
        "checkOutDate": args.checkout,
        "adults": args.adults,
        "roomQuantity": args.rooms,
        "currency": args.currency,
        "bestRateOnly": "true",
    }
    offer_url = f"{BASE}/v3/shopping/hotel-offers?{_u.urlencode(offer_params)}"
    offers = http_json(offer_url, headers=headers)
    if not offers or "data" not in offers:
        eprint("no offers returned for those hotels/dates")
        print_json([])
        return 0

    rows = [normalize_offer(e) for e in offers["data"] if e.get("offers")]
    rows.sort(key=lambda r: float(r.get("total") or "inf"))
    print_json(rows[: args.max])
    return 0


if __name__ == "__main__":
    sys.exit(main())
