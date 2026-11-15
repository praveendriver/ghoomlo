"""Shared helpers for travel-agent API CLIs.

Reads keys from `.workspace/secrets.local.md` (single source of truth for the
Claude Code skills). The browser proxy (`server/proxy.py`) reads the same keys
from `trips/_shared/data/secrets.json` — both files are gitignored.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional, Tuple, Union

ROOT = Path(__file__).resolve().parents[2]
SECRETS_PATH = ROOT / ".workspace" / "secrets.local.md"

_KV_RE = re.compile(r"^([A-Z][A-Z0-9_]*)=(.*)$")


def load_secrets() -> dict:
    if not SECRETS_PATH.exists():
        return {}
    out = {}
    for raw in SECRETS_PATH.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("```"):
            continue
        m = _KV_RE.match(line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if val:
            out[key] = val
    return out


def eprint(msg: str) -> None:
    sys.stderr.write(f"[api] {msg}\n")
    sys.stderr.flush()


def http_json(
    url,
    headers=None,
    data=None,
    method=None,
    timeout=30,
):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            if not body:
                return None
            return json.loads(body)
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read())
        except Exception:
            err_body = {"status": e.code}
        eprint(f"HTTP {e.code} from {url.split('?', 1)[0]}: {json.dumps(err_body)[:200]}")
        return None
    except Exception as e:
        eprint(f"request failed: {type(e).__name__}: {e}")
        return None


def post_form(url, form, headers=None):
    body = urllib.parse.urlencode(form).encode()
    h = {"Content-Type": "application/x-www-form-urlencoded"}
    if headers:
        h.update(headers)
    return http_json(url, headers=h, data=body, method="POST")


def require(secrets, *names):
    missing = [n for n in names if not secrets.get(n)]
    if missing:
        eprint(f"missing required keys: {', '.join(missing)} (set in {SECRETS_PATH})")
        sys.exit(1)
    return tuple(secrets[n] for n in names)


def print_json(obj) -> None:
    json.dump(obj, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    s = load_secrets()
    if not s:
        eprint(f"no keys loaded from {SECRETS_PATH}")
        sys.exit(1)
    print("loaded:", ", ".join(sorted(s.keys())))
