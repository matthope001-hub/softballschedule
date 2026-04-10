// ── PERSISTENCE ───────────────────────────────────────────────────────────────

// ── JSONBIN CONFIG (fill these in after creating your JSONBin account) ────────
const JSONBIN_BIN_ID  = '69d7a4c036566621a894eed9';
const JSONBIN_API_KEY = '$2a$10$0Hbc5Bc9ABqnRlT3.dmE6OURp.z8twcL0yy4bSGoCACQOTb7Z5fJu';
const JSONBIN_URL     = () => `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// ── ADMIN PIN ─────────────────────────────────────────────────────────────────
const ADMIN_PIN = '2026';   // change this to your preferred PIN
let isAdmin = false;

function checkAdmin(){
  if(isAdmin) return true;
  const pin = prompt('Enter admin PIN to make changes:');
  if(pin === ADMIN_PIN){ isAdmin = true; showToast('🔓 Admin mode on'); return true; }
  if(pin !== null) showToast('✗ Wrong PIN');
  return false;
}

function adminGuard(fn){
  return function(...args){
    if(checkAdmin()) fn(...args);
  };
}

// ── JSONBIN SAVE/LOAD ─────────────────────────────────────────────────────────
async function saveData(){
  const payload = {
    teams:    G.teams,
    diamonds: G.diamonds,
    sched:    G.sched,
    scores:   G.scores,
    playoffs: G.playoffs,
    days:     getSelectedDays(),
    ss:       document.getElementById('ss')?.value||'',
    se:       document.getElementById('se')?.value||''
  };

  // Always save to localStorage as fast local cache
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); }catch(e){}

  // If JSONBin is configured, sync to cloud
  if(!JSONBIN_BIN_ID || !JSONBIN_API_KEY){
    showToast('✓ Saved locally');
    return;
  }

  showToast('⏳ Saving...');
  try{
    const res = await fetch(JSONBIN_URL(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Bin-Versioning': 'false'
      },
      body: JSON.stringify(payload)
    });
    if(res.ok){ showToast('✓ Saved — synced to cloud ☁'); }
    else{ showToast('⚠ Cloud save failed — saved locally'); }
  }catch(e){
    showToast('⚠ Offline — saved locally');
    console.warn('JSONBin save failed:', e);
  }
}

async function loadData(){
  // Try cloud first if configured
  if(JSONBIN_BIN_ID && JSONBIN_API_KEY){
    try{
      showToast('⏳ Loading...');
      const res = await fetch(JSONBIN_URL()+'/latest', {
        headers: { 'X-Master-Key': JSONBIN_API_KEY }
      });
      if(res.ok){
        const json = await res.json();
        const d = json.record;
        applyData(d);
        // Also update local cache
        try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }catch(e){}
        return true;
      }
    }catch(e){
      console.warn('JSONBin load failed, falling back to localStorage:', e);
    }
  }

  // Fall back to localStorage
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    applyData(JSON.parse(raw));
    return true;
  }catch(e){
    console.warn('localStorage load failed:', e);
    return false;
  }
}

function applyData(d){
  if(!d) return;
  if(d.teams) G.teams = d.teams;
  if(d.diamonds){
    const defaults={5:{lightsCapable:true},9:{lightsCapable:true},12:{lightsCapable:true},13:{lightsCapable:false},14:{lightsCapable:false}};
    G.diamonds = d.diamonds.map(dm=>({
      ...dm,
      lightsCapable: dm.lightsCapable!==undefined ? dm.lightsCapable : (defaults[dm.id]?.lightsCapable ?? true),
      lights: (defaults[dm.id]?.lightsCapable===false) ? false : dm.lights
    }));
  }
  if(d.sched)    G.sched    = d.sched;
  if(d.scores)   G.scores   = d.scores;
  if(d.playoffs) G.playoffs = d.playoffs;
  if(d.ss){ const el=document.getElementById('ss'); if(el) el.value=d.ss; }
  if(d.se){
    const el=document.getElementById('se');
    if(el){ el.value=(d.se==='2026-09-15')?'2026-09-29':d.se; }
  }
}

function showToast(msg, duration=2500){
  let t=document.getElementById('_toast');
  if(!t){
    t=document.createElement('div');
    t.id='_toast';
    t.style.cssText='position:fixed;bottom:20px;right:20px;background:#1a2744;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;opacity:0;transition:opacity 0.25s;pointer-events:none;font-family:var(--font);max-width:280px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,0.25)';
    document.body.appendChild(t);
  }
  t.textContent=msg;
  t.style.opacity='1';
  clearTimeout(t._hide);
  t._hide=setTimeout(()=>t.style.opacity='0', duration);
}

function clearData(){
  if(!checkAdmin()) return;
  if(!confirm('Clear ALL shared data — teams, schedule and scores? This cannot be undone.')) return;
  G.sched=[]; G.scores={}; G.teams=['Kibosh','Alcoballics','Foul Poles','JAFT','Landon Longballers','One Hit Wonders','Steel City Sluggers',"Pitch Don't Kill My Vibe",'Wayco','CrossOver'];
  localStorage.removeItem(STORAGE_KEY);
  saveData();
  location.reload();
}

// Init on page load
document.addEventListener('DOMContentLoaded', async function(){
  try{ renderTeams(); }catch(e){ console.error('renderTeams failed:',e); }
  try{ renderDiamonds(); }catch(e){ console.error('renderDiamonds failed:',e); }
  try{ initDayChecks(); }catch(e){ console.error('initDayChecks failed:',e); }
  try{ updateGptNotice(); }catch(e){ console.error('updateGptNotice failed:',e); }

  // Load data (may be async if using JSONBin)
  let restored=false;
  try{ restored = await loadData(); }catch(e){ console.error('loadData failed:',e); }

  // Re-render with loaded data
  try{ renderTeams(); }catch(e){}
  try{ renderDiamonds(); }catch(e){}
  try{ initDayChecks(); }catch(e){}
  try{ updateGptNotice(); }catch(e){}
  try{
    if(G.sched.length){
      renderSched();
      renderStandings();
      renderStats();
      if(restored) setTimeout(()=>showToast(`✓ Loaded — ${G.sched.length} games, ${Object.keys(G.scores).length} scores`), 300);
    }
  }catch(e){ console.error('renderSched failed:',e); }
});

// Redraw standings history chart on resize (SVG is responsive but needs width recalc)
window.addEventListener('resize', ()=>{
  try{ renderStandingsHistoryChart(); }catch(e){}
});
