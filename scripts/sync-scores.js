// scripts/sync-scores.js
// Runs on GitHub Actions (real IP — not blocked by htosports).
// HTO row structure: [time, away, awayScore+W/L/T, 'vs.', home, homeScore+W/L/T, location]
// Note: HTO lists AWAY team first, HOME team second.

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const HTO_URL      = 'https://www.htosports.com/teams/default.asp?u=HCCS&s=softball&p=schedule&format=List&d=ALL';
const BIN_ID       = process.env.JSONBIN_BIN_ID    || '69d7a4c036566621a894eed9';
const WRITE_KEY    = process.env.JSONBIN_WRITE_KEY  || '$2a$10$0Hbc5Bc9ABqnRlT3.dmE6OURp.z8twcL0yy4bSGoCACQOTb7Z5fJu';
const JSONBIN_BASE = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

const MONTHS = {
  january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
  july:'07', august:'08', september:'09', october:'10', november:'11', december:'12'
};

// ── FETCH ─────────────────────────────────────────────────────────────────────
async function fetchHTO() {
  console.log('Fetching htosports…');
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
  console.log(`Got ${html.length} chars`);
  return html;
}

// ── PARSE ─────────────────────────────────────────────────────────────────────
// HTO row: [time, away, awayScore, 'vs.', home, homeScore, location]
// Scores have W/L/T suffix: "7L", "12W", "19T" — strip the letter.
// Date rows: single cell like "Tuesday, May 26, 2026"
// Week rows: single cell like "Mon, 5/25/26 to Sun, 5/31/26Week 1" — skip
function parseHTOSchedule(html) {
  const $ = cheerio.load(html);
  const results = [];
  let currentDate = null;

  $('tr').each((_, row) => {
    const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();

    // Single-cell row: either a week header or a date
    if (cells.length === 1) {
      const parsed = parseDate(cells[0]);
      if (parsed) currentDate = parsed;
      return;
    }

    // Game row: exactly 7 cells with 'vs.' in position 3
    if (cells.length === 7 && cells[3] === 'vs.' && currentDate) {
      // HTO: away=cells[1], awayScore=cells[2], home=cells[4], homeScore=cells[5]
      const awayScore = parseInt(cells[2].replace(/[^0-9]/g, ''), 10);
      const homeScore = parseInt(cells[5].replace(/[^0-9]/g, ''), 10);
      if (isNaN(awayScore) || isNaN(homeScore)) return; // unplayed

      // Diamond: "Turner Park #12" → 12
      const dMatch = cells[6].match(/#(\d+)/);
      const diamond = dMatch ? parseInt(dMatch[1], 10) : null;

      results.push({
        date:    currentDate,
        away:    cells[1],
        home:    cells[4],
        a:       awayScore,
        h:       homeScore,
        diamond,
        time:    normalizeTime(cells[0])
      });
    }
  });

  console.log(`Parsed ${results.length} scored games from htosports`);
  results.forEach(g => console.log(`  ${g.date} | ${g.away} ${g.a}–${g.h} ${g.home} | D${g.diamond} ${g.time}`));
  return results;
}

// ── DATE PARSER ───────────────────────────────────────────────────────────────
function parseDate(str) {
  // "Tuesday, May 26, 2026"
  const long = str.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (long) {
    const mo = MONTHS[long[1].toLowerCase()];
    if (mo) return `${long[3]}-${mo}-${String(long[2]).padStart(2, '0')}`;
  }
  // "05/26/2026" or "5/26/26"
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
  return `${parseInt(m[1], 10)}:${m[2]} ${m[3].toUpperCase()}`;
}

// ── FUZZY MATCH ───────────────────────────────────────────────────────────────
function fuzzy(a, b) {
  const n = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const na = n(a), nb = n(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ── JSONBIN ───────────────────────────────────────────────────────────────────
async function loadBin() {
  console.log('Loading JSONBin…');
  const res = await fetch(`${JSONBIN_BASE}/latest`, {
    headers: { 'X-Master-Key': WRITE_KEY }
  });
  if (!res.ok) throw new Error(`JSONBin load failed: HTTP ${res.status}`);
  const json = await res.json();
  return json.record;
}

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
// - If no score exists: write it, tag src:'hto'
// - If score exists and matches HTO: skip
// - If score exists and DIFFERS: overwrite, tag src:'hto', log the discrepancy
// - Never touches weather games (sc.wx === true)
function applyScores(record, htoGames) {
  const sched  = record.sched  || [];
  const scores = record.scores || {};
  let newCount      = 0;
  let overrideCount = 0;
  const usedHTO = new Set();

  for (const g of sched) {
    if (g.playoff || g.open || !g.home || !g.away) continue;
    const existing = scores[g.id];
    if (existing?.wx) continue; // never touch weather games

    let matchIdx = -1;
    let newScore  = null;

    // Pass 1: date + diamond + teams
    for (let i = 0; i < htoGames.length; i++) {
      if (usedHTO.has(i)) continue;
      const hto = htoGames[i];
      if (hto.date !== g.date) continue;
      if (hto.diamond && g.diamond && hto.diamond !== g.diamond) continue;
      const direct  = fuzzy(hto.home, g.home) && fuzzy(hto.away, g.away);
      const flipped = fuzzy(hto.home, g.away) && fuzzy(hto.away, g.home);
      if (direct || flipped) {
        matchIdx = i;
        newScore = direct
          ? { h: hto.h, a: hto.a, src: 'hto' }
          : { h: hto.a, a: hto.h, src: 'hto' };
        break;
      }
    }

    // Pass 2: date + teams only
    if (matchIdx === -1) {
      for (let i = 0; i < htoGames.length; i++) {
        if (usedHTO.has(i)) continue;
        const hto = htoGames[i];
        if (hto.date !== g.date) continue;
        const direct  = fuzzy(hto.home, g.home) && fuzzy(hto.away, g.away);
        const flipped = fuzzy(hto.home, g.away) && fuzzy(hto.away, g.home);
        if (direct || flipped) {
          matchIdx = i;
          newScore = direct
            ? { h: hto.h, a: hto.a, src: 'hto' }
            : { h: hto.a, a: hto.h, src: 'hto' };
          break;
        }
      }
    }

    if (matchIdx === -1) continue;
    usedHTO.add(matchIdx);

    if (!existing) {
      scores[g.id] = newScore;
      newCount++;
      console.log(`  ✓ NEW   Game ${g.id}: ${g.home} ${newScore.h}\u2013${newScore.a} ${g.away}`);
    } else if (existing.h !== newScore.h || existing.a !== newScore.a) {
      console.log(`  ⚠ DIFF  Game ${g.id}: stored ${existing.h}\u2013${existing.a} → HTO ${newScore.h}\u2013${newScore.a} (${g.home} vs ${g.away} on ${g.date})`);
      scores[g.id] = newScore;
      overrideCount++;
    } else {
      if (!existing.src) scores[g.id].src = 'hto';
    }
  }

  for (let i = 0; i < htoGames.length; i++) {
    if (!usedHTO.has(i)) {
      const hto = htoGames[i];
      console.log(`  ✗ NO MATCH: ${hto.date} ${hto.home} ${hto.h}\u2013${hto.a} ${hto.away} D${hto.diamond}`);
    }
  }

  console.log(`Summary: ${newCount} new · ${overrideCount} corrected`);
  return { scores, count: newCount + overrideCount };
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
