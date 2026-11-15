#!/usr/bin/env python3
"""Translate text → English (offline-first, paid-fallback).

Usage:
  translate.py --text "Tokyo wa subarashii desu"
  translate.py --text-file /path/to/long.txt --to en
  translate.py --text "..." --from auto

Strategy:
  1. argos-translate (offline, free) — only if pkg + lang pair installed.
  2. DeepL Free (if DEEPL_KEY set, 500K chars/month).
  3. Otherwise: pass-through with lang_detected="?" and a stderr warning.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse as _u
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, http_json, load_secrets, post_form, print_json  # noqa: E402


def detect_lang(text: str) -> str:
    """Best-effort language detection. Returns ISO code or '?'."""
    try:
        from langdetect import detect
        return detect(text)
    except ImportError:
        eprint("langdetect not installed — defaulting to 'auto'; pip install langdetect")
        return "auto"
    except Exception as e:
        eprint(f"langdetect failed: {e}")
        return "?"


def try_argos(text: str, src: str, tgt: str) -> str | None:
    try:
        import argostranslate.translate as at
    except ImportError:
        return None
    try:
        installed = at.get_installed_languages()
        from_lang = next((l for l in installed if l.code == src), None)
        to_lang = next((l for l in installed if l.code == tgt), None)
        if not from_lang or not to_lang:
            eprint(f"argos pair {src}->{tgt} not installed")
            return None
        translation = from_lang.get_translation(to_lang)
        if not translation:
            return None
        return translation.translate(text)
    except Exception as e:
        eprint(f"argos failed: {e}")
        return None


def try_deepl(text: str, src: str, tgt: str, key: str) -> str | None:
    src_param = src.upper() if src not in ("auto", "?") else None
    body = {
        "text": text,
        "target_lang": tgt.upper(),
    }
    if src_param:
        body["source_lang"] = src_param
    # DeepL free uses api-free.deepl.com.
    url = "https://api-free.deepl.com/v2/translate"
    headers = {"Authorization": f"DeepL-Auth-Key {key}"}
    data = _u.urlencode(body).encode()
    import urllib.request
    req = urllib.request.Request(url, data=data, headers={**headers, "Content-Type": "application/x-www-form-urlencoded"})
    try:
        import urllib.error
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read())
        translations = payload.get("translations", [])
        if translations:
            return translations[0]["text"]
    except Exception as e:
        eprint(f"DeepL failed: {e}")
    return None


def main():
    p = argparse.ArgumentParser(description="Text translation, offline-first")
    p.add_argument("--text", help="text to translate")
    p.add_argument("--text-file", help="path to file containing text")
    p.add_argument("--from", dest="src", default="auto")
    p.add_argument("--to", dest="tgt", default="en")
    args = p.parse_args()

    if args.text_file:
        text = Path(args.text_file).read_text(encoding="utf-8")
    elif args.text:
        text = args.text
    else:
        eprint("--text or --text-file required")
        sys.exit(1)

    text = text.strip()
    if not text:
        print_json({"lang_detected": "?", "text_en": ""})
        return 0

    src = args.src
    if src == "auto":
        src = detect_lang(text)

    if src == args.tgt:
        print_json({"lang_detected": src, "text_en": text, "engine": "passthrough"})
        return 0

    # 1. argos
    out = try_argos(text, src, args.tgt) if src not in ("?", "auto") else None
    if out:
        print_json({"lang_detected": src, "text_en": out, "engine": "argos"})
        return 0

    # 2. DeepL
    secrets = load_secrets()
    deepl_key = secrets.get("DEEPL_KEY")
    if deepl_key:
        out = try_deepl(text, src, args.tgt, deepl_key)
        if out:
            print_json({"lang_detected": src, "text_en": out, "engine": "deepl"})
            return 0

    # 3. Pass-through fallback
    eprint(f"no translator available for {src}->{args.tgt}; passing through")
    print_json({"lang_detected": src, "text_en": text, "engine": "passthrough", "note": "untranslated"})
    return 0


if __name__ == "__main__":
    sys.exit(main())
