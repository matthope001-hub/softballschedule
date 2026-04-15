// ── DATA ──────────────────────────────────────────────────────────────────────
const CAP=7;
const STORAGE_KEY='hccsl_2026';
const MONTH_NAMES=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
// DIAMONDS is now dynamic — always use getDiamondIds() or G.diamonds
function DIAMONDS(){ return getDiamondIds(); }

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
  sched:[],scores:{},
  playoffs:{seeded:false,podA:[],podB:[],games:{},finals:{}}
};
const CROSSOVER='CrossOver';
let hc={};
let schedFilterTeam=null;

// Derived diamond helpers — always read from G.diamonds
function getDiamonds(){ return G.diamonds; }
// Only return IDs for ACTIVE diamonds (used by scheduler)
function getDiamondIds(){ return G.diamonds.filter(d=>d.active).map(d=>d.id); }
function getDiamondName(id){ const d=G.diamonds.find(d=>d.id===id); return d?d.name:'D'+id; }
function isDiamondLit(id){ const d=G.diamonds.find(d=>d.id===id); return d?d.lights:false; }

// ── UTILS ─────────────────────────────────────────────────────────────────────
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// Always store and use dates as "YYYY-MM-DD" strings — never Date objects in G.sched
function toDateStr(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

// Format "YYYY-MM-DD" → "TUESDAY, MAY 19" using local time only
function fmtDate(s){
  const[y,m,d]=s.split('-').map(Number);
  const dt=new Date(y,m-1,d);
  return dt.toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
}

// "YYYY-MM-DD" → "MAY 2026"
function monthLabel(s){
  const parts=s.split('-');
  return MONTH_NAMES[parseInt(parts[1],10)-1]+' '+parts[0];
}

function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

function pickHA(t1,t2){
  const h1=hc[t1]||0,h2=hc[t2]||0;
  if(h1<h2)return[t1,t2];
  if(h2<h1)return[t2,t1];
  return Math.random()<0.5?[t1,t2]:[t2,t1];
}

// ── TABS ──────────────────────────────────────────────────────────────────────
function showTab(t,btn){
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.getElementById('tab-'+t).classList.add('active');
  if(t==='schedule')renderSched();
  if(t==='standings')renderStandings();
  if(t==='stats')renderStats();
  if(t==='playoffs')renderPlayoffs();
  if(t==='champions')renderChampions();
  if(t==='admin' && typeof refreshActiveAdminTab==='function') refreshActiveAdminTab();
}

// ── TEAMS ─────────────────────────────────────────────────────────────────────
function addTeam(){
  const inp=document.getElementById('ti');
  const name=inp.value.trim();
  if(!name||G.teams.includes(name))return;
  if(G.teams.length>=10){alert("MAX 10 TEAMS, WU-TANG AIN'T FOREVER");return;}
  G.teams.push(name);inp.value='';saveData();renderTeams();
}
document.getElementById('ti').addEventListener('keydown',e=>{if(e.key==='Enter')addTeam();});
function removeTeam(name){G.teams=G.teams.filter(t=>t!==name);saveData();renderTeams();}
function renderTeams(){
  const el=document.getElementById('tl');
  if(!G.teams.length){el.innerHTML='<div style="color:var(--gray3);font-size:13px;font-weight:700;padding:8px 0">No teams added yet</div>';return;}
  el.innerHTML='';
  G.teams.forEach(t=>{
    const span=document.createElement('span');
    span.className='chip';
    span.textContent=t;
    const btn=document.createElement('button');
    btn.className='chip-del';
    btn.textContent='×';
    btn.addEventListener('click',()=>removeTeam(t));
    span.appendChild(btn);
    el.appendChild(span);
  });
}

// ── DIAMOND MANAGEMENT ────────────────────────────────────────────────────────
function addDiamond(){
  const newId=Math.max(0,...G.diamonds.map(d=>d.id))+1;
  G.diamonds.push({id:newId,name:'Diamond '+newId,lights:false,lightsCapable:true,active:true});
  saveData();
  renderDiamonds();
}
function removeDiamond(id){
  if(G.diamonds.filter(d=>d.active).length<=1){alert('Need at least one active diamond.');return;}
  G.diamonds=G.diamonds.filter(d=>d.id!==id);
  saveData();
  renderDiamonds();
}
function updateDiamondName(id,name){
  const d=G.diamonds.find(d=>d.id===id);
  if(d){ d.name=name; saveData(); }
}
function toggleDiamondActive(id){
  const d=G.diamonds.find(d=>d.id===id);
  if(!d)return;
  // Don't allow deactivating the last active diamond
  if(d.active && G.diamonds.filter(x=>x.active).length<=1){
    alert('Need at least one active diamond.');return;
  }
  d.active=!d.active;
  // If deactivating, also turn off lights
  if(!d.active) d.lights=false;
  saveData();
  renderDiamonds();
  renderRulesDiamonds();
  updateGptNotice();
}
function toggleDiamondLights(id){
  const d=G.diamonds.find(d=>d.id===id);
  if(d){
    if(d.lightsCapable===false){
      alert(`${d.name} has no lights infrastructure and cannot be enabled.`);
      return;
    }
    if(!d.active){
      alert(`${d.name} is inactive. Activate it first before toggling lights.`);
      return;
    }
    d.lights=!d.lights;
    saveData();
    renderDiamonds();
    renderRulesDiamonds();
    updateGptNotice();
  }
}
function renderDiamonds(){
  const el=document.getElementById('diamond-list');
  if(!el)return;

  // Separate into active and inactive groups for display
  const active=G.diamonds.filter(d=>d.active);
  const inactive=G.diamonds.filter(d=>!d.active);

  function renderRow(d){
    const capable=d.lightsCapable!==false;
    const isActive=d.active;

    // Active toggle button
    const activeBtn=`<button onclick="toggleDiamondActive(${d.id})"
        title="${isActive?'Click to deactivate this diamond':'Click to activate this diamond'}"
        style="padding:6px 12px;border-radius:5px;border:1.5px solid ${isActive?'var(--success,#27ae60)':'var(--border)'};background:${isActive?'#edf7f0':'var(--gray2)'};color:${isActive?'var(--success,#27ae60)':'var(--muted)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:var(--font)">
        ${isActive?'✅ Active':'⬜ Inactive'}
      </button>`;

    // Lights button — only shown when active
    const lightsBtn=!isActive
      ? '' // hidden when inactive
      : capable
        ? `<button onclick="toggleDiamondLights(${d.id})"
            style="padding:6px 12px;border-radius:5px;border:1.5px solid ${d.lights?'var(--navy)':'var(--border)'};background:${d.lights?'var(--navy)':'var(--white)'};color:${d.lights?'#fff':'var(--muted)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:var(--font)">
            ${d.lights?'💡 Lights':'🌙 No Lights'}
          </button>`
        : `<span style="padding:6px 12px;border-radius:5px;border:1.5px solid var(--border);background:var(--gray2);color:var(--gray3);font-size:12px;font-weight:700;white-space:nowrap;font-family:var(--font);display:inline-block" title="No lights infrastructure at this diamond">🚫 No Lights</span>`;

    const rowBg=isActive?'var(--white)':'var(--gray2)';
    const columns=isActive
      ? 'grid-template-columns:48px 1fr auto auto auto'
      : 'grid-template-columns:48px 1fr auto auto';

    return `
    <div style="display:grid;${columns};gap:8px;align-items:center;padding:8px 10px;background:${rowBg};border:1.5px solid var(--border);border-radius:6px;opacity:${isActive?'1':'0.6'}">
      <span style="font-family:var(--font);font-size:13px;font-weight:800;color:var(--muted);text-align:center">D${d.id}</span>
      <input type="text" value="${esc(d.name)}" placeholder="Diamond name"
        onchange="updateDiamondName(${d.id},this.value)"
        style="font-size:13px;font-weight:700;background:var(--white);border:1.5px solid var(--border);border-radius:5px;padding:6px 10px;color:var(--text);font-family:var(--font);outline:none" />
      ${activeBtn}
      ${lightsBtn}
      <button onclick="removeDiamond(${d.id})"
        style="padding:6px 10px;border-radius:5px;border:1.5px solid var(--border);background:var(--white);color:var(--muted);font-size:16px;cursor:pointer;line-height:1;font-family:var(--font)"
        title="Remove diamond">×</button>
    </div>`;
  }

  let html='';

  if(active.length){
    html+=`<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;color:var(--navy);margin-bottom:6px;margin-top:4px">✅ Active Diamonds (${active.length})</div>`;
    html+=active.map(renderRow).join('');
  }

  if(inactive.length){
    html+=`<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;color:var(--muted);margin-bottom:6px;margin-top:14px">⬜ Inactive Diamonds (${inactive.length}) — not used in scheduling</div>`;
    html+=inactive.map(renderRow).join('');
  }

  el.innerHTML=html;

  // Also update the rules panel summary
  const rd=document.getElementById('rules-diamonds');
  if(rd) rd.innerHTML=G.diamonds.filter(d=>d.active).map(d=>{
    const capable=d.lightsCapable!==false;
    if(!capable) return `<div style="font-size:13px;color:var(--text)">D${d.id} — ${esc(d.name)} — 🚫 No lights infrastructure (6:30 only)</div>`;
    return `<div style="font-size:13px;color:var(--text)">D${d.id} — ${esc(d.name)} — ${d.lights?'💡 Lights (DH capable)':'🌙 No Lights (6:30 only)'}</div>`;
  }).join('');

  updateGptNotice();
}
// renderDiamonds called in DOMContentLoaded after all functions are defined

// ── DAYS OF WEEK + SCHEDULE CALCULATOR ───────────────────────────────────────
const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function initDayChecks(){
  const el=document.getElementById('day-checks');
  if(!el)return;
  // Restore saved days, default to Tuesday (2)
  let savedDays=[2];
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw){const d=JSON.parse(raw);if(d.days&&d.days.length)savedDays=d.days;}
  }catch(e){}
  el.innerHTML=DAY_NAMES.map((name,i)=>{
    const checked=savedDays.includes(i)?'checked':'';
    const activeStyle='border-color:var(--navy);background:var(--navy);color:#fff';
    const inactiveStyle='border-color:var(--border);background:var(--white);color:var(--text)';
    return`<label id="daylabel-${i}" style="display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;padding:6px 13px;border-radius:6px;border:1.5px solid;cursor:pointer;user-select:none;transition:all 0.15s;${checked?activeStyle:inactiveStyle}">
      <input type="checkbox" value="${i}" ${checked} onchange="onDayChange(${i},this)" style="display:none"> ${name}
    </label>`;
  }).join('');
}

