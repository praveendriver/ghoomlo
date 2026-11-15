/* agent-toast.js — floating bottom-right progress toast for Claude agent runs.
 *
 * Wraps trips/_shared/claude-agent.js:
 *   const handle = AgentToast.start({
 *     prompt, label, tools, addDirs,
 *     onDone: (frame) => location.reload(),
 *     onCrashed: (frame) => alert(frame.reason),
 *   });
 *
 * Page-load: AgentToast.bootstrap() reattaches to:
 *   1. Any run_id stored in localStorage that's still running
 *   2. Any run reported by /api/agent/runs as running/spawning/cancelling
 *
 * Single-toast model: only one visible at a time. Switching to a different
 * run replaces the current toast. (Other runs keep going on the server, just
 * not visible in the toast — user can refresh page to switch which they watch.)
 *
 * Sliding window: keeps only the last 200 frames in DOM-rendered tail to keep
 * long runs cheap. Full history is always available via the log link.
 */
(function (global) {
  'use strict';

  const STORE_KEY = 'yatra:agent-active-run';
  const TAIL_MAX_LINES = 6;          // visible lines in the tail
  const FRAME_WINDOW = 200;          // sliding-window frame cap
  const ELAPSED_TICK_MS = 1000;
  const RECONNECT_GRACE_MS = 4000;   // before showing "lost connection"

  let toastEl = null;
  let activeHandle = null;
  let onDoneCb = null;
  let onCrashedCb = null;
  let elapsedTimer = null;
  let reconnectTimer = null;
  let frameBuf = [];                 // sliding window of recent frame texts
  let lastPhase = 'starting';
  let runStartMs = 0;

  /* ---------- DOM helpers ---------- */
  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (kids) kids.forEach((c) => c && n.appendChild(c));
    return n;
  }

  function fmtElapsed(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return m + 'm ' + rem + 's';
    const h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }

  /* ---------- toast lifecycle ---------- */
  function ensureToast() {
    if (toastEl) return toastEl;
    toastEl = el('div', { class: 'agent-toast', role: 'status', 'aria-live': 'polite' });

    const head = el('div', { class: 'agent-toast-head' });
    head.appendChild(el('div', { class: 'agent-toast-spinner' }));
    const labels = el('div', { class: 'agent-toast-labels' });
    labels.appendChild(el('div', { class: 'agent-toast-label', text: 'Working…' }));
    labels.appendChild(el('div', { class: 'agent-toast-phase', text: 'starting' }));
    head.appendChild(labels);
    const meta = el('div', { class: 'agent-toast-meta' });
    meta.appendChild(el('span', { class: 'agent-toast-elapsed', text: '0s' }));
    head.appendChild(meta);
    toastEl.appendChild(head);

    toastEl.appendChild(el('pre', { class: 'agent-toast-tail' }));

    const foot = el('div', { class: 'agent-toast-foot' });
    const stopBtn = el('button', { class: 'agent-toast-btn agent-toast-stop', type: 'button', text: 'Stop' });
    stopBtn.addEventListener('click', () => {
      if (!activeHandle) return;
      stopBtn.disabled = true;
      stopBtn.textContent = 'Stopping…';
      activeHandle.cancel();
    });
    const logLink = el('a', { class: 'agent-toast-btn agent-toast-log', target: '_blank', rel: 'noopener', text: 'Full log' });
    const closeBtn = el('button', { class: 'agent-toast-btn agent-toast-close', type: 'button', 'aria-label': 'Hide', text: '✕' });
    closeBtn.addEventListener('click', () => {
      // Only allow close when terminal — hide doesn't cancel a live run
      if (activeHandle && activeHandle.status === 'running') return;
      hideToast();
    });
    foot.appendChild(stopBtn);
    foot.appendChild(logLink);
    foot.appendChild(closeBtn);
    toastEl.appendChild(foot);

    document.body.appendChild(toastEl);
    return toastEl;
  }

  function hideToast() {
    if (!toastEl) return;
    toastEl.classList.remove('show');
    setTimeout(() => {
      if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
      toastEl = null;
    }, 200);
    stopElapsedTicker();
  }

  function setStatusClass(cls) {
    if (!toastEl) return;
    toastEl.classList.remove('running', 'cancelling', 'done', 'crashed', 'error', 'reconnecting');
    if (cls) toastEl.classList.add(cls);
  }

  function setLabel(label) {
    if (!toastEl) return;
    const node = toastEl.querySelector('.agent-toast-label');
    if (node) node.textContent = label;
  }

  function setPhase(phase) {
    if (!toastEl) return;
    const node = toastEl.querySelector('.agent-toast-phase');
    if (node) node.textContent = phase;
  }

  function appendTail(line) {
    if (!toastEl) return;
    const tail = toastEl.querySelector('.agent-toast-tail');
    if (!tail) return;
    frameBuf.push(line);
    if (frameBuf.length > FRAME_WINDOW) frameBuf.splice(0, frameBuf.length - FRAME_WINDOW);
    const visible = frameBuf.slice(-TAIL_MAX_LINES);
    tail.textContent = visible.join('\n');
    tail.scrollTop = tail.scrollHeight;
  }

  function startElapsedTicker() {
    stopElapsedTicker();
    runStartMs = runStartMs || Date.now();
    elapsedTimer = setInterval(() => {
      if (!toastEl) return;
      const span = toastEl.querySelector('.agent-toast-elapsed');
      if (span) span.textContent = fmtElapsed(Date.now() - runStartMs);
    }, ELAPSED_TICK_MS);
  }

  function stopElapsedTicker() {
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
  }

  /* ---------- localStorage persistence ---------- */
  function persist(handle) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        runId: handle.runId,
        sessionId: handle.sessionId,
        label: handle.label,
        startedAt: runStartMs,
      }));
    } catch (_) {}
  }
  function clearPersisted() {
    try { localStorage.removeItem(STORE_KEY); } catch (_) {}
  }
  function readPersisted() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
    catch (_) { return null; }
  }

  /* ---------- frame handlers ---------- */
  function handleFrame(frame, handle) {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (toastEl && toastEl.classList.contains('reconnecting')) {
      toastEl.classList.remove('reconnecting');
    }

    switch (frame.type) {
      case 'tool_use': {
        lastPhase = frame.name || 'tool';
        setPhase('using ' + lastPhase);
        const inp = frame.input ? JSON.stringify(frame.input).slice(0, 100) : '';
        appendTail('› ' + lastPhase + (inp ? ' ' + inp : ''));
        break;
      }
      case 'tool_result':
        appendTail('  ✓ ' + lastPhase + ' done');
        break;
      case 'chunk':
        // Don't append every token — track that we're "responding"
        setPhase('responding');
        break;
      case 'heartbeat':
        if (frame.phase) {
          lastPhase = frame.phase;
          setPhase(lastPhase + ' …');
        }
        break;
      case 'result':
        setPhase('wrapping up');
        break;
      case 'system':
        if (frame.subtype === 'init') appendTail('› session ready');
        break;
      case 'cancelled':
        setPhase('cancelling…');
        break;
      case 'error':
        appendTail('! ' + (frame.message || 'error'));
        break;
    }
  }

  function handleStatusChange(status, handle, frame) {
    if (!toastEl) ensureToast();

    if (status === 'reconnecting') {
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          if (!toastEl) return;
          toastEl.classList.add('reconnecting');
          setPhase('lost connection — retrying');
        }, RECONNECT_GRACE_MS);
      }
      return;
    }

    if (status === 'cancelling') {
      setStatusClass('cancelling');
      setPhase('cancelling…');
      return;
    }

    if (status === 'done') {
      setStatusClass('done');
      setPhase('done');
      stopElapsedTicker();
      clearPersisted();
      // Add reload button
      const foot = toastEl.querySelector('.agent-toast-foot');
      const stop = toastEl.querySelector('.agent-toast-stop');
      if (stop) stop.remove();
      if (foot && !foot.querySelector('.agent-toast-reload')) {
        const reload = el('button', { class: 'agent-toast-btn agent-toast-reload primary', type: 'button', text: 'Reload page' });
        reload.addEventListener('click', () => location.reload());
        foot.insertBefore(reload, foot.firstChild);
      }
      if (typeof onDoneCb === 'function') {
        try { onDoneCb(frame, handle); } catch (e) { console.warn('[agent-toast] onDone', e); }
      }
      return;
    }

    if (status === 'crashed' || status === 'error') {
      setStatusClass(status === 'error' ? 'error' : 'crashed');
      setPhase(status === 'error' ? 'error' : 'crashed');
      stopElapsedTicker();
      clearPersisted();
      const msg = (frame && (frame.reason || frame.message)) || 'no further info';
      appendTail('✗ ' + msg);
      if (typeof onCrashedCb === 'function') {
        try { onCrashedCb(frame, handle); } catch (e) { console.warn('[agent-toast] onCrashed', e); }
      }
      return;
    }
  }

  /* ---------- public API ---------- */
  function start(opts) {
    if (!global.ClaudeAgent) {
      console.warn('[agent-toast] ClaudeAgent not loaded');
      return null;
    }
    // If a run is already showing in this tab, detach from it (server keeps going).
    if (activeHandle) {
      try { activeHandle.detach(); } catch (_) {}
      activeHandle = null;
    }
    onDoneCb = opts.onDone || null;
    onCrashedCb = opts.onCrashed || null;
    runStartMs = Date.now();
    frameBuf = [];
    lastPhase = 'starting';

    ensureToast();
    setStatusClass('running');
    setLabel(opts.label || 'Working…');
    setPhase('starting');
    requestAnimationFrame(() => toastEl && toastEl.classList.add('show'));
    startElapsedTicker();

    return global.ClaudeAgent.runClaudeAgent({
      prompt: opts.prompt,
      label: opts.label || 'Claude run',
      tools: opts.tools || 'edit',
      addDirs: opts.addDirs,
      sessionId: opts.sessionId,
      systemPrompt: opts.systemPrompt,
      model: opts.model,
      onFrame: handleFrame,
      onStatusChange: handleStatusChange,
    }).then((handle) => {
      activeHandle = handle;
      const logLink = toastEl && toastEl.querySelector('.agent-toast-log');
      if (logLink) logLink.href = handle.logUrl;
      persist(handle);
      return handle;
    }).catch((err) => {
      setStatusClass('error');
      setPhase('failed to start');
      appendTail('✗ ' + (err.message || String(err)));
      stopElapsedTicker();
      clearPersisted();
      throw err;
    });
  }

  function attach(runId, opts = {}) {
    if (!global.ClaudeAgent) return null;
    if (activeHandle) {
      try { activeHandle.detach(); } catch (_) {}
      activeHandle = null;
    }
    onDoneCb = opts.onDone || null;
    onCrashedCb = opts.onCrashed || null;

    return global.ClaudeAgent.getRunMeta(runId).then((meta) => {
      if (!meta) return null;
      runStartMs = meta.started_at ? meta.started_at * 1000 : Date.now();
      frameBuf = [];
      lastPhase = meta.status || 'running';
      ensureToast();
      setLabel(meta.label || 'Claude run');
      setPhase(meta.status === 'running' ? 'reattaching…' : meta.status);
      setStatusClass(meta.status);
      requestAnimationFrame(() => toastEl && toastEl.classList.add('show'));
      if (meta.status === 'running' || meta.status === 'spawning' || meta.status === 'cancelling') {
        startElapsedTicker();
        const handle = global.ClaudeAgent.attachToRun(runId, {
          sessionId: meta.session_id,
          label: meta.label,
          since: 0,
          onFrame: handleFrame,
          onStatusChange: handleStatusChange,
        });
        activeHandle = handle;
        const logLink = toastEl && toastEl.querySelector('.agent-toast-log');
        if (logLink) logLink.href = handle.logUrl;
        persist(handle);
        return handle;
      }
      // Already terminal — just show terminal state, no SSE.
      const logLink = toastEl && toastEl.querySelector('.agent-toast-log');
      if (logLink) logLink.href = `/api/agent/runs/${runId}/log`;
      clearPersisted();
      return null;
    });
  }

  async function bootstrap() {
    if (!global.ClaudeAgent) return;
    // First: trust localStorage so the toast pops up instantly on the same tab
    const stored = readPersisted();
    if (stored && stored.runId) {
      try {
        const meta = await global.ClaudeAgent.getRunMeta(stored.runId);
        if (meta && (meta.status === 'running' || meta.status === 'spawning' || meta.status === 'cancelling')) {
          await attach(stored.runId, {});
          return;
        }
        // Stale localStorage — clear it
        clearPersisted();
      } catch (_) {
        clearPersisted();
      }
    }
    // Second: any active run on the server (different tab started it)
    try {
      const active = await global.ClaudeAgent.listActiveRuns();
      if (active && active.length > 0) {
        // Prefer the most recently started
        active.sort((a, b) => (b.started_at || 0) - (a.started_at || 0));
        await attach(active[0].run_id, {});
      }
    } catch (_) {}
  }

  global.AgentToast = { start, attach, bootstrap, hide: hideToast };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window);
