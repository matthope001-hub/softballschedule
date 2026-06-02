// ── HTOSPORTS SCORE SYNC ──────────────────────────────────────────────────────
const HTO_PROXY     = 'softballschedule.matt-hope001.workers.dev';
const HTO_SCHED_URL = 'https://www.htosports.com/teams/default.asp?u=HCCS&s=softball&p=schedule&format=List&d=ALL';
const SYNC_KEY      = 'hccsl_last_sync';
const SYNC_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

// Called on page load — silent unless scores actually update
function maybeSyncNightly() {
  const last = parseInt(localStorage.getItem(SYNC_KEY) || '0', 10);
  if (Date.now() - last < SYNC_INTERVAL) return;
  syncScoresFromHTO(false);
}

// Admin button — verbose
async function manualSync() {
  if (!isAdmin) { showPinModal(); return; }
  showToast('⏳ Fetching scores from htosports…');
  const result = await syncScoresFromHTO(true);
  if (result === null)   showToast('⚠ Sync failed — check console');
  else if (result === 0) showToast('✓ Sync complete — no new scores found');
  else                   showToast(`✓ Sync complete — ${result} score(s) updated`);
}

async function syncScoresFromHTO(verbose = false) {
  try {
    const proxyUrl = `${HTO_PROXY}?url=${encodeURIComponent(HTO_SCHED_URL)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const games   = parseHTOSchedule(html);
    const updated = applyHTOScores(games);

    localStorage.setItem(SYNC_KEY, String(Date.now()));

    if (updated > 0) {
      saveData();
      renderScores();
      renderStandings();
    }
    return updated;
  } catch (e) {
    console.warn('HTO sync failed:', e);
    return null;
  }
}

// ── PARSER ────────────────────────────────────────────────────────────────────
// htosports list format — rows with: Date | Home | HomeScore | Away | AwayScore
function parseHTOSchedule(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('tr');
  const results = [];
  const yr = G.currentSeason || new Date().getFullYear();

  for (const row of rows) {
    const cells = [...row.querySelectorAll('td')].map(td => td.textContent.trim());
    if (cells.length < 5) continue;

    const homeScore = parseInt(cells[2], 10);
    const awayScore = parseInt(cells[4], 10);
    if (isNaN(homeScore) || isNaN(awayScore)) continue;

    const isoDate = parseHTODate(cells[0], yr);
    if (!isoDate) continue;

    results.push({ date: isoDate, home: cells[1], away: cells[3], h: homeScore, a: awayScore });
  }
  return results;
}

const _MONTHS = {
  jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'
};

function parseHTODate(str, yr) {
  const m = str.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (!m) return null;
  const mo = _MONTHS[m[1].substring(0,3).toLowerCase()];
  if (!mo) return null;
  return `${yr}-${mo}-${String(m[2]).padStart(2,'0')}`;
}

// ── SCORE APPLIER ─────────────────────────────────────────────────────────────
// Non-destructive: skips games already scored. Handles home/away flip.
function applyHTOScores(htoGames) {
  let count = 0;
  for (const hto of htoGames) {
    const candidates = G.sched.filter(g => g.date === hto.date && !g.playoff);
    for (const g of candidates) {
      if (G.scores[g.id]) continue; // already scored — never overwrite
      const hMatch = _fuzzy(hto.home, g.home) && _fuzzy(hto.away, g.away);
      const aMatch = _fuzzy(hto.home, g.away) && _fuzzy(hto.away, g.home);
      if (hMatch)      { G.scores[g.id] = { h: hto.h, a: hto.a }; count++; }
      else if (aMatch) { G.scores[g.id] = { h: hto.a, a: hto.h }; count++; }
    }
  }
  return count;
}

function _fuzzy(a, b) {
  const n = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
  const na = n(a), nb = n(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}
