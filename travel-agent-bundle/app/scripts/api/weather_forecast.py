#!/usr/bin/env python3
"""Open-Meteo weather forecast (no key) + optional OpenWeatherMap AQI.

Usage:
  weather_forecast.py --lat 35.68 --lon 139.69 --start 2026-12-15 --end 2026-12-22 [--aqi]
"""
from __future__ import annotations

import argparse
import sys
import urllib.parse as _u
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import http_json, load_secrets, print_json  # noqa: E402

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
OWM_AQI = "https://api.openweathermap.org/data/2.5/air_pollution/forecast"


def fetch_forecast(lat, lon, start, end):
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
        "timezone": "auto",
        "start_date": start,
        "end_date": end,
    }
    resp = http_json(f"{OPEN_METEO}?{_u.urlencode(params)}")
    if not resp or "daily" not in resp:
        return []
    d = resp["daily"]
    rows = []
    for i, date in enumerate(d.get("time", [])):
        rows.append({
            "date": date,
            "temp_max_c": d.get("temperature_2m_max", [None] * (i + 1))[i],
            "temp_min_c": d.get("temperature_2m_min", [None] * (i + 1))[i],
            "precip_mm": d.get("precipitation_sum", [None] * (i + 1))[i],
            "precip_prob": d.get("precipitation_probability_max", [None] * (i + 1))[i],
        })
    return rows


def fetch_aqi(lat, lon, key):
    params = {"lat": lat, "lon": lon, "appid": key}
    resp = http_json(f"{OWM_AQI}?{_u.urlencode(params)}")
    if not resp or "list" not in resp or not resp["list"]:
        return None
    aqis = [item.get("main", {}).get("aqi") for item in resp["list"] if item.get("main", {}).get("aqi")]
    if not aqis:
        return None
    return round(sum(aqis) / len(aqis), 1)


def main():
    p = argparse.ArgumentParser(description="Weather forecast for a window")
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--start", required=True, help="YYYY-MM-DD")
    p.add_argument("--end", required=True, help="YYYY-MM-DD")
    p.add_argument("--aqi", action="store_true", help="include OpenWeatherMap AQI")
    args = p.parse_args()

    out = {"daily": fetch_forecast(args.lat, args.lon, args.start, args.end)}
    if args.aqi:
        secrets = load_secrets()
        owm = secrets.get("OPENWEATHER_KEY")
        if owm:
            out["aqi_avg"] = fetch_aqi(args.lat, args.lon, owm)
        else:
            out["aqi_avg"] = None
            out["aqi_note"] = "OPENWEATHER_KEY not set"
    print_json(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
