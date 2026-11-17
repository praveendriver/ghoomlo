"""Builds web/data/climate.json: typical daytime high, night low and monthly
rainfall for each origin city and destination, from NASA POWER's monthly
climatology (MERRA-2 based, averages over 2001-2025).

High and low are estimated as the monthly mean temperature plus or minus half
the average daily temperature range. Rainfall is the average daily amount
times the days in the month. Each place is one representative point (a city);
see PLACES. Run: python3 -I build_climate.py
"""
import json, pathlib, time, urllib.parse
from collections import defaultdict
import requests

PLACES = {
    # origins
    "Bengaluru": (12.97, 77.59, "Bengaluru"), "Mumbai": (19.08, 72.88, "Mumbai"),
    "Delhi NCR": (28.61, 77.21, "New Delhi"), "Hyderabad": (17.39, 78.49, "Hyderabad"),
    "Chennai": (13.08, 80.27, "Chennai"), "Pune": (18.52, 73.86, "Pune"), "Kolkata": (22.57, 88.36, "Kolkata"),
    # destinations
    "Goa": (15.49, 73.83, "Panaji"), "Kerala": (9.93, 76.27, "Kochi"), "Jaipur": (26.91, 75.79, "Jaipur"),
    "Udaipur": (24.58, 73.71, "Udaipur"), "Kashmir": (34.08, 74.80, "Srinagar"), "Ladakh": (34.16, 77.58, "Leh"),
    "Manali": (32.24, 77.19, "Manali"), "Andamans": (11.62, 92.73, "Port Blair"), "Agra": (27.18, 78.01, "Agra"),
    "Varanasi": (25.32, 82.97, "Varanasi"), "Dubai": (25.20, 55.27, "Dubai"), "Singapore": (1.35, 103.82, "Singapore"),
    "Thailand": (7.88, 98.39, "Phuket"), "Bali": (-8.65, 115.22, "Denpasar"), "Maldives": (4.17, 73.51, "Malé"),
    "Vietnam": (16.05, 108.20, "Da Nang"),
}

DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

def monthly(lat, lon):
    q = dict(parameters="T2M,T2M_RANGE,PRECTOTCORR", community="RE", latitude=lat, longitude=lon, format="JSON")
    r = requests.get("https://power.larc.nasa.gov/api/temporal/climatology/point?" + urllib.parse.urlencode(q), timeout=90)
    r.raise_for_status()
    p = r.json()["properties"]["parameter"]
    out = []
    for i, m in enumerate(MONTHS):
        mean, rng, rain = p["T2M"][m], p["T2M_RANGE"][m], p["PRECTOTCORR"][m]
        out.append({"high": round(mean + rng / 2, 1), "low": round(mean - rng / 2, 1), "rainMm": round(rain * DAYS[i])})
    return out

out = {"about": "Typical monthly weather per place, averaged over 2001-2025: daytime high and night low in °C (mean temperature "
                "plus or minus half the average daily range) and total rainfall in mm. Each place is one representative point "
                "(see 'point'), and mountain or coastal places can vary a lot within a region. Averages, not forecasts.",
       "source": {"name": "NASA POWER monthly climatology (MERRA-2)", "url": "https://power.larc.nasa.gov/", "license": "Free to use; credit NASA POWER"},
       "places": {}}
for name, (lat, lon, point) in PLACES.items():
    out["places"][name] = {"point": point, "lat": lat, "lon": lon, "months": monthly(lat, lon)}
    print(name, out["places"][name]["months"][0], out["places"][name]["months"][11])
    time.sleep(1)
path = pathlib.Path(__file__).resolve().parents[2] / "web/data/climate.json"
path.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
print("wrote", path)
