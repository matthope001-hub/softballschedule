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
let hc={};
let schedFilterTeam=null;

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
  if(t==='admin'&&typeof refreshActiveAdminTab==='function')refreshActiveAdminTab();
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
  if(d){d.name=name;saveData();}
}
function toggleDiamondActive(id){
  const d=G.diamonds.find(d=>d.id===id);
  if(!d)return;
  if(d.active&&G.diamonds.filter(x=>x.active).length<=1){alert('Need at least one active diamond.');return;}
  d.active=!d.active;
  if(!d.active)d.lights=false;
  saveData();renderDiamonds();renderRulesDiamonds();updateGptNotice();
}
function toggleDiamondLights(id){
  const d=G.diamonds.find(d=>d.id===id);
  if(!d)return;
  if(d.lightsCapable===false){alert(`${d.name} has no lights infrastructure and cannot be enabled.`);return;}
  if(!d.active){alert(`${d.name} is inactive. Activate it first before toggling lights.`);return;}
  d.lights=!d.lights;
  saveData();renderDiamonds();renderRulesDiamonds();updateGptNotice();
}

function renderRulesDiamonds(){
  const rd=document.getElementById('rules-diamonds');
  if(!rd)return;
  rd.innerHTML=G.diamonds.filter(d=>d.active).map(d=>{
    const capable=d.lightsCapable!==false;
    if(!capable)return`<div style="font-size:13px;color:var(--text)">D${d.id} — ${esc(d.name)} — 🚫 No lights infrastructure (6:30 only)</div>`;
    return`<div style="font-size:13px;color:var(--text)">D${d.id} — ${esc(d.name)} — ${d.lights?'💡 Lights (DH capable)':'🌙 No Lights (6:30 only)'}</div>`;
  }).join('');
}

function renderDiamonds(){
  const el=document.getElementById('diamond-list');
  if(!el)return;

  const active=G.diamonds.filter(d=>d.active);
  const inactive=G.diamonds.filter(d=>!d.active);

  function renderRow(d){
    const capable=d.lightsCapable!==false;
    const isActive=d.active;

    const activeBtn=`<button onclick="toggleDiamondActive(${d.id})"
      title="${isActive?'Click to deactivate':'Click to activate'}"
      style="padding:6px 12px;border-radius:5px;border:1.5px solid ${isActive?'var(--success,#27ae60)':'var(--border)'};background:${isActive?'#edf7f0':'var(--gray2)'};color:${isActive?'var(--success,#27ae60)':'var(--muted)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:var(--font)">
      ${isActive?'✅ Active':'⬜ Inactive'}
    </button>`;

    const lightsBtn=!isActive?'':capable
      ?`<button onclick="toggleDiamondLights(${d.id})"
          style="padding:6px 12px;border-radius:5px;border:1.5px solid ${d.lights?'var(--navy)':'var(--border)'};background:${d.lights?'var(--navy)':'var(--white)'};color:${d.lights?'#fff':'var(--muted)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:var(--font)">
          ${d.lights?'💡 Lights':'🌙 No Lights'}
        </button>`
      :`<span style="padding:6px 12px;border-radius:5px;border:1.5px solid var(--border);background:var(--gray2);color:var(--gray3);font-size:12px;font-weight:700;white-space:nowrap;font-family:var(--font);display:inline-block" title="No lights infrastructure">🚫 No Lights</span>`;

    const rowBg=isActive?'var(--white)':'var(--gray2)';
    const columns=isActive?'grid-template-columns:48px 1fr auto auto auto':'grid-template-columns:48px 1fr auto auto';

    return`<div style="display:grid;${columns};gap:8px;align-items:center;padding:8px 10px;background:${rowBg};border:1.5px solid var(--border);border-radius:6px;opacity:${isActive?'1':'0.6'}">
      <span style="font-family:var(--font);font-size:13px;font-weight:800;color:var(--muted);text-align:center">D${d.id}</span>
      <input type="text" value="${esc(d.name)}" placeholder="Diamond name"
        onchange="updateDiamondName(${d.id},this.value)"
        style="font-size:13px;font-weight:700;background:var(--white);border:1.5px solid var(--border);border-radius:5px;padding:6px 10px;color:var(--text);font-family:var(--font);outline:none"/>
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
  renderRulesDiamonds();
  updateGptNotice();
}

// ── DAYS OF WEEK ──────────────────────────────────────────────────────────────
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
  const[sy,sm,sd]=startStr.split('-').map(Number);
  const[ey,em,ed]=endStr.split('-').map(Number);
  const result=[];
  const cur=new Date(sy,sm-1,sd);
  const end=new Date(ey,em-1,ed);
  while(cur<=end){
    if(days.includes(cur.getDay()))result.push(toDateStr(cur));
    cur.setDate(cur.getDate()+1);
  }
  return result;
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

  const uniquePairs=leagueN*(leagueN-1)/2;
  const lgGamesFromFaced=uniquePairs*tfaced;
  const lgPairSlotsPerNight=dhCount+singleCount;
  const requiredNights=lgPairSlotsPerNight>0?Math.round(uniquePairs*tfaced/lgPairSlotsPerNight):0;
  const nightsMatch=nights===requiredNights&&requiredNights>0;

  const coEach=requiredNights>0?requiredNights/leagueN:tfaced;
  const dhBonus=coEach*dhCount;
  const league630=requiredNights-coEach;
  const gamesPerTeam=Math.round(coEach+coEach+dhBonus+league630);

  const lgGamesPerNight=dhCount*2+singleCount;
  const totalGamesPerNight=lgGamesPerNight+2;
  const totalGames=totalGamesPerNight*(nightsMatch?requiredNights:nights);
  const coTotalGames=2*(nightsMatch?requiredNights:nights);
  const lgTotalGames=totalGames-coTotalGames;

  const t1=`${lgPairSlotsPerNight} league slot${lgPairSlotsPerNight!==1?'s':''}/night`;
  const t2=d9?'1 CrossOver DH':'no D9';

  let statusHtml,statusBg;
  if(!nightsMatch){
    const diff=requiredNights-nights;
    statusHtml=`<span style="color:var(--red);font-weight:800">✗ Season length mismatch</span> — ${tfaced}× times faced needs exactly <strong>${requiredNights}</strong> nights. You have <strong>${nights}</strong>. ${diff>0?`Add ${diff} more game nights.`:`Remove ${-diff} game nights.`}`;
    statusBg='#fff0f0';
  }else{
    statusHtml=`<span style="color:#27ae60;font-weight:800">✓ Ready — ${gamesPerTeam} games per team, every pair plays ${tfaced}×</span>`;
    statusBg='#edf7f0';
  }

  noticeEl.innerHTML=`
  <div style="border:1.5px solid var(--border);border-radius:8px;overflow:hidden;font-size:13px;margin-top:4px">
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
        <div style="display:flex;justify-content:space-between;color:var(--muted)"><span>Required season length</span><strong style="color:var(--text)">${requiredNights} nights</strong></div>
      </div>
    </div>
    <div style="padding:8px 12px;background:${statusBg};font-size:13px">${statusHtml}</div>
  </div>`;
}
