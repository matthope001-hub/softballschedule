// ── PERSISTENCE — CLOUD ONLY (JSONBin) ───────────────────────────────────────
const JSONBIN_BIN_ID    = '69d7a4c036566621a894eed9';
const JSONBIN_WRITE_KEY = '$2a$10$0Hbc5Bc9ABqnRlT3.dmE6OURp.z8twcL0yy4bSGoCACQOTb7Z5fJu';
const JSONBIN_READ_KEY  = '$2a$10$C92oSSIavphdJdlHmYlu4usOllGAQJgkZ5y59MF7NXuDb3pf3Br6m';
const JSONBIN_URL       = () => `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// ADMIN_PIN and isAdmin are defined in index.html (needed early for PIN modal)

// ── ADMIN ─────────────────────────────────────────────────────────────────────
// checkAdmin now shows PIN modal if not authenticated
// The PIN modal functions (showPinModal, submitPin, etc.) are defined in index.html
function checkAdmin() {
  if (isAdmin) return true;
  // Show PIN modal - will set isAdmin=true on success via submitPin()
  if(typeof showPinModal === 'function'){
    showPinModal();
  } else {
    // Fallback if PIN modal not loaded yet
    const pin = prompt('Enter admin PIN to make changes:');
    if (pin === ADMIN_PIN) { isAdmin = true; showToast('🔓 Admin mode on'); return true; }
    if (pin !== null) showToast('✗ Wrong PIN');
  }
  return false;
}

function adminGuard(fn) {
  return function(...args) { if (checkAdmin()) fn(...args); };
}

// unlockAdmin is defined in index.html with PIN modal support
// This stub prevents errors if called before index.html loads
function unlockAdmin(){
  if(isAdmin){
    document.getElementById('admin-locked').style.display='none';
    document.getElementById('admin-unlocked').style.display='block';
    if(typeof refreshActiveAdminTab === 'function') refreshActiveAdminTab();
    return;
  }
  // Delegate to PIN modal in index.html
  if(typeof showPinModal === 'function') showPinModal();
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, duration=2800) {
  let t=document.getElementById('_toast');
  if(!t){ t=document.createElement('div'); t.id='_toast'; document.body.appendChild(t); }
  t.textContent=msg;
  t.style.opacity='1';
  t.style.transform='translateY(0)';
  clearTimeout(t._hide);
  t._hide=setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(6px)'; },duration);
}

// ── SAVE ──────────────────────────────────────────────────────────────────────
let _saveDebounceTimer=null;

function saveData() {
  const payload={
    teams:         G.teams,
    diamonds:      G.diamonds,
    sched:         G.sched,
    scores:        G.scores,
    playoffs:      G.playoffs,
    days:          getSelectedDays(),
    ss:            document.getElementById('ss')?.value||'',
    se:            document.getElementById('se')?.value||'',
    currentSeason: G.currentSeason||2026,
    champions:     G.champions||null,
    seasonArchive: G.seasonArchive||{}
  };
  clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer=setTimeout(()=>_flushToCloud(payload),600);
}

async function _flushToCloud(payload) {
  showToast('⏳ Syncing…');
  try {
    const res=await fetch(JSONBIN_URL(),{
      method:'PUT',
      headers:{
        'Content-Type':'application/json',
        'X-Master-Key':JSONBIN_WRITE_KEY,
        'X-Bin-Versioning':'false'
      },
      body:JSON.stringify(payload)
    });
    if(res.ok){
      // Also save to localStorage as backup
      try{localStorage.setItem(STORAGE_KEY+'_backup',JSON.stringify(payload));}catch(e){}
      showToast(`✓ Saved — ${payload.sched?.length||0} games · ${Object.keys(payload.scores||{}).length} scores ☁`);
    } else {
      const body=await res.text().catch(()=>'');
      console.error(`JSONBin save failed: HTTP ${res.status}`,body);
      // Fallback to localStorage
      try{localStorage.setItem(STORAGE_KEY+'_backup',JSON.stringify(payload));showToast('⚠ Cloud failed — saved locally');}catch(e){showToast(`⚠ Cloud save failed (${res.status})`);}
    }
  } catch(e) {
    console.warn('JSONBin save error:',e);
    // Fallback to localStorage
    try{
      console.log('Attempting localStorage backup...',STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY+'_backup',JSON.stringify(payload));
      console.log('localStorage backup saved successfully');
      showToast('⚠ Offline mode — saved locally');
    }catch(e2){
      console.error('localStorage backup failed:',e2);
      showToast('⚠ Save failed');
    }
  }
}

// ── LOAD ──────────────────────────────────────────────────────────────────────
async function loadData() {
  showToast('⏳ Loading from cloud…');
  try {
    const res=await fetch(JSONBIN_URL()+'/latest',{
      headers:{
        'X-Master-Key': JSONBIN_WRITE_KEY,
        'X-Access-Key': JSONBIN_READ_KEY
      }
    });
    if(!res.ok){ console.warn(`JSONBin load: HTTP ${res.status}`); throw new Error(`HTTP ${res.status}`); }
    const json=await res.json();
    const d=json.record;
    if(d&&(d.sched?.length||Array.isArray(d.teams))){
      applyData(d);
      // Also update localStorage backup
      try{localStorage.setItem(STORAGE_KEY+'_backup',JSON.stringify(d));}catch(e){}
      return true;
    }
    console.warn('JSONBin record empty');
    return false;
  } catch(e) {
    console.warn('JSONBin load error:',e);
    // Try to load from localStorage backup
    try{
      console.log('Attempting to load from localStorage backup...');
      const backup=localStorage.getItem(STORAGE_KEY+'_backup');
      console.log('localStorage backup found:',!!backup);
      if(backup){
        const d=JSON.parse(backup);
        console.log('Backup data teams:',d?.teams?.length,'sched:',d?.sched?.length);
        if(d&&(d.sched?.length||Array.isArray(d.teams))){
          applyData(d);
          showToast('⚠ Offline mode — loaded from backup');
          return true;
        }
      }
    }catch(e2){console.warn('LocalStorage backup load failed:',e2);}
    showToast('⚠ Could not load — using defaults');
    return false;
  }
}

// ── APPLY DATA ────────────────────────────────────────────────────────────────
function applyData(d) {
  if(!d) return;
  if(d.teams) G.teams=d.teams;
  if(d.diamonds){
    const defaults={5:{lightsCapable:true},9:{lightsCapable:true},12:{lightsCapable:true},13:{lightsCapable:false},14:{lightsCapable:false}};
    G.diamonds=d.diamonds.map(dm=>({
      ...dm,
      lightsCapable:dm.lightsCapable!==undefined?dm.lightsCapable:(defaults[dm.id]?.lightsCapable??true),
      lights:(defaults[dm.id]?.lightsCapable===false)?false:dm.lights
    }));
  }
  if(d.sched){
    // Remove duplicates based on game ID (keep first occurrence)
    const seenIds=new Set();
    G.sched=d.sched.filter(g=>{
      if(seenIds.has(g.id)) return false;
      seenIds.add(g.id);
      return true;
    });
    // Normalize any legacy 24hr times (e.g. "18:30") to 12hr format ("6:30 PM")
    G.sched.forEach(g=>{ if(g.time) g.time=fmt12(g.time); });
  }
  if(d.scores)   G.scores=d.scores;
  if(d.playoffs) G.playoffs=d.playoffs;
  if(d.ss){const el=document.getElementById('ss');if(el)el.value=d.ss;}
  if(d.se){const el=document.getElementById('se');if(el)el.value=d.se;}
  if(d.days&&d.days.length) applyDays(d.days);
  if(d.currentSeason) G.currentSeason=d.currentSeason;
  G.champions    =d.champions||null;
  G.seasonArchive=d.seasonArchive||{};
  try{updateSeasonHeader();}catch(e){}
}

function applyDays(days){
  if(!days||!days.length) return;
  document.querySelectorAll('#day-checks input[type=checkbox]').forEach(cb=>{
    const dayIdx=parseInt(cb.value);
    const on=days.includes(dayIdx);
    cb.checked=on;
    const lbl=document.getElementById('daylabel-'+dayIdx);
    if(lbl){
      lbl.style.borderColor=on?'var(--navy)':'var(--border)';
      lbl.style.background =on?'var(--navy)':'var(--white)';
      lbl.style.color      =on?'#fff':'var(--text)';
    }
  });
}

// ── CLEAR DATA ────────────────────────────────────────────────────────────────
function clearData(){
  if(!checkAdmin()) return;
  if(!confirm('Clear schedule & scores for the current season?\n\nChampions history and season archives are preserved.\n\nThis cannot be undone.')) return;
  const{champions,seasonArchive,currentSeason}=G;
  G.sched=[];G.scores={};
  G.playoffs={seeded:false,podA:[],podB:[],games:{},semis:{podA:{},podB:{}},finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}};
  G.teams=['Kibosh','Alcoballics','Foul Poles','JAFT','Landon Longballers','One Hit Wonders','Steel City Sluggers',"Pitch Don't Kill My Vibe",'Wayco','CrossOver'];
  G.champions=champions;
  G.seasonArchive=seasonArchive;
  G.currentSeason=currentSeason;
  saveData();
  location.reload();
}

// ── DOM READY ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',async function(){
  try{renderTeams();}catch(e){}
  try{renderDiamonds();}catch(e){}
  try{initDayChecks();}catch(e){}
  try{updateGptNotice();}catch(e){}

  const restored=await loadData();
  window._dataLoadAttempted=true;

  try{renderTeams();}catch(e){}
  try{renderDiamonds();}catch(e){}
  try{updateGptNotice();}catch(e){}
  try{renderChampionAdminUI();}catch(e){}

  // Re-render whichever tab is currently active now that data is loaded
  const activeTab=window._activeTab||'schedule';
  try{_renderActiveTab(activeTab);}catch(e){}

  // Fetch and display current weather for Turner Park, Hamilton ON
  try{initHeaderWeather();}catch(e){}

  if(restored&&G.sched.length){
    setTimeout(()=>showToast(`✓ Loaded — ${G.sched.length} games · ${Object.keys(G.scores).length} scores`),200);
  }
});

window.addEventListener('resize',()=>{
  try{if(document.getElementById('tab-stats')?.classList.contains('active'))renderStandingsHistoryChart();}catch(e){}
});

function clearAll(){ clearData(); }
