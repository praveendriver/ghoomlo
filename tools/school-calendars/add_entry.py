"""Add or replace one school's entry in web/data/school-holidays.json.
Usage: python3 -I add_entry.py '<json for one school>'"""
import json, sys, pathlib
path = pathlib.Path(__file__).resolve().parents[2] / "web/data/school-holidays.json"
data = json.loads(path.read_text()) if path.exists() else {
    "about": "School holiday breaks found on schools' public websites by tools/school-calendars. Every entry is unverified until a person checks it against the school's own calendar. Each break quotes the source wording.",
    "schools": [],
}
entry = json.loads(sys.argv[1])
assert entry["status"] in {"found", "needs-review", "not-found", "not-public"}
for b in entry.get("breaks", []):
    assert b["start"] <= b["end"] and len(b["start"]) == 10 and b.get("quote"), b
key = (entry["city"], entry["school"])
data["schools"] = [s for s in data["schools"] if (s["city"], s["school"]) != key] + [entry]
data["schools"].sort(key=lambda s: (s["city"], s["school"]))
path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
print("saved", key, len(entry.get("breaks", [])), "breaks;", len(data["schools"]), "schools in file")
