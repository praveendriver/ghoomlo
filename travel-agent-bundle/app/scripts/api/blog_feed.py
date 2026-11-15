#!/usr/bin/env python3
"""Blog RSS / Atom feed → normalized post bodies, JSON on stdout.

Usage:
  blog_feed.py --feed https://www.nomadicmatt.com/feed/ --since 2024-01-01 --max 30

Uses feedparser for entry metadata, trafilatura for full body extraction.
Hands non-English bodies to translate.py.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, print_json  # noqa: E402

THIS_DIR = Path(__file__).resolve().parent


def parse_since(s: str | None):
    if not s:
        return None
    try:
        dt = datetime.strptime(s, "%Y-%m-%d")
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def extract_body(url: str):
    try:
        import trafilatura
    except ImportError:
        eprint("trafilatura not installed — body will be feed summary only; pip install trafilatura")
        return None
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return None
        return trafilatura.extract(downloaded, include_comments=False, include_tables=False)
    except Exception as e:
        eprint(f"trafilatura failed for {url}: {e}")
        return None


def detect_lang(text: str) -> str:
    try:
        from langdetect import detect
        return detect(text[:2000])
    except Exception:
        return "?"


def translate_to_en(text: str, src: str) -> str:
    """Shell out to translate.py — keeps the pipeline modular."""
    if src == "en" or not text:
        return text
    try:
        result = subprocess.run(
            ["python3", str(THIS_DIR / "translate.py"), "--text", text[:4000], "--from", src, "--to", "en"],
            capture_output=True, timeout=120, text=True,
        )
        payload = json.loads(result.stdout or "{}")
        return payload.get("text_en") or text
    except Exception as e:
        eprint(f"translate shell-out failed: {e}")
        return text


def main():
    p = argparse.ArgumentParser(description="Blog RSS feed reader")
    p.add_argument("--feed", required=True)
    p.add_argument("--since", help="YYYY-MM-DD; drop older posts")
    p.add_argument("--max", type=int, default=20)
    p.add_argument("--no-translate", action="store_true", help="skip translate step")
    args = p.parse_args()

    try:
        import feedparser
    except ImportError:
        eprint("feedparser not installed; pip install feedparser")
        print_json([])
        return 0

    parsed = feedparser.parse(args.feed)
    if parsed.bozo and not parsed.entries:
        eprint(f"feed parse failed: {getattr(parsed, 'bozo_exception', '?')}")

    cutoff = parse_since(args.since)
    out = []
    for entry in parsed.entries[: args.max]:
        link = entry.get("link") or ""
        title = entry.get("title") or ""
        published_s = entry.get("published") or entry.get("updated") or ""
        # entries' parsed time
        ts = entry.get("published_parsed") or entry.get("updated_parsed")
        published_iso = None
        if ts:
            try:
                dt = datetime(*ts[:6], tzinfo=timezone.utc)
                published_iso = dt.isoformat()
                if cutoff and dt < cutoff:
                    continue
            except Exception:
                pass

        body = extract_body(link) or entry.get("summary") or ""
        lang = detect_lang(body) if body else "?"
        body_en = body if (args.no_translate or lang in ("en", "?")) else translate_to_en(body, lang)

        out.append({
            "url": link,
            "title": title,
            "published": published_iso or published_s,
            "lang": lang,
            "body_en": body_en[:8000],  # cap to keep JSON sane
            "summary": (entry.get("summary") or "")[:500],
        })

    print_json(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
