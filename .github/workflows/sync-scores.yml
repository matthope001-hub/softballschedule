// scripts/sync-scores.js
// Runs on GitHub Actions (real IP — not blocked by htosports).
// Fetches the HCCSL schedule page, parses played games, then
// reads the current JSONBin record and fills in any missing scores.
// Never overwrites a score that already exists in JSONBin.

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const HTO_URL      = 'https://www.htosports.com/teams/default.asp?u=HCCS&s=softball&p=schedule&format=List&d=ALL';
const BIN_ID       = process.env.JSONBIN_BIN_ID    || '69d7a4c036566621a894eed9';
const WRITE_KEY    = process.env.JSONBIN_WRITE_KEY  || '$2a$10$0Hbc5Bc9ABqnRlT3.dmE6OURp.z8twcL0yy4bSGoCACQOTb7Z5fJu';
const JSONBIN_BASE = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

const CAP = 7; // run-differential cap (matches app)

// ── MONTH MAP ─────────────────────────────────────────────────────────────────
const MONTHS = {
  january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
  july:'07', august:'08', september:'09', october:'10', november:'11', december:'12'
};

// ── FETCH HTO PAGE ────────────────────────────────────────────────────────────
async function fetchHTO() {
  console.log('Fetching:', HTO_URL);
  const res = await fetch(HTO_URL, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-CA,en;q=0.9',
      'Referer':         'https://www.htosports.com/',
      'Cache-Control':   'no-cache',
    }
  });
  if (!res.ok) throw new Error(`HTO fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  console.log(`Got ${html.length} chars from htosports`);
  return html;
}

// ── PARSE SCHEDULE ────────────────────────────────────────────────────────────
function parseHTOSchedule(html) {
  const $ = cheerio.load(html);
  const results = [];
  const currentYear = new Date().getFullYear();
  let currentDate = null;

  $('tr').each((_, row) => {
    const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();

    // Date row: single cell like "Thursday, June 5, 2026"
    if (cells.length === 1) {
      const parsed = parseDate(cells[0], currentYear);
      if (parsed) {
        currentDate = parsed;
        console.log('  Date:', currentDate);
      }
      return;
    }

    // Game row: 7 cells [time, home, homeScore, 'vs.', away, awayScore, location]
    if (cells.length >= 6 && currentDate) {
      // Find 'vs.' cell to anchor the parse — htosports occasionally has extra cells
      const vsIdx = cells.findIndex(c => c === 'vs.' || c === 'vs');
      if (vsIdx < 1) return;

      const homeRaw  = cells[vsIdx - 1];
      const awayRaw  = cells[vsIdx + 1];
      const homeSc   = cells[vsIdx - 1 > 0 ? vsIdx - 1 : 0]; // fallback
      const awaySc   = cells[vsIdx + 2] || '';
      const locRaw   = cells[cells.length - 1];
      const timeRaw  = cells[0];

      // Scores may have W/L/T suffix — strip them
      const homeScStr = (cells[vsIdx - 2] || '').replace(/[WLwTt]/g, '').trim();
      const awayScStr = (cells[vsIdx + 2] || '').replace(/[WLwTt]/g, '').trim();

      const h = parseInt(homeScStr, 10);
      const a = parseInt(awayScStr, 10);
      if (isNaN(h) || isNaN(a)) return; // unplayed game — skip

      // Diamond: "Turner Park #9" → 9
      const dMatch = locRaw.match(/#(\d+)/);
      const diamond = dMatch ? parseInt(dMatch[1], 10) : null;

      const entry = {
        date:    currentDate,
        home:    cells[vsIdx - 1],
        away:    cells[vsIdx + 1],
        h, a,
        diamond,
        time:    normalizeTime(timeRaw)
      };
      results.push(entry);
      console.log(`  Game: ${entry.date} ${entry.home} ${entry.h}–${entry.a} ${entry.away} D${entry.diamond}`);
    }
  });

  console.log(`Parsed ${results.length} scored games from htosports`);
  return results;
}

// ── DATE PARSER ───────────────────────────────────────────────────────────────
function parseDate(str, yr) {
  // "Thursday, June 5, 2026" or "June 5, 2026"
  const long = str.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (long) {
    const mo = MONTHS[long[1].toLowerCase()];
    if (mo) return `${long[3]}-${mo}-${String(long[2]).padStart(2, '0')}`;
  }
  // "06/05/2026" or "06/05/26"
  const slash = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slash) {
    const y = slash[3].length === 2 ? '20' + slash[3] : slash[3];
    return `${y}-${String(slash[1]).padStart(2, '0')}-${String(slash[2]).padStart(2, '0')}`;
  }
  return null;
}

// ── TIME NORMALIZER ───────────────────────────────────────────────────────────
function normalizeTime(str) {
  const m = str.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return str.toUpperCase().trim();
  const h   = parseInt(m[1], 10);
  const min = m[2];
  const ap  = m[3].toUpperCase();
  return `${h}:${min} ${ap}`;
}

// ── FUZZY TEAM MATCH ──────────────────────────────────────────────────────────
function fuzzy(a, b) {
  const n = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const na = n(a), nb = n(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ── LOAD JSONBIN ──────────────────────────────────────────────────────────────
async function loadBin() {
  console.log('Loading JSONBin…');
  const res = await fetch(`${JSONBIN_BASE}/latest`, {
    headers: { 'X-Master-Key': WRITE_KEY }
  });
  if (!res.ok) throw new Error(`JSONBin load failed: HTTP ${res.status}`);
  const json = await res.json();
  return json.record;
}

// ── SAVE JSONBIN ──────────────────────────────────────────────────────────────
async function saveBin(record) {
  console.log('Saving JSONBin…');
  const res = await fetch(JSONBIN_BASE, {
    method: 'PUT',
    headers: {
      'Content-Type':     'application/json',
      'X-Master-Key':     WRITE_KEY,
      'X-Bin-Versioning': 'false'
    },
    body: JSON.stringify(record)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`JSONBin save failed: HTTP ${res.status} — ${body}`);
  }
  console.log('JSONBin saved OK');
}

// ── APPLY SCORES ──────────────────────────────────────────────────────────────
// Only fills blanks — never overwrites existing scores.
function applyScores(record, htoGames) {
  const sched  = record.sched  || [];
  const scores = record.scores || {};
  let count = 0;
  const usedHTO = new Set();

  for (const g of sched) {
    if (g.playoff || g.open || !g.home || !g.away) continue;
    if (scores[g.id]) continue; // never overwrite

    let matchIdx = -1;
    let flipped  = false;

    // Pass 1: date + diamond + teams
    for (let i = 0; i < htoGames.length; i++) {
      if (usedHTO.has(i)) continue;
      const hto = htoGames[i];
      if (hto.date !== g.date) continue;
      if (hto.diamond && g.diamond && hto.diamond !== g.diamond) continue;

      const hm = fuzzy(hto.home, g.home) && fuzzy(hto.away, g.away);
      const am = fuzzy(hto.home, g.away) && fuzzy(hto.away, g.home);
      if (hm) { matchIdx = i; flipped = false; break; }
      if (am) { matchIdx = i; flipped = true;  break; }
    }

    // Pass 2: date + teams only (no diamond)
    if (matchIdx === -1) {
      for (let i = 0; i < htoGames.length; i++) {
        if (usedHTO.has(i)) continue;
        const hto = htoGames[i];
        if (hto.date !== g.date) continue;

        const hm = fuzzy(hto.home, g.home) && fuzzy(hto.away, g.away);
        const am = fuzzy(hto.home, g.away) && fuzzy(hto.away, g.home);
        if (hm) { matchIdx = i; flipped = false; break; }
        if (am) { matchIdx = i; flipped = true;  break; }
      }
    }

    if (matchIdx === -1) continue;

    const hto = htoGames[matchIdx];
    usedHTO.add(matchIdx);
    scores[g.id] = flipped
      ? { h: hto.a, a: hto.h }
      : { h: hto.h, a: hto.a };
    count++;
    console.log(`  Matched game ${g.id}: ${g.home} ${scores[g.id].h}–${scores[g.id].a} ${g.away}`);
  }

  return { scores, count };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  try {
    const [html, record] = await Promise.all([fetchHTO(), loadBin()]);

    const htoGames = parseHTOSchedule(html);

    if (!htoGames.length) {
      console.log('No scored games found on htosports — nothing to do.');
      process.exit(0);
    }

    const { scores, count } = applyScores(record, htoGames);

    if (count === 0) {
      console.log('No new scores to write — JSONBin unchanged.');
      process.exit(0);
    }

    record.scores = scores;
    await saveBin(record);
    console.log(`✓ Done — ${count} score(s) written to JSONBin`);

  } catch (e) {
    console.error('Sync failed:', e.message);
    process.exit(1);
  }
}

main();
