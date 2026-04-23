// ── RAINOUT AUTO-RESCHEDULER ──────────────────────────────────────────────────
// Handles weather cancellations with automatic makeup game scheduling

let _rainoutGameId = null;

// Open the rainout modal for a specific game
function openRainoutModal(gameId) {
  if (!isAdmin) { showToast('🔒 Admin PIN required'); return; }
  _rainoutGameId = gameId;
  
  const game = G.sched.find(g => g.id === gameId);
  if (!game) return;
  
  const suggestions = findMakeupDates(game);
  renderRainoutModal(game, suggestions);
  
  const modal = document.getElementById('rainout-modal');
  if (modal) modal.style.display = 'flex';
}

// Close the rainout modal
function closeRainoutModal() {
  const modal = document.getElementById('rainout-modal');
  if (modal) modal.style.display = 'none';
  _rainoutGameId = null;
}

// Find optimal makeup dates for a rained-out game
function findMakeupDates(game) {
  const home = game.home;
  const away = game.away;
  const originalDate = game.date;
  
  // Get all available game nights (existing schedule dates + future season dates)
  const ssEl = document.getElementById('ss');
  const seEl = document.getElementById('se');
  const days = getSelectedDays();
  const seasonNights = getGameNights(ssEl?.value || '2026-05-19', seEl?.value || '2026-09-29', days);
  
  // Combine with any existing game dates not in season window
  const allDates = [...new Set([...seasonNights, ...G.sched.map(g => g.date)])].sort();
  
  // Find dates after the original game
  const futureDates = allDates.filter(d => d > originalDate);
  
  const suggestions = [];
  
  for (const date of futureDates) {
    // Check team availability on this date
    const teamsPlaying = getTeamsPlayingOnDate(date);
    const homeBusy = teamsPlaying.has(home);
    const awayBusy = teamsPlaying.has(away);
    
    if (homeBusy || awayBusy) continue; // Teams already playing this date
    
    // Find available slots
    const slots = getAvailableSlots(date);
    if (slots.length === 0) continue; // No open slots
    
    // Score this date (prefer earlier dates, lit diamonds)
    const hasLit = slots.some(s => s.lights);
    const daysFromOriginal = Math.floor((new Date(date) - new Date(originalDate)) / (1000 * 60 * 60 * 24));
    
    suggestions.push({
      date,
      slots,
      hasLit,
      daysFromOriginal,
      score: daysFromOriginal + (hasLit ? 0 : 5) // Prefer lit diamonds and closer dates
    });
    
    if (suggestions.length >= 5) break; // Top 5 suggestions
  }
  
  // Sort by score (lower is better)
  return suggestions.sort((a, b) => a.score - b.score);
}

// Get teams already playing on a specific date
function getTeamsPlayingOnDate(date) {
  const teams = new Set();
  for (const g of G.sched) {
    if (g.date === date && !g.open) {
      if (g.home) teams.add(g.home);
      if (g.away) teams.add(g.away);
    }
  }
  return teams;
}

// Get available slots for a date
function getAvailableSlots(date) {
  const T1 = document.getElementById('time1')?.value || '6:30 PM';
  const T2 = document.getElementById('time2')?.value || '8:15 PM';
  
  const activeDiamonds = G.diamonds.filter(d => d.active);
  const nightGames = G.sched.filter(g => g.date === date);
  
  const usedAt1 = new Set(nightGames.filter(g => g.time !== T2).map(g => g.diamond));
  const usedAt2 = new Set(nightGames.filter(g => g.time === T2).map(g => g.diamond));
  
  const slots = [];
  
  for (const d of activeDiamonds) {
    if (!usedAt1.has(d.id)) {
      slots.push({ diamond: d.id, time: T1, lights: d.lights, label: `${getDiamondName(d.id)} @ ${T1}` });
    }
    if (d.lights && !usedAt2.has(d.id)) {
      slots.push({ diamond: d.id, time: T2, lights: true, label: `${getDiamondName(d.id)} @ ${T2}` });
    }
  }
  
  return slots;
}