function onDayChange(i,cb){
  const lbl=document.getElementById('daylabel-'+i);
  if(lbl){
    if(cb.checked){
      lbl.style.borderColor='var(--navy)';lbl.style.background='var(--navy)';lbl.style.color='#fff';
    } else {
      lbl.style.borderColor='var(--border)';lbl.style.background='var(--white)';lbl.style.color='var(--text)';
    }
  }
  // Persist selected days
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    const d=raw?JSON.parse(raw):{};
    d.days=getSelectedDays();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(d));
  }catch(e){}
  updateGptNotice();
}

function getSelectedDays(){
  const checks=document.querySelectorAll('#day-checks input[type=checkbox]:checked');
  return Array.from(checks).map(c=>parseInt(c.value));
}

function getGameNights(startStr,endStr,days){
  if(!days||!days.length)days=[2];
  const[sy,sm,sd]=startStr.split('-').map(Number);
  const[ey,em,ed]=endStr.split('-').map(Number);
  const d=new Date(sy,sm-1,sd);
  const end=new Date(ey,em-1,ed);
  const result=[];
  while(d<=end){
    if(days.includes(d.getDay()))result.push(toDateStr(d));
    d.setDate(d.getDate()+1);
  }
  return result;
}

function updateGptNotice(){
  const noticeEl=document.getElementById('gpt-notice');
  if(!noticeEl)return;
  const gpt=parseInt(document.getElementById('gpt')?.value)||0;
  const cobyes=parseInt(document.getElementById('cobyes')?.value)||0;
  const tfaced=parseInt(document.getElementById('tfaced')?.value)||3;
  const t1=document.getElementById('time1')?.value||'6:30 PM';
  const t2=document.getElementById('time2')?.value||'8:15 PM';
  const ssEl=document.getElementById('ss');
  const seEl=document.getElementById('se');
  if(!ssEl||!seEl)return;
  const selectedDays=getSelectedDays();
  const leagueN=G.teams.filter(t=>t!==CROSSOVER).length;
  const nights=getGameNights(
    ssEl.value,
    seEl.value,
    selectedDays
  ).length;

  if(nights<1||selectedDays.length<1){
    noticeEl.innerHTML=`<div class="notice" style="color:var(--muted)">Select at least one game day.</div>`;return;
  }

  // Only use ACTIVE diamonds in calculator
  const activeDiamonds=G.diamonds.filter(d=>d.active);
  const dhDiamonds=activeDiamonds.filter(d=>d.lights&&d.id!==9);
  const singleDiamonds=activeDiamonds.filter(d=>!d.lights);
  const dhCount=dhDiamonds.length;
  const singleCount=singleDiamonds.length;

  // Matchup stats
  const uniquePairs=leagueN*(leagueN-1)/2;
  const lgGamesFromFaced=uniquePairs*tfaced;

  // League pair slots per night = DH diamonds + single diamonds (D9 is CO only)
  const lgPairSlotsPerNight=dhCount+singleCount;

  // Required nights
  const requiredNights=lgPairSlotsPerNight>0
    ?Math.round(uniquePairs*tfaced/lgPairSlotsPerNight)
    :0;
  const nightsMatch=nights===requiredNights&&requiredNights>0;

  // Games per team when season length is correct
  const coEach=requiredNights>0?requiredNights/leagueN:tfaced;
  const dhBonus=coEach*dhCount;
  const league630=requiredNights-coEach;
  const gamesPerTeam=Math.round(coEach+coEach+dhBonus+league630);

  // Total games per night
  const lgGamesPerNight=dhCount*2+singleCount;
  const coGamesPerNight=2;
  const totalGamesPerNight=lgGamesPerNight+coGamesPerNight;
  const totalGames=totalGamesPerNight*(nightsMatch?requiredNights:nights);
  const coTotalGames=coGamesPerNight*(nightsMatch?requiredNights:nights);
  const lgTotalGames=totalGames-coTotalGames;

  // Status
  let statusHtml,statusBg;
  if(!nightsMatch){
    const diff=requiredNights-nights;
    statusHtml=`<span style="color:var(--red);font-weight:800">✗ Season length mismatch</span> — `
      +`${tfaced}× times faced needs exactly <strong>${requiredNights}</strong> nights. `
      +`You have <strong>${nights}</strong>. `
      +(diff>0?`Add ${diff} more game nights.`:`Remove ${-diff} game nights.`);
    statusBg='#fff0f0';
  } else {
    statusHtml=`<span style="color:#27ae60;font-weight:800">✓ Ready — ${gamesPerTeam} games per team, every pair plays ${tfaced}×</span>`;
    statusBg='#edf7f0';
  }
  noticeEl.innerHTML=`
  <div style="border:1.5px solid var(--border);border-radius:8px;overflow:hidden;font-size:13px;margin-top:4px">
    <div style="background:var(--navy);color:#fff;padding:7px 12px;font-weight:800;font-size:11px;letter-spacing:0.8px;text-transform:uppercase">📊 Schedule Calculator</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--border)">
      <div style="padding:8px 12px;border-right:1px solid var(--border)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px">Your Nights</div>
        <div style="font-size:22px;font-weight:800;color:${nightsMatch?'var(--navy)':'var(--red)'};line-height:1.2">${nights}</div>
        <div style="font-size:11px;color:var(--muted)">Need ${requiredNights}</div>
      </div>
      <div style="padding:8px 12px;border-right:1px solid var(--border)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px">Games/Team</div>
        <div style="font-size:22px;font-weight:800;color:var(--navy);line-height:1.2">${gamesPerTeam}</div>
        <div style="font-size:11px;color:var(--muted)">${tfaced}× each opponent</div>
      </div>
      <div style="padding:8px 12px">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px">Total Games</div>
        <div style="font-size:22px;font-weight:800;color:var(--navy);line-height:1.2">${nightsMatch?totalGames:'—'}</div>
        <div style="font-size:11px;color:var(--muted)">${nightsMatch?`CO: ${coTotalGames} · League: ${lgTotalGames}`:''}</div>
      </div>
    </div>
    <div style="padding:8px 12px;border-bottom:1px solid var(--border)">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">Per Night · ${t1} / ${t2} · ${activeDiamonds.length} active diamonds</div>
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
        <div style="display:flex;justify-content:space-between"><span>${uniquePairs} unique pairs × ${tfaced}× each</span><strong>${lgGamesFromFaced} league games</strong></div>
        <div style="display:flex;justify-content:space-between;color:var(--muted)"><span>Required season length</span><strong style="color:var(--text)">${requiredNights} nights (${tfaced} × ${leagueN} teams)</strong></div>
      </div>
    </div>
    <div style="padding:8px 12px;background:${statusBg};font-size:13px">${statusHtml}</div>
  </div>`;
}


