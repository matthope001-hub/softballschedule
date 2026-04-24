// ── PERSISTENCE — CLOUD ONLY (JSONBin) ───────────────────────────────────────
const JSONBIN_BIN_ID    = '69d7a4c036566621a894eed9';
const JSONBIN_WRITE_KEY = '$2a$10$0Hbc5Bc9ABqnRlT3.dmE6OURp.z8twcL0yy4bSGoCACQOTb7Z5fJu';
const JSONBIN_READ_KEY  = '$2a$10$C92oSSIavphdJdlHmYlu4usOllGAQJgkZ5y59MF7NXuDb3pf3Br6m';
const JSONBIN_URL       = () => `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

// ADMIN_PIN and isAdmin are defined in index.html (needed early for PIN modal)

// ── ADMIN ─────────────────────────────────────────────────────────────────────
function checkAdmin() {
  if (isAdmin) return true;
  if(typeof showPinModal === 'function'){
    showPinModal();
  } else {
    const pin = prompt('Enter admin PIN to make changes:');
    if (pin === ADMIN_PIN) { isAdmin = true; showToast('🔓 Admin mode on'); return true; }
    if (pin !== null) showToast('✗ Wrong PIN');
  }
  return false;
}

function adminGuard(fn) {
  return function(...args) { if (checkAdmin()) fn(...args); };
}

function unlockAdmin(){
  if(isAdmin){
    document.getElementById('admin-locked').style.display='none';
    document.getElementById('admin-unlocked').style.display='block';
    if(typeof refreshActiveAdminTab === 'function') refreshActiveAdminTab();
    return;
  }
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

// ── SEASON SETTINGS SYNC ──────────────────────────────────────────────────────
// PATCH: store ss/se/days in G.settings so _buildPayload() never reads the DOM.
// DOM reads in _buildPayload() are unsafe — if the debounce fires while the user
// is on a non-Settings tab, document.getElementById('ss') returns the element
// but its value may be stale or empty, silently overwriting valid cloud data.
// All writers (initDayChecks, onDayChange, input[ss/se] onchange) must call
// syncSettingsToG() to keep G.settings current.
if(!G.settings) G.settings={ss:'',se:'',days:[2]};

function syncSettingsToG(){
  const ssEl=document.getElementById('ss');
  const seEl=document.getElementById('se');
  if(ssEl&&ssEl.value) G.settings.ss=ssEl.value;
  if(seEl&&seEl.value) G.settings.se=seEl.value;
  G.settings.days=getSelectedDays();
}

// ── SAVE ──────────────────────────────────────────────────────────────────────
// Payload is built at flush time (inside _flushToCloud), not at saveData() call
// time — rapid admin actions won't flush a stale snapshot captured 600ms earlier.
// ss/se/days now read from G.settings, not from DOM.
let _saveDebounceTimer=null;

function saveData() {
  // Sync DOM → G.settings at call time (user is likely still on Settings tab)
  syncSettingsToG();
  clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer=setTimeout(()=>_flushToCloud(),600);
}

function _buildPayload(){
  return {
    teams:         G.teams,
    diamonds:      G.diamonds,
    sched:         G.sched,
    scores:        G.scores,
    playoffs:      G.playoffs,
    // PATCH: read from G.settings — never from DOM — so values are correct
    // regardless of which tab is active when the debounce fires.
    days:          G.settings.days,
    ss:            G.settings.ss,
    se:            G.settings.se,
    currentSeason: G.currentSeason||2026,
    champions:     G.champions||null,
    seasonArchive: G.seasonArchive||{}
  };
}

async function _flushToCloud() {
  const payload=_buildPayload();
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
      try{localStorage.setItem(STORAGE_KEY+'_backup',JSON.stringify(payload));}catch(e){}
      showToast(`✓ Saved — ${payload.sched?.length||0} games · ${Object.keys(payload.scores||{}).length} scores ☁`);
    } else {
      const body=await res.text().catch(()=>'');
      console.error(`JSONBin save failed: HTTP ${res.status}`,body);
      try{
        localStorage.setItem(STORAGE_KEY+'_backup',JSON.stringify(payload));
        showToast('⚠ Cloud failed — saved locally');
      }catch(e){
        showToast(`⚠ Cloud save failed (${res.status})`);
      }
    }
  } catch(e) {
    console.warn('JSONBin save error:',e);
    try{
      localStorage.setItem(STORAGE_KEY+'_backup',JSON.stringify(payload));
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
      try{localStorage.setItem(STORAGE_KEY+'_backup',JSON.stringify(d));}catch(e){}
      return true;
    }
    console.warn('JSONBin record empty');
    return false;
  } catch(e) {
    console.warn('JSONBin load error:',e);
    try{
      const backup=localStorage.getItem(STORAGE_KEY+'_backup');
      if(backup){
        const d=JSON.parse(backup);
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
    const seenIds=new Set();
    G.sched=d.sched.filter(g=>{
      if(seenIds.has(g.id)) return false;
      seenIds.add(g.id);
      return true;
    });
    G.sched.forEach(g=>{ if(g.time) g.time=fmt12(g.time); });
  }
  if(d.scores) G.scores=d.scores;
  // Guard playoffs.format — old JSONBin records won't have it.
  if(d.playoffs){
    const existingFormat=G.playoffs?.format||'podrr';
    G.playoffs=d.playoffs;
    if(!G.playoffs.format) G.playoffs.format=existingFormat;
  }
  // PATCH: apply ss/se/days to both DOM and G.settings
  if(d.ss){
    const el=document.getElementById('ss');
    if(el) el.value=d.ss;
    G.settings.ss=d.ss;
  }
  if(d.se){
    const el=document.getElementById('se');
    if(el) el.value=d.se;
    G.settings.se=d.se;
  }
  if(d.days&&d.days.length){
    applyDays(d.days);
    G.settings.days=d.days;
  }
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
  G.playoffs={seeded:false,format:'podrr',podA:[],podB:[],games:{},semis:{podA:{},podB:{}},finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}};
  G.teams=['Kibosh','Alcoballics','Foul Poles','JAFT','Landon Longballers','One Hit Wonders','Steel City Sluggers',"Pitch Don't Kill My Vibe",'Wayco','CrossOver'];
  G.champions=champions;
  G.seasonArchive=seasonArchive;
  G.currentSeason=currentSeason;
  // PATCH: preserve settings through clear — don't wipe season dates
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

  // PATCH: sync DOM → G.settings after load so first saveData() call has correct values
  try{syncSettingsToG();}catch(e){}

  try{renderTeams();}catch(e){}
  try{renderDiamonds();}catch(e){}
  try{updateGptNotice();}catch(e){}
  try{renderChampionAdminUI();}catch(e){}

  const activeTab=window._activeTab||'schedule';
  try{_renderActiveTab(activeTab);}catch(e){}

  try{initHeaderWeather();}catch(e){}

  if(restored&&G.sched.length){
    setTimeout(()=>showToast(`✓ Loaded — ${G.sched.length} games · ${Object.keys(G.scores).length} scores`),200);
  }
});

window.addEventListener('resize',()=>{
  try{if(document.getElementById('tab-stats')?.classList.contains('active'))renderStandingsHistoryChart();}catch(e){}
});

function clearAll(){ clearData(); }