// Render the rainout modal
function renderRainoutModal(game, suggestions) {
  let modal = document.getElementById('rainout-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rainout-modal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1001;justify-content:center;align-items:center';
    document.body.appendChild(modal);
  }
  
  const hasSuggestions = suggestions.length > 0;
  
  let html = `
    <div style="background:white;padding:24px;border-radius:12px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,0.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:18px;font-weight:800;color:var(--navy)">🌧 Rainout & Reschedule</div>
        <button onclick="closeRainoutModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">×</button>
      </div>
      
      <div style="background:var(--gray1);padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px">
        <div style="font-weight:700;margin-bottom:4px">Original Game</div>
        <div>${fmtDate(game.date)} · ${game.time} · ${getDiamondName(game.diamond)}</div>
        <div style="margin-top:4px;color:var(--navy);font-weight:600">${esc(game.home)} vs ${esc(game.away)}</div>
      </div>
      
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">
        Step 1: Mark as rainout (7-7 tie per Rule 8.0)<br>
        Step 2: Select a makeup date
      </div>
  `;
  
  if (hasSuggestions) {
    html += `<div style="font-size:14px;font-weight:700;margin-bottom:10px">Suggested Makeup Dates</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">`;
    
    for (const sug of suggestions) {
      const bestSlot = sug.slots[0];
      const litBadge = bestSlot.lights ? '<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:3px;margin-left:6px">💡 Lit</span>' : '';
      
      html += `
        <div style="border:1.5px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;transition:all 0.15s" 
             onmouseover="this.style.borderColor='var(--navy)';this.style.background='var(--gray1)'" 
             onmouseout="this.style.borderColor='var(--border)';this.style.background='white'"
             onclick="selectMakeupDate('${sug.date}', ${bestSlot.diamond}, '${bestSlot.time}', ${bestSlot.lights})">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:700;color:var(--navy)">${fmtDate(sug.date)}${litBadge}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">${sug.slots.length} slot${sug.slots.length !== 1 ? 's' : ''} available · ${sug.daysFromOriginal} days later</div>
            </div>
            <div style="font-size:12px;color:var(--navy);font-weight:600">${bestSlot.label}</div>
          </div>
        </div>
      `;
    }
    
    html += `</div>`;
  } else {
    html += `
      <div style="background:#fee2e2;color:#991b1b;padding:12px;border-radius:8px;font-size:13px;margin-bottom:16px">
        <strong>No available slots found</strong> for makeup games.<br>
        Teams may be too busy, or the season schedule may be full.
      </div>
    `;
  }
  
  html += `
    <div style="border-top:1px solid var(--border);padding-top:16px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Or manually pick a date:</div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input type="date" id="custom-makeup-date" style="flex:1" min="${game.date}">
        <button onclick="findCustomSlots()" style="padding:8px 16px;background:var(--navy);color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">Find Slots</button>
      </div>
      <div id="custom-slots-container"></div>
    </div>
    
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="rainoutOnly()" style="flex:1;padding:10px;background:none;border:1.5px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;color:var(--muted)">
        Rainout Only (No Makeup)
      </button>
      <button onclick="closeRainoutModal()" style="padding:10px 20px;background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px">
        Cancel
      </button>
    </div>
  </div>`;
  
  modal.innerHTML = html;
}

// Find custom slots for manually selected date
function findCustomSlots() {
  const dateInput = document.getElementById('custom-makeup-date');
  const container = document.getElementById('custom-slots-container');
  if (!dateInput || !container || !dateInput.value) return;
  
  const date = dateInput.value;
  const game = G.sched.find(g => g.id === _rainoutGameId);
  if (!game) return;
  
  const teamsPlaying = getTeamsPlayingOnDate(date);
  const homeBusy = teamsPlaying.has(game.home);
  const awayBusy = teamsPlaying.has(game.away);
  
  if (homeBusy || awayBusy) {
    container.innerHTML = `<div style="color:var(--red);font-size:13px;padding:8px;background:#fee2e2;border-radius:6px">⚠ One or both teams already scheduled on this date</div>`;
    return;
  }
  
  const slots = getAvailableSlots(date);
  if (slots.length === 0) {
    container.innerHTML = `<div style="color:var(--red);font-size:13px;padding:8px;background:#fee2e2;border-radius:6px">⚠ No open slots on this date</div>`;
    return;
  }
  
  let html = `<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">`;
  for (const slot of slots) {
    html += `
      <button onclick="selectMakeupDate('${date}', ${slot.diamond}, '${slot.time}', ${slot.lights})" 
              style="text-align:left;padding:10px;background:var(--gray1);border:1.5px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px">
        ${slot.label} ${slot.lights ? '💡' : '🌙'}
      </button>
    `;
  }
  html += `</div>`;
  container.innerHTML = html;
}

// Select a makeup date and execute the reschedule
function selectMakeupDate(date, diamond, time, lights) {
  if (!_rainoutGameId) return;
  
  const originalGame = G.sched.find(g => g.id === _rainoutGameId);
  if (!originalGame) return;
  
  // 1. Mark original as rainout (7-7 tie)
  G.scores[_rainoutGameId] = { h: 7, a: 7, wx: true, rainout: true };
  
  // 2. Create makeup game
  const makeupId = nextGameId(date);
  const makeupGame = {
    id: makeupId,
    date: date,
    time: time,
    diamond: diamond,
    lights: lights,
    home: originalGame.home,
    away: originalGame.away,
    bye: '',
    crossover: originalGame.crossover,
    makeup: true,
    originalId: _rainoutGameId,
    originalDate: originalGame.date
  };
  
  G.sched.push(makeupGame);
  
  // Sort schedule by date, then time
  G.sched.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time || '').localeCompare(b.time || '');
  });
  
  saveData();
  
  // Refresh all views
  renderScores();
  renderSched();
  renderEdit();
  renderStandings();
  
  showToast(`🌧 Rainout recorded · Makeup scheduled #${makeupId} ${date}`);
  closeRainoutModal();
}

// Mark as rainout without scheduling makeup
function rainoutOnly() {
  if (!_rainoutGameId) return;
  
  G.scores[_rainoutGameId] = { h: 7, a: 7, wx: true, rainout: true };
  saveData();
  
  renderScores();
  renderSched();
  renderStandings();
  
  showToast('🌧 Rainout recorded (7-7 tie) · No makeup scheduled');
  closeRainoutModal();
}
