"""Record schools that were crawled without a usable calendar.
Usage: python3 -I bulk_status.py sites.json results.json overrides.json
Schools already in the data file are left alone. overrides.json maps
school name -> {"status": ..., "notes": ...} for partial finds."""
import json, sys, subprocess, pathlib
sites, results, overrides = (json.load(open(p)) for p in sys.argv[1:4])
data_path = pathlib.Path(__file__).resolve().parents[2] / "web/data/school-holidays.json"
have = {(s["city"], s["school"]) for s in json.loads(data_path.read_text())["schools"]}
by_site = {r["website"]: r for r in results}
NOTE = ("No public holiday calendar was found on the pages the crawler could read. The site may "
        "load its menus with JavaScript, or publish calendars only in a parent app or portal.")
for s in sites:
    if (s["city"], s["school"]) in have:
        continue
    r = by_site.get(s["website"], {})
    o = overrides.get(s["school"], {})
    entry = {"city": s["city"], "school": s["school"], "website": s["website"],
             "status": o.get("status", "not-found"), "retrievedOn": "2026-11-17", "breaks": [],
             "notes": o.get("notes", NOTE)}
    if o.get("sourceUrl"):
        entry["sourceUrl"] = o["sourceUrl"]
    subprocess.run([sys.executable, "-I", str(pathlib.Path(__file__).with_name("add_entry.py")), json.dumps(entry)], check=True)
