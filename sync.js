// ── HTOSPORTS SCORE SYNC ──────────────────────────────────────────────────────
const HTO_PROXY     = 'https://softballschedule.matt-hope001.workers.dev';
const HTO_SCHED_URL = 'https://www.htosports.com/teams/default.asp?u=HCCS&s=softball&p=schedule&format=List&d=ALL';
const SYNC_KEY      = 'hccsl_last_sync';
const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour

function maybeSyncNightly() {
  const last = parseInt(localStorage.getItem(SYNC_KEY) || '0', 10);
  if (Date.now() - last < SYNC_INTERVAL) return;
  syncScoresFromHTO(false);
}

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
// Row structure (7 cells): [time, home, homeScore, 'vs.', away, awayScore, diamond]
// Date rows have 1 cell: e.g. "Tuesday, June 2, 2026"
function parseHTOSchedule(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = [...doc.querySelectorAll('tr')];
  const results = [];
  const yr = G.currentSeason || new Date().getFullYear();
  let currentDate = null;

  for (const row of rows) {
    const cells = [...row.querySelectorAll('td')].map(td => td.textContent.trim());

    if (cells.length === 1) {
      const parsed = parseHTODate(cells[0], yr);
      if (parsed) currentDate = parsed;
      continue;
    }

    if (cells.length === 7 && cells[3] === 'vs.' && currentDate) {
      const homeScore = cells[2].replace(/[WLT]/g, '').trim();
      const awayScore = cells[5].replace(/[WLT]/g, '').trim();
      const h = parseInt(homeScore, 10);
      const a = parseInt(awayScore, 10);
      if (isNaN(h) || isNaN(a)) continue;

      // Extract diamond number from "Turner Park #12" → 12
      const dMatch = cells[6].match(/#(\d+)/);
      const diamond = dMatch ? parseInt(dMatch[1], 10) : null;

      // Parse time to 24h for matching
      const timeNorm = normalizeTime(cells[0]);

      results.push({
        date: currentDate,
        home: cells[1],
        away: cells[4],
        h, a,
        diamond,
        time: timeNorm
      });
    }
  }

  console.log(`[HTO Sync] Parsed ${results.length} scored games`);
  return results;
}

// ── DATE PARSER ───────────────────────────────────────────────────────────────
const _MONTHS = {
  january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
  july:'07', august:'08', september:'09', october:'10', november:'11', december:'12'
};

function parseHTODate(str, yr) {
  const long = str.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (long) {
    const mo = _MONTHS[long[1].toLowerCase()];
    if (mo) return `${long[3]}-${mo}-${String(long[2]).padStart(2,'0')}`;
  }
  const slash = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slash) {
    const y = slash[3].length === 2 ? '20' + slash[3] : slash[3];
    return `${y}-${String(slash[1]).padStart(2,'0')}-${String(slash[2]).padStart(2,'0')}`;
  }
  return null;
}

// ── TIME NORMALIZER ───────────────────────────────────────────────────────────
// "6:30 pm" → "6:30 PM", "8:00 pm" → "8:00 PM"
function normalizeTime(str) {
  const m = str.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return str.toUpperCase();
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  return `${h}:${min} ${ampm}`;
}

// ── SCORE APPLIER ─────────────────────────────────────────────────────────────
// Matches by date + diamond + time first (most precise), falls back to date + teams.
// Tracks used HTO game indices to prevent one HTO game matching two schedule entries.
function applyHTOScores(htoGames) {
  let count = 0;
  const usedHTO = new Set(); // track which HTO games have been consumed

  for (const g of G.sched) {
    if (g.playoff || g.open || !g.home || !g.away) continue;
    if (G.scores[g.id]) continue; // never overwrite

    // Try to find best matching HTO game
    let matchIdx = -1;
    let flipped = false;

    // Pass 1: match by date + diamond + both teams
    for (let i = 0; i < htoGames.length; i++) {
      if (usedHTO.has(i)) continue;
      const hto = htoGames[i];
      if (hto.date !== g.date) continue;
      if (hto.diamond && g.diamond && hto.diamond !== g.diamond) continue;

      const hMatch = _fuzzy(hto.home, g.home) && _fuzzy(hto.away, g.away);
      const aMatch = _fuzzy(hto.home, g.away) && _fuzzy(hto.away, g.home);

      if (hMatch) { matchIdx = i; flipped = false; break; }
      if (aMatch) { matchIdx = i; flipped = true;  break; }
    }

    // Pass 2: fallback — date + teams only (no diamond check)
    if (matchIdx === -1) {
      for (let i = 0; i < htoGames.length; i++) {
        if (usedHTO.has(i)) continue;
        const hto = htoGames[i];
        if (hto.date !== g.date) continue;

        const hMatch = _fuzzy(hto.home, g.home) && _fuzzy(hto.away, g.away);
        const aMatch = _fuzzy(hto.home, g.away) && _fuzzy(hto.away, g.home);

        if (hMatch) { matchIdx = i; flipped = false; break; }
        if (aMatch) { matchIdx = i; flipped = true;  break; }
      }
    }

    if (matchIdx === -1) continue;

    const hto = htoGames[matchIdx];
    usedHTO.add(matchIdx); // consume this HTO game — can't match again
    G.scores[g.id] = flipped
      ? { h: hto.a, a: hto.h }
      : { h: hto.h, a: hto.a };
    count++;
  }

  return count;
}

function _fuzzy(a, b) {
  const n = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
  const na = n(a), nb = n(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}
