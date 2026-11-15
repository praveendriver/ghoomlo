#!/usr/bin/env python3
"""Build GOA-FIELD-GUIDE.html + .pdf from the markdown.
Reusable: run `python3 build_guide.py`. Renders the PDF via Playwright's Chromium.
"""
import markdown, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MD = os.path.join(HERE, "GOA-FIELD-GUIDE.md")
HTML = os.path.join(HERE, "GOA-FIELD-GUIDE.html")
PDF = os.path.join(HERE, "GOA-FIELD-GUIDE.pdf")

HEAD = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Goa Field Guide — ITC Grand Goa · Oct 2026</title>
<style>
/* === Yatra. design system — self-hosted fonts so the PDF renders offline === */
@font-face{ font-family:'Fraunces'; font-style:normal; font-weight:400 700;
  src:url('images/fonts/fraunces-latin.woff2') format('woff2'); font-display:swap; }
@font-face{ font-family:'InterGuide'; font-style:normal; font-weight:400 700;
  src:url('images/fonts/inter-latin.woff2') format('woff2'); font-display:swap; }
:root{
  /* Palette lifted from trips/_shared/style.css (the "site") */
  --ink:#1a2128; --ink-soft:#4a5560; --muted:#6a7480;
  --paper:#f6f1e8; --card:#fffdf9; --sand:#efe7d6;
  --line:#d9cfbc; --line-strong:#c3b8a1;
  --teal:#1f3a3d; --teal-deep:#122729;
  --saffron:#d97a3a; --saffron-deep:#b15f24; --saffron-soft:#e8a572;
  --gold:#b07d2e;
  /* semantic accents (kept for the color-coded system, but every use also has a
     non-colour cue — border, weight, glyph or shape — so it survives B&W print) */
  --accent:#b15f24; --accent2:#1f6f6b;
}
*{ box-sizing:border-box; }
html{ -webkit-text-size-adjust:100%; }
body{ font-family:'InterGuide',-apple-system,"Helvetica Neue","Hiragino Sans",Arial,sans-serif;
  color:var(--ink); line-height:1.58; max-width:820px; margin:0 auto; padding:34px 26px 64px;
  background:#fff; font-size:14.5px; -webkit-font-smoothing:antialiased;
  font-feature-settings:"liga" 1,"kern" 1; }
@media screen{ body{ background:var(--paper); } }
h1,h2,h3,.big,.serif{ font-family:'Fraunces','Times New Roman',Georgia,serif; }
h1{ font-size:30px; line-height:1.14; margin:.25em 0 .12em; color:var(--teal-deep);
  font-weight:600; letter-spacing:-.01em; border:0; }
h1 + h3{ margin-top:0; color:var(--saffron-deep); font-weight:600; font-size:14px;
  font-family:'InterGuide',sans-serif; letter-spacing:.12em; text-transform:uppercase; }
/* Section heads read like the site: a saffron eyebrow rule + serif title, not a filled bar */
h2{ font-size:22px; font-weight:600; color:var(--teal-deep); margin:1.7em 0 .55em;
  padding:0 0 8px; border-bottom:1.5px solid var(--line-strong); position:relative;
  letter-spacing:-.01em; }
h2::before{ content:""; position:absolute; left:0; bottom:-1.5px; width:56px; height:1.5px;
  background:var(--saffron); }
h3{ font-size:17.5px; margin:1.4em 0 .4em; color:var(--teal); font-weight:600; }
h4{ font-size:14.5px; margin:1.15em 0 .3em; color:var(--ink); font-weight:700;
  font-family:'InterGuide',sans-serif; }
p,li{ font-size:14.5px; }
a.u{ color:var(--saffron-deep); word-break:break-all; text-decoration:none; }
a{ color:var(--saffron-deep); }
code{ background:var(--sand); padding:1px 5px; border-radius:5px; font-size:12.5px;
  font-family:"SF Mono",Menlo,Consolas,monospace; }
pre{ background:var(--sand); border:1px solid var(--line); border-radius:10px; padding:12px 14px;
  overflow-x:auto; font-size:12.5px; line-height:1.45; }
