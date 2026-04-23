// ── DATA ──────────────────────────────────────────────────────────────────────
const CAP=7;
const STORAGE_KEY='hccsl_v2';
const MONTH_NAMES=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

let G={
  teams:['Kibosh','Alcoballics','Foul Poles','JAFT','Landon Longballers',
         'One Hit Wonders','Steel City Sluggers',"Pitch Don't Kill My Vibe",'Wayco','CrossOver'],
  diamonds:[
    {id:2,  name:'Diamond 2',  lights:false, lightsCapable:false, active:false},
    {id:3,  name:'Diamond 3',  lights:false, lightsCapable:false, active:false},
    {id:4,  name:'Diamond 4',  lights:false, lightsCapable:false, active:false},
    {id:5,  name:'Diamond 5',  lights:false, lightsCapable:true,  active:true},
    {id:6,  name:'Diamond 6',  lights:false, lightsCapable:true,  active:false},
    {id:7,  name:'Diamond 7',  lights:false, lightsCapable:true,  active:false},
    {id:8,  name:'Diamond 8',  lights:false, lightsCapable:true,  active:false},
    {id:9,  name:'Diamond 9',  lights:true,  lightsCapable:true,  active:true},
    {id:10, name:'Diamond 10', lights:false, lightsCapable:true,  active:false},
    {id:11, name:'Diamond 11', lights:false, lightsCapable:true,  active:false},
    {id:12, name:'Diamond 12', lights:true,  lightsCapable:true,  active:true},
    {id:13, name:'Diamond 13', lights:false, lightsCapable:false, active:true},
    {id:14, name:'Diamond 14', lights:false, lightsCapable:false, active:true}
  ],
  sched:[],
  scores:{},
  playoffs:{seeded:false,podA:[],podB:[],games:{},semis:{podA:{},podB:{}},finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}},
  currentSeason:2026,
  champions:null,
  seasonArchive:{}
};

const CROSSOVER='CrossOver';
// FIX: removed global `let hc={}` — hc/hcMap are scoped inside genSched() in schedule-gen.js
// FIX: removed duplicate `let schedFilterTeam` and `let schedFilterDiamond` — declared in schedule-render.js

// ── DIAMOND HELPERS ───────────────────────────────────────────────────────────
function getDiamonds(){ return G.diamonds; }
function getDiamondIds(){ return G.diamonds.filter(d=>d.active).map(d=>d.id); }
function getDiamondName(id){ const d=G.diamonds.find(d=>d.id===id); return d?d.name:'D'+id; }
function isDiamondLit(id){ const d=G.diamonds.find(d=>d.id===id); return d?d.lights:false; }

// ── UTILS ─────────────────────────────────────────────────────────────────────
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toDateStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtDate(s){
  const[y,m,d]=s.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
}
function monthLabel(s){
  const parts=s.split('-');
  return MONTH_NAMES[parseInt(parts[1],10)-1]+' '+parts[0];
}
function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
// FIX: removed broken 2-arg pickHA that read from undeclared global `hc`.
// The correct 3-arg pickHA(t1,t2,hcMap) lives in schedule-gen.js.

// ── TABS ──────────────────────────────────────────────────────────────────────
function showTab(t,btn){
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const tabEl=document.getElementById('tab-'+t);
  if(tabEl)tabEl.classList.add('active');
  window._activeTab=t;
  _renderActiveTab(t);
  if(t==='parkmap'){
    setTimeout(()=>{if(window._leafletMap)window._leafletMap.invalidateSize();},80);
  }
}

function _renderActiveTab(t){
  try{
    if(t==='schedule'  &&typeof renderSched==='function')     renderSched();
  }catch(e){console.error('renderSched error:',e);}
  try{
    if(t==='standings' &&typeof renderStandings==='function') renderStandings();
  }catch(e){console.error('renderStandings error:',e);}
  try{
    if(t==='stats'     &&typeof renderStats==='function')     renderStats();
  }catch(e){console.error('renderStats error:',e);}
  try{
    if(t==='playoffs'  &&typeof renderPlayoffs==='function')  renderPlayoffs();
  }catch(e){console.error('renderPlayoffs error:',e);}
  try{
    if(t==='champions' &&typeof renderChampions==='function') renderChampions();
  }catch(e){console.error('renderChampions error:',e);}
  try{
    if(t==='admin'     &&typeof refreshActiveAdminTab==='function') refreshActiveAdminTab();
  }catch(e){console.error('refreshActiveAdminTab error:',e);}
}