// ── CHAMPIONS ─────────────────────────────────────────────────────────────────
// podA = League Champion (top pod)
// podB = Tier B Champion (marked with * in display)
// champion = single-tier format (pre-pod era)
const CHAMPIONS = [
  { year:2026, podA:null, podB:null, note:'Season in progress' },
  { year:2025, podA:'Kibosh', podB:'JAFT' },
  { year:2024, podA:'Alcoballics', podB:'Steel City Sluggers' },
  { year:2023, podA:'Basic Pitches', podB:'Landon Longballers' },
  { year:2022, champion:'Alcoballics' },
  { year:2018, champion:'One Hit Wonders' },
  { year:2017, champion:'Stiff Competition' },
  { year:2016, champion:'Stiff Competition' },
  { year:2015, champion:'Stiff Competition' },
  { year:2014, champion:'Stiff Competition' },
  { year:2013, champion:'Institutes' },
  { year:2012, champion:'Stiff Competition' },
  { year:2011, champion:'Institutes' },
  { year:2010, champion:'Institutes' },
  { year:2009, champion:'Road Runners' },
  { year:2008, champion:'Institutes' },
  { year:2007, champion:'Dilligaf' },
  { year:2006, champion:'Institutes' },
  { year:2005, champion:'Institutes' },
  { year:2004, champion:"Assholes & Bitches" },
  { year:2003, champion:'Mars Metal Maniacs' },
  { year:2002, champion:'Admiral Inn' },
  { year:2001, champion:'Admiral Inn' },
  { year:2000, champion:'Mustangs' },
  { year:1999, champion:'Mustangs' },
  { year:1998, champion:'Road Runners' },
  { year:1997, champion:'Play It Again Sports' },
  { year:1996, champion:"Carrera's Mustangs" },
];

