// ── DATA ──────────────────────────────────────────────────────────────────────
const CAP=7;
const STORAGE_KEY='hccsl_v2';  // bumped from hccsl_2026 so old cache doesn't clobber champions
const MONTH_NAMES=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
function DIAMONDS(){ return getDiamondIds(); }

// Historical champions seed — merged into G.champions on first load if absent
const CHAMPIONS_SEED = [
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
  playoffs:{seeded:false,podA:[],podB:[],games:{},semis:{podA:{},podB:{}},finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}},
  // ── Multi-season fields ────────────────────────────────────────────────────
  currentSeason: 2026,
  champions: null,        // populated from seed on applyData if null
  seasonArchive: {}       // { "2025": { sched, scores, playoffs, teams, ss, se }, ... }
};
const CROSSOVER='CrossOver';
let hc={};
let schedFilterTeam=null;

function getDiamonds(){ return G.diamonds; }
function getDiamondIds(){ return G.diamonds.filter(d=>d.active).map(d=>d.id); }
function getDiamondName(id){ const d=G.diamonds.find(d=>d.id===id); return d?d.name:'D'+id; }
function isDiamondLit(id){ const d=G.diamonds.find(d=>d.id===id); return d?d.lights:false; }

// ── UTILS ─────────────────────────────────────────────────────────────────────
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toDateStr(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function fmtDate(s){
  const[y,m,d]=s.split('-').map(Number);
  const dt=new Date(y,m-1,d);
  return dt.toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
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
  saveData();renderDiamonds();
}
function removeDiamond(id){
  if(G.diamonds.filter(d=>d.active).length<=1){alert('Need at least one active diamond.');return;}
  G.diamonds=G.diamonds.filter(d=>d.id!==id);
  saveData();renderDiamonds();
}
function updateDiamondName(id,name){
  const d=G.diamonds.find(d=>d.id===id);
  if(d){ d.name=name; saveData(); }
}
function toggleDiamondActive(id){
  const d=G.diamonds.find(d=>d.id===id);
  if(!d)return;
  if(d.active && G.diamonds.filter(x=>x.active).length<=1){
    alert('Need at least one active diamond.');return;
  }
  d.active=!d.active;
  saveData();renderDiamonds();
}
function toggleDiamondLights(id){
  const d=G.diamonds.find(d=>d.id===id);
  if(!d||!d.lightsCapable){alert('No lights infrastructure on this diamond.');return;}
  d.lights=!d.lights;
  saveData();renderDiamonds();updateGptNotice();
}
function renderDiamonds(){
  const el=document.getElementById('diamond-list');
  if(!el)return;
  el.innerHTML=G.diamonds.map(d=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:${d.active?'var(--white)':'var(--gray1)'};border:1.5px solid ${d.active?'var(--navy)':'var(--border)'};border-radius:var(--r-sm)">
      <input type="checkbox" ${d.active?'checked':''} onchange="toggleDiamondActive(${d.id})" title="Active" style="width:15px;height:15px;cursor:pointer;accent-color:var(--navy)"/>
      <input type="text" value="${esc(d.name)}" onchange="updateDiamondName(${d.id},this.value)" style="flex:1;border:none;background:transparent;font-size:13px;font-weight:600;color:var(--navy);outline:none;min-width:0"/>
      <button onclick="toggleDiamondLights(${d.id})" style="font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid ${d.lights?'var(--navy)':'var(--border)'};background:${d.lights?'var(--navy)':'transparent'};color:${d.lights?'#fff':'var(--muted)'};cursor:${d.lightsCapable?'pointer':'not-allowed'};opacity:${d.lightsCapable?1:0.4}" ${d.lightsCapable?'':'disabled title="No lights infrastructure"'}>
        ${d.lights?'💡 Lights':'🌙 No Lights'}
      </button>
      <button onclick="removeDiamond(${d.id})" class="chip-del" style="margin-left:4px">×</button>
    </div>
    <div style="font-size:11px;color:var(--muted);padding:0 4px">${d.active?(d.lights?'💡 Lights (DH capable)':'🌙 No Lights (6:30 only)'):'Inactive'}</div>
  `).join('');
  updateGptNotice();
}

// ── DAYS OF WEEK + SCHEDULE CALCULATOR ───────────────────────────────────────
const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function initDayChecks(){
  const el=document.getElementById('day-checks');
  if(!el)return;
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
function getSelectedDays(){
  const checks=document.querySelectorAll('#day-checks input[type=checkbox]:checked');
  return Array.from(checks).map(c=>parseInt(c.value));
}
function getGameNights(startStr,endStr,days){
  if(!days||!days.length)return[];
  const nights=[];
  const[sy,sm,sd]=startStr.split('-').map(Number);
  const[ey,em,ed]=endStr.split('-').map(Number);
  let cur=new Date(sy,sm-1,sd);
  const end=new Date(ey,em-1,ed);
  while(cur<=end){
    if(days.includes(cur.getDay()))nights.push(toDateStr(cur));
    cur.setDate(cur.getDate()+1);
  }
  return nights;
}
function updateGptNotice(){
  const el=document.getElementById('gpt-notice');
  if(!el)return;
  const ss=document.getElementById('ss')?.value||'';
  const se=document.getElementById('se')?.value||'';
  const days=getSelectedDays();
  if(!ss||!se||!days.length){el.innerHTML='';return;}
  const nights=getGameNights(ss,se,days).length;
  const leagueN=G.teams.filter(t=>t!==CROSSOVER).length;
  const activeDiamonds=G.diamonds.filter(d=>d.active);
  const d9=activeDiamonds.find(d=>d.id===9);
  const dhDiamonds=activeDiamonds.filter(d=>d.id!==9&&d.lights);
  const singleDiamonds=activeDiamonds.filter(d=>d.id!==9&&!d.lights);
  const leagueSlotsPerNight=2*dhDiamonds.length+singleDiamonds.length;
  const leaguePairsPerNight=leagueSlotsPerNight;
  const totalGamesPerNight=2+(2*dhDiamonds.length)+singleDiamonds.length;
  const uniquePairs=leagueN*(leagueN-1)/2;
  const tfacedEl=document.getElementById('tf');
  const tfaced=tfacedEl?parseInt(tfacedEl.value)||2:2;
  const lgGamesFromFaced=uniquePairs*tfaced;
  const requiredNights=Math.ceil(lgGamesFromFaced/leaguePairsPerNight);
  const nightsMatch=nights>=requiredNights;
  const gamesPerTeam=leagueSlotsPerNight>0?Math.round(lgGamesFromFaced*2/leagueN):0;
  const totalGames=nights>0&&leagueSlotsPerNight>0?nights*totalGamesPerNight:0;
  const lgTotalGames=nights*leaguePairsPerNight;
  const coTotalGames=d9?nights*2:0;
  const t1=`${leagueSlotsPerNight} league slot${leagueSlotsPerNight!==1?'s':''}/night`;
  const t2=`${d9?'1 CrossOver DH':'no D9'}`;
  const statusBg=nightsMatch?'#f0fdf4':'#fef9c3';
  const statusHtml=nightsMatch
    ?`<span style="color:#16a34a;font-weight:700">✓ ${nights} nights — enough for ${leagueN} teams × ${tfaced}× (${requiredNights} needed)</span>`
    :`<span style="color:#92400e;font-weight:700">⚠ ${nights} nights — need ${requiredNights} for ${leagueN} teams × ${tfaced}×</span>`;
  el.innerHTML=`<div style="border:1.5px solid var(--border);border-radius:var(--r-sm);overflow:hidden;margin-bottom:10px">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--border)">
      <div style="padding:8px 12px;border-right:1px solid var(--border)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px">Game Nights</div>
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

// ── CHAMPIONS (cloud-backed, seeded from CHAMPIONS_SEED) ─────────────────────
function getChampions(){
  return G.champions || CHAMPIONS_SEED;
}

function champCounts(){
  const counts={};
  const podBCounts={};
  for(const row of getChampions()){
    if(row.champion) counts[row.champion]=(counts[row.champion]||0)+1;
    if(row.podA)     counts[row.podA]=(counts[row.podA]||0)+1;
    if(row.podB)     podBCounts[row.podB]=(podBCounts[row.podB]||0)+1;
  }
  return {counts, podBCounts};
}

// ── ADMIN: Record Champions ───────────────────────────────────────────────────
function recordChampions(){
  if(!checkAdmin()) return;
  const yr=parseInt(document.getElementById('champ-year')?.value||G.currentSeason);
  const podA=(document.getElementById('champ-poda')?.value||'').trim();
  const podB=(document.getElementById('champ-podb')?.value||'').trim();
  if(!podA){alert('POD A champion is required.');return;}
  const champs=getChampions().filter(c=>c.year!==yr);  // remove existing entry for year
  champs.unshift({year:yr,podA:podA||null,podB:podB||null});
  champs.sort((a,b)=>b.year-a.year);
  G.champions=champs;
  saveData();
  renderChampionAdminUI();
  showToast(`🏆 ${yr} Champions saved!`);
}

function renderChampionAdminUI(){
  const el=document.getElementById('champ-admin-list');
  if(!el) return;
  const champs=getChampions().filter(c=>c.podA||c.champion);
  el.innerHTML=champs.slice(0,5).map(c=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--gray1);border-radius:var(--r-sm);font-size:13px">
      <strong style="color:var(--navy);width:40px">${c.year}</strong>
      <span style="flex:1">${esc(c.podA||c.champion||'—')}</span>
      ${c.podB?`<span style="color:var(--muted);font-size:11px">POD B: ${esc(c.podB)}</span>`:''}
    </div>`).join('');
}

// ── ADMIN: Start New Season ───────────────────────────────────────────────────
function startNewSeason(){
  if(!checkAdmin()) return;
  const newYearStr=(document.getElementById('new-season-year')?.value||'').trim();
  const newYear=parseInt(newYearStr);
  if(!newYear||newYear<2000||newYear>2100){alert('Enter a valid season year (e.g. 2027).');return;}
  if(newYear===G.currentSeason){alert(`Already in the ${G.currentSeason} season.`);return;}

  const podA=(document.getElementById('new-season-champ-poda')?.value||'').trim();
  const podB=(document.getElementById('new-season-champ-podb')?.value||'').trim();

  const msg=`Start NEW ${newYear} season?\n\n` +
    `This will:\n` +
    `• Archive the ${G.currentSeason} schedule & scores (preserved forever)\n` +
    (podA?`• Record ${G.currentSeason} POD A champion: ${podA}\n`:'') +
    (podB?`• Record ${G.currentSeason} POD B champion: ${podB}\n`:'') +
    `• Clear the current schedule, scores & playoffs\n` +
    `• Set current season to ${newYear}\n\n` +
    `Champions history and all archives are kept.\nThis cannot be undone.`;

  if(!confirm(msg)) return;

  // 1. Archive current season
  const archiveKey=String(G.currentSeason);
  G.seasonArchive[archiveKey]={
    season: G.currentSeason,
    teams:  [...G.teams],
    sched:  G.sched.map(g=>({...g})),
    scores: {...G.scores},
    playoffs: JSON.parse(JSON.stringify(G.playoffs)),
    ss: document.getElementById('ss')?.value||'',
    se: document.getElementById('se')?.value||''
  };

  // 2. Record champions for outgoing year if provided
  if(podA){
    const champs=getChampions().filter(c=>c.year!==G.currentSeason);
    champs.unshift({year:G.currentSeason,podA:podA||null,podB:podB||null});
    champs.sort((a,b)=>b.year-a.year);
    G.champions=champs;
  }

  // 3. Ensure new year has an "in progress" entry in champions
  const existingNew=getChampions().find(c=>c.year===newYear);
  if(!existingNew){
    const champs=G.champions||CHAMPIONS_SEED.slice();
    champs.unshift({year:newYear,podA:null,podB:null,note:'Season in progress'});
    champs.sort((a,b)=>b.year-a.year);
    G.champions=champs;
  }

  // 4. Reset live season data
  G.currentSeason=newYear;
  G.sched=[];
  G.scores={};
  G.playoffs={seeded:false,podA:[],podB:[],games:{},semis:{podA:{},podB:{}},finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}};

  // 5. Update season date fields to next year (same month/day pattern)
  const ss=document.getElementById('ss');
  const se=document.getElementById('se');
  if(ss) ss.value=ss.value.replace(/^\d{4}/,String(newYear));
  if(se) se.value=se.value.replace(/^\d{4}/,String(newYear));

  // 6. Update visible header
  updateSeasonHeader();

  saveData();
  renderSched();
  renderStandings();
  renderStats();
  renderPlayoffs();
  renderChampions();
  showToast(`✅ ${newYear} season started! ${archiveKey} archived.`);
  location.reload();
}

function updateSeasonHeader(){
  const sub=document.querySelector('.header-sub');
  if(sub) sub.textContent=`Turner Park · Tuesday Nights · ${G.currentSeason} Season`;
}

// ── CHAMPIONS TAB RENDER ──────────────────────────────────────────────────────
// 2023 season archive — all 110 regular season game results
const ARCHIVE_2023 = [
  {date:'2023-05-23',time:'6:30 PM',away:'Foul Poles',home:'Basic Pitches',diamond:'D12',as:8,hs:15},
  {date:'2023-05-23',time:'6:30 PM',away:'Alcoballics',home:'One Hit Wonders',diamond:'D13',as:22,hs:16},
  {date:'2023-05-23',time:'6:30 PM',away:'Landon Longballers',home:'JAFT',diamond:'D14',as:4,hs:6},
  {date:'2023-05-23',time:'6:30 PM',away:'Steel City Sluggers',home:'Wayco',diamond:'D5',as:12,hs:11},
  {date:'2023-05-23',time:'6:30 PM',away:'Kibosh',home:'Stiff Competition',diamond:'D9',as:8,hs:9},
  {date:'2023-05-23',time:'8:15 PM',away:'Kibosh',home:'Foul Poles',diamond:'D12',as:9,hs:7},
  {date:'2023-05-23',time:'8:15 PM',away:'Basic Pitches',home:'Steel City Sluggers',diamond:'D9',as:7,hs:11},
  {date:'2023-05-30',time:'6:30 PM',away:'JAFT',home:'Stiff Competition',diamond:'D12',as:10,hs:11},
  {date:'2023-05-30',time:'6:30 PM',away:'Steel City Sluggers',home:'Foul Poles',diamond:'D13',as:15,hs:5},
  {date:'2023-05-30',time:'6:30 PM',away:'One Hit Wonders',home:'Wayco',diamond:'D14',as:7,hs:8},
  {date:'2023-05-30',time:'6:30 PM',away:'Basic Pitches',home:'Alcoballics',diamond:'D5',as:6,hs:11},
  {date:'2023-05-30',time:'6:30 PM',away:'Landon Longballers',home:'Kibosh',diamond:'D9',as:11,hs:5},
  {date:'2023-05-30',time:'8:15 PM',away:'JAFT',home:'Wayco',diamond:'D12',as:12,hs:7},
  {date:'2023-05-30',time:'8:15 PM',away:'Landon Longballers',home:'Stiff Competition',diamond:'D9',as:9,hs:5},
  {date:'2023-06-06',time:'6:30 PM',away:'Kibosh',home:'Wayco',diamond:'D12',as:9,hs:6},
  {date:'2023-06-06',time:'6:30 PM',away:'Alcoballics',home:'JAFT',diamond:'D13',as:7,hs:10},
  {date:'2023-06-06',time:'6:30 PM',away:'Basic Pitches',home:'Stiff Competition',diamond:'D14',as:4,hs:14},
  {date:'2023-06-06',time:'6:30 PM',away:'One Hit Wonders',home:'Steel City Sluggers',diamond:'D5',as:9,hs:15},
  {date:'2023-06-06',time:'6:30 PM',away:'Foul Poles',home:'Landon Longballers',diamond:'D9',as:10,hs:12},
  {date:'2023-06-06',time:'8:15 PM',away:'Kibosh',home:'One Hit Wonders',diamond:'D12',as:10,hs:9},
  {date:'2023-06-06',time:'8:15 PM',away:'Foul Poles',home:'Wayco',diamond:'D9',as:8,hs:6},
  {date:'2023-06-13',time:'6:30 PM',away:'Alcoballics',home:'Stiff Competition',diamond:'D12',as:11,hs:12},
  {date:'2023-06-13',time:'6:30 PM',away:'Landon Longballers',home:'Steel City Sluggers',diamond:'D13',as:13,hs:11},
  {date:'2023-06-13',time:'6:30 PM',away:'One Hit Wonders',home:'JAFT',diamond:'D14',as:4,hs:13},
  {date:'2023-06-13',time:'6:30 PM',away:'Wayco',home:'Kibosh',diamond:'D5',as:6,hs:12},
  {date:'2023-06-13',time:'6:30 PM',away:'Basic Pitches',home:'Foul Poles',diamond:'D9',as:5,hs:11},
  {date:'2023-06-13',time:'8:15 PM',away:'Alcoballics',home:'Landon Longballers',diamond:'D12',as:16,hs:10},
  {date:'2023-06-13',time:'8:15 PM',away:'Wayco',home:'Basic Pitches',diamond:'D9',as:8,hs:14},
  {date:'2023-06-20',time:'6:30 PM',away:'Stiff Competition',home:'Kibosh',diamond:'D12',as:5,hs:10},
  {date:'2023-06-20',time:'6:30 PM',away:'JAFT',home:'Basic Pitches',diamond:'D13',as:9,hs:11},
  {date:'2023-06-20',time:'6:30 PM',away:'Foul Poles',home:'Alcoballics',diamond:'D14',as:8,hs:5},
  {date:'2023-06-20',time:'6:30 PM',away:'Steel City Sluggers',home:'One Hit Wonders',diamond:'D5',as:5,hs:11},
  {date:'2023-06-20',time:'6:30 PM',away:'Wayco',home:'Landon Longballers',diamond:'D9',as:12,hs:9},
  {date:'2023-06-20',time:'8:15 PM',away:'Stiff Competition',home:'Steel City Sluggers',diamond:'D12',as:9,hs:11},
  {date:'2023-06-20',time:'8:15 PM',away:'JAFT',home:'Foul Poles',diamond:'D9',as:8,hs:12},
  {date:'2023-06-27',time:'6:30 PM',away:'One Hit Wonders',home:'Alcoballics',diamond:'D12',as:5,hs:13},
  {date:'2023-06-27',time:'6:30 PM',away:'Kibosh',home:'JAFT',diamond:'D13',as:8,hs:9},
  {date:'2023-06-27',time:'6:30 PM',away:'Landon Longballers',home:'Foul Poles',diamond:'D14',as:12,hs:8},
  {date:'2023-06-27',time:'6:30 PM',away:'Stiff Competition',home:'Wayco',diamond:'D5',as:7,hs:9},
  {date:'2023-06-27',time:'6:30 PM',away:'Basic Pitches',home:'Steel City Sluggers',diamond:'D9',as:14,hs:11},
  {date:'2023-06-27',time:'8:15 PM',away:'One Hit Wonders',home:'Landon Longballers',diamond:'D12',as:10,hs:13},
  {date:'2023-06-27',time:'8:15 PM',away:'Kibosh',home:'Basic Pitches',diamond:'D9',as:11,hs:10},
  {date:'2023-07-04',time:'6:30 PM',away:'Foul Poles',home:'Stiff Competition',diamond:'D12',as:8,hs:10},
  {date:'2023-07-04',time:'6:30 PM',away:'Alcoballics',home:'Wayco',diamond:'D13',as:12,hs:6},
  {date:'2023-07-04',time:'6:30 PM',away:'Steel City Sluggers',home:'JAFT',diamond:'D14',as:9,hs:11},
  {date:'2023-07-04',time:'6:30 PM',away:'One Hit Wonders',home:'Kibosh',diamond:'D5',as:5,hs:8},
  {date:'2023-07-04',time:'6:30 PM',away:'Landon Longballers',home:'Basic Pitches',diamond:'D9',as:7,hs:10},
  {date:'2023-07-04',time:'8:15 PM',away:'Foul Poles',home:'JAFT',diamond:'D12',as:11,hs:9},
  {date:'2023-07-04',time:'8:15 PM',away:'Alcoballics',home:'Steel City Sluggers',diamond:'D9',as:9,hs:12},
  {date:'2023-07-11',time:'6:30 PM',away:'Wayco',home:'One Hit Wonders',diamond:'D12',as:8,hs:9},
  {date:'2023-07-11',time:'6:30 PM',away:'Stiff Competition',home:'Landon Longballers',diamond:'D13',as:4,hs:13},
  {date:'2023-07-11',time:'6:30 PM',away:'JAFT',home:'Kibosh',diamond:'D14',as:12,hs:14},
  {date:'2023-07-11',time:'6:30 PM',away:'Basic Pitches',home:'Alcoballics',diamond:'D5',as:11,hs:9},
  {date:'2023-07-11',time:'6:30 PM',away:'Foul Poles',home:'Steel City Sluggers',diamond:'D9',as:8,hs:13},
  {date:'2023-07-11',time:'8:15 PM',away:'Wayco',home:'Stiff Competition',diamond:'D12',as:7,hs:10},
  {date:'2023-07-11',time:'8:15 PM',away:'JAFT',home:'Alcoballics',diamond:'D9',as:8,hs:14},
  {date:'2023-07-18',time:'6:30 PM',away:'Steel City Sluggers',home:'Kibosh',diamond:'D12',as:6,hs:9},
  {date:'2023-07-18',time:'6:30 PM',away:'One Hit Wonders',home:'Foul Poles',diamond:'D13',as:6,hs:11},
  {date:'2023-07-18',time:'6:30 PM',away:'Alcoballics',home:'Basic Pitches',diamond:'D14',as:9,hs:13},
  {date:'2023-07-18',time:'6:30 PM',away:'Wayco',home:'JAFT',diamond:'D5',as:9,hs:8},
  {date:'2023-07-18',time:'6:30 PM',away:'Stiff Competition',home:'Basic Pitches',diamond:'D9',as:5,hs:11},
  {date:'2023-07-18',time:'8:15 PM',away:'Steel City Sluggers',home:'Foul Poles',diamond:'D12',as:8,hs:10},
  {date:'2023-07-18',time:'8:15 PM',away:'One Hit Wonders',home:'Stiff Competition',diamond:'D9',as:9,hs:5},
  {date:'2023-07-25',time:'6:30 PM',away:'Alcoballics',home:'Kibosh',diamond:'D12',as:10,hs:14},
  {date:'2023-07-25',time:'6:30 PM',away:'JAFT',home:'Landon Longballers',diamond:'D13',as:7,hs:12},
  {date:'2023-07-25',time:'6:30 PM',away:'Basic Pitches',home:'One Hit Wonders',diamond:'D14',as:9,hs:11},
  {date:'2023-07-25',time:'6:30 PM',away:'Foul Poles',home:'Wayco',diamond:'D5',as:8,hs:10},
  {date:'2023-07-25',time:'6:30 PM',away:'Stiff Competition',home:'Steel City Sluggers',diamond:'D9',as:8,hs:13},
  {date:'2023-07-25',time:'8:15 PM',away:'Alcoballics',home:'JAFT',diamond:'D12',as:11,hs:8},
  {date:'2023-07-25',time:'8:15 PM',away:'Basic Pitches',home:'Foul Poles',diamond:'D9',as:11,hs:9},
  {date:'2023-08-01',time:'6:30 PM',away:'Kibosh',home:'Landon Longballers',diamond:'D12',as:9,hs:12},
  {date:'2023-08-01',time:'6:30 PM',away:'Wayco',home:'Alcoballics',diamond:'D13',as:5,hs:13},
  {date:'2023-08-01',time:'6:30 PM',away:'JAFT',home:'One Hit Wonders',diamond:'D14',as:9,hs:5},
  {date:'2023-08-01',time:'6:30 PM',away:'Steel City Sluggers',home:'Stiff Competition',diamond:'D5',as:12,hs:8},
  {date:'2023-08-01',time:'6:30 PM',away:'Foul Poles',home:'Basic Pitches',diamond:'D9',as:7,hs:12},
  {date:'2023-08-01',time:'8:15 PM',away:'Kibosh',home:'Wayco',diamond:'D12',as:12,hs:8},
  {date:'2023-08-01',time:'8:15 PM',away:'JAFT',home:'Steel City Sluggers',diamond:'D9',as:11,hs:14},
  {date:'2023-08-08',time:'6:30 PM',away:'Landon Longballers',home:'One Hit Wonders',diamond:'D12',as:10,hs:7},
  {date:'2023-08-08',time:'6:30 PM',away:'Foul Poles',home:'Kibosh',diamond:'D13',as:7,hs:13},
  {date:'2023-08-08',time:'6:30 PM',away:'Wayco',home:'Steel City Sluggers',diamond:'D14',as:9,hs:12},
  {date:'2023-08-08',time:'6:30 PM',away:'Alcoballics',home:'Stiff Competition',diamond:'D5',as:8,hs:9},
  {date:'2023-08-08',time:'6:30 PM',away:'Basic Pitches',home:'JAFT',diamond:'D9',as:10,hs:12},
  {date:'2023-08-08',time:'8:15 PM',away:'Landon Longballers',home:'Alcoballics',diamond:'D12',as:11,hs:14},
  {date:'2023-08-08',time:'8:15 PM',away:'Foul Poles',home:'One Hit Wonders',diamond:'D9',as:9,hs:11},
  {date:'2023-08-15',time:'6:30 PM',away:'Kibosh',home:'Steel City Sluggers',diamond:'D12',as:11,hs:9},
  {date:'2023-08-15',time:'6:30 PM',away:'Stiff Competition',home:'Foul Poles',diamond:'D13',as:7,hs:13},
  {date:'2023-08-15',time:'6:30 PM',away:'Wayco',home:'Basic Pitches',diamond:'D14',as:9,hs:14},
  {date:'2023-08-15',time:'6:30 PM',away:'One Hit Wonders',home:'Alcoballics',diamond:'D5',as:8,hs:11},
  {date:'2023-08-15',time:'6:30 PM',away:'JAFT',home:'Landon Longballers',diamond:'D9',as:8,hs:15},
  {date:'2023-08-15',time:'8:15 PM',away:'Kibosh',home:'JAFT',diamond:'D12',as:9,hs:14},
  {date:'2023-08-15',time:'8:15 PM',away:'Stiff Competition',home:'Wayco',diamond:'D9',as:6,hs:12},
  {date:'2023-08-22',time:'6:30 PM',away:'Basic Pitches',home:'Kibosh',diamond:'D12',as:9,hs:13},
  {date:'2023-08-22',time:'6:30 PM',away:'One Hit Wonders',home:'Landon Longballers',diamond:'D13',as:11,hs:8},
  {date:'2023-08-22',time:'6:30 PM',away:'Alcoballics',home:'Foul Poles',diamond:'D14',as:12,hs:10},
  {date:'2023-08-22',time:'6:30 PM',away:'JAFT',home:'Wayco',diamond:'D5',as:10,hs:11},
  {date:'2023-08-22',time:'6:30 PM',away:'Steel City Sluggers',home:'Stiff Competition',diamond:'D9',as:7,hs:9},
  {date:'2023-08-22',time:'8:15 PM',away:'Basic Pitches',home:'Wayco',diamond:'D12',as:11,hs:9},
  {date:'2023-08-22',time:'8:15 PM',away:'One Hit Wonders',home:'Steel City Sluggers',diamond:'D9',as:8,hs:14},
  {date:'2023-08-29',time:'6:30 PM',away:'Landon Longballers',home:'Stiff Competition',diamond:'D12',as:9,hs:8},
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

function renderChampions(){
  const el=document.getElementById('champ-content');
  if(!el) return;

  const champs=getChampions();
  const {counts,podBCounts}=champCounts();
  const leaderboard=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));

  // Dynasty detection — 3+ consecutive wins
  const dynasties=[];
  let streak=1;
  for(let i=1;i<champs.length;i++){
    const prev=champs[i-1],curr=champs[i];
    const prevChamp=prev.champion||prev.podA||'';
    const currChamp=curr.champion||curr.podA||'';
    if(prevChamp&&currChamp&&prevChamp===currChamp) streak++;
    else{
      if(streak>=3) dynasties.push({team:prevChamp,streak,endYear:champs[i-1].year});
      streak=1;
    }
  }

  const medals=['🥇','🥈','🥉'];
  const lbRows=leaderboard.map(([team,wins],i)=>{
    const currentTeam=G.teams.filter(t=>t!=='CrossOver').includes(team);
    const podBWins=podBCounts[team]||0;
    return`<tr style="${currentTeam?'background:#f0f9ff':''}">
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:var(--muted);width:36px">${i<3?medals[i]:i+1}</td>
      <td style="padding:8px 12px;font-size:14px;font-weight:${currentTeam?'700':'500'};color:${currentTeam?'var(--navy)':'var(--text)'}">${esc(team)}${currentTeam?` <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:#dbeafe;color:#1e40af;margin-left:4px">${G.currentSeason}</span>`:''}</td>
      <td style="padding:8px 12px;text-align:right;white-space:nowrap">
        ${'<span style="display:inline-block;width:10px;height:10px;background:var(--navy);border-radius:2px;margin-right:2px"></span>'.repeat(wins)}
        <span style="font-size:13px;font-weight:700;color:var(--navy);margin-left:4px">${wins}</span>
        ${podBWins?`<span style="font-size:11px;color:var(--muted);margin-left:4px">(+${podBWins} POD B*)</span>`:''}
      </td>
    </tr>`;
  }).join('');

  const years=champs.map(c=>c.year).sort((a,b)=>a-b);
  const yearRows=champs.map(row=>{
    const isPodFormat=!!(row.podA||row.podB);
    const isCurrent=row.note&&!row.podA&&!row.champion;
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
          ${row.year}${hasArchive?`<div style="font-size:9px;font-weight:600;color:var(--muted);margin-top:2px">ARCHIVE</div>`:''}
        </td>
        <td style="padding:10px 12px">
          <div style="display:flex;flex-direction:column;gap:4px">
            <div style="font-size:13px;font-weight:600">
              <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:#dbeafe;color:#1e40af;margin-right:6px">POD A</span>
              ${esc(row.podA)} <span style="font-size:11px;color:var(--muted);font-weight:400">League Champion</span>
            </div>
            ${row.podB?`<div style="font-size:13px;color:var(--muted)">
              <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:#fce7f3;color:#9d174d;margin-right:6px">POD B</span>
              ${esc(row.podB)}* <span style="font-size:11px;font-weight:400">Tier B Champion</span>
            </div>`:''}
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
  const wxNights=[...new Set(ARCHIVE_2023.filter(g=>g.wx).map(g=>g.date))];
  const gapNote=[];
  for(let i=1;i<years.length;i++){if(years[i]-years[i-1]>1) gapNote.push(`${years[i-1]+1}–${years[i]-1}`);}

  const archiveRows=archiveRanked.map(([team,s],i)=>`
    <tr style="${i===0?'background:#f0f9ff':''}">
      <td style="padding:6px 10px;font-size:12px;color:var(--muted);width:28px;font-family:var(--mono)">${i+1}</td>
      <td style="padding:6px 10px;font-size:13px;font-weight:${i===0?'700':'500'};color:${i===0?'var(--navy)':'var(--text)'}">${esc(team)}${i===0?' 🏆':''}</td>
      <td style="padding:6px 10px;font-family:var(--mono);font-size:12px;text-align:center">${s.w}-${s.l}-${s.t}</td>
      <td style="padding:6px 10px;font-family:var(--mono);font-size:12px;font-weight:700;color:var(--navy);text-align:center">${s.pts}</td>
      <td style="padding:6px 10px;font-family:var(--mono);font-size:12px;color:var(--muted);text-align:center">${s.rf}-${s.ra}</td>
    </tr>`).join('');

  el.innerHTML=`
    <div class="card" style="background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;margin-bottom:0;border-radius:var(--r) var(--r) 0 0">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.6;margin-bottom:4px">Hamilton Classic Co-Ed Softball League</div>
          <div style="font-size:26px;font-weight:900;letter-spacing:-0.5px">Hall of Champions</div>
          <div style="font-size:13px;opacity:0.65;margin-top:4px">${champs.filter(c=>c.champion||c.podA).length} seasons recorded · Est. 1996</div>
        </div>
        <div style="margin-left:auto;text-align:right;flex-shrink:0"><div style="font-size:40px;line-height:1">🏆</div></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:0;border-top:none;border-radius:0;background:var(--gray1)">
      <div style="font-size:12px;color:var(--muted);line-height:1.6">
        <strong>🏆 League Champion</strong> — POD A winner or pre-pod era champion · counts toward the all-time leaderboard<br>
        <strong>🥈 *POD B Champion</strong> — Tier B winner in seasons using a two-pod format · shown separately<br>
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
            <div style="font-size:16px;font-weight:800;color:var(--navy)">${champs.filter(c=>c.champion||c.podA).length}</div>
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
