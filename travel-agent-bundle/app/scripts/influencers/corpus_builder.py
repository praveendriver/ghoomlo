#!/usr/bin/env python3
"""Influencer-content corpus orchestrator.

Reads `.workspace/influencers.yaml`, fans out to youtube_discover, youtube_transcript,
blog_feed, instagram_creator, and writes a unified corpus to
`trips/_shared/data/influencer-content.json`.

Modes:
  --full                     refresh everything in the watchlist
  --for-destination Tokyo    refresh, but only retain items mentioning the destination
  --max-per-source N         cap items per creator (default 8)
  --no-translate             skip translate step (faster smoke runs)

Skills + the browser DO NOT call this — only the cron does. Skills load the
generated JSON.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts" / "api"
WATCHLIST = ROOT / ".workspace" / "influencers.yaml"
OUTFILE = ROOT / "trips" / "_shared" / "data" / "influencer-content.json"
SECRETS = ROOT / ".workspace" / "secrets.local.md"


# Destination gazetteer — loaded from scripts/influencers/gazetteer.json so it can
# be edited without touching code. Each entry: canonical name → {country, lat, lon, aliases[]}.
GAZETTEER_FILE = Path(__file__).resolve().parent / "gazetteer.json"


def load_gazetteer() -> dict:
    if not GAZETTEER_FILE.exists():
        sys.stderr.write(f"[corpus] gazetteer file missing: {GAZETTEER_FILE}\n")
        return {}
    try:
        data = json.loads(GAZETTEER_FILE.read_text())
    except json.JSONDecodeError as e:
        sys.stderr.write(f"[corpus] gazetteer.json parse error: {e}\n")
        return {}
    # Drop comment-style keys (anything starting with "_").
    return {k: v for k, v in data.items() if not k.startswith("_")}


GAZETTEER = load_gazetteer()

POSITIVE_LEXICON = {
    "amazing", "best", "loved", "incredible", "stunning", "must", "favorite", "favourite",
    "highly recommend", "perfect", "delicious", "magical", "kids loved", "worth it",
    "impressive", "wonderful", "fantastic", "gorgeous", "phenomenal", "unforgettable",
}
NEGATIVE_LEXICON = {
    "skip", "avoid", "overrated", "tourist trap", "disappointed", "waste", "rude",
    "filthy", "scam", "not worth", "stay away", "boring", "regret", "underwhelming",
}
VEG_SIGNALS = {
    "vegetarian", "vegan", "veg only", "pure veg", "no meat", "plant-based",
    "shojin ryori", "satvik", "jain", "thali", "dosa", "paneer",
}

# Heuristic place-pattern: trigger verb followed by a properly-Title-Cased
# multi-word place name. NOT case-insensitive — we need real capitalization
# so we don't capture verb fragments like "Loved getting" or "Tried catching it".
PLACE_RE = re.compile(
    r"\b(?:stayed at|visited|loved|tried|ate at|went to|recommend|stayed in|checked into|"
    r"booked|arrived at|toured|explored|hit up|went into)\s+"
    r"((?:the\s+)?[A-Z][\w'’\-]+(?:\s+(?:of|at|de|du|del|la|le|les)\s+)?(?:\s+[A-Z][\w'’\-]+){1,5})")

# Words that almost always indicate the regex caught a verb-phrase instead of a place
PLACE_STOPWORDS = {
    "It", "There", "Some", "Any", "This", "That", "These", "Those", "Getting",
    "Catching", "Trying", "Going", "Eating", "Staying", "I", "We", "My",
    "Negotiate", "Probably", "About", "Anybody", "Today", "Tomorrow",
}

# POI gazetteer — real, well-known places we should detect via direct word-match.
# Map alias → canonical name. Stricter than the regex (which produces false positives).
POI_GAZETTEER = {
    # Tokyo
    "Shibuya Crossing": "Shibuya Crossing", "Shibuya Sky": "Shibuya Sky",
    "Shibuya": "Shibuya", "Shinjuku": "Shinjuku", "Asakusa": "Asakusa",
    "Senso-ji": "Senso-ji", "Sensoji": "Senso-ji", "Akihabara": "Akihabara",
    "Harajuku": "Harajuku", "Ginza": "Ginza", "Tsukiji": "Tsukiji",
    "Tsukiji Outer Market": "Tsukiji Outer Market",
    "Tokyo Tower": "Tokyo Tower", "Tokyo Skytree": "Tokyo Skytree", "Skytree": "Tokyo Skytree",
    "teamLab": "teamLab Planets", "teamLab Planets": "teamLab Planets",
    "teamLab Borderless": "teamLab Borderless",
    "Ueno Park": "Ueno Park", "Ueno": "Ueno", "Roppongi": "Roppongi", "Odaiba": "Odaiba",
    "Ghibli Museum": "Ghibli Museum", "Ghibli": "Ghibli Museum",
    "Imperial Palace": "Imperial Palace", "Meiji Shrine": "Meiji Shrine",
    "Yoyogi Park": "Yoyogi Park", "Akasaka": "Akasaka",
    # Kyoto
    "Fushimi Inari": "Fushimi Inari Taisha", "Fushimi Inari Taisha": "Fushimi Inari Taisha",
    "Kinkaku-ji": "Kinkaku-ji", "Kinkakuji": "Kinkaku-ji", "Golden Pavilion": "Kinkaku-ji",
    "Arashiyama": "Arashiyama", "Bamboo Forest": "Arashiyama Bamboo Grove",
    "Bamboo Grove": "Arashiyama Bamboo Grove",
    "Gion": "Gion", "Higashiyama": "Higashiyama", "Pontocho": "Pontocho",
    "Kiyomizu-dera": "Kiyomizu-dera", "Kiyomizu": "Kiyomizu-dera",
    "Nishiki Market": "Nishiki Market", "Ryoan-ji": "Ryoan-ji",
    "Tenryu-ji": "Tenryu-ji", "Ginkaku-ji": "Ginkaku-ji", "Silver Pavilion": "Ginkaku-ji",
    "Philosopher's Path": "Philosopher's Path", "Yasaka Shrine": "Yasaka Shrine",
    # Hakone / Mt Fuji
    "Owakudani": "Owakudani", "Lake Ashi": "Lake Ashi", "Hakone Open-Air": "Hakone Open-Air Museum",
    "Hakone Open Air Museum": "Hakone Open-Air Museum",
    "Mt. Fuji": "Mt. Fuji", "Mount Fuji": "Mt. Fuji", "Fuji-san": "Mt. Fuji",
    "Hakone Free Pass": "Hakone Free Pass",
    # Osaka / Kansai
    "Osaka Castle": "Osaka Castle", "Dotonbori": "Dotonbori", "Universal Studios Japan": "USJ",
    # Restaurants / chains commonly mentioned
    "Ichiran": "Ichiran Ramen", "T's Tantan": "T's Tantan", "Erick South": "Erick South",
    "Ain Soph": "Ain Soph", "Nataraj": "Nataraj Ginza",
    # Other
    "Kamakura": "Kamakura", "Yokohama": "Yokohama", "Nara": "Nara Park",
    "Shinkansen": "Shinkansen",
}

# Canonical-name → (lat, lon) for the POIs above plus a few common mentions in
# India trips. Only places present here will get pins on the creator-section
# map; everything else is still surfaced as a quote without a marker.
POI_COORDS = {
    # Tokyo
    "Shibuya Crossing": (35.6595, 139.7005), "Shibuya Sky": (35.6586, 139.7016),
    "Shibuya": (35.6580, 139.7016), "Shinjuku": (35.6938, 139.7036),
    "Asakusa": (35.7148, 139.7967), "Senso-ji": (35.7148, 139.7967),
    "Akihabara": (35.7022, 139.7745), "Harajuku": (35.6702, 139.7027),
    "Ginza": (35.6717, 139.7649), "Tsukiji": (35.6655, 139.7707),
    "Tsukiji Outer Market": (35.6655, 139.7707),
    "Tokyo Tower": (35.6586, 139.7454), "Tokyo Skytree": (35.7101, 139.8107),
    "teamLab Planets": (35.6500, 139.7906), "teamLab Borderless": (35.6266, 139.7790),
    "Ueno Park": (35.7156, 139.7745), "Ueno": (35.7138, 139.7770),
    "Roppongi": (35.6627, 139.7314), "Odaiba": (35.6262, 139.7756),
    "Ghibli Museum": (35.6963, 139.5704), "Imperial Palace": (35.6852, 139.7528),
    "Meiji Shrine": (35.6764, 139.6993), "Yoyogi Park": (35.6720, 139.6951),
    "Akasaka": (35.6736, 139.7378),
    # Kyoto
    "Fushimi Inari Taisha": (34.9671, 135.7727), "Kinkaku-ji": (35.0394, 135.7292),
    "Arashiyama": (35.0094, 135.6661), "Arashiyama Bamboo Grove": (35.0170, 135.6716),
    "Gion": (35.0036, 135.7780), "Higashiyama": (35.0036, 135.7799),
    "Pontocho": (35.0072, 135.7707), "Kiyomizu-dera": (34.9949, 135.7851),
    "Nishiki Market": (35.0050, 135.7649), "Ryoan-ji": (35.0344, 135.7183),
    "Tenryu-ji": (35.0156, 135.6734), "Ginkaku-ji": (35.0270, 135.7983),
    "Philosopher's Path": (35.0246, 135.7948), "Yasaka Shrine": (35.0036, 135.7785),
    # Hakone / Mt Fuji
    "Owakudani": (35.2434, 139.0193), "Lake Ashi": (35.2089, 139.0199),
    "Hakone Open-Air Museum": (35.2447, 139.0497), "Mt. Fuji": (35.3606, 138.7274),
    # Osaka / Kansai
    "Osaka Castle": (34.6873, 135.5259), "Dotonbori": (34.6687, 135.5012),
    "USJ": (34.6654, 135.4323),
    # Restaurants
    "Ichiran Ramen": (35.6595, 139.7005), "T's Tantan": (35.6812, 139.7671),
    "Erick South": (35.6717, 139.7649), "Ain Soph": (35.6717, 139.7649),
    "Nataraj Ginza": (35.6717, 139.7649),
    # Other JP
    "Kamakura": (35.3192, 139.5469), "Yokohama": (35.4437, 139.6380),
    "Nara Park": (34.6851, 135.8430),
    # India destinations commonly mentioned by creators
    "Meenakshi Temple": (9.9195, 78.1193), "Meenakshi Amman": (9.9195, 78.1193),
    "Madurai": (9.9252, 78.1198), "Rameswaram": (9.2885, 79.3129),
    "Ramanathaswamy Temple": (9.2886, 79.3174), "Pamban Bridge": (9.2864, 79.2032),
    "Dhanushkodi": (9.1538, 79.4257), "Dwarka": (22.2394, 68.9678),
    "Dwarkadhish Temple": (22.2378, 68.9685), "Bet Dwarka": (22.4475, 69.1003),
    "Nageshwar Jyotirlinga": (22.3497, 69.0857), "Somnath": (20.8880, 70.4017),
    "Jaipur": (26.9124, 75.7873), "Udaipur": (24.5854, 73.7125),
    "Varanasi": (25.3176, 82.9739), "Goa": (15.2993, 74.1240),
    "Kerala": (10.8505, 76.2711), "Munnar": (10.0889, 77.0595),
    "Manali": (32.2396, 77.1887), "Leh": (34.1526, 77.5770), "Ladakh": (34.1526, 77.5770),
    "Amer Fort": (26.9855, 75.8513), "the Amer Fort": (26.9855, 75.8513),
    "Hawa Mahal": (26.9239, 75.8267), "City Palace": (26.9255, 75.8235),
    "Kalachakra Temple": (32.2426, 77.1887),
}


def eprint(msg: str) -> None:
    sys.stderr.write(f"[corpus] {msg}\n"); sys.stderr.flush()


def load_watchlist():
    try:
        import yaml
    except ImportError:
        eprint("PyYAML not installed; pip install pyyaml")
        sys.exit(1)
    if not WATCHLIST.exists():
        eprint(f"watchlist not found: {WATCHLIST}")
        sys.exit(1)
    return yaml.safe_load(WATCHLIST.read_text())


def load_secret_keys():
    keys = {}
    if not SECRETS.exists():
        return keys
    for line in SECRETS.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            if v.strip():
                keys[k.strip()] = v.strip()
    return keys


# In-process argos cache — loading the model on first call is ~5-10s, but every
# call after that is ms. Subprocess-per-translate makes the run hang for minutes.
_ARGOS_CACHE = {"loaded": False, "languages": [], "translations": {}}


def _argos_load():
    if _ARGOS_CACHE["loaded"]:
        return
    try:
        import argostranslate.translate as at
        _ARGOS_CACHE["languages"] = at.get_installed_languages()
    except Exception as e:
        eprint(f"argos init failed: {e}")
    _ARGOS_CACHE["loaded"] = True


def _detect_lang(text: str) -> str:
    try:
        from langdetect import detect, DetectorFactory
        DetectorFactory.seed = 0
        return detect(text)
    except Exception:
        return "?"


def translate_to_en(text: str, src_lang: str | None) -> tuple[str, str]:
    """Translate text → English. Returns (english_text, engine_used).
    Pass-through if already English, empty, or untranslatable. In-process,
    NOT subprocess — see _ARGOS_CACHE."""
    if not text or not text.strip():
        return text or "", "passthrough"
    if src_lang and src_lang.lower().startswith("en"):
        return text, "passthrough"
    # If lang is unknown, try to detect (cheap).
    if not src_lang or src_lang in ("?", "auto"):
        src_lang = _detect_lang(text[:1500])
        if src_lang in ("?", "en"):
            return text, "passthrough"
    # Cap input to keep translation fast.
    snippet = text[:6000]
    _argos_load()
    langs = _ARGOS_CACHE["languages"]
    if not langs:
        return text, "no-engine"
    from_lang = next((l for l in langs if l.code == src_lang), None)
    to_lang = next((l for l in langs if l.code == "en"), None)
    if not (from_lang and to_lang):
        return text, "lang-pair-missing"
    pair_key = f"{src_lang}->en"
    translation = _ARGOS_CACHE["translations"].get(pair_key)
    if translation is None:
        try:
            translation = from_lang.get_translation(to_lang)
        except Exception as e:
            eprint(f"argos pair lookup failed: {e}")
            return text, "argos-error"
        _ARGOS_CACHE["translations"][pair_key] = translation
    if not translation:
        return text, "argos-error"
    try:
        en = translation.translate(snippet)
    except Exception as e:
        eprint(f"argos translate failed: {e}")
        return text, "argos-error"
    return (en or text), "argos"


def run_script(name: str, args: list[str], timeout: int = 300) -> list | dict | None:
    """Shell out to scripts/api/{name}.py and return parsed JSON."""
    script = SCRIPTS / f"{name}.py"
    if not script.exists():
        eprint(f"missing script: {script}")
        return None
    try:
        proc = subprocess.run(
            ["python3", str(script), *args],
            capture_output=True, text=True, timeout=timeout,
        )
        if proc.returncode != 0:
            eprint(f"{name} exit {proc.returncode}: {proc.stderr.strip()[:300]}")
            # Some scripts (e.g. tripadvisor) exit 1 cleanly — still try to parse stdout.
            if not proc.stdout.strip():
                return None
        if not proc.stdout.strip():
            return None
        return json.loads(proc.stdout)
    except subprocess.TimeoutExpired:
        eprint(f"{name} timed out")
        return None
    except json.JSONDecodeError as e:
        eprint(f"{name} stdout was not JSON: {e}")
        return None


def find_destinations(text: str) -> list[dict]:
    """Back-compat wrapper. Use find_destinations_scored for relevance signals."""
    return [{"name": d["name"], "country": d["country"], "lat": d["lat"], "lon": d["lon"]}
            for d in find_destinations_scored(text, "")]


# Minimum score for a destination tag to survive. Title hit alone is enough;
# 3+ transcript hits are also enough; a single transcript-body hit is NOT.
DEST_RELEVANCE_THRESHOLD = 3


def find_destinations_scored(title: str, body: str) -> list[dict]:
    """Score destination relevance. Title hits weight 3x, body hits weight 1x
    capped at 5 per destination (so a Turkey vlog that mentions Tokyo once
    doesn't get tagged as Tokyo). Filters out destinations below threshold.
    Each entry includes a relevance_score in 0..max(8) range."""
    if not (title or body):
        return []
    found = {}
    title_text = title or ""
    body_text = body or ""
    for canon, entry in GAZETTEER.items():
        title_hits = 0
        body_hits = 0
        matched_alias = None
        for alias in entry["aliases"]:
            pattern = r"\b" + re.escape(alias) + r"\b"
            if re.search(pattern, title_text, re.IGNORECASE):
                title_hits += 1
                matched_alias = matched_alias or alias
            # cap at 5 hits in body to avoid over-weighting one keyword spam
            body_count = len(re.findall(pattern, body_text, re.IGNORECASE))
            if body_count:
                body_hits += min(body_count, 5)
                matched_alias = matched_alias or alias
        score = title_hits * 3 + min(body_hits, 5)
        if score >= DEST_RELEVANCE_THRESHOLD:
            found[canon] = {
                "name": canon,
                "country": entry["country"],
                "lat": entry["lat"],
                "lon": entry["lon"],
                "relevance_score": score,
                "matched_alias": matched_alias,
            }
    return sorted(found.values(), key=lambda d: -d["relevance_score"])


def find_places(text: str, dest_names: list[str]) -> list[dict]:
    """Heuristic place-name extraction. Two passes:
      1) POI gazetteer — direct word-match for known places (high precision).
      2) Verb-trigger regex — catches places we didn't pre-list (lower precision).
    Best-effort — for surfacing quotes, not authoritative."""
    if not text:
        return []
    out = []
    seen = set()
    # Pass 1: POI gazetteer match (longest first, so "Hakone Open Air Museum" wins over "Hakone")
    sorted_aliases = sorted(POI_GAZETTEER.keys(), key=len, reverse=True)
    for alias in sorted_aliases:
        canon = POI_GAZETTEER[alias]
        if canon in seen or canon in dest_names:
            continue
        # Word-boundary match, but for hyphenated names we need a softer boundary
        m = re.search(r"(?<![A-Za-z])" + re.escape(alias) + r"(?![A-Za-z])", text, re.IGNORECASE)
        if not m:
            continue
        seen.add(canon)
        idx = m.start()
        a = max(0, idx - 100); b = min(len(text), idx + 220)
        snippet = text[a:b].replace("\n", " ").strip()
        sentiment = sentiment_of(snippet)
        place = {
            "name": canon,
            "city": dest_names[0] if dest_names else None,
            "sentiment": sentiment,
            "quote": snippet[:300],
        }
        coords = POI_COORDS.get(canon)
        if coords:
            place["lat"], place["lon"] = coords
        out.append(place)
        if len(out) >= 12:
            return out
    # Pass 2: verb-trigger regex
    for m in PLACE_RE.finditer(text):
        place = m.group(1).strip()
        # skip if short or ALL CAPS noise
        if len(place) < 4 or place.isupper():
            continue
        # skip if first word is a sentence-fragment stopword (e.g. "Getting", "Catching")
        first_word = place.split()[0] if place else ""
        if first_word in PLACE_STOPWORDS:
            continue
        # require at least 2 words and 8 chars (rules out single words like "Tokyo")
        if len(place.split()) < 2 or len(place) < 8:
            continue
        # skip if the place is a destination name (already captured separately)
        if place in dest_names:
            continue
        if place in seen:
            continue
        seen.add(place)
        # snippet around it — take 80 chars before and after for a quote-able context
        idx = m.start(1)
        a = max(0, idx - 80); b = min(len(text), idx + 200)
        snippet = text[a:b].replace("\n", " ").strip()
        sentiment = sentiment_of(snippet)
        entry = {
            "name": place,
            "city": dest_names[0] if dest_names else None,
            "sentiment": sentiment,
            "quote": snippet[:240],
        }
        coords = POI_COORDS.get(place)
        if coords:
            entry["lat"], entry["lon"] = coords
        out.append(entry)
        if len(out) >= 12:
            break
    return out


def sentiment_of(snippet: str) -> str:
    s = snippet.lower()
    pos = sum(1 for w in POSITIVE_LEXICON if w in s)
    neg = sum(1 for w in NEGATIVE_LEXICON if w in s)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


def is_veg_friendly(text: str, creator_signal: bool) -> bool:
    if creator_signal:
        return True
    if not text:
        return False
    s = text.lower()
    return any(sig in s for sig in VEG_SIGNALS)


def score_components(item: dict) -> dict:
    """Crude relevance scoring per item."""
    # Recency: 1.0 if within last 6 months, decay to 0.3 at 24mo+.
    recency = 0.3
    pub = item.get("published")
    if pub:
        try:
            dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            months = (now - dt).days / 30.0
            recency = max(0.3, min(1.0, 1.0 - (months - 6) * 0.04))
        except Exception:
            pass
    # Topical match: how much of the item ties to a known destination
    dest_count = len(item.get("destinations") or [])
    place_count = len(item.get("places_mentioned") or [])
    topical = min(1.0, 0.4 + 0.15 * dest_count + 0.05 * place_count)
    # Authority: defer until social_blade integration, default 0.5
    authority = item.get("score_components", {}).get("channel_authority", 0.5)
    return {
        "recency": round(recency, 2),
        "topical_match": round(topical, 2),
        "channel_authority": round(authority, 2),
    }


def normalize_youtube(video: dict, transcript: dict | None, creator_meta: dict, dest_filter: str | None,
                      do_translate: bool = True) -> dict | None:
    raw_text = (transcript or {}).get("text", "") if transcript else ""
    title = video.get("title", "")
    src_lang = (transcript or {}).get("lang")
    # Translate body to English before scoring/extraction. Title is usually already EN.
    if do_translate and raw_text:
        en_text, engine = translate_to_en(raw_text, src_lang)
    else:
        en_text, engine = raw_text, "skipped"
    blob = f"{title}\n{en_text}"
    dests = find_destinations_scored(title, en_text)
    dest_names = [d["name"] for d in dests]
    # GUARDRAIL: dest_filter must be in the high-relevance set, not just an alias somewhere.
    if dest_filter and dest_filter not in dest_names:
        return None
    # GUARDRAIL: drop items with no transcript at all (caption-less + whisper failed).
    if not en_text.strip():
        eprint(f"drop yt:{video.get('video_id')} (empty transcript)")
        return None
    # GUARDRAIL: drop items with no high-relevance destinations (fail-safe).
    if not dests:
        eprint(f"drop yt:{video.get('video_id')} (no destination match)")
        return None
    places = find_places(en_text, dest_names)
    item = {
        "id": f"yt:{video['video_id']}",
        "source": "youtube",
        "creator": creator_meta.get("handle"),
        "url": video.get("url"),
        "title": title,
        "published": video.get("published"),
        "destinations": dests,
        "places_mentioned": places,
        "transcript_lang": src_lang,
        "translation_engine": engine,
        "transcript_en_excerpt": en_text[:1200],
        "veg_friendly": is_veg_friendly(blob, creator_meta.get("veg_friendly_signal", False)),
        "tags": tag_item(blob, creator_meta),
        "thumbnail": video.get("thumbnail"),
    }
    item["score_components"] = score_components(item)
    return item


def normalize_blog(post: dict, blog_meta: dict, dest_filter: str | None,
                   do_translate: bool = True) -> dict | None:
    body = post.get("body_en") or ""
    title = post.get("title") or ""
    src_lang = post.get("lang")
    if do_translate and body and src_lang and not src_lang.lower().startswith("en"):
        body, _engine = translate_to_en(body, src_lang)
    blob = f"{title}\n{body}"
    dests = find_destinations_scored(title, body)
    dest_names = [d["name"] for d in dests]
    if dest_filter and dest_filter not in dest_names:
        return None
    if not body.strip():
        return None
    if not dests:
        return None
    places = find_places(body, dest_names)
    item = {
        "id": f"blog:{post.get('url')}",
        "source": "blog",
        "creator": blog_meta.get("name"),
        "url": post.get("url"),
        "title": title,
        "published": post.get("published"),
        "destinations": dests,
        "places_mentioned": places,
        "transcript_lang": post.get("lang"),
        "transcript_en_excerpt": (body or "")[:1200],
        "veg_friendly": is_veg_friendly(blob, blog_meta.get("veg_friendly_signal", False)),
        "tags": tag_item(blob, blog_meta),
    }
    item["score_components"] = score_components(item)
    return item


def normalize_instagram(post: dict, ig_meta: dict, dest_filter: str | None,
                        do_translate: bool = True) -> dict | None:
    cap = post.get("caption") or ""
    location = post.get("location") or ""
    if do_translate and cap:
        cap, _engine = translate_to_en(cap, None)
    blob = f"{cap}\n{location}"
    dests = find_destinations_scored(location, cap)
    dest_names = [d["name"] for d in dests]
    if dest_filter and dest_filter not in dest_names:
        return None
    if not (cap.strip() or location.strip()):
        return None
    if not dests:
        return None
    places = find_places(cap, dest_names)
    item = {
        "id": f"ig:{post.get('post_id')}",
        "source": "instagram",
        "creator": "@" + ig_meta.get("handle", ""),
        "url": post.get("url"),
        "title": (cap.splitlines() or [""])[0][:120],
        "published": post.get("published"),
        "destinations": dests,
        "places_mentioned": places,
        "transcript_lang": "en",
        "transcript_en_excerpt": cap[:1200],
        "veg_friendly": is_veg_friendly(blob, ig_meta.get("veg_friendly_signal", False)),
        "tags": tag_item(blob, ig_meta),
    }
    item["score_components"] = score_components(item)
    return item


def tag_item(blob: str, meta: dict) -> list[str]:
    tags = []
    s = blob.lower()
    if any(w in s for w in ("with kids", "family", "children", "toddler")):
        tags.append("family")
    if any(w in s for w in ("first time", "first-timer", "first visit")):
        tags.append("first-timer")
    if "summer" in s:
        tags.append("summer")
    if "winter" in s:
        tags.append("winter")
    if any(w in s for w in ("monsoon", "rain")):
        tags.append("monsoon")
    if meta.get("veg_friendly_signal"):
        tags.append("veg-creator")
    return tags


def main():
    p = argparse.ArgumentParser(description="Influencer corpus builder")
    p.add_argument("--full", action="store_true")
    p.add_argument("--for-destination", help="canonical destination name (e.g. Tokyo)")
    p.add_argument("--max-per-source", type=int, default=8)
    p.add_argument("--since", default=None, help="YYYY-MM-DD; default: 18 months ago")
    p.add_argument("--no-translate", action="store_true")
    p.add_argument("--skip-instagram", action="store_true", help="skip Instagram (no creds, or rate-limited)")
    p.add_argument("--skip-youtube", action="store_true")
    p.add_argument("--skip-blogs", action="store_true")
    p.add_argument("--whisper-fallback", action="store_true",
                   help="run faster-whisper when YouTube captions are missing")
    args = p.parse_args()

    if not (args.full or args.for_destination):
        eprint("specify either --full or --for-destination NAME")
        sys.exit(1)

    if not args.since:
        # default: 18 months ago
        eighteen_mo = datetime.now(timezone.utc).replace(day=1)
        for _ in range(18):
            if eighteen_mo.month == 1:
                eighteen_mo = eighteen_mo.replace(year=eighteen_mo.year - 1, month=12)
            else:
                eighteen_mo = eighteen_mo.replace(month=eighteen_mo.month - 1)
        args.since = eighteen_mo.strftime("%Y-%m-%d")

    watchlist = load_watchlist()
    keys = load_secret_keys()
    items = []

    # YouTube
    yt_handles = [c["handle"] for c in (watchlist.get("youtube") or [])]
    if not args.skip_youtube and yt_handles and keys.get("YOUTUBE_API_KEY"):
        eprint(f"discovering YouTube uploads for {len(yt_handles)} channels…")
        videos = run_script("youtube_discover", [
            "--handles", ",".join(yt_handles),
            "--since", args.since,
            "--max", str(args.max_per_source),
        ], timeout=600) or []

        creator_lookup = {c["handle"]: c for c in (watchlist.get("youtube") or [])}
        for v in videos:
            vid = (v.get("video_id") or "").strip()
            if not vid:
                continue
            tr_args = ["--video-id", vid]
            if args.whisper_fallback:
                tr_args.append("--whisper-fallback")
            transcript = run_script("youtube_transcript", tr_args, timeout=900)
            meta = creator_lookup.get(v.get("creator_handle"), {})
            normalized = normalize_youtube(v, transcript, meta, args.for_destination, do_translate=not args.no_translate)
            if normalized:
                items.append(normalized)
            time.sleep(0.5)
    elif not args.skip_youtube:
        eprint("[skipped: youtube] no key set")

    # Blogs
    if not args.skip_blogs:
        for blog in (watchlist.get("blogs") or []):
            eprint(f"fetching blog: {blog.get('name')}")
            posts = run_script("blog_feed", [
                "--feed", blog["url"],
                "--since", args.since,
                "--max", str(args.max_per_source),
            ] + (["--no-translate"] if args.no_translate else []), timeout=600) or []
            for post in posts:
                normalized = normalize_blog(post, blog, args.for_destination, do_translate=not args.no_translate)
                if normalized:
                    items.append(normalized)

    # Instagram
    ig_handles = watchlist.get("instagram") or []
    if not args.skip_instagram and ig_handles and keys.get("INSTAGRAM_USER") and keys.get("INSTAGRAM_PASS"):
        for ig in ig_handles:
            eprint(f"fetching IG: {ig.get('handle')}")
            posts = run_script("instagram_creator", [
                "--handle", ig["handle"],
                "--since", args.since,
                "--max", str(min(args.max_per_source, 20)),
            ], timeout=600) or []
            for post in posts:
                normalized = normalize_instagram(post, ig, args.for_destination, do_translate=not args.no_translate)
                if normalized:
                    items.append(normalized)
    elif not args.skip_instagram:
        eprint("[skipped: instagram] no creds set")

    # Sort: most recent + best-scored first
    items.sort(
        key=lambda it: (
            it["score_components"]["topical_match"] + it["score_components"]["recency"],
            it.get("published") or "",
        ),
        reverse=True,
    )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "full" if args.full else f"for-destination:{args.for_destination}",
        "items": items,
        "stats": {
            "total": len(items),
            "by_source": {
                "youtube": sum(1 for x in items if x["source"] == "youtube"),
                "blog": sum(1 for x in items if x["source"] == "blog"),
                "instagram": sum(1 for x in items if x["source"] == "instagram"),
            },
        },
    }

    # On --for-destination, MERGE with whatever's already in the file rather than wiping.
    if args.for_destination and OUTFILE.exists():
        try:
            existing = json.loads(OUTFILE.read_text())
            kept = [it for it in existing.get("items", [])
                    if not any(d.get("name") == args.for_destination for d in (it.get("destinations") or []))]
            payload["items"] = items + kept
            payload["mode"] = f"for-destination:{args.for_destination} (merged)"
            payload["stats"]["total"] = len(payload["items"])
        except Exception as e:
            eprint(f"merge with existing failed, overwriting: {e}")

    OUTFILE.parent.mkdir(parents=True, exist_ok=True)
    OUTFILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    eprint(f"wrote {OUTFILE} ({payload['stats']['total']} items)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
