"""
Durable Claude agent runs.

Each run is a directory under <project>/.workspace/.agent-runs/<run_id>/ with:
  meta.json      run metadata (status, pid, sessionId, label, started_at, ...)
  request.json   the original POST body (replay/audit)
  raw.jsonl      claude CLI stdout, written directly by claude (proxy not in pipe)
  stderr.log     claude CLI stderr
  frames.jsonl   normalized frames the browser tails (one JSON object per line)

Design goals:
  - Spawn `claude -p` detached from the proxy. Proxy can restart, crash, or be
    killed; the run keeps going.
  - Browser tails frames.jsonl over SSE with Last-Event-ID resume support.
  - Heartbeat every 30s when claude is quiet, so the UI never goes dark.
  - On proxy startup: scan for running runs, reattach JournalWriters, mark
    dead-pid runs as crashed.
  - 30-day retention sweep on startup.
  - No output cap — disk grows as needed.

Browser-facing frame shapes (one per line in frames.jsonl):
  {"type":"system",      "subtype":"init", ...}
  {"type":"chunk",       "text":"..."}
  {"type":"tool_use",    "name":"...", "input":{...}}
  {"type":"tool_result", "tool_use_id":"...", "ok":true}
  {"type":"result",      "usage":{...}, "stoppedReason":"end_turn"}
  {"type":"heartbeat",   "elapsed_ms":N, "phase":"thinking" | "<tool name>"}
  {"type":"done",        "exitCode":N}
  {"type":"crashed",     "reason":"pid gone, no done frame"}
  {"type":"error",       "message":"..."}
"""
from __future__ import annotations

import json
import os
import signal
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

# --- Configuration -----------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RUNS_ROOT = PROJECT_ROOT / ".workspace" / ".agent-runs"
RETENTION_DAYS = 30
HEARTBEAT_INTERVAL_S = 30
TAIL_POLL_INTERVAL_S = 0.25
QUIET_THRESHOLD_S = 30  # if no new frames for this long, emit heartbeat


# --- Run dir helpers ---------------------------------------------------------

def _run_dir(run_id: str) -> Path:
    return RUNS_ROOT / run_id


def _read_meta(run_id: str) -> dict | None:
    p = _run_dir(run_id) / "meta.json"
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def _write_meta(run_id: str, meta: dict) -> None:
    p = _run_dir(run_id) / "meta.json"
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(meta, indent=2))
    tmp.replace(p)


def _append_frame(run_id: str, frame: dict) -> None:
    p = _run_dir(run_id) / "frames.jsonl"
    with open(p, "a", encoding="utf-8") as f:
        f.write(json.dumps(frame) + "\n")


def _pid_alive(pid: int) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        # exists but not ours — treat as alive
        return True


# --- Frame normalization (claude CLI stdout → browser frames) ----------------

def _normalize_event(event: dict) -> list[dict]:
    """Map a single claude-cli stream-json event to zero or more browser frames."""
    et = event.get("type")
    out: list[dict] = []
    if et == "assistant":
        for block in event.get("message", {}).get("content", []) or []:
            bt = block.get("type")
            if bt == "text" and block.get("text"):
                out.append({"type": "chunk", "text": block["text"]})
            elif bt == "tool_use":
                out.append({
                    "type": "tool_use",
                    "name": block.get("name"),
                    "tool_use_id": block.get("id"),
                    "input": block.get("input"),
                })
    elif et == "user":
        for block in event.get("message", {}).get("content", []) or []:
            if block.get("type") == "tool_result":
                out.append({
                    "type": "tool_result",
                    "tool_use_id": block.get("tool_use_id"),
                    "ok": not block.get("is_error"),
                })
    elif et == "result":
        out.append({
            "type": "result",
            "usage": event.get("usage"),
            "stoppedReason": event.get("stop_reason"),
            "durationMs": event.get("duration_ms"),
        })
    elif et == "system":
        out.append({"type": "system", "subtype": event.get("subtype"), "info": event})
    else:
        out.append({"type": "raw", "event": event})
    return out


# --- JournalWriter: tails raw.jsonl, writes frames.jsonl, emits heartbeats ---