pre code{ background:none; padding:0; }
table{ border-collapse:collapse; width:100%; margin:.9em 0; font-size:13px; }
th,td{ border:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; }
th{ background:var(--sand); font-family:'InterGuide',sans-serif; font-weight:700;
  color:var(--teal-deep); }
hr{ border:0; border-top:1px solid var(--line-strong); margin:2.2em 0; }
blockquote{ margin:1.1em 0; padding:12px 16px; background:var(--card);
  border:1px solid var(--line); border-left:3px solid var(--saffron); border-radius:12px;
  color:var(--ink-soft); }
blockquote p{ margin:.3em 0; }
ul,ol{ padding-left:22px; }
li{ margin:.28em 0; }
strong{ color:var(--ink); font-weight:700; }
/* Figures: images with italic captions. The markdown emits <p><img><em>caption</em></p>. */
img{ max-width:100%; height:auto; border:1px solid var(--line); border-radius:6px;
  margin:.6em 0 .2em; display:inline-block; vertical-align:top; }
p:has(img){ margin:1em 0 1.2em; }
p:has(img) em{ display:block; font-size:12.5px; color:var(--muted); line-height:1.4;
  margin-top:.15em; font-style:italic; }
/* two side-by-side images in one paragraph (USJ steps) shrink to fit */
p:has(img + img) img{ max-width:48%; }
/* The Keikyu line map is a tall, narrow diagram only 456px wide at source.
   Cap it at native width and center it so the PDF never upscales it (upscaling = blur). */
img[src$="arr-08-keikyu-linemap.png"]{ max-width:300px; display:block; margin:.6em auto .2em;
  image-rendering:-webkit-optimize-contrast; }
/* Thumbnails of saved Instagram screenshots (tall phone caps). Keep small. */
img[src*="/jul2/"]{ width:64px; max-width:64px; height:auto; border-radius:5px;
  margin:2px 3px 2px 0; vertical-align:middle; }
/* Appendix phone-screenshot dumps (tall 9:16 caps) — cap the height so a single
   screenshot doesn't swallow a whole page in the PDF. */
img[src*="/dumps/"]{ max-height:360px; width:auto; max-width:100%; display:block; }
td img[src*="/jul2/"]{ width:52px; max-width:52px; }
/* "Today's picks" photo strip inside day sections */
.picks{ display:flex; flex-wrap:wrap; gap:12px; margin:.6em 0 1.1em; }
.pick{ width:122px; font-size:11.5px; line-height:1.32; color:var(--muted); }
.pick img{ width:122px; max-width:122px; height:150px; object-fit:cover; display:block;
  border:1px solid var(--line); border-radius:12px; margin:0 0 4px; }
.pick b{ color:var(--ink); display:block; font-size:11.5px; font-weight:700; }
.pick .tagb{ display:inline-block; font-size:9px; font-weight:700; letter-spacing:.6px;
  text-transform:uppercase; padding:2px 7px; border-radius:999px; margin-bottom:3px;
  border:1px solid var(--line-strong); background:var(--card); color:var(--ink-soft); }
.pick .buy{ border-color:var(--saffron); color:var(--saffron-deep); }
.pick .eat{ border-color:var(--teal); color:var(--teal); }
.pick .see{ border-color:var(--gold); color:var(--gold); }
/* === Day TIMELINE === a vertical time-rail with sequenced stops ===
   B&W-safe: node SHAPE + glyph distinguishes stop type, not just colour. */
.tl{ position:relative; margin:1.2em 0 1.5em; }
.stop{ display:grid; grid-template-columns:52px 1fr; }
.stop .tmark{ text-align:right; padding:1px 13px 0 0; font-size:12px; font-weight:700;
  color:var(--saffron-deep); white-space:nowrap; letter-spacing:-.2px;
  font-family:'Fraunces',serif; }
