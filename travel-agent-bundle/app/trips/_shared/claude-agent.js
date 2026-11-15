/* claude-agent.js — browser client for /api/agent/runs durable runs.
 *
 * Public API:
 *   const handle = await runClaudeAgent({
 *     prompt, label, tools, addDirs, sessionId, systemPrompt, model,
 *     onFrame, onChunk, onStatusChange,
 *   });
 *   handle.runId, handle.sessionId
 *   handle.cancel()        — sends POST /cancel, also closes the EventSource
 *   handle.detach()        — stops the EventSource without cancelling
 *   handle.logUrl          — /api/agent/runs/<id>/log
 *
 * To re-attach to an existing run (on page reload, or from a stored run id):
 *   const handle = attachToRun(runId, { onFrame, onChunk, onStatusChange, since });
 *
 * Frame shapes mirror server/agent_runs.py:
 *   {type:"chunk", text}
 *   {type:"tool_use", name, input}
 *   {type:"tool_result", tool_use_id, ok}
 *   {type:"result", usage, stoppedReason, durationMs}
 *   {type:"heartbeat", elapsed_ms, phase}
 *   {type:"system", subtype, info}
 *   {type:"cancelled", method}
 *   {type:"done", exitCode}
 *   {type:"crashed", reason}
 *   {type:"error", message}
 */
(function (global) {
  'use strict';

  const PROXY_BASE = ''; // same origin (the proxy serves trips/ AND /api)

  async function runClaudeAgent(opts) {
    const body = {
      prompt: opts.prompt,
      label: opts.label || 'Claude run',
      tools: opts.tools || 'edit',
      add_dirs: opts.addDirs || opts.add_dirs,
      session_id: opts.sessionId,
      system_prompt: opts.systemPrompt,
      model: opts.model,
    };
    const resp = await fetch(`${PROXY_BASE}/api/agent/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Failed to start run: ${resp.status} ${errText}`);
    }
    const { run_id, session_id } = await resp.json();
    return attachToRun(run_id, {
      ...opts,
      sessionId: session_id,
      label: body.label,
      since: 0,
    });
  }

  function attachToRun(runId, opts = {}) {
    const since = opts.since || 0;
    const url = `${PROXY_BASE}/api/agent/runs/${runId}/stream${since ? `?since=${since}` : ''}`;
    const es = new EventSource(url);

    const handle = {
      runId,
      sessionId: opts.sessionId || null,
      label: opts.label || 'Claude run',
      logUrl: `${PROXY_BASE}/api/agent/runs/${runId}/log`,
      metaUrl: `${PROXY_BASE}/api/agent/runs/${runId}/meta`,
      lastFrameIndex: since - 1,
      status: 'running',
      _es: es,
      cancel,
      detach,
    };

    es.onmessage = (ev) => {
      // ev.lastEventId is the SSE id we set server-side (frame index)
      if (ev.lastEventId) {
        const idx = parseInt(ev.lastEventId, 10);
        if (!Number.isNaN(idx)) handle.lastFrameIndex = idx;
      }
      let frame;
      try { frame = JSON.parse(ev.data); } catch { return; }
      opts.onFrame?.(frame, handle);

      switch (frame.type) {
        case 'chunk':
          opts.onChunk?.(frame.text, handle);
          break;
        case 'done':
          handle.status = 'done';
          opts.onStatusChange?.('done', handle, frame);
          es.close();
          break;
        case 'crashed':
          handle.status = 'crashed';
          opts.onStatusChange?.('crashed', handle, frame);
          es.close();
          break;
        case 'cancelled':
          // Don't close yet — `done` follows.
          opts.onStatusChange?.('cancelling', handle, frame);
          break;
        case 'error':
          opts.onStatusChange?.('error', handle, frame);
          break;
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; surface a "reconnecting" status only.
      opts.onStatusChange?.('reconnecting', handle, null);
    };

    function cancel() {
      return fetch(`${PROXY_BASE}/api/agent/runs/${runId}/cancel`, { method: 'POST' })
        .catch(() => {});
    }
    function detach() {
      es.close();
    }
    return handle;
  }

  async function listActiveRuns() {
    try {
      const r = await fetch(`${PROXY_BASE}/api/agent/runs`);
      if (!r.ok) return [];
      const all = await r.json();
      return all.filter((m) => ['running', 'spawning', 'cancelling'].includes(m.status));
    } catch {
      return [];
    }
  }

  async function getRunMeta(runId) {
    try {
      const r = await fetch(`${PROXY_BASE}/api/agent/runs/${runId}/meta`);
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  global.ClaudeAgent = {
    runClaudeAgent,
    attachToRun,
    listActiveRuns,
    getRunMeta,
  };
})(window);
