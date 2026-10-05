// scripts/sync-scores.js
// Runs on GitHub Actions (real IP — not blocked by htosports).
// HTO row structure: [time, away, awayScore+W/L/T, 'vs.', home, homeScore+W/L/T, location]
// Away is listed first, home second on htosports.

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const HTO_URL      = 'https://www.htosports.com/teams/default.asp?u=HCCS&s=softball&p=schedule&format=List&d=ALL';
const BIN_ID       = process.env.JSONBIN_BIN_ID    || '69d7a4c036566621a894eed9';
const WRITE_KEY    = process.env.JSONBIN_WRITE_KEY  || '$2a$10$0Hbc5Bc9ABqnRlT3.dmE6OURp.z8twcL0yy4bSGoCACQOTb7Z5fJu';
const JSONBIN_BASE = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const CROSSOVER    = '__CROSSOVER__';

const MONTHS = {
  january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
  july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'
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
function parseHTOSchedule(html) {
  const $ = cheerio.load(html);
  const results = [];
  let currentDate = null;

  $('tr').each((_, row) => {
    const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();

    if (cells.length === 1) {
      const parsed = parseDate(cells[0]);
      if (parsed) currentDate = parsed;
      return;
    }

    if (cells.length === 7 && cells[3] === 'vs.' && currentDate) {
      const awayScore = parseInt(cells[2].replace(/[^0-9]/g, ''), 10);
      const homeScore = parseInt(cells[5].replace(/[^0-9]/g, ''), 10);
      if (isNaN(awayScore) || isNaN(homeScore)) return; // unplayed

      const dMatch = cells[6].match(/#(\d+)/);
      const diamond = dMatch ? parseInt(dMatch[1], 10) : null;

      results.push({
        date:    currentDate,
        away:    cells[1],  // HTO: away listed first
        home:    cells[4],  // HTO: home listed second
        a:       awayScore,
        h:       homeScore,
        diamond,
        time:    normalizeTime(cells[0])
      });
    }
  });

  console.log(`Parsed ${results.length} scored games from htosports`);
  return results;
}

// ── DATE PARSER ───────────────────────────────────────────────────────────────
function parseDate(str) {
  const long = str.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (long) {
    const mo = MONTHS[long[1].toLowerCase()];
    if (mo) return `${long[3]}-${mo}-${String(long[2]).padStart(2, '0')}`;
  }
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

// Resolve crossover placeholder to display name
function isCrossover(name) {
  return name === CROSSOVER || fuzzy(name, 'crossover') || fuzzy(name, 'stingrays') || fuzzy(name, 'walking dead');
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
// Matching strategy (in order):
//   Pass 1: date + diamond + time + both teams (exact fuzzy)
//   Pass 2: date + diamond + time (team-agnostic — fills open slots or corrects mismatched assignments)
//   Pass 3: date + teams only (no diamond)
//
// For Pass 2 matches: also updates g.home/g.away to match HTO's actual teams.
// Never touches weather games (wx:true).
// Overwrites if HTO differs and logs the discrepancy.
function applyScores(record, htoGames) {
  const sched  = record.sched  || [];
  const scores = record.scores || {};
  let newCount      = 0;
  let overrideCount = 0;
  let teamFixCount  = 0;
  const usedHTO = new Set();

  for (const g of sched) {
    if (g.playoff || !g.home || !g.away) continue;
    const existing = scores[g.id];
    if (existing?.wx) continue; // never touch weather games

    let matchIdx = -1;
    let newScore  = null;
    let passUsed  = 0;

    // Pass 1: date + diamond + time + teams
    for (let i = 0; i < htoGames.length; i++) {
      if (usedHTO.has(i)) continue;
      const hto = htoGames[i];
      if (hto.date !== g.date) continue;
      if (hto.diamond && g.diamond && hto.diamond !== g.diamond) continue;
      if (hto.time && g.time && hto.time !== g.time) continue;

      const gHomeIsCO = isCrossover(g.home);
      const gAwayIsCO = isCrossover(g.away);
      const htoHomeIsCO = isCrossover(hto.home);
      const htoAwayIsCO = isCrossover(hto.away);

      const directHome = gHomeIsCO ? htoHomeIsCO : fuzzy(hto.home, g.home);
      const directAway = gAwayIsCO ? htoAwayIsCO : fuzzy(hto.away, g.away);
      const flipHome   = gHomeIsCO ? htoAwayIsCO : fuzzy(hto.away, g.home);
      const flipAway   = gAwayIsCO ? htoHomeIsCO : fuzzy(hto.home, g.away);

      if (directHome && directAway) {
        matchIdx = i; passUsed = 1;
        newScore = { h: hto.h, a: hto.a, src: 'hto' };
        break;
      }
      if (flipHome && flipAway) {
        matchIdx = i; passUsed = 1;
        newScore = { h: hto.a, a: hto.h, src: 'hto' };
        break;
      }
    }

    // Pass 2: date + diamond + time only (team-agnostic — fixes open/mismatched slots)
    if (matchIdx === -1) {
      for (let i = 0; i < htoGames.length; i++) {
        if (usedHTO.has(i)) continue;
        const hto = htoGames[i];
        if (hto.date !== g.date) continue;
        if (hto.diamond && g.diamond && hto.diamond !== g.diamond) continue;
        if (hto.time && g.time && hto.time !== g.time) continue;
        matchIdx = i; passUsed = 2;
        // HTO home/away order is canonical — store as-is
        newScore = { h: hto.h, a: hto.a, src: 'hto' };
        break;
      }
    }

    // Pass 3: date + teams, no diamond/time check
    if (matchIdx === -1) {
      for (let i = 0; i < htoGames.length; i++) {
        if (usedHTO.has(i)) continue;
        const hto = htoGames[i];
        if (hto.date !== g.date) continue;

        const gHomeIsCO = isCrossover(g.home);
        const gAwayIsCO = isCrossover(g.away);
        const htoHomeIsCO = isCrossover(hto.home);
        const htoAwayIsCO = isCrossover(hto.away);

        const directHome = gHomeIsCO ? htoHomeIsCO : fuzzy(hto.home, g.home);
        const directAway = gAwayIsCO ? htoAwayIsCO : fuzzy(hto.away, g.away);
        const flipHome   = gHomeIsCO ? htoAwayIsCO : fuzzy(hto.away, g.home);
        const flipAway   = gAwayIsCO ? htoHomeIsCO : fuzzy(hto.home, g.away);

        if (directHome && directAway) {
          matchIdx = i; passUsed = 3;
          newScore = { h: hto.h, a: hto.a, src: 'hto' };
          break;
        }
        if (flipHome && flipAway) {
          matchIdx = i; passUsed = 3;
          newScore = { h: hto.a, a: hto.h, src: 'hto' };
          break;
        }
      }
    }

    if (matchIdx === -1) continue;
    const hto = htoGames[matchIdx];
    usedHTO.add(matchIdx);

    // Pass 2: update team assignments to match HTO's actual teams
    if (passUsed === 2) {
      const oldHome = g.home, oldAway = g.away;
      g.home = isCrossover(hto.home) ? CROSSOVER : hto.home;
      g.away = isCrossover(hto.away) ? CROSSOVER : hto.away;
      g.open = false;
      if (oldHome !== g.home || oldAway !== g.away) {
        console.log(`  🔧 TEAM FIX Game ${g.id} ${g.date}: ${oldHome} vs ${oldAway} → ${g.home} vs ${g.away}`);
        teamFixCount++;
      }
    }

    if (!existing) {
      scores[g.id] = newScore;
      newCount++;
      console.log(`  ✓ NEW   [P${passUsed}] Game ${g.id} ${g.date}: ${g.home} ${newScore.h}–${newScore.a} ${g.away}`);
    } else if (existing.h !== newScore.h || existing.a !== newScore.a) {
      console.log(`  ⚠ DIFF  [P${passUsed}] Game ${g.id} ${g.date}: stored ${existing.h}–${existing.a} → HTO ${newScore.h}–${newScore.a} (${g.home} vs ${g.away})`);
      scores[g.id] = newScore;
      overrideCount++;
    } else {
      if (!existing.src) scores[g.id].src = 'hto';
    }
  }

  // Log unmatched HTO games
  for (let i = 0; i < htoGames.length; i++) {
    if (!usedHTO.has(i)) {
      const hto = htoGames[i];
      console.log(`  ✗ NO MATCH: ${hto.date} ${hto.home} ${hto.h}–${hto.a} ${hto.away} D${hto.diamond} ${hto.time}`);
    }
  }

  console.log(`Summary: ${newCount} new · ${overrideCount} corrected · ${teamFixCount} team assignments fixed`);
  return { scores, sched, count: newCount + overrideCount + teamFixCount };
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

    const { scores, sched, count } = applyScores(record, htoGames);

    if (count === 0) {
      console.log('No new scores to write — JSONBin unchanged.');
      process.exit(0);
    }

    record.scores = scores;
    record.sched  = sched; // save updated team assignments
    await saveBin(record);
    console.log(`✓ Done — ${count} change(s) written to JSONBin`);

  } catch (e) {
    console.error('Sync failed:', e.message);
    process.exit(1);
  }
}

main();
