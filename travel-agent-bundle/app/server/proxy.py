"""
Yatra. Local API proxy + static server.

Serves the trips/ folder at http://localhost:8889/, plus a /api/* prefix that
forwards to upstream APIs without exposing keys to the browser.

Routes (SerpAPI-backed):
  GET /api/flights?origin=BLR&destination=COK&depart=2026-10-17&return=2026-10-25&pax=4
  GET /api/hotels?dest=Madurai&checkin=2026-06-15&checkout=2026-06-18&adults=2&kids=2&kidAges=6,9
  GET /api/local?q=pure+veg&location=Madurai
  GET /api/holidays?country=IN&year=2026

Routes (free-tier APIs, mirror the scripts/api/ CLIs):
  GET /api/amadeus/flights?origin=BLR&dest=NRT&depart=...&return=...&adults=2&children=2
  GET /api/amadeus/hotels?city=TYO&checkin=...&checkout=...&chain=MC,HH&rating=5
  GET /api/foursquare/places?query=vegetarian&near=Madurai+India&kid_friendly=1
  GET /api/liteapi/hotels?country=JP&city=Tokyo&checkin=...&checkout=...&adults=2&kidAges=6,9
  GET /api/weather?lat=35.68&lon=139.69&start=2026-12-15&end=2026-12-22&aqi=1

Routes (influencer ingestion):
  GET /api/influencer-content              cached corpus from trips/_shared/data/
  GET /api/youtube/transcript?video_id=..  shells to scripts/api/youtube_transcript.py
  GET /api/tripadvisor?query=..&type=..    shells to scripts/api/tripadvisor.py

Keys are read from:
    trips/_shared/data/secrets.json   (gitignored)
"""
import http.server
import json
import socketserver
import subprocess
import threading
import time
import urllib.request
import urllib.parse
import urllib.error
import os
import sys
import functools
from collections import defaultdict
from pathlib import Path

import agent_runs

PORT = 8889
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ROOT = PROJECT_ROOT / "trips"
SECRETS_PATH = ROOT / "_shared" / "data" / "secrets.json"
WORKSPACE_SECRETS_PATH = PROJECT_ROOT / ".workspace" / "secrets.local.md"
INFLUENCER_CORPUS = ROOT / "_shared" / "data" / "influencer-content.json"
SCRIPTS_API = PROJECT_ROOT / "scripts" / "api"

import re as _re
_KV_RE = _re.compile(r"^([A-Z][A-Z0-9_]*)=(.*)$")


# --- Service usage tracker ---------------------------------------------------
# In-memory record of every upstream call this proxy made during the session.
# Surfaces through /api/status so the hidden status panel can explain in
# plain English which APIs are healthy / rate-limited / misconfigured.
_USAGE_LOCK = threading.Lock()
_USAGE: dict = defaultdict(lambda: {
    "ok": 0, "quota": 0, "error": 0,
    "last_ok": None, "last_quota": None, "last_error": None,
    "last_message": None,
})


def record_usage(service, outcome, message=None):
    """outcome ∈ {'ok','quota','error'}"""
    with _USAGE_LOCK:
        u = _USAGE[service]
        u[outcome] += 1
        u[f"last_{outcome}"] = time.time()
        if message:
            u["last_message"] = message[:240]


def usage_snapshot():
    with _USAGE_LOCK:
        return {k: dict(v) for k, v in _USAGE.items()}


def _load_workspace_secrets():
    """Parse .workspace/secrets.local.md (the canonical source used by scripts/api/_lib.py).
    Returns only keys with non-empty values."""
    if not WORKSPACE_SECRETS_PATH.exists():
        return {}
    out = {}
    try:
        for raw in WORKSPACE_SECRETS_PATH.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or line.startswith("```"):
                continue
            m = _KV_RE.match(line)
            if not m:
                continue
            key, val = m.group(1), m.group(2).strip()
            if val:
                out[key] = val
    except Exception as e:
        print(f"[proxy] could not parse {WORKSPACE_SECRETS_PATH}: {e}", file=sys.stderr)
    return out


def _load_json_secrets():
    try:
        with open(SECRETS_PATH) as f:
            data = json.load(f) or {}
        # Drop empty strings so they don't shadow the markdown-side values.
        return {k: v for k, v in data.items() if v}
    except Exception as e:
        print(f"[proxy] could not load {SECRETS_PATH}: {e}", file=sys.stderr)
        return {}


@functools.lru_cache(maxsize=1)
def load_secrets():
    """Merge .workspace/secrets.local.md (canonical) with trips/_shared/data/secrets.json.
    Markdown wins when both define the same key, since the scripts treat it as
    source of truth and the JSON file historically drifts behind."""
    json_secrets = _load_json_secrets()
    md_secrets = _load_workspace_secrets()
    merged = {**json_secrets, **md_secrets}
    return merged


def http_get(url, timeout=30, headers=None):
    h = {"User-Agent": "yatra-proxy/1.0"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return 500, json.dumps({"error": str(e)}).encode()


def _searchapi_fallback(serp_url):
    """Translate a SerpAPI URL into a SearchAPI.io call. SearchAPI mirrors
    SerpAPI's google_flights/google_hotels/google_local engines and JSON shapes,
    so swapping the host + auth header is all that's needed.

    Returns the body bytes on success, or None on auth/quota/error.
    For google_hotels: SearchAPI's free response omits prices, so if no
    properties have rate_per_night we return None and let the caller try a
    price-bearing fallback (LiteAPI)."""
    secrets = load_secrets()
    sak = secrets.get("SEARCHAPI_KEY")
    if not sak:
        return None
    parsed = urllib.parse.urlparse(serp_url)
    params = dict(urllib.parse.parse_qsl(parsed.query))
    params.pop("api_key", None)  # auth moves to header
    sa_url = "https://www.searchapi.io/api/v1/search?" + urllib.parse.urlencode(params)
    sstatus, sbody = http_get(sa_url, headers={"Authorization": f"Bearer {sak}"})
    if sstatus == 401:
        record_usage("searchapi", "error", "auth failed (401)")
        return None
    if sstatus == 402 or sstatus == 429:
        record_usage("searchapi", "quota", f"HTTP {sstatus}")
        return None
    if sstatus >= 300:
        record_usage("searchapi", "error", f"HTTP {sstatus}")
        return None
    try:
        j = json.loads(sbody)
    except Exception:
        record_usage("searchapi", "error", "non-JSON body")
        return None
    if isinstance(j, dict) and j.get("error"):
        msg = str(j["error"])
        low = msg.lower()
        is_quota = "limit" in low or "quota" in low or "credit" in low
        record_usage("searchapi", "quota" if is_quota else "error", msg)
        return None
    # Quality gate for google_hotels: free SearchAPI doesn't surface prices.
    # If no property has a rate, defer to LiteAPI which does have prices.
    if params.get("engine") == "google_hotels":
        props = j.get("properties") or []
        if props and not any(p.get("rate_per_night") for p in props):
            record_usage("searchapi", "ok")
            return None  # bail so caller falls through to LiteAPI
    record_usage("searchapi", "ok")
    return sbody


def _serpapi_keys():
    """Return SerpAPI keys in priority order. The primary is SERPAPI_KEY.
    Additional keys can be added via SERPAPI_KEYS_BACKUP (comma-separated)
    or numbered SERPAPI_KEY_2, SERPAPI_KEY_3, ... All are tried in order
    until one returns data; quota-exhausted keys are skipped without a
    user-visible error."""
    secrets = load_secrets()
    keys = []
    seen = set()
    primary = secrets.get("SERPAPI_KEY")
    if primary:
        keys.append(primary)
        seen.add(primary)
    backup = secrets.get("SERPAPI_KEYS_BACKUP", "")
    for k in [k.strip() for k in backup.split(",") if k.strip()]:
        if k not in seen:
            keys.append(k); seen.add(k)
    for i in range(2, 10):
        k = secrets.get(f"SERPAPI_KEY_{i}")
        if k and k not in seen:
            keys.append(k); seen.add(k)
    return keys


def _swap_serpapi_key(url, new_key):
    parsed = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    params = [(k, new_key if k == "api_key" else v) for k, v in params]
    return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(params)))


