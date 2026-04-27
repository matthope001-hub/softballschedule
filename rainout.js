// ── RAINOUT ───────────────────────────────────────────────────────────────────
// Per league rules: all rainouts end 7-7 (Rule 8.0). No makeup scheduling.
// This modal just confirms the rainout and records the score.

let _rainoutGameId = null;

function openRainoutModal(gameId) {
  if (!isAdmin) { showToast('🔒 Admin PIN required'); return; }
  _rainoutGameId = gameId;

  const game = G.sched.find(g => g.id === gameId);
  if (!game) return;

  renderRainoutModal(game);

  const modal = document.getElementById('rainout-modal');
  if (modal) modal.style.display = 'flex';
}

function closeRainoutModal() {
  const modal = document.getElementById('rainout-modal');
  if (modal) modal.style.display = 'none';
  _rainoutGameId = null;
}

function renderRainoutModal(game) {
  let modal = document.getElementById('rainout-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rainout-modal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1001;justify-content:center;align-items:center';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:white;padding:24px;border-radius:12px;max-width:420px;width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:18px;font-weight:800;color:var(--navy)">🌧 Rainout</div>
        <button onclick="closeRainoutModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">×</button>
      </div>

      <div style="background:var(--surface2);padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px">
        <div style="font-weight:700;margin-bottom:4px">Game #${esc(game.id)}</div>
        <div>${fmtDate(game.date)} · ${game.time} · ${getDiamondName(game.diamond)}</div>
        <div style="margin-top:4px;color:var(--navy);font-weight:600">${esc(game.home)} vs ${esc(game.away)}</div>
      </div>

      <div style="font-size:13px;color:var(--muted);margin-bottom:20px;line-height:1.5">
        Per Rule 8.0, rainouts are recorded as a <strong>7–7 tie</strong>.<br>
        No makeup games are scheduled.
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="confirmRainout()" style="flex:1;padding:11px;background:var(--navy);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;font-family:var(--font)">
          🌧 Record 7–7 Tie
        </button>
        <button onclick="closeRainoutModal()" style="padding:11px 18px;background:none;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-size:13px;color:var(--muted);font-family:var(--font)">
          Cancel
        </button>
      </div>
    </div>`;
}
<div id="agent-rainout-recs"></div>

function confirmRainout() {
  if (!_rainoutGameId) return;

  G.scores[_rainoutGameId] = { h: 7, a: 7, wx: true, rainout: true };
  saveData();

  // PATCH: surgical row update — avoid wiping score inputs currently on screen.
  // _patchScoreRow returns false if the row isn't visible (collapsed accordion),
  // in which case we fall back to a full renderScores() rebuild.
  if (typeof _patchScoreRow === 'function') {
    if (!_patchScoreRow(_rainoutGameId)) {
      try { renderScores(); } catch(e) {}
    }
  } else {
    try { renderScores(); } catch(e) {}
  }

  try { renderSched(); } catch(e) {}
  try { renderStandings(); } catch(e) {}
  try { renderLastResults(); } catch(e) {}
  try { renderSeasonBanner(); } catch(e) {}

  showToast('🌧 Rainout recorded — 7–7 tie (Rule 8.0)');
  closeRainoutModal();
}
