// ══════════════════════════════════════════════════════════════════════════════
// agents.js — HCCSL Agent Suite v2.0
// Agent Bus architecture: agents publish events and subscribe to each other.
// No hardcoded timeouts for inter-agent coordination — fully reactive.
//
// EVENT CATALOG:
//   schedule:generated       → genSched() completed
//   schedule:saved           → saveData() debounce flushed
//   schedule:mutated         → any edit/swap changed G.sched
//   optimizer:complete       → Optimizer finished H/A pass, payload: { report }
//   conflicts:found          → ConflictDetector found violations, payload: { violations }
//   conflicts:clear          → ConflictDetector found zero violations
//   health:scored            → SeasonHealth computed report, payload: { report }
//   season:complete          → all regular games scored
//   season:incomplete        → score cleared after season:complete fired
//   rainout:opened           → rainout modal opened, payload: { gameId }
//   rainout:scheduled        → makeup game committed, payload: { gameId, makeupId, date }
//   standings:rendered       → renderStandings() finished
// ══════════════════════════════════════════════════════════════════════════════

// ── AGENT BUS ─────────────────────────────────────────────────────────────────
const AgentBus = (() => {
  const _subs    = {};
  const _history = [];
  const MAX_HISTORY = 50;

  function subscribe(event, agentName, handler) {
    if (!_subs[event]) _subs[event] = [];
    _subs[event] = _subs[event].filter(s => s.agentName !== agentName);
    _subs[event].push({ agentName, handler });
  }

  function publish(event, payload = {}) {
    const entry = { event, payload, ts: Date.now(), time: new Date().toLocaleTimeString() };
    _history.unshift(entry);
    if (_history.length > MAX_HISTORY) _history.pop();
    console.debug(`[AgentBus] ▶ ${event}`, payload);
    for (const { agentName, handler } of (_subs[event] || [])) {
      try {
        handler(payload, event);
      } catch (err) {
        console.error(`[AgentBus] ✖ ${agentName} crashed on "${event}":`, err);
        _history.unshift({
          event: 'bus:agent_error',
          payload: { agentName, onEvent: event, error: err.message },
          ts: Date.now(), time: new Date().toLocaleTimeString()
        });
        _renderDebugPanel();
      }
    }
  }

  function history()             { return [..._history]; }
  function subscriberCount(ev)   { return (_subs[ev] || []).length; }
  function allSubscriptions() {
    const out = {};
    for (const [ev, subs] of Object.entries(_subs)) out[ev] = subs.map(s => s.agentName);
    return out;
  }

  function _renderDebugPanel() {
    const panel = document.getElementById('agent-bus-debug');
    if (!panel || panel.style.display === 'none') return;
    const subs = allSubscriptions();
    const hist = history().slice(0, 20);
    panel.innerHTML = `
      <div style="background:#0f172a;color:#e2e8f0;padding:8px 12px;font-weight:800;font-size:11px;
                  letter-spacing:0.8px;display:flex;justify-content:space-between;align-items:center;
                  position:sticky;top:0">
        <span>🚌 Agent Bus — Live Event Log</span>
        <div style="display:flex;gap:8px;align-items:center">
          <button onclick="AgentBus.clearHistory()"
            style="background:#334155;border:none;color:#94a3b8;font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer">Clear</button>
          <button onclick="AGENTS.hideDebug()"
            style="background:none;border:none;color:#e2e8f0;font-size:16px;cursor:pointer">×</button>
        </div>
      </div>
      <div style="padding:8px 12px;border-bottom:1px solid #1e293b">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">Subscriptions</div>
        <div style="display:grid;gap:3px">
          ${Object.entries(subs).map(([ev, agents]) => `
            <div style="display:flex;gap:6px;align-items:baseline">
              <code style="font-size:10px;color:#38bdf8;min-width:160px">${ev}</code>
              <span style="font-size:10px;color:#94a3b8">${agents.join(', ')}</span>
            </div>`).join('')}
        </div>
      </div>
      <div style="padding:8px 12px">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">Recent Events</div>
        <div style="display:grid;gap:4px">
          ${hist.map(h => {
            const isErr = h.event === 'bus:agent_error';
            const ec = isErr ? '#f87171' : h.event.includes('conflict') ? '#fb923c' :
                       h.event.includes('complete') || h.event.includes('clear') ? '#4ade80' : '#38bdf8';
            const ps = Object.keys(h.payload).length
              ? JSON.stringify(h.payload).slice(0, 60) + (JSON.stringify(h.payload).length > 60 ? '…' : '') : '';
            return `
              <div style="font-size:10px;display:flex;gap:6px;align-items:baseline;padding:3px 0;border-bottom:1px solid #1e293b">
                <span style="color:#475569;min-width:56px">${h.time}</span>
                <code style="color:${ec};min-width:180px">${h.event}</code>
                ${ps ? `<span style="color:#64748b;font-size:9px">${ps}</span>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function clearHistory() { _history.length = 0; _renderDebugPanel(); }

  return { subscribe, publish, history, subscriberCount, allSubscriptions, clearHistory, _renderDebugPanel };
})();


// ── AGENT REGISTRY ────────────────────────────────────────────────────────────
const AGENTS = {};


// ══════════════════════════════════════════════════════════════════════════════
// AGENT 1: CONFLICT DETECTOR
// Subscribes: schedule:generated, schedule:saved, schedule:mutated,
//             optimizer:complete, rainout:scheduled
// Publishes:  conflicts:found, conflicts:clear
// ══════════════════════════════════════════════════════════════════════════════
AGENTS.ConflictDetector = {
  _lastCount: -1,

  init() {
    AgentBus.subscribe('schedule:generated', 'ConflictDetector', () => this.run());
    AgentBus.subscribe('schedule:saved',     'ConflictDetector', () => this.run());
    AgentBus.subscribe('schedule:mutated',   'ConflictDetector', () => this.run());
    AgentBus.subscribe('optimizer:complete', 'ConflictDetector', () => this.run());
    AgentBus.subscribe('rainout:scheduled',  'ConflictDetector', () => this.run());
  },

  run() {
    if (!G.sched.length) { this._hide(); return []; }
    const violations = this._scan();
    if (violations.length) {
      this._render(violations);
      if (violations.length !== this._lastCount) {
        AgentBus.publish('conflicts:found', { violations, count: violations.length });
        this._lastCount = violations.length;
      }
    } else {
      this._hide();
      if (this._lastCount !== 0) {
        AgentBus.publish('conflicts:clear', {});
        this._lastCount = 0;
      }
    }
    return violations;
  },

  _scan() {
    const v = [];
    const lt = G.teams.filter(t => t !== CROSSOVER);

    // 1. Team double-booked same time+date
    const ts = {};
    for (const g of G.sched) {
      if (g.open || g.bye || !g.home || !g.away) continue;
      for (const tm of [g.home, g.away]) {
        const k = `${tm}|${g.date}|${g.time}`;
        if (!ts[k]) ts[k] = [];
        ts[k].push(g.id);
      }
    }
    for (const [key, ids] of Object.entries(ts)) {
      if (ids.length > 1) {
        const [tm, date, time] = key.split('|');
        v.push({ type:'DOUBLE_BOOK_TEAM', sev:'error',
          msg:`${tm} double-booked on ${date} at ${time} (games: ${ids.join(', ')})` });
      }
    }

    // 2. Diamond double-booked same time+date
    const ds = {};
    for (const g of G.sched) {
      if (g.diamond == null) continue;
      const k = `${g.diamond}|${g.date}|${g.time}`;
      if (!ds[k]) ds[k] = [];
      ds[k].push(g.id);
    }
    for (const [key, ids] of Object.entries(ds)) {
      if (ids.length > 1) {
        const [d, date, time] = key.split('|');
        v.push({ type:'DOUBLE_BOOK_DIAMOND', sev:'error',
          msg:`Diamond ${d} double-booked on ${date} at ${time} (games: ${ids.join(', ')})` });
      }
    }

    // 3. No-lights violations
    const noLt = G.diamonds.filter(d => !d.lightsCapable).map(d => d.id);
    for (const g of G.sched) {
      if (g.open) continue;
      if (noLt.includes(g.diamond)) {
        const t = (g.time || '').toLowerCase();
        if (t.includes('8:15') || t.includes('8:30') || t.includes('9:'))
          v.push({ type:'NO_LIGHTS', sev:'error',
            msg:`Game ${g.id} on ${g.date}: D${g.diamond} has no lights but scheduled at ${g.time}` });
      }
    }

    // 4. Back-to-back byes
    const nd = [...new Set(G.sched.map(g => g.date))].sort();
    const bn = {};
    for (const t of lt) bn[t] = [];
    for (const date of nd) {
      const playing = new Set(
        G.sched.filter(g => g.date === date && !g.open && g.home && g.away)
               .flatMap(g => [g.home, g.away])
      );
      for (const t of lt) { if (!playing.has(t)) bn[t].push(date); }
    }
    for (const [team, byes] of Object.entries(bn)) {
      for (let i = 1; i < byes.length; i++) {
        if (nd.indexOf(byes[i]) === nd.indexOf(byes[i-1]) + 1)
          v.push({ type:'BACK_TO_BACK_BYE', sev:'warn',
            msg:`${team} has back-to-back byes on ${byes[i-1]} and ${byes[i]}` });
      }
    }

    // 5. GPT overage
    const gpt = parseInt(document.getElementById('gpt')?.value) || null;
    if (gpt) {
      const tc = {};
      for (const t of lt) tc[t] = 0;
      for (const g of G.sched) {
        if (g.open || !g.home || !g.away || g.crossover) continue;
        if (tc[g.home] !== undefined) tc[g.home]++;
        if (tc[g.away] !== undefined) tc[g.away]++;
      }
      for (const [t, cnt] of Object.entries(tc))
        if (cnt > gpt)
          v.push({ type:'GPT_OVERAGE', sev:'warn',
            msg:`${t} has ${cnt} games — exceeds GPT cap of ${gpt}` });
    }

    // 6. Diamond 1 (does not exist)
    for (const g of G.sched)
      if (g.diamond === 1)
        v.push({ type:'INVALID_DIAMOND', sev:'error',
          msg:`Game ${g.id} on ${g.date}: Diamond 1 does not exist` });

    return v;
  },

  _render(violations) {
    let p = document.getElementById('agent-conflict-panel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'agent-conflict-panel';
      p.style.cssText = `position:fixed;bottom:72px;right:16px;width:380px;max-height:300px;
        overflow-y:auto;background:#fff;border:2px solid #dc2626;border-radius:10px;
        box-shadow:0 4px 20px rgba(0,0,0,0.18);z-index:9000;font-size:12px;font-family:inherit;`;
      document.body.appendChild(p);
    }
    const errs = violations.filter(v => v.sev === 'error');
    const wrns = violations.filter(v => v.sev === 'warn');
    const hc = errs.length ? '#dc2626' : '#d97706';
    p.innerHTML = `
      <div style="background:${hc};color:#fff;padding:8px 12px;font-weight:800;font-size:11px;
                  letter-spacing:0.8px;text-transform:uppercase;display:flex;justify-content:space-between;
                  align-items:center;position:sticky;top:0">
        <span>⚠ ${violations.length} Conflict${violations.length !== 1 ? 's' : ''} Detected</span>
        <button onclick="AGENTS.ConflictDetector._hide()"
          style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer">×</button>
      </div>
      <div style="padding:8px 12px;display:grid;gap:5px">
        ${violations.map(v => `
          <div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px solid #f3f4f6">
            <span style="font-size:14px;flex-shrink:0">${v.sev === 'error' ? '🔴' : '🟡'}</span>
            <span style="color:#111;line-height:1.4">${v.msg}</span>
          </div>`).join('')}
      </div>
      <div style="padding:6px 12px;background:#f9fafb;font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb">
        ${errs.length} error${errs.length !== 1 ? 's' : ''} · ${wrns.length} warning${wrns.length !== 1 ? 's' : ''} · via AgentBus
      </div>`;
  },

  _hide() { document.getElementById('agent-conflict-panel')?.remove(); }
};


// ══════════════════════════════════════════════════════════════════════════════
// AGENT 2: SCHEDULE OPTIMIZER
// Subscribes: schedule:generated
// Publishes:  optimizer:complete, schedule:mutated
// Reacts to:  conflicts:found → flags post-optimization conflicts in panel
//             conflicts:clear → clears that flag
// ══════════════════════════════════════════════════════════════════════════════
AGENTS.ScheduleOptimizer = {
  init() {
    AgentBus.subscribe('schedule:generated', 'ScheduleOptimizer', () => this.run());
    AgentBus.subscribe('conflicts:found', 'ScheduleOptimizer', ({ violations }) => {
      const note = document.getElementById('opt-conflict-note');
      if (!note) return;
      note.textContent = `⚠ ${violations.length} conflict${violations.length !== 1 ? 's' : ''} detected post-optimization`;
      note.style.display = 'block';
    });
    AgentBus.subscribe('conflicts:clear', 'ScheduleOptimizer', () => {
      const note = document.getElementById('opt-conflict-note');
      if (note) note.style.display = 'none';
    });
  },

  run() {
    if (!G.sched.length) return;
    const report = { haSwaps: 0, details: [] };
    const lt = G.teams.filter(t => t !== CROSSOVER);

    // Pass 1: H/A equity
    const hc = {};
    for (const t of lt) hc[t] = 0;
    for (const g of G.sched) {
      if (g.open || g.crossover || !g.home || !g.away) continue;
      if (hc[g.home] !== undefined) hc[g.home]++;
    }
    const swapped = new Set();
    for (const g of G.sched) {
      if (g.open || g.crossover || !g.home || !g.away || swapped.has(g.id)) continue;
      if (hc[g.home] === undefined || hc[g.away] === undefined) continue;
      if (hc[g.home] - hc[g.away] >= 2) {
        hc[g.home]--; hc[g.away]++;
        const tmp = g.home; g.home = g.away; g.away = tmp;
        swapped.add(g.id);
        report.haSwaps++;
        report.details.push(`Swapped H/A: game ${g.id} on ${g.date} D${g.diamond}`);
      }
    }

    // Pass 2: DH balance report
    const dhc = {};
    for (const t of lt) dhc[t] = 0;
    const gbd = {};
    for (const g of G.sched) {
      if (g.open || g.crossover || !g.home || !g.away) continue;
      if (!gbd[g.date]) gbd[g.date] = [];
      gbd[g.date].push(g);
    }
    for (const games of Object.values(gbd)) {
      const tgn = {};
      for (const g of games) {
        tgn[g.home] = (tgn[g.home] || 0) + 1;
        tgn[g.away] = (tgn[g.away] || 0) + 1;
      }
      for (const [t, cnt] of Object.entries(tgn))
        if (cnt >= 2 && lt.includes(t)) dhc[t]++;
    }
    const dv = Object.values(dhc);
    const dhMin = dv.length ? Math.min(...dv) : 0;
    const dhMax = dv.length ? Math.max(...dv) : 0;
    report.dhBalance = { min: dhMin, max: dhMax,
      outliers: lt.filter(t => dhc[t] === dhMax && dhMax - dhMin >= 2) };

    saveData();
    AgentBus.publish('optimizer:complete', { report });
    if (report.haSwaps > 0)
      AgentBus.publish('schedule:mutated', { source: 'ScheduleOptimizer', swaps: report.haSwaps });

    this._renderReport(report);
    return report;
  },

  _renderReport(r) {
    let p = document.getElementById('agent-optimizer-panel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'agent-optimizer-panel';
      p.style.cssText = `position:fixed;bottom:72px;left:16px;width:340px;background:#fff;
        border:2px solid #2563eb;border-radius:10px;
        box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:9000;font-size:12px;font-family:inherit;`;
      document.body.appendChild(p);
    }
    p.innerHTML = `
      <div style="background:#2563eb;color:#fff;padding:8px 12px;font-weight:800;font-size:11px;
                  letter-spacing:0.8px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center">
        <span>⚙ Schedule Optimizer</span>
        <button onclick="document.getElementById('agent-optimizer-panel')?.remove()"
          style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer">×</button>
      </div>
      <div style="padding:10px 12px;display:grid;gap:5px">
        <div>✅ H/A swaps: <strong>${r.haSwaps}</strong></div>
        <div>${r.dhBalance.outliers.length
          ? `⚠ DH imbalance: ${r.dhBalance.outliers.join(', ')} (max ${r.dhBalance.max}, min ${r.dhBalance.min})`
          : `✅ DH balanced (${r.dhBalance.min}–${r.dhBalance.max})`}</div>
        ${r.details.slice(0, 5).map(d => `<div style="color:#6b7280;font-size:11px">${d}</div>`).join('')}
        ${r.details.length > 5 ? `<div style="color:#6b7280;font-size:11px">…+${r.details.length - 5} more</div>` : ''}
        <div id="opt-conflict-note" style="display:none;color:#d97706;font-size:11px;margin-top:4px"></div>
      </div>
      <div style="padding:6px 12px;background:#eff6ff;font-size:11px;color:#1e40af;border-top:1px solid #dbeafe">
        Saved · ConflictDetector scanning via AgentBus…
      </div>`;
    setTimeout(() => p?.remove(), 10000);
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// AGENT 3: RAINOUT RECOVERY
// Subscribes: rainout:opened
// Publishes:  rainout:scheduled  (via selectMakeupDate hook)
// Reacts to:  conflicts:found → warns inside recommendation panel
//             conflicts:clear → clears warning
// ══════════════════════════════════════════════════════════════════════════════
AGENTS.RainoutRecovery = {
  init() {
    AgentBus.subscribe('rainout:opened', 'RainoutRecovery', ({ gameId }) => {
      this.renderRecommendations(gameId);
    });
    AgentBus.subscribe('conflicts:found', 'RainoutRecovery', ({ violations }) => {
      const warn = document.getElementById('rainout-conflict-warn');
      if (!warn) return;
      warn.textContent = `⚠ ${violations.length} conflict${violations.length !== 1 ? 's' : ''} exist — verify makeup slot`;
      warn.style.display = 'block';
    });
    AgentBus.subscribe('conflicts:clear', 'RainoutRecovery', () => {
      const warn = document.getElementById('rainout-conflict-warn');
      if (warn) warn.style.display = 'none';
    });
  },

  recommend(gameId, topN = 3) {
    const original = G.sched.find(g => g.id === gameId);
    if (!original) return [];
    const today = original.date;
    const lt = G.teams.filter(t => t !== CROSSOVER);

    const tbc = {};
    for (const t of lt) tbc[t] = 0;
    const nd = [...new Set(G.sched.map(g => g.date))].sort();
    for (const date of nd) {
      const playing = new Set(G.sched.filter(g => g.date === date && !g.open && g.home && g.away)
                                     .flatMap(g => [g.home, g.away]));
      for (const t of lt) { if (!playing.has(t)) tbc[t]++; }
    }

    const open = G.sched.filter(g => g.open && g.date > today);
    if (!open.length) return [];

    const scored = open.map(slot => {
      const dm = G.diamonds.find(d => d.id === slot.diamond);
      const hasLights = dm?.lightsCapable && dm?.lights;
      const tpn = new Set(G.sched.filter(g => g.date === slot.date && !g.open && g.home && g.away)
                                  .flatMap(g => [g.home, g.away]));
      if (tpn.has(original.home) || tpn.has(original.away)) return null;
      const st = (slot.time || '').toLowerCase();
      if ((st.includes('8:15') || st.includes('8:30')) && dm && !dm.lightsCapable) return null;
      const daysOut = (new Date(slot.date) - new Date(today)) / 86400000;
      const eq = (tbc[original.home] || 0) + (tbc[original.away] || 0);
      return { slot, rankScore: daysOut - eq * 0.5 - (hasLights ? 1 : 0) };
    }).filter(Boolean);

    scored.sort((a, b) => a.rankScore - b.rankScore);
    return scored.slice(0, topN).map(s => s.slot);
  },

  renderRecommendations(gameId) {
    const recs = this.recommend(gameId);
    const container = document.getElementById('agent-rainout-recs');
    if (!container) return;
    const dm = id => G.diamonds.find(d => d.id === id);
    container.innerHTML = `
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;
                  color:#374151;margin-bottom:6px">🤖 Agent Recommendations</div>
      <div id="rainout-conflict-warn"
           style="display:none;color:#d97706;font-size:11px;margin-bottom:6px;
                  background:#fef3c7;padding:4px 8px;border-radius:5px"></div>
      ${recs.length
        ? `<div style="display:grid;gap:6px">
            ${recs.map(slot => {
              const d = dm(slot.diamond);
              const li = d?.lightsCapable && d?.lights ? '💡' : '🌙';
              return `<button onclick="selectMakeupDate('${slot.date}','${slot.diamond}','${slot.time || '6:30 PM'}',${!!(d?.lightsCapable && d?.lights)})"
                style="background:#f0fdf4;border:1.5px solid #16a34a;border-radius:7px;
                       padding:8px 12px;cursor:pointer;text-align:left;font-size:12px;font-family:inherit">
                <strong>${slot.date}</strong> · D${slot.diamond} ${li} · ${slot.time || '6:30 PM'}
                <span style="float:right;color:#16a34a;font-weight:700">Use →</span>
              </button>`;
            }).join('')}
          </div>`
        : `<div style="color:#6b7280;font-size:12px">No open slots found after this game date.</div>`
      }`;
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// AGENT 4: STANDINGS INTELLIGENCE
// Subscribes: schedule:saved, schedule:mutated, season:complete, season:incomplete
// Publishes:  (consumed directly via getLabels())
// Cache invalidated on every data-change event
// ══════════════════════════════════════════════════════════════════════════════
AGENTS.StandingsIntelligence = {
  _seasonComplete: false,
  _cache: {},

  init() {
    const invalidate = () => { this._cache = {}; };
    AgentBus.subscribe('schedule:saved',    'StandingsIntelligence', invalidate);
    AgentBus.subscribe('schedule:mutated',  'StandingsIntelligence', invalidate);
    AgentBus.subscribe('season:complete',   'StandingsIntelligence', () => { this._seasonComplete = true;  this._cache = {}; });
    AgentBus.subscribe('season:incomplete', 'StandingsIntelligence', () => { this._seasonComplete = false; this._cache = {}; });
  },

  getLabels() {
    if (Object.keys(this._cache).length) return this._cache;
    if (!G.sched.length) return {};
    const lt = G.teams.filter(t => t !== CROSSOVER);
    if (lt.length < 2) return {};

    const stats = {};
    for (const t of lt) stats[t] = { gp: 0, w: 0, l: 0, tie: 0, pts: 0 };
    for (const g of G.sched) {
      if (g.playoff || g.open || !g.home || !g.away) continue;
      const sc = G.scores[g.id]; if (!sc) continue;
      if (stats[g.home] !== undefined) {
        stats[g.home].gp++;
        if (sc.h > sc.a) { stats[g.home].w++; stats[g.home].pts += 2; }
        else if (sc.a > sc.h) stats[g.home].l++;
        else { stats[g.home].tie++; stats[g.home].pts++; }
      }
      if (stats[g.away] !== undefined) {
        stats[g.away].gp++;
        if (sc.a > sc.h) { stats[g.away].w++; stats[g.away].pts += 2; }
        else if (sc.h > sc.a) stats[g.away].l++;
        else { stats[g.away].tie++; stats[g.away].pts++; }
      }
    }

    const tgr = {};
    for (const t of lt) tgr[t] = 0;
    for (const g of G.sched) {
      if (g.playoff || g.open || !g.home || !g.away || G.scores[g.id]) continue;
      if (stats[g.home] !== undefined) tgr[g.home]++;
      if (stats[g.away] !== undefined) tgr[g.away]++;
    }
    const grem = G.sched.filter(g => !g.playoff && !g.open && g.home && g.away && !G.scores[g.id]).length;

    const ranked = [...lt].sort((a, b) => {
      const pd = stats[b].pts - stats[a].pts;
      return pd !== 0 ? pd : (stats[b].w - stats[b].l) - (stats[a].w - stats[a].l);
    });

    const spots = Math.min(4, lt.length);
    const leader = ranked[0];
    const leaderPts = stats[leader].pts;
    const labels = {};

    for (let i = 0; i < ranked.length; i++) {
      const t = ranked[i];
      const s = stats[t];
      const rank = i + 1;
      const maxPoss = s.pts + tgr[t] * 2;
      const canReach = maxPoss >= leaderPts;

      let clinched = false;
      if (rank <= spots && spots < ranked.length) {
        const bubble = ranked[spots];
        clinched = bubble ? (stats[bubble].pts + tgr[bubble] * 2) < s.pts : true;
      }

      if (this._seasonComplete && rank === 1) {
        labels[t] = { text: '🏆 League Champion', color: '#d97706', bg: '#fef9c3' };
      } else if (rank === 1 && grem > 0 && !ranked.slice(1).some(o => stats[o].pts + tgr[o] * 2 >= s.pts)) {
        labels[t] = { text: '🥇 Clinched 1st', color: '#16a34a', bg: '#dcfce7' };
      } else if (clinched) {
        labels[t] = { text: `✅ Playoffs Locked #${rank}`, color: '#2563eb', bg: '#dbeafe' };
      } else if (!canReach && grem > 0) {
        labels[t] = { text: '❌ Eliminated', color: '#dc2626', bg: '#fee2e2' };
      } else if (rank <= spots && grem > 0) {
        labels[t] = { text: `🎯 Playoff Pos #${rank}`, color: '#7c3aed', bg: '#ede9fe' };
      } else {
        labels[t] = null;
      }
    }

    this._cache = labels;
    return labels;
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// AGENT 5: SEASON HEALTH
// Subscribes: schedule:saved, schedule:mutated, conflicts:found, conflicts:clear,
//             season:complete, season:incomplete
// Publishes:  health:scored
// Conflict penalty applied in real time via bus — no polling
// ══════════════════════════════════════════════════════════════════════════════
AGENTS.SeasonHealth = {
  _conflictPenalty: 0,
  _seasonComplete: false,

  init() {
    AgentBus.subscribe('schedule:saved',    'SeasonHealth', () => this.run());
    AgentBus.subscribe('schedule:mutated',  'SeasonHealth', () => this.run());
    AgentBus.subscribe('conflicts:found',   'SeasonHealth', ({ violations }) => {
      this._conflictPenalty = violations.filter(v => v.sev === 'error').length * 10
                            + violations.filter(v => v.sev === 'warn').length  * 3;
      this.run();
    });
    AgentBus.subscribe('conflicts:clear',   'SeasonHealth', () => { this._conflictPenalty = 0; this.run(); });
    AgentBus.subscribe('season:complete',   'SeasonHealth', () => { this._seasonComplete = true;  this.run(); });
    AgentBus.subscribe('season:incomplete', 'SeasonHealth', () => { this._seasonComplete = false; this.run(); });
  },

  run() {
    const active = window._activeTab || '';
    if (active !== 'standings' && active !== 'admin') return;
    const report = this._compute();
    AgentBus.publish('health:scored', { report });
    this._render(report);
    return report;
  },

  _compute() {
    const lt = G.teams.filter(t => t !== CROSSOVER);
    const all = G.sched.filter(g => !g.playoff && !g.open && g.home && g.away);
    const scored = all.filter(g => G.scores[g.id]);
    const open = G.sched.filter(g => g.open);
    const pct = all.length ? Math.round(scored.length / all.length * 100) : 0;

    const gpt = parseInt(document.getElementById('gpt')?.value) || null;
    const tc = {};
    for (const t of lt) tc[t] = 0;
    for (const g of all) {
      if (tc[g.home] !== undefined) tc[g.home]++;
      if (tc[g.away] !== undefined) tc[g.away]++;
    }
    const counts = lt.map(t => tc[t]);
    const minG = counts.length ? Math.min(...counts) : 0;
    const maxG = counts.length ? Math.max(...counts) : 0;
    const belowGpt = gpt ? lt.filter(t => tc[t] < gpt) : [];

    const nd = [...new Set(G.sched.map(g => g.date))].sort();
    const tbc = {};
    for (const t of lt) tbc[t] = 0;
    for (const date of nd) {
      const playing = new Set(G.sched.filter(g => g.date === date && !g.open && g.home && g.away)
                                     .flatMap(g => [g.home, g.away]));
      for (const t of lt) { if (!playing.has(t)) tbc[t]++; }
    }
    const bc = lt.map(t => tbc[t]);
    const byeMin = bc.length ? Math.min(...bc) : 0;
    const byeMax = bc.length ? Math.max(...bc) : 0;
    const byeOut = lt.filter(t => tbc[t] === byeMax && byeMax - byeMin >= 2);

    const ms = [];
    if (pct >= 25 && pct < 50)  ms.push({ label: '25% Complete',    icon: '📊' });
    if (pct >= 50 && pct < 75)  ms.push({ label: '50% Halfway!',    icon: '⚾' });
    if (pct >= 75 && pct < 100) ms.push({ label: '75% Almost Done', icon: '🏁' });
    if (pct === 100 || this._seasonComplete) ms.push({ label: 'Season Complete!', icon: '🏆' });

    return {
      pct, total: all.length, scored: scored.length,
      openSlots: this._seasonComplete ? 0 : open.length,
      minGames: minG, maxGames: maxG, belowGpt, byeMin, byeMax,
      byeOutliers: byeOut, milestones: ms, gptInput: gpt,
      conflictPenalty: this._conflictPenalty
    };
  },

  _hs(r) {
    let s = 100;
    if (r.openSlots > 0)              s -= Math.min(r.openSlots * 3, 20);
    if (r.maxGames - r.minGames > 2)  s -= 15;
    if (r.byeMax - r.byeMin >= 3)     s -= 10;
    if (r.belowGpt.length)            s -= r.belowGpt.length * 5;
    s -= Math.min(r.conflictPenalty, 30);
    return Math.max(0, Math.min(100, s));
  },

  _render(r) {
    let w = document.getElementById('agent-health-widget');
    if (!w) {
      w = document.createElement('div');
      w.id = 'agent-health-widget';
      w.style.cssText = 'margin-bottom:12px;';
      const sto = document.getElementById('sto');
      if (sto) sto.parentNode.insertBefore(w, sto);
      else document.body.appendChild(w);
    }
    const hs = this._hs(r);
    const bc = r.pct < 50 ? '#2563eb' : r.pct < 75 ? '#d97706' : '#16a34a';
    const hi = hs >= 80 ? '🟢' : hs >= 50 ? '🟡' : '🔴';
    w.innerHTML = `
      <div style="border:1.5px solid var(--border,#e5e7eb);border-radius:10px;overflow:hidden;
                  margin-bottom:10px;font-size:12px;font-family:inherit">
        <div style="background:var(--navy,#1e3a5f);color:#fff;padding:7px 12px;font-weight:800;
                    font-size:11px;letter-spacing:0.8px;text-transform:uppercase;
                    display:flex;justify-content:space-between;align-items:center">
          <span>🤖 Season Health</span>
          <span>${hi} ${hs}/100${r.conflictPenalty ? ` <span style="font-size:10px;opacity:0.7">(−${r.conflictPenalty} conflicts)</span>` : ''}</span>
        </div>
        <div style="padding:10px 12px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#f9fafb">
          ${this._m('Scored',     `${r.scored}/${r.total}`,        `${r.pct}%`)}
          ${this._m('Open Slots', r.openSlots,                     r.openSlots > 0 ? '⚠' : '✓')}
          ${this._m('Games',      `${r.minGames}–${r.maxGames}`,   r.maxGames - r.minGames > 2 ? '⚠' : '✓')}
          ${this._m('Byes',       `${r.byeMin}–${r.byeMax}`,       r.byeMax - r.byeMin >= 2 ? '⚠' : '✓')}
        </div>
        <div style="padding:4px 12px 8px;background:#f9fafb">
          <div style="height:6px;background:#e5e7eb;border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${r.pct}%;background:${bc};border-radius:4px;transition:width 0.4s"></div>
          </div>
        </div>
        ${r.belowGpt.length ? `<div style="padding:5px 12px;background:#fef9c3;font-size:11px;color:#92400e;border-top:1px solid #fde68a">
          ⚠ Below GPT (${r.gptInput}): ${r.belowGpt.join(', ')}</div>` : ''}
        ${r.byeOutliers.length ? `<div style="padding:5px 12px;background:#fef3c7;font-size:11px;color:#b45309;border-top:1px solid #fde68a">
          ⚠ Bye outliers: ${r.byeOutliers.join(', ')} (${r.byeMax} vs min ${r.byeMin})</div>` : ''}
        ${r.milestones.length ? `<div style="padding:5px 12px;background:#f0fdf4;font-size:11px;color:#166534;border-top:1px solid #bbf7d0;font-weight:700">
          ${r.milestones.map(m => `${m.icon} ${m.label}`).join(' · ')}</div>` : ''}
      </div>`;
  },

  _m(label, value, sub) {
    return `<div style="text-align:center;padding:6px;background:#fff;border-radius:6px;border:1px solid #e5e7eb">
      <div style="font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
      <div style="font-size:18px;font-weight:900;color:#1e3a5f;line-height:1.2">${value}</div>
      <div style="font-size:11px;color:#6b7280">${sub}</div>
    </div>`;
  }
};


// ══════════════════════════════════════════════════════════════════════════════
// AGENT 6: END-OF-SEASON AUTOMATION
// Subscribes: schedule:saved
// Publishes:  season:complete, season:incomplete
// Reacts to:  conflicts:found → warns in EOS panel before finalizing
//             health:scored   → updates open-slot checklist item live
// ══════════════════════════════════════════════════════════════════════════════
AGENTS.EndOfSeason = {
  _fired: false,

  init() {
    AgentBus.subscribe('schedule:saved', 'EndOfSeason', () => this.run());
    AgentBus.subscribe('conflicts:found', 'EndOfSeason', ({ violations }) => {
      const warn = document.getElementById('eos-conflict-warn');
      if (!warn) return;
      warn.textContent = `⚠ ${violations.length} conflict${violations.length !== 1 ? 's' : ''} exist — resolve before recording champion`;
      warn.style.display = 'block';
    });
    AgentBus.subscribe('conflicts:clear', 'EndOfSeason', () => {
      const warn = document.getElementById('eos-conflict-warn');
      if (warn) warn.style.display = 'none';
    });
    AgentBus.subscribe('health:scored', 'EndOfSeason', ({ report }) => {
      const item = document.getElementById('eos-check-openslots');
      if (!item) return;
      if (report.openSlots === 0) {
        item.textContent = '☑ No open slots remaining';
        item.style.color = '#16a34a';
      } else {
        item.textContent = `☐ ${report.openSlots} open slot${report.openSlots !== 1 ? 's' : ''} remaining`;
        item.style.color = '#dc2626';
      }
    });
  },

  run() {
    if (!G.sched.length) return;
    const all = G.sched.filter(g => !g.playoff && !g.open && g.home && g.away);
    if (!all.length) return;
    const isComplete = all.every(g => G.scores[g.id]);

    if (isComplete && !this._fired) {
      this._fired = true;
      AgentBus.publish('season:complete', { season: G.currentSeason || 2026 });
      this._prompt();
    } else if (!isComplete && this._fired) {
      this._fired = false;
      AgentBus.publish('season:incomplete', { season: G.currentSeason || 2026 });
      document.getElementById('agent-eos-panel')?.remove();
    }
  },

  _prompt() {
    const lt = G.teams.filter(t => t !== CROSSOVER);
    const stats = {};
    for (const t of lt) stats[t] = { pts: 0, w: 0, l: 0, gp: 0 };
    for (const g of G.sched) {
      if (g.playoff || g.open || !g.home || !g.away) continue;
      const sc = G.scores[g.id]; if (!sc) continue;
      if (stats[g.home] !== undefined) {
        stats[g.home].gp++;
        if (sc.h > sc.a) { stats[g.home].w++; stats[g.home].pts += 2; }
        else if (sc.a > sc.h) stats[g.home].l++;
        else stats[g.home].pts++;
      }
      if (stats[g.away] !== undefined) {
        stats[g.away].gp++;
        if (sc.a > sc.h) { stats[g.away].w++; stats[g.away].pts += 2; }
        else if (sc.h > sc.a) stats[g.away].l++;
        else stats[g.away].pts++;
      }
    }
    const ranked = [...lt].sort((a, b) => stats[b].pts - stats[a].pts);
    const champion = ranked[0];
    const season = G.currentSeason || 2026;
    if ((G.champions || []).find(c => c.year === season)) return;
    if (document.getElementById('agent-eos-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'agent-eos-panel';
    panel.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      width:420px;background:#fff;border:2px solid #16a34a;border-radius:12px;
      box-shadow:0 8px 40px rgba(0,0,0,0.25);z-index:9999;font-family:inherit;font-size:13px;`;

    const s = stats[champion];
    panel.innerHTML = `
      <div style="background:#16a34a;color:#fff;padding:12px 16px;font-weight:800;font-size:13px;
                  border-radius:10px 10px 0 0;text-align:center">🏆 ${season} Season Complete!</div>
      <div style="padding:20px">
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                      letter-spacing:0.7px;margin-bottom:4px">Standings Leader</div>
          <div style="font-size:26px;font-weight:900;color:#1e3a5f">${champion}</div>
          <div style="font-size:13px;color:#6b7280">${s.w}W–${s.l}L · ${s.pts} pts</div>
        </div>
        <div id="eos-conflict-warn" style="display:none;background:#fef3c7;color:#b45309;
             font-size:11px;padding:6px 10px;border-radius:6px;margin-bottom:10px"></div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;
                    padding:12px;margin-bottom:14px;font-size:12px;line-height:1.9">
          <strong>End-of-Season Checklist:</strong>
          <div id="eos-check-openslots">☐ Checking open slots…</div>
          <div>☐ Record champion in Hall of Champions tab</div>
          <div>☐ Confirm POD A (league) and POD B (tier B) winners</div>
          <div>☐ Archive season via Admin → Settings</div>
          <div>☐ Clear schedule for next season</div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="AGENTS.EndOfSeason._goToChampions()"
            style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:7px;
                   padding:10px;font-weight:800;cursor:pointer;font-size:13px">🏆 Record Champion</button>
          <button onclick="document.getElementById('agent-eos-panel')?.remove()"
            style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:7px;
                   padding:10px;cursor:pointer;font-size:13px;font-weight:700">Later</button>
        </div>
      </div>`;
    document.body.appendChild(panel);
    // Immediately trigger health to populate the open-slots checklist item
    AgentBus.publish('health:scored', { report: AGENTS.SeasonHealth._compute() });
  },

  _goToChampions() {
    document.getElementById('agent-eos-panel')?.remove();
    const btn = document.querySelector('.tab[onclick*="champions"]');
    if (btn) showTab('champions', btn);
  },

  reset() { this._fired = false; }
};


// ══════════════════════════════════════════════════════════════════════════════
// DEBUG PANEL
// AGENTS.showDebug() — live event log + subscription map
// AGENTS.hideDebug() — close
// ══════════════════════════════════════════════════════════════════════════════
AGENTS.showDebug = function () {
  let panel = document.getElementById('agent-bus-debug');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'agent-bus-debug';
    panel.style.cssText = `position:fixed;bottom:0;left:0;width:520px;max-height:420px;overflow-y:auto;
      background:#0f172a;border-top:2px solid #38bdf8;border-right:2px solid #38bdf8;
      border-radius:0 10px 0 0;z-index:9999;font-family:monospace;font-size:11px;`;
    document.body.appendChild(panel);
  }
  panel.style.display = 'block';
  AgentBus._renderDebugPanel();
  panel._refreshTimer = setInterval(() => AgentBus._renderDebugPanel(), 2000);
};

AGENTS.hideDebug = function () {
  const panel = document.getElementById('agent-bus-debug');
  if (panel) { clearInterval(panel._refreshTimer); panel.style.display = 'none'; }
};


// ══════════════════════════════════════════════════════════════════════════════
// APP HOOKS — Bridge lifecycle events into AgentBus
// ══════════════════════════════════════════════════════════════════════════════

(function _hookSaveData() {
  const _orig = window.saveData;
  if (typeof _orig !== 'function') return;
  window.saveData = function () {
    _orig.apply(this, arguments);
    clearTimeout(window._agentSaveTimer);
    window._agentSaveTimer = setTimeout(() => {
      AgentBus.publish('schedule:saved', { games: G.sched.length, scores: Object.keys(G.scores).length });
    }, 700);
  };
})();

(function _hookGenSched() {
  const _orig = window.genSched;
  if (typeof _orig !== 'function') return;
  window.genSched = function () {
    _orig.apply(this, arguments);
    setTimeout(() => AgentBus.publish('schedule:generated', { games: G.sched.length }), 200);
  };
})();

(function _hookShowTab() {
  const _orig = window.showTab;
  if (typeof _orig !== 'function') return;
  window.showTab = function (t, btn) {
    _orig.apply(this, arguments);
    if (t === 'standings' || t === 'admin')
      setTimeout(() => AGENTS.SeasonHealth.run(), 150);
  };
})();

(function _hookRainoutModal() {
  const _orig = window.openRainoutModal;
  if (typeof _orig !== 'function') return;
  window.openRainoutModal = function (gameId) {
    _orig.apply(this, arguments);
    setTimeout(() => {
      const modal = document.getElementById('rainout-modal');
      if (!modal) return;
      let rc = document.getElementById('agent-rainout-recs');
      if (!rc) {
        rc = document.createElement('div');
        rc.id = 'agent-rainout-recs';
        rc.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid #e5e7eb';
        (modal.querySelector('.modal-body') || modal.querySelector('div') || modal).appendChild(rc);
      }
      AgentBus.publish('rainout:opened', { gameId });
    }, 100);
  };
})();

(function _hookSelectMakeupDate() {
  const _orig = window.selectMakeupDate;
  if (typeof _orig !== 'function') return;
  window.selectMakeupDate = function (date, diamond, time, lights) {
    const gameId = window._rainoutGameId || null;
    _orig.apply(this, arguments);
    const makeupGame = [...G.sched].reverse().find(g => g.date === date && g.makeup);
    AgentBus.publish('rainout:scheduled', { gameId, makeupId: makeupGame?.id || null, date });
    AgentBus.publish('schedule:mutated',  { source: 'RainoutMakeup', date });
  };
})();


// ══════════════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════════════
(function _boot() {
  AGENTS.ConflictDetector.init();
  AGENTS.ScheduleOptimizer.init();
  AGENTS.RainoutRecovery.init();
  AGENTS.StandingsIntelligence.init();
  AGENTS.SeasonHealth.init();
  AGENTS.EndOfSeason.init();
  console.log('🤖 HCCSL Agent Suite v2.0 — AgentBus active');
  console.table(AgentBus.allSubscriptions());
  console.log('💡 Debug: AGENTS.showDebug()');
})();