// ── ADMIN TABS ────────────────────────────────────────────────────────────────
var activeAdminTab='scores';

function showAdminTab(t,btn){
  activeAdminTab=t;
  document.querySelectorAll('.admin-subtab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const panel=document.getElementById('admin-'+t);
  if(panel)panel.classList.add('active');
  refreshActiveAdminTab();
}

function refreshActiveAdminTab(){
  const t=activeAdminTab;
  if(t==='scores'  &&typeof renderScores==='function')       renderScores();
  if(t==='edit'    &&typeof renderEdit==='function')         renderEdit();
  if(t==='playoffs'&&typeof renderPlayoffsAdmin==='function')renderPlayoffsAdmin();
  if(t==='settings'&&typeof renderDiamonds==='function'){    renderTeams();renderDiamonds();updateGptNotice();}
}

function fmt12(t){
  if(!t||!t.includes(':')) return t;
  if(t.toLowerCase().includes('am')||t.toLowerCase().includes('pm')) return t;
  const [h,m]=t.split(':').map(Number);
  const ampm=h>=12?'PM':'AM';
  const h12=h%12||12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ── GAME NIGHTS ───────────────────────────────────────────────────────────────
function getSelectedDays(){
  const cbs=document.querySelectorAll('#day-checks input[type=checkbox]:checked');
  return Array.from(cbs).map(cb=>parseInt(cb.value));
}

function getGameNights(ss,se,days){
  const nights=[];
  const start=new Date(ss+'T12:00:00');
  const end=new Date(se+'T12:00:00');
  const cur=new Date(start);
  while(cur<=end){
    if(days.includes(cur.getDay())) nights.push(toDateStr(cur));
    cur.setDate(cur.getDate()+1);
  }
  return nights;
}

// ── TEAMS ─────────────────────────────────────────────────────────────────────
function addTeam(){
  const inp=document.getElementById('ti');
  const name=(inp?.value||'').trim();
  if(!name){alert('Enter a team name.');return;}
  if(G.teams.includes(name)){alert('Team already exists.');return;}
  if(G.teams.length>=10){alert('Maximum 10 teams.');return;}
  G.teams.push(name);
  inp.value='';
  saveData();
  renderTeams();
  updateGptNotice();
}

function removeTeam(name){
  if(!checkAdmin()) return;
  if(!confirm(`Remove "${name}" from the league?`)) return;
  G.teams=G.teams.filter(t=>t!==name);
  saveData();
  renderTeams();
  updateGptNotice();
}

function renderTeams(){
  const el=document.getElementById('tl');
  if(!el) return;
  el.innerHTML=G.teams.map(t=>`
    <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--r-pill);font-size:12px;font-weight:600">
      ${esc(t)}
      ${t===CROSSOVER?'<span style="font-size:10px;color:var(--muted)">(guest)</span>':''}
      <button onclick="removeTeam('${t.replace(/'/g,"\\'")}')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;line-height:1;margin-left:2px">×</button>
    </span>`).join('');
}

// ── DIAMONDS ──────────────────────────────────────────────────────────────────
function toggleDiamondActive(id){
  const dm=G.diamonds.find(d=>d.id===id);
  if(!dm) return;
  dm.active=!dm.active;
  saveData();
  renderDiamonds();
  updateGptNotice();
}

function toggleDiamondLights(id){
  const dm=G.diamonds.find(d=>d.id===id);
  if(!dm||!dm.lightsCapable) return;
  dm.lights=!dm.lights;
  saveData();
  renderDiamonds();
  updateGptNotice();
}

function renderDiamonds(){
  const el=document.getElementById('dm');
  if(!el) return;
  const active=G.diamonds.filter(d=>d.active);
  const inactive=G.diamonds.filter(d=>!d.active);

  function renderRow(d){
    const locked=!d.lightsCapable;
    const lightsLabel=locked?'🚫 No lights infrastructure':(d.lights?'💡 Lights ON':'🌙 Lights OFF');
    const lightsColor=locked?'var(--muted)':(d.lights?'var(--gold)':'var(--text3)');
    return`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <button onclick="toggleDiamondActive(${d.id})" style="padding:3px 10px;font-size:11px;font-weight:700;border-radius:var(--r-pill);border:1.5px solid ${d.active?'var(--green)':'var(--border)'};background:${d.active?'var(--green-bg)':'var(--surface2)'};color:${d.active?'var(--green)':'var(--muted)'};cursor:pointer;white-space:nowrap">
        ${d.active?'✓ Active':'Inactive'}
      </button>
      <span style="font-size:13px;font-weight:600;flex:1">${esc(d.name)}</span>
      <button onclick="${locked?'':` toggleDiamondLights(${d.id})`}" ${locked?'disabled':''} style="padding:3px 10px;font-size:11px;font-weight:600;border-radius:var(--r-pill);border:1.5px solid var(--border);background:var(--surface2);color:${lightsColor};cursor:${locked?'default':'pointer'};white-space:nowrap;opacity:${locked?'0.6':'1'}">
        ${lightsLabel}
      </button>
    </div>`;
  }

  let html=`<div style="display:flex;flex-direction:column;gap:0;margin-bottom:10px">${active.map(renderRow).join('')}</div>`;
  if(inactive.length){
    html+=`<div>
      <button onclick="(function(btn){const body=document.getElementById('inactive-dm-body');const arr=btn.querySelector('.dm-arr');if(body.style.display==='none'){body.style.display='flex';arr.textContent='▲';}else{body.style.display='none';arr.textContent='▼';}})(this)"
        style="display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;padding:4px 0;cursor:pointer;text-align:left">
        <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;color:var(--muted)">⬜ Inactive Diamonds (${inactive.length}) — not used in scheduling</span>
        <span class="dm-arr" style="font-size:10px;color:var(--muted)">▼</span>
      </button>
      <div id="inactive-dm-body" style="display:none;flex-direction:column;gap:6px;margin-top:6px">
        ${inactive.map(renderRow).join('')}
      </div>
    </div>`;
  }
  el.innerHTML=html;
}

// ── SEASON HEADER ─────────────────────────────────────────────────────────────
function updateSeasonHeader(){
  const badge=document.querySelector('.header-badge');
  if(badge) badge.textContent=`${G.currentSeason||2026} Season`;
}

// ── NEXT GAME ID ──────────────────────────────────────────────────────────────
function nextGameId(dateStr){
  const yr=dateStr.slice(2,4);
  const existing=G.sched.filter(g=>g.id.startsWith(yr));
  const maxSeq=existing.reduce((m,g)=>{const n=parseInt(g.id.slice(2));return n>m?n:m;},0);
  return`${yr}${String(maxSeq+1).padStart(3,'0')}`;
}

// ── DAYS OF WEEK ──────────────────────────────────────────────────────────────
const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function initDayChecks(){
  const el=document.getElementById('day-checks');
  if(!el)return;
  let savedDays=[2]; // Default to Tuesday
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw){
      const d=JSON.parse(raw);
      if(d.days&&Array.isArray(d.days)&&d.days.length>0){
        // Filter to only valid day indices (0-6)
        savedDays=d.days.filter(day=>Number.isInteger(day)&&day>=0&&day<=6);
      }
    }
  }catch(e){/* ignore parse errors */}
  el.innerHTML=DAY_NAMES.map((name,i)=>{
    const isChecked=savedDays.includes(i);
    const checkedAttr=isChecked?'checked':'';
    const activeStyle='border-color:var(--navy);background:var(--navy);color:#fff';
    const inactiveStyle='border-color:var(--border);background:var(--white);color:var(--text)';
    const currentStyle=isChecked?activeStyle:inactiveStyle;
    return`<label id="daylabel-${i}" style="display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;padding:6px 13px;border-radius:6px;border:1.5px solid;cursor:pointer;user-select:none;transition:all 0.15s;${currentStyle}">
      <input type="checkbox" value="${i}" ${checkedAttr} onchange="onDayChange(${i},this)" style="display:none"> ${name}
    </label>`;
  }).join('');
}

