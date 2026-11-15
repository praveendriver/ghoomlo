#!/usr/bin/env python3
"""Build a DAYS-ONLY copy of the field guide for printing.

Reuses the EXACT styling from build_guide.py (imports its HEAD block) so the
print copy is visually identical to the full guide — it just contains Part 9
(the day-by-day timelines, Day 1–12) plus the Master Sheet, which the guide
itself defines as the "self-contained daily kit." The reference sections
(Parts 1–8, 10, 11) and the Appendix are dropped; keep the full guide on your
phone for those.

Run `python3 build_days_only.py`.
"""
import markdown, os
import build_guide as full  # reuse HEAD + the same md extensions

HERE = os.path.dirname(os.path.abspath(__file__))
MD = os.path.join(HERE, "TOKYO-KYOTO-FIELD-GUIDE.md")
HTML = os.path.join(HERE, "TOKYO-KYOTO-DAYS-ONLY.html")
PDF = os.path.join(HERE, "TOKYO-KYOTO-DAYS-ONLY.pdf")

# Markers that bound the slice. We keep everything from the Part 9 header
# through the end of the Master Sheet, and stop right before the Appendix.
START = "# PART 9 —"
STOP = '<div class="daysep" id="appendix">'


def slice_days(md_text):
    start = md_text.index(START)
    stop = md_text.index(STOP)
    body_md = md_text[start:stop].rstrip()
    # The floating index chip and the tap-to-jump grid live at the top of the
    # full doc (not in this slice), so no #index target exists here — that's
    # fine for a print-only copy. Nothing else in the slice links outside it
    # except the "Master Sheet (right after Day 12)" prose, which is included.
    return body_md


def main():
    md_text = open(MD, encoding="utf-8").read()
    body_md = slice_days(md_text)
    body = markdown.markdown(body_md, extensions=["tables", "fenced_code", "toc", "sane_lists"])

    # A small print-copy banner so it's obvious this is the trimmed version.
    banner = (
        '<div class="toc" style="text-align:center">'
        '<div class="toc-h">Days-only print copy</div>'
        '<div class="toc-note">Day 1–12 timelines + the Master Sheet — the self-contained '
        'daily kit. Keep the full guide (Parts 1–11 + Appendix) on your phone for planning, '
        'trains, eating, shopping &amp; emergencies.</div></div>'
    )
    html = full.HEAD + banner + body + "\n</body>\n</html>\n"
    open(HTML, "w", encoding="utf-8").write(html)
    print(f"HTML written: {HTML} ({len(html)} bytes)")

    if os.path.exists(PDF):
        os.remove(PDF)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.goto(f"file://{HTML}", wait_until="load", timeout=90000)
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(400)
        pg.emulate_media(media="print")
        pg.pdf(path=PDF, prefer_css_page_size=True, print_background=True,
               margin={"top": "14mm", "bottom": "14mm", "left": "10mm", "right": "10mm"})
        b.close()
    if os.path.exists(PDF):
        print(f"PDF written (playwright): {PDF} ({os.path.getsize(PDF)} bytes)")


if __name__ == "__main__":
    main()
