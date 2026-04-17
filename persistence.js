// ── PERSISTENCE ───────────────────────────────────────────────────────────────

const JSONBIN_BIN_ID    = '69d7a4c036566621a894eed9';
const JSONBIN_WRITE_KEY = '$2a$10$0Hbc5Bc9ABqnRlT3.dmE6OURp.z8twcL0yy4bSGoCACQOTb7Z5fJu';
const JSONBIN_READ_KEY  = '$2a$10$C92oSSIavphdJdlHmYlu4usOllGAQJgkZ5y59MF7NXuDb3pf3Br6m';
const JSONBIN_URL       = () => `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const ADMIN_PIN = '2026';
let isAdmin = false;

// ── ADMIN ─────────────────────────────────────────────────────────────────────
function checkAdmin() {
  if (isAdmin) return true;
  const pin = prompt('Enter admin PIN to make changes:');
  if (pin === ADMIN_PIN) { isAdmin = true; showToast('🔓 Admin mode on'); return true; }
  if (pin !== null) showToast('✗ Wrong PIN');
  return false;
}

function adminGuard(fn) {
  return function(...args) { if (checkAdmin()) fn(...args); };
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
// Single source of truth for toast — works whether #_toast is in HTML or not
function showToast(msg, duration = 2800) {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(6px)';
  }, duration);
}

// ── SAVE ──────────────────────────────────────────────────────────────────────
let _saveDebounceTimer = null;

function saveData() {
  const payload = {
    teams:         G.teams,
    diamonds:      G.diamonds,
    sched:         G.sched,
    scores:        G.scores,
    playoffs:      G.playoffs,
    days:          getSelectedDays(),
    ss:            document.getElementById('ss')?.value || '',
    se:            document.getElementById('se')?.value || '',
    currentSeason: G.currentSeason || 2026,
    champions:     G.champions || null,
    seasonArchive: G.seasonArchive || {}
  };

  // Always write localStorage immediately — instant local persistence
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch(e) {
    console.warn('localStorage write failed:', e);
  }

  // Debounce cloud write — 600ms after last change
  clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer = setTimeout(() => _flushToCloud(payload), 600);
}

async function _flushToCloud(payload) {
  // Guard: need both bin ID and a write key
  if (!JSONBIN_BIN_ID || !JSONBIN_WRITE_KEY) {
    showToast('✓ Saved locally (no cloud key)');
    return;
  }

  showToast('⏳ Syncing to cloud…');

  try {
    const res = await fetch(JSONBIN_URL(), {
      method: 'PUT',
      headers: {
        'Content-Type':    'application/json',
        'X-Master-Key':    JSONBIN_WRITE_KEY,
        'X-Bin-Versioning': 'false'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const gameCount  = payload.sched?.length || 0;
      const scoreCount = Object.keys(payload.scores || {}).length;
      showToast(`✓ Saved — ${gameCount} games, ${scoreCount} scores synced ☁`);
    } else {
      // Log the actual HTTP status so we can diagnose (rate limit, auth, size)
      const body = await res.text().catch(() => '');
      console.error(`JSONBin save failed: HTTP ${res.status}`, body);
      showToast(`⚠ Cloud save failed (${res.status}) — data saved locally`);
    }
  } catch(e) {
    console.warn('JSONBin save error (network?):', e);
    showToast('⚠ Offline — data saved locally, will sync when reconnected');
  }
}

// ── LOAD ──────────────────────────────────────────────────────────────────────
async function loadData() {

  // 1. Try JSONBin (cloud source of truth)
  if (JSONBIN_BIN_ID && (JSONBIN_READ_KEY || JSONBIN_WRITE_KEY)) {
    try {
      const res = await fetch(JSONBIN_URL() + '/latest', {
        headers: { 'X-Master-Key': JSONBIN_READ_KEY || JSONBIN_WRITE_KEY }
      });

      if (res.ok) {
        const json = await res.json();
        const d = json.record;

        if (d && (d.sched?.length || d.teams?.length)) {
          applyData(d);
          // Update local cache with fresh cloud data
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) {}
          return true;
        }
        // Cloud returned empty/blank record — fall through to localStorage
        console.warn('JSONBin record is empty — trying localStorage');
      } else {
        console.warn(`JSONBin load failed: HTTP ${res.status}`);
      }
    } catch(e) {
      console.warn('JSONBin load error (network?):', e);
    }
  }

  // 2. Fallback: localStorage with current key
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      applyData(d);
      showToast('⚠ Loaded from local cache (cloud unavailable)');
      return true;
    }
  } catch(e) {
    console.warn('localStorage read failed:', e);
  }

  // 3. Migrate from old key 'hccsl_2026'
  try {
    const OLD_KEY = 'hccsl_2026';
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const d = JSON.parse(old);
      applyData(d);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) {}
      try { localStorage.removeItem(OLD_KEY); } catch(e) {}
      showToast('✓ Migrated from previous season data');
      // Push migrated data to cloud immediately
      _flushToCloud(d);
      return true;
    }
  } catch(e) {
    console.warn('localStorage migration failed:', e);
  }

  return false;
}

// ── APPLY DATA ────────────────────────────────────────────────────────────────
function applyData(d) {
  if (!d) return;
  if (d.teams)    G.teams    = d.teams;
  if (d.diamonds) {
    const defaults = {
      5:  { lightsCapable: true  },
      9:  { lightsCapable: true  },
      12: { lightsCapable: true  },
      13: { lightsCapable: false },
      14: { lightsCapable: false }
    };
    G.diamonds = d.diamonds.map(dm => ({
      ...dm,
      lightsCapable: dm.lightsCapable !== undefined
        ? dm.lightsCapable
        : (defaults[dm.id]?.lightsCapable ?? true),
      lights: (defaults[dm.id]?.lightsCapable === false) ? false : dm.lights
    }));
  }
  if (d.sched)    G.sched    = d.sched;
  if (d.scores)   G.scores   = d.scores;
  if (d.playoffs) G.playoffs = d.playoffs;
  if (d.ss) { const el = document.getElementById('ss'); if (el) el.value = d.ss; }
  if (d.se) { const el = document.getElementById('se'); if (el) el.value = d.se; }
  if (d.days && d.days.length) applyDays(d.days);
  if (d.currentSeason) G.currentSeason = d.currentSeason;
  G.champions    = d.champions    || null;
  G.seasonArchive = d.seasonArchive || {};
  try { updateSeasonHeader(); } catch(e) {}
}

// ── RESTORE DAY CHECKBOXES ────────────────────────────────────────────────────
function applyDays(days) {
  if (!days || !days.length) return;
  document.querySelectorAll('#day-checks input[type=checkbox]').forEach(cb => {
    const dayIdx = parseInt(cb.value);
    const on = days.includes(dayIdx);
    cb.checked = on;
    const lbl = document.getElementById('daylabel-' + dayIdx);
    if (lbl) {
      lbl.style.borderColor = on ? 'var(--navy)' : 'var(--border)';
      lbl.style.background  = on ? 'var(--navy)' : 'var(--white)';
      lbl.style.color       = on ? '#fff'         : 'var(--text)';
    }
  });
}

// ── CLEAR DATA ────────────────────────────────────────────────────────────────
function clearData() {
  if (!checkAdmin()) return;
  if (!confirm('Clear schedule & scores for the current season?\n\nChampions history and season archives are preserved.\n\nThis cannot be undone.')) return;

  const { champions, seasonArchive, currentSeason } = G;
  G.sched    = [];
  G.scores   = {};
  G.playoffs = {
    seeded: false, podA: [], podB: [], games: {},
    semis:  { podA: {}, podB: {} },
    finals: { podA: { home: null, away: null, score: null }, podB: { home: null, away: null, score: null } }
  };
  G.teams = [
    'Kibosh','Alcoballics','Foul Poles','JAFT','Landon Longballers',
    'One Hit Wonders','Steel City Sluggers',"Pitch Don't Kill My Vibe",'Wayco','CrossOver'
  ];
  G.champions     = champions;
  G.seasonArchive = seasonArchive;
  G.currentSeason = currentSeason;

  try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  saveData();
  location.reload();
}

// ── DOM READY ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {

  // Initialise UI controls first (sync)
  try { renderTeams();     } catch(e) { console.error('renderTeams failed:', e); }
  try { renderDiamonds();  } catch(e) { console.error('renderDiamonds failed:', e); }
  try { initDayChecks();   } catch(e) { console.error('initDayChecks failed:', e); }
  try { updateGptNotice(); } catch(e) { console.error('updateGptNotice failed:', e); }

  // Load data from cloud / localStorage
  let restored = false;
  try { restored = await loadData(); } catch(e) { console.error('loadData failed:', e); }

  // Re-render controls with restored data
  try { renderTeams();    } catch(e) {}
  try { renderDiamonds(); } catch(e) {}

  // Re-apply days in case cloud payload arrived after initDayChecks ran
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const d = JSON.parse(raw); if (d.days) applyDays(d.days); }
  } catch(e) {}

  try { updateGptNotice();       } catch(e) {}
  try { renderChampionAdminUI(); } catch(e) {}

  if (G.sched.length) {
    try { renderSched();      } catch(e) { console.error('renderSched failed:', e); }
    try { renderStandings();  } catch(e) {}
    try { renderStats();      } catch(e) {}
    if (restored) {
      setTimeout(() => showToast(
        `✓ Loaded — ${G.sched.length} games · ${Object.keys(G.scores).length} scores`
      ), 350);
    }
  }
});

// ── RESIZE GUARD ──────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  try {
    if (document.getElementById('tab-stats')?.classList.contains('active')) {
      renderStandingsHistoryChart();
    }
  } catch(e) {}
});
