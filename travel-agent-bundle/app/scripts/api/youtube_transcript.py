#!/usr/bin/env python3
"""YouTube video transcript → JSON on stdout.

Usage:
  youtube_transcript.py --video-id abc123 [--whisper-fallback]

Strategy:
  1. Try `youtube-transcript-api` (any available language).
  2. If empty AND --whisper-fallback: yt-dlp -x → mp3 → mlx-whisper (Apple Silicon GPU).
     Falls back to faster-whisper "small" CPU if mlx-whisper unavailable (non-Mac / non-ARM).
  3. Cache final result at .workspace/.influencer-cache/transcripts/{video_id}.json.

This script intentionally fails *soft* — missing libs result in stderr warnings
and a structured stub so callers can still proceed.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import eprint, print_json  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = ROOT / ".workspace" / ".influencer-cache" / "transcripts"
AUDIO_DIR = Path("/tmp/yt-audio")


def cached(video_id: str):
    f = CACHE_DIR / f"{video_id}.json"
    if f.exists():
        try:
            return json.loads(f.read_text())
        except Exception:
            return None
    return None


def write_cache(video_id: str, payload: dict):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / f"{video_id}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2))


def try_transcript_api(video_id: str):
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        eprint("youtube-transcript-api not installed — skipping captions; pip install youtube-transcript-api")
        return None
    try:
        api = YouTubeTranscriptApi()
        candidates = list(api.list(video_id))
        if not candidates:
            return None
        # Prefer manually-created over auto-generated; prefer English; fall back to any.
        chosen = None
        for t in candidates:
            if not t.is_generated and t.language_code.startswith("en"):
                chosen = t; break
        if chosen is None:
            for t in candidates:
                if t.language_code.startswith("en"):
                    chosen = t; break
        if chosen is None:
            for t in candidates:
                if not t.is_generated:
                    chosen = t; break
        if chosen is None:
            chosen = candidates[0]
        fetched = chosen.fetch()
        # FetchedTranscriptSnippet is an object with .text/.start/.duration (not dict).
        snippets = list(fetched)
        text = " ".join(s.text.replace("\n", " ") for s in snippets).strip()
        segments = [
            {"text": s.text, "start": s.start, "duration": s.duration}
            for s in snippets
        ]
        return {
            "video_id": video_id,
            "lang": chosen.language_code,
            "source": "captions",
            "is_generated": chosen.is_generated,
            "text": text,
            "segments": segments,
        }
    except Exception as e:
        eprint(f"caption fetch failed for {video_id}: {type(e).__name__}: {e}")
        return None


def _detect_whisper_engine():
    """Return ('mlx', module) or ('faster', module) or (None, None)."""
    try:
        import mlx_whisper  # type: ignore
        return ("mlx", mlx_whisper)
    except ImportError:
        pass
    try:
        from faster_whisper import WhisperModel  # type: ignore
        return ("faster", WhisperModel)
    except ImportError:
        pass
    return (None, None)


def _ytdlp_cmd():
    """Locate yt-dlp: try PATH, then user-pip default install dir, then `python3 -m yt_dlp`."""
    p = shutil.which("yt-dlp")
    if p:
        return [p]
    user_bin = Path.home() / "Library" / "Python" / "3.9" / "bin" / "yt-dlp"
    if user_bin.exists():
        return [str(user_bin)]
    try:
        import yt_dlp  # noqa: F401
        return [sys.executable, "-m", "yt_dlp"]
    except ImportError:
        return None


def try_whisper(video_id: str):
    ytdlp = _ytdlp_cmd()
    if not ytdlp:
        eprint("yt-dlp not installed — skipping whisper fallback; pip install yt-dlp")
        return None

    engine, mod = _detect_whisper_engine()
    if engine is None:
        eprint("no whisper engine installed — skipping; pip install mlx-whisper (Mac) or faster-whisper")
        return None

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    out_template = str(AUDIO_DIR / f"{video_id}.%(ext)s")
    url = f"https://www.youtube.com/watch?v={video_id}"
    cmd = [*ytdlp, "-x", "--audio-format", "mp3", "-o", out_template, "--no-playlist", url]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=300)
    except subprocess.CalledProcessError as e:
        eprint(f"yt-dlp failed for {video_id}: {e.stderr.decode(errors='ignore')[:300]}")
        return None
    except Exception as e:
        eprint(f"yt-dlp error: {e}")
        return None

    mp3 = AUDIO_DIR / f"{video_id}.mp3"
    if not mp3.exists():
        eprint(f"yt-dlp did not produce {mp3}")
        return None

    if engine == "mlx":
        eprint(f"whisper-transcribing {video_id} (mlx-whisper, Apple GPU)…")
        result = mod.transcribe(str(mp3), path_or_hf_repo="mlx-community/whisper-medium-mlx")
        segments = [
            {"start": s.get("start"), "end": s.get("end"), "text": s.get("text", "")}
            for s in result.get("segments", [])
        ]
        text = result.get("text", "").strip() or " ".join(s["text"].strip() for s in segments)
        lang = result.get("language")
    else:
        eprint(f"whisper-transcribing {video_id} (faster-whisper small, CPU)…")
        model = mod("small", device="cpu", compute_type="int8")
        segments_iter, info = model.transcribe(str(mp3), beam_size=1)
        segments = [{"start": seg.start, "end": seg.end, "text": seg.text} for seg in segments_iter]
        text = " ".join(s["text"].strip() for s in segments)
        lang = info.language

    try:
        mp3.unlink()
    except Exception:
        pass
    return {
        "video_id": video_id,
        "lang": lang,
        "source": f"whisper:{engine}",
        "is_generated": True,
        "text": text,
        "segments": segments,
    }


def main():
    p = argparse.ArgumentParser(description="YouTube transcript fetcher")
    p.add_argument("--video-id", required=True)
    p.add_argument("--whisper-fallback", action="store_true",
                   help="yt-dlp + faster-whisper if no captions available")
    p.add_argument("--no-cache", action="store_true")
    args = p.parse_args()

    if not args.no_cache:
        cached_data = cached(args.video_id)
        if cached_data:
            print_json(cached_data)
            return 0

    payload = try_transcript_api(args.video_id)
    if not payload and args.whisper_fallback:
        payload = try_whisper(args.video_id)

    if not payload:
        payload = {
            "video_id": args.video_id,
            "lang": None,
            "source": "none",
            "text": "",
            "segments": [],
            "error": "no captions and no whisper fallback (or both failed)",
        }
        eprint(payload["error"])

    write_cache(args.video_id, payload)
    print_json(payload)
    return 0 if payload.get("text") else 0  # always 0 — caller filters on .text


if __name__ == "__main__":
    sys.exit(main())