def serpapi_get(url):
    # SerpAPI signals quota exhaustion as HTTP 200 with {"error": "..."}, so
    # we have to peek at the body. Map both shapes to a structured 429 the
    # browser can act on (fall back to stale cache + show a "cached" badge).
    keys = _serpapi_keys()
    if not keys:
        return 400, json.dumps({"error": "SERPAPI_KEY not set"}).encode()

    last_quota_msg = None
    for idx, key in enumerate(keys):
        attempt_url = _swap_serpapi_key(url, key) if idx > 0 else url
        status, body = http_get(attempt_url)
        if status == 429:
            msg = _safe_serpapi_error(body) or "rate limited"
            print(f"[proxy] serpapi key#{idx+1} 429: {msg}", file=sys.stderr)
            record_usage("serpapi", "quota", msg)
            last_quota_msg = msg
            continue  # try next key
        if status < 300:
            try:
                j = json.loads(body)
            except Exception:
                record_usage("serpapi", "ok")
                return status, body
            if isinstance(j, dict) and j.get("error"):
                msg = j["error"]
                low = msg.lower()
                is_quota = ("run out" in low or "exceeded" in low or "limit" in low or "plan" in low)
                print(f"[proxy] serpapi key#{idx+1} error: {msg}", file=sys.stderr)
                record_usage("serpapi", "quota" if is_quota else "error", msg)
                if is_quota:
                    last_quota_msg = msg
                    continue  # try next key
                # non-quota error: stop trying keys, fall through to SearchAPI
                break
            record_usage("serpapi", "ok")
            return status, body
        # 5xx etc — try next key
        record_usage("serpapi", "error", f"HTTP {status}")

    # All SerpAPI keys exhausted (or non-quota error) → SearchAPI fallback
    print(f"[proxy] all {len(keys)} serpapi keys exhausted → trying SearchAPI", file=sys.stderr)
    fb = _searchapi_fallback(url)
    if fb is not None:
        return 200, fb
    return 429, json.dumps({
        "error": last_quota_msg or "all serpapi keys exhausted; searchapi unavailable",
        "code": "quota_exceeded",
    }).encode()


def _safe_serpapi_error(body):
    try:
        j = json.loads(body)
        if isinstance(j, dict) and j.get("error"):
            return j["error"]
    except Exception:
        pass
    return None