.stop .scard{ position:relative; border-left:2px solid var(--line-strong); padding:0 0 20px 22px; }
.stop:last-child .scard{ border-left-color:transparent; }
.stop .scard::before{ content:""; position:absolute; left:-8px; top:3px; width:14px; height:14px;
  border-radius:50%; background:var(--teal); border:2px solid var(--card);
  box-shadow:0 0 0 1.5px var(--line-strong); }
.stop .stitle{ font-weight:700; font-size:14.5px; color:var(--ink); margin:0 0 3px; line-height:1.3; }
.stop .sbody{ font-size:12.7px; line-height:1.52; color:var(--ink-soft); }
.stop .sbody .warn{ color:var(--saffron-deep); font-weight:700; }
.stop .sbody a{ color:var(--saffron-deep); word-break:break-all; }
/* meal stop: teal ring + fork glyph; transit: gold square + arrow glyph */
.stop.meal .scard::before{ background:var(--card); border-color:var(--teal);
  box-shadow:0 0 0 1.5px var(--teal); }
.stop.meal .scard::after{ content:"\\1F374"; position:absolute; left:-6px; top:1px; font-size:8px;
  line-height:1; }
.stop.move .scard::before{ background:var(--gold); border-radius:3px; }
/* OPTIONAL stop: hollow dashed node + skip route */
.stop.opt .scard{ border-left-style:dashed; }
.stop.opt .scard::before{ background:var(--card); border:2px dashed var(--saffron-deep);
  box-shadow:none; }
.stop.opt .tmark{ color:var(--muted); font-weight:700; font-size:10px; text-transform:uppercase;
  padding-top:3px; }
.stop.opt .stitle{ color:var(--saffron-deep); }
.optbadge{ display:inline-block; font-size:9px; font-weight:700; letter-spacing:.6px;
  text-transform:uppercase; background:var(--card); color:var(--saffron-deep);
  border:1px solid var(--saffron); padding:1px 7px; border-radius:999px;
  margin-right:6px; vertical-align:middle; }
.skip{ margin-top:8px; font-size:11.5px; background:var(--sand); border:1px dashed var(--line-strong);
  border-radius:10px; padding:6px 11px; color:var(--muted); }
.skip b{ color:var(--teal); }
.skip::before{ content:"\\21B3 skip \\2192 "; font-weight:700; color:var(--saffron-deep); }
/* === Glanceable transport FACTS chips inside a move stop === */
.facts{ display:flex; flex-wrap:wrap; gap:5px 6px; margin:6px 0 4px; }
.facts .f{ font-size:11px; font-weight:600; background:var(--card); border:1px solid var(--line-strong);
  border-radius:999px; padding:2px 9px; color:var(--ink-soft); white-space:nowrap; }
.facts .f b{ color:var(--ink); font-weight:700; }
.facts .f.tap{ border-color:var(--teal); color:var(--teal); }
.facts .f.buy{ border-color:var(--saffron); color:var(--saffron-deep); }
/* === Named pick list inside an eat/see/shop stop (replaces flip-to-Part-10/11) ===
   B&W-safe: outline pills with a leading glyph per type instead of solid fills. */
.picklist{ margin:7px 0 2px; padding:0; list-style:none; }
.picklist li{ font-size:12px; line-height:1.48; margin:4px 0; padding-left:2px; }
.picklist .nm{ font-weight:700; color:var(--ink); }
.picklist .tg{ display:inline-block; font-size:8.5px; font-weight:700; letter-spacing:.5px;
  text-transform:uppercase; padding:1px 7px; border-radius:999px; margin-right:6px;
  vertical-align:middle; background:var(--card); border:1px solid var(--line-strong);
  color:var(--ink-soft); }