function onDayChange(i,cb){
  const lbl=document.getElementById('daylabel-'+i);
  if(lbl){
    if(cb.checked){lbl.style.borderColor='var(--navy)';lbl.style.background='var(--navy)';lbl.style.color='#fff';}
    else{lbl.style.borderColor='var(--border)';lbl.style.background='var(--white)';lbl.style.color='var(--text)';}
  }
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    const d=raw?JSON.parse(raw):{};
    d.days=getSelectedDays();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(d));
  }catch(e){}
  updateGptNotice();
}

// ── GENERATE SCHEDULE (wrapper) ───────────────────────────────────────────────
function generateSchedule(){
  if(!checkAdmin()) return;
  if(!confirm('Generate a new schedule? This will replace the current schedule and clear all scores.')) return;
  genSched();
}

// ── HEADER WEATHER (Turner Park, Hamilton ON · Open-Meteo, no API key) ────────
// Coords: 43.2557, -79.8711
async function initHeaderWeather(){
  const dateEl=document.getElementById('hw-date');
  const wxEl=document.getElementById('hw-weather');
  if(!dateEl||!wxEl) return;

  // Display today's date
  const now=new Date();
  const dateStr=now.toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'});
  dateEl.textContent=dateStr;

  // WMO weather interpretation codes → emoji + short label
  const WMO={
    0:['☀️','Clear'],
    1:['🌤','Mostly Clear'],2:['⛅','Partly Cloudy'],3:['☁️','Overcast'],
    45:['🌫','Fog'],48:['🌫','Icy Fog'],
    51:['🌦','Lt Drizzle'],53:['🌦','Drizzle'],55:['🌧','Hvy Drizzle'],
    61:['🌧','Lt Rain'],63:['🌧','Rain'],65:['🌧','Hvy Rain'],
    71:['🌨','Lt Snow'],73:['🌨','Snow'],75:['❄️','Hvy Snow'],77:['🌨','Snow Grains'],
    80:['🌦','Showers'],81:['🌧','Showers'],82:['⛈','Hvy Showers'],
    85:['🌨','Snow Showers'],86:['❄️','Hvy Snow Showers'],
    95:['⛈','Thunderstorm'],96:['⛈','T-Storm+Hail'],99:['⛈','T-Storm+Hail']
  };

  try{
    const url='https://api.open-meteo.com/v1/forecast?latitude=43.2557&longitude=-79.8711&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=celsius&windspeed_unit=kmh&timezone=America%2FToronto';
    const res=await fetch(url);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    const c=data.current;
    const temp=Math.round(c.temperature_2m);
    const code=c.weathercode;
    const wind=Math.round(c.windspeed_10m);
    const[icon,label]=WMO[code]||['🌡','Unknown'];
    wxEl.innerHTML=`<span title="${label}">${icon}</span><span style="font-size:13px;font-weight:700">${temp}°C</span><span style="opacity:0.45;font-weight:400;font-size:10px">${wind}km/h</span>`;
    wxEl.title=`${label} · ${temp}°C · Wind ${wind} km/h · Turner Park, Hamilton`;
  }catch(e){
    wxEl.innerHTML=`<span style="opacity:0.3;font-size:11px;font-weight:400">—</span>`;
    console.warn('Weather fetch failed:',e);
  }
}

