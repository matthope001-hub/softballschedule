// ── SCHEDULE EXTENDER ─────────────────────────────────────────────────────────
// Adds missing game nights to an existing schedule without touching any
// existing games or scores. Uses the same logic as genSched() but seeds
// all counters from the current G.sched state first.

function extendSched() {
  if (!checkAdmin()) return;

  const ss     = document.getElementById('ss')?.value;
  const se     = document.getElementById('se')?.value;
  const T1     = document.getElementById('time1')?.value || '6:30 PM';
  const T2     = document.getElementById('time2')?.value || '8:15 PM';
  const tfaced = parseInt(document.getElementById('tfaced')?.value) || 2;
  const cobyes = Math.max(0, parseInt(document.getElementById('cobyes')?.value) || 0);
  const gptInput = parseInt(document.getElementById('gpt')?.value) || null;

  if (!ss || !se) { alert('Set season start and end dates first.'); return; }
  const days = getSelectedDays();
  if (!days.length) { alert('Select at least one game night.'); return; }

  const leagueTeams  = G.teams.filter(t => t !== CROSSOVER);
  const activeDiamonds = G.diamonds.filter(d => d.active);
  const d9           = activeDiamonds.find(d => d.id === 9);
  const dhDiamonds   = activeDiamonds.filter(d => d.id !== 9 && d.lights);
  const singleDiamonds = activeDiamonds.filter(d => d.id !== 9 && !d.lights);

  // All game nights in the full season range
  const allNights = getGameNights(ss, se, days);

  // Dates already in G.sched
  const existingDates = new Set(G.sched.map(g => g.date));

  // Only nights not yet in the schedule
  const newNights = allNights.filter(d => !existingDates.has(d));

  if (!newNights.length) {
    showToast('✓ No missing nights — schedule is already complete');
    return;
  }

  if (!confirm(
    `Add ${newNights.length} missing night(s) to the schedule?\n\n` +
    newNights.join('\n') +
    '\n\nExisting games and scores will NOT be changed.'
  )) return;

  // ── Seed counters from existing schedule ──────────────────────────────────

  // Team game counts
  const teamGames = {};
  for (const t of leagueTeams) teamGames[t] = 0;
  for (const g of G.sched) {
    if (g.open || g.playoff) continue;
    if (g.home && g.home !== CROSSOVER && teamGames[g.home] !== undefined) teamGames[g.home]++;
    if (g.away && g.away !== CROSSOVER && teamGames[g.away] !== undefined) teamGames[g.away]++;
  }
  const atCap = t => gptInput != null && (teamGames[t] || 0) >= gptInput;

  // Pair history
  const pairHistory = {};
  const pairKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
  const pairCount = (a, b) => pairHistory[pairKey(a, b)] || 0;
  const pairIncrement = (a, b) => {
    const k = pairKey(a, b);
    pairHistory[k] = (pairHistory[k] || 0) + 1;
  };
  for (const g of G.sched) {
    if (g.open || g.crossover || g.playoff || !g.home || !g.away) continue;
    if (leagueTeams.includes(g.home) && leagueTeams.includes(g.away))
      pairIncrement(g.home, g.away);
  }

  // H/A balance
  const hcMap = {};
  for (const t of G.teams) hcMap[t] = 0;
  for (const g of G.sched) {
    if (g.open || g.crossover || g.playoff || !g.home) continue;
    if (leagueTeams.includes(g.home)) hcMap[g.home] = (hcMap[g.home] || 0) + 1;
  }

  // DH nights per team
  const dhNights = {};
  for (const t of leagueTeams) dhNights[t] = 0;
  const nightsByDate = {};
  for (const g of G.sched) {
    if (g.open || g.crossover || g.playoff || !g.home || !g.away) continue;
    if (!nightsByDate[g.date]) nightsByDate[g.date] = {};
    nightsByDate[g.date][g.home] = (nightsByDate[g.date][g.home] || 0) + 1;
    nightsByDate[g.date][g.away] = (nightsByDate[g.date][g.away] || 0) + 1;
  }
  for (const [, counts] of Object.entries(nightsByDate)) {
    for (const [team, cnt] of Object.entries(counts)) {
      if (cnt >= 2 && leagueTeams.includes(team)) dhNights[team]++;
    }
  }
  const maxDHNights = Math.floor(allNights.length * 2 / leagueTeams.length);

  // CrossOver rotation — seed from existing schedule
  const coOpponents = shuffle([...leagueTeams]);
  let coIdx = 0;

  // DH rotation — seed from existing
  const allPairs = [];
  for (let i = 0; i < leagueTeams.length; i++)
    for (let j = i + 1; j < leagueTeams.length; j++)
      allPairs.push([leagueTeams[i], leagueTeams[j]]);

  const dhRotation = shuffle([...allPairs]);
  let dhRotIdx = 0;

  function nextDHPair(busySet) {
    const n = dhRotation.length;
    for (let attempt = 0; attempt < n; attempt++) {
      const [t1, t2] = dhRotation[(dhRotIdx + attempt) % n];
      if (!busySet.has(t1) && !busySet.has(t2) && !atCap(t1) && !atCap(t2)
        && dhNights[t1] < maxDHNights && dhNights[t2] < maxDHNights) {
        dhRotIdx = (dhRotIdx + attempt + 1) % n;
        dhNights[t1]++;
        dhNights[t2]++;
        pairIncrement(t1, t2);
        return [t1, t2];
      }
    }
    return null;
  }

  let pairQueue = shuffle([...allPairs]);
  function nextPair(busySet) {
    for (let i = 0; i < pairQueue.length; i++) {
      const [t1, t2] = pairQueue[i];
      if (!busySet.has(t1) && !busySet.has(t2) && !atCap(t1) && !atCap(t2)) {
        pairQueue.splice(i, 1);
        if (pairQueue.length === 0) pairQueue = shuffle([...allPairs]);
        pairIncrement(t1, t2);
        return [t1, t2];
      }
    }
    pairQueue = shuffle([...allPairs]);
    for (let i = 0; i < pairQueue.length; i++) {
      const [t1, t2] = pairQueue[i];
      if (!busySet.has(t1) && !busySet.has(t2) && !atCap(t1) && !atCap(t2)) {
        pairQueue.splice(i, 1);
        pairIncrement(t1, t2);
        return [t1, t2];
      }
    }
    return null;
  }

  // DH home history — seed from existing schedule
  const dhHomeHistory = {};
  function pickDHHome(t1, t2) {
    const k = pairKey(t1, t2);
    const last = dhHomeHistory[k];
    if (!last || last === t2) { dhHomeHistory[k] = t1; return [t1, t2]; }
    dhHomeHistory[k] = t2; return [t2, t1];
  }

  // Game ID — find the highest existing ID for this year and continue from there
  const yr = newNights[0].slice(2, 4);
  const existingIds = G.sched
    .map(g => g.id)
    .filter(id => id && id.startsWith(yr))
    .map(id => parseInt(id.slice(2), 10))
    .filter(n => !isNaN(n));
  const gameSeq = { [yr]: existingIds.length ? Math.max(...existingIds) : 0 };

  function nextId(date) {
    const y = date.slice(2, 4);
    if (!gameSeq[y]) gameSeq[y] = 0;
    gameSeq[y]++;
    return `${y}${String(gameSeq[y]).padStart(3, '0')}`;
  }

  // ── Generate new nights ───────────────────────────────────────────────────
  const newGames = [];

  for (const date of newNights) {
    const busy = new Set();

    // D9: CrossOver
    if (d9) {
      const n = coOpponents.length;
      let oppA = null;
      for (let attempt = 0; attempt < n; attempt++) {
        const c = coOpponents[(coIdx + attempt) % n];
        if (!busy.has(c) && !atCap(c)) { oppA = c; coIdx = (coIdx + attempt + 1) % n; break; }
      }
      let oppB = null;
      for (let attempt = 0; attempt < n; attempt++) {
        const c = coOpponents[(coIdx + attempt) % n];
        if (!busy.has(c) && !atCap(c) && c !== oppA) { oppB = c; coIdx = (coIdx + attempt + 1) % n; break; }
      }
      if (oppA) {
        busy.add(oppA);
        teamGames[oppA] = (teamGames[oppA] || 0) + 1;
        newGames.push({ id: nextId(date), date, time: T1, diamond: 9, lights: true, home: CROSSOVER, away: oppA, bye: '', crossover: true });
      }
      if (oppB) {
        busy.add(oppB);
        teamGames[oppB] = (teamGames[oppB] || 0) + 1;
        hcMap[oppB] = (hcMap[oppB] || 0) + 1;
        newGames.push({ id: nextId(date), date, time: T2, diamond: 9, lights: true, home: oppB, away: CROSSOVER, bye: '', crossover: true });
      }
    }

    // Singles (D13, D14)
    let remaining = leagueTeams.filter(t => !busy.has(t) && !atCap(t));
    for (const dm of singleDiamonds) {
      if (remaining.length < 2) {
        newGames.push({ id: nextId(date), date, time: T1, diamond: dm.id, lights: false, home: '', away: '', bye: '', crossover: false, open: true });
        continue;
      }
      const busySet = new Set(leagueTeams.filter(t => !remaining.includes(t)));
      const pair = nextPair(busySet);
      if (!pair) {
        newGames.push({ id: nextId(date), date, time: T1, diamond: dm.id, lights: false, home: '', away: '', bye: '', crossover: false, open: true });
        continue;
      }
      const [t1, t2] = pair;
      remaining = remaining.filter(t => t !== t1 && t !== t2);
      const [h, a] = pickHA(t1, t2, hcMap);
      busy.add(h); busy.add(a);
      teamGames[h] = (teamGames[h] || 0) + 1;
      teamGames[a] = (teamGames[a] || 0) + 1;
      hcMap[h] = (hcMap[h] || 0) + 1;
      newGames.push({ id: nextId(date), date, time: T1, diamond: dm.id, lights: false, home: h, away: a, bye: '', crossover: false });
    }

    // D12 — DH
    for (const dm of dhDiamonds) {
      if (remaining.length < 2) {
        newGames.push({ id: nextId(date), date, time: T1, diamond: dm.id, lights: true, home: '', away: '', bye: '', crossover: false, open: true });
        newGames.push({ id: nextId(date), date, time: T2, diamond: dm.id, lights: true, home: '', away: '', bye: '', crossover: false, open: true });
        continue;
      }
      const busySet = new Set(leagueTeams.filter(t => !remaining.includes(t)));
      const pair = nextDHPair(busySet);
      if (!pair) {
        newGames.push({ id: nextId(date), date, time: T1, diamond: dm.id, lights: true, home: '', away: '', bye: '', crossover: false, open: true });
        newGames.push({ id: nextId(date), date, time: T2, diamond: dm.id, lights: true, home: '', away: '', bye: '', crossover: false, open: true });
        continue;
      }
      const [t1, t2] = pair;
      const [h, a] = pickDHHome(t1, t2);
      busy.add(h); busy.add(a);
      teamGames[h] = (teamGames[h] || 0) + 2;
      teamGames[a] = (teamGames[a] || 0) + 2;
      hcMap[h] = (hcMap[h] || 0) + 1;
      hcMap[a] = (hcMap[a] || 0) + 1;
      newGames.push({ id: nextId(date), date, time: T1, diamond: dm.id, lights: true, home: h, away: a, bye: '', crossover: false });
      newGames.push({ id: nextId(date), date, time: T2, diamond: dm.id, lights: true, home: a, away: h, bye: '', crossover: false });
    }
  }

  // Append to existing schedule, keep sorted by date
  G.sched = [...G.sched, ...newGames].sort((a, b) =>
    a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')
  );

  saveData();
  try { renderSched(); }   catch(e) {}
  try { renderScores(); }  catch(e) {}
  try { renderStandings(); } catch(e) {}
  try { renderEdit(); }    catch(e) {}

  showToast(`✓ Added ${newGames.length} games across ${newNights.length} new night(s): ${newNights.join(', ')}`);
  console.log('Extended schedule:', newNights, newGames);
}