.picklist .tg::before{ font-weight:700; margin-right:3px; }
.picklist .tg.veg{ border-color:var(--teal); color:var(--teal); }
.picklist .tg.veg::before{ content:"\\25C9 "; }        /* veg = filled ring */
.picklist .tg.ind{ border-color:var(--saffron); color:var(--saffron-deep); }
.picklist .tg.ind::before{ content:"\\2691 "; }        /* india flag glyph */
.picklist .tg.buy{ border-color:var(--gold); color:var(--gold); }
.picklist .tg.buy::before{ content:"\\25B8 "; }        /* buy = triangle */
.picklist .tg.safe{ border-color:var(--teal); color:var(--teal); }
.picklist .tg.safe::before{ content:"\\2713 "; }       /* safe = check */
.picklist .tg.see{ border-color:var(--ink-soft); color:var(--ink-soft); }
.picklist .tg.see::before{ content:"\\25C6 "; }        /* see = diamond */
.picklist a{ color:var(--saffron-deep); word-break:break-all; }
.maplink{ font-size:10.5px; color:var(--saffron-deep); }
/* "Carry today" strip on each day divider */
.daysep .carry{ margin-top:18px; font-size:12.5px; background:rgba(246,241,232,.10);
  border:1px solid rgba(246,241,232,.35); border-radius:14px; padding:10px 16px; display:inline-block;
  line-height:1.6; color:rgba(246,241,232,.9); }