class JournalWriter(threading.Thread):
    def __init__(self, run_id: str, pid: int):
        super().__init__(name=f"journal-{run_id[:8]}", daemon=True)
        self.run_id = run_id
        self.pid = pid
        self.stop_requested = threading.Event()

    def run(self):
        run_dir = _run_dir(self.run_id)
        raw_path = run_dir / "raw.jsonl"
        # Wait briefly for the file to appear (spawn may be in-flight)
        for _ in range(40):  # up to 10s
            if raw_path.exists():
                break
            time.sleep(0.25)

        if not raw_path.exists():
            _append_frame(self.run_id, {
                "type": "error",
                "message": "raw.jsonl never appeared — spawn likely failed",
            })
            self._finalize_done(exit_code=-1, crashed=True, reason="spawn_failed")
            return

        last_activity = time.time()
        started_at = time.time()
        buf = ""
        last_phase = "starting"

        with open(raw_path, "r", encoding="utf-8", errors="replace") as f:
            while not self.stop_requested.is_set():
                chunk = f.read()
                if chunk:
                    buf += chunk
                    while "\n" in buf:
                        line, buf = buf.split("\n", 1)
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        frames = _normalize_event(event)
                        for fr in frames:
                            _append_frame(self.run_id, fr)
                            if fr["type"] == "tool_use":
                                last_phase = fr.get("name") or "tool"
                            elif fr["type"] == "chunk":
                                last_phase = "responding"
                            elif fr["type"] == "result":
                                last_phase = "wrapping up"
                        last_activity = time.time()
                    continue

                # No new bytes — check liveness, emit heartbeat if quiet
                now = time.time()
                if now - last_activity > QUIET_THRESHOLD_S:
                    _append_frame(self.run_id, {
                        "type": "heartbeat",
                        "elapsed_ms": int((now - started_at) * 1000),
                        "phase": last_phase,
                    })
                    last_activity = now

                if not _pid_alive(self.pid):
                    # Final drain — read anything left after pid death
                    tail = f.read()
                    if tail:
                        buf += tail
                        while "\n" in buf:
                            line, buf = buf.split("\n", 1)
                            line = line.strip()
                            if not line:
                                continue
                            try:
                                event = json.loads(line)
                            except json.JSONDecodeError:
                                continue
                            for fr in _normalize_event(event):
                                _append_frame(self.run_id, fr)

                    self._finalize_from_meta()
                    return

                time.sleep(TAIL_POLL_INTERVAL_S)

    def _finalize_from_meta(self):
        meta = _read_meta(self.run_id) or {}
        # If we already saw a 'result' frame from claude, we have a clean exit.
        # Otherwise it died without finishing — mark crashed.
        frames_path = _run_dir(self.run_id) / "frames.jsonl"
        saw_result = False
        try:
            with open(frames_path, "r", encoding="utf-8") as f:
                for line in f:
                    try:
                        if json.loads(line).get("type") == "result":
                            saw_result = True
                    except Exception:
                        continue
        except Exception:
            pass

        if saw_result:
            _append_frame(self.run_id, {"type": "done", "exitCode": 0})
            meta["status"] = "done"
        else:
            _append_frame(self.run_id, {
                "type": "crashed",
                "reason": "process exited without final result",
            })
            meta["status"] = "crashed"
        meta["ended_at"] = time.time()
        _write_meta(self.run_id, meta)

    def _finalize_done(self, exit_code: int, crashed: bool, reason: str):
        meta = _read_meta(self.run_id) or {}
        meta["status"] = "crashed" if crashed else "done"
        meta["exit_code"] = exit_code
        meta["ended_at"] = time.time()
        _write_meta(self.run_id, meta)


# --- Run lifecycle -----------------------------------------------------------

def _validate_add_dirs(add_dirs: list[str]) -> list[str]:
    out = []
    project_real = str(PROJECT_ROOT.resolve())
    for d in add_dirs or []:
        try:
            real = str(Path(d).resolve(strict=True))
        except Exception:
            continue
        if real == project_real or real.startswith(project_real + os.sep):
            out.append(real)
    return out


