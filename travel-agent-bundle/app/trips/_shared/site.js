/* =============================================================
   Yatra. — shared site behavior
   - Refresh modal (copies regeneration prompt to clipboard)
   - Parallax (rAF-throttled, mobile + reduced-motion guards)
   - Reveal-on-scroll for cards
   ============================================================= */

(function () {
  'use strict';

  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parallaxEnabled = !isMobile && !reduceMotion;

  /* helper: build SVG element from path attrs */
  function svg(viewBox, paths, cls) {
    const ns = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(ns, 'svg');
    el.setAttribute('viewBox', viewBox);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '2');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    if (cls) el.setAttribute('class', cls);
    paths.forEach((d) => {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      el.appendChild(p);
    });
    return el;
  }

  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    });
    if (kids) kids.forEach((k) => n.appendChild(k));
    return n;
  }

  // Stale-data helpers — YatraData marks objects with a non-enumerable `_stale`
  // when the live SerpAPI fetch failed (quota / network) and we fell back to
  // sessionStorage cache. UI surfaces show a muted badge so the user knows the
  // numbers are not fresh.
  function staleInfo(v) {
    return v && typeof v === 'object' ? v._stale : null;
  }
  function formatAge(ms) {
    const min = Math.round(ms / 60000);
    if (min < 60) return min + 'm ago';
    const hr = Math.round(min / 60);
    if (hr < 24) return hr + 'h ago';
    const d = Math.round(hr / 24);
    return d + 'd ago';
  }
  function makeStaleBadge(stale, label) {
    const badge = el('span', { class: 'stale-badge' });
    const reason = stale.reason === 'quota' ? 'live limit reached' : 'live fetch failed';
    badge.title = (label || 'Showing cached value') + ' — ' + reason + ' · cached ' + formatAge(stale.ageMs || 0);
    badge.append('cached · ' + formatAge(stale.ageMs || 0));
    return badge;
  }

  /* ========== REFRESH MODAL ========== */
  function buildRefreshModal() {
    const trigger = document.querySelector('[data-refresh-trigger]');
    if (!trigger) return;

    const promptText = trigger.dataset.refreshPrompt || 'Refresh this trip with the latest data and regenerate the page.';
    const tripName = trigger.dataset.refreshName || 'this trip';

    const title = el('h3', { id: 'refresh-title', text: `Refresh ${tripName}` });

    const sub1 = el('p', {
      class: 'modal-sub',
      text: 'This will re-run the full planner: re-check fares, re-verify hotels, refresh the itinerary, and overwrite this page with the latest content. Sources older than today will be replaced.',
    });

    const sub2 = el('p', { class: 'modal-sub' });
    sub2.style.marginBottom = '14px';
    sub2.append('Click ');
    const s1 = el('strong', { text: 'Run with Claude' });
    s1.style.color = 'var(--ink)';
    sub2.appendChild(s1);
    sub2.append(' to start the refresh in the background — a status toast will appear bottom-right and offer a reload button when it finishes. If the local proxy isn\'t running, fall back to ');
    const s2 = el('strong', { text: 'Copy prompt' });
    s2.style.color = 'var(--ink)';
    sub2.appendChild(s2);
    sub2.append(' and paste into a fresh Claude Code session.');

    const promptBox = el('pre', { class: 'modal-prompt', id: 'refresh-prompt', text: promptText });

    const cancelBtn = el('button', { class: 'btn btn-ghost btn-sm', 'data-modal-close': '', text: 'Cancel' });

    const copyIcon = svg('0 0 24 24', [
      'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
      'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
    ], 'icon icon-sm');
    const copyBtn = el('button', { class: 'btn btn-ghost btn-sm', 'data-copy-prompt': '' }, [copyIcon]);
    copyBtn.append(' Copy prompt');

    const runIcon = svg('0 0 24 24', [
      'M5 3v18l15-9z',
    ], 'icon icon-sm');
    const runBtn = el('button', { class: 'btn btn-saffron btn-sm', 'data-run-claude': '' }, [runIcon]);
    runBtn.append(' Run with Claude');

    const actions = el('div', { class: 'modal-actions' }, [cancelBtn, copyBtn, runBtn]);

    const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'refresh-title' },
      [title, sub1, sub2, promptBox, actions]);

    const backdrop = el('div', { class: 'modal-backdrop' }, [modal]);
    document.body.appendChild(backdrop);

    /* feedback toast */
    const checkIcon = svg('0 0 24 24', ['M20 6 9 17l-5-5'], 'icon icon-sm');
    const feedback = el('div', { class: 'copy-feedback' }, [checkIcon]);
    feedback.append(' Prompt copied — paste into Claude Code');
    document.body.appendChild(feedback);

    const open = () => backdrop.classList.add('open');
    const close = () => backdrop.classList.remove('open');

    trigger.addEventListener('click', open);
    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) close();
      if (ev.target.closest('[data-modal-close]')) close();
      if (ev.target.closest('[data-copy-prompt]')) {
        const txt = document.getElementById('refresh-prompt').innerText;
        navigator.clipboard.writeText(txt).then(() => {
          feedback.classList.add('show');
          setTimeout(() => feedback.classList.remove('show'), 2400);
          close();
        });
      }
      if (ev.target.closest('[data-run-claude]')) {
        const txt = document.getElementById('refresh-prompt').innerText;
        runRefreshWithClaude(txt, tripName);
        close();
      }
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') close();
    });
  }

  /* Hand off the refresh prompt to the agent + toast.
   * Falls back to copying the prompt if AgentToast / proxy unavailable. */
  function runRefreshWithClaude(promptText, label) {
    if (!window.AgentToast) {
      navigator.clipboard.writeText(promptText).catch(() => {});
      alert('Local Claude proxy not loaded. Prompt copied — paste into a fresh Claude Code session.');
      return;
    }
    AgentToast.start({
      prompt: promptText,
      label: 'Refresh: ' + (label || 'this trip'),
      tools: 'edit',
    }).catch((err) => {
      console.warn('[refresh] proxy unavailable, falling back to copy', err);
      navigator.clipboard.writeText(promptText).catch(() => {});
      alert('Could not reach the local proxy at /api/agent/runs.\nPrompt copied — paste into a fresh Claude Code session.\n\n' + (err.message || ''));
    });
  }

  /* ========== PARALLAX ========== */
  function initParallax() {
    if (!parallaxEnabled) return;
    const els = document.querySelectorAll('[data-parallax]');
    if (els.length === 0) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const sy = window.scrollY;
        els.forEach((node) => {
          const speed = parseFloat(node.dataset.parallax) || 0.15;
          const rect = node.getBoundingClientRect();
          if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
          const offset = (rect.top + sy - window.innerHeight * 0.5) * speed * -1;
          node.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
        });
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ========== REVEAL ON SCROLL ========== */
  function initReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (els.length === 0) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.style.opacity = 1;
          e.target.style.transform = 'translateY(0)';
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    els.forEach((node, i) => {
      node.style.opacity = 0;
      node.style.transform = 'translateY(24px)';
      const delay = (i % 6) * 0.05;
      node.style.transition = `opacity .7s ${delay}s cubic-bezier(.2,.8,.2,1), transform .7s ${delay}s cubic-bezier(.2,.8,.2,1)`;
      io.observe(node);
    });
  }

  /* ========== TAB SWITCHING ========== */
  function initTabs() {
    document.querySelectorAll('[data-tabs]').forEach((root) => {
      const tabs = root.querySelectorAll('[data-tab]');
      const panels = document.querySelectorAll('[data-panel]');
      tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.tab;
          tabs.forEach((t) => t.classList.toggle('active', t === tab));
          panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === target));
        });
      });
    });
  }

  /* ========== PIN STATE (localStorage) ========== */
  const PIN_KEY = 'yatra:pinned-recommendations';
  function getPinned() {
    try { return JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); } catch (_) { return []; }
  }
  function setPinned(list) { localStorage.setItem(PIN_KEY, JSON.stringify(list)); }
  function togglePin(id) {
    const list = getPinned();
    const idx = list.indexOf(id);
    if (idx === -1) list.push(id); else list.splice(idx, 1);
    setPinned(list);
    return list.includes(id);
  }
  function isPinned(id) { return getPinned().includes(id); }

  /* ========== ICON HELPER ========== */
  function iconUse(id, cls) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('class', cls || 'icon');
    const u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#' + id);
    s.appendChild(u);
    return s;
  }

  /* ========== RECOMMENDATIONS RENDER ========== */
  function renderRecommendations(recsRoot, recs, schoolPdfUrl) {
    if (!recsRoot) return;
    recsRoot.replaceChildren();
    recs.forEach((r, i) => {
      const card = el('article', { class: 'rec-card' + (i === 0 ? ' featured' : ''), 'data-reveal': '' });

      // ---- Image cover with score badge + school banner ----
      const imgWrap = el('div', { class: 'rec-image' });
      if (r.image) {
        const bg = el('div', { class: 'rec-image-bg' });
        bg.style.backgroundImage = "url('" + r.image + "')";
        imgWrap.appendChild(bg);
      }
      // weather chip (loads asynchronously)
      if (r.lat && r.lon && window.YatraData) {
        const wx = el('div', { class: 'rec-weather-chip wx-loading' });
        wx.appendChild(iconUse('i-clock', 'icon'));
        wx.append(' Loading weather…');
        imgWrap.appendChild(wx);
        window.YatraData.Weather.forecast(r.lat, r.lon, 7).then((fc) => {
          const sum = window.YatraData.Weather.summary(fc);
          if (!sum) {
            wx.classList.remove('wx-loading');
            wx.replaceChildren();
            wx.appendChild(iconUse('i-clock', 'icon'));
            wx.append(' Weather n/a');
            return;
          }
          wx.classList.remove('wx-loading');
          wx.replaceChildren();
          wx.appendChild(iconUse('i-clock', 'icon'));
          const txt = `${sum.tmin}–${sum.tmax}°C · ${sum.rainTotal}mm`;
          const span = el('span', { text: txt });
          if (parseFloat(sum.rainTotal) > 50 || sum.tmax >= 38) span.classList.add('wx-bad');
          else if (parseFloat(sum.rainTotal) < 20 && sum.tmax <= 32) span.classList.add('wx-good');
          wx.appendChild(span);
        });
      }
      // score
      imgWrap.appendChild(el('div', { class: 'rec-score-badge', text: String(r.score || 0) }));
      // school status banner
      if (r.school_status) {
        const banner = el('div', { class: 'rec-school-banner' });
        banner.appendChild(iconUse('i-calendar', 'icon'));
        const txt = el('div', { class: 'rec-school-text', title: r.school_status });
        const strong = el('strong', { text: 'School: ' });
        txt.appendChild(strong);
        txt.append(r.school_status);
        banner.appendChild(txt);
        const verifyUrl = r.school_verify_url || schoolPdfUrl;
        if (verifyUrl) {
          const a = el('a', { href: verifyUrl, target: '_blank', rel: 'noopener', text: 'Verify' });
          banner.appendChild(a);
        }
        imgWrap.appendChild(banner);

        // Async: if this window overlaps an Indian gazetted holiday, append a tag
        const dates = parseRecWindow(r.window);
        if (dates && window.YatraData) {
          const tripStart = new Date(dates.depart);
          const tripEnd = new Date(dates.return);
          const yrs = new Set([tripStart.getFullYear(), tripEnd.getFullYear()]);
          Promise.all(Array.from(yrs).map((y) => window.YatraData.Holidays.list('IN', y))).then((lists) => {
            const all = [].concat(...lists);
            const hits = all.filter((h) => {
              const d = new Date(h.date.iso);
              if (d < tripStart || d > tripEnd) return false;
              const primary = (h.primary_type || '').toLowerCase();
              return primary.includes('gazetted');
            });
            if (hits.length > 0) {
              const tag = el('span');
              tag.style.cssText = 'margin-left:6px;padding:2px 8px;border-radius:999px;background:var(--saffron);color:white;font-size:10px;font-weight:600;';
              tag.append('+' + hits.length + ' holiday');
              tag.title = hits.map((h) => h.name + ' (' + h.date.iso + ')').join(', ');
              const hostText = banner.querySelector('.rec-school-text');
              if (hostText) hostText.appendChild(tag);
            }
          }).catch(() => {});
        }
      }
      card.appendChild(imgWrap);

      // ---- Body ----
      const body = el('div', { class: 'rec-body' });

      const eyebrowText = (r.tags || []).slice(0, 2).join(' · ').toUpperCase() || 'RECOMMENDED';
      const eyebrow = el('div', { class: 'rec-eyebrow' });
      eyebrow.appendChild(iconUse('i-sparkles', 'icon icon-sm'));
      eyebrow.append(' ' + eyebrowText);
      body.appendChild(eyebrow);

      body.appendChild(el('h3', { text: r.destination }));

      const meta = el('div', { class: 'rec-meta-line' });
      const mwhen = el('span'); mwhen.appendChild(iconUse('i-calendar', 'icon')); mwhen.append(' ' + r.window);
      const mnights = el('span'); mnights.appendChild(iconUse('i-clock', 'icon')); mnights.append(' ' + r.nights + ' nights');
      const mtype = el('span'); mtype.appendChild(iconUse('i-pin', 'icon')); mtype.append(' ' + r.type);
      meta.appendChild(mwhen); meta.appendChild(mnights); meta.appendChild(mtype);
      body.appendChild(meta);

      body.appendChild(el('p', { class: 'rec-headline', text: '"' + r.headline + '"' }));

      const ul = el('ul', { class: 'rec-rationale' });
      (r.rationale || []).slice(0, 5).forEach((line) => {
        ul.appendChild(el('li', { text: line }));
      });
      body.appendChild(ul);

      if (r.loyalty_play) {
        const loy = el('div', { class: 'rec-loyalty' });
        const strong = el('strong', { text: 'Loyalty: ' });
        loy.appendChild(strong);
        loy.append(r.loyalty_play);
        body.appendChild(loy);
      }

      if (r.warnings && r.warnings.length > 0) {
        const w = el('div', { class: 'rec-warnings' });
        const strong = el('strong', { text: 'Watch: ' });
        w.appendChild(strong);
        w.append(r.warnings.join(' · '));
        body.appendChild(w);
      }

      const tagsWrap = el('div', { class: 'rec-tags' });
      (r.tags || []).forEach((t) => {
        tagsWrap.appendChild(el('span', { class: 'rec-tag', text: t }));
      });
      body.appendChild(tagsWrap);

      // Creator-mention badge — async, drops in if corpus has matches
      if (window.YatraData && window.YatraData.Influencers && r.destination) {
        const primaryCity = (r.destination || '').split(/[,+]/)[0].trim();
        if (primaryCity) {
          const badge = el('div', { class: 'creator-mention-badge', text: 'creators…' });
          body.appendChild(badge);
          window.YatraData.Influencers.creatorCount(primaryCity).then((n) => {
            if (!n) { badge.remove(); return; }
            badge.replaceChildren();
            badge.append(n + ' creator' + (n === 1 ? '' : 's') + ' mention this');
          }).catch(() => { badge.remove(); });
        }
      }

      // ---- Footer (cost + buttons) ----
      const foot = el('div', { class: 'rec-foot' });
      const costWrap = el('div');
      costWrap.style.display = 'flex';
      costWrap.style.flexDirection = 'column';
      costWrap.style.gap = '4px';
      costWrap.appendChild(el('span', { class: 'rec-cost', text: r.est_cost }));
      // live flight badge — fetches asynchronously through proxy
      const dest = pickIataForFlights(r);
      const dates = parseRecWindow(r.window);
      if (dest && dates && window.YatraData) {
        const fl = el('span', { class: 'rec-flight-badge loading' });
        fl.appendChild(iconUse('i-plane', 'icon'));
        fl.append(' Loading live fare…');
        costWrap.appendChild(fl);
        window.YatraData.Flights.snapshot({
          origin: 'BLR',
          destination: dest,
          departDate: dates.depart,
          returnDate: dates.return,
          pax: 4,
          kidAges: '6,9',
        }).then((snap) => {
          if (!snap || !snap.price) {
            fl.classList.remove('loading');
            fl.replaceChildren();
            fl.appendChild(iconUse('i-plane', 'icon'));
            fl.append(' Live fare unavailable');
            return;
          }
          fl.classList.remove('loading');
          fl.replaceChildren();
          fl.appendChild(iconUse('i-plane', 'icon'));
          const stale = staleInfo(snap);
          // SerpAPI's price is per-trip total for the pax we requested
          const formatted = '₹' + snap.price.toLocaleString('en-IN');
          const prefix = stale ? ' Cached: ' : ' Live: ';
          fl.append(prefix + formatted + ' (' + (snap.carriers[0] || '?') + ')');
          fl.title = (stale ? 'Cached SerpAPI price' : 'Real-time SerpAPI price') + ' for 4 pax · ' + (snap.carriers || []).join(' / ');
          if (stale) fl.appendChild(makeStaleBadge(stale, 'Last live fare'));
        });
      }
      foot.appendChild(costWrap);
      const actions = el('div', { class: 'rec-foot-actions' });
      const pinBtn = el('button', { class: 'btn-pin' + (isPinned(r.id) ? ' pinned' : ''), 'data-pin-id': r.id });
      pinBtn.appendChild(iconUse('i-bookmark', 'icon'));
      pinBtn.append(' ');
      pinBtn.append(document.createTextNode(isPinned(r.id) ? 'Pinned' : 'Pin'));
      pinBtn.addEventListener('click', () => {
        const nowPinned = togglePin(r.id);
        pinBtn.classList.toggle('pinned', nowPinned);
        pinBtn.lastChild.textContent = nowPinned ? 'Pinned' : 'Pin';
        renderPinned();
      });
      const planBtn = el('button', { class: 'btn btn-primary btn-sm', 'data-plan-id': r.id });
      planBtn.appendChild(iconUse('i-arrow-right', 'icon icon-sm'));
      planBtn.append(' Plan this');
      planBtn.addEventListener('click', () => openPlanModal(r));
      actions.appendChild(pinBtn);
      actions.appendChild(planBtn);
      foot.appendChild(actions);
      body.appendChild(foot);

      card.appendChild(body);
      recsRoot.appendChild(card);
    });
  }

  /* ========== PLAN-THIS MODAL (re-uses refresh modal styles) ========== */
  function openPlanModal(r) {
    let bd = document.getElementById('plan-modal');
    if (!bd) {
      bd = el('div', { class: 'modal-backdrop', id: 'plan-modal' });
      document.body.appendChild(bd);
    }
    bd.replaceChildren();
    const m = el('div', { class: 'modal' });
    m.appendChild(el('h3', { text: 'Plan ' + r.destination }));
    m.appendChild(el('p', { class: 'modal-sub', text: 'Click Run with Claude to build a full trip page at trips/' + slugify(r.id) + '/index.html and add it to the hub. A status toast will appear bottom-right; reload the page when it finishes. Or copy the prompt to paste manually.' }));
    const promptText = buildPlanPrompt(r);
    const pre = el('pre', { class: 'modal-prompt', id: 'plan-prompt-text', text: promptText });
    m.appendChild(pre);
    const actions = el('div', { class: 'modal-actions' });
    const cancel = el('button', { class: 'btn btn-ghost btn-sm', 'data-modal-close': '', text: 'Cancel' });
    cancel.addEventListener('click', () => bd.classList.remove('open'));
    const copy = el('button', { class: 'btn btn-ghost btn-sm' });
    copy.appendChild(iconUse('i-sparkles', 'icon icon-sm'));
    copy.append(' Copy prompt');
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(promptText).then(() => {
        const fb = document.querySelector('.copy-feedback');
        if (fb) { fb.classList.add('show'); setTimeout(() => fb.classList.remove('show'), 2400); }
        bd.classList.remove('open');
      });
    });
    const run = el('button', { class: 'btn btn-saffron btn-sm' });
    run.appendChild(iconUse('i-sparkles', 'icon icon-sm'));
    run.append(' Run with Claude');
    run.addEventListener('click', () => {
      bd.classList.remove('open');
      runPlanWithClaude(promptText, r.destination);
    });
    actions.appendChild(cancel); actions.appendChild(copy); actions.appendChild(run);
    m.appendChild(actions);
    bd.appendChild(m);
    bd.classList.add('open');
    bd.addEventListener('click', (ev) => { if (ev.target === bd) bd.classList.remove('open'); }, { once: false });
  }

  function runPlanWithClaude(promptText, destination) {
    if (!window.AgentToast) {
      navigator.clipboard.writeText(promptText).catch(() => {});
      alert('Local Claude proxy not loaded. Prompt copied — paste into a fresh Claude Code session.');
      return;
    }
    AgentToast.start({
      prompt: promptText,
      label: 'Plan: ' + destination,
      tools: 'edit',
    }).catch((err) => {
      console.warn('[plan] proxy unavailable, falling back to copy', err);
      navigator.clipboard.writeText(promptText).catch(() => {});
      alert('Could not reach the local proxy at /api/agent/runs.\nPrompt copied — paste into a fresh Claude Code session.\n\n' + (err.message || ''));
    });
  }

  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // Parse "Sat Jul 18 → Sat Jul 25, 2026" into ISO depart + return.
  // Falls back gracefully on unparseable input.
  function parseRecWindow(window) {
    if (!window) return null;
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    // Match pattern like "Sat Jul 18 → Sat Jul 25, 2026" OR "Sat Dec 12, 2026 → Sun Jan 3, 2027"
    const re = /(\w{3})\s+(\d{1,2})(?:,\s*(\d{4}))?\s*[→\-]\s*\w{3}\s+(\w{3})\s+(\d{1,2}),?\s*(\d{4})/;
    const m = window.match(re);
    if (!m) return null;
    const depMonth = months[m[1]];
    const depDay = String(m[2]).padStart(2, '0');
    const retMonth = months[m[4]];
    const retDay = String(m[5]).padStart(2, '0');
    const retYear = m[6];
    const depYear = m[3] || retYear;  // depart-year often omitted when same year as return
    if (!depMonth || !retMonth) return null;
    return {
      depart: `${depYear}-${depMonth}-${depDay}`,
      return: `${retYear}-${retMonth}-${retDay}`,
    };
  }

  function pickIataForFlights(r) {
    if (!r.iata) return null;
    // grab the first 3-letter code (handles "CDG / FCO", "NRT/HND")
    const m = r.iata.match(/[A-Z]{3}/);
    return m ? m[0] : null;
  }

  function buildPlanPrompt(r) {
    return [
      'Build a full trip plan for: ' + r.destination + '.',
      '',
      'Window: ' + r.window + ' (' + r.nights + ' nights). Travelers: family of 4 (adults + kids 6 and 9).',
      '',
      'Use the orchestrator skill chain (holiday-date-picker → destination-curator → travel-deals-finder → points-miles-optimizer → hotel-cash-vs-points → budget-envelope → itinerary-builder → trip-prep-checklist).',
      '',
      'Hard rules from .workspace/user_travel_prefs.md:',
      '- BLR origin. Vegetarian only.',
      '- Kids must not miss school days.',
      '- 5-star hotel preference, Marriott Bonvoy first, Hilton fallback.',
      '- Marriott 40K free-night cert (expires 2026-12-31) — evaluate as a candidate.',
      '- Lux ₹7L per-trip cap with per-category split.',
      '',
      'Build a microsite at trips/' + slugify(r.id) + '/index.html that includes:',
      '1. Hero + side-by-side compare (if 2+ options surface).',
      '2. Day-by-day timeline with inline booking chips on every row (flights / hotels / cabs / restaurants — Booking.com searches for unverified hotels, Google Maps for restaurants and sites).',
      '3. Costs roll-up vs Lux cap.',
      '4. Comprehensive door-to-door logistics: home → BLR airport (Uber Reserve), airport logistics (lounges, immigration), flight, arrival airport, transfer to hotel, daily cars, return.',
      '5. Transport section with Savaari outstation, Uber/Ola, airport transfers — all with direct links.',
      '6. Visa + travel-insurance + safety + health considerations.',
      '7. Vegetarian restaurant + local-specialty + heritage anchors.',
      '8. Refresh button + post-trip-update prompt button.',
      '',
      'Then update trips/index.html to add this trip card and remove the corresponding recommendation card from trips/_shared/data/recommendations.json by marking it as "planned".',
      '',
      'Reasons this was recommended (use as planning context):',
      ...(r.rationale || []).map((x) => '  - ' + x),
      '',
      'Loyalty play to evaluate: ' + (r.loyalty_play || '(none specified)'),
    ].join('\n');
  }

  /* ========== PINNED RAIL ========== */
  function renderPinned() {
    const root = document.getElementById('pinned-rail-list');
    if (!root) return;
    const pinnedIds = getPinned();
    const allRecs = window.__YATRA_RECS__ || [];
    const items = allRecs.filter((r) => pinnedIds.includes(r.id));
    root.replaceChildren();
    if (items.length === 0) {
      const empty = el('div', { class: 'pinned-empty', text: 'Nothing pinned yet — pin recommendations below to keep them on the front page.' });
      root.appendChild(empty);
      return;
    }
    items.forEach((r) => {
      const card = el('div', { class: 'pinned-card' });
      const left = el('div');
      left.appendChild(el('div', { text: r.destination, style: 'font-family: Fraunces, serif; font-size: 18px; font-weight: 500;' }));
      left.appendChild(el('div', { text: r.window + ' · ' + r.est_cost, style: 'font-size: 12px; color: var(--ink-soft); margin-top: 2px;' }));
      const planBtn = el('button', { class: 'btn btn-primary btn-sm' });
      planBtn.appendChild(iconUse('i-arrow-right', 'icon icon-sm'));
      planBtn.append(' Plan');
      planBtn.addEventListener('click', () => openPlanModal(r));
      card.appendChild(left);
      card.appendChild(planBtn);
      root.appendChild(card);
    });
  }

  /* ========== JOURNAL TIMELINE ========== */
  function renderJournal(rootId, visited) {
    const root = document.getElementById(rootId);
    if (!root) return;
    // group by year, descending
    const byYear = {};
    visited.forEach((v) => {
      if (!byYear[v.year]) byYear[v.year] = [];
      byYear[v.year].push(v);
    });
    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
    root.replaceChildren();
    years.forEach((y) => {
      const row = el('div', { class: 'year-row', 'data-reveal': '', 'data-year': String(y) });
      row.appendChild(el('div', { class: 'year-label', text: String(y) }));
      const wrap = el('div', { class: 'year-trips' });
      byYear[y].forEach((v) => {
        const isIntl = v.country !== 'India';
        const pill = el('span', { class: 'trip-pill' + (isIntl ? ' intl' : '') });
        pill.appendChild(iconUse('i-pin', 'icon'));
        pill.append(' ' + v.city + ', ' + v.country);
        if (v.month) {
          const mo = el('span', { class: 'pill-month', text: ' · ' + v.month });
          pill.appendChild(mo);
        }
        wrap.appendChild(pill);
      });
      row.appendChild(wrap);
      root.appendChild(row);
    });

    // map sync: hovering a year highlights pins for that year
    if (window.__yatraMap && window.__yatraMarkersByYear) {
      root.querySelectorAll('.year-row').forEach((rowEl) => {
        const y = parseInt(rowEl.dataset.year, 10);
        rowEl.addEventListener('mouseenter', () => highlightYear(y));
        rowEl.addEventListener('mouseleave', () => highlightYear(null));
        rowEl.addEventListener('click', () => zoomToYear(y));
      });
    }
  }

  /* ========== JOURNAL MAP ========== */
  function renderJournalMap(visited) {
    if (typeof L === 'undefined') return; // Leaflet not loaded
    const mapEl = document.getElementById('journal-map');
    if (!mapEl) return;

    // Group entries by city to make multi-visit pins
    const byCity = {};
    visited.forEach((v) => {
      if (!v.lat || !v.lon) return;
      const key = v.city + '|' + v.country;
      if (!byCity[key]) byCity[key] = { ...v, visits: [] };
      byCity[key].visits.push({ year: v.year, month: v.month });
    });

    const map = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false,
      worldCopyJump: true,
    }).setView([20, 60], 2);
    window.__yatraMap = map;

    // Use CartoDB Positron — clean, light, free, OSM-friendly
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    const markersByYear = {};
    const allMarkers = [];
    Object.values(byCity).forEach((item) => {
      const isIntl = item.country !== 'India';
      const isMulti = item.visits.length > 1;
      const cls = isMulti ? 'multi' : (isIntl ? 'intl' : 'dom');
      const html = isMulti
        ? `<div class="yatra-pin multi">${item.visits.length}</div>`
        : `<div class="yatra-pin ${cls}"></div>`;
      const icon = L.divIcon({
        html,
        className: 'yatra-pin-wrap',
        iconSize: isMulti ? [24, 24] : [18, 18],
        iconAnchor: isMulti ? [12, 12] : [9, 9],
      });
      const marker = L.marker([item.lat, item.lon], { icon }).addTo(map);

      // sort visits descending
      const visitsSorted = [...item.visits].sort((a, b) => b.year - a.year);
      const visitList = visitsSorted
        .map((v) => v.month ? `${v.month} ${v.year}` : String(v.year))
        .join(' · ');
      const popup = `<strong>${item.city}, ${item.country}</strong><div class="pop-visits">${item.visits.length} visit${item.visits.length > 1 ? 's' : ''}: ${visitList}</div>`;
      marker.bindPopup(popup);

      visitsSorted.forEach((v) => {
        if (!markersByYear[v.year]) markersByYear[v.year] = [];
        markersByYear[v.year].push(marker);
      });
      allMarkers.push(marker);
    });

    window.__yatraMarkersByYear = markersByYear;
    window.__yatraAllMarkers = allMarkers;

    // Default fit-to-bounds
    if (allMarkers.length) {
      const group = L.featureGroup(allMarkers);
      map.fitBounds(group.getBounds().pad(0.15), { animate: false });
    }

    // Re-attach hover handlers if timeline already rendered
    document.querySelectorAll('#journal-timeline .year-row').forEach((rowEl) => {
      const y = parseInt(rowEl.dataset.year, 10);
      rowEl.addEventListener('mouseenter', () => highlightYear(y));
      rowEl.addEventListener('mouseleave', () => highlightYear(null));
      rowEl.addEventListener('click', () => zoomToYear(y));
    });
  }

  function highlightYear(year) {
    if (!window.__yatraAllMarkers) return;
    window.__yatraAllMarkers.forEach((m) => {
      const elNode = m.getElement();
      if (elNode) {
        const inner = elNode.querySelector('.yatra-pin');
        if (inner) inner.style.opacity = '0.25';
      }
    });
    if (year && window.__yatraMarkersByYear[year]) {
      window.__yatraMarkersByYear[year].forEach((m) => {
        const elNode = m.getElement();
        if (elNode) {
          const inner = elNode.querySelector('.yatra-pin');
          if (inner) inner.style.opacity = '1';
        }
      });
    } else if (!year) {
      window.__yatraAllMarkers.forEach((m) => {
        const elNode = m.getElement();
        if (elNode) {
          const inner = elNode.querySelector('.yatra-pin');
          if (inner) inner.style.opacity = '1';
        }
      });
    }
  }

  function zoomToYear(year) {
    if (!window.__yatraMap || !window.__yatraMarkersByYear[year]) return;
    const markers = window.__yatraMarkersByYear[year];
    if (markers.length === 1) {
      window.__yatraMap.setView(markers[0].getLatLng(), 6, { animate: true });
    } else {
      const group = L.featureGroup(markers);
      window.__yatraMap.fitBounds(group.getBounds().pad(0.3), { animate: true });
    }
  }

  /* ========== FAVORITES + WISHLIST CHIPS ========== */
  function renderCollection(rootId, items, intlFilter) {
    const root = document.getElementById(rootId);
    if (!root) return;
    root.replaceChildren();
    items.forEach((it) => {
      const isIntl = it.country !== 'India';
      const pill = el('span', { class: 'trip-pill' + (isIntl ? ' intl' : '') });
      pill.appendChild(iconUse('i-pin', 'icon'));
      pill.append(' ' + it.city + ', ' + it.country);
      root.appendChild(pill);
    });
  }

  /* ========== DATA LOADER ========== */
  async function loadData() {
    const recsRoot = document.getElementById('rec-grid');
    const journalRoot = document.getElementById('journal-timeline');
    const favRoot = document.getElementById('fav-list');
    const wishRoot = document.getElementById('wish-list');
    const memStatsRoot = document.getElementById('mem-stats');
    if (!recsRoot && !journalRoot) return;

    try {
      const fetchOpts = { cache: 'no-cache' };
      const [recs, visited, favs, wish] = await Promise.all([
        recsRoot ? fetch('_shared/data/recommendations.json', fetchOpts).then((r) => r.json()) : null,
        journalRoot ? fetch('_shared/data/visited.json', fetchOpts).then((r) => r.json()) : null,
        favRoot ? fetch('_shared/data/favorites.json', fetchOpts).then((r) => r.json()) : null,
        wishRoot ? fetch('_shared/data/wishlist.json', fetchOpts).then((r) => r.json()) : null,
      ]);

      if (recs) {
        window.__YATRA_RECS__ = recs.recommendations || [];
        renderRecommendations(recsRoot, window.__YATRA_RECS__, recs.school_calendar_pdf);
        renderPinned();
        // generated_at meta
        const metaEl = document.getElementById('recs-generated-at');
        if (metaEl && recs.generated_at) metaEl.textContent = 'Generated ' + recs.generated_at + ' · next refresh ' + (recs.next_refresh || '').slice(0, 10);
        // school PDF banner (in section head)
        const schoolPdfEl = document.getElementById('recs-school-pdf');
        if (schoolPdfEl && recs.school_calendar_pdf) {
          schoolPdfEl.href = recs.school_calendar_pdf;
          schoolPdfEl.style.display = 'inline-flex';
        }
        // Live IN holidays strip — Calendarific via proxy
        renderHolidaysStrip();
      }
      if (visited) {
        renderJournalMap(visited);
        renderJournal('journal-timeline', visited);
        if (memStatsRoot) {
          const intl = visited.filter((v) => v.country !== 'India').length;
          const dom = visited.length - intl;
          const countries = new Set(visited.map((v) => v.country)).size;
          const yearsActive = new Set(visited.map((v) => v.year)).size;
          memStatsRoot.replaceChildren();
          [
            { v: visited.length, l: 'Trips logged' },
            { v: countries, l: 'Countries' },
            { v: intl, l: 'International' },
            { v: yearsActive, l: 'Active years' },
          ].forEach(({ v, l }) => {
            const card = el('div', { class: 'memory-stat' });
            card.appendChild(el('div', { class: 'ms-val', text: String(v) }));
            card.appendChild(el('div', { class: 'ms-lbl', text: l }));
            memStatsRoot.appendChild(card);
          });
        }
      }
      if (favs) renderCollection('fav-list', favs);
      if (wish) renderCollection('wish-list', wish);
    } catch (e) {
      console.warn('[yatra] data load failed', e);
    }
  }

  /* ========== LIVE VEG RESTAURANTS (Google Local + Overpass merged) ========== */
  function formatHours(h) {
    if (!h) return null;
    return h
      .replace(/24\/7/g, 'Open 24/7')
      .replace(/PH/g, 'Public holidays')
      .replace(/;/g, ' · ');
  }

  async function renderVegBlock(root) {
    if (typeof root === 'string') root = document.getElementById(root);
    if (!root || !window.YatraData) return;
    const lat = parseFloat(root.dataset.lat);
    const lon = parseFloat(root.dataset.lon);
    const radius = parseInt(root.dataset.radius || '1500', 10);
    const city = root.dataset.city || '';
    const country = root.dataset.country || 'India';
    const location = city ? (city.includes(',') ? city : city + ', ' + country) : '';
    if (!lat || !lon) return;

    try {
      // Run Google Local + Overpass in parallel
      const [googleItems, osmItems] = await Promise.all([
        location ? window.YatraData.GoogleLocal.search({
          q: 'pure vegetarian restaurant',
          location,
        }) : Promise.resolve([]),
        window.YatraData.Restaurants.vegetarianNear(lat, lon, radius),
      ]);

      // Normalize both into one shape
      const merged = [];
      (googleItems || []).forEach((g) => {
        merged.push({
          source: 'google',
          name: g.name,
          rating: g.rating,
          reviews: g.reviews,
          type: g.type || 'Vegetarian',
          hours: g.hours,
          address: g.address,
          mapsUrl: g.mapsUrl,
          zomatoSearchUrl: 'https://www.zomato.com/search?q=' + encodeURIComponent(g.name),
          thumbnail: g.thumbnail,
          phone: g.phone,
          lat: g.gps && g.gps.latitude,
          lon: g.gps && g.gps.longitude,
        });
      });
      // Add OSM-only entries that Google didn't return
      const namesLc = new Set(merged.map((x) => x.name.toLowerCase()));
      (osmItems || []).forEach((o) => {
        if (namesLc.has(o.name.toLowerCase())) return;
        merged.push({
          source: 'osm',
          name: o.name,
          rating: null, reviews: null,
          type: o.cuisine ? o.cuisine.replace(/_/g, ' ').replace(/;/g, ' · ') : 'Vegetarian',
          hours: o.hours ? formatHours(o.hours) : null,
          address: null,
          mapsUrl: o.mapsUrl,
          zomatoSearchUrl: o.zomatoSearchUrl,
          thumbnail: null,
          phone: o.phone,
          website: o.website,
          lat: o.lat,
          lon: o.lon,
        });
      });

      root.replaceChildren();
      const googleStale = staleInfo(googleItems);
      if (merged.length === 0) {
        const msg = googleStale && googleStale.reason === 'quota'
          ? 'Live restaurant data unavailable (rate limit reached). Refresh later.'
          : 'No veg restaurants found via Google or OSM for this area.';
        root.appendChild(el('div', { class: 'veg-loading', text: msg }));
        return;
      }
      if (googleStale) {
        const banner = el('div', { class: 'stale-banner' });
        banner.append('Google ratings/hours below are cached — ');
        banner.appendChild(makeStaleBadge(googleStale, 'Restaurant data'));
        root.appendChild(banner);
      }

      // Sort: highest-rated first, then with hours, then alphabetical
      merged.sort((a, b) => {
        if (a.rating && b.rating) return b.rating - a.rating;
        if (a.rating && !b.rating) return -1;
        if (!a.rating && b.rating) return 1;
        if (a.hours && !b.hours) return -1;
        if (!a.hours && b.hours) return 1;
        return a.name.localeCompare(b.name);
      });

      merged.slice(0, 9).forEach((it) => {
        const cardAttrs = { class: 'veg-card', 'data-reveal': '' };
        if (typeof it.lat === 'number' && typeof it.lon === 'number') {
          cardAttrs['data-lat'] = String(it.lat);
          cardAttrs['data-lon'] = String(it.lon);
          cardAttrs['data-name'] = it.name;
          cardAttrs['data-map-scope'] = 'restaurants';
          cardAttrs.tabindex = '0';
          cardAttrs.role = 'button';
        }
        const card = el('article', cardAttrs);

        if (it.thumbnail) {
          const thumb = el('div', { class: 'veg-card-thumb' });
          thumb.style.backgroundImage = "url('" + it.thumbnail + "')";
          card.appendChild(thumb);
        }

        const head = el('div', { class: 'veg-card-head' });
        const ic = el('div', { class: 'veg-icon' });
        ic.appendChild(iconUse('i-utensils', 'icon'));
        head.appendChild(ic);
        const meta = el('div');
        meta.style.flex = '1';
        const titleLine = el('div', { class: 'veg-card-title' });
        titleLine.append(it.name);
        const srcBadge = el('span', { class: 'veg-card-source ' + it.source, text: it.source === 'google' ? 'Google' : 'OSM' });
        titleLine.appendChild(srcBadge);
        meta.appendChild(titleLine);
        const typeText = (it.type || '').toLowerCase();
        meta.appendChild(el('div', { class: 'veg-card-cuisine', text: typeText }));
        head.appendChild(meta);
        card.appendChild(head);

        // rating
        if (it.rating) {
          const ratingWrap = el('div', { class: 'veg-card-rating' });
          ratingWrap.appendChild(el('span', { class: 'stars', text: '★' }));
          ratingWrap.append(' ' + it.rating.toFixed(1));
          if (it.reviews) {
            const rev = el('span', { class: 'reviews', text: ' · ' + it.reviews.toLocaleString('en-IN') + ' reviews' });
            ratingWrap.appendChild(rev);
          }
          card.appendChild(ratingWrap);
        }

        // hours
        const hoursWrap = el('div', { class: 'veg-card-hours' + (it.hours ? '' : ' unverified') });
        hoursWrap.appendChild(iconUse('i-clock', 'icon'));
        hoursWrap.append(' ' + (it.hours || 'Hours not listed — verify on Maps'));
        card.appendChild(hoursWrap);

        // actions
        const actions = el('div', { class: 'veg-card-actions' });
        const mapsLink = el('a', { class: 'chip', href: it.mapsUrl, target: '_blank', rel: 'noopener' });
        mapsLink.appendChild(iconUse('i-pin', 'icon'));
        mapsLink.append(' Maps');
        actions.appendChild(mapsLink);
        const zomatoLink = el('a', { class: 'chip', href: it.zomatoSearchUrl, target: '_blank', rel: 'noopener' });
        zomatoLink.appendChild(iconUse('i-arrow-up-right', 'icon'));
        zomatoLink.append(' Zomato');
        actions.appendChild(zomatoLink);
        if (it.website) {
          const webLink = el('a', { class: 'chip', href: it.website, target: '_blank', rel: 'noopener' });
          webLink.appendChild(iconUse('i-arrow-up-right', 'icon'));
          webLink.append(' Site');
          actions.appendChild(webLink);
        }
        card.appendChild(actions);

        // TripAdvisor + influencer enrichment per restaurant
        injectTripAdvisor(card, it.name, 'restaurant', city);
        injectInfluencerMention(card, it.name);

        root.appendChild(card);
      });
    } catch (e) {
      console.warn('[veg]', e);
      root.replaceChildren();
      root.appendChild(el('div', { class: 'veg-loading', text: 'Unable to load veg restaurants right now. Refresh to retry.' }));
    }
  }

  function initVegRestaurants() {
    const blocks = Array.from(document.querySelectorAll('.veg-grid'));
    Promise.all(blocks.map((node) => renderVegBlock(node))).then(() => {
      if (window.TripMap && typeof window.TripMap.refresh === 'function') {
        window.TripMap.refresh();
      }
    });
  }

  /* ========== TRIPADVISOR + INFLUENCER ENRICHMENT HELPERS ========== */
  // Resolve a city hint to {country, lat, lon} from window.YATRA_TRIP_DEFAULTS.
  // Trip pages set this once near the top of the page (e.g. JP + Tokyo/Kyoto/Hakone).
  function resolveLocation(cityHint) {
    const defaults = window.YATRA_TRIP_DEFAULTS || {};
    const cities = defaults.cities || [];
    if (cityHint) {
      const m = cities.find((c) => c.name && c.name.toLowerCase() === cityHint.toLowerCase());
      if (m) return { country: defaults.country, city: m.name, lat: m.lat, lon: m.lon };
    }
    // Fall back to the first city if nothing matched.
    if (cities[0]) return { country: defaults.country, city: cities[0].name, lat: cities[0].lat, lon: cities[0].lon };
    return { country: defaults.country };
  }

  // Injects an async TripAdvisor pill into a card. Strips trailing city/parens
  // from name to improve match rate. Type: hotel|attraction|restaurant.
  // Pass cityHint (e.g. 'Tokyo') to constrain the lookup to that city's lat/lon.
  function injectTripAdvisor(card, name, type, cityHint) {
    if (!card || !name || !window.YatraData || !YatraData.TripAdvisor) return;
    const cleanName = name
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/\s+(Tokyo|Kyoto|Hakone|Madurai|Rameswaram|Dwarka|Osaka|Nara)\s*$/i, '')
      .trim();
    const loc = resolveLocation(cityHint);
    const placeholder = el('div', { class: 'ta-pill-row', style: 'margin-top: 8px;' });
    card.appendChild(placeholder);
    YatraData.TripAdvisor.search({
      query: cleanName,
      type,
      lat: loc.lat,
      lon: loc.lon,
      country: loc.country,
      city: loc.city,
    }).then((ta) => {
      if (!ta || !ta.rating) { placeholder.remove(); return; }
      const pill = el('a', {
        class: 'tripadvisor-rating-pill',
        href: ta.url || '#',
        target: '_blank',
        rel: 'noopener',
        title: ta.ranking || '',
      });
      pill.append('TripAdvisor ★ ' + ta.rating);
      if (ta.review_count) {
        pill.append(' · ' + Number(ta.review_count).toLocaleString('en-IN') + ' reviews');
      }
      placeholder.appendChild(pill);
      if (ta.ranking) {
        placeholder.appendChild(el('div', {
          class: 'ta-ranking-note',
          text: ta.ranking,
          style: 'font-size: 11px; color: var(--ink-mute); margin-top: 4px;',
        }));
      }
      // First top review as a callout
      const review = (ta.top_reviews || [])[0];
      if (review && review.text) {
        const reviewBlock = el('details', { class: 'ta-review-details', style: 'margin-top: 8px;' });
        const summary = el('summary', { style: 'cursor: pointer; font-size: 12px; color: var(--ink-soft);' });
        summary.append('Top review ↓');
        reviewBlock.appendChild(summary);
        const quote = el('blockquote', { class: 'ta-review-quote', style: 'margin: 6px 0 0; padding: 8px 12px; background: rgba(20,90,71,0.05); border-left: 2px solid #145a47; border-radius: 6px; font-size: 13px; line-height: 1.4;' });
        quote.textContent = '"' + review.text.slice(0, 280) + (review.text.length > 280 ? '…' : '') + '"';
        reviewBlock.appendChild(quote);
        placeholder.appendChild(reviewBlock);
      }
    }).catch(() => placeholder.remove());
  }

  // Injects "★ <creator> mentioned this" badge if any influencer has a quote
  // about this place name. Falls back to destination-level creator-count badge.
  function injectInfluencerMention(card, name) {
    if (!card || !name || !window.YatraData || !YatraData.Influencers) return;
    const placeholder = el('div', { class: 'influencer-mention-slot', style: 'margin-top: 6px;' });
    card.appendChild(placeholder);
    YatraData.Influencers.quoteForPlace(name).then((q) => {
      if (!q) { placeholder.remove(); return; }
      const badge = el('div', { class: 'creator-mention-badge', style: 'margin-top: 0;' });
      badge.append((q.creator || 'Creator') + ' mentioned this');
      placeholder.appendChild(badge);
      if (q.quote) {
        const quote = el('blockquote', { class: 'influencer-quote compact', style: 'margin-top: 8px; font-size: 13px;' });
        quote.textContent = '"' + q.quote.slice(0, 200) + (q.quote.length > 200 ? '…' : '') + '"';
        if (q.url) {
          const cite = el('cite');
          const a = el('a', { href: q.url, target: '_blank', rel: 'noopener' });
          a.textContent = '— ' + (q.creator || 'creator') + ' (' + (q.source || 'source') + ' ↗)';
          cite.appendChild(a);
          quote.appendChild(cite);
        }
        placeholder.appendChild(quote);
      }
    }).catch(() => placeholder.remove());
  }

  /* ========== CUSTOM TRIP PLANNER FORM ========== */
  function initCustomPlanner() {
    const form = document.getElementById('cp-form');
    if (!form) return;
    const destInput = document.getElementById('cp-dest');
    const departInput = document.getElementById('cp-depart');
    const returnInput = document.getElementById('cp-return');
    const submitBtn = document.getElementById('cp-submit');

    // Sensible date defaults: depart in ~6 weeks, 7-night trip
    if (departInput && !departInput.value) {
      const d = new Date();
      d.setDate(d.getDate() + 42);
      departInput.value = d.toISOString().slice(0, 10);
      departInput.min = new Date().toISOString().slice(0, 10);
    }
    if (returnInput && !returnInput.value) {
      const d = new Date();
      d.setDate(d.getDate() + 49);
      returnInput.value = d.toISOString().slice(0, 10);
    }
    // Keep return ≥ depart
    if (departInput && returnInput) {
      departInput.addEventListener('change', () => {
        if (returnInput.value < departInput.value) {
          const d = new Date(departInput.value);
          d.setDate(d.getDate() + 7);
          returnInput.value = d.toISOString().slice(0, 10);
        }
        returnInput.min = departInput.value;
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const destination = (destInput.value || '').trim();
      if (!destination || !departInput.value || !returnInput.value) return;

      const depart = new Date(departInput.value);
      const ret = new Date(returnInput.value);
      const nights = Math.max(1, Math.round((ret - depart) / (1000 * 60 * 60 * 24)));

      const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const window = `${fmt(depart)} ${depart.getFullYear()} → ${fmt(ret)} ${ret.getFullYear()}`;

      const slug = (depart.toISOString().slice(0, 7).replace('-', '-') + '-' +
        destination.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30));

      // Build a "rec-shaped" object so we can reuse openPlanModal.
      const customRec = {
        id: slug,
        destination,
        country: '',
        iata: '',
        window,
        nights,
        type: 'custom',
        wishlist: false,
        score: 0,
        headline: 'Custom planning request',
        rationale: [
          `Destination: ${destination}`,
          `Window: ${window} (${nights} nights)`,
          'User-specified — not from the recommendation list',
        ],
        est_cost: '(to be sized by orchestrator)',
        loyalty_play: '(to be evaluated based on Marriott/Hilton/Hyatt footprint at destination)',
        warnings: [],
        tags: ['custom'],
      };

      openPlanModal(customRec);
    });
  }

  /* ========== LIVE HOTELS WIDGET ========== */
  async function renderHotelsStop(node) {
    const grid = node.querySelector('.hotels-grid');
    if (!grid || !window.YatraData) return;
    const dest = node.dataset.dest;
    const featuredName = (node.dataset.featuredName || '').toLowerCase();
    try {
      const props = await window.YatraData.Hotels.search({
        dest,
        checkin: node.dataset.checkin,
        checkout: node.dataset.checkout,
        adults: parseInt(node.dataset.adults, 10) || 2,
        kids: parseInt(node.dataset.kids, 10) || 0,
        kidAges: node.dataset.kidAges || '',
        hotelClass: node.dataset.class || '',
      });
      grid.replaceChildren();
      const hotelsStale = staleInfo(props);
      if (!props || props.length === 0) {
        const msg = hotelsStale && hotelsStale.reason === 'quota'
          ? 'Live hotel data unavailable (rate limit reached). Refresh later.'
          : 'No hotels returned for this stop. Try a different class filter.';
        grid.appendChild(el('div', { class: 'veg-loading', text: msg }));
        return;
      }
      if (hotelsStale) {
        const banner = el('div', { class: 'stale-banner' });
        banner.append('Showing last cached hotel rates — ');
        banner.appendChild(makeStaleBadge(hotelsStale, 'Hotel rates'));
        grid.appendChild(banner);
      }
      // Sort: featured-name match first, then those with rates, then by rating desc
      props.sort((a, b) => {
        const aFeat = featuredName && a.name && a.name.toLowerCase().includes(featuredName);
        const bFeat = featuredName && b.name && b.name.toLowerCase().includes(featuredName);
        if (aFeat && !bFeat) return -1;
        if (!aFeat && bFeat) return 1;
        if (a.rate && !b.rate) return -1;
        if (!a.rate && b.rate) return 1;
        return (b.rating || 0) - (a.rating || 0);
      });
      props.slice(0, 6).forEach((p) => {
        const isFeatured = featuredName && p.name && p.name.toLowerCase().includes(featuredName);
        const hotelAttrs = { class: 'hotel-card' + (isFeatured ? ' featured' : ''), 'data-reveal': '' };
        const hotLat = p.gpsCoordinates && p.gpsCoordinates.latitude;
        const hotLon = p.gpsCoordinates && p.gpsCoordinates.longitude;
        if (typeof hotLat === 'number' && typeof hotLon === 'number') {
          hotelAttrs['data-lat'] = String(hotLat);
          hotelAttrs['data-lon'] = String(hotLon);
          hotelAttrs['data-name'] = p.name;
          hotelAttrs['data-map-scope'] = 'hotels';
          hotelAttrs.tabindex = '0';
          hotelAttrs.role = 'button';
        }
        const card = el('article', hotelAttrs);
        if (p.thumbnail) {
          const thumb = el('div', { class: 'hotel-thumb' });
          thumb.style.backgroundImage = "url('" + p.thumbnail + "')";
          card.appendChild(thumb);
        }
        card.appendChild(el('div', { class: 'hotel-class', text: (p.hotelClass || 'Hotel') + (isFeatured ? ' · LOYALTY PLAY' : '') }));
        card.appendChild(el('div', { class: 'hotel-name', text: p.name }));
        if (p.rating) {
          const r = el('div', { class: 'hotel-rating' });
          r.appendChild(el('span', { class: 'stars', text: '★' }));
          r.append(' ' + p.rating.toFixed(1));
          if (p.reviews) {
            r.appendChild(el('span', { class: 'reviews', text: ' · ' + p.reviews.toLocaleString('en-IN') + ' reviews' }));
          }
          card.appendChild(r);
        }
        // TripAdvisor pill — async fetch, append when ready
        const cityHint = (dest || '').split(',')[0].trim();
        injectTripAdvisor(card, p.name, 'hotel', cityHint);
        // Influencer mention badge — link to first matching creator quote
        injectInfluencerMention(card, p.name);
        const foot = el('div', { class: 'hotel-foot' });
        if (p.rate) {
          const rateBox = el('div', { class: 'hotel-rate' });
          rateBox.append(p.rate);
          rateBox.appendChild(el('small', { text: 'per night · ' + (p.totalRate || '') + ' total' }));
          foot.appendChild(rateBox);
        } else {
          foot.appendChild(el('span', { class: 'hotel-no-rate', text: 'Rate on request' }));
        }
        const link = el('a', {
          href: p.link || ('https://www.google.com/travel/hotels/entity?q=' + encodeURIComponent(p.name)),
          target: '_blank', rel: 'noopener',
        });
        link.append('Book →');
        foot.appendChild(link);
        card.appendChild(foot);
        grid.appendChild(card);
      });
    } catch (e) {
      console.warn('[hotels]', e);
      grid.replaceChildren();
      grid.appendChild(el('div', { class: 'veg-loading', text: 'Unable to load hotels right now.' }));
    }
  }
  function initHotels() {
    const stops = Array.from(document.querySelectorAll('[data-hotels-stop]'));
    Promise.all(stops.map((n) => renderHotelsStop(n))).then(() => {
      if (window.TripMap && typeof window.TripMap.refresh === 'function') {
        window.TripMap.refresh();
      }
    });
  }

  /* ========== LIVE COSTS PATCH ========== */
  // Patches cost rows in the trip page with the live numbers we already
  // fetched for flights / hotels. Falls back silently if data unavailable.
  async function initLiveCosts() {
    if (!window.YatraData) return;
    const cards = document.querySelectorAll('[data-live-cost]');
    if (cards.length === 0) return;

    const stamp = new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    cards.forEach((c) => {
      const s = c.querySelector('[data-live-stamp]');
      if (s) s.textContent = 'live as of ' + stamp;
    });

    // Flights
    const flightRows = document.querySelectorAll('[data-live-flight]');
    await Promise.all(Array.from(flightRows).map(async (row) => {
      const key = row.dataset.liveFlight;
      const [origin, destination, departDate, returnDate] = key.split('-').reduce((acc, p, i) => {
        if (i === 0) acc.push(p);
        else if (i === 1) acc.push(p);
        else if (i <= 4) acc[2] = (acc[2] || '') + (acc[2] ? '-' : '') + p;
        else acc[3] = (acc[3] || '') + (acc[3] ? '-' : '') + p;
        return acc;
      }, []);
      // simpler split: BLR-IXM-2026-06-15-2026-06-21
      const parts = key.split('-');
      const orig = parts[0];
      const dest = parts[1];
      const depart = parts.slice(2, 5).join('-');
      const ret = parts.slice(5, 8).join('-');
      try {
        const snap = await window.YatraData.Flights.snapshot({
          origin: orig, destination: dest,
          departDate: depart, returnDate: ret,
          pax: 4, kidAges: '6,9',
        });
        if (snap && snap.price) {
          const note = row.querySelector('[data-live-flight-note]');
          if (note) {
            const stale = staleInfo(snap);
            const label = stale ? '↓ cached' : '↓ live';
            note.textContent = label + ': ₹' + snap.price.toLocaleString('en-IN') + ' · ' + (snap.carriers[0] || '');
            if (stale) note.title = 'Cached ' + formatAge(stale.ageMs || 0) + ' — live limit reached';
          }
        }
      } catch (_) {}
    }));

    // Hotels — sum top property total per stop
    const hotelRows = document.querySelectorAll('[data-live-hotel]');
    await Promise.all(Array.from(hotelRows).map(async (row) => {
      const key = row.dataset.liveHotel;
      // Map stop → list of {dest, checkin, checkout, hotelClass}
      const STOPS = {
        'Madurai-Rameswaram': [
          { dest: 'Madurai', checkin: '2026-06-15', checkout: '2026-06-18', hotelClass: '4,5' },
          { dest: 'Rameswaram', checkin: '2026-06-18', checkout: '2026-06-21', hotelClass: '' },
        ],
        'Dwarka-Jamnagar': [
          { dest: 'Dwarka', checkin: '2026-06-15', checkout: '2026-06-19', hotelClass: '' },
          { dest: 'Jamnagar', checkin: '2026-06-20', checkout: '2026-06-21', hotelClass: '' },
        ],
      };
      const stops = STOPS[key];
      if (!stops) return;
      try {
        const allProps = await Promise.all(stops.map((s) => window.YatraData.Hotels.search({
          dest: s.dest, checkin: s.checkin, checkout: s.checkout,
          adults: 2, kids: 2, kidAges: '6,9', hotelClass: s.hotelClass,
        })));
        // Take cheapest with a rate per stop
        let total = 0;
        let parts = [];
        let anyStale = null;
        allProps.forEach((props, i) => {
          if (!props) return;
          const s = staleInfo(props);
          if (s) anyStale = s;
          const withRate = props.filter((p) => p.totalRate);
          if (!withRate.length) return;
          // Find lowest total
          const cheapest = withRate.reduce((acc, p) => {
            const num = parseInt((p.totalRate || '').replace(/[^\d]/g, ''), 10) || Infinity;
            const accNum = parseInt((acc.totalRate || '').replace(/[^\d]/g, ''), 10) || Infinity;
            return num < accNum ? p : acc;
          });
          const cheapestNum = parseInt((cheapest.totalRate || '').replace(/[^\d]/g, ''), 10) || 0;
          if (cheapestNum) {
            total += cheapestNum;
            parts.push(stops[i].dest + ': ' + cheapest.totalRate);
          }
        });
        if (total > 0) {
          const note = row.querySelector('[data-live-hotel-note]');
          if (note) {
            const label = anyStale ? '↓ cached cheapest combo' : '↓ live cheapest combo';
            note.textContent = label + ': ₹' + total.toLocaleString('en-IN') + ' (' + parts.join(' + ') + ')';
            if (anyStale) note.title = 'Cached ' + formatAge(anyStale.ageMs || 0) + ' — live limit reached';
          }
        }
      } catch (_) {}
    }));
  }

  /* ========== ITINERARY RESTAURANT ENRICHMENT ========== */
  // For each food row with data-rest-name + data-rest-city, fetch veg restaurants
  // for that city once and patch the row with matching live data.
  async function initRestaurantEnrichment() {
    if (!window.YatraData) return;
    const rows = document.querySelectorAll('[data-rest-name][data-rest-city]');
    if (rows.length === 0) return;

    // Batch by city
    const byCity = {};
    rows.forEach((row) => {
      const city = row.dataset.restCity;
      if (!byCity[city]) byCity[city] = [];
      byCity[city].push(row);
    });

    // Fetch each city's veg list in parallel
    const cityResults = {};
    await Promise.all(Object.keys(byCity).map(async (city) => {
      try {
        const items = await window.YatraData.GoogleLocal.search({
          q: 'pure vegetarian restaurant',
          location: city + ', India',
        });
        cityResults[city] = items || [];
      } catch (_) { cityResults[city] = []; }
    }));

    // Match each row to a city result (case-insensitive substring match)
    rows.forEach((row) => {
      const target = row.dataset.restName.toLowerCase();
      const city = row.dataset.restCity;
      const list = cityResults[city] || [];
      const match = list.find((x) => {
        const n = (x.name || '').toLowerCase();
        return n.includes(target) || target.includes(n);
      });
      if (!match) return;

      // Inject a small "live" sub-line into the row content
      const content = row.querySelector('.row-content');
      if (!content) return;
      const live = el('div', { class: 'rest-live' });
      live.style.cssText = 'margin-top: 6px; font-size: 12px; color: rgba(246,241,232,0.85); display: flex; gap: 10px; flex-wrap: wrap; align-items: center;';
      if (match.rating) {
        const r = el('span');
        r.style.cssText = 'background: rgba(245,166,35,0.15); color: #f5c674; padding: 2px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;';
        r.append('★ ' + match.rating.toFixed(1));
        if (match.reviews) r.append(' · ' + match.reviews.toLocaleString('en-IN'));
        live.appendChild(r);
      }
      if (match.hours) {
        const h = el('span');
        h.style.cssText = 'color: rgba(246,241,232,0.7);';
        h.append('🕒 ' + match.hours);
        live.appendChild(h);
      }
      if (match.address) {
        const a = el('span');
        a.style.cssText = 'color: rgba(246,241,232,0.55); font-size: 11px;';
        a.append(match.address);
        live.appendChild(a);
      }
      // Replace existing chips block link with the verified Maps URL
      const chips = content.querySelector('.link-chips');
      if (chips && match.mapsUrl) {
        const mapsChip = chips.querySelector('a[href*="maps"]');
        if (mapsChip) mapsChip.href = match.mapsUrl;
      }
      content.appendChild(live);
    });
  }

  /* ========== HOLIDAYS STRIP (Calendarific) ========== */
  async function renderHolidaysStrip() {
    const root = document.getElementById('holidays-strip');
    if (!root || !window.YatraData) return;
    const today = new Date();
    const yearNow = today.getFullYear();
    const yearNext = yearNow + 1;
    const horizonMs = 1000 * 60 * 60 * 24 * 200; // 200-day window
    const horizonEnd = new Date(today.getTime() + horizonMs);

    try {
      const [holidaysThis, holidaysNext] = await Promise.all([
        window.YatraData.Holidays.list('IN', yearNow),
        window.YatraData.Holidays.list('IN', yearNext),
      ]);
      const all = [...holidaysThis, ...holidaysNext];
      if (!all || all.length === 0) {
        return; // proxy or key not ready — leave strip hidden
      }
      // Filter to: future + within horizon + national-or-Karnataka, dedupe identical names
      const seen = new Set();
      const upcoming = all
        .filter((h) => {
          const d = new Date(h.date.iso);
          if (d < today || d > horizonEnd) return false;
          // Only headline holidays: National + Gazetted + Common local. Skip "Optional" / "Restricted".
          const primary = (h.primary_type || '').toLowerCase();
          const types = (h.type || []).map((t) => t.toLowerCase()).join(',');
          const isPublic = primary.includes('gazetted') ||
            types.includes('national holiday') ||
            types.includes('public holiday') ||
            types.includes('common local');
          if (!isPublic) return false;
          const key = h.name + h.date.iso;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => a.date.iso.localeCompare(b.date.iso))
        .slice(0, 12);

      if (upcoming.length === 0) return;

      root.replaceChildren();
      root.classList.add('holidays-strip');
      root.style.display = 'flex';

      const iconWrap = el('div', { class: 'holidays-strip-icon' });
      iconWrap.appendChild(iconUse('i-calendar', 'icon'));
      root.appendChild(iconWrap);

      const content = el('div');
      content.style.flex = '1';
      content.appendChild(el('h4', { text: 'Indian public holidays in your planning window (live)' }));
      const desc = el('div', { class: 'holidays-strip-content' });
      desc.append('Pulled live from Calendarific — drives recommendation scoring.');
      const list = el('div');
      list.style.marginTop = '10px';
      upcoming.forEach((h) => {
        const d = new Date(h.date.iso);
        const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const pill = el('span', { class: 'holiday-pill' });
        pill.appendChild(iconUse('i-calendar', 'icon'));
        pill.append(' ' + h.name + ' · ' + dateLabel);
        list.appendChild(pill);
      });
      desc.appendChild(list);
      content.appendChild(desc);
      root.appendChild(content);
    } catch (e) {
      console.warn('[holidays]', e);
    }
  }

  /* ========== HOLIDAY-AWARE ALERTS (trip page) ========== */
  async function initHolidayAlerts() {
    const root = document.getElementById('holiday-alert-trip');
    if (!root || !window.YatraData) return;
    const start = root.dataset.tripStart;
    const end = root.dataset.tripEnd;
    if (!start || !end) return;
    const tripStart = new Date(start);
    const tripEnd = new Date(end);
    const yearsToCheck = new Set([tripStart.getFullYear(), tripEnd.getFullYear()]);
    try {
      const allLists = await Promise.all(
        Array.from(yearsToCheck).map((y) => window.YatraData.Holidays.list('IN', y))
      );
      const all = [].concat(...allLists);
      const overlapping = all.filter((h) => {
        const d = new Date(h.date.iso);
        if (d < tripStart || d > tripEnd) return false;
        const primary = (h.primary_type || '').toLowerCase();
        const types = (h.type || []).map((t) => t.toLowerCase()).join(',');
        return primary.includes('gazetted') ||
          types.includes('national holiday') ||
          types.includes('public holiday') ||
          types.includes('hinduism');
      });

      if (overlapping.length === 0) return;
      // dedupe by name+date
      const seen = new Set();
      const unique = overlapping.filter((h) => {
        const k = h.name + h.date.iso;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      root.replaceChildren();
      root.classList.add('holiday-alert');
      root.style.display = 'flex';

      const ic = el('div', { class: 'holiday-alert-icon' });
      ic.appendChild(iconUse('i-calendar', 'icon'));
      root.appendChild(ic);

      const content = el('div');
      content.style.flex = '1';
      content.appendChild(el('h4', { text: unique.length + ' Indian holiday' + (unique.length > 1 ? 's' : '') + ' fall during your trip' }));
      const desc = el('div', { class: 'holiday-alert-content' });
      const items = unique.map((h) => {
        const d = new Date(h.date.iso);
        const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return h.name + ' (' + dateLabel + ')';
      });
      desc.append('Heads up: ');
      const strong = el('strong', { text: items.join(' · ') });
      desc.appendChild(strong);
      desc.append('. Expect higher temple footfall, possible fare spikes, and longer queues. Some shops/restaurants may have shorter hours. Book temples online if available, and add extra buffer time on these days.');
      content.appendChild(desc);
      root.appendChild(content);
    } catch (e) {
      console.warn('[holiday alerts]', e);
    }
  }

  /* ========== ROUTE VISUALIZER ========== */
  // Renders into any [data-route] element with attributes:
  //   data-route="flight" | "car"
  //   data-from="JFK" | "Madurai"
  //   data-from-label="New York"
  //   data-from-time="08 Nov, 12:10"
  //   data-to="LAS"
  //   data-to-label="Las Vegas"
  //   data-to-time="09 Nov, 19:20"
  //   data-duration="7h 10m"   (optional)
  //   data-light                (optional — light theme)
  function renderRouteViz(node) {
    const mode = node.dataset.route;
    if (!mode) return;
    const isFlight = mode === 'flight';
    const isLight = node.hasAttribute('data-light');
    if (isLight) node.classList.add('light');
    node.classList.add('route-viz');

    // Helper to build cells safely
    const makeEnd = (code, label, time) => {
      const wrap = el('div', { class: 'route-end' });
      if (code) wrap.appendChild(el('div', { class: 'route-end-code', text: code }));
      if (label) wrap.appendChild(el('div', { class: 'route-end-label', text: label }));
      if (time) wrap.appendChild(el('div', { class: 'route-end-meta', text: time }));
      return wrap;
    };

    const fromCell = makeEnd(
      node.dataset.from || '',
      node.dataset.fromLabel || '',
      node.dataset.fromTime || ''
    );
    const toCell = makeEnd(
      node.dataset.to || '',
      node.dataset.toLabel || '',
      node.dataset.toTime || ''
    );

    // Track in middle: line-only SVG (stretches), with HTML overlays for dots + icon
    const track = el('div', { class: 'route-track' });
    const lineWrap = el('div', { class: 'route-line-wrap' });

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'route-line-svg');
    svg.setAttribute('viewBox', '0 0 200 32');
    svg.setAttribute('preserveAspectRatio', 'none');

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('class', 'route-line');
    path.setAttribute('d', 'M 0 16 L 200 16');
    svg.appendChild(path);
    lineWrap.appendChild(svg);

    // Endpoint dots: pure HTML (won't distort)
    const dotLeft = el('div', { class: 'route-dot left' });
    const dotRight = el('div', { class: 'route-dot right' });
    lineWrap.appendChild(dotLeft);
    lineWrap.appendChild(dotRight);

    // Mode icon: reuse the same #i-plane / #i-car symbols used in the row
    const iconBox = el('div', { class: 'route-mode-icon' });
    iconBox.appendChild(iconUse(isFlight ? 'i-plane' : 'i-car', 'icon'));
    lineWrap.appendChild(iconBox);

    track.appendChild(lineWrap);
    if (node.dataset.duration) {
      track.appendChild(el('div', { class: 'route-duration', text: node.dataset.duration }));
    }

    node.replaceChildren(fromCell, track, toCell);
  }

  function initRouteViz() {
    document.querySelectorAll('[data-route]').forEach(renderRouteViz);
  }

  /* ========== ANCHOR + ITINERARY ENRICHMENT ==========
   * Walks heritage anchor cards + each itinerary day's row-titles, looks up
   * TripAdvisor + influencer mentions, and injects pills/quotes inline.
   */
  function initAnchorEnrichment() {
    document.querySelectorAll('.anchor-card').forEach((card) => {
      const nameEl = card.querySelector('.name');
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      // Skip generic dish/category cards (e.g. "Tofu skin · Kyoto staple")
      // Heuristic: only treat as POI if the name is short + capitalized + no "·" separator
      const isCategory = name.includes('·') || name.length > 50;
      // Pull a city hint from the .where line for better TA matching
      const where = (card.querySelector('.where') || {}).textContent || '';
      const city = (where.match(/Tokyo|Kyoto|Hakone|Madurai|Rameswaram|Dwarka|Delhi|Mumbai|Osaka|Nara/) || [])[0] || '';
      if (!isCategory) {
        injectTripAdvisor(card, name, 'attraction', city);
      }
      // Always try influencer mention — the corpus quoteForPlace can match dish names too
      injectInfluencerMention(card, name);
    });
  }

  function initItineraryEnrichment() {
    if (!window.YatraData || !YatraData.Influencers) return;
    // Each itinerary day-row has a .row-title with the headline place name.
    document.querySelectorAll('.day-row .row-title, .row-title').forEach((titleEl) => {
      const text = titleEl.textContent.trim();
      // Extract a candidate place name: take chars before first "·", "—", "(", or ","
      const candidate = text.split(/[·—–\(,]/)[0].trim();
      if (!candidate || candidate.length < 4) return;
      YatraData.Influencers.quoteForPlace(candidate).then((q) => {
        if (!q || !q.quote) return;
        // Find the parent row + insert the quote after the title block
        const row = titleEl.closest('.itin-row, .day-row, li, p') || titleEl.parentElement;
        if (!row) return;
        // Avoid duplicate insertion
        if (row.querySelector('.influencer-quote.itin-injected')) return;
        const block = document.createElement('blockquote');
        block.className = 'influencer-quote itin-injected';
        block.textContent = '"' + q.quote.slice(0, 200) + (q.quote.length > 200 ? '…' : '') + '"';
        const cite = document.createElement('cite');
        if (q.url) {
          const a = document.createElement('a');
          a.href = q.url; a.target = '_blank'; a.rel = 'noopener';
          a.textContent = '— ' + (q.creator || 'creator') + ' (' + (q.source || 'source') + ' ↗)';
          cite.appendChild(a);
        } else {
          cite.textContent = '— ' + (q.creator || 'creator');
        }
        block.appendChild(cite);
        row.appendChild(block);
      }).catch(() => {});
    });
  }

  /* ========== ITINERARY ATTRIBUTION CHIPS ==========
   * For each .day, scan the title for known place names (from synthesis-{city}.json
   * for cities listed in YATRA_TRIP_DEFAULTS). Inject a "Why we picked this" chip
   * row at the top of .day-body showing creator count + TA rating/rank when matched.
   */
  function _slug(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  async function initItineraryAttribution() {
    if (!window.YatraData || !YatraData.CuratorsPicks) return;
    const defaults = window.YATRA_TRIP_DEFAULTS || {};
    const cityNames = (defaults.cities || []).map((c) => c.name);
    if (!cityNames.length) return;
    // Pull all city pick lists once and flatten into [{city, name, pick}].
    const flat = [];
    for (const city of cityNames) {
      try {
        const data = await YatraData.CuratorsPicks.forDestination(city);
        if (!data || !data.buckets) continue;
        for (const k of Object.keys(data.buckets)) {
          for (const p of (data.buckets[k] || [])) {
            flat.push({ city, name: p.name, pick: p });
          }
        }
      } catch (_) { /* skip */ }
    }
    if (!flat.length) return;
    // Lowercase index for matching.
    const days = document.querySelectorAll('details.day, .day-row');
    days.forEach((day) => {
      if (day.querySelector('.day-attribution')) return;
      const titleEl = day.querySelector('.day-title') || day.querySelector('.row-title');
      const body = day.querySelector('.day-body') || day;
      if (!titleEl || !body) return;
      const titleText = titleEl.textContent.toLowerCase();
      // Find every pick whose name (or first significant token) appears in the title.
      // Avoid matching on common city words ("Tokyo", "Kyoto", etc.) that prefix names.
      const cityWords = new Set(cityNames.map((c) => c.toLowerCase()));
      const matched = flat.filter((f) => {
        const n = f.name.toLowerCase();
        if (n.length < 5) return false;
        if (titleText.includes(n)) return true;
        // Distinctive first token (skip city prefixes like "tokyo skytree" → "skytree")
        const tokens = n.split(/\s+/).filter((t) => !cityWords.has(t));
        if (!tokens.length) return false;
        const first = tokens[0];
        if (first.length < 5) return false;
        return titleText.includes(first);
      });
      // Dedupe by name.
      const seen = new Set();
      const picks = matched.filter((m) => {
        if (seen.has(m.name)) return false;
        seen.add(m.name);
        return true;
      }).slice(0, 3);
      if (!picks.length) return;
      const row = document.createElement('div');
      row.className = 'day-attribution';
      row.innerHTML = '<span class="day-attribution-label">Why we picked these</span>';
      picks.forEach(({ city, name, pick }) => {
        const ta = pick.tripadvisor || {};
        const bits = [];
        if (pick.creator_count > 0) bits.push(`${pick.creator_count} creator${pick.creator_count > 1 ? 's' : ''}`);
        if (ta.rating) bits.push(`★ ${ta.rating}`);
        if (ta.ranking) {
          const m = String(ta.ranking).match(/#(\d+)/);
          if (m) bits.push(`#${m[1]}`);
        }
        if (!bits.length && pick.is_seed) bits.push('Editorial pick');
        if (!bits.length) return;
        const chip = document.createElement(ta.url ? 'a' : 'span');
        chip.className = 'day-attribution-chip';
        if (ta.url) { chip.href = ta.url; chip.target = '_blank'; chip.rel = 'noopener'; }
        chip.title = ta.ranking || `${pick.creator_count || 0} creators`;
        chip.textContent = `${name} · ${bits.join(' · ')}`;
        row.appendChild(chip);
      });
      // Inject at the top of the day-body.
      if (row.children.length > 1) body.insertBefore(row, body.firstChild);
    });
  }

  /* ========== MUST-INCLUDE SECTION ========== */
  /* Per-trip "Add to next refresh". Five chip-input categories
   * (places / todo / buy / eat / links) + free-text notes. The dedicated
   * refresh button appends a MUST INCLUDE block to the existing
   * data-refresh-prompt and hands off to AgentToast. The top-nav Refresh
   * button is unaffected. State persists in localStorage keyed by trip slug. */
  const MI_CATEGORIES = [
    { key: 'places', label: 'Places to visit', placeholder: 'Type or paste comma-separated — e.g. Yanaka, Asakusa, Roppongi' },
    { key: 'todo', label: 'Things to do', placeholder: 'Type or paste comma-separated — e.g. Sumo morning practice' },
    { key: 'buy', label: 'Things to buy', placeholder: 'Type or paste comma-separated — e.g. Don Quijote run' },
    { key: 'eat', label: 'Things to eat', placeholder: 'Type or paste comma-separated — e.g. T\'s Tantan vegan ramen' },
    { key: 'links', label: 'Source links (YouTube · Instagram · TripAdvisor · blog)', placeholder: 'Paste a URL and press Enter — the planner will fetch + transcribe + extract places', isLink: true },
  ];

  function miStorageKey() {
    const slug = document.body.dataset.tripSlug || location.pathname.replace(/\/index\.html$/, '').split('/').filter(Boolean).pop() || 'default';
    return 'yatra:must-include:' + slug;
  }

  function miLoad() {
    const empty = { places: [], todo: [], buy: [], eat: [], links: [], notes: '' };
    try {
      const raw = localStorage.getItem(miStorageKey());
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      MI_CATEGORIES.forEach((c) => { if (!Array.isArray(parsed[c.key])) parsed[c.key] = []; });
      if (typeof parsed.notes !== 'string') parsed.notes = '';
      return parsed;
    } catch (err) {
      return empty;
    }
  }

  function miSave(state) {
    try { localStorage.setItem(miStorageKey(), JSON.stringify(state)); } catch (err) { /* quota */ }
  }

  function initMustIncludeSection() {
    const section = document.getElementById('must-include');
    if (!section) return;

    const state = miLoad();

    MI_CATEGORIES.forEach((cat) => {
      const wrap = section.querySelector(`[data-mi-category="${cat.key}"]`);
      if (!wrap) return;
      const input = wrap.querySelector('input');
      const chipsHost = wrap.querySelector('.mi-chip-input');
      if (!input || !chipsHost) return;

      function render() {
        chipsHost.querySelectorAll('.mi-chip').forEach((n) => n.remove());
        state[cat.key].forEach((item, idx) => {
          const display = (cat.isLink && item.length > 60) ? item.slice(0, 57) + '…' : item;
          const chip = el('span', { class: 'mi-chip' + (cat.isLink ? ' mi-chip--link' : ''), text: display });
          if (cat.isLink) chip.title = item;
          const removeBtn = el('button', { class: 'mi-chip-remove', type: 'button', 'aria-label': 'Remove' });
          removeBtn.textContent = '×';
          removeBtn.addEventListener('click', () => {
            state[cat.key].splice(idx, 1);
            miSave(state);
            render();
          });
          chip.appendChild(removeBtn);
          chipsHost.insertBefore(chip, input);
        });
      }

      function pushMany(values) {
        const splitter = cat.isLink ? /\s+/ : /[,\n]/;
        let added = 0;
        values.forEach((raw) => {
          (raw || '').split(splitter).map((s) => s.trim()).filter(Boolean).forEach((s) => {
            state[cat.key].push(s);
            added++;
          });
        });
        if (added) {
          miSave(state);
          render();
        }
      }

      function commit() {
        const v = (input.value || '').trim();
        if (!v) return;
        input.value = '';
        pushMany([v]);
      }

      input.addEventListener('keydown', (ev) => {
        const isCommit = ev.key === 'Enter' || (!cat.isLink && ev.key === ',');
        if (isCommit) {
          ev.preventDefault();
          commit();
        } else if (ev.key === 'Backspace' && !input.value && state[cat.key].length) {
          state[cat.key].pop();
          miSave(state);
          render();
        }
      });
      input.addEventListener('paste', (ev) => {
        const text = (ev.clipboardData || window.clipboardData) && (ev.clipboardData || window.clipboardData).getData('text');
        if (!text) return;
        const hasSplit = cat.isLink ? /\s/.test(text) : /[,\n]/.test(text);
        if (!hasSplit) return; // single value — let default paste behavior fill the input
        ev.preventDefault();
        pushMany([text]);
      });
      input.addEventListener('blur', commit);
      chipsHost.addEventListener('click', (ev) => {
        if (ev.target === chipsHost) input.focus();
      });

      render();
    });

    const notesEl = section.querySelector('#mi-notes');
    if (notesEl) {
      notesEl.value = state.notes || '';
      notesEl.addEventListener('input', () => {
        state.notes = notesEl.value;
        miSave(state);
      });
    }

    const submitBtn = section.querySelector('#mi-submit');
    const statusEl = section.querySelector('#mi-status');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const trigger = document.querySelector('[data-refresh-trigger]');
        const basePrompt = (trigger && trigger.dataset.refreshPrompt) || 'Refresh this trip with the latest data and regenerate the page.';
        const tripName = (trigger && trigger.dataset.refreshName) || 'this trip';

        const itemBlocks = [];
        ['places', 'todo', 'buy', 'eat'].forEach((k) => {
          const cat = MI_CATEGORIES.find((c) => c.key === k);
          if (state[k] && state[k].length) {
            itemBlocks.push(cat.label + ':');
            state[k].forEach((item) => itemBlocks.push('  - ' + item));
          }
        });
        const linkLines = (state.links || []).map((u) => '  - ' + u);
        const noteText = (state.notes || '').trim();

        if (!itemBlocks.length && !linkLines.length && !noteText) {
          if (statusEl) statusEl.textContent = 'Add at least one item, link, or note before refreshing.';
          return;
        }

        const parts = [];
        parts.push('');
        parts.push('');
        parts.push('MUST INCLUDE THE FOLLOWING IN THE NEW PLAN — user-requested items + source links. Do not silently drop any.');
        parts.push('');
        parts.push('STEP 1 — Research each plain-text item:');
        parts.push('  Use existing scripts (scripts/api/foursquare_places.py, scripts/api/brave_search.py, scripts/api/restaurants_search.py, scripts/api/tripadvisor.py) to verify each name resolves to a real place, is open during the trip dates, is vegetarian-friendly (or note alternatives), and kid-appropriate.');
        parts.push('');
        parts.push('STEP 2 — Parse each URL FIRST, then extract recommendations:');
        parts.push('  - YouTube → scripts/api/youtube_transcript.py --video-id <id> --whisper-fallback (ALWAYS pass --whisper-fallback so we get text from caption-less videos; transcribe + extract every place / restaurant / activity mentioned, then research each via Step 1).');
        parts.push('  - Instagram → scripts/api/instagram_creator.py for the post owner; pull captions, hashtags, geo-tags from the recent feed.');
        parts.push('  - TripAdvisor → scripts/api/tripadvisor.py to fetch ratings + top reviews.');
        parts.push('  - Blog post / other → scripts/api/blog_feed.py if it\'s a feed, else fetch via trafilatura. Detect language and translate to English via scripts/api/translate.py.');
        parts.push('  Treat every place mentioned in a parsed source as if it were a plain-text item — research, validate, slot.');
        parts.push('');
        parts.push('STEP 3 — Slot into the itinerary at the most logical day/time. Respect the heat-aware pace, kid-energy, hard constraints (vegetarian, school days, hotel tier).');
        parts.push('');
        parts.push('STEP 4 — VISUAL TAGGING. Every user-sourced element you slot into the page (day rows, restaurant cards, hotel notes, anchor cards, shopping callouts, costs lines) MUST be marked with the standard CSS hooks:');
        parts.push('  class="user-pick user-pick--<category>" data-user-pick="<≤80-char reason this is here>"');
        parts.push('  Categories: places, todo, buy, eat, link. The shared CSS (trips/_shared/style.css) already styles these with a saffron accent border, tinted background, and a "Your pick" badge. Do not add inline styles.');
        parts.push('');
        parts.push('STEP 5 — SKIPPED CALLOUT. At the very TOP of the itinerary section (immediately inside <section id="itinerary">, BEFORE the tabs / day rows), render:');
        parts.push('  <div class="user-picks-skipped">');
        parts.push('    <h4>Couldn\'t include from your asks</h4>');
        parts.push('    <ul>');
        parts.push('      <li><strong>Item or URL</strong> — short reason (closed during dates, non-veg only, kid-unfriendly, off-season, transcription failed, etc.)</li>');
        parts.push('    </ul>');
        parts.push('  </div>');
        parts.push('  If everything was included, OMIT the callout entirely (do not render an empty one).');
        parts.push('');
        if (itemBlocks.length) {
          parts.push('Items:');
          itemBlocks.forEach((line) => parts.push(line));
          parts.push('');
        }
        if (linkLines.length) {
          parts.push('Source links to parse:');
          linkLines.forEach((l) => parts.push(l));
          parts.push('');
        }
        if (noteText) {
          parts.push('Notes:');
          parts.push('  ' + noteText.replace(/\n/g, '\n  '));
        }

        const fullPrompt = basePrompt + parts.join('\n');

        if (!window.AgentToast) {
          navigator.clipboard.writeText(fullPrompt).catch(() => {});
          alert('Local Claude proxy not loaded. Prompt copied — paste into a fresh Claude Code session.');
          return;
        }
        if (statusEl) statusEl.textContent = 'Starting refresh…';
        AgentToast.start({
          prompt: fullPrompt,
          label: 'Refresh + items: ' + tripName,
          tools: 'edit',
        }).then(() => {
          if (statusEl) statusEl.textContent = 'Refresh started. See toast bottom-right.';
        }).catch((err) => {
          console.warn('[must-include] proxy unavailable, falling back to copy', err);
          navigator.clipboard.writeText(fullPrompt).catch(() => {});
          if (statusEl) statusEl.textContent = 'Proxy unavailable — prompt copied to clipboard.';
        });
      });
    }
  }

  /* ========== CART (pick-to-cart, drag-reorder, day/slot scheduling) ==========
   * Adds a hover-only "+ Add" button to every pickable card on the page
   * (restaurants, hotels, anchors, day-row activities, route segments,
   * compare-section options). Picks land in a per-trip localStorage cart and
   * are rendered as draggable rows inside #must-include with Day + Slot
   * (Morning/Afternoon/Evening) dropdowns. The mi-submit refresh prompt is
   * augmented with the cart so the planner can rebuild the itinerary around
   * user picks (authoritative) and optimize unscheduled items by proximity
   * + time + effort + cost. */

  function tripSlug() {
    return document.body.dataset.tripSlug ||
      location.pathname.replace(/\/index\.html$/, '').split('/').filter(Boolean).pop() ||
      'default';
  }
  function cartStorageKey() { return 'yatra:cart:' + tripSlug(); }
  function cartLoad() {
    try {
      const raw = localStorage.getItem(cartStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }
  function cartSave(items) {
    try { localStorage.setItem(cartStorageKey(), JSON.stringify(items)); } catch (_) {}
  }

  // Read trip start/end from the existing holiday-alert-trip element. Returns
  // {startISO, endISO, days:[{n,label,iso}]} or null if not parseable.
  function tripDayRange() {
    const node = document.getElementById('holiday-alert-trip');
    if (!node) return null;
    const start = node.dataset.tripStart;
    const end = node.dataset.tripEnd;
    if (!start || !end) return null;
    const startD = new Date(start);
    const endD = new Date(end);
    if (isNaN(startD) || isNaN(endD) || endD < startD) return null;
    const days = [];
    const oneDay = 24 * 60 * 60 * 1000;
    const total = Math.round((endD - startD) / oneDay) + 1;
    for (let i = 0; i < total; i++) {
      const d = new Date(startD.getTime() + i * oneDay);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      days.push({ n: i + 1, label, iso });
    }
    return { startISO: start, endISO: end, days };
  }

  function pickIdFromKey(key) {
    return 'pick-' + Math.abs(hashStr(key)).toString(36);
  }
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  // Walk a node up the DOM looking for the nearest .day or details.day to
  // tag day-row picks with their day-of-trip context.
  function nearestDayContext(node) {
    const d = node.closest('details.day');
    if (!d) return null;
    const dateEl = d.querySelector('.day-date');
    const titleEl = d.querySelector('.day-title');
    return {
      date: dateEl ? dateEl.textContent.trim() : '',
      day: titleEl ? titleEl.textContent.trim() : '',
    };
  }

  // Convert any pickable DOM node into a normalized cart-item descriptor.
  // Returns null if we can't extract a sensible name.
  function descriptorFor(node) {
    // 1. Restaurants — itinerary food rows
    if (node.matches('.row[data-rest-name]')) {
      const ctx = nearestDayContext(node);
      const name = node.dataset.restName;
      const titleEl = node.querySelector('.row-title');
      const subtitle = titleEl ? titleEl.textContent.replace(/^.*?·\s*/, '').trim() : '';
      return {
        type: 'restaurant',
        name,
        meta: [node.dataset.restCity, subtitle].filter(Boolean).join(' · '),
        sourceLabel: ctx ? (ctx.date + ' itinerary') : 'Itinerary',
      };
    }
    // 2. Restaurants — veg cards (live)
    if (node.matches('.veg-card')) {
      const name = node.dataset.name || (node.querySelector('.veg-card-title') || {}).textContent || '';
      const cuisine = (node.querySelector('.veg-card-cuisine') || {}).textContent || '';
      const rating = (node.querySelector('.veg-card-rating') || {}).textContent || '';
      return {
        type: 'restaurant',
        name: name.trim(),
        meta: [cuisine.trim(), rating.replace(/\s+/g, ' ').trim()].filter(Boolean).join(' · '),
        sourceLabel: 'Veg dining',
      };
    }
    // 3. Hotels
    if (node.matches('.hotel-card')) {
      const name = node.dataset.name || (node.querySelector('.hotel-name') || {}).textContent || '';
      const cls = (node.querySelector('.hotel-class') || {}).textContent || '';
      const rate = (node.querySelector('.hotel-rate') || {}).textContent || '';
      return {
        type: 'hotel',
        name: name.trim(),
        meta: [cls.trim(), rate.replace(/\s+/g, ' ').trim()].filter(Boolean).join(' · '),
        sourceLabel: 'Hotels',
      };
    }
    // 4. Anchors (heritage / hotel anchor cards)
    if (node.matches('.anchor-card')) {
      const name = (node.querySelector('.name') || {}).textContent || '';
      const where = (node.querySelector('.where') || {}).textContent || '';
      return {
        type: 'anchor',
        name: name.trim(),
        meta: where.trim(),
        sourceLabel: 'Anchors',
      };
    }
    // 5. Compare-section path option
    if (node.matches('.opt-card')) {
      const name = (node.querySelector('h3') || {}).textContent || 'Path option';
      const sub = (node.querySelector('.opt-sub') || {}).textContent || '';
      return {
        type: 'path',
        name: name.trim(),
        meta: sub.trim(),
        sourceLabel: 'Trip path',
      };
    }
    // 6. Route segment (flight / car)
    if (node.matches('[data-route]')) {
      const from = node.dataset.fromLabel || node.dataset.from || '';
      const to = node.dataset.toLabel || node.dataset.to || '';
      const dur = node.dataset.duration || '';
      return {
        type: node.dataset.route === 'car' ? 'car' : 'flight',
        name: from + ' → ' + to,
        meta: [node.dataset.fromTime || '', dur].filter(Boolean).join(' · '),
        sourceLabel: 'Transport',
      };
    }
    // 7. Curator's pick (per-city must-do/eat/buy/unique cards)
    if (node.matches('.curator-card')) {
      const name = (node.querySelector('.curator-card-name') || {}).textContent || '';
      const attr = (node.querySelector('.curator-card-attr') || {}).textContent || '';
      const cityWrap = node.closest('.curator-city');
      const cityHeadEl = cityWrap ? cityWrap.querySelector('.curator-city-head') : null;
      const city = cityHeadEl ? (cityHeadEl.firstChild ? cityHeadEl.firstChild.textContent.trim() : '') : '';
      const bucket = node.closest('.curator-bucket');
      const bucketHead = bucket ? (bucket.querySelector('.curator-bucket-head') || {}).textContent : '';
      const isEat = /eat/i.test(bucketHead || '');
      return {
        type: isEat ? 'restaurant' : 'anchor',
        name: name.trim(),
        meta: [city, attr.trim()].filter(Boolean).join(' · '),
        sourceLabel: "Curator's pick" + (bucketHead ? ' · ' + bucketHead.trim() : ''),
      };
    }
    // 8. Influencer-voice card — pick the place referenced in the quote
    if (node.matches('.influencer-card')) {
      const placeName = node.dataset.name ||
        (node.querySelector('.influencer-meta strong') || {}).textContent || '';
      if (!placeName.trim()) return null;
      const creator = (node.querySelector('.creator-badge') || {}).textContent || '';
      const cityEl = node.querySelector('.influencer-meta span:nth-of-type(2)');
      const city = cityEl ? cityEl.textContent.trim() : '';
      return {
        type: 'anchor',
        name: placeName.trim(),
        meta: [city, creator ? 'via ' + creator.trim() : ''].filter(Boolean).join(' · '),
        sourceLabel: 'Creator mention',
      };
    }
    // 9. Hero strip carousel highlight. The carousel duplicates each card
    // (aria-hidden="true") for the seamless loop, so the user sees both halves
    // as the track scrolls. We give every visible card a button — keyFor()
    // collapses originals + duplicates onto a single cart entry by name, and
    // syncPickButton() keeps both buttons visually in sync.
    if (node.matches('.strip-card')) {
      const name = (node.querySelector('.strip-card-name') || {}).textContent || '';
      const loc = (node.querySelector('.strip-card-loc') || {}).textContent || '';
      const tag = (node.querySelector('.strip-card-tag') || {}).textContent || '';
      if (!name.trim()) return null;
      return {
        type: 'anchor',
        name: name.trim(),
        meta: [loc.trim(), tag.trim()].filter(Boolean).join(' · '),
        sourceLabel: 'Highlight',
      };
    }
    // 10. Generic activity row inside the day timeline (no [data-rest-name])
    if (node.matches('.row') && !node.dataset.restName) {
      const titleEl = node.querySelector('.row-title');
      if (!titleEl) return null;
      const fullText = titleEl.textContent.trim();
      // Skip the pure "—" continuations (no meaningful title)
      if (fullText.length < 4) return null;
      const head = fullText.split(/[·—]/)[0].trim();
      if (!head) return null;
      const ctx = nearestDayContext(node);
      const time = (node.querySelector('.row-time') || {}).textContent || '';
      return {
        type: 'activity',
        name: head,
        meta: [ctx ? ctx.date : '', time.trim()].filter(Boolean).join(' · '),
        sourceLabel: ctx ? (ctx.day || 'Itinerary') : 'Itinerary',
      };
    }
    return null;
  }

  // Selectors for everything we want to make pickable. The cart system
  // auto-tags these at boot + on DOM mutations, so trip pages don't need
  // to author any new attributes.
  const PICKABLE_SELECTORS = [
    '.row[data-rest-name]',          // itinerary food row
    '.row:not([data-rest-name])',    // generic activity row
    '.veg-card',                      // live veg-restaurant card
    '.hotel-card',                    // live hotel card
    '.anchor-card',                   // anchor / heritage card
    '.curator-card',                  // curator's-pick card (per-city bucket)
    '.influencer-card',               // creator-quote card
    '.strip-card',                    // hero scrolling carousel highlight
    '.opt-card',                      // compare-section path option
    '[data-route]',                   // flight / car segment
  ].join(',');

  // Build a stable string key from a descriptor — same place picked twice
  // (e.g. teamLab Planets shown both in itinerary + anchor) collapses to one.
  function keyFor(desc) {
    return desc.type + '|' + (desc.name || '').toLowerCase().trim();
  }

  function ensurePickButton(node) {
    if (node.dataset.pickInited) return;
    const desc = descriptorFor(node);
    if (!desc || !desc.name) return;
    node.dataset.pickInited = '1';
    node.setAttribute('data-pickable', '');
    const key = keyFor(desc);
    const id = pickIdFromKey(key);
    node.dataset.pickId = id;
    node.dataset.pickKey = key;

    const btn = document.createElement('button');
    btn.className = 'pick-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Add to cart');
    btn.title = 'Add to cart';
    btn.dataset.pickFor = id;
    const glyph = document.createElement('span');
    glyph.className = 'pick-glyph';
    glyph.textContent = '+';
    btn.appendChild(glyph);
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      togglePick(id, desc);
    });
    node.appendChild(btn);
    syncPickButton(id);
  }

  function syncPickButton(id) {
    const btns = document.querySelectorAll('[data-pick-for="' + CSS.escape(id) + '"]');
    const inCart = cartLoad().some((it) => it.id === id);
    btns.forEach((btn) => {
      btn.classList.toggle('picked', inCart);
      const glyph = btn.querySelector('.pick-glyph');
      if (glyph) glyph.textContent = inCart ? '✓' : '+';
      btn.title = inCart ? 'Remove from cart' : 'Add to cart';
      btn.setAttribute('aria-label', btn.title);
    });
  }

  function togglePick(id, desc) {
    const items = cartLoad();
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) {
      items.push({
        id,
        type: desc.type,
        name: desc.name,
        meta: desc.meta || '',
        sourceLabel: desc.sourceLabel || '',
        day: 0,   // 0 = AI decides
        slot: '', // '' = AI decides
      });
    } else {
      items.splice(idx, 1);
    }
    cartSave(items);
    syncPickButton(id);
    renderCart();
    renderCartBadge();
  }

  function scanPickables(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(PICKABLE_SELECTORS).forEach((node) => {
      // Skip nested matches that are already inside another pickable to avoid
      // double-attaching (e.g. a .veg-card that lives inside a .anchor-card)
      const parent = node.parentElement && node.parentElement.closest('[data-pickable]');
      if (parent) return;
      ensurePickButton(node);
    });
  }

  /* ---------- Cart UI ---------- */
  function ensureCartHost() {
    const section = document.getElementById('must-include');
    if (!section) return null;
    let host = section.querySelector('.mi-cart');
    if (host) return host;
    host = document.createElement('div');
    host.className = 'mi-cart';
    const head = document.createElement('div');
    head.className = 'mi-cart-head';
    const h = document.createElement('h4');
    h.textContent = 'Your cart';
    const hint = document.createElement('div');
    hint.className = 'mi-cart-hint';
    hint.textContent = 'Drag to reorder. Set Day + Time, or leave on "AI decides" — the planner will optimize for proximity, time, effort, and cost.';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'mi-cart-clear';
    clear.textContent = 'Clear all';
    clear.addEventListener('click', () => {
      if (!confirm('Clear all cart items?')) return;
      const items = cartLoad();
      cartSave([]);
      items.forEach((it) => syncPickButton(it.id));
      renderCart();
      renderCartBadge();
    });
    head.appendChild(h);
    head.appendChild(hint);
    head.appendChild(clear);
    host.appendChild(head);
    const list = document.createElement('div');
    list.className = 'mi-cart-list';
    host.appendChild(list);

    // Insert before the existing notes block so it reads top→bottom:
    // chip inputs → cart → notes → submit
    const notesBlock = section.querySelector('.mi-notes');
    const card = section.querySelector('.mi-card');
    if (card && notesBlock) card.insertBefore(host, notesBlock);
    else if (card) card.appendChild(host);
    else section.appendChild(host);
    return host;
  }

  function makeSelect(opts, current, onChange) {
    const sel = document.createElement('select');
    opts.forEach(([value, label]) => {
      const o = document.createElement('option');
      o.value = String(value);
      o.textContent = label;
      if (String(value) === String(current)) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  function renderCart() {
    const host = ensureCartHost();
    if (!host) return;
    const list = host.querySelector('.mi-cart-list');
    list.replaceChildren();
    const items = cartLoad();
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'mi-cart-empty';
      empty.textContent = 'Cart is empty. Hover any card on this page and click + to drop it in. You can also add items via the chip inputs above.';
      list.appendChild(empty);
      // hide clear-all when empty
      const clear = host.querySelector('.mi-cart-clear');
      if (clear) clear.style.display = 'none';
      return;
    }
    const clear = host.querySelector('.mi-cart-clear');
    if (clear) clear.style.display = '';

    const range = tripDayRange();
    const dayOpts = [['0', 'AI decides']];
    if (range) {
      range.days.forEach((d) => dayOpts.push([String(d.n), 'Day ' + d.n + ' · ' + d.label]));
    }
    const slotOpts = [
      ['', 'Any time'],
      ['morning', 'Morning'],
      ['afternoon', 'Afternoon'],
      ['evening', 'Evening'],
    ];

    items.forEach((it, idx) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.draggable = true;
      row.dataset.cartIdx = String(idx);

      const handle = document.createElement('div');
      handle.className = 'cart-item-handle';
      handle.textContent = '⋮⋮';
      handle.title = 'Drag to reorder';
      row.appendChild(handle);

      const main = document.createElement('div');
      main.className = 'cart-item-main';
      const title = document.createElement('div');
      title.className = 'cart-item-title';
      const tag = document.createElement('span');
      tag.className = 'cart-item-type';
      tag.textContent = it.type;
      title.appendChild(tag);
      const name = document.createElement('span');
      name.textContent = it.name;
      title.appendChild(name);
      main.appendChild(title);
      if (it.meta || it.sourceLabel) {
        const meta = document.createElement('div');
        meta.className = 'cart-item-meta';
        meta.textContent = [it.sourceLabel, it.meta].filter(Boolean).join(' · ');
        meta.title = meta.textContent;
        main.appendChild(meta);
      }
      row.appendChild(main);

      const daySel = makeSelect(dayOpts, it.day || 0, (v) => {
        const fresh = cartLoad();
        const i = fresh.findIndex((x) => x.id === it.id);
        if (i !== -1) { fresh[i].day = parseInt(v, 10) || 0; cartSave(fresh); }
      });
      daySel.title = 'Day';
      row.appendChild(daySel);

      const slotSel = makeSelect(slotOpts, it.slot || '', (v) => {
        const fresh = cartLoad();
        const i = fresh.findIndex((x) => x.id === it.id);
        if (i !== -1) { fresh[i].slot = v; cartSave(fresh); }
      });
      slotSel.title = 'Time of day';
      row.appendChild(slotSel);

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'cart-item-remove';
      rm.setAttribute('aria-label', 'Remove from cart');
      rm.title = 'Remove';
      rm.textContent = '×';
      rm.addEventListener('click', () => {
        const fresh = cartLoad();
        const i = fresh.findIndex((x) => x.id === it.id);
        if (i !== -1) {
          fresh.splice(i, 1);
          cartSave(fresh);
          syncPickButton(it.id);
          renderCart();
          renderCartBadge();
        }
      });
      row.appendChild(rm);

      // Drag-to-reorder
      row.addEventListener('dragstart', (ev) => {
        row.classList.add('dragging');
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', String(idx));
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        list.querySelectorAll('.cart-item.drop-target').forEach((n) => n.classList.remove('drop-target'));
      });
      row.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        list.querySelectorAll('.cart-item.drop-target').forEach((n) => n.classList.remove('drop-target'));
        row.classList.add('drop-target');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', (ev) => {
        ev.preventDefault();
        const fromIdx = parseInt(ev.dataTransfer.getData('text/plain'), 10);
        const toIdx = parseInt(row.dataset.cartIdx, 10);
        if (isNaN(fromIdx) || isNaN(toIdx) || fromIdx === toIdx) return;
        const fresh = cartLoad();
        const [moved] = fresh.splice(fromIdx, 1);
        fresh.splice(toIdx, 0, moved);
        cartSave(fresh);
        renderCart();
      });

      list.appendChild(row);
    });
  }

  function renderCartBadge() {
    const link = document.querySelector('.nav-links a[href="#must-include"]');
    if (!link) return;
    link.classList.add('cart-nav-link');
    const count = cartLoad().length;
    let badge = link.querySelector('.cart-nav-badge');
    if (count === 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cart-nav-badge';
      link.appendChild(badge);
    }
    badge.textContent = String(count);
  }

  function buildCartPromptBlock() {
    const items = cartLoad();
    if (items.length === 0) return '';
    const range = tripDayRange();
    const lines = [];
    lines.push('');
    lines.push('');
    lines.push('CART (USER-PICKED ITEMS) — TREAT AS AUTHORITATIVE.');
    lines.push('The user explicitly picked the items below from the existing page. Rebuild the itinerary AROUND this cart:');
    lines.push('  - Items with an explicit Day + Slot MUST land on that day in that slot. Do not relocate them.');
    lines.push('  - Items with "AI decides" for day OR slot: you choose, optimizing the full sequence for (a) physical proximity / minimal transit, (b) time saved across the trip, (c) traveller effort / kid energy / heat-of-day pace, and (d) money saved (combine tickets, reuse car-days, walk where possible).');
    lines.push('  - Preserve the user-picked ORDER as a strong hint when dropping into "AI decides" slots — earlier in the cart = earlier in the trip, ties broken by proximity.');
    lines.push('  - DEDUPE AGGRESSIVELY. The same place may appear in the cart from multiple surfaces (hero carousel, anchor card, day-row activity, curator pick, creator quote). Collapse all such picks into ONE itinerary entry. The cart entries below are already deduped by name, but you may still see near-duplicates (e.g. "teamLab Planets" vs "teamLab Planets Toyosu") — treat those as ONE place. Likewise dedupe restaurants by chain + neighborhood (e.g. two T\'s Tantan picks at different stations → one visit).');
    lines.push('  - REMOVE REDUNDANCY FROM EXISTING PAGE. The previous itinerary likely contains items that overlap with the cart, or that the cart now displaces. Drop them outright — do not silently leave them in. Examples: cart has "Shibuya Sky" → drop the existing "Shibuya scramble + Sky" line if it now reads as filler; cart has lunch at place X on Day 2 → drop the previous Day-2 lunch suggestion. Only KEEP load-bearing items the cart depends on: inter-city transit, hotel check-in/-out, airport runs, kid rest blocks. Everything else that doesn\'t earn its place gets cut.');
    lines.push('  - Every cart item MUST land in the rebuilt itinerary. If something is genuinely impossible (closed, off-season, non-veg-only, kid-unsafe, geographically incompatible with chosen path), put it in the SKIPPED CALLOUT (STEP 5) with the specific reason.');
    lines.push('  - Mark every cart item visually using STEP 4\'s class hooks: class="user-pick user-pick--<category>" data-user-pick="<reason>" — pick the closest category from {places, todo, eat, link} based on item type (restaurant→eat, anchor/path/flight/car→places, activity→todo, hotel→places).');
    if (range) {
      lines.push('  - Trip window: ' + range.startISO + ' → ' + range.endISO + ' (' + range.days.length + ' days).');
    }
    lines.push('');
    lines.push('Cart items in user-specified order:');
    items.forEach((it, idx) => {
      const dayLabel = it.day && range && range.days[it.day - 1]
        ? ('Day ' + it.day + ' (' + range.days[it.day - 1].iso + ')')
        : 'AI decides';
      const slotLabel = it.slot ? it.slot : 'any time';
      const meta = [it.sourceLabel, it.meta].filter(Boolean).join(' · ');
      lines.push('  ' + (idx + 1) + '. [' + it.type + '] ' + it.name);
      lines.push('       Day: ' + dayLabel + ' · Slot: ' + slotLabel + (meta ? ' · ref: ' + meta : ''));
    });
    return lines.join('\n');
  }

  function initCart() {
    if (!document.getElementById('must-include')) return;
    scanPickables(document);
    renderCart();
    renderCartBadge();

    // Watch for late-rendered cards (hotels + restaurants come in async)
    const obs = new MutationObserver((mutations) => {
      let dirty = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches(PICKABLE_SELECTORS)) { ensurePickButton(node); dirty = true; }
          if (node.querySelectorAll) {
            const matches = node.querySelectorAll(PICKABLE_SELECTORS);
            if (matches.length) { matches.forEach(ensurePickButton); dirty = true; }
          }
        }
      }
      if (dirty) {
        // No cart re-render needed — picked-state on new buttons gets set via syncPickButton
        cartLoad().forEach((it) => syncPickButton(it.id));
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Hook the existing mi-submit button: append cart block to the prompt
    // built by initMustIncludeSection. Strategy: shadow that handler by
    // installing a capturing listener on the button that augments the
    // refresh-trigger's prompt before the existing handler reads it.
    // The existing handler reads basePrompt via closure, so we instead
    // append directly to data-refresh-prompt at click-time.
    const submitBtn = document.getElementById('mi-submit');
    const trigger = document.querySelector('[data-refresh-trigger]');
    if (submitBtn && trigger) {
      // Stash the original prompt so we can re-inject cart fresh on each click
      if (!trigger.dataset.refreshPromptOrig) {
        trigger.dataset.refreshPromptOrig = trigger.dataset.refreshPrompt || '';
      }
      submitBtn.addEventListener('click', () => {
        const cartBlock = buildCartPromptBlock();
        trigger.dataset.refreshPrompt = trigger.dataset.refreshPromptOrig + cartBlock;
      }, true); // capture: runs before the default mi-submit handler
    }
  }

  /* ========== INIT ========== */
  document.addEventListener('DOMContentLoaded', () => {
    buildRefreshModal();
    initParallax();
    initReveal();
    initTabs();
    loadData();
    initVegRestaurants();
    initHotels();
    initRestaurantEnrichment();
    initLiveCosts();
    initHolidayAlerts();
    initRouteViz();
    initCustomPlanner();
    initAnchorEnrichment();
    initItineraryEnrichment();
    initItineraryAttribution();
    initMustIncludeSection();
    initCart();
    if (window.TripMap && typeof window.TripMap.init === 'function') {
      // Defer slightly so async-rendered cards (hotels/restaurants) populate
      // before the map's first scrape.
      setTimeout(() => window.TripMap.init(), 600);
    }
  });
})();

