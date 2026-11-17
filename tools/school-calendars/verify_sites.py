"""Check candidate school websites: does the home page load, and does its title
or heading mention the school? Usage: python3 -I verify_sites.py candidates.json out.json"""
import json, re, sys, concurrent.futures as cf
import requests
from bs4 import BeautifulSoup

UA = "GhoomloCalendarBot/0.1 (looks up public school holiday calendars)"
STOP = {"the", "school", "high", "public", "international", "of", "and", "for", "academy", "world", "boys", "girls"}

def words(name):
    return [w for w in re.findall(r"[a-z]+", name.lower()) if w not in STOP and len(w) > 2]

def check(entry):
    name, url = entry["school"], entry["website"]
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=20, allow_redirects=True)
        soup = BeautifulSoup(r.text[:400_000], "html.parser")
        text = " ".join(filter(None, [soup.title.string if soup.title else "", *(h.get_text(" ") for h in soup.find_all(["h1", "h2"])[:6]), *(m.get("content", "") for m in soup.find_all("meta", attrs={"name": "description"}))])).lower()
        keys = words(name)
        hit = sum(1 for k in keys if k in text) / max(1, len(keys))
        return {**entry, "status": r.status_code, "final_url": r.url, "match": round(hit, 2), "title": (soup.title.string or "").strip()[:120] if soup.title else ""}
    except Exception as e:
        return {**entry, "status": None, "error": type(e).__name__ + ": " + str(e)[:120], "match": 0}

if __name__ == "__main__":
    entries = json.load(open(sys.argv[1]))
    with cf.ThreadPoolExecutor(16) as ex:
        out = list(ex.map(check, entries))
    json.dump(out, open(sys.argv[2], "w"), indent=1)
    for o in out:
        flag = "OK " if o.get("status") == 200 and o["match"] >= 0.5 else "?? "
        print(flag, o["city"][:9].ljust(9), o["school"][:45].ljust(45), o.get("status"), o["match"], (o.get("title") or o.get("error", ""))[:60])
