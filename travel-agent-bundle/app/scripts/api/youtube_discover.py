#!/usr/bin/env python3
"""YouTube channel discovery + recent uploads → JSON on stdout.

Usage:
  youtube_discover.py --handles @tanyakhanijow,@visa2explore --since 2024-01-01 --max 25

Resolves handles to channel IDs (cached), then lists recent uploads from each
channel's "uploads" playlist. Cheap: 1 unit/playlistItems.list call.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse as _u
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, http_json, load_secrets, print_json, require  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = ROOT / ".workspace" / ".influencer-cache"
CHANNEL_CACHE = CACHE_DIR / "channels.json"

API = "https://www.googleapis.com/youtube/v3"


def load_channel_cache():
    if CHANNEL_CACHE.exists():
        try:
            return json.loads(CHANNEL_CACHE.read_text())
        except Exception:
            return {}
    return {}


def save_channel_cache(cache):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CHANNEL_CACHE.write_text(json.dumps(cache, indent=2))


def resolve_handle(handle: str, key: str, cache: dict) -> dict | None:
    h = handle.lstrip("@")
    if h in cache:
        return cache[h]
    # The handle search via channels.list?forHandle works on v3.
    url = f"{API}/channels?" + _u.urlencode({
        "part": "id,snippet,contentDetails",
        "forHandle": h,
        "key": key,
    })
    data = http_json(url)
    if not data or not data.get("items"):
        eprint(f"could not resolve handle {handle}")
        return None
    item = data["items"][0]
    info = {
        "handle": handle,
        "channel_id": item["id"],
        "title": item["snippet"]["title"],
        "uploads_playlist": item["contentDetails"]["relatedPlaylists"]["uploads"],
    }
    cache[h] = info
    return info


def list_uploads(playlist_id: str, key: str, max_items: int, since_iso: str | None):
    items = []
    page_token = None
    while len(items) < max_items:
        params = {
            "part": "snippet,contentDetails",
            "playlistId": playlist_id,
            "maxResults": min(50, max_items - len(items)),
            "key": key,
        }
        if page_token:
            params["pageToken"] = page_token
        data = http_json(f"{API}/playlistItems?" + _u.urlencode(params))
        if not data:
            break
        for it in data.get("items", []):
            sn = it["snippet"]
            published = sn.get("publishedAt", "")
            if since_iso and published and published < since_iso:
                continue
            video_id = it["contentDetails"]["videoId"]
            items.append({
                "video_id": video_id,
                "title": sn.get("title"),
                "published": published,
                "channel": sn.get("channelTitle"),
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "thumbnail": (sn.get("thumbnails", {}).get("medium") or {}).get("url"),
            })
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return items


def main():
    p = argparse.ArgumentParser(description="YouTube channel uploads discovery")
    p.add_argument("--handles", required=True, help="comma-separated, e.g. @tanyakhanijow,@visa2explore")
    p.add_argument("--since", help="ISO date (YYYY-MM-DD) — drop older uploads")
    p.add_argument("--max", type=int, default=25, help="per channel")
    args = p.parse_args()

    secrets = load_secrets()
    (key,) = require(secrets, "YOUTUBE_API_KEY")

    since_iso = None
    if args.since:
        try:
            since_iso = datetime.strptime(args.since, "%Y-%m-%d").isoformat() + "Z"
        except ValueError:
            eprint(f"bad --since: {args.since}")
            sys.exit(1)

    cache = load_channel_cache()
    out = []
    for handle in [h.strip() for h in args.handles.split(",") if h.strip()]:
        info = resolve_handle(handle, key, cache)
        if not info:
            continue
        uploads = list_uploads(info["uploads_playlist"], key, args.max, since_iso)
        for u in uploads:
            u["creator_handle"] = info["handle"]
            u["channel_id"] = info["channel_id"]
        out.extend(uploads)
    save_channel_cache(cache)
    print_json(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