def liteapi_hotels_as_serpapi(secrets, dest, checkin, checkout, adults, kids, kid_ages, hotel_class=""):
    """Fetch hotels via LiteAPI and reshape to the SerpAPI Google Hotels response
    contract the frontend (data-sources.js Hotels.search) expects:
        { properties: [{ name, rate_per_night.lowest, total_rate.lowest,
                         overall_rating, reviews, hotel_class,
                         gps_coordinates: {latitude,longitude},
                         link, amenities, images: [{thumbnail}] }] }
    Returns (status, body_bytes) with body=JSON. Returns (None, None) if not configured.
    """
    lite = secrets.get("LITEAPI_KEY")
    if not lite:
        return None, None
    # 1. Geocode dest → country code + canonical city name (free, no key)
    try:
        gstatus, gbody = http_get(
            "https://geocoding-api.open-meteo.com/v1/search?"
            + urllib.parse.urlencode({"name": dest, "count": 1, "language": "en"})
        )
        if gstatus >= 300:
            return 502, json.dumps({"error": "geocode failed", "code": "fallback_failed"}).encode()
        g = json.loads(gbody)
        first = (g.get("results") or [None])[0]
        if not first:
            return 502, json.dumps({"error": f"could not geocode '{dest}'", "code": "fallback_failed"}).encode()
        country_code = first.get("country_code")
        city_name = first.get("name") or dest
    except Exception as e:
        return 502, json.dumps({"error": f"geocode error: {e}", "code": "fallback_failed"}).encode()

    # 2. List hotels in the city
    list_params = {"countryCode": country_code, "cityName": city_name, "limit": "20"}
    if hotel_class:
        try:
            list_params["minRating"] = str(int(hotel_class))
        except ValueError:
            pass
    list_url = "https://api.liteapi.travel/v3.0/data/hotels?" + urllib.parse.urlencode(list_params)
    lstatus, lbody = http_get(list_url, headers={"X-API-Key": lite, "accept": "application/json"})
    if lstatus >= 300:
        record_usage("liteapi", "error" if lstatus != 429 else "quota", f"HTTP {lstatus}")
        return lstatus, lbody
    try:
        hotels_meta = json.loads(lbody).get("data", [])
        hotel_ids = [h["id"] for h in hotels_meta[:20] if h.get("id")]
        meta_by_id = {h["id"]: h for h in hotels_meta if h.get("id")}
    except Exception as e:
        return 502, json.dumps({"error": f"parse listing: {e}"}).encode()

    if not hotel_ids:
        return 200, json.dumps({"properties": []}).encode()

    # 3. Fetch live rates
    children = [int(a) for a in str(kid_ages).split(",") if a.strip().isdigit()]
    rate_body = {
        "hotelIds": hotel_ids,
        "checkin": checkin,
        "checkout": checkout,
        "currency": "INR",
        "guestNationality": "IN",
        "occupancies": [{"adults": int(adults or 2), "children": children}],
    }
    req = urllib.request.Request(
        "https://api.liteapi.travel/v3.0/hotels/rates",
        data=json.dumps(rate_body).encode(),
        headers={
            "X-API-Key": lite,
            "Content-Type": "application/json",
            "accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            rstatus, rbody = resp.status, resp.read()
    except urllib.error.HTTPError as e:
        rstatus, rbody = e.code, e.read()
    except Exception as e:
        record_usage("liteapi", "error", str(e))
        return 502, json.dumps({"error": str(e)}).encode()

    if rstatus == 429:
        record_usage("liteapi", "quota", "HTTP 429")
        return rstatus, rbody
    if rstatus >= 300:
        record_usage("liteapi", "error", f"HTTP {rstatus}")
        return rstatus, rbody
    record_usage("liteapi", "ok")

    # 4. Reshape into SerpAPI Google Hotels contract
    try:
        rates = json.loads(rbody)
    except Exception:
        return 200, rbody

    nights = 1
    try:
        from datetime import date
        ci = date.fromisoformat(checkin)
        co = date.fromisoformat(checkout)
        nights = max(1, (co - ci).days)
    except Exception:
        pass

    properties = []
    for offer in (rates.get("data") or []):
        hid = offer.get("hotelId")
        meta = meta_by_id.get(hid, {})
        room_types = offer.get("roomTypes") or []
        # Find cheapest total amount across all rooms
        cheapest_total = None
        for room in room_types:
            for rate in (room.get("rates") or []):
                amount = (((rate.get("retailRate") or {}).get("total") or [{}])[0] or {}).get("amount")
                if isinstance(amount, (int, float)) and (cheapest_total is None or amount < cheapest_total):
                    cheapest_total = amount
        per_night = round(cheapest_total / nights, 2) if cheapest_total else None
        lat = meta.get("latitude")
        lng = meta.get("longitude")
        thumb = meta.get("thumbnail") or meta.get("main_photo") or meta.get("hotelImages", [{}])[0].get("urlHd") if isinstance(meta.get("hotelImages"), list) else None
        prop = {
            "name": meta.get("name") or hid,
            "overall_rating": meta.get("rating"),
            "reviews": meta.get("reviewCount"),
            "hotel_class": meta.get("stars"),
            "gps_coordinates": (
                {"latitude": lat, "longitude": lng}
                if isinstance(lat, (int, float)) and isinstance(lng, (int, float))
                else None
            ),
            "link": offer.get("bookingUrl") or f"https://www.google.com/travel/hotels/{urllib.parse.quote(meta.get('name') or '')}",
            "amenities": meta.get("hotelFacilities") or [],
            "images": [{"thumbnail": thumb}] if thumb else [],
        }
        if per_night is not None:
            prop["rate_per_night"] = {"lowest": f"₹{per_night:,.0f}", "extracted_lowest": per_night}
        if cheapest_total is not None:
            prop["total_rate"] = {"lowest": f"₹{cheapest_total:,.0f}", "extracted_lowest": cheapest_total}
        properties.append(prop)

    properties.sort(key=lambda p: p.get("rate_per_night", {}).get("extracted_lowest") or 1e12)
    return 200, json.dumps({"properties": properties, "_source": "liteapi"}).encode()


_AMADEUS_TOKEN = {"value": None, "expires_at": 0}


def amadeus_token(client_id, client_secret):
    if _AMADEUS_TOKEN["value"] and _AMADEUS_TOKEN["expires_at"] > time.time() + 30:
        return _AMADEUS_TOKEN["value"]
    body = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode()
    req = urllib.request.Request(
        "https://test.api.amadeus.com/v1/security/oauth2/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        _AMADEUS_TOKEN["value"] = data["access_token"]
        _AMADEUS_TOKEN["expires_at"] = time.time() + int(data.get("expires_in", 1700))
        return _AMADEUS_TOKEN["value"]
    except Exception as e:
        print(f"[proxy] amadeus token error: {e}", file=sys.stderr)
        return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        sys.stdout.write(f"[proxy] {self.address_string()} - {fmt % args}\n")
        sys.stdout.flush()

    def end_headers(self):
        # Allow browser fetch from any origin (we're local)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/agent/"):
            return self._handle_agent_get()
        if self.path == "/api/status" or self.path.startswith("/api/status?"):
            return self._handle_status()
        if self.path.startswith("/api/"):
            return self._handle_api()
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/agent/"):
            return self._handle_agent_post()
        return self._send_json(404, {"error": "POST not supported on this path"})

    def _send_json(self, status, body):
        body_bytes = body if isinstance(body, (bytes, bytearray)) else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body_bytes)))
        self.end_headers()
        self.wfile.write(body_bytes)

    def _params(self):
        u = urllib.parse.urlparse(self.path)
        return urllib.parse.parse_qs(u.query)

    def _handle_status(self):
        """Plain-language status of upstream APIs and key configuration.

        Combines three signals:
          1. Which secrets are present in trips/_shared/data/secrets.json
          2. In-process counters for what this proxy actually saw this session
          3. Cheap live probes (free /account or /usage endpoints) for the
             services that publish remaining-quota data — currently SerpAPI
             and DeepL. Probes are best-effort; failures are reported, not raised.
        """
        try:
            q = self._params()
            do_probe = q.get("probe", ["1"])[0] not in ("0", "false", "no")
            secrets = load_secrets()
            usage = usage_snapshot()

            services = []
            now = time.time()

            def fmt_rel(ts):
                if not ts:
                    return None
                d = int(now - ts)
                if d < 60:
                    return f"{d}s ago"
                if d < 3600:
                    return f"{d // 60}m ago"
                if d < 86400:
                    return f"{d // 3600}h ago"
                return f"{d // 86400}d ago"

            def derive_status(key_name, usage_key, configured):
                u = usage.get(usage_key, {})
                last_quota = u.get("last_quota") or 0
                last_error = u.get("last_error") or 0
                last_ok = u.get("last_ok") or 0
                if not configured:
                    return "missing_key"
                # Most recent event wins.
                if last_quota and last_quota >= max(last_error, last_ok):
                    return "rate_limited"
                if last_error and last_error >= last_ok:
                    return "errors"
                if last_ok:
                    return "ok"
                return "untouched"

            def add(name, plain, key_names, usage_key, route_hint=None, get_url=None,
                    probe_headers=None, free_quota_hint=None, signup_url=None):
                configured = all(secrets.get(k) for k in key_names) if key_names else True
                u = usage.get(usage_key, {})
                status = derive_status(key_names[0] if key_names else None, usage_key, configured)
                entry = {
                    "service": name,
                    "plain_name": plain,
                    "status": status,
                    "configured": configured,
                    "missing_keys": [k for k in key_names if not secrets.get(k)] if key_names else [],
                    "calls_ok": u.get("ok", 0),
                    "calls_quota": u.get("quota", 0),
                    "calls_error": u.get("error", 0),
                    "last_ok": fmt_rel(u.get("last_ok")),
                    "last_quota": fmt_rel(u.get("last_quota")),
                    "last_error": fmt_rel(u.get("last_error")),
                    "last_message": u.get("last_message"),
                    "route_hint": route_hint,
                    "free_quota_hint": free_quota_hint,
                    "signup_url": signup_url,
                }
                if get_url and configured and do_probe:
                    try:
                        headers = probe_headers(secrets) if probe_headers else None
                        pstatus, pbody = http_get(get_url(secrets), timeout=8, headers=headers)
                        try:
                            pj = json.loads(pbody)
                        except Exception:
                            pj = None
                        if isinstance(pj, dict):
                            for sensitive in ("api_key", "account_id", "account_email", "email"):
                                pj.pop(sensitive, None)
                        entry["probe"] = {"http": pstatus, "body": pj}
                    except Exception as e:
                        entry["probe"] = {"error": str(e)}
                services.append(entry)

            # SerpAPI: probe ALL keys in the rotation pool so the panel can show
            # combined remaining capacity.
            serp_keys = _serpapi_keys()
            serp_total_left = 0
            serp_total_cap = 0
            serp_per_key = []
            if do_probe:
                for k in serp_keys:
                    try:
                        pstatus, pbody = http_get(f"https://serpapi.com/account.json?api_key={k}", timeout=8)
                        pj = json.loads(pbody) if pstatus < 300 else None
                    except Exception:
                        pj = None
                    if isinstance(pj, dict):
                        for sensitive in ("api_key", "account_id", "account_email", "email"):
                            pj.pop(sensitive, None)
                        left = pj.get("total_searches_left") or 0
                        cap = pj.get("searches_per_month") or 0
                        serp_total_left += left
                        serp_total_cap += cap
                        serp_per_key.append({"left": left, "cap": cap, "status": pj.get("account_status")})
            add(
                "serpapi",
                f"SerpAPI ({len(serp_keys)} key{'s' if len(serp_keys)!=1 else ''} in rotation — Google flights / hotels / local)",
                ["SERPAPI_KEY"], "serpapi",
                route_hint="/api/flights, /api/hotels, /api/local",
                free_quota_hint=(
                    f"Combined: {serp_total_left} of {serp_total_cap} searches left across {len(serp_keys)} key(s); resets monthly"
                    if serp_per_key else "250 searches/month per key on the free plan"
                ),
                signup_url="https://serpapi.com/manage-api-key",
            )
            # Inject the per-key probe into the entry we just appended
            if serp_per_key:
                services[-1]["probe"] = {"http": 200, "body": {
                    "keys_in_rotation": len(serp_keys),
                    "total_searches_left": serp_total_left,
                    "total_searches_cap": serp_total_cap,
                    "per_key": serp_per_key,
                }}
            add(
                "searchapi", "SearchAPI.io (SerpAPI fallback — flights/local; no hotel prices on free)",
                ["SEARCHAPI_KEY"], "searchapi",
                route_hint="auto-used when /api/flights, /api/hotels, /api/local hit SerpAPI quota",
                free_quota_hint="100 searches/month free; google_hotels response omits prices on free tier",
                signup_url="https://www.searchapi.io/dashboard",
            )
            add(
                "amadeus", "Amadeus (test) — flights + hotels",
                ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET"], "amadeus",
                route_hint="/api/amadeus/flights, /api/amadeus/hotels",
                free_quota_hint="Self-service test sandbox; ~2k calls/month soft cap per endpoint",
                signup_url="https://developers.amadeus.com/my-apps",
            )
            add(
                "calendarific", "Calendarific (public holidays)",
                ["CALENDARIFIC_KEY"], "calendarific",
                route_hint="/api/holidays",
                free_quota_hint="1,000 calls/month on the free plan",
                signup_url="https://calendarific.com/account",
            )
            add(
                "foursquare", "Foursquare Places",
                ["FOURSQUARE_KEY"], "foursquare",
                route_hint="/api/foursquare/places",
                free_quota_hint="Free tier ~100k regular calls/month",
                signup_url="https://foursquare.com/developers/apps",
            )
            add(
                "openweather", "OpenWeather AQI",
                ["OPENWEATHER_KEY"], "openweather",
                route_hint="/api/weather?aqi=1",
                free_quota_hint="60 calls/min, 1M/month free",
                signup_url="https://home.openweathermap.org/api_keys",
            )
            add(
                "open-meteo", "Open-Meteo (weather; no key)",
                [], "open-meteo",
                route_hint="/api/weather",
                free_quota_hint="No key, 10k calls/day fair-use",
            )
            add(
                "tripadvisor", "TripAdvisor Content API",
                ["TRIPADVISOR_KEY"], "tripadvisor",
                route_hint="/api/tripadvisor",
                free_quota_hint="Free tier 5,000 calls/day, IP allowlisted",
                signup_url="https://developer-tripadvisor.com/content-api/",
            )
            add(
                "liteapi", "LiteAPI (hotels — sandbox)",
                ["LITEAPI_KEY"], "liteapi",
                route_hint="/api/liteapi/hotels",
                free_quota_hint="Sandbox key (sand_*) returns mocked rates; production key needed for live booking",
                signup_url="https://dashboard.liteapi.travel/",
            )
            add(
                "youtube", "YouTube Data API + transcript fallback",
                ["YOUTUBE_API_KEY"], "youtube_transcript",
                route_hint="/api/youtube/transcript",
                free_quota_hint="10,000 quota units/day (search costs 100)",
                signup_url="https://console.cloud.google.com/apis/credentials",
            )
            # Optional services with no in-proxy route yet (informational only).
            for k, name, hint in [
                ("BRAVE_KEY", "Brave Search", "2,000 calls/month free"),
                ("DEEPL_KEY", "DeepL Translate", "500k chars/month free"),
                ("GEOAPIFY_KEY", "Geoapify (geocoding)", "3,000 calls/day free"),
                ("PEXELS_KEY", "Pexels (stock photos)", "200/hr, 20k/month free"),
                ("KIWI_KEY", "Kiwi.com (Tequila flight search)", "Partner key, no public quota"),
            ]:
                services.append({
                    "service": k.lower().replace("_key", ""),
                    "plain_name": name,
                    "status": "ok" if secrets.get(k) else "missing_key",
                    "configured": bool(secrets.get(k)),
                    "missing_keys": [] if secrets.get(k) else [k],
                    "calls_ok": 0, "calls_quota": 0, "calls_error": 0,
                    "free_quota_hint": hint,
                    "informational_only": True,
                })

            # DeepL live probe (free /usage endpoint)
            if do_probe and secrets.get("DEEPL_KEY"):
                try:
                    auth = secrets["DEEPL_KEY"]
                    base = "https://api-free.deepl.com" if auth.endswith(":fx") else "https://api.deepl.com"
                    pstatus, pbody = http_get(
                        f"{base}/v2/usage",
                        timeout=8,
                        headers={"Authorization": f"DeepL-Auth-Key {auth}"},
                    )
                    try:
                        pj = json.loads(pbody)
                    except Exception:
                        pj = None
                    for s in services:
                        if s["service"] == "deepl":
                            s["probe"] = {"http": pstatus, "body": pj}
                            break
                except Exception as e:
                    for s in services:
                        if s["service"] == "deepl":
                            s["probe"] = {"error": str(e)}
                            break

            # Active agent runs (claude-bridge equivalent)
            try:
                runs = agent_runs.list_runs()
                running = [r for r in runs if r.get("status") == "running"]
                agent_info = {
                    "configured": True,
                    "running": len(running),
                    "total": len(runs),
                    "labels": [r.get("label") for r in running][:5],
                }
            except Exception as e:
                agent_info = {"configured": False, "error": str(e)}

            return self._send_json(200, {
                "now": now,
                "secrets_path": str(WORKSPACE_SECRETS_PATH) + " (canonical) + " + str(SECRETS_PATH),
                "services": services,
                "agent_runs": agent_info,
            })
        except Exception as e:
            return self._send_json(500, {"error": str(e)})

    def _handle_api(self):
        try:
            path = urllib.parse.urlparse(self.path).path
            q = self._params()
            secrets = load_secrets()

            if path == "/api/flights":
                serp = secrets.get("SERPAPI_KEY")
                if not serp:
                    return self._send_json(400, {"error": "SERPAPI_KEY not set"})
                params = {
                    "engine": "google_flights",
                    "departure_id": q.get("origin", [""])[0],
                    "arrival_id": q.get("destination", [""])[0],
                    "outbound_date": q.get("depart", [""])[0],
                    "return_date": q.get("return", [""])[0],
                    "adults": q.get("pax", ["4"])[0],
                    "currency": q.get("currency", ["INR"])[0],
                    "api_key": serp,
                }
                ages = q.get("kidAges", [""])[0]
                if ages:
                    params["children"] = q.get("kids", ["0"])[0]
                    params["children_ages"] = ages
                url = "https://serpapi.com/search.json?" + urllib.parse.urlencode(params)
                status, body = serpapi_get(url)
                return self._send_json(status, body)

            if path == "/api/hotels":
                serp = secrets.get("SERPAPI_KEY")
                if not serp:
                    return self._send_json(400, {"error": "SERPAPI_KEY not set"})
                kid_ages = q.get("kidAges", ["6,9"])[0]
                params = {
                    "engine": "google_hotels",
                    "q": "hotels in " + q.get("dest", ["Bangalore"])[0],
                    "check_in_date": q.get("checkin", [""])[0],
                    "check_out_date": q.get("checkout", [""])[0],
                    "adults": q.get("adults", ["2"])[0],
                    "children": q.get("kids", ["2"])[0],
                    "children_ages": kid_ages,
                    "currency": q.get("currency", ["INR"])[0],
                    "api_key": serp,
                }
                hotel_class = q.get("class", [""])[0]
                if hotel_class:
                    params["hotel_class"] = hotel_class
                url = "https://serpapi.com/search.json?" + urllib.parse.urlencode(params)
                status, body = serpapi_get(url)
                # SerpAPI free tier exhausts quickly — when it hits 429 (quota),
                # fall back to LiteAPI and reshape the response so the frontend
                # is unaware. Same behavior on 5xx so a transient SerpAPI outage
                # doesn't blank the cards.
                if status == 429 or status >= 500:
                    fb_status, fb_body = liteapi_hotels_as_serpapi(
                        secrets,
                        dest=q.get("dest", [""])[0],
                        checkin=q.get("checkin", [""])[0],
                        checkout=q.get("checkout", [""])[0],
                        adults=q.get("adults", ["2"])[0],
                        kids=q.get("kids", ["2"])[0],
                        kid_ages=q.get("kidAges", ["6,9"])[0],
                        hotel_class=hotel_class,
                    )
                    if fb_status == 200 and fb_body:
                        return self._send_json(200, fb_body)
                return self._send_json(status, body)

            if path == "/api/local":
                serp = secrets.get("SERPAPI_KEY")
                if not serp:
                    return self._send_json(400, {"error": "SERPAPI_KEY not set"})
                params = {
                    "engine": "google_local",
                    "q": q.get("q", ["restaurants"])[0],
                    "location": q.get("location", ["Bangalore, India"])[0],
                    "api_key": serp,
                }
                url = "https://serpapi.com/search.json?" + urllib.parse.urlencode(params)
                status, body = serpapi_get(url)
                return self._send_json(status, body)

            if path == "/api/holidays":
                cal = secrets.get("CALENDARIFIC_KEY")
                if not cal:
                    return self._send_json(400, {"error": "CALENDARIFIC_KEY not set"})
                params = {
                    "api_key": cal,
                    "country": q.get("country", ["IN"])[0],
                    "year": q.get("year", ["2026"])[0],
                }
                location = q.get("location", [""])[0]
                if location:
                    params["location"] = location
                url = "https://calendarific.com/api/v2/holidays?" + urllib.parse.urlencode(params)
                status, body = http_get(url)
                if status == 429 or status == 403:
                    record_usage("calendarific", "quota", f"HTTP {status}")
                elif status < 300:
                    record_usage("calendarific", "ok")
                else:
                    record_usage("calendarific", "error", f"HTTP {status}")
                return self._send_json(status, body)

            if path == "/api/amadeus/flights":
                cid = secrets.get("AMADEUS_CLIENT_ID")
                csec = secrets.get("AMADEUS_CLIENT_SECRET")
                if not (cid and csec):
                    return self._send_json(400, {"error": "AMADEUS credentials not set"})
                tok = amadeus_token(cid, csec)
                if not tok:
                    return self._send_json(502, {"error": "amadeus auth failed"})
                params = {
                    "originLocationCode": q.get("origin", [""])[0],
                    "destinationLocationCode": q.get("dest", [""])[0],
                    "departureDate": q.get("depart", [""])[0],
                    "adults": q.get("adults", ["2"])[0],
                    "currencyCode": q.get("currency", ["INR"])[0],
                    "max": q.get("max", ["5"])[0],
                }
                if q.get("return", [""])[0]:
                    params["returnDate"] = q["return"][0]
                if q.get("children", [""])[0]:
                    params["children"] = q["children"][0]
                if q.get("cabin", [""])[0]:
                    params["travelClass"] = q["cabin"][0]
                url = "https://test.api.amadeus.com/v2/shopping/flight-offers?" + urllib.parse.urlencode(params)
                status, body = http_get(url, headers={"Authorization": f"Bearer {tok}"})
                if status == 429:
                    record_usage("amadeus", "quota", "HTTP 429")
                elif status < 300:
                    record_usage("amadeus", "ok")
                else:
                    record_usage("amadeus", "error", f"HTTP {status}")
                return self._send_json(status, body)

            if path == "/api/amadeus/hotels":
                cid = secrets.get("AMADEUS_CLIENT_ID")
                csec = secrets.get("AMADEUS_CLIENT_SECRET")
                if not (cid and csec):
                    return self._send_json(400, {"error": "AMADEUS credentials not set"})
                tok = amadeus_token(cid, csec)
                if not tok:
                    return self._send_json(502, {"error": "amadeus auth failed"})
                list_params = {"cityCode": q.get("city", [""])[0]}
                if q.get("chain", [""])[0]:
                    list_params["chainCodes"] = q["chain"][0]
                if q.get("rating", [""])[0]:
                    list_params["ratings"] = q["rating"][0]
                list_url = (
                    "https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?"
                    + urllib.parse.urlencode(list_params)
                )
                lstatus, lbody = http_get(list_url, headers={"Authorization": f"Bearer {tok}"})
                if lstatus >= 300:
                    return self._send_json(lstatus, lbody)
                try:
                    listing = json.loads(lbody)
                    hotel_ids = [h["hotelId"] for h in listing.get("data", [])[:20]]
                except Exception as e:
                    return self._send_json(502, {"error": f"parse listing: {e}"})
                if not hotel_ids:
                    return self._send_json(200, {"data": []})
                offer_params = {
                    "hotelIds": ",".join(hotel_ids),
                    "checkInDate": q.get("checkin", [""])[0],
                    "checkOutDate": q.get("checkout", [""])[0],
                    "adults": q.get("adults", ["2"])[0],
                    "roomQuantity": q.get("rooms", ["1"])[0],
                    "currency": q.get("currency", ["INR"])[0],
                    "bestRateOnly": "true",
                }
                offer_url = (
                    "https://test.api.amadeus.com/v3/shopping/hotel-offers?"
                    + urllib.parse.urlencode(offer_params)
                )
                status, body = http_get(offer_url, headers={"Authorization": f"Bearer {tok}"})
                if status == 429:
                    record_usage("amadeus", "quota", "HTTP 429")
                elif status < 300:
                    record_usage("amadeus", "ok")
                else:
                    record_usage("amadeus", "error", f"HTTP {status}")
                return self._send_json(status, body)

            if path == "/api/foursquare/places":
                fsq = secrets.get("FOURSQUARE_KEY")
                if not fsq:
                    return self._send_json(400, {"error": "FOURSQUARE_KEY not set"})
                # Migrated 2025: v3 sunset, new host is places-api.foursquare.com.
                # Auth = Bearer + X-Places-Api-Version (YYYY-MM-DD).
                params = {
                    "query": q.get("query", [""])[0],
                    "limit": q.get("limit", ["10"])[0],
                }
                if q.get("ll", [""])[0]:
                    params["ll"] = q["ll"][0]
                    if q.get("radius", [""])[0]:
                        params["radius"] = q["radius"][0]
                else:
                    params["near"] = q.get("near", ["Bangalore, India"])[0]
                if q.get("category", [""])[0]:
                    params["fsq_category_ids"] = q["category"][0]
                if q.get("kid_friendly", [""])[0] in ("1", "true", "yes"):
                    params["exclude_fsq_category_ids"] = "4bf58dd8d48988d116941735,4bf58dd8d48988d11e941735"
                url = "https://places-api.foursquare.com/places/search?" + urllib.parse.urlencode(params)
                status, body = http_get(url, headers={
                    "Authorization": f"Bearer {fsq}",
                    "X-Places-Api-Version": "2025-06-17",
                    "accept": "application/json",
                })
                if status == 429:
                    record_usage("foursquare", "quota", "HTTP 429")
                elif status < 300:
                    record_usage("foursquare", "ok")
                else:
                    record_usage("foursquare", "error", f"HTTP {status}")
                return self._send_json(status, body)

            if path == "/api/liteapi/hotels":
                lite = secrets.get("LITEAPI_KEY")
                if not lite:
                    return self._send_json(400, {"error": "LITEAPI_KEY not set"})
                country = q.get("country", [""])[0]
                city = q.get("city", [""])[0]
                checkin = q.get("checkin", [""])[0]
                checkout = q.get("checkout", [""])[0]
                if not (country and city and checkin and checkout):
                    return self._send_json(400, {"error": "country, city, checkin, checkout are required"})
                # Step 1: list hotels in the city (cheap, no rates)
                list_params = {"countryCode": country, "cityName": city, "limit": q.get("limit", ["20"])[0]}
                if q.get("rating", [""])[0]:
                    list_params["minRating"] = q["rating"][0]
                list_url = "https://api.liteapi.travel/v3.0/data/hotels?" + urllib.parse.urlencode(list_params)
                lstatus, lbody = http_get(list_url, headers={"X-API-Key": lite, "accept": "application/json"})
                if lstatus == 401 or lstatus == 403:
                    record_usage("liteapi", "error", f"HTTP {lstatus} (auth)")
                    return self._send_json(lstatus, lbody)
                if lstatus == 429:
                    record_usage("liteapi", "quota", "HTTP 429")
                    return self._send_json(lstatus, lbody)
                if lstatus >= 300:
                    record_usage("liteapi", "error", f"HTTP {lstatus}")
                    return self._send_json(lstatus, lbody)
                try:
                    hotels = json.loads(lbody).get("data", [])
                    hotel_ids = [h["id"] for h in hotels[:int(q.get("limit", ["20"])[0])] if h.get("id")]
                except Exception as e:
                    record_usage("liteapi", "error", f"parse listing: {e}")
                    return self._send_json(502, {"error": f"parse listing: {e}"})
                if not hotel_ids:
                    record_usage("liteapi", "ok")
                    return self._send_json(200, {"data": [], "note": "no hotels found in city"})
                # Step 2: fetch live rates for those hotels
                adults = int(q.get("adults", ["2"])[0])
                kids_raw = q.get("kidAges", [""])[0]
                children = [int(a) for a in kids_raw.split(",") if a.strip().isdigit()] if kids_raw else []
                rate_body = {
                    "hotelIds": hotel_ids,
                    "checkin": checkin,
                    "checkout": checkout,
                    "currency": q.get("currency", ["INR"])[0],
                    "guestNationality": q.get("nationality", ["IN"])[0],
                    "occupancies": [{"adults": adults, "children": children}],
                }
                rates_req = urllib.request.Request(
                    "https://api.liteapi.travel/v3.0/hotels/rates",
                    data=json.dumps(rate_body).encode(),
                    headers={
                        "X-API-Key": lite,
                        "Content-Type": "application/json",
                        "accept": "application/json",
                    },
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(rates_req, timeout=30) as resp:
                        rstatus, rbody = resp.status, resp.read()
                except urllib.error.HTTPError as e:
                    rstatus, rbody = e.code, e.read()
                except Exception as e:
                    record_usage("liteapi", "error", str(e))
                    return self._send_json(502, {"error": str(e)})
                if rstatus == 429:
                    record_usage("liteapi", "quota", "HTTP 429")
                elif rstatus < 300:
                    record_usage("liteapi", "ok")
                else:
                    record_usage("liteapi", "error", f"HTTP {rstatus}")
                # Combine: attach hotel metadata to each rate result for the client
                try:
                    rates = json.loads(rbody)
                    by_id = {h["id"]: h for h in hotels if h.get("id")}
                    for offer in (rates.get("data") or []):
                        meta = by_id.get(offer.get("hotelId"))
                        if meta:
                            offer["hotel"] = {
                                "name": meta.get("name"),
                                "stars": meta.get("stars"),
                                "rating": meta.get("rating"),
                                "address": meta.get("address"),
                                "city": meta.get("city"),
                                "country": meta.get("country"),
                                "thumbnail": meta.get("thumbnail") or meta.get("main_photo"),
                                "lat": meta.get("latitude"),
                                "lng": meta.get("longitude"),
                            }
                    return self._send_json(rstatus, rates)
                except Exception:
                    return self._send_json(rstatus, rbody)

            if path == "/api/weather":
                params = {
                    "latitude": q.get("lat", [""])[0],
                    "longitude": q.get("lon", [""])[0],
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
                    "timezone": "auto",
                    "start_date": q.get("start", [""])[0],
                    "end_date": q.get("end", [""])[0],
                }
                forecast_url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)
                status, body = http_get(forecast_url)
                if status < 300:
                    record_usage("open-meteo", "ok")
                else:
                    record_usage("open-meteo", "error", f"HTTP {status}")
                if q.get("aqi", [""])[0] not in ("1", "true", "yes"):
                    return self._send_json(status, body)
                # merge AQI if requested + key present
                owm = secrets.get("OPENWEATHER_KEY")
                try:
                    forecast = json.loads(body)
                except Exception:
                    forecast = {}
                if owm and isinstance(forecast, dict):
                    aqi_url = (
                        "https://api.openweathermap.org/data/2.5/air_pollution/forecast?"
                        + urllib.parse.urlencode({"lat": q["lat"][0], "lon": q["lon"][0], "appid": owm})
                    )
                    astatus, abody = http_get(aqi_url)
                    if astatus == 429 or astatus == 401:
                        record_usage("openweather", "quota", f"HTTP {astatus}")
                    elif astatus < 300:
                        record_usage("openweather", "ok")
                    else:
                        record_usage("openweather", "error", f"HTTP {astatus}")
                    if astatus < 300:
                        try:
                            aqi_data = json.loads(abody)
                            aqis = [
                                i.get("main", {}).get("aqi")
                                for i in aqi_data.get("list", [])
                                if i.get("main", {}).get("aqi")
                            ]
                            if aqis:
                                forecast["aqi_avg"] = round(sum(aqis) / len(aqis), 1)
                        except Exception:
                            pass
                return self._send_json(status, forecast)

            if path == "/api/influencer-content":
                if not INFLUENCER_CORPUS.exists():
                    return self._send_json(200, {
                        "generated_at": None,
                        "items": [],
                        "stats": {"total": 0},
                        "note": "Run scripts/influencers/corpus_builder.py to populate.",
                    })
                try:
                    body = INFLUENCER_CORPUS.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    # cache for an hour — cron refreshes weekly anyway
                    self.send_header("Cache-Control", "public, max-age=3600")
                    self.end_headers()
                    self.wfile.write(body)
                    return
                except Exception as e:
                    return self._send_json(500, {"error": str(e)})

            if path == "/api/youtube/transcript":
                video_id = q.get("video_id", [""])[0]
                if not video_id:
                    return self._send_json(400, {"error": "video_id required"})
                cmd = ["python3", str(SCRIPTS_API / "youtube_transcript.py"),
                       "--video-id", video_id]
                if q.get("whisper", [""])[0] in ("1", "true", "yes"):
                    cmd.append("--whisper-fallback")
                try:
                    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
                    body = proc.stdout.encode() if proc.stdout else b'{}'
                    if proc.returncode == 0 and proc.stdout.strip():
                        record_usage("youtube_transcript", "ok")
                    else:
                        record_usage("youtube_transcript", "error",
                                     proc.stderr.strip()[:200] if proc.stderr else "no output")
                    return self._send_json(200, body)
                except Exception as e:
                    record_usage("youtube_transcript", "error", str(e))
                    return self._send_json(500, {"error": str(e)})

            if path == "/api/tripadvisor":
                query = q.get("query", [""])[0]
                ttype = q.get("type", ["hotel"])[0]
                if not query:
                    return self._send_json(400, {"error": "query required"})
                cmd = ["python3", str(SCRIPTS_API / "tripadvisor.py"),
                       "--query", query, "--type", ttype]
                # Forward optional location filters (added for guardrails).
                lat = q.get("lat", [""])[0]
                lon = q.get("lon", [""])[0]
                if lat and lon:
                    cmd += ["--lat", lat, "--lon", lon]
                if q.get("radius_km", [""])[0]:
                    cmd += ["--radius-km", q["radius_km"][0]]
                if q.get("country", [""])[0]:
                    cmd += ["--require-country", q["country"][0]]
                if q.get("city", [""])[0]:
                    cmd += ["--require-city", q["city"][0]]
                try:
                    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                    if proc.returncode != 0 and not proc.stdout.strip():
                        stderr_low = (proc.stderr or "").lower()
                        is_quota = "429" in stderr_low or "rate" in stderr_low or "limit" in stderr_low
                        record_usage("tripadvisor", "quota" if is_quota else "error",
                                     proc.stderr.strip()[:200])
                        return self._send_json(503, {
                            "error": "tripadvisor unavailable (no key or upstream error)",
                            "stderr": proc.stderr.strip()[:300],
                        })
                    record_usage("tripadvisor", "ok")
                    body = proc.stdout.encode() if proc.stdout else b'[]'
                    return self._send_json(200, body)
                except Exception as e:
                    record_usage("tripadvisor", "error", str(e))
                    return self._send_json(500, {"error": str(e)})

            return self._send_json(404, {"error": "unknown route"})

        except Exception as e:
            return self._send_json(500, {"error": str(e)})

    # --- Agent runs: durable Claude execution with SSE tail -----------------

    def _handle_agent_post(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b"{}"
            data = json.loads(body or b"{}")
            path = urllib.parse.urlparse(self.path).path
        except Exception as e:
            return self._send_json(400, {"error": f"invalid request: {e}"})

        if path == "/api/agent/runs":
            prompt = (data.get("prompt") or "").strip()
            if not prompt:
                return self._send_json(400, {"error": "prompt is required"})
            try:
                started = agent_runs.start_run(
                    prompt,
                    session_id=data.get("session_id") or data.get("sessionId"),
                    system_prompt=data.get("system_prompt") or data.get("systemPrompt"),
                    model=data.get("model"),
                    tools=data.get("tools", "edit"),
                    add_dirs=data.get("add_dirs") or data.get("addDirs"),
                    label=data.get("label"),
                )
                return self._send_json(200, started)
            except Exception as e:
                return self._send_json(500, {"error": str(e)})

        if path.startswith("/api/agent/runs/") and path.endswith("/cancel"):
            run_id = path.split("/")[4]
            return self._send_json(200, agent_runs.cancel_run(run_id))

        return self._send_json(404, {"error": "unknown agent route"})

    def _handle_agent_get(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/agent/runs":
            return self._send_json(200, agent_runs.list_runs())

        parts = path.split("/")
        # /api/agent/runs/<id>/<action>
        if len(parts) >= 5 and parts[1] == "api" and parts[2] == "agent" and parts[3] == "runs":
            run_id = parts[4]
            action = parts[5] if len(parts) >= 6 else "meta"
            if action == "stream":
                return self._stream_run(run_id)
            if action == "log":
                return self._serve_log(run_id)
            if action == "meta":
                meta = agent_runs.get_meta(run_id)
                if not meta:
                    return self._send_json(404, {"error": "unknown run"})
                return self._send_json(200, meta)
        return self._send_json(404, {"error": "unknown agent route"})

    def _serve_log(self, run_id):
        p = agent_runs.frames_path(run_id)
        if not p.exists():
            return self._send_json(404, {"error": "unknown run"})
        try:
            data = p.read_bytes()
        except Exception as e:
            return self._send_json(500, {"error": str(e)})
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _stream_run(self, run_id):
        meta = agent_runs.get_meta(run_id)
        if not meta:
            return self._send_json(404, {"error": "unknown run"})

        # Resume support: Last-Event-ID header or ?since=<frame_index>
        since = 0
        last_event_id = self.headers.get("Last-Event-ID")
        if last_event_id:
            try:
                since = int(last_event_id)
            except ValueError:
                since = 0
        else:
            q = self._params()
            try:
                since = int(q.get("since", ["0"])[0])
            except ValueError:
                since = 0

        # Emit SSE
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        try:
            self._tail_frames(run_id, since)
        except (BrokenPipeError, ConnectionResetError):
            return  # client disconnected; tailing stops

    def _tail_frames(self, run_id, since):
        """Tail frames.jsonl. Each line is one SSE event with id=<frame_index>.
        Loop ends when the run reaches a terminal status AND we've drained the file."""
        frames_path = agent_runs.frames_path(run_id)
        idx = 0
        last_send = time.time()

        # Open in text mode so we can read line-by-line as it grows.
        with open(frames_path, "r", encoding="utf-8", errors="replace") as f:
            while True:
                line = f.readline()
                if line:
                    if idx >= since:
                        try:
                            payload = line.strip()
                            self.wfile.write(f"id: {idx}\n".encode())
                            self.wfile.write(f"data: {payload}\n\n".encode())
                            self.wfile.flush()
                            last_send = time.time()
                        except (BrokenPipeError, ConnectionResetError):
                            return
                    idx += 1
                    continue

                # No new line — emit a comment heartbeat every 15s so proxies don't time out
                meta = agent_runs.get_meta(run_id) or {}
                status = meta.get("status")
                if status in ("done", "crashed", "cancelled"):
                    # Drain a tiny bit more, then close.
                    tail = f.readline()
                    if tail:
                        if idx >= since:
                            self.wfile.write(f"id: {idx}\n".encode())
                            self.wfile.write(f"data: {tail.strip()}\n\n".encode())
                            self.wfile.flush()
                        idx += 1
                        continue
                    try:
                        self.wfile.write(b": end\n\n")
                        self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError):
                        pass
                    return

                if time.time() - last_send > 15:
                    try:
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
                        last_send = time.time()
                    except (BrokenPipeError, ConnectionResetError):
                        return
                time.sleep(0.25)


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


class ThreadingHTTPServer(socketserver.ThreadingMixIn, ReusableTCPServer):
    daemon_threads = True


if __name__ == "__main__":
    agent_runs.startup()
    print(f"[proxy] serving {ROOT}")
    print(f"[proxy] http://localhost:{PORT}/")
    print(f"[proxy] api  http://localhost:{PORT}/api/{{flights,hotels,local,holidays}}")
    print(f"[proxy]      http://localhost:{PORT}/api/{{amadeus/flights,amadeus/hotels,foursquare/places,weather}}")
    print(f"[proxy]      http://localhost:{PORT}/api/{{influencer-content,youtube/transcript,tripadvisor}}")
    print(f"[proxy]      http://localhost:{PORT}/api/agent/runs (POST to start, GET /<id>/stream to tail)")
    with ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as httpd:
        httpd.serve_forever()