.daysep .carry b{ color:#fff; }
/* photo inside a stop */
.sphoto{ margin:8px 0 1px; display:flex; gap:11px; flex-wrap:wrap; align-items:flex-start; }
.stop .sphoto img{ width:104px; max-width:104px; height:130px; object-fit:cover; margin:0;
  border:1px solid var(--line); border-radius:12px; display:block; }
.sphoto .cap{ font-size:10.5px; color:var(--muted); line-height:1.4; max-width:150px; }
.sphoto .cap b{ color:var(--ink); display:block; font-weight:700; }
/* Landmark ID photo — bigger than a thumbnail so the user can recognise the
   place on the ground (used where a confusing Japanese name needs a picture). */
.sphoto.idcard{ align-items:flex-start; }
.stop .sphoto.idcard img{ width:264px; max-width:264px; height:auto; max-height:200px;
  object-fit:cover; border-radius:14px; }
.sphoto.idcard .cap{ max-width:220px; font-size:11px; }
/* Day separator / divider pages — deep teal, editorial, grayscale-graceful */
.daysep{ margin:0; padding:70px 34px; background:var(--teal-deep); color:var(--paper);
  border-radius:20px; text-align:center; position:relative; overflow:hidden; }
.daysep::before{ content:""; position:absolute; inset:14px; border:1px solid rgba(246,241,232,.28);
  border-radius:12px; pointer-events:none; }
.daysep .kicker{ font-size:12px; letter-spacing:.34em; text-transform:uppercase;
  color:var(--saffron-soft); font-weight:600; position:relative; }
.daysep .big{ font-family:'Fraunces',serif; font-size:46px; font-weight:600; line-height:1.08;
  margin:10px 0 8px; color:var(--paper); letter-spacing:-.01em; position:relative; }
.daysep .sub{ font-size:16.5px; color:rgba(246,241,232,.85); position:relative; }
.daysep .tag{ display:inline-block; margin-top:18px; padding:6px 16px;
  border:1px solid var(--saffron-soft); border-radius:999px; font-size:12.5px;
  color:var(--saffron-soft); position:relative; }
/* === Index / table of contents (tap-to-jump grid) — site card style === */
.toc{ border:1px solid var(--line-strong); border-radius:20px; padding:20px 22px 22px;
  margin:1.5em 0 1.3em; background:var(--card); scroll-margin-top:60px; }
.toc-h{ font-family:'Fraunces',serif; font-size:22px; font-weight:600; color:var(--teal-deep);
  margin-bottom:3px; }
.toc-note{ font-size:11.5px; color:var(--muted); margin-bottom:15px; line-height:1.45; }
.toc-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin-bottom:10px; }
.tci{ display:block; text-decoration:none; border:1px solid var(--line); border-radius:13px;
  padding:9px 12px; background:#fff; line-height:1.28; break-inside:avoid; }
.tci b{ display:block; font-size:13px; color:var(--ink); font-weight:700; }
.tci span{ display:block; font-size:10px; color:var(--muted); margin-top:1px; }
.tci.day{ border-left:3px solid var(--saffron); }
.tci.day b{ color:var(--saffron-deep); }
.tci.ref{ border-left:3px solid var(--teal); background:var(--card); }
.tci.ref b{ color:var(--teal); }
/* === Floating "back to index" chip — repeats on every printed page === */
.idxchip{ position:fixed; top:6mm; right:6mm; z-index:999; text-decoration:none;
  background:var(--teal-deep); color:var(--paper); font-size:12px; font-weight:700; letter-spacing:.3px;
  padding:5px 13px; border-radius:999px; box-shadow:0 1px 4px rgba(0,0,0,.25);
  border:1px solid var(--saffron-soft); }
@media screen{ .idxchip{ position:fixed; } }
@media print{
  body{ padding:0 6mm; font-size:11.5pt; max-width:none; }
  h2{ break-inside:avoid; }
  h2,h3,h4{ break-after:avoid; }
  table,pre,blockquote{ break-inside:avoid; }
  p:has(img){ break-inside:avoid; }
  img{ break-inside:avoid; }
  .picks{ break-inside:avoid; } .pick{ break-inside:avoid; }
  .stop{ break-inside:avoid; } .sphoto{ break-inside:avoid; } .skip{ break-inside:avoid; }
  .facts{ break-inside:avoid; } .picklist li{ break-inside:avoid; }
  a.u,a{ color:#0a58ca; }
  /* Each day divider starts on a fresh page; force its dark ground to print */
  .daysep{ break-before:page; break-inside:avoid; min-height:80vh;
    display:flex; flex-direction:column; justify-content:center;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  th,.pick .tagb,.facts .f,.picklist .tg,blockquote,.toc,.tci{
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  /* The index chip is position:fixed, so Chromium paints it on EVERY printed page.
     In Chromium's print engine a fixed element lands in the BOTTOM-margin band of every
     page (consistent), so we anchor it bottom-right as a repeating "back to index" tab. */
  .idxchip{ position:fixed; bottom:-11mm; top:auto; right:0; font-size:9.5pt; padding:3px 10px;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .toc{ break-inside:avoid; }
  .tci{ break-inside:avoid; }
  @page{ margin:18mm 10mm 14mm; }
}
</style>
</head>
<body>
'''

def main():
    md = open(MD, encoding="utf-8").read()
    body = markdown.markdown(md, extensions=["tables","fenced_code","toc","sane_lists"])
    html = HEAD + body + "\n</body>\n</html>\n"
    open(HTML, "w", encoding="utf-8").write(html)
    print(f"HTML written: {HTML} ({len(html)} bytes)")

    # PDF via Playwright's bundled Chromium (148). The system Google Chrome (149)
    # hangs indefinitely on this doc's .picklist .tg styled tags during print
    # layout — Playwright's older Chromium renders it in one pass. Fall back to
    # the Chrome CLI only if Playwright isn't installed.
    if os.path.exists(PDF):
        os.remove(PDF)
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page()
            pg.goto(f"file://{HTML}", wait_until="load", timeout=90000)
            # Block until self-hosted Fraunces + Inter are actually parsed, else
            # Chromium renders the fallback serif/sans before the woff2 loads.
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(400)
            pg.emulate_media(media="print")
            pg.pdf(path=PDF, prefer_css_page_size=True, print_background=True,
                   margin={"top": "14mm", "bottom": "14mm", "left": "10mm", "right": "10mm"})
            b.close()
        if os.path.exists(PDF):
            print(f"PDF written (playwright): {PDF} ({os.path.getsize(PDF)} bytes)")
    except ImportError:
        chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        if os.path.exists(chrome):
            print("playwright not installed — falling back to Chrome CLI (may hang on Chrome 149).")
            cmd = [chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                   f"--print-to-pdf={PDF}", f"file://{HTML}"]
            subprocess.run(cmd, capture_output=True, timeout=120)
            if os.path.exists(PDF):
                print(f"PDF written: {PDF} ({os.path.getsize(PDF)} bytes)")
        else:
            print("Neither Playwright nor Chrome found — HTML only.")

if __name__ == "__main__":
    main()