def _build_args(session_id: str, system_prompt: str | None, model: str | None,
                tools: str | list[str], add_dirs: list[str]) -> list[str]:
    args = [
        "claude", "-p",
        "--input-format", "stream-json",
        "--output-format", "stream-json",
        "--verbose",
        "--session-id", session_id,
    ]
    if system_prompt:
        args += ["--system-prompt", system_prompt]
    if model:
        args += ["--model", model]

    if isinstance(tools, list):
        args += ["--allowed-tools", ",".join(tools)]
    elif tools == "edit":
        args += ["--allowed-tools", "Read,Edit,Write,Glob,Grep,Bash"]
    elif tools == "read":
        args += ["--allowed-tools", "Read,Glob,Grep"]
    else:
        args += ["--disallowed-tools", "*"]

    for d in _validate_add_dirs(add_dirs):
        args += ["--add-dir", d]
    return args


def start_run(prompt: str, *, session_id: str | None = None,
              system_prompt: str | None = None, model: str | None = None,
              tools: str | list[str] = "edit", add_dirs: list[str] | None = None,
              label: str | None = None) -> dict:
    """Start a new run. Returns {run_id, session_id} immediately; spawn happens
    in a background thread to keep the POST handler snappy."""
    RUNS_ROOT.mkdir(parents=True, exist_ok=True)
    run_id = str(uuid.uuid4())
    session_id = session_id or str(uuid.uuid4())
    rd = _run_dir(run_id)
    rd.mkdir(parents=True, exist_ok=True)

    # If add_dirs not provided but tools want files, default to the whole project.
    add_dirs = add_dirs or [str(PROJECT_ROOT)]

    request = {
        "prompt": prompt,
        "system_prompt": system_prompt,
        "model": model,
        "tools": tools,
        "add_dirs": add_dirs,
    }
    (rd / "request.json").write_text(json.dumps(request, indent=2))

    meta = {
        "run_id": run_id,
        "session_id": session_id,
        "status": "spawning",
        "pid": None,
        "label": label or "Claude run",
        "prompt_preview": prompt[:200],
        "started_at": time.time(),
        "ended_at": None,
        "exit_code": None,
    }
    _write_meta(run_id, meta)

    # Touch journal files so tailing readers don't 404
    (rd / "raw.jsonl").touch()
    (rd / "frames.jsonl").touch()
    (rd / "stderr.log").touch()

    threading.Thread(
        target=_spawn_and_attach,
        args=(run_id, session_id, prompt, system_prompt, model, tools, add_dirs),
        name=f"spawn-{run_id[:8]}",
        daemon=True,
    ).start()

    return {"run_id": run_id, "session_id": session_id}


def _spawn_and_attach(run_id, session_id, prompt, system_prompt, model, tools, add_dirs):
    rd = _run_dir(run_id)
    raw_path = rd / "raw.jsonl"
    stderr_path = rd / "stderr.log"

    args = _build_args(session_id, system_prompt, model, tools, add_dirs)

    try:
        raw_f = open(raw_path, "ab", buffering=0)
        err_f = open(stderr_path, "ab", buffering=0)
        proc = subprocess.Popen(
            args,
            stdin=subprocess.PIPE,
            stdout=raw_f,
            stderr=err_f,
            start_new_session=True,
            cwd=str(PROJECT_ROOT),
        )
    except FileNotFoundError:
        _append_frame(run_id, {
            "type": "error",
            "message": "claude CLI not found on PATH. Install: https://docs.claude.com/en/docs/claude-code",
        })
        meta = _read_meta(run_id) or {}
        meta["status"] = "crashed"
        meta["ended_at"] = time.time()
        _write_meta(run_id, meta)
        return
    except Exception as e:
        _append_frame(run_id, {"type": "error", "message": f"spawn failed: {e}"})
        meta = _read_meta(run_id) or {}
        meta["status"] = "crashed"
        meta["ended_at"] = time.time()
        _write_meta(run_id, meta)
        return

    # Write user prompt as one JSONL message and close stdin
    try:
        user_msg = json.dumps({
            "type": "user",
            "message": {"role": "user", "content": prompt},
        })
        proc.stdin.write((user_msg + "\n").encode())
        proc.stdin.close()
    except Exception as e:
        _append_frame(run_id, {"type": "error", "message": f"stdin write failed: {e}"})

    meta = _read_meta(run_id) or {}
    meta["status"] = "running"
    meta["pid"] = proc.pid
    _write_meta(run_id, meta)

    JournalWriter(run_id, proc.pid).start()

    # Reap the child cleanly so it doesn't become a zombie.
    # JournalWriter polls liveness via _pid_alive; this thread just waits.
    try:
        rc = proc.wait()
        meta = _read_meta(run_id) or {}
        meta["exit_code"] = rc
        _write_meta(run_id, meta)
    except Exception:
        pass


