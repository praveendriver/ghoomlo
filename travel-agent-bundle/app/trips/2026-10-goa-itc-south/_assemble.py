#!/usr/bin/env python3
"""Assemble the rich Goa trip page: reuse the Japan page's <head> (component CSS
lives only in its inline <style>) + body-open + icon sprite, then append the
Goa-specific sections. Run: python3 _assemble.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
JAPAN = os.path.join(HERE, "..", "2026-07-tokyo-koyoto-and-other-famous", "index.html")
SECTIONS = os.path.join(HERE, "_goa_sections.html")
OUT = os.path.join(HERE, "index.html")

TITLE = ("Gama Adventures — Goa: ITC Grand Goa · Temples · Old Goa · "
         "Dudhsagar · Oct 16–20, 2026")

jp = open(JAPAN, encoding="utf-8").read().splitlines(keepends=True)

# Lines 1..1155 = everything through </head>. (1-indexed -> [0:1155])
head = "".join(jp[0:1155])

# Swap the <title>.
import re
head = re.sub(r"<title>.*?</title>", f"<title>{TITLE}</title>", head, count=1, flags=re.S)

# Body open with the Goa slug.
body_open = '<body data-trip-slug="2026-10-goa-itc-south">\n\n'

# Icon sprite: comment + <svg>...</svg> = lines 1158..1194 (1-indexed) -> [1157:1194]
sprite = "".join(jp[1157:1194])

sections = open(SECTIONS, encoding="utf-8").read()

html = head + body_open + sprite + "\n" + sections + "\n</body>\n</html>\n"
open(OUT, "w", encoding="utf-8").write(html)
print(f"Wrote {OUT} ({len(html)} bytes)")

# Sanity checks
assert "<title>Gama Adventures — Goa" in html, "title not swapped"
assert 'id="i-plane"' in html, "icon sprite missing"
assert 'data-trip-map="itinerary"' in html, "itinerary map missing"
assert 'data-trip-map="restaurants"' in html, "restaurants map missing"
assert "trip-map.js" in html, "map script missing"
assert "YATRA_TRIP_DEFAULTS" in html, "map defaults missing"
assert html.count("<body") == 1, "duplicate body tag"
assert html.count("</html>") == 1, "duplicate html close"
print("Sanity checks passed.")
