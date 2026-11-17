// Browser-based version of crawl.py, for school sites whose menus only appear
// after JavaScript runs. Same rules: obeys robots.txt, identifies itself,
// waits between requests to a site, reads at most MAX_PAGES pages per school,
// never logs in or submits forms, follows only same-site links and linked PDFs.
//
// Usage: node browser_crawl.cjs sites.json OUT_DIR
// Writes OUT_DIR/docs/*.txt and OUT_DIR/results.json like crawl.py.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const UA = "GhoomloCalendarBot/0.1 (looks up public school holiday calendars)";
const MAX_PAGES = 14;
const DELAY_MS = 2500;
const CONCURRENCY = 6;
const LINK = /holiday|vacation|calendar|almanac|planner|academic|circular|notice|event|schedule|break|year[-_ ]?plan|session/i;
const STRONG = /holiday|vacation|calendar|almanac/i;
const CAL = /holiday|vacation|winter break|summer break|autumn break|diwali|dussehra|dasara|puja|christmas|term break|mid[- ]term/gi;
const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi;
const YEARS = /\b202[6-7]\b/g;
const SKIP = /\.(jpe?g|png|gif|webp|svg|mp4|mp3|zip|docx?|xlsx?|pptx?)(\?|$)|login|signin|sign-in|portal|erp|apply|admission|careers|gallery|blog/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function robotsRules(text) {
  // Collect Disallow rules for "*" and for our bot name.
  const rules = [];
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, value] = m;
    if (/user-agent/i.test(key)) applies = value === "*" || /ghoomlo/i.test(value);
    else if (applies && /disallow/i.test(key) && value) rules.push(value);
  }
  return (url) => {
    const p = new URL(url).pathname;
    return !rules.some((r) => p.startsWith(r.replace(/\*.*$/, "")));
  };
}

function score(text, url) {
  const t = text.slice(0, 200000);
  return (t.match(CAL) || []).length * 3 + Math.min((t.match(MONTHS) || []).length, 60) + (t.match(YEARS) || []).length * 2 + (STRONG.test(url) ? 15 : 0);
}

async function crawlSchool(browser, site, out) {
  const ctx = await browser.newContext({ userAgent: UA, javaScriptEnabled: true, ignoreHTTPSErrors: false });
  const page = await ctx.newPage();
  const base = new URL(site.website);
  const root = base.host.replace(/^www\./, "");
  let allowed = () => true;
  const log = [];
  try {
    const r = await ctx.request.get(new URL("/robots.txt", base).href, { timeout: 15000 });
    if (r.ok()) allowed = robotsRules(await r.text());
  } catch {}
  const queue = [[100, base.href]];
  const seen = new Set();
  const found = [];
  let fetched = 0;
  while (queue.length && fetched < MAX_PAGES) {
    queue.sort((a, b) => b[0] - a[0]);
    const [, url] = queue.shift();
    const clean = url.split("#")[0];
    if (seen.has(clean)) continue;
    seen.add(clean);
    if (!allowed(clean)) { log.push(["robots", clean]); continue; }
    await sleep(DELAY_MS);
    fetched++;
    try {
      let text = "";
      let isPdf = /\.pdf(\?|$)/i.test(clean);
      if (isPdf) {
        const res = await ctx.request.get(clean, { timeout: 30000 });
        const buf = await res.body();
        if (!res.ok() || buf.length > 8_000_000 || buf.slice(0, 4).toString() !== "%PDF") { log.push([String(res.status()), clean]); continue; }
        const tmp = path.join(out, "tmp.pdf");
        fs.writeFileSync(tmp, buf);
        try { text = execFileSync("pdftotext", ["-layout", tmp, "-"], { timeout: 60000, maxBuffer: 50e6 }).toString(); } catch { text = ""; }
      } else {
        const res = await page.goto(clean, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (!res || res.status() >= 400) { log.push([String(res && res.status()), clean]); continue; }
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        text = await page.evaluate(() => document.body ? document.body.innerText : "");
        const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => [a.href, (a.innerText || a.title || "").slice(0, 120)]));
        for (const [href, label] of links) {
          if (!/^https?:/.test(href) || SKIP.test(href)) continue;
          const same = new URL(href).host.replace(/^www\./, "") === root;
          const pdf = /\.pdf(\?|$)/i.test(href);
          if (!same && !pdf) continue;
          const hay = href + " " + label;
          const pri = (LINK.test(hay) ? 40 : 0) + (pdf && LINK.test(hay) ? 30 : 0) + (STRONG.test(hay) ? 25 : 0);
          if (pri) queue.push([pri, href]);
        }
      }
      const s = score(text, clean);
      if ((text.match(CAL) || []).length && s >= 12) {
        const name = crypto.createHash("sha1").update(clean).digest("hex").slice(0, 12) + (isPdf ? ".pdf.txt" : ".txt");
        fs.writeFileSync(path.join(out, "docs", name), `SOURCE: ${clean}\n\n${text.slice(0, 120000)}`);
        found.push({ url: clean, pdf: isPdf, score: s, file: name });
      }
    } catch (e) {
      log.push([e.name || "Error", clean]);
    }
  }
  await ctx.close();
  found.sort((a, b) => b.score - a.score);
  return { ...site, fetched, candidates: found.slice(0, 6), log: log.slice(0, 20) };
}

(async () => {
  const [sitesFile, out] = process.argv.slice(2);
  const sites = JSON.parse(fs.readFileSync(sitesFile, "utf8"));
  fs.mkdirSync(path.join(out, "docs"), { recursive: true });
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  const results = [];
  let i = 0;
  async function worker() {
    while (i < sites.length) {
      const site = sites[i++];
      const r = await crawlSchool(browser, site, out).catch((e) => ({ ...site, fetched: 0, candidates: [], log: [[String(e).slice(0, 80)]] }));
      results.push(r);
      console.log((r.candidates.length ? "FOUND " : "none  ") + site.school, r.fetched, r.candidates[0] ? r.candidates[0].url : "");
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 1));
  await browser.close();
})();