// 2023 season archive — all 110 regular season game results
const ARCHIVE_2023 = [
  {date:'2023-05-23',time:'6:30 PM',away:'Foul Poles',home:'Basic Pitches',diamond:'D12',as:8,hs:15},
  {date:'2023-05-23',time:'6:30 PM',away:'Alcoballics',home:'One Hit Wonders',diamond:'D13',as:22,hs:16},
  {date:'2023-05-23',time:'6:30 PM',away:'Landon Longballers',home:'JAFT',diamond:'D14',as:4,hs:6},
  {date:'2023-05-23',time:'6:30 PM',away:'Steel City Sluggers',home:'Wayco',diamond:'D5',as:5,hs:10},
  {date:'2023-05-23',time:'6:30 PM',away:'Kibosh',home:'Stiff Competition',diamond:'D9',as:16,hs:9},
  {date:'2023-05-23',time:'8:15 PM',away:'Kibosh',home:'Basic Pitches',diamond:'D12',as:17,hs:18},
  {date:'2023-05-23',time:'8:15 PM',away:'Foul Poles',home:'Stiff Competition',diamond:'D9',as:14,hs:7},
  {date:'2023-05-30',time:'6:30 PM',away:'Landon Longballers',home:'One Hit Wonders',diamond:'D12',as:16,hs:18},
  {date:'2023-05-30',time:'6:30 PM',away:'Foul Poles',home:'Kibosh',diamond:'D13',as:17,hs:18},
  {date:'2023-05-30',time:'6:30 PM',away:'Steel City Sluggers',home:'Stiff Competition',diamond:'D14',as:20,hs:13},
  {date:'2023-05-30',time:'6:30 PM',away:'Alcoballics',home:'Wayco',diamond:'D5',as:12,hs:17},
  {date:'2023-05-30',time:'6:30 PM',away:'Basic Pitches',home:'JAFT',diamond:'D9',as:18,hs:12},
  {date:'2023-05-30',time:'8:15 PM',away:'Foul Poles',home:'One Hit Wonders',diamond:'D12',as:11,hs:18},
  {date:'2023-05-30',time:'8:15 PM',away:'Landon Longballers',home:'JAFT',diamond:'D9',as:10,hs:14},
  {date:'2023-06-06',time:'6:30 PM',away:'Alcoballics',home:'Steel City Sluggers',diamond:'D12',as:9,hs:15},
  {date:'2023-06-06',time:'6:30 PM',away:'Foul Poles',home:'Stiff Competition',diamond:'D13',as:19,hs:21},
  {date:'2023-06-06',time:'6:30 PM',away:'Wayco',home:'JAFT',diamond:'D14',as:17,hs:15},
  {date:'2023-06-06',time:'6:30 PM',away:'Landon Longballers',home:'Basic Pitches',diamond:'D5',as:11,hs:4},
  {date:'2023-06-06',time:'6:30 PM',away:'One Hit Wonders',home:'Kibosh',diamond:'D9',as:8,hs:11},
  {date:'2023-06-06',time:'8:15 PM',away:'One Hit Wonders',home:'Steel City Sluggers',diamond:'D12',as:20,hs:21},
  {date:'2023-06-06',time:'8:15 PM',away:'Alcoballics',home:'Kibosh',diamond:'D9',as:10,hs:10},
  {date:'2023-06-13',time:'6:30 PM',away:'Stiff Competition',home:'Basic Pitches',diamond:'D12',as:8,hs:15},
  {date:'2023-06-13',time:'6:30 PM',away:'Steel City Sluggers',home:'Foul Poles',diamond:'D13',as:13,hs:11},
  {date:'2023-06-13',time:'6:30 PM',away:'One Hit Wonders',home:'Wayco',diamond:'D14',as:11,hs:8},
  {date:'2023-06-13',time:'6:30 PM',away:'Kibosh',home:'JAFT',diamond:'D5',as:21,hs:20},
  {date:'2023-06-13',time:'6:30 PM',away:'Alcoballics',home:'Landon Longballers',diamond:'D9',as:11,hs:10},
  {date:'2023-06-13',time:'8:15 PM',away:'Alcoballics',home:'Basic Pitches',diamond:'D12',as:14,hs:15},
  {date:'2023-06-13',time:'8:15 PM',away:'Stiff Competition',home:'Landon Longballers',diamond:'D9',as:7,hs:12},
  {date:'2023-06-20',time:'6:30 PM',away:'One Hit Wonders',home:'JAFT',diamond:'D12',as:9,hs:2},
  {date:'2023-06-20',time:'6:30 PM',away:'Foul Poles',home:'Alcoballics',diamond:'D13',as:14,hs:20},
  {date:'2023-06-20',time:'6:30 PM',away:'Landon Longballers',home:'Kibosh',diamond:'D14',as:20,hs:19},
  {date:'2023-06-20',time:'6:30 PM',away:'Stiff Competition',home:'Wayco',diamond:'D5',as:0,hs:7},
  {date:'2023-06-20',time:'6:30 PM',away:'Steel City Sluggers',home:'Basic Pitches',diamond:'D9',as:14,hs:19},
  {date:'2023-06-20',time:'8:15 PM',away:'Steel City Sluggers',home:'JAFT',diamond:'D12',as:19,hs:12},
  {date:'2023-06-20',time:'8:15 PM',away:'Wayco',home:'Basic Pitches',diamond:'D9',as:9,hs:10},
  {date:'2023-06-27',time:'6:30 PM',away:'Steel City Sluggers',home:'Landon Longballers',diamond:'D12',as:7,hs:7,wx:true},
  {date:'2023-06-27',time:'6:30 PM',away:'One Hit Wonders',home:'Basic Pitches',diamond:'D13',as:7,hs:7,wx:true},
  {date:'2023-06-27',time:'6:30 PM',away:'Stiff Competition',home:'JAFT',diamond:'D14',as:7,hs:7,wx:true},
  {date:'2023-06-27',time:'6:30 PM',away:'Alcoballics',home:'Foul Poles',diamond:'D5',as:7,hs:7,wx:true},
  {date:'2023-06-27',time:'6:30 PM',away:'Wayco',home:'Kibosh',diamond:'D9',as:7,hs:7,wx:true},
  {date:'2023-06-27',time:'8:15 PM',away:'Alcoballics',home:'Landon Longballers',diamond:'D12',as:7,hs:7,wx:true},
  {date:'2023-06-27',time:'8:15 PM',away:'Steel City Sluggers',home:'Kibosh',diamond:'D9',as:7,hs:7,wx:true},
  {date:'2023-07-04',time:'6:30 PM',away:'Stiff Competition',home:'One Hit Wonders',diamond:'D12',as:7,hs:7,wx:true},
  {date:'2023-07-04',time:'6:30 PM',away:'Steel City Sluggers',home:'Kibosh',diamond:'D13',as:7,hs:7,wx:true},
  {date:'2023-07-04',time:'6:30 PM',away:'JAFT',home:'Alcoballics',diamond:'D14',as:7,hs:7,wx:true},
  {date:'2023-07-04',time:'6:30 PM',away:'Foul Poles',home:'Landon Longballers',diamond:'D5',as:7,hs:7,wx:true},
  {date:'2023-07-04',time:'6:30 PM',away:'Basic Pitches',home:'Wayco',diamond:'D9',as:7,hs:7,wx:true},
  {date:'2023-07-04',time:'8:15 PM',away:'JAFT',home:'One Hit Wonders',diamond:'D12',as:7,hs:7,wx:true},
  {date:'2023-07-04',time:'8:15 PM',away:'Foul Poles',home:'Wayco',diamond:'D9',as:7,hs:7,wx:true},
  {date:'2023-07-11',time:'6:30 PM',away:'Foul Poles',home:'One Hit Wonders',diamond:'D12',as:10,hs:16},
  {date:'2023-07-11',time:'6:30 PM',away:'Alcoballics',home:'Basic Pitches',diamond:'D13',as:14,hs:15},
  {date:'2023-07-11',time:'6:30 PM',away:'Landon Longballers',home:'Stiff Competition',diamond:'D14',as:15,hs:8},
  {date:'2023-07-11',time:'6:30 PM',away:'Wayco',home:'Kibosh',diamond:'D5',as:8,hs:1},
  {date:'2023-07-11',time:'6:30 PM',away:'Steel City Sluggers',home:'JAFT',diamond:'D9',as:8,hs:6},
  {date:'2023-07-11',time:'8:15 PM',away:'Steel City Sluggers',home:'One Hit Wonders',diamond:'D12',as:9,hs:9},
  {date:'2023-07-11',time:'8:15 PM',away:'Wayco',home:'JAFT',diamond:'D9',as:8,hs:1},
  {date:'2023-07-18',time:'6:30 PM',away:'Stiff Competition',home:'Alcoballics',diamond:'D12',as:8,hs:15},
  {date:'2023-07-18',time:'6:30 PM',away:'Basic Pitches',home:'JAFT',diamond:'D13',as:16,hs:9},
  {date:'2023-07-18',time:'6:30 PM',away:'One Hit Wonders',home:'Steel City Sluggers',diamond:'D14',as:12,hs:5},
  {date:'2023-07-18',time:'6:30 PM',away:'Landon Longballers',home:'Wayco',diamond:'D5',as:3,hs:10},
  {date:'2023-07-18',time:'6:30 PM',away:'Kibosh',home:'Foul Poles',diamond:'D9',as:10,hs:10},
  {date:'2023-07-18',time:'8:15 PM',away:'Alcoballics',home:'Stiff Competition',diamond:'D12',as:20,hs:13},
  {date:'2023-07-18',time:'8:15 PM',away:'Foul Poles',home:'Kibosh',diamond:'D9',as:17,hs:12},
  {date:'2023-07-25',time:'6:30 PM',away:'Basic Pitches',home:'Foul Poles',diamond:'D12',as:10,hs:3},
  {date:'2023-07-25',time:'6:30 PM',away:'One Hit Wonders',home:'Alcoballics',diamond:'D13',as:15,hs:10},
  {date:'2023-07-25',time:'6:30 PM',away:'JAFT',home:'Landon Longballers',diamond:'D14',as:10,hs:17},
  {date:'2023-07-25',time:'6:30 PM',away:'Wayco',home:'Steel City Sluggers',diamond:'D5',as:8,hs:9},
  {date:'2023-07-25',time:'6:30 PM',away:'Stiff Competition',home:'Kibosh',diamond:'D9',as:10,hs:13},
  {date:'2023-07-25',time:'8:15 PM',away:'Foul Poles',home:'Basic Pitches',diamond:'D12',as:9,hs:16},
  {date:'2023-07-25',time:'8:15 PM',away:'Kibosh',home:'Stiff Competition',diamond:'D9',as:18,hs:16},
  {date:'2023-08-01',time:'6:30 PM',away:'One Hit Wonders',home:'Landon Longballers',diamond:'D12',as:12,hs:5},
  {date:'2023-08-01',time:'6:30 PM',away:'Basic Pitches',home:'Kibosh',diamond:'D13',as:18,hs:11},
  {date:'2023-08-01',time:'6:30 PM',away:'Stiff Competition',home:'Steel City Sluggers',diamond:'D14',as:7,hs:0},
  {date:'2023-08-01',time:'6:30 PM',away:'Wayco',home:'Alcoballics',diamond:'D5',as:12,hs:5},
  {date:'2023-08-01',time:'6:30 PM',away:'JAFT',home:'Foul Poles',diamond:'D9',as:18,hs:11},
  {date:'2023-08-01',time:'8:15 PM',away:'JAFT',home:'Landon Longballers',diamond:'D12',as:22,hs:15},
  {date:'2023-08-01',time:'8:15 PM',away:'Wayco',home:'Foul Poles',diamond:'D9',as:21,hs:17},
  {date:'2023-08-08',time:'6:30 PM',away:'Steel City Sluggers',home:'Alcoballics',diamond:'D12',as:8,hs:15},
  {date:'2023-08-08',time:'6:30 PM',away:'Stiff Competition',home:'Foul Poles',diamond:'D13',as:13,hs:9},
  {date:'2023-08-08',time:'6:30 PM',away:'JAFT',home:'Wayco',diamond:'D14',as:3,hs:10},
  {date:'2023-08-08',time:'6:30 PM',away:'Basic Pitches',home:'Landon Longballers',diamond:'D5',as:15,hs:8},
  {date:'2023-08-08',time:'6:30 PM',away:'One Hit Wonders',home:'Kibosh',diamond:'D9',as:15,hs:8},
  {date:'2023-08-08',time:'8:15 PM',away:'One Hit Wonders',home:'Alcoballics',diamond:'D12',as:8,hs:9},
  {date:'2023-08-15',time:'6:30 PM',away:'Basic Pitches',home:'Stiff Competition',diamond:'D12',as:7,hs:7,wx:true},
  {date:'2023-08-15',time:'6:30 PM',away:'Foul Poles',home:'Steel City Sluggers',diamond:'D13',as:7,hs:7,wx:true},
  {date:'2023-08-15',time:'6:30 PM',away:'Wayco',home:'One Hit Wonders',diamond:'D14',as:7,hs:7,wx:true},
  {date:'2023-08-15',time:'6:30 PM',away:'JAFT',home:'Kibosh',diamond:'D5',as:7,hs:7,wx:true},
  {date:'2023-08-15',time:'6:30 PM',away:'Landon Longballers',home:'Alcoballics',diamond:'D9',as:7,hs:7,wx:true},
  {date:'2023-08-15',time:'8:15 PM',away:'Landon Longballers',home:'Stiff Competition',diamond:'D12',as:7,hs:7,wx:true},
  {date:'2023-08-15',time:'8:15 PM',away:'Basic Pitches',home:'Alcoballics',diamond:'D9',as:7,hs:7,wx:true},
  {date:'2023-08-22',time:'6:30 PM',away:'Wayco',home:'Stiff Competition',diamond:'D12',as:16,hs:8},
  {date:'2023-08-22',time:'6:30 PM',away:'JAFT',home:'One Hit Wonders',diamond:'D13',as:15,hs:20},
  {date:'2023-08-22',time:'6:30 PM',away:'Kibosh',home:'Landon Longballers',diamond:'D14',as:15,hs:8},
  {date:'2023-08-22',time:'6:30 PM',away:'Alcoballics',home:'Foul Poles',diamond:'D5',as:8,hs:12},
  {date:'2023-08-22',time:'6:30 PM',away:'Basic Pitches',home:'Steel City Sluggers',diamond:'D9',as:16,hs:9},
  {date:'2023-08-22',time:'8:15 PM',away:'Basic Pitches',home:'Stiff Competition',diamond:'D12',as:9,hs:2},
  {date:'2023-08-22',time:'8:15 PM',away:'Wayco',home:'Steel City Sluggers',diamond:'D9',as:10,hs:10},
  {date:'2023-08-29',time:'6:30 PM',away:'Landon Longballers',home:'Steel City Sluggers',diamond:'D12',as:7,hs:14},
  {date:'2023-08-29',time:'6:30 PM',away:'Wayco',home:'Foul Poles',diamond:'D13',as:14,hs:9},
  {date:'2023-08-29',time:'6:30 PM',away:'JAFT',home:'Stiff Competition',diamond:'D14',as:15,hs:11},
  {date:'2023-08-29',time:'6:30 PM',away:'Basic Pitches',home:'One Hit Wonders',diamond:'D5',as:6,hs:7},
  {date:'2023-08-29',time:'6:30 PM',away:'Kibosh',home:'Alcoballics',diamond:'D9',as:4,hs:10},
  {date:'2023-08-29',time:'8:15 PM',away:'Kibosh',home:'Steel City Sluggers',diamond:'D12',as:5,hs:12},
  {date:'2023-09-05',time:'6:30 PM',away:'Stiff Competition',home:'One Hit Wonders',diamond:'D12',as:0,hs:7},
  {date:'2023-09-05',time:'6:30 PM',away:'Landon Longballers',home:'Foul Poles',diamond:'D13',as:11,hs:9},
  {date:'2023-09-05',time:'6:30 PM',away:'JAFT',home:'Alcoballics',diamond:'D14',as:8,hs:8},
  {date:'2023-09-05',time:'6:30 PM',away:'Kibosh',home:'Steel City Sluggers',diamond:'D5',as:13,hs:17},
  {date:'2023-09-05',time:'6:30 PM',away:'Basic Pitches',home:'Wayco',diamond:'D9',as:17,hs:13},
  {date:'2023-09-05',time:'8:15 PM',away:'JAFT',home:'One Hit Wonders',diamond:'D12',as:4,hs:11},
  {date:'2023-09-05',time:'8:15 PM',away:'Landon Longballers',home:'Wayco',diamond:'D9',as:14,hs:10},
];

