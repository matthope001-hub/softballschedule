// ── HTOSPORTS SCORE SYNC ──────────────────────────────────────────────────────
// Actual scraping is done by the GitHub Action (scripts/sync-scores.js).
// That Action runs on GitHub's IP (not blocked by htosports) and writes
// scores directly to JSONBin on a schedule.
//
// The manual "Sync Scores" button here just reloads from JSONBin so the
// user sees the latest scores the Action already wrote — no proxy needed.

function maybeSyncNightly() {
  // No-op — GitHub Action handles scheduled syncing.
  // Kept for API compatibility in case other code calls it.
}

async function manualSync() {
  if (!isAdmin) { showPinModal(); return; }
  const statusEl = document.getElementById('sync-status');
  if (statusEl) statusEl.textContent = '⏳ Reloading scores from cloud…';
  showToast('⏳ Reloading from cloud…');

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_WRITE_KEY }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const d = json.record;

    if (!d) throw new Error('Empty record');

    // Only update scores — don't clobber local sched/teams/diamonds
    // in case the user has unsaved local changes.
    if (d.scores) {
      let newCount = 0;
      for (const [id, sc] of Object.entries(d.scores)) {
        if (!G.scores[id]) {
          G.scores[id] = sc;
          newCount++;
        }
      }
      if (newCount > 0) {
        renderScores();
        renderStandings();
        renderSched();
        renderLastResults();
        renderSeasonBanner();
        const msg = `✓ ${newCount} new score${newCount !== 1 ? 's' : ''} loaded from cloud`;
        showToast(msg);
        if (statusEl) statusEl.textContent = msg + ' · ' + new Date().toLocaleTimeString();
      } else {
        const msg = '✓ Already up to date — no new scores';
        showToast(msg);
        if (statusEl) statusEl.textContent = msg + ' · ' + new Date().toLocaleTimeString();
      }
    }

  } catch (e) {
    console.warn('Manual sync failed:', e);
    const msg = '⚠ Sync failed — check connection';
    showToast(msg);
    if (statusEl) statusEl.textContent = msg;
  }
}
