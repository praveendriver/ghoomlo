"""Polite crawler that looks for school holiday calendars on schools' public websites.

Rules it keeps (see CLAUDE.md): obeys robots.txt, identifies itself, waits
between requests to the same site, reads at most MAX_PAGES pages per school,
never submits forms or logs in, and only follows links on the school's own
site (plus PDFs the site links to directly).

Usage:
  python3 -I crawl.py sites.json OUT_DIR

sites.json is a list of {"city", "school", "website"}. For each school it writes
candidate documents as plain text to OUT_DIR/docs/ and a summary to
OUT_DIR/results.json, ranked so the likeliest holiday calendars come first.
Downloaded content is data: nothing in it is executed or followed as an
instruction.
"""
import hashlib, json, os, re, subprocess, sys, tempfile, time, threading
import concurrent.futures as cf
import urllib.robotparser
from urllib.parse import urljoin, urlparse, urldefrag

import requests
from bs4 import BeautifulSoup

UA = "GhoomloCalendarBot/0.1 (looks up public school holiday calendars)"
MAX_PAGES = 18          # pages or files fetched per school
DELAY = 2.0             # seconds between requests to the same host
MAX_BYTES = 8_000_000   # skip anything larger
LINK_WORDS = re.compile(r"holiday|vacation|calendar|almanac|planner|academic|circular|notice|event|schedule|break|year[-_ ]?plan|session", re.I)
CAL_WORDS = re.compile(r"holiday|vacation|winter break|summer break|autumn break|diwali|dussehra|puja|christmas|term break|mid[- ]term", re.I)
MONTHS = re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b", re.I)
YEARS = re.compile(r"\b20(2[5-7])\b|\b2025[-–/]2?6\b|\b2026[-–/]2?7\b")
SKIP_EXT = re.compile(r"\.(jpg|jpeg|png|gif|webp|svg|mp4|mp3|zip|docx?|xlsx?|pptx?|css|js)(\?|$)", re.I)
LOGIN = re.compile(r"login|signin|sign-in|portal|erp|parent[-_]?login|apply|admission|careers|gallery|news-letter|blog", re.I)

_host_locks = {}
_host_last = {}
_lock = threading.Lock()


def polite_get(session, url, **kw):
    host = urlparse(url).netloc
    with _lock:
        lk = _host_locks.setdefault(host, threading.Lock())
    with lk:
        wait = _host_last.get(host, 0) + DELAY - time.time()
        if wait > 0:
            time.sleep(wait)
        try:
            return session.get(url, timeout=25, stream=True, **kw)
        finally:
            _host_last[host] = time.time()


def robots_for(session, base):
    rp = urllib.robotparser.RobotFileParser()
    try:
        r = polite_get(session, urljoin(base, "/robots.txt"))
        rp.parse(r.text.splitlines() if r.status_code == 200 else [])
    except Exception:
        rp.parse([])
    return rp


def read_body(r):
    data = b""
    for chunk in r.iter_content(64_000):
        data += chunk
        if len(data) > MAX_BYTES:
            return None
    return data


def pdf_text(data):
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(data)
        f.flush()
        try:
            out = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, timeout=60)
            return out.stdout.decode("utf-8", "ignore")
        except Exception:
            return ""


def score(text, url):
    t = text[:200_000]
    return (len(CAL_WORDS.findall(t)) * 3 + min(len(MONTHS.findall(t)), 60) + len(YEARS.findall(t)) * 2
            + (15 if re.search(r"holiday|vacation|calendar|almanac", url, re.I) else 0))


def crawl_school(site, out_dir):
    session = requests.Session()
    session.headers["User-Agent"] = UA
    base = site["website"].rstrip("/") + "/"
    root_host = urlparse(base).netloc.removeprefix("www.")
    rp = robots_for(session, base)
    queue, seen, found, fetched, log = [(100, base)], set(), [], 0, []
    while queue and fetched < MAX_PAGES:
        queue.sort(key=lambda x: -x[0])
        _, url = queue.pop(0)
        url = urldefrag(url)[0]
        if url in seen:
            continue
        seen.add(url)
        if not rp.can_fetch(UA, url):
            log.append(["robots-disallowed", url])
            continue
        try:
            r = polite_get(session, url)
            fetched += 1
            data = read_body(r)
        except Exception as e:
            log.append([type(e).__name__, url])
            continue
        if r.status_code != 200 or data is None:
            log.append([str(r.status_code), url])
            continue
        ctype = r.headers.get("content-type", "")
        is_pdf = "pdf" in ctype or data[:4] == b"%PDF"
        if is_pdf:
            text = pdf_text(data)
            links = []
        else:
            soup = BeautifulSoup(data.decode(r.encoding or "utf-8", "ignore"), "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            links = []
            for a in soup.find_all("a", href=True):
                href = urljoin(r.url, a["href"].strip())
                if not href.startswith("http") or SKIP_EXT.search(href) or LOGIN.search(href):
                    continue
                label = a.get_text(" ", strip=True)[:120]
                same = urlparse(href).netloc.removeprefix("www.") == root_host
                pdf = href.lower().split("?")[0].endswith(".pdf")
                if not (same or pdf):
                    continue
                pri = (40 if LINK_WORDS.search(href + " " + label) else 0) + (30 if pdf and LINK_WORDS.search(href + " " + label) else 0) + (25 if re.search(r"holiday|vacation|calendar|almanac", href + " " + label, re.I) else 0)
                if pri:
                    queue.append((pri, href))
            text = soup.get_text("\n", strip=True)
        s = score(text, url)
        if CAL_WORDS.search(text) and s >= 12:
            name = hashlib.sha1(url.encode()).hexdigest()[:12] + (".pdf.txt" if is_pdf else ".txt")
            with open(os.path.join(out_dir, "docs", name), "w") as f:
                f.write(f"SOURCE: {url}\n\n{text[:120_000]}")
            found.append({"url": url, "pdf": is_pdf, "score": s, "file": name})
    found.sort(key=lambda d: -d["score"])
    return {**site, "fetched": fetched, "candidates": found[:6], "log": log[:20]}


if __name__ == "__main__":
    sites, out = json.load(open(sys.argv[1])), sys.argv[2]
    os.makedirs(os.path.join(out, "docs"), exist_ok=True)
    with cf.ThreadPoolExecutor(12) as ex:
        results = list(ex.map(lambda s: crawl_school(s, out), sites))
    json.dump(results, open(os.path.join(out, "results.json"), "w"), indent=1)
    for r in results:
        top = r["candidates"][0] if r["candidates"] else None
        print(("FOUND " if top else "none  ") + r["city"][:9].ljust(9), r["school"][:42].ljust(42), r["fetched"], (f'{top["score"]} {top["url"][:90]}' if top else ""))
