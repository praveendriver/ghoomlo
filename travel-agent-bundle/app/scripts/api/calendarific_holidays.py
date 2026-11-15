#!/usr/bin/env python3
"""Calendarific holidays → normalized JSON on stdout.

Usage:
  calendarific_holidays.py --country IN --year 2026 --location KA
"""
from __future__ import annotations

import argparse
import sys
import urllib.parse as _u
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, http_json, load_secrets, print_json, require  # noqa: E402

BASE = "https://calendarific.com/api/v2/holidays"


def normalize(h):
    date = (h.get("date", {}) or {}).get("iso")
    types = h.get("type") or []
    states = (h.get("states") if isinstance(h.get("states"), list) else None) or []
    return {
        "date": date,
        "name": h.get("name"),
        "type": types[0] if types else None,
        "scope": "national" if not states else ",".join(s.get("abbrev", "") for s in states),
        "description": h.get("description", "")[:200],
    }


def main():
    p = argparse.ArgumentParser(description="Calendarific public holidays")
    p.add_argument("--country", default="IN", help="ISO country code")
    p.add_argument("--year", type=int, required=True)
    p.add_argument("--location", help="ISO subdivision (e.g. KA for Karnataka)")
    p.add_argument("--month", type=int, help="filter to a single month")
    args = p.parse_args()

    secrets = load_secrets()
    (key,) = require(secrets, "CALENDARIFIC_KEY")

    params = {
        "api_key": key,
        "country": args.country,
        "year": args.year,
    }
    if args.location:
        params["location"] = f"{args.country}-{args.location}"
    if args.month:
        params["month"] = args.month

    resp = http_json(f"{BASE}?{_u.urlencode(params)}")
    if not resp:
        print_json([])
        return 0
    holidays = ((resp.get("response") or {}).get("holidays")) or []
    print_json([normalize(h) for h in holidays])
    return 0


if __name__ == "__main__":
    sys.exit(main())