// Count league championships per team (POD A = league champ, POD B = tier B only)
function champCounts(){
  const counts={};
  const podBCounts={};
  for(const row of CHAMPIONS){
    if(row.champion) counts[row.champion]=(counts[row.champion]||0)+1;
    if(row.podA)     counts[row.podA]=(counts[row.podA]||0)+1;
    if(row.podB)     podBCounts[row.podB]=(podBCounts[row.podB]||0)+1;
  }
  return {counts, podBCounts};
}

function renderChampions(){
  const el=document.getElementById('champ-content');
  if(!el) return;

  const {counts,podBCounts}=champCounts();
  const leaderboard=Object.entries(counts)
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));

  // Dynasty detection — 3+ consecutive wins (POD A / champion only)
  const dynasties=[];
  let streak=1;
  for(let i=1;i<CHAMPIONS.length;i++){
    const prev=CHAMPIONS[i-1],curr=CHAMPIONS[i];
    const prevChamp=prev.champion||prev.podA||'';
    const currChamp=curr.champion||curr.podA||'';
    if(prevChamp&&currChamp&&prevChamp===currChamp) streak++;
    else{
      if(streak>=3) dynasties.push({team:prevChamp,streak,endYear:CHAMPIONS[i-1].year});
      streak=1;
    }
  }

  const medals=['🥇','🥈','🥉'];

  // Leaderboard rows
  const lbRows=leaderboard.map(([team,wins],i)=>{
    const currentTeam=G.teams.filter(t=>t!=='CrossOver').includes(team);
    const podBWins=podBCounts[team]||0;
    return`<tr style="${currentTeam?'background:#f0f9ff':''}">
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:var(--muted);width:36px">${i<3?medals[i]:i+1}</td>
      <td style="padding:8px 12px;font-size:14px;font-weight:${currentTeam?'700':'500'};color:${currentTeam?'var(--navy)':'var(--text)'}">${esc(team)}${currentTeam?` <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:#dbeafe;color:#1e40af;margin-left:4px">2026</span>`:''}</td>
      <td style="padding:8px 12px;text-align:right;white-space:nowrap">
        ${'<span style="display:inline-block;width:10px;height:10px;background:var(--navy);border-radius:2px;margin-right:2px"></span>'.repeat(wins)}
        <span style="font-size:13px;font-weight:700;color:var(--navy);margin-left:4px">${wins}</span>
        ${podBWins?`<span style="font-size:11px;color:var(--muted);margin-left:4px">(+${podBWins} POD B*)</span>`:''}
      </td>
    </tr>`;
  }).join('');

  // Year-by-year rows
  const years=CHAMPIONS.map(c=>c.year).sort((a,b)=>a-b);
  const yearRows=CHAMPIONS.map(row=>{
    const isPodFormat=!!(row.podA||row.podB);
    const isCurrent=row.year===2026;
    const hasArchive=row.year===2023;

    if(isCurrent){
      return`<tr style="background:#f0fdf4">
        <td style="padding:10px 12px;font-size:15px;font-weight:800;color:var(--navy);width:60px">${row.year}</td>
        <td style="padding:10px 12px;font-size:13px;color:#16a34a;font-weight:600;font-style:italic" colspan="2">Season in progress ⚾</td>
      </tr>`;
    }

    if(isPodFormat){
      return`<tr>
        <td style="padding:10px 12px;font-size:15px;font-weight:800;color:var(--navy);width:60px">
          ${row.year}
          ${hasArchive?`<div style="font-size:9px;font-weight:600;color:var(--muted);margin-top:2px">ARCHIVE</div>`:''}
        </td>
        <td style="padding:10px 12px">
          <div style="display:flex;flex-direction:column;gap:4px">
            <div style="font-size:13px;font-weight:600">
              <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:#dbeafe;color:#1e40af;margin-right:6px">POD A</span>
              ${esc(row.podA)} <span style="font-size:11px;color:var(--muted);font-weight:400">League Champion</span>
            </div>
            <div style="font-size:13px;color:var(--muted)">
              <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:#fce7f3;color:#9d174d;margin-right:6px">POD B</span>
              ${esc(row.podB)}* <span style="font-size:11px;font-weight:400">Tier B Champion</span>
            </div>
          </div>
        </td>
        <td style="padding:10px 12px;text-align:right;font-size:18px">🏆🥈</td>
      </tr>`;
    }

    return`<tr>
      <td style="padding:10px 12px;font-size:15px;font-weight:800;color:var(--navy);width:60px">${row.year}</td>
      <td style="padding:10px 12px;font-size:15px;font-weight:700;color:var(--text)">${esc(row.champion)}</td>
      <td style="padding:10px 12px;text-align:right;font-size:18px">🏆</td>
    </tr>`;
  }).join('');

  // 2023 archive standings
  const archiveTeams={};
  for(const g of ARCHIVE_2023){
    if(!archiveTeams[g.home]) archiveTeams[g.home]={w:0,l:0,t:0,pts:0,rf:0,ra:0,gp:0};
    if(!archiveTeams[g.away]) archiveTeams[g.away]={w:0,l:0,t:0,pts:0,rf:0,ra:0,gp:0};
    archiveTeams[g.home].gp++; archiveTeams[g.away].gp++;
    archiveTeams[g.home].rf+=g.hs; archiveTeams[g.home].ra+=g.as;
    archiveTeams[g.away].rf+=g.as; archiveTeams[g.away].ra+=g.hs;
    if(g.wx){
      archiveTeams[g.home].t++;archiveTeams[g.home].pts++;
      archiveTeams[g.away].t++;archiveTeams[g.away].pts++;
    } else if(g.hs>g.as){
      archiveTeams[g.home].w++;archiveTeams[g.home].pts+=2;archiveTeams[g.away].l++;
    } else if(g.as>g.hs){
      archiveTeams[g.away].w++;archiveTeams[g.away].pts+=2;archiveTeams[g.home].l++;
    } else {
      archiveTeams[g.home].t++;archiveTeams[g.home].pts++;
      archiveTeams[g.away].t++;archiveTeams[g.away].pts++;
    }
  }
  const archiveRanked=Object.entries(archiveTeams).sort((a,b)=>b[1].pts-a[1].pts||(b[1].rf-b[1].ra)-(a[1].rf-a[1].ra));
  const archiveRows=archiveRanked.map(([team,s],i)=>`
    <tr style="${i===0?'background:#f0f9ff':''}">
      <td style="padding:6px 10px;font-size:12px;color:var(--muted);width:28px;font-family:var(--mono)">${i+1}</td>
      <td style="padding:6px 10px;font-size:13px;font-weight:${i===0?'700':'500'};color:${i===0?'var(--navy)':'var(--text)'}">${esc(team)}${i===0?' 🏆':''}</td>
      <td style="padding:6px 10px;font-family:var(--mono);font-size:12px;text-align:center">${s.w}-${s.l}-${s.t}</td>
      <td style="padding:6px 10px;font-family:var(--mono);font-size:12px;font-weight:700;color:var(--navy);text-align:center">${s.pts}</td>
      <td style="padding:6px 10px;font-family:var(--mono);font-size:12px;color:var(--muted);text-align:center">${s.rf}-${s.ra}</td>
    </tr>`).join('');

  const wxNights=[...new Set(ARCHIVE_2023.filter(g=>g.wx).map(g=>g.date))];
  const gapNote=[];
  for(let i=1;i<years.length;i++){
    if(years[i]-years[i-1]>1) gapNote.push(`${years[i-1]+1}–${years[i]-1}`);
  }

  el.innerHTML=`
    <div class="card" style="background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;margin-bottom:0;border-radius:var(--r) var(--r) 0 0">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.6;margin-bottom:4px">Hamilton Classic Co-Ed Softball League</div>
          <div style="font-size:26px;font-weight:900;letter-spacing:-0.5px">Hall of Champions</div>
          <div style="font-size:13px;opacity:0.65;margin-top:4px">${CHAMPIONS.filter(c=>c.champion||c.podA).length} seasons recorded · Est. 1996</div>
        </div>
        <div style="margin-left:auto;text-align:right;flex-shrink:0"><div style="font-size:40px;line-height:1">🏆</div></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:0;border-top:none;border-radius:0;background:var(--gray1)">
      <div style="font-size:12px;color:var(--muted);line-height:1.6">
        <strong>🏆 League Champion</strong> — POD A winner or pre-pod era champion · counts toward the all-time leaderboard<br>
        <strong>🥈 *POD B Champion</strong> — Tier B winner in seasons using a two-pod format · shown separately, does <em>not</em> count toward the all-time leaderboard<br>
        <strong>Weather nights</strong> — games called due to rain are recorded as 7–7 ties per league rules
      </div>
    </div>

    <div class="card">
      <div class="card-title">Year by Year</div>
      ${gapNote.length?`<div class="notice" style="margin-bottom:12px">No records found for: ${gapNote.join(', ')}</div>`:''}
      <table style="width:100%;border-collapse:collapse;border-radius:var(--r-sm);overflow:hidden">
        <thead><tr style="background:var(--gray1)">
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);width:60px">Year</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted)">Champion</th>
          <th style="padding:8px 12px;width:40px"></th>
        </tr></thead>
        <tbody style="border-top:1px solid var(--border)">${yearRows}</tbody>
      </table>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px;margin-bottom:12px">
      <div class="card" style="border-radius:var(--r)">
        <div class="card-title">All-Time Leaderboard <span style="font-size:11px;font-weight:400;color:var(--muted)">(League Champions only)</span></div>
        <table style="width:100%;border-collapse:collapse">${lbRows}</table>
      </div>
      <div class="card" style="border-radius:var(--r)">
        <div class="card-title">Fast Facts</div>
        <div style="display:grid;gap:10px">
          <div style="padding:10px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-bottom:3px">Most Titles</div>
            <div style="font-size:16px;font-weight:800;color:var(--navy)">${leaderboard[0]?esc(leaderboard[0][0]):''}</div>
            <div style="font-size:12px;color:var(--muted)">${leaderboard[0]?leaderboard[0][1]+' championship'+(leaderboard[0][1]>1?'s':''):''}</div>
          </div>
          <div style="padding:10px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-bottom:3px">Longest Dynasty</div>
            ${dynasties.length
              ?`<div style="font-size:16px;font-weight:800;color:var(--navy)">${esc(dynasties.sort((a,b)=>b.streak-a.streak)[0].team)}</div>
                 <div style="font-size:12px;color:var(--muted)">${dynasties.sort((a,b)=>b.streak-a.streak)[0].streak} consecutive titles</div>`
              :`<div style="font-size:13px;color:var(--muted)">No 3+ year dynasty on record</div>`}
          </div>
          <div style="padding:10px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-bottom:3px">Seasons Recorded</div>
            <div style="font-size:16px;font-weight:800;color:var(--navy)">${CHAMPIONS.filter(c=>c.champion||c.podA).length}</div>
            <div style="font-size:12px;color:var(--muted)">from ${Math.min(...years)} to ${Math.max(...years)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📦 2023 Season Archive <span style="font-size:11px;font-weight:400;color:var(--muted)">— ${ARCHIVE_2023.length} games · ${wxNights.length} weather night${wxNights.length!==1?'s':''}</span></div>
      <div class="notice" style="margin-bottom:12px">Full regular season results from the 2023 HCCSL season. POD A champion: <strong>Basic Pitches</strong> · POD B champion: <strong>Landon Longballers*</strong></div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:var(--gray1)">
          <th style="padding:6px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);width:28px">#</th>
          <th style="padding:6px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted)">Team</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted)">W-L-T</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted)">PTS</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted)">RF-RA</th>
        </tr></thead>
        <tbody style="border-top:1px solid var(--border)">${archiveRows}</tbody>
      </table>
    </div>
  `;
}
