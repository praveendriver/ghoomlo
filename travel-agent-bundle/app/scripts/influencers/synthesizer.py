#!/usr/bin/env python3
"""Synthesize influencer corpus + TripAdvisor → per-destination Curator's Picks JSON.

For each destination present in trips/_shared/data/influencer-content.json:
  1. Aggregate places_mentioned across all creators (count, sentiment, who).
  2. For each top place, hit TripAdvisor (location-filtered) for rating + ranking.
  3. Bucket places into Must-Do / Must-Eat / Must-Buy / Unique-Experience using
     simple keyword categorization on the place name + nearby words.
  4. Write trips/_shared/data/synthesis-{destination_slug}.json

Run modes:
  synthesizer.py --all                  rebuild every destination present in corpus
  synthesizer.py --destination Tokyo    just one
  synthesizer.py --destination Tokyo --no-tripadvisor   skip TA enrichment

Output schema is documented in trips/_shared/data/synthesis-tokyo.json.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS_FILE = ROOT / "trips" / "_shared" / "data" / "influencer-content.json"
GAZETTEER_FILE = Path(__file__).resolve().parent / "gazetteer.json"
TRIPADVISOR_SCRIPT = ROOT / "scripts" / "api" / "tripadvisor.py"
OUT_DIR = ROOT / "trips" / "_shared" / "data"


# Category buckets. Each bucket has match patterns (case-insensitive substrings)
# applied against the place name. Order matters — first match wins.
# Per-destination seed lists when the corpus is thin. These are well-known POIs
# for which we'll always try to fetch a TripAdvisor rating, even if no creator
# in the corpus mentioned them. Prevents empty Curator's Picks blocks.
SEED_POIS: dict[str, list[str]] = {
    "Tokyo": [
        "Senso-ji", "teamLab Planets TOKYO", "Shibuya Crossing", "Shibuya Sky",
        "Meiji Jingu", "Tokyo Skytree", "Tsukiji Outer Market", "Ueno Park",
        "Akihabara Electric Town", "Harajuku Takeshita Street", "Ghibli Museum",
        "Imperial Palace East Garden", "Roppongi Hills", "Tokyo Tower",
        "Ramen Street Tokyo Station",
    ],
    "Kyoto": [
        "Fushimi Inari Taisha", "Kinkaku-ji", "Arashiyama Bamboo Grove",
        "Kiyomizu-dera", "Gion", "Nishiki Market", "Tenryu-ji Temple",
        "Ginkaku-ji", "Philosopher's Path", "Yasaka Shrine", "Pontocho Alley",
        "Higashiyama District",
    ],
    "Hakone": [
        "Hakone Open-Air Museum", "Owakudani", "Lake Ashi", "Hakone Shrine",
        "Mount Fuji viewpoint", "Hakone Ropeway", "Pola Museum of Art",
    ],
    "Osaka": [
        "Osaka Castle", "Dotonbori", "Universal Studios Japan",
        "Kuromon Ichiba Market", "Umeda Sky Building",
    ],
    "Madurai": ["Meenakshi Amman Temple", "Thirumalai Nayakkar Mahal", "Gandhi Memorial Museum"],
    "Rameswaram": ["Ramanathaswamy Temple", "Pamban Bridge", "Dhanushkodi Beach"],
    "Dwarka": ["Dwarakadhish Temple", "Bet Dwarka", "Nageshwar Jyotirlinga"],
    "Bali": [
        "Tegallalang Rice Terraces", "Tanah Lot", "Uluwatu Temple",
        "Sacred Monkey Forest Sanctuary", "Mount Batur sunrise hike",
        "Tirta Empul", "Ubud Art Market",
    ],
    "Bangkok": [
        "Grand Palace", "Wat Pho", "Wat Arun", "Chatuchak Weekend Market",
        "Asiatique The Riverfront",
    ],
    "Singapore": [
        "Gardens by the Bay", "Marina Bay Sands SkyPark", "Sentosa",
        "Universal Studios Singapore", "Hawker Chan",
    ],
    "Bhutan": ["Tiger's Nest Monastery", "Punakha Dzong", "Paro Dzong", "Buddha Dordenma"],
    "Dubai": [
        "Burj Khalifa", "Dubai Mall", "The Dubai Fountain", "Palm Jumeirah",
        "Dubai Marina", "Souk Madinat Jumeirah",
    ],
    "Paris": ["Eiffel Tower", "Louvre Museum", "Notre-Dame", "Montmartre", "Versailles"],
    "Rome": ["Colosseum", "Vatican Museums", "Trevi Fountain", "Pantheon", "Trastevere"],
    "Barcelona": ["Sagrada Familia", "Park Güell", "La Rambla", "Gothic Quarter", "Casa Batlló"],
    "Lisbon": ["Belém Tower", "Jerónimos Monastery", "Alfama", "Sintra", "LX Factory"],
    "Istanbul": ["Hagia Sophia", "Blue Mosque", "Topkapi Palace", "Grand Bazaar", "Bosphorus Cruise"],
    "London": ["Tower of London", "British Museum", "Buckingham Palace", "Borough Market", "London Eye"],
    "New York": ["Central Park", "Times Square", "Statue of Liberty", "Metropolitan Museum of Art", "Brooklyn Bridge"],
}


CATEGORY_RULES = [
    ("must_eat", [
        "ramen", "sushi", "izakaya", "udon", "soba", "yakitori", "tempura",
        "kaiseki", "café", "cafe", "coffee", "bakery", "patisserie",
        "restaurant", "diner", "bistro", "thali", "dosa", "biryani",
        "kebab", "tantan", "ain soph", "ichiran", "nataraj", "erick south",
        "ts tantan", "t's tantan", "nishiki market",  # food markets count as eat
    ]),
    ("must_buy", [
        "market", "bazaar", "department store", "flea market", "shopping street",
        "outlet", "mall", "souk", "ginza", "harajuku", "akihabara", "tsukiji outer",
    ]),
    ("unique_experience", [
        "go kart", "go-kart", "gokart", "onsen", "tea ceremony", "kabuki", "sumo",
        "themed café", "themed cafe", "ryokan", "robot restaurant", "teamlab",
        "skytree", "tokyo tower", "shibuya sky", "tower", "observation",
        "cooking class", "kimono", "samurai", "ninja", "ghibli", "trampoline",
        "trek", "rafting", "kayak", "snorkel", "cruise", "boat", "ride",
    ]),
    ("must_do", [
        # catch-all for landmarks, shrines, temples, parks, museums
        "shrine", "temple", "ji", "dera", "taisha", "jinja", "park", "garden",
        "palace", "castle", "fort", "museum", "gallery", "viewpoint", "lookout",
        "bridge", "lake", "falls", "valley", "beach", "ghat", "monastery",
        "stupa", "mosque", "cathedral", "church", "basilica", "pavilion", "hall",
    ]),
]


def slug(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def categorize(name: str) -> str:
    n = name.lower()
    for bucket, patterns in CATEGORY_RULES:
        for pat in patterns:
            if pat in n:
                return bucket
    # Default: must-do (when categorization fails, attractions are the safest bucket)
    return "must_do"


def load_gazetteer():
    try:
        data = json.loads(GAZETTEER_FILE.read_text())
        return {k: v for k, v in data.items() if not k.startswith("_")}
    except Exception:
        return {}


def fetch_tripadvisor(query: str, ttype: str, lat: float, lon: float, country: str) -> dict | None:
    """Shell out to tripadvisor.py with location filter. Returns top match or None."""
    if not TRIPADVISOR_SCRIPT.exists():
        return None
    cmd = [
        "python3", str(TRIPADVISOR_SCRIPT),
        "--query", query,
        "--type", ttype,
        "--lat", str(lat),
        "--lon", str(lon),
        "--require-country", country,
        "--limit", "3",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
        if not proc.stdout.strip():
            return None
        arr = json.loads(proc.stdout)
        if isinstance(arr, list) and arr:
            return arr[0]
    except Exception as e:
        sys.stderr.write(f"[synth] tripadvisor failed for {query}: {e}\n")
    return None


def bucket_type(bucket: str) -> str:
    """Map our bucket → TripAdvisor `type` parameter."""
    return {"must_eat": "restaurant", "must_buy": "attraction",
            "unique_experience": "attraction", "must_do": "attraction"}.get(bucket, "attraction")


def synthesize(destination: str, payload: dict, gaz: dict, do_tripadvisor: bool) -> dict:
    entry = gaz.get(destination)
    if not entry:
        sys.stderr.write(f"[synth] destination {destination} not in gazetteer; skipping\n")
        return {}
    items = payload.get("items", [])
    # Filter to items mentioning this destination.
    relevant = [
        it for it in items
        if any((d.get("name") == destination) for d in (it.get("destinations") or []))
    ]
    if not relevant:
        sys.stderr.write(f"[synth] {destination}: no corpus items, using seed POIs only\n")

    # Aggregate places.
    place_index: dict[str, dict] = {}
    creators: set[str] = set()
    for it in relevant:
        creators.add(it.get("creator") or "")
        for p in it.get("places_mentioned", []):
            name = (p.get("name") or "").strip()
            if not name or len(name) < 3:
                continue
            key = name.lower()
            e = place_index.setdefault(key, {
                "name": name,
                "mentions": 0,
                "positive": 0,
                "negative": 0,
                "creators": set(),
                "first_quote": None,
                "first_url": None,
                "first_creator": None,
                "first_source": None,
                "city": p.get("city") or destination,
                "_seed": False,
            })
            e["mentions"] += 1
            if p.get("sentiment") == "positive":
                e["positive"] += 1
            elif p.get("sentiment") == "negative":
                e["negative"] += 1
            if it.get("creator"):
                e["creators"].add(it["creator"])
            if not e["first_quote"] and p.get("quote"):
                e["first_quote"] = p["quote"]
                e["first_url"] = it.get("url")
                e["first_creator"] = it.get("creator")
                e["first_source"] = it.get("source")

    # Add seed POIs for this destination so Curator's Picks always has
    # something even when corpus is thin. Seed entries survive only if
    # TripAdvisor returns a real rating below.
    for seed_name in SEED_POIS.get(destination, []):
        seed_key = seed_name.lower()
        if seed_key in place_index:
            continue
        place_index[seed_key] = {
            "name": seed_name,
            "mentions": 0,
            "positive": 0,
            "negative": 0,
            "creators": set(),
            "first_quote": None,
            "first_url": None,
            "first_creator": None,
            "first_source": None,
            "city": destination,
            "_seed": True,
        }

    # Score each place: creator-count is the dominant signal because two
    # creators independently calling out the same spot is real signal.
    def place_score(e: dict) -> float:
        return len(e["creators"]) * 2 + e["positive"] - e["negative"] + min(e["mentions"], 4) * 0.25

    # Sort: corpus-derived first by score, then seed POIs (which all score 0).
    # Cap candidates at 24 so we don't blow TA quota on long seed lists.
    places = sorted(
        place_index.values(),
        key=lambda e: (0 if e.get("_seed") else 1, place_score(e)),
        reverse=True,
    )
    candidates = places[:24]

    # Bucketize, optionally enrich with TripAdvisor.
    buckets: dict[str, list[dict]] = {"must_do": [], "must_eat": [], "must_buy": [], "unique_experience": []}
    for e in candidates:
        bucket = categorize(e["name"])
        is_seed = bool(e.get("_seed"))
        out = {
            "name": e["name"],
            "score": round(place_score(e), 2),
            "creators": sorted(e["creators"]),
            "creator_count": len(e["creators"]),
            "mentions": e["mentions"],
            "positive": e["positive"],
            "negative": e["negative"],
            "city": e["city"],
            "quote": e["first_quote"],
            "quote_creator": e["first_creator"],
            "quote_source": e["first_source"],
            "quote_url": e["first_url"],
            "category": bucket,
            "tripadvisor": None,
            "is_seed": is_seed,
        }
        if do_tripadvisor:
            ta = fetch_tripadvisor(
                query=e["name"],
                ttype=bucket_type(bucket),
                lat=entry["lat"],
                lon=entry["lon"],
                country=entry["country"],
            )
            if ta and ta.get("rating"):
                out["tripadvisor"] = {
                    "rating": ta.get("rating"),
                    "review_count": ta.get("review_count"),
                    "ranking": ta.get("ranking"),
                    "url": ta.get("url"),
                    "city": ta.get("city"),
                }
        # GUARDRAIL:
        # - Corpus-derived entries: keep if ≥1 creator AND (TA signal OR ≥2 mentions).
        #   Filters out single-mention noise like "Police Station".
        # - Seed POIs: keep ONLY if TA returned a real rating. No TA = drop.
        if is_seed:
            if out["tripadvisor"]:
                buckets[bucket].append(out)
        else:
            if out["creator_count"] >= 1 and (out["tripadvisor"] or out["mentions"] >= 2):
                buckets[bucket].append(out)

    # Cap per-bucket and sort each: corpus-backed first (creator signal),
    # then by TripAdvisor rating, then by score. Ensures genuine creator
    # picks always rank above blind seed POIs even when TA ratings are similar.
    def sort_key(x: dict):
        ta = x.get("tripadvisor") or {}
        return (
            0 if x.get("is_seed") else 1,
            ta.get("rating") or 0,
            x["score"],
        )
    for k in buckets:
        buckets[k].sort(key=sort_key, reverse=True)
        buckets[k] = buckets[k][:6]

    return {
        "destination": destination,
        "country": entry["country"],
        "lat": entry["lat"],
        "lon": entry["lon"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "items_total": len(relevant),
        "creators_total": len([c for c in creators if c]),
        "buckets": buckets,
    }


def main():
    p = argparse.ArgumentParser(description="Synthesize influencer corpus → Curator's Picks")
    p.add_argument("--destination", help="One destination canonical name (e.g. Tokyo)")
    p.add_argument("--all", action="store_true", help="Rebuild every destination found in corpus")
    p.add_argument("--no-tripadvisor", action="store_true", help="Skip TA enrichment (faster)")
    args = p.parse_args()

    if not (args.destination or args.all):
        sys.stderr.write("specify --destination NAME or --all\n")
        sys.exit(1)

    if not CORPUS_FILE.exists():
        sys.stderr.write(f"corpus missing: {CORPUS_FILE}\n")
        sys.exit(1)
    payload = json.loads(CORPUS_FILE.read_text())
    gaz = load_gazetteer()

    targets = []
    if args.destination:
        targets = [args.destination]
    else:
        seen = set()
        for it in payload.get("items", []):
            for d in it.get("destinations") or []:
                name = d.get("name")
                if name and name not in seen:
                    seen.add(name)
                    targets.append(name)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for dest in targets:
        sys.stderr.write(f"[synth] building {dest}\n")
        out = synthesize(dest, payload, gaz, do_tripadvisor=not args.no_tripadvisor)
        if not out:
            continue
        out_path = OUT_DIR / f"synthesis-{slug(dest)}.json"
        out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2))
        # Concise summary.
        bk = out.get("buckets", {})
        sys.stderr.write(
            f"[synth] {dest}: {sum(len(v) for v in bk.values())} picks "
            f"(must_do={len(bk.get('must_do', []))}, must_eat={len(bk.get('must_eat', []))}, "
            f"must_buy={len(bk.get('must_buy', []))}, unique={len(bk.get('unique_experience', []))})\n"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