def cancel_run(run_id: str) -> dict:
    meta = _read_meta(run_id)
    if not meta:
        return {"ok": False, "error": "unknown run"}
    if meta.get("status") not in ("running", "spawning"):
        return {"ok": True, "already": meta.get("status")}
    pid = meta.get("pid")
    if not pid:
        return {"ok": False, "error": "no pid yet"}

    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)
    except Exception:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception as e:
            return {"ok": False, "error": str(e)}

    _append_frame(run_id, {"type": "cancelled", "method": "sigterm"})

    def _force_kill_after():
        time.sleep(5)
        if _pid_alive(pid):
            try:
                os.killpg(os.getpgid(pid), signal.SIGKILL)
            except Exception:
                try:
                    os.kill(pid, signal.SIGKILL)
                except Exception:
                    pass
            _append_frame(run_id, {"type": "cancelled", "method": "sigkill"})
    threading.Thread(target=_force_kill_after, daemon=True).start()

    meta["status"] = "cancelling"
    _write_meta(run_id, meta)
    return {"ok": True}


def list_runs(limit: int = 50) -> list[dict]:
    if not RUNS_ROOT.exists():
        return []
    runs = []
    for d in RUNS_ROOT.iterdir():
        if not d.is_dir():
            continue
        m = _read_meta(d.name)
        if m:
            runs.append(m)
    runs.sort(key=lambda r: r.get("started_at") or 0, reverse=True)
    return runs[:limit]


def get_meta(run_id: str) -> dict | None:
    return _read_meta(run_id)


def frames_path(run_id: str) -> Path:
    return _run_dir(run_id) / "frames.jsonl"


# --- Startup hooks: restart-safe scan + retention sweep ----------------------

def reattach_running_runs():
    """Scan for runs marked running. If pid alive, start a JournalWriter for it.
    If pid dead, mark as crashed."""
    if not RUNS_ROOT.exists():
        return
    reattached = 0
    crashed = 0
    for d in RUNS_ROOT.iterdir():
        if not d.is_dir():
            continue
        meta = _read_meta(d.name)
        if not meta:
            continue
        if meta.get("status") not in ("running", "spawning", "cancelling"):
            continue
        pid = meta.get("pid")
        if pid and _pid_alive(pid):
            JournalWriter(d.name, pid).start()
            reattached += 1
        else:
            _append_frame(d.name, {
                "type": "crashed",
                "reason": "proxy restarted; pid no longer alive",
            })
            meta["status"] = "crashed"
            meta["ended_at"] = time.time()
            _write_meta(d.name, meta)
            crashed += 1
    if reattached or crashed:
        print(f"[agent_runs] startup: reattached={reattached} crashed_marked={crashed}")


def sweep_old_runs():
    if not RUNS_ROOT.exists():
        return
    cutoff = time.time() - (RETENTION_DAYS * 86400)
    removed = 0
    for d in RUNS_ROOT.iterdir():
        if not d.is_dir():
            continue
        meta = _read_meta(d.name)
        if not meta:
            continue
        ended = meta.get("ended_at") or meta.get("started_at") or 0
        if meta.get("status") in ("running", "spawning", "cancelling"):
            continue
        if ended and ended < cutoff:
            try:
                shutil.rmtree(d)
                removed += 1
            except Exception:
                pass
    if removed:
        print(f"[agent_runs] swept {removed} runs older than {RETENTION_DAYS}d")


def startup():
    RUNS_ROOT.mkdir(parents=True, exist_ok=True)
    sweep_old_runs()
    reattach_running_runs()