/* =============================================================
   API Status Panel — hidden by default
   Open via:
     • ?status in URL                 (e.g. /index.html?status)
     • #status fragment               (e.g. /index.html#status)
     • Ctrl+Shift+S (Cmd+Shift+S)
     • Triple-click on the page footer

   Calls /api/status (proxy.py), translates the JSON into plain English,
   shows the result in a modal.
   ============================================================= */
(function () {
  'use strict';

  const STATUS_LABELS = {
    ok: { dot: 'ok', text: 'Healthy' },
    rate_limited: { dot: 'alert', text: 'Free quota hit' },
    errors: { dot: 'warn', text: 'Errors recently' },
    missing_key: { dot: 'muted', text: 'No API key configured' },
    untouched: { dot: 'muted', text: 'Not used yet this session' },
  };

  function elx(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    if (kids) kids.forEach((k) => k && n.appendChild(k));
    return n;
  }

  // Translate a service entry into a plain-English explanation.
  function plainExplain(s) {
    if (s.status === 'missing_key') {
      const keys = (s.missing_keys || []).join(', ');
      return `Add ${keys || 'an API key'} to trips/_shared/data/secrets.json to enable this.`;
    }
    if (s.status === 'rate_limited') {
      // Prefer probe data when available (SerpAPI returns this).
      const p = s.probe && s.probe.body;
      if (p && typeof p === 'object') {
        if (p.total_searches_left === 0 || p.plan_searches_left === 0) {
          const used = p.this_month_usage;
          const cap = p.searches_per_month;
          if (cap) return `Free plan exhausted — ${used}/${cap} searches used this month. Resets on the 1st of next month.`;
          return 'Free plan exhausted for this month.';
        }
      }
      const last = s.last_quota || 'recently';
      return `Hit the free-tier limit ${last}. Cards backed by this API will fall back to cached data until the quota resets.`;
    }
    if (s.status === 'errors') {
      const last = s.last_error || 'recently';
      const msg = s.last_message ? ` (${s.last_message})` : '';
      return `Last call failed ${last}${msg}.`;
    }
    if (s.status === 'ok') {
      // SerpAPI: surface remaining quota when probe is present.
      const p = s.probe && s.probe.body;
      if (p && typeof p === 'object') {
        if (p.keys_in_rotation && p.total_searches_cap) {
          return `${p.total_searches_left} of ${p.total_searches_cap} free searches left across ${p.keys_in_rotation} key${p.keys_in_rotation === 1 ? '' : 's'}.`;
        }
        if (p.total_searches_left != null && p.searches_per_month) {
          return `${p.total_searches_left} of ${p.searches_per_month} free searches left this month.`;
        }
      }
      return `Working. ${s.calls_ok} successful call${s.calls_ok === 1 ? '' : 's'} this session.`;
    }
    if (s.status === 'untouched') {
      return s.free_quota_hint
        ? `Configured but not called yet this session. Free quota: ${s.free_quota_hint}.`
        : 'Configured but not called yet this session.';
    }
    return '';
  }

  function buildRow(s) {
    const sl = STATUS_LABELS[s.status] || STATUS_LABELS.untouched;
    const dot = elx('span', { class: 'yss-dot ' + sl.dot });
    const left = elx('div');
    left.appendChild(elx('div', { class: 'yss-name', text: s.plain_name }));
    left.appendChild(elx('div', { class: 'yss-plain', text: plainExplain(s) }));

    const detailParts = [];
    if (s.route_hint) detailParts.push(`Routes: ${s.route_hint}`);
    if (s.signup_url && s.status === 'missing_key') {
      detailParts.push(`<a href="${s.signup_url}" target="_blank" rel="noopener">Get a key →</a>`);
    }
    if (detailParts.length) {
      left.appendChild(elx('div', { class: 'yss-detail', html: detailParts.join(' · ') }));
    }

    const counts = elx('div', { class: 'yss-counts' });
    if (s.calls_ok || s.calls_quota || s.calls_error) {
      counts.textContent = `${s.calls_ok}✓ · ${s.calls_quota}⊘ · ${s.calls_error}✗`;
      counts.title = `${s.calls_ok} successful, ${s.calls_quota} quota-blocked, ${s.calls_error} errors this session`;
    }

    return elx('div', { class: 'yss-row' }, [dot, left, counts]);
  }

  function summarize(data) {
    const services = data.services || [];
    const blocked = services.filter((s) => s.status === 'rate_limited');
    const erroring = services.filter((s) => s.status === 'errors');
    const missing = services.filter((s) => s.status === 'missing_key' && !s.informational_only);

    const parts = [];
    if (blocked.length) {
      const names = blocked.map((s) => s.service).join(', ');
      parts.push(`<strong>${blocked.length} service${blocked.length === 1 ? '' : 's'} hit free-tier limits:</strong> ${names}. Cards using these will show cached data with a "cached · Xh ago" badge.`);
    }
    if (erroring.length) {
      parts.push(`${erroring.length} service${erroring.length === 1 ? ' is' : 's are'} returning errors: ${erroring.map((s) => s.service).join(', ')}.`);
    }
    if (missing.length) {
      parts.push(`${missing.length} service${missing.length === 1 ? '' : 's'} missing API keys (${missing.map((s) => s.service).join(', ')}) — those features are silently skipped.`);
    }
    if (!parts.length) {
      parts.push('All configured APIs look healthy. Nothing is rate-limited right now.');
    }
    if (data.agent_runs) {
      const a = data.agent_runs;
      if (a.running) parts.push(`Claude bridge: <strong>${a.running} agent run${a.running === 1 ? '' : 's'} active</strong>${a.labels && a.labels.length ? ' (' + a.labels.join(', ') + ')' : ''}.`);
    }
    return parts.join(' ');
  }

  function open() {
    if (document.querySelector('.yatra-status-overlay')) return;
    const overlay = elx('div', { class: 'yatra-status-overlay' });
    const modal = elx('div', { class: 'yatra-status-modal' });
    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', esc);
      }
    });

    const close = elx('button', { class: 'yss-close', text: '×', 'aria-label': 'Close', onclick: () => overlay.remove() });
    modal.appendChild(close);
    modal.appendChild(elx('h2', { text: 'API status' }));
    modal.appendChild(elx('div', { class: 'yss-sub', text: 'Plain-English view of the upstream APIs powering this page. Hidden by default.' }));

    const summary = elx('div', { class: 'yss-summary', text: 'Loading…' });
    modal.appendChild(summary);
    const list = elx('div', { class: 'yss-list' });
    modal.appendChild(list);
    const foot = elx('div', { class: 'yss-foot' });
    modal.appendChild(foot);

    const loadAndRender = async () => {
      summary.textContent = 'Loading…';
      summary.classList.remove('alert');
      list.innerHTML = '';
      try {
        const r = await fetch('/api/status', { cache: 'no-cache' });
        const data = await r.json();
        const blocked = (data.services || []).filter((s) => s.status === 'rate_limited').length;
        summary.innerHTML = summarize(data);
        if (blocked) summary.classList.add('alert');
        // Order: errors / blocked first, then ok, then missing, then untouched
        const order = { rate_limited: 0, errors: 1, ok: 2, untouched: 3, missing_key: 4 };
        const sorted = [...data.services].sort((a, b) =>
          (order[a.status] ?? 9) - (order[b.status] ?? 9)
        );
        sorted.forEach((s) => list.appendChild(buildRow(s)));
        foot.innerHTML = '';
        foot.appendChild(elx('span', { text: 'Source: ' + (data.secrets_path || 'secrets.json') }));
        foot.appendChild(elx('button', { class: 'yss-refresh', text: 'Refresh', onclick: loadAndRender }));
      } catch (err) {
        summary.textContent = 'Could not reach /api/status — is the proxy running on :8889?';
        summary.classList.add('alert');
      }
    };

    document.body.appendChild(overlay);
    loadAndRender();
  }

  // Floating button (only renders if proxy is reachable)
  async function maybeRenderFab() {
    try {
      const r = await fetch('/api/status', { cache: 'no-cache' });
      if (!r.ok) return;
      const data = await r.json();
      const services = data.services || [];
      const blocked = services.filter((s) => s.status === 'rate_limited').length;
      const erroring = services.filter((s) => s.status === 'errors').length;

      const fab = elx('button', {
        class: 'yatra-status-fab' + (blocked ? ' alert' : erroring ? ' warn' : ''),
        title: 'API status' + (blocked ? ` — ${blocked} service${blocked === 1 ? '' : 's'} rate-limited` : ''),
        'aria-label': 'API status',
        onclick: open,
      });
      fab.textContent = blocked ? '!' : '·';
      document.body.appendChild(fab);
    } catch (_) { /* proxy not running; skip the FAB */ }
  }

  function init() {
    // Auto-open if URL asks for it
    const auto = /[?&]status(=|&|$)/.test(window.location.search) || window.location.hash === '#status';

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        open();
      }
    });

    // Triple-click anywhere in the footer
    const footer = document.querySelector('footer');
    if (footer) {
      let clicks = 0, timer = null;
      footer.addEventListener('click', () => {
        clicks += 1;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { clicks = 0; }, 600);
        if (clicks >= 3) { clicks = 0; open(); }
      });
    }

    // Always show the FAB if the proxy is available — it's small and unobtrusive,
    // and turns red when something's actually rate-limited.
    maybeRenderFab();

    if (auto) setTimeout(open, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual invocation from console: YatraStatus.open()
  window.YatraStatus = { open };
})();