// ── SCHEDULE CALCULATOR ───────────────────────────────────────────────────────
function updateGptNotice(){
  const noticeEl=document.getElementById('gpt-notice');
  if(!noticeEl)return;
  const ssEl=document.getElementById('ss');
  const seEl=document.getElementById('se');
  if(!ssEl||!seEl)return;

  const selectedDays=getSelectedDays();
  const leagueN=G.teams.filter(t=>t!==CROSSOVER).length;
  const nights=getGameNights(ssEl.value,seEl.value,selectedDays).length;

  if(nights<1||selectedDays.length<1){
    noticeEl.innerHTML=`<div class="notice" style="color:var(--muted)">Select at least one game day.</div>`;
    return;
  }

  const activeDiamonds=G.diamonds.filter(d=>d.active);
  const d9=activeDiamonds.find(d=>d.id===9);
  const dhDiamonds=activeDiamonds.filter(d=>d.id!==9&&d.lights);
  const singleDiamonds=activeDiamonds.filter(d=>d.id!==9&&!d.lights);
  const dhCount=dhDiamonds.length;
  const singleCount=singleDiamonds.length;

  const tfacedEl=document.getElementById('tfaced');
  const tfaced=tfacedEl?parseInt(tfacedEl.value)||2:2;
  const targetDhEl=document.getElementById('targetDh');
  const targetDh=targetDhEl?parseInt(targetDhEl.value)||0:0;

  const uniquePairs=leagueN*(leagueN-1)/2;
  const lgPairSlotsPerNight=dhCount+singleCount;
  
  // Calculate required nights based on target DH or auto mode
  let requiredNights,coEach,dhBonus;
  if(targetDh>0){
    // Target mode: use specified DH nights per team
    // Games per team = (CO nights × 2) + target DH + remaining single games
    requiredNights=Math.ceil(uniquePairs*tfaced/lgPairSlotsPerNight);
    coEach=requiredNights>0?requiredNights/leagueN:tfaced;
    dhBonus=targetDh; // Use target instead of auto-calc
  }else{
    // Auto mode: calculate from available DH diamonds
    requiredNights=lgPairSlotsPerNight>0?Math.round(uniquePairs*tfaced/lgPairSlotsPerNight):0;
    coEach=requiredNights>0?requiredNights/leagueN:tfaced;
    dhBonus=coEach*dhCount;
  }
  
  const lgGamesFromFaced=uniquePairs*tfaced;
  const nightsMatch=nights===requiredNights&&requiredNights>0;
  const league630=requiredNights-coEach;
  const gamesPerTeam=Math.round(coEach+coEach+dhBonus+league630);

  const lgGamesPerNight=dhCount*2+singleCount;
  const totalGamesPerNight=lgGamesPerNight+2;
  const totalGames=totalGamesPerNight*(nightsMatch?requiredNights:nights);
  const coTotalGames=2*(nightsMatch?requiredNights:nights);
  const lgTotalGames=totalGames-coTotalGames;

  const t1=`${lgPairSlotsPerNight} league slot${lgPairSlotsPerNight!==1?'s':''}/night`;
  const t2=d9?'1 CrossOver DH':'no D9';
  const dhMode=targetDh>0?`Target: ${targetDh} DH`:`Auto: ${Math.round(dhBonus)} DH`;

  // ── RECOMMENDATION CALCULATOR ───────────────────────────────────────────────
  // Calculate max balanced games per team given constraints
  const totalTeamGameSlots=nights*lgPairSlotsPerNight*2; // Each game serves 2 teams
  const maxGamesPerTeam=leagueN>0?Math.floor(totalTeamGameSlots/leagueN):0;
  // CrossOver plays 2 games per night, distributed across league teams
  const coGamesPerTeam=leagueN>0?Math.floor((2*nights)/leagueN):0;
  // Recommended: balanced games based on available slots
  const recommendedGames=leagueN>0?Math.min(maxGamesPerTeam,Math.max(10,coGamesPerTeam+Math.floor((nights*lgPairSlotsPerNight)/leagueN*2))):0;
  const recText=leagueN>0?`${recommendedGames} games (${coGamesPerTeam} vs CO + ${recommendedGames-coGamesPerTeam} league)`:'Add teams to calculate';

  let statusHtml,statusBg;
  if(!nightsMatch){
    const diff=requiredNights-nights;
    statusHtml=`<span style="color:var(--red);font-weight:800">✗ Cannot meet minimum</span> — ${tfaced}× required matchups need exactly <strong>${requiredNights}</strong> nights. You have <strong>${nights}</strong>. ${diff>0?`Add ${diff} more game nights.`:`Remove ${-diff} game nights.`}`;
    statusBg='#fff0f0';
  }else{
    statusHtml=`<span style="color:#27ae60;font-weight:800">✓ Ready — ${gamesPerTeam} games/team, every pair plays minimum ${tfaced}×</span>`;
    statusBg='#edf7f0';
  }

  noticeEl.innerHTML=`<div style="border:1.5px solid var(--border);border-radius:8px;overflow:hidden;font-size:13px;margin-top:4px">
    <div style="background:var(--navy);color:#fff;padding:7px 12px;font-weight:800;font-size:11px;letter-spacing:0.8px;text-transform:uppercase">📊 Schedule Calculator</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--border)">
      <div style="padding:8px 12px;border-right:1px solid var(--border)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px">Game Nights</div>
        <div style="font-size:22px;font-weight:800;color:${nightsMatch?'var(--navy)':'var(--red)'};line-height:1.2">${nights}</div>
        <div style="font-size:11px;color:var(--muted)">Need ${requiredNights}</div>
      </div>
      <div style="padding:8px 12px;border-right:1px solid var(--border)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px">Games/Team</div>
        <div style="font-size:22px;font-weight:800;color:var(--navy);line-height:1.2">${gamesPerTeam}</div>
        <div style="font-size:11px;color:var(--muted)">${tfaced}× · ${dhMode}</div>
      </div>
      <div style="padding:8px 12px">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px">Total Games</div>
        <div style="font-size:22px;font-weight:800;color:var(--navy);line-height:1.2">${totalGames}</div>
        <div style="font-size:11px;color:var(--muted)">CO: ${coTotalGames} · League: ${lgTotalGames}</div>
      </div>
    </div>
    <div style="padding:8px 12px;border-bottom:1px solid var(--border)">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">Per Night · ${t1} / ${t2} · ${activeDiamonds.length} diamonds · ${dhMode}</div>
      <div style="display:grid;gap:3px">
        <div style="display:flex;justify-content:space-between;font-size:12px"><span>D9 — CrossOver DH</span><strong>2 games</strong></div>
        ${dhDiamonds.map(d=>`<div style="display:flex;justify-content:space-between;font-size:12px"><span>D${d.id} — ${esc(d.name)} — 💡 Doubleheader</span><strong>2 games</strong></div>`).join('')}
        ${singleDiamonds.map(d=>`<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)"><span>D${d.id} — ${esc(d.name)} — 🌙 Single only</span><strong style="color:var(--text)">1 game</strong></div>`).join('')}
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;border-top:1px solid var(--border);padding-top:4px;margin-top:2px"><span>Total per night</span><span>${totalGamesPerNight} games</span></div>
      </div>
    </div>
    <div style="padding:8px 12px;border-bottom:1px solid var(--border)">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Opponent Matchups</div>
      <div style="display:grid;gap:2px;font-size:12px">
        <div style="display:flex;justify-content:space-between"><span>${uniquePairs} unique pairs × minimum ${tfaced}× each</span><strong>${lgGamesFromFaced} league games minimum</strong></div>
        <div style="display:flex;justify-content:space-between;color:var(--muted)"><span>Required season length</span><strong style="color:var(--text)">${requiredNights} nights needed</strong></div>
      </div>
    </div>
    <div style="padding:8px 12px;border-bottom:1px solid var(--border);background:var(--surface2)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px">Recommended Games/Team</div>
          <div style="font-size:18px;font-weight:800;color:var(--navy);line-height:1.2">${recText}</div>
        </div>
        <button onclick="applyRecommendedGames(${recommendedGames})" style="padding:6px 14px;font-size:12px;font-weight:700;background:var(--navy);color:#fff;border:none;border-radius:6px;cursor:pointer">Use ${recommendedGames}</button>
      </div>
    </div>
    <div style="padding:8px 12px;background:${statusBg};font-size:13px">${statusHtml}</div>
  </div>`;
}

function applyRecommendedGames(n){
  if(n<1)return;
  const gptEl=document.getElementById('gpt');
  if(gptEl){
    gptEl.value=n;
    updateGptNotice();
    showToast(`✓ Set to ${n} games per team`);
  }
}
