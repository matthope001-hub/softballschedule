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
    {id:5,  name:'Diamond 5',  lights:false, lightsCapable:true},
    {id:9,  name:'Diamond 9',  lights:true,  lightsCapable:true},
    {id:12, name:'Diamond 12', lights:true,  lightsCapable:true},
    {id:13, name:'Diamond 13', lights:false, lightsCapable:false},
    {id:14, name:'Diamond 14', lights:false, lightsCapable:false}
  ],
  sched:[],scores:{},
  playoffs:{seeded:false,podA:[],podB:[],games:{},finals:{}}
};
const CROSSOVER='CrossOver';
let hc={};
let schedFilterTeam=null;

// Derived diamond helpers — always read from G.diamonds
function getDiamonds(){ return G.diamonds; }
function getDiamondIds(){ return G.diamonds.map(d=>d.id); }
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
  if(t==='scores')renderScores();
  if(t==='standings')renderStandings();
  if(t==='stats')renderStats();
  if(t==='edit')renderEdit();
  if(t==='playoffs')renderPlayoffs();
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
function addDiamond(){// saved below

  const newId=Math.max(0,...G.diamonds.map(d=>d.id))+1;
  G.diamonds.push({id:newId,name:'Diamond '+newId,lights:true});
  renderDiamonds();
}
function removeDiamond(id){
  if(G.diamonds.length<=1){alert('Need at least one diamond.');return;}
  G.diamonds=G.diamonds.filter(d=>d.id!==id);
  renderDiamonds();
}
function updateDiamondName(id,name){
  const d=G.diamonds.find(d=>d.id===id);
  if(d) d.name=name;
}
function toggleDiamondLights(id){
  const d=G.diamonds.find(d=>d.id===id);
  if(d){
    if(d.lightsCapable===false){
      alert(`${d.name} has no lights infrastructure and cannot be enabled.`);
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
  el.innerHTML=G.diamonds.map(d=>{
    const capable=d.lightsCapable!==false; // default true if not set (backward compat)
    const lightsBtn=capable
      ? `<button onclick="toggleDiamondLights(${d.id})"
          style="padding:6px 12px;border-radius:5px;border:1.5px solid ${d.lights?'var(--navy)':'var(--border)'};background:${d.lights?'var(--navy)':'var(--white)'};color:${d.lights?'#fff':'var(--muted)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:var(--font)">
          ${d.lights?'💡 Lights':'🌙 No Lights'}
        </button>`
      : `<span style="padding:6px 12px;border-radius:5px;border:1.5px solid var(--border);background:var(--gray2);color:var(--gray3);font-size:12px;font-weight:700;white-space:nowrap;font-family:var(--font);display:inline-block" title="No lights infrastructure at this diamond">🚫 No Lights</span>`;
    return `
    <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:8px 10px;background:var(--gray1);border:1.5px solid var(--border);border-radius:6px">
      <input type="text" value="${esc(d.name)}" placeholder="Diamond name"
        onchange="updateDiamondName(${d.id},this.value)"
        style="font-size:13px;font-weight:700;background:var(--white);border:1.5px solid var(--border);border-radius:5px;padding:6px 10px;color:var(--text);font-family:var(--font);outline:none" />
      ${lightsBtn}
      <button onclick="removeDiamond(${d.id})"
        style="padding:6px 10px;border-radius:5px;border:1.5px solid var(--border);background:var(--white);color:var(--muted);font-size:16px;cursor:pointer;line-height:1;font-family:var(--font)"
        title="Remove diamond">×</button>
    </div>`;
  }).join('');
  // Also update the rules panel summary
  const rd=document.getElementById('rules-diamonds');
  if(rd) rd.innerHTML=G.diamonds.map(d=>{
    const capable=d.lightsCapable!==false;
    if(!capable) return `<div style="font-size:13px;color:var(--text)">${d.name} — 🚫 No lights infrastructure (6:30 only)</div>`;
    return `<div style="font-size:13px;color:var(--text)">${d.name} — ${d.lights?'💡 Lights (DH capable)':'🌙 No Lights (6:30 only)'}</div>`;
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

  // Matchup stats
  const uniquePairs=leagueN*(leagueN-1)/2;  // 36 with 9 teams
  const lgGamesFromFaced=uniquePairs*tfaced;  // total league games if all pairs play tfaced times

  const dhDiamonds=G.diamonds.filter(d=>d.lights&&d.id!==9);
  const singleDiamonds=G.diamonds.filter(d=>!d.lights);
  const dhCount=dhDiamonds.length;
  const singleCount=singleDiamonds.length;

  // League pair slots per night = DH diamonds + single diamonds (D9 is CO only)
  const lgPairSlotsPerNight=dhCount+singleCount;

  // Required nights: uniquePairs * tfaced total pair-slots / slots per night
  const requiredNights=lgPairSlotsPerNight>0
    ?Math.round(uniquePairs*tfaced/lgPairSlotsPerNight)
    :0;
  const nightsMatch=nights===requiredNights&&requiredNights>0;

  // Games per team when season length is correct
  const coEach=requiredNights>0?requiredNights/leagueN:tfaced;
  const dhBonus=coEach*dhCount;
  const league630=requiredNights-coEach;
  const gamesPerTeam=Math.round(coEach+coEach+dhBonus+league630);

  // Total games per night (no +1 — D9 CO is separate, not a league game)
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
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">Per Night · ${t1} / ${t2}</div>
      <div style="display:grid;gap:3px">
        <div style="display:flex;justify-content:space-between;font-size:12px"><span>D9 — CrossOver DH</span><strong>2 games</strong></div>
        ${dhDiamonds.map(d=>`<div style="display:flex;justify-content:space-between;font-size:12px"><span>${esc(d.name)} — 💡 Doubleheader</span><strong>2 games</strong></div>`).join('')}
        ${singleDiamonds.map(d=>`<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)"><span>${esc(d.name)} — 🌙 Single only</span><strong style="color:var(--text)">1 game</strong></div>`).join('')}
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


// ── SUNSET SAFETY (Hamilton ON — no-lights diamonds D5/D13/D14) ───────────────
// Level: safe = 10+ min margin, caution = 0-10 min, warning = dark before 8 PM
const SUNSET_SAFETY = {
  '2026-05-19': {level:'safe',sunset:'8:34 PM'},
  '2026-05-26': {level:'safe',sunset:'8:41 PM'},
  '2026-06-02': {level:'safe',sunset:'8:47 PM'},
  '2026-06-09': {level:'safe',sunset:'8:52 PM'},
  '2026-06-16': {level:'safe',sunset:'8:56 PM'},
  '2026-06-23': {level:'safe',sunset:'8:58 PM'},
  '2026-06-30': {level:'safe',sunset:'8:58 PM'},
  '2026-07-07': {level:'safe',sunset:'8:56 PM'},
  '2026-07-14': {level:'safe',sunset:'8:53 PM'},
  '2026-07-21': {level:'safe',sunset:'8:48 PM'},
  '2026-07-28': {level:'safe',sunset:'8:41 PM'},
  '2026-08-04': {level:'safe',sunset:'8:33 PM'},
  '2026-08-11': {level:'safe',sunset:'8:23 PM'},
  '2026-08-18': {level:'safe',sunset:'8:13 PM'},
  '2026-08-25': {level:'safe',sunset:'8:01 PM'},
  '2026-09-01': {level:'safe',sunset:'7:49 PM'},
  '2026-09-08': {level:'caution',sunset:'7:36 PM'},
  '2026-09-15': {level:'warning',sunset:'7:23 PM'},
  '2026-09-22': {level:'warning',sunset:'7:10 PM'},
  '2026-09-29': {level:'warning',sunset:'6:56 PM'},
};

function sunsetBadge(dateStr){
  const s=SUNSET_SAFETY[dateStr];
  if(!s||s.level==='safe') return '';
  // Only warn when no-lights diamonds are in play
  const hasNoLit=G.diamonds.some(d=>!d.lights);
  if(!hasNoLit) return '';
  if(s.level==='caution')
    return `<span style="margin-left:8px;font-size:10px;font-weight:700;padding:1px 7px;border-radius:4px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d">⚠ Sunset ${s.sunset} — Low light</span>`;
  if(s.level==='warning')
    return `<span style="margin-left:8px;font-size:10px;font-weight:700;padding:1px 7px;border-radius:4px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5">🌙 Sunset ${s.sunset} — D13/D14 unsafe</span>`;
  return '';
}

// ── SCHEDULE GENERATION ───────────────────────────────────────────────────────
function getTues(startStr,endStr){
  // Legacy wrapper — uses selected days
  return getGameNights(startStr,endStr,getSelectedDays());
}

function genSched(){
  if(G.teams.length!==10){alert('Need exactly 10 teams including CrossOver. Currently: '+G.teams.length);return;}

  const selectedDays=getSelectedDays();
  if(!selectedDays.length){alert('Please select at least one game day.');return;}
  const gameNights=getGameNights(
    document.getElementById('ss').value,
    document.getElementById('se').value,
    selectedDays
  );
  if(!gameNights.length){alert('No game nights found in that date range.');return;}

  const TIME1 = document.getElementById('time1')?.value || '6:30 PM';
  const TIME2 = document.getElementById('time2')?.value || '8:15 PM';
  const TFACED = parseInt(document.getElementById('tfaced')?.value) || 2;

  const leagueTeams = G.teams.filter(t => t !== CROSSOVER);
  const n = leagueTeams.length;
  const nights = gameNights.length;

  // ── Diamond classification ────────────────────────────────────────────────
  // D9  = CrossOver only (always, not in G.diamonds logic here)
  // DH  = lights ON, not D9  → 6:30 + 8:15 swap.  Teams here play 2 games.
  // litSingle = lights ON, but no DH partner available → user may never create these;
  //             in current config D5 (lights=true) is listed separately.
  //             App treats every lit non-D9 diamond as DH-capable.
  //             So litSingleCount = 0 in standard config.
  // noLit = lights OFF (D13, D14) → 6:30 ONLY, exactly 1 game, LOCKED OUT of 8:15.
  const d9id = 9;
  const dhIds     = G.diamonds.filter(d =>  d.lights && d.id !== d9id).map(d => d.id); // D12, D5 if lit
  const noLitIds  = G.diamonds.filter(d => !d.lights).map(d => d.id);                  // D13, D14

  // litSingle: lit non-D9 diamonds beyond dhIds — in current app there are none,
  // because every lit non-D9 diamond becomes a DH diamond.
  // coB eligible pool: coA (same team hits CO twice) — since litSingleCount=0.
  // If dhIds.length === 0 that's an error.
  if(dhIds.length === 0){
    alert('Need at least one lit non-D9 diamond for doubleheaders.'); return;
  }

  const lgSlotsPerNight = dhIds.length + noLitIds.length;  // 1+2=3 or 2+2=4 etc.
  const uniquePairs = n*(n-1)/2;
  const requiredNights = lgSlotsPerNight > 0
    ? Math.round(uniquePairs * TFACED / lgSlotsPerNight) : 0;

  if(nights !== requiredNights){
    alert(
      `With ${TFACED}× times faced and ${lgSlotsPerNight} league diamond slots per night,\n`+
      `you need exactly ${requiredNights} game nights.\n`+
      `You currently have ${nights}.\n\n`+
      `Adjust your season dates to get ${requiredNights} nights, or change Times Faced.`
    );
    return;
  }

  // Verify diamond slot count matches team count
  // Per night: 1 coA on D9 + dhIds.length*2 on DH + noLitIds.length*2 on noLit = n
  const spotsPerNight = 1 + dhIds.length*2 + noLitIds.length*2;
  if(spotsPerNight !== n){
    alert(
      `Diamond configuration mismatch.\n`+
      `${n} league teams need ${n} spots per night at 6:30,\n`+
      `but config gives ${spotsPerNight} spots:\n`+
      `  1 coOppA (D9) + ${dhIds.length} DH diamonds × 2 + ${noLitIds.length} no-lights × 2\n\n`+
      `Add or remove diamonds to fix.`
    );
    return;
  }

  // ── Per-night game rules ──────────────────────────────────────────────────
  // coA   → D9 6:30 (CO game). 1 game. Can also be coB same night → 2 games max.
  // DH pair → D12/D5 6:30 + 8:15 swap. 2 games each. NEVER coB (would give 3 games).
  // noLit pair → D13/D14 6:30 ONLY. Exactly 1 game. NEVER coB. NEVER touch 8:15.
  // coB   → D9 8:15 (CO game). Must be coA (only eligible since litSingle=0).
  //
  // With litSingle=0: coB == coA every night (same team plays CO 6:30 AND CO 8:15).
  // This means CrossOver faces the same league team twice that night (once home, once away).
  // That is explicitly allowed by the league rules.

  const coEach = nights / n;   // exact integer = TFACED

  // Build pair budget: each unique pair (i,j) must play exactly TFACED times
  // Pair appearances come from: DH slots (1 pair/DH diamond/night) + noLit slots (singleCount pairs/night)
  // Total pair slots per night = dhIds.length + noLitIds.length = lgSlotsPerNight
  // Total pair slots = lgSlotsPerNight * nights = uniquePairs * TFACED ✓ (validated above)

  function makePool(perTeam){
    const pool = [];
    for(let t=0;t<n;t++) for(let k=0;k<perTeam;k++) pool.push(t);
    return shuffle(pool);
  }

  for(let attempt=0; attempt<2000; attempt++){
    // Reset pair budget each attempt
    const pairPlayed = {};
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) pairPlayed[i+'_'+j] = 0;
    function pairKey(a,b){ return a<b ? a+'_'+b : b+'_'+a; }
    function pairOk(a,b){ return pairPlayed[pairKey(a,b)] < TFACED; }
    function usePair(a,b){ pairPlayed[pairKey(a,b)]++; }

    // coA: each team exactly coEach nights on D9 6:30
    const coANights = makePool(coEach);
    const coBNights = coANights.slice(); // coB === coA every night

    // Pre-assign DH pairs per night with pair-budget awareness
    const dhDeg = dhIds.map(() => new Array(n).fill(0));
    const dhByNight = {};
    let dhOk = true;

    for(let ni=0; ni<nights; ni++){
      dhByNight[ni] = [];
      const coA = coANights[ni];
      const blocked = new Set([coA]);

      for(let di=0; di<dhIds.length; di++){
        const usedNow = new Set([...blocked, ...dhByNight[ni].flat()]);
        const cands = [];
        for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
          if(!usedNow.has(i) && !usedNow.has(j) && pairOk(i,j)) cands.push([i,j]);
        }
        if(!cands.length){ dhOk=false; break; }

        // Prefer pairs with fewest DH appearances (balance DH exposure)
        const minS = Math.min(...cands.map(([i,j]) => dhDeg[di][i]+dhDeg[di][j]));
        const best = cands.filter(([i,j]) => dhDeg[di][i]+dhDeg[di][j] === minS);
        const pair = best[Math.floor(Math.random()*best.length)];
        dhByNight[ni].push(pair);
        dhDeg[di][pair[0]]++;
        dhDeg[di][pair[1]]++;
        usePair(pair[0], pair[1]);
      }
      if(!dhOk) break;
    }
    if(!dhOk) continue;

    // Build schedule night by night
    const sched = [];
    const YEAR = new Date(gameNights[0]+'T12:00:00').getFullYear().toString().slice(-2);
    hc = {}; G.teams.forEach(t => hc[t] = 0);
    const gameCounts = {};
    leagueTeams.forEach(t => gameCounts[t] = 0);

    let assignOk = true;

    for(let ni=0; ni<nights; ni++){
      const dateStr   = gameNights[ni];
      const coA       = coANights[ni];
      const coB       = coBNights[ni];
      const coATeam   = leagueTeams[coA];
      const coBTeam   = leagueTeams[coB];
      const dhPairs   = dhByNight[ni];
      const dhTeams   = new Set(dhPairs.flat());

      // rest = everyone except coA and DH teams → goes to noLit diamonds
      const rest = [];
      for(let t=0;t<n;t++) if(t!==coA && !dhTeams.has(t)) rest.push(t);

      if(rest.length !== noLitIds.length*2){ assignOk=false; break; }

      // Assign noLit pairs respecting pair budget
      // Try up to 50 random shuffles to find a valid pairing
      let noLitPairs = null;
      for(let sp=0; sp<50; sp++){
        const shuffled = shuffle([...rest]);
        const pairs = [];
        let valid = true;
        for(let si=0; si<noLitIds.length; si++){
          const a = shuffled[si*2], b = shuffled[si*2+1];
          if(!pairOk(a,b)){ valid=false; break; }
          pairs.push([a,b]);
        }
        if(valid){ noLitPairs=pairs; break; }
      }
      if(!noLitPairs){ assignOk=false; break; }

      // Consume pair budget for noLit pairs
      noLitPairs.forEach(([a,b]) => usePair(a,b));

      // ── D9 6:30: CrossOver HOME vs coOppA AWAY ──────────────────────────
      hc[CROSSOVER]++;
      gameCounts[coATeam]++;
      sched.push({
        id:`${YEAR}${String(sched.length+1).padStart(3,'0')}`, date:dateStr, time:TIME1,
        diamond:d9id, lights:true, home:CROSSOVER, away:coATeam, bye:'', crossover:true
      });

      // ── DH diamonds: 6:30 + 8:15 swap ───────────────────────────────────
      dhPairs.forEach((pair, di) => {
        const dmId = dhIds[di];
        const t1 = leagueTeams[pair[0]];
        const t2 = leagueTeams[pair[1]];
        const [home, away] = pickHA(t1, t2);
        hc[home]++; gameCounts[t1]++; gameCounts[t2]++;
        sched.push({
          id:`${YEAR}${String(sched.length+1).padStart(3,'0')}`, date:dateStr, time:TIME1,
          diamond:dmId, lights:true, home, away, bye:'', crossover:false
        });
        // 8:15 DH swap (H/A reversed)
        hc[away]++; gameCounts[t1]++; gameCounts[t2]++;
        sched.push({
          id:`${YEAR}${String(sched.length+1).padStart(3,'0')}`, date:dateStr, time:TIME2,
          diamond:dmId, lights:true, home:away, away:home, bye:'', crossover:false
        });
      });

      // ── noLit diamonds: 6:30 ONLY ────────────────────────────────────────
      noLitPairs.forEach((pair, si) => {
        const dmId = noLitIds[si];
        const t1 = leagueTeams[pair[0]];
        const t2 = leagueTeams[pair[1]];
        const [home, away] = pickHA(t1, t2);
        hc[home]++; gameCounts[t1]++; gameCounts[t2]++;
        sched.push({
          id:`${YEAR}${String(sched.length+1).padStart(3,'0')}`, date:dateStr, time:TIME1,
          diamond:dmId, lights:false, home, away, bye:'', crossover:false
        });
        // ── NO 8:15 game for noLit diamonds ─────────────────────────────
      });

      // ── D9 8:15: coOppB HOME vs CrossOver AWAY ──────────────────────────
      // coB === coA, so this team now has 1 CO game at 6:30 + 1 CO game at 8:15 = 2 total
      hc[coBTeam]++; gameCounts[coBTeam]++;
      sched.push({
        id:`${YEAR}${String(sched.length+1).padStart(3,'0')}`, date:dateStr, time:TIME2,
        diamond:d9id, lights:true, home:coBTeam, away:CROSSOVER, bye:'', crossover:true
      });
    }

    if(!assignOk) continue;

    // ── Verify equal games AND every pair played exactly TFACED times ─────────
    const counts = leagueTeams.map(t => gameCounts[t]);
    if(!counts.every(c => c === counts[0])) continue;

    const allPairsPlayed = Object.values(pairPlayed).every(v => v === TFACED);
    if(!allPairsPlayed) continue;

    // ── Accept ───────────────────────────────────────────────────────────────
    G.sched   = sched;
    schedFilterTeam = null;
    G.scores  = {};
    saveData();
    document.querySelectorAll('.tab').forEach((b,i) => b.classList.toggle('active', i===1));
    document.querySelectorAll('.section').forEach((s,i) => s.classList.toggle('active', i===1));
    renderSched();
    return;
  }

  alert('Could not generate a valid schedule after 2000 attempts.\nTry adjusting your diamond configuration or season settings.');
}

function groupSched(games){
  const monthMap={};
  const monthOrder=[];
  for(const g of games){
    const ml=monthLabel(g.date);
    if(!monthMap[ml]){monthMap[ml]={};monthOrder.push(ml);}
    if(!monthMap[ml][g.date])monthMap[ml][g.date]=[];
    monthMap[ml][g.date].push(g);
  }
  return monthOrder.map(ml=>({month:ml,dates:monthMap[ml]}));
}

function toggleMonth(id){
  const body=document.getElementById(id);
  const arr=document.getElementById('arr_'+id);
  const isOpen=body.classList.contains('open');
  body.classList.toggle('open',!isOpen);
  arr.textContent=isOpen?'▼':'▲';
  // If this is an edit tab accordion, remember which month is open
  if(id.startsWith('em_')){
    const edi=document.getElementById('edi');
    if(edi&&!isOpen){
      // Find the month name for this accordion
      const mi=parseInt(id.replace('em_m',''));
      const title=document.querySelector(`#arr_${id}`)?.closest('.acc-head')?.querySelector('.acc-title')?.textContent;
      if(title) edi.dataset.openMonth=title;
    }
  }
}

function monthAccordion(month,inner,mi,prefix,openSlots){
  const id=prefix+'_m'+mi;
  const nights=inner.split('day-head').length-1;
  const openTag=openSlots>0
    ?`<span class="acc-meta" style="color:#fbbf24">${openSlots} OPEN</span>`
    :'';
  return `<div class="acc-wrap"><div class="acc-head" onclick="toggleMonth('${id}')"><span class="acc-title">${month}</span><span class="acc-meta">${nights} NIGHT${nights!==1?'S':''}</span>${openTag}<span class="acc-arr" id="arr_${id}">▼</span></div><div class="acc-body" id="${id}">${inner}</div></div>`;
}

function buildSchedInner(dates,isScore){
  let inner='';
  const T1=document.getElementById('time1')?.value||'6:30 PM';
  const T2=document.getElementById('time2')?.value||'8:15 PM';
  for(const[dateStr,games]of Object.entries(dates)){
    inner+=`<div class="day-head">${fmtDate(dateStr)}${sunsetBadge(dateStr)}</div>`;
    const early=games.filter(g=>g.time!==T2);
    const late=games.filter(g=>g.time===T2);
    const usedAt1=new Set(early.map(g=>g.diamond));
    const usedAt2=new Set(late.map(g=>g.diamond));
    const openAt1=getDiamondIds().filter(d=>!usedAt1.has(d));
    const openAt2=G.diamonds.filter(d=>d.lights).map(d=>d.id).filter(d=>!usedAt2.has(d));

    if(early.length){
      inner+=`<div class="slot-head">${T1}</div>`;
      inner+='<table class="gt">';
      for(const g of early){
        const isCO=g.home===CROSSOVER||g.away===CROSSOVER;
        const cobadge=isCO?`<span class="cobadge">CO</span>`:'';
        const plybadge=g.playoff?`<span class="cobadge" style="background:#7c3aed;border-color:#7c3aed">🏆</span>`:'';
        const badge=g.lights?`<span class="dbadge">${getDiamondName(g.diamond)} ☀</span>`:`<span class="dbadge nl">${getDiamondName(g.diamond)}</span>`;
        const gnum=`<span class="gnum">#${g.id}</span>`;
        if(isScore){
          const sc=G.scores[g.id]||{h:'',a:''};
          const isWx=G.scores[g.id]?.weather;
          const wxStyle=isWx?'background:#fef3c7;border-color:#f59e0b':'';
          const trClass=`${isCO?'co-row':''} ${isWx?'wx-row':''}`.trim();
          inner+=`<tr class="${trClass}"><td class="g-num">${gnum}</td><td class="g-time"><span class="time-lbl">${g.time}</span></td><td class="g-home"><span>${esc(g.home)}</span><span class="htag">H</span>${cobadge}${plybadge}</td><td class="g-si"><input type="number" min="0" class="si" id="sh_${g.id}" value="${sc.h}" placeholder="–" onchange="saveScore('${g.id}')"/></td><td class="g-sep">–</td><td class="g-si"><input type="number" min="0" class="si" id="sa_${g.id}" value="${sc.a}" placeholder="–" onchange="saveScore('${g.id}')"/></td><td class="g-away">${esc(g.away)}</td><td class="g-dm">${badge}</td><td class="g-wx"><button id="wb_${g.id}" class="wx-btn" title="${isWx?'Weather cancellation (7–7)':'Mark as weather cancellation (7–7)'}" onclick="weatherCancel('${g.id}')" style="${wxStyle}">🌧</button></td></tr>`;
        } else {
          const sc=G.scores[g.id];const res=sc?sc.h+'–'+sc.a:'—';
          const isWx=sc?.weather;
          inner+=`<tr ${isWx?'class="wx-row"':''}><td class="g-num">${gnum}</td><td class="g-time"><span class="time-lbl">${g.time}</span></td><td class="g-home">${esc(g.home)}<span class="htag">H</span>${cobadge}${plybadge}</td><td class="g-vs">VS</td><td class="g-away">${esc(g.away)}</td><td class="g-dm">${badge}</td><td class="g-sc${sc?' scored':''}">${isWx?'🌧 7–7':res}</td></tr>`;
        }
      }
      inner+='</table>';
    }

    if(late.length){
      inner+=`<div class="slot-head">${T2}</div>`;
      inner+='<table class="gt">';
      for(const g of late){
        const isCO=g.home===CROSSOVER||g.away===CROSSOVER;
        const cobadge=isCO?`<span class="cobadge">CO</span>`:'';
        const plybadge=g.playoff?`<span class="cobadge" style="background:#7c3aed;border-color:#7c3aed">🏆</span>`:'';
        const badge=`<span class="dbadge">${getDiamondName(g.diamond)} ☀</span>`;
        const gnum=`<span class="gnum">#${g.id}</span>`;
        if(isScore){
          const sc=G.scores[g.id]||{h:'',a:''};
          const isWx=G.scores[g.id]?.weather;
          const wxStyle=isWx?'background:#fef3c7;border-color:#f59e0b':'';
          const trClass=`g-late${isCO?' co-row':''} ${isWx?'wx-row':''}`.trim();
          inner+=`<tr class="${trClass}"><td class="g-num">${gnum}</td><td class="g-time"><span class="time-lbl late">${g.time}</span></td><td class="g-home">${esc(g.home)}<span class="htag">H</span>${cobadge}</td><td class="g-si"><input type="number" min="0" class="si" id="sh_${g.id}" value="${sc.h}" placeholder="–" onchange="saveScore('${g.id}')"/></td><td class="g-sep">–</td><td class="g-si"><input type="number" min="0" class="si" id="sa_${g.id}" value="${sc.a}" placeholder="–" onchange="saveScore('${g.id}')"/></td><td class="g-away">${esc(g.away)}</td><td class="g-dm">${badge}</td><td class="g-wx"><button id="wb_${g.id}" class="wx-btn" title="${isWx?'Weather cancellation (7–7)':'Mark as weather cancellation (7–7)'}" onclick="weatherCancel('${g.id}')" style="${wxStyle}">🌧</button></td></tr>`;
        } else {
          const sc=G.scores[g.id];const res=sc?sc.h+'–'+sc.a:'—';
          const isWx=sc?.weather;
          inner+=`<tr class="g-late${isWx?' wx-row':''}"><td class="g-num">${gnum}</td><td class="g-time"><span class="time-lbl late">${g.time}</span></td><td class="g-home">${esc(g.home)}<span class="htag">H</span>${cobadge}</td><td class="g-vs">VS</td><td class="g-away">${esc(g.away)}</td><td class="g-dm">${badge}</td><td class="g-sc${sc?' scored':''}">${isWx?'🌧 7–7':res}</td></tr>`;
        }
      }
      inner+='</table>';
    }
  }
  return inner;
}

function renderSchedFilterChips(){
  const bar=document.getElementById('team-filter-bar');
  const chips=document.getElementById('team-filter-chips');
  if(!bar||!chips)return;
  if(!G.sched.length){bar.style.display='none';return;}
  bar.classList.add('vis');

  const teams=[...G.teams].sort((a,b)=>a===CROSSOVER?1:b===CROSSOVER?-1:a.localeCompare(b));
  const active=schedFilterTeam;

  // Build buttons using DOM — avoids any string escaping issues with team names
  chips.innerHTML='';

  function makeChip(label, team, isActive, color){
    const btn=document.createElement('button');
    btn.textContent=label+(team===CROSSOVER?' 🏳':'');
    btn.style.cssText=`padding:5px 13px;border-radius:20px;border:1.5px solid;cursor:pointer;`+
      `font-size:12px;font-weight:700;font-family:var(--font);`+
      `background:${isActive?color:'var(--white)'};`+
      `color:${isActive?'#fff':'var(--text)'};`+
      `border-color:${isActive?color:'var(--border)'};`+
      `transition:all 0.15s;`;
    btn.addEventListener('click',()=>setSchedFilter(team));
    chips.appendChild(btn);
  }

  makeChip('All Teams', null, active===null, 'var(--navy)');
  teams.forEach(t=>makeChip(t, t, active===t, 'var(--red)'));
}

function setSchedFilter(team){
  schedFilterTeam=team;
  renderSchedFilterChips();
  renderSched();
}

function renderSched(){
  const el=document.getElementById('so');
  const bar=document.getElementById('export-bar');
  if(!G.sched.length){
    el.innerHTML='<div class="empty">Add teams and generate a schedule to get started</div>';
    if(bar)bar.classList.remove('vis');
    document.getElementById('team-filter-bar').classList.remove('vis');
    return;
  }
  if(bar)bar.classList.add('vis');
  renderSchedFilterChips();

  const filtered=schedFilterTeam===null
    ? G.sched
    : G.sched.filter(g=>g.home===schedFilterTeam||g.away===schedFilterTeam);

  if(!filtered.length){
    el.innerHTML=`<div class="empty">No games found for <strong>${esc(schedFilterTeam)}</strong>.</div>`;
    return;
  }

  const grouped=groupSched(filtered);
  el.innerHTML=grouped.map(({month,dates},i)=>monthAccordion(month,buildSchedInner(dates,false),i,'sc')).join('');

  // Auto-open current month or first
  const now=new Date();
  const currentMonth=MONTH_NAMES[now.getMonth()]+' '+now.getFullYear();
  let opened=false;
  grouped.forEach(({month},i)=>{
    if(month===currentMonth||(!opened&&i===0)){
      const body=document.getElementById('sc_m'+i);
      const arr=document.getElementById('arr_sc_m'+i);
      if(body&&!body.classList.contains('open')){body.classList.add('open');if(arr)arr.textContent='▲';opened=true;}
    }
  });
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────

function exportCSV(){
  if(!G.sched.length){alert('Generate a schedule first.');return;}
  const rows=[['Game #','Date','Day','Time','Diamond','Lights','Home','Away','CrossOver Game']];
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  for(const g of G.sched){
    const d=new Date(g.date+'T12:00:00');
    const day=dayNames[d.getDay()];
    const dateFormatted=d.toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'});
    rows.push([
      '#'+g.id,
      dateFormatted,
      day,
      g.time,
      getDiamondName(g.diamond),
      g.lights?'Yes':'No',
      g.home,
      g.away,
      g.crossover?'Yes':'No'
    ]);
  }
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='Hamilton_Classic_Schedule.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}

function exportPrint(){
  if(!G.sched.length){alert('Generate a schedule first.');return;}
  const grouped=groupSched(G.sched);
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Hamilton Classic Co-Ed Softball — 2026 Schedule</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px}
    h1{font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
    .sub{font-size:10px;color:#666;margin-bottom:16px}
    .month{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px;
           background:#1a2744;color:#fff;padding:5px 10px;margin:14px 0 6px}
    .week-hdr{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;
              color:#c0392b;border-bottom:1px solid #ddd;padding:4px 0;margin:8px 0 3px}
    table{width:100%;border-collapse:collapse;margin-bottom:4px}
    th{background:#243058;color:#fff;font-size:9px;text-transform:uppercase;
       letter-spacing:0.4px;padding:3px 6px;text-align:left}
    td{padding:3px 6px;border-bottom:1px solid #eee;font-size:10px}
    tr:nth-child(even) td{background:#f7f6f3}
    .co td{background:#e8f5e9!important;font-style:italic}
    .time{font-weight:700;white-space:nowrap;color:#c0392b}
    .gnum{font-family:monospace;font-size:9px;color:#aaa;white-space:nowrap}
    .diamond{font-family:monospace;font-size:9px;background:#e8edf7;
             padding:1px 5px;border-radius:3px;white-space:nowrap}
    .no-lights .diamond{background:#fdf0e8}
    .bye-note{font-size:9px;color:#666;font-style:italic;padding:2px 0 6px}
    @media print{
      body{padding:10px}
      .month{break-before:auto}
      tr{break-inside:avoid}
    }
  </style></head><body>
  <h1>Hamilton Classic Co-Ed Softball League</h1>
  <div class="sub">Turner Park, Hamilton &nbsp;·&nbsp; 2026 Season Schedule &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'})}</div>`;

  for(const{month,dates} of grouped){
    html+=`<div class="month">${month}</div>`;
    for(const[dateStr,games] of Object.entries(dates)){
      const d=new Date(dateStr+'T12:00:00');
      const dayName=dayNames[d.getDay()];
      const dateLabel=d.toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'});
      html+=`<div class="week-hdr">${dateLabel}</div>`;

      const byeStr=games[0]?.bye||'';
      if(byeStr.startsWith('CO BYE')){
        const rt=byeStr.replace('CO BYE — ','').replace(' rest','');
        html+=`<div class="bye-note">🚫 CrossOver Bye &nbsp;·&nbsp; ${rt} rests</div>`;
      } else if(byeStr){
        html+=`<div class="bye-note">Bye: ${byeStr}</div>`;
      }

      html+=`<table><thead><tr><th>#</th><th>Time</th><th>Diamond</th><th>Home</th><th>Away</th></tr></thead><tbody>`;
      for(const g of games){
        const isCO=g.crossover;
        const dmCell=`<span class="diamond">${getDiamondName(g.diamond)}${g.lights?' ☀':''}</span>`;
        html+=`<tr class="${isCO?'co':''}">
          <td class="gnum">#${g.id}</td>
          <td class="time">${g.time}</td>
          <td>${dmCell}</td>
          <td>${g.home}${isCO&&g.home===CROSSOVER?' 🏳':''}</td>
          <td>${g.away}</td>
        </tr>`;
      }
      html+=`</tbody></table>`;
    }
  }
  html+=`</body></html>`;

  // Use a hidden iframe for printing — works from file:// without popup blocker issues
  let iframe=document.getElementById('_print_frame');
  if(!iframe){
    iframe=document.createElement('iframe');
    iframe.id='_print_frame';
    iframe.style.cssText='position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none';
    document.body.appendChild(iframe);
  }
  iframe.srcdoc=html;
  iframe.onload=()=>{
    try{iframe.contentWindow.focus();iframe.contentWindow.print();}catch(e){
      // Fallback: open data URI in new tab
      const a=document.createElement('a');
      a.href='data:text/html;charset=utf-8,'+encodeURIComponent(html);
      a.target='_blank';a.click();
    }
  };
}

function exportICal(){
  if(!G.sched.length){alert('Generate a schedule first.');return;}

  function icalDate(dateStr,timeStr){
    const[y,m,d]=dateStr.split('-').map(Number);
    const[time,ampm]=timeStr.split(' ');
    let[h,min]=time.split(':').map(Number);
    if(ampm==='PM'&&h!==12)h+=12;
    if(ampm==='AM'&&h===12)h=0;
    return `${String(y)}${String(m).padStart(2,'0')}${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}${String(min).padStart(2,'0')}00`;
  }

  function icalEndTime(dateStr,timeStr){
    // Games are approximately 75 minutes
    const[y,m,d]=dateStr.split('-').map(Number);
    const[time,ampm]=timeStr.split(' ');
    let[h,min]=time.split(':').map(Number);
    if(ampm==='PM'&&h!==12)h+=12;
    if(ampm==='AM'&&h===12)h=0;
    min+=75;h+=Math.floor(min/60);min%=60;
    return `${String(y)}${String(m).padStart(2,'0')}${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}${String(min).padStart(2,'0')}00`;
  }

  function uid(g){return `${g.id}-hamilton-classic-2026@softball`;}

  const now=new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  let cal=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Hamilton Classic Softball//Schedule//EN\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Hamilton Classic 2026\r\nX-WR-TIMEZONE:America/Toronto\r\n`;

  for(const g of G.sched){
    const dmName=getDiamondName(g.diamond);
    const lights=g.lights?'(Lights)':'(No Lights)';
    const summary=`[#${g.id}] ${g.home} vs ${g.away} — ${dmName}`;
    const desc=`Game #${g.id}\\n${g.home} (Home) vs ${g.away} (Away)\\n${dmName} ${lights}\\nTurner Park, Hamilton${g.crossover?' — CrossOver Game':''}`;
    cal+=`BEGIN:VEVENT\r\n`;
    cal+=`UID:${uid(g)}\r\n`;
    cal+=`DTSTAMP:${now}\r\n`;
    cal+=`DTSTART;TZID=America/Toronto:${icalDate(g.date,g.time)}\r\n`;
    cal+=`DTEND;TZID=America/Toronto:${icalEndTime(g.date,g.time)}\r\n`;
    cal+=`SUMMARY:${summary}\r\n`;
    cal+=`DESCRIPTION:${desc}\r\n`;
    cal+=`LOCATION:Turner Park, Hamilton, ON\r\n`;
    cal+=`END:VEVENT\r\n`;
  }
  cal+=`END:VCALENDAR\r\n`;

  const a=document.createElement('a');
  a.href='data:text/calendar;charset=utf-8,'+encodeURIComponent(cal);
  a.download='Hamilton_Classic_2026.ics';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}

// ── RENDER SCORES ─────────────────────────────────────────────────────────────
function renderScores(){
  const el=document.getElementById('sco');
  if(!G.sched.length){el.innerHTML='<div class="empty">Generate a schedule to enter scores</div>';return;}
  const grouped=groupSched(G.sched);
  el.innerHTML=`<div class="notice">Enter final scores · 🌧 sets 7–7 weather tie · Run differential capped at +7</div>`
    +grouped.map(({month,dates},i)=>monthAccordion(month,buildSchedInner(dates,true),i,'sk')).join('');

  // Auto-open current month or first month
  const now=new Date();
  const currentMonth=MONTH_NAMES[now.getMonth()]+' '+now.getFullYear();
  let opened=false;
  grouped.forEach(({month},i)=>{
    if(month===currentMonth||(!opened&&i===0)){
      const body=document.getElementById('sk_m'+i);
      const arr=document.getElementById('arr_sk_m'+i);
      if(body&&!body.classList.contains('open')){
        body.classList.add('open');
        if(arr) arr.textContent='▲';
        opened=true;
      }
    }
  });
}

function saveScore(gid){
  const h=document.getElementById('sh_'+gid)?.value;
  const a=document.getElementById('sa_'+gid)?.value;
  if(h!==''&&a!=='')G.scores[gid]={h:parseInt(h),a:parseInt(a),weather:false};
  else delete G.scores[gid];
  saveData();
  renderSched();
  renderStandings();
  renderStats();
}

function weatherCancel(gid){
  // Rule 8.0: cancelled game = 7-7 tie
  G.scores[gid]={h:7,a:7,weather:true};
  saveData();
  const sh=document.getElementById('sh_'+gid);
  const sa=document.getElementById('sa_'+gid);
  if(sh)sh.value=7;
  if(sa)sa.value=7;
  // Mark the row visually
  const btn=document.getElementById('wb_'+gid);
  if(btn){btn.style.background='#fef3c7';btn.style.borderColor='#f59e0b';btn.title='Weather cancellation (7–7) — click to clear';}
  renderSched();
  renderStandings();
  renderStats();
}

// ── STANDINGS ─────────────────────────────────────────────────────────────────
function capRuns(h,a){
  if(h===a)return{ch:h,ca:a};
  if(h>a)return{ch:Math.min(h,a+CAP),ca:a};
  return{ch:h,ca:Math.min(a,h+CAP)};
}

function renderStandings(){
  const el=document.getElementById('sto');
  if(!G.teams.length){el.innerHTML='<div class="empty">Add teams to get started</div>';return;}
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const stats={};
  for(const t of leagueTeams)stats[t]={gp:0,w:0,l:0,tie:0,pts:0,rf:0,ra:0};
  for(const g of G.sched){
    if(g.playoff) continue; // playoff games excluded from standings
    const sc=G.scores[g.id];if(!sc)continue;
    const{ch,ca}=capRuns(sc.h,sc.a);
    if(stats[g.home]!==undefined){
      stats[g.home].gp++;stats[g.home].rf+=ch;stats[g.home].ra+=ca;
      if(sc.h>sc.a){stats[g.home].w++;stats[g.home].pts+=2;}
      else if(sc.a>sc.h){stats[g.home].l++;}
      else{stats[g.home].tie++;stats[g.home].pts++;}
    }
    if(stats[g.away]!==undefined){
      stats[g.away].gp++;stats[g.away].rf+=ca;stats[g.away].ra+=ch;
      if(sc.a>sc.h){stats[g.away].w++;stats[g.away].pts+=2;}
      else if(sc.h>sc.a){stats[g.away].l++;}
      else{stats[g.away].tie++;stats[g.away].pts++;}
    }
  }

  // ── Rule 10: Tiebreaker logic ─────────────────────────────────────────────
  // a) Head-to-head points among tied teams
  // b) Winner of last regular-season matchup between tied teams (walk back if tie)
  // c) Coin toss (random, stable within this render)

  // Build h2h stats and chronological game log between league teams
  const h2hStats={};  // h2hStats[a][b] = {pts, games:[{date,result}]}
  for(const t of leagueTeams){
    h2hStats[t]={};
    for(const u of leagueTeams) h2hStats[t][u]={pts:0,games:[]};
  }
  const scoredGames=[...G.sched].filter(g=>G.scores[g.id]&&stats[g.home]!==undefined&&stats[g.away]!==undefined&&g.home!==CROSSOVER&&g.away!==CROSSOVER);
  scoredGames.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  for(const g of scoredGames){
    const sc=G.scores[g.id];
    const hw=sc.h>sc.a,aw=sc.a>sc.h,tie=sc.h===sc.a;
    h2hStats[g.home][g.away].games.push({date:g.date,homePts:hw?2:tie?1:0});
    h2hStats[g.away][g.home].games.push({date:g.date,homePts:aw?2:tie?1:0});
    if(hw){h2hStats[g.home][g.away].pts+=2;}
    else if(aw){h2hStats[g.away][g.home].pts+=2;}
    else{h2hStats[g.home][g.away].pts+=1;h2hStats[g.away][g.home].pts+=1;}
  }

  // Stable coin toss seed (hash of team names so it's consistent per render)
  function stableRand(a,b){let h=0;for(const c of (a+b))h=(h*31+c.charCodeAt(0))>>>0;return h%2===0;}

  function tiebreak(group){
    // a) H2H points among group
    const h2hPts={};
    for(const t of group){
      h2hPts[t]=0;
      for(const u of group) if(u!==t) h2hPts[t]+=h2hStats[t][u]?.pts||0;
    }
    const maxH2H=Math.max(...group.map(t=>h2hPts[t]));
    const afterH2H=group.filter(t=>h2hPts[t]===maxH2H);
    if(afterH2H.length===1) return afterH2H[0];

    // b) Walk back through most recent matchups among still-tied teams
    // Collect all games between the remaining tied teams, newest first
    const allGames=[];
    for(let i=0;i<afterH2H.length;i++){
      for(let j=i+1;j<afterH2H.length;j++){
        const a=afterH2H[i],b=afterH2H[j];
        for(const g of (h2hStats[a][b]?.games||[])){
          allGames.push({date:g.date,winner:g.homePts===2?a:g.homePts===0?b:null});
        }
      }
    }
    allGames.sort((a,b)=>b.date.localeCompare(a.date));
    for(const g of allGames){
      if(g.winner&&afterH2H.includes(g.winner)) return g.winner;
    }

    // c) Coin toss (stable random)
    return afterH2H.sort((a,b)=>stableRand(a,b)?-1:1)[0];
  }

  // Sort: pts desc, then tiebreak groups
  const sorted=leagueTeams.slice().sort((a,b)=>{
    const pdiff=stats[b].pts-stats[a].pts;
    if(pdiff!==0) return pdiff;
    return 0; // same pts: will be resolved by tiebreak below
  });

  // Assign final rank resolving ties
  const ranked=[];
  let i=0;
  while(i<sorted.length){
    let j=i+1;
    while(j<sorted.length&&stats[sorted[j]].pts===stats[sorted[i]].pts) j++;
    const group=sorted.slice(i,j);
    if(group.length===1){
      ranked.push({team:group[0],tied:false});
    } else {
      // Recursively rank the tied group
      const rankGroup=(g)=>{
        if(g.length===0) return [];
        const winner=tiebreak(g);
        return [{team:winner,tied:g.length>1},...rankGroup(g.filter(t=>t!==winner))];
      };
      ranked.push(...rankGroup(group).map((r,idx)=>({...r,tied:idx>0||group.length>1})));
    }
    i=j;
  }

  const gp=Object.values(G.scores).length;

  // ── Extra stats: Home/Away records, Last 10, Streak ──────────────────────
  const homeStats={},awayStats={};
  for(const t of leagueTeams){ homeStats[t]={w:0,l:0,tie:0}; awayStats[t]={w:0,l:0,tie:0}; }

  // Chronological list of results per team for Last10 and Streak
  const teamResults={}; // teamResults[t] = [{res:'W'|'L'|'T'}, ...] chronological
  for(const t of leagueTeams) teamResults[t]=[];

  const chronoGames=[...G.sched].filter(g=>G.scores[g.id]).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  for(const g of chronoGames){
    const sc=G.scores[g.id];
    // Home record
    if(homeStats[g.home]!==undefined){
      if(sc.h>sc.a){homeStats[g.home].w++;teamResults[g.home].push('W');}
      else if(sc.a>sc.h){homeStats[g.home].l++;teamResults[g.home].push('L');}
      else{homeStats[g.home].tie++;teamResults[g.home].push('T');}
    }
    // Away record
    if(awayStats[g.away]!==undefined){
      if(sc.a>sc.h){awayStats[g.away].w++;teamResults[g.away].push('W');}
      else if(sc.h>sc.a){awayStats[g.away].l++;teamResults[g.away].push('L');}
      else{awayStats[g.away].tie++;teamResults[g.away].push('T');}
    }
  }

  // Compute Last 10 and Streak for each team
  function last10(t){ const r=teamResults[t].slice(-10); const w=r.filter(x=>x==='W').length,l=r.filter(x=>x==='L').length; return r.length?`${w}-${l}`:'—'; }
  function streak(t){
    const r=teamResults[t];if(!r.length)return{s:'—',cls:''};
    const last=r[r.length-1];let cnt=0;
    for(let i=r.length-1;i>=0&&r[i]===last;i--)cnt++;
    return{s:`${last}${cnt}`,cls:last==='W'?'w':last==='L'?'l':'t'};
  }

  // GB: games behind leader (based on pts; formula = (leaderW - teamW + teamL - leaderL)/2)
  const leader=ranked[0]?.team;
  function gb(t){
    if(t===leader)return'—';
    const ls=stats[leader],ts2=stats[t];
    const gbVal=((ls.w-ts2.w)+(ts2.l-ls.l))/2;
    return gbVal<=0?'—':gbVal%1===0?String(gbVal):`${gbVal}`;
  }

  // Win %
  function winPct(t){
    const s=stats[t];if(s.gp===0)return'—';
    return((s.pts/(s.gp*2))).toFixed(3).replace(/^0/,'');
  }

  el.innerHTML=`
  <div class="metric-grid">
    <div class="metric"><div class="metric-label">Teams</div><div class="metric-value">${leagueTeams.length}</div></div>
    <div class="metric"><div class="metric-label">Played</div><div class="metric-value">${gp}</div></div>
    <div class="metric"><div class="metric-label">Remaining</div><div class="metric-value">${G.sched.filter(g=>!G.scores[g.id]).length}</div></div>
    <div class="metric"><div class="metric-label">Total Games</div><div class="metric-value">${G.sched.length}</div></div>
  </div>
  <div class="notice">W=2 · T=1 · L=0 · Tiebreakers: a) H2H points · b) Last matchup · c) Coin toss · RF/RA capped at +7</div>
  <div class="st-wrap"><table class="st">
    <colgroup>
      <col style="width:28px"><!-- # -->
      <col><!-- Team -->
      <col style="width:58px"><!-- Record -->
      <col style="width:46px"><!-- Win% -->
      <col style="width:36px"><!-- GB -->
      <col style="width:50px"><!-- Home -->
      <col style="width:50px"><!-- Away -->
      <col style="width:34px"><!-- RF -->
      <col style="width:34px"><!-- RA -->
      <col style="width:42px"><!-- DIFF -->
      <col style="width:42px"><!-- Last 10 -->
      <col style="width:40px"><!-- Streak -->
      <col style="width:24px"><!-- TB -->
    </colgroup>
    <thead><tr>
      <th>#</th><th>Team</th><th>Record</th><th>Win%</th><th>GB</th>
      <th>Home</th><th>Away</th><th>RF</th><th>RA</th><th>Diff</th>
      <th>Last 10</th><th>Streak</th><th></th>
    </tr></thead>
    <tbody>${ranked.map(({team:t,tied},idx)=>{
      const s=stats[t];const diff=s.rf-s.ra;
      const ds=s.gp===0?'—':(diff>0?'+'+diff:''+diff);
      const hs=homeStats[t],as2=awayStats[t];
      const hrec=`${hs.w}-${hs.l}${hs.tie?'-'+hs.tie:''}`;
      const arec=`${as2.w}-${as2.l}${as2.tie?'-'+as2.tie:''}`;
      const str=streak(t);
      const tieIcon=tied?`<td title="Tiebreaker applied" style="color:var(--orange);font-size:11px;text-align:center">TB</td>`:`<td></td>`;
      return`<tr>
        <td class="rank">${idx+1}</td>
        <td style="font-weight:600">${esc(t)}</td>
        <td class="rec">${s.w}-${s.l}${s.tie?'-'+s.tie:''}</td>
        <td class="pct">${winPct(t)}</td>
        <td class="gb">${gb(t)}</td>
        <td class="hrec">${hrec}</td>
        <td class="hrec">${arec}</td>
        <td class="mono">${s.rf}</td>
        <td class="mono">${s.ra}</td>
        <td class="mono">${ds}</td>
        <td class="l10">${last10(t)}</td>
        <td class="strk ${str.cls}">${str.s}</td>
        ${tieIcon}
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function renderStats(){
  const el=document.getElementById('sta');
  if(!el) return;
  // Only fully render if the Stats tab is active; otherwise mark as stale
  const tabActive=document.getElementById('tab-stats')?.classList.contains('active');
  if(!tabActive){ el.dataset.stale='1'; return; }
  el.dataset.stale='0';
  if(!G.sched.length){el.innerHTML='<div class="empty">Generate a schedule to view stats</div>';return;}

  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER); // for standings/h2h
  const allTeams=G.teams; // for game count table
  const ts={};
  for(const t of allTeams){
    ts[t]={total:0,home:0,away:0,dh:0,fields:{}};
    getDiamondIds().forEach(d=>ts[t].fields[d]=0);
  }
  const h2h={};
  const coGames={};  // coGames[t] = number of games vs CrossOver
  for(const t of leagueTeams){h2h[t]={};for(const u of leagueTeams)h2h[t][u]=0;coGames[t]=0;}
  const dTotal={};getDiamondIds().forEach(d=>dTotal[d]=0);
  const nightCount={};

  for(const g of G.sched){
    dTotal[g.diamond]=(dTotal[g.diamond]||0)+1;
    if(ts[g.home]){ts[g.home].total++;ts[g.home].home++;ts[g.home].fields[g.diamond]++;}
    if(ts[g.away]){ts[g.away].total++;ts[g.away].away++;ts[g.away].fields[g.diamond]++;}
    // h2h between league teams only
    if(ts[g.home]&&ts[g.away]&&g.home!==CROSSOVER&&g.away!==CROSSOVER){
      h2h[g.home][g.away]++;h2h[g.away][g.home]++;
    }
    // CO game tracking
    if(g.home===CROSSOVER&&coGames[g.away]!==undefined) coGames[g.away]++;
    if(g.away===CROSSOVER&&coGames[g.home]!==undefined) coGames[g.home]++;
    if(g.home!==CROSSOVER) nightCount[g.date+'|'+g.home]=(nightCount[g.date+'|'+g.home]||0)+1;
    if(g.away!==CROSSOVER) nightCount[g.date+'|'+g.away]=(nightCount[g.date+'|'+g.away]||0)+1;
  }
  for(const[key,cnt] of Object.entries(nightCount)){
    if(cnt>=2){const t=key.split('|').slice(1).join('|');if(ts[t])ts[t].dh++;}
  }

  const totalNights=new Set(G.sched.map(g=>g.date)).size;
  const sorted=[...allTeams].sort((a,b)=>ts[b].total-ts[a].total);
  const scoredGames=G.sched.filter(g=>G.scores[g.id]);
  const remainingGames=G.sched.length-scoredGames.length;
  const leagueScoredGames=scoredGames.filter(g=>g.home!==CROSSOVER&&g.away!==CROSSOVER);

  // Fun stats computation
  const teamRF={},teamRA={},teamW={},teamL={},teamTie={};
  for(const t of leagueTeams){teamRF[t]=0;teamRA[t]=0;teamW[t]=0;teamL[t]=0;teamTie[t]=0;}
  let biggestWinMargin=0,biggestWinGame=null,highestScore=0,highestScoreGame=null;
  let totalRunsScored=0,shutouts=0;
  const blowouts=[];
  for(const g of leagueScoredGames){
    const sc=G.scores[g.id];
    const margin=Math.abs(sc.h-sc.a);
    totalRunsScored+=sc.h+sc.a;
    if(sc.h===0||sc.a===0) shutouts++;
    if(margin>biggestWinMargin){biggestWinMargin=margin;biggestWinGame=g;}
    const combined=sc.h+sc.a;
    if(combined>highestScore){highestScore=combined;highestScoreGame=g;}
    if(teamRF[g.home]!==undefined){teamRF[g.home]+=sc.h;teamRA[g.home]+=sc.a;}
    if(teamRF[g.away]!==undefined){teamRF[g.away]+=sc.a;teamRA[g.away]+=sc.h;}
    if(sc.h>sc.a){if(teamW[g.home]!==undefined)teamW[g.home]++; if(teamL[g.away]!==undefined)teamL[g.away]++;}
    else if(sc.a>sc.h){if(teamW[g.away]!==undefined)teamW[g.away]++; if(teamL[g.home]!==undefined)teamL[g.home]++;}
    else{if(teamTie[g.home]!==undefined)teamTie[g.home]++; if(teamTie[g.away]!==undefined)teamTie[g.away]++;}
  }
  const avgRunsPerGame=leagueScoredGames.length?+(totalRunsScored/leagueScoredGames.length).toFixed(1):0;
  const topScorer=leagueTeams.slice().sort((a,b)=>teamRF[b]-teamRF[a])[0];
  const bestDefense=leagueTeams.slice().sort((a,b)=>teamRA[a]-teamRA[b])[0];
  const mostWins=leagueTeams.slice().sort((a,b)=>teamW[b]-teamW[a])[0];
  const mostLosses=leagueTeams.slice().sort((a,b)=>teamL[b]-teamL[a])[0];

  el.innerHTML=`
  <div class="metric-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:1.25rem">
    <div class="metric"><div class="metric-label">Games Played</div><div class="metric-value">${scoredGames.length}</div></div>
    <div class="metric"><div class="metric-label">Games Left</div><div class="metric-value">${remainingGames}</div></div>
    <div class="metric"><div class="metric-label">Tuesday Nights</div><div class="metric-value">${totalNights}</div></div>
    <div class="metric"><div class="metric-label">Teams</div><div class="metric-value">${leagueTeams.length}</div></div>
  </div>

  <div class="card">
    <div class="card-title">⚡ Season Highlights</div>
    ${leagueScoredGames.length===0?'<div class="empty" style="padding:1rem">Enter some scores to see highlights</div>':`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">🔥 Most Runs Scored</div>
        <div style="font-size:18px;font-weight:800;color:var(--navy)">${esc(topScorer)}</div>
        <div style="font-size:12px;color:var(--muted)">${teamRF[topScorer]} runs scored</div>
      </div>
      <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">🛡 Best Defense</div>
        <div style="font-size:18px;font-weight:800;color:var(--navy)">${esc(bestDefense)}</div>
        <div style="font-size:12px;color:var(--muted)">${teamRA[bestDefense]} runs allowed</div>
      </div>
      <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">🏆 Most Wins</div>
        <div style="font-size:18px;font-weight:800;color:var(--navy)">${esc(mostWins)}</div>
        <div style="font-size:12px;color:var(--muted)">${teamW[mostWins]} wins</div>
      </div>
      <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">💀 Most Losses</div>
        <div style="font-size:18px;font-weight:800;color:var(--navy)">${esc(mostLosses)}</div>
        <div style="font-size:12px;color:var(--muted)">${teamL[mostLosses]} losses</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div style="padding:12px;background:var(--navy);border-radius:var(--r-sm);text-align:center">
        <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Avg Runs/Game</div>
        <div style="font-size:26px;font-weight:800;color:#fff;line-height:1">${avgRunsPerGame}</div>
      </div>
      <div style="padding:12px;background:var(--navy);border-radius:var(--r-sm);text-align:center">
        <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Shutouts</div>
        <div style="font-size:26px;font-weight:800;color:#fff;line-height:1">${shutouts}</div>
      </div>
      <div style="padding:12px;background:var(--navy);border-radius:var(--r-sm);text-align:center">
        <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Total Runs</div>
        <div style="font-size:26px;font-weight:800;color:#fff;line-height:1">${totalRunsScored}</div>
      </div>
    </div>
    ${biggestWinGame?`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="padding:12px;background:#fff8ee;border:1px solid #fcd34d;border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">💥 Biggest Win</div>
        <div style="font-size:14px;font-weight:700;color:var(--navy)">${esc(G.scores[biggestWinGame.id].h>G.scores[biggestWinGame.id].a?biggestWinGame.home:biggestWinGame.away)}</div>
        <div style="font-size:12px;color:var(--muted)">${G.scores[biggestWinGame.id].h}–${G.scores[biggestWinGame.id].a} · ${fmtDate(biggestWinGame.date)}</div>
        <div style="font-size:11px;color:var(--muted)">${esc(biggestWinGame.home)} vs ${esc(biggestWinGame.away)}</div>
      </div>
      ${highestScoreGame?`<div style="padding:12px;background:#f0fff4;border:1px solid #86efac;border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">🎯 Highest Scoring Game</div>
        <div style="font-size:14px;font-weight:700;color:var(--navy)">${G.scores[highestScoreGame.id].h}–${G.scores[highestScoreGame.id].a}</div>
        <div style="font-size:12px;color:var(--muted)">${fmtDate(highestScoreGame.date)}</div>
        <div style="font-size:11px;color:var(--muted)">${esc(highestScoreGame.home)} vs ${esc(highestScoreGame.away)}</div>
      </div>`:''}
    </div>`:''}
    `}
  </div>
  <div class="card">
    <div class="card-title">Games Per Team</div>
    <div class="notice">All 10 teams play exactly 24 games · CrossOver marked as guest — excluded from standings · Results vs CrossOver count for league teams</div>
    <table class="games-table"><thead><tr><th>Team</th><th>Total</th><th>Home</th><th>Away</th><th>2× Nights</th></tr></thead>
    <tbody>${sorted.map(t=>{
      const s=ts[t];
      const isCO=t===CROSSOVER;
      const imb=Math.abs(s.home-s.away)>1;
      return`<tr${isCO?' style="opacity:0.6;font-style:italic"':''}>
        <td>${esc(t)}${isCO?'<span style="margin-left:6px;font-size:10px;font-weight:700;color:var(--success);background:#edf7f0;border:1px solid #b8e8c8;border-radius:3px;padding:1px 5px;font-style:normal">GUEST</span>':''}</td>
        <td class="gold">${s.total}</td>
        <td class="${imb?'warn':''}">${s.home}</td>
        <td class="${imb?'warn':''}">${s.away}</td>
        <td>${s.dh}</td>
      </tr>`;
    }).join('')}</tbody></table>
  </div>

  <div class="card">
    <div class="card-title">Diamond Usage — Overall</div>
    <table class="games-table"><thead><tr><th>Diamond</th><th>Lights</th><th>Total Games</th></tr></thead>
    <tbody>${getDiamondIds().map(d=>`<tr><td>${getDiamondName(d)}</td><td>${isDiamondLit(d)?'Yes':'No'}</td><td class="gold">${dTotal[d]||0}</td></tr>`).join('')}</tbody></table>
  </div>
  <div class="card">
    <div class="card-title">Diamond Usage — Per Team</div>
    <div class="notice">Amber = Spread &gt; 2 between most and least used diamond</div>
    <div class="matrix-wrap"><table class="matrix">
      <thead><tr><th class="row-label">Team</th>${getDiamondIds().map(d=>`<th title="${getDiamondName(d)}">D${d}</th>`).join('')}</tr></thead>
      <tbody>${sorted.map(t=>{
        const vals=getDiamondIds().map(d=>ts[t].fields[d]);
        const imb=Math.max(...vals)-Math.min(...vals)>2;
        const mx=Math.max(...vals);
        return`<tr><th class="row-label">${esc(t)}</th>${getDiamondIds().map((d,i)=>`<td class="${vals[i]===mx?'played':''} ${imb?'warn':''}">${vals[i]}</td>`).join('')}</tr>`;
      }).join('')}
      </tbody>
    </table></div>
  </div>
  <div class="card">
    <div class="card-title">Head-to-Head Matrix</div>
    <div class="notice">Games scheduled between each pair (league games only) · <span style="color:var(--green);font-weight:600">CO</span> = games vs CrossOver</div>
    <div class="matrix-wrap"><table class="matrix">
      <thead><tr><th class="row-label">vs →</th>${leagueTeams.map(t=>`<th class="col-head"><span>${esc(t)}</span></th>`).join('')}<th class="col-head" style="background:#f0fff4;border-color:#bbf7d0"><span style="color:#15803d">CrossOver</span></th></tr></thead>
      <tbody>${leagueTeams.map(r=>`<tr><th class="row-label">${esc(r)}</th>${leagueTeams.map(c=>r===c?`<td class="self">—</td>`:(h2h[r][c]>0?`<td class="played">${h2h[r][c]}</td>`:`<td class="zero">0</td>`)).join('')}<td style="background:#f0fff4;color:#15803d;font-weight:700;border-color:#bbf7d0;font-family:var(--mono)">${coGames[r]||0}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}
// ── EDIT GAMES ────────────────────────────────────────────────────────────────
function renderEdit(){
  const el=document.getElementById('edi');
  if(!G.sched.length){el.innerHTML='<div class="empty">Generate a schedule to edit games</div>';return;}

  const ssEl=document.getElementById('ss');
  const seEl=document.getElementById('se');
  let days=getSelectedDays();
  if(!days.length) days=[2]; // default Tuesday

  const ssVal=ssEl?.value||'2026-05-19';
  const seVal=seEl?.value||'2026-09-29';

  // All nights in the season window
  const windowNights=getGameNights(ssVal, seVal, days);

  // Also include any scheduled game dates that fall outside the window
  // (e.g. if se was saved as Sep 15 but games exist on Sep 22/29)
  const schedDates=new Set(G.sched.map(g=>g.date));
  const extraDates=[...schedDates].filter(d=>!windowNights.includes(d)).sort();

  // Merge and deduplicate, sorted
  const allNights=[...new Set([...windowNights,...extraDates])].sort();

  const T1=document.getElementById('time1')?.value||'6:30 PM';
  const T2=document.getElementById('time2')?.value||'8:15 PM';

  // Group all nights by month
  const monthMap={};const monthOrder=[];
  for(const dateStr of allNights){
    const ml=monthLabel(dateStr);
    if(!monthMap[ml]){monthMap[ml]=[];monthOrder.push(ml);}
    monthMap[ml].push(dateStr);
  }

  let html=`<div class="notice">Edit or remove scheduled games · Add teams to open slots · Changes require admin PIN</div>`;

  monthOrder.forEach((month,mi)=>{
    let inner='';
    let monthOpenSlots=0;
    for(const dateStr of monthMap[month]){
      inner+=`<div class="day-head">${fmtDate(dateStr)}${sunsetBadge(dateStr)}</div>`;
      const nightGames=G.sched.filter(g=>g.date===dateStr).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
      const usedAt1=new Set(nightGames.filter(g=>g.time!==T2).map(g=>g.diamond));
      const usedAt2=new Set(nightGames.filter(g=>g.time===T2).map(g=>g.diamond));
      const openAt1=getDiamondIds().filter(d=>!usedAt1.has(d));
      const openAt2=G.diamonds.filter(d=>d.lights).map(d=>d.id).filter(d=>!usedAt2.has(d));
      monthOpenSlots+=openAt1.length+openAt2.length;

      // Scheduled games
      for(const g of nightGames){
        const isCO=g.home===CROSSOVER||g.away===CROSSOVER;
        const isLate=g.time===T2;
        inner+=`<div class="edit-row${isLate?' late':''}" style="border-left:3px solid ${isCO?'#27ae60':'var(--navy2)'}">
          <span class="time-lbl${isLate?' late':''}" style="width:54px;flex-shrink:0">${g.time}</span>
          <span class="gnum" style="flex-shrink:0;margin-right:4px">#${g.id}</span>
          <select onchange="editGame('${g.id}','home',this.value)" class="sel">
            ${G.teams.map(t=>`<option value="${esc(t)}"${t===g.home?' selected':''}>${esc(t)}</option>`).join('')}
          </select>
          <span style="font-size:11px;color:var(--muted);flex-shrink:0">vs</span>
          <select onchange="editGame('${g.id}','away',this.value)" class="sel">
            ${G.teams.map(t=>`<option value="${esc(t)}"${t===g.away?' selected':''}>${esc(t)}</option>`).join('')}
          </select>
          <select onchange="editGame('${g.id}','diamond',this.value)" class="sel">
            ${getDiamondIds().map(d=>`<option value="${d}"${d===g.diamond?' selected':''}>${getDiamondName(d)}</option>`).join('')}
          </select>
          <select onchange="editGame('${g.id}','time',this.value)" class="sel">
            <option value="${T1}"${g.time===T1?' selected':''}>${T1}</option>
            <option value="${T2}"${g.time===T2?' selected':''}>${T2}</option>
          </select>
          <button onclick="removeGame('${g.id}')" title="Remove game #${g.id}" style="flex-shrink:0;padding:4px 8px;background:none;border:1.5px solid var(--border);border-radius:6px;cursor:pointer;color:var(--red);font-size:14px;line-height:1">🗑</button>
        </div>`;
      }

      // Open slots at T1
      for(const dmId of openAt1){
        const dm=G.diamonds.find(d=>d.id===dmId);
        const badge=dm?.lights?`💡 ${getDiamondName(dmId)}`:`🌙 ${getDiamondName(dmId)}`;
        const slotId=`slot_${dateStr}_${dmId}_1`;
        const teamOpts=G.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
        inner+=`<div class="edit-row open-slot">
          <span class="time-lbl" style="width:54px;flex-shrink:0">${T1}</span>
          <span style="font-size:11px;color:var(--gray3);flex-shrink:0;min-width:50px">${badge}</span>
          <select class="sel" id="${slotId}_h" style="font-size:12px"><option value="">— Home —</option>${teamOpts}</select>
          <span style="font-size:11px;color:var(--muted);flex-shrink:0">vs</span>
          <select class="sel" id="${slotId}_a" style="font-size:12px"><option value="">— Away —</option>${teamOpts}</select>
          <button onclick="addSlotGame('${slotId}','${dateStr}','${T1}',${dmId},${dm?.lights?'true':'false'})" style="flex-shrink:0;padding:4px 10px;background:var(--navy);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">+ Add</button>
        </div>`;
      }

      // Open slots at T2 (lit diamonds only)
      for(const dmId of openAt2){
        const dm=G.diamonds.find(d=>d.id===dmId);
        const badge=`💡 ${getDiamondName(dmId)}`;
        const slotId=`slot_${dateStr}_${dmId}_2`;
        const teamOpts=G.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
        inner+=`<div class="edit-row open-slot late">
          <span class="time-lbl late" style="width:54px;flex-shrink:0">${T2}</span>
          <span style="font-size:11px;color:var(--gray3);flex-shrink:0;min-width:50px">${badge}</span>
          <select class="sel" id="${slotId}_h" style="font-size:12px"><option value="">— Home —</option>${teamOpts}</select>
          <span style="font-size:11px;color:var(--muted);flex-shrink:0">vs</span>
          <select class="sel" id="${slotId}_a" style="font-size:12px"><option value="">— Away —</option>${teamOpts}</select>
          <button onclick="addSlotGame('${slotId}','${dateStr}','${T2}',${dmId},${dm?.lights?'true':'false'})" style="flex-shrink:0;padding:4px 10px;background:var(--navy);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">+ Add</button>
        </div>`;
      }
    }
    html+=monthAccordion(month,inner,mi,'em',monthOpenSlots);
  });
  el.innerHTML=html;

  // Auto-open: preserve currently open month if any, else open current month
  const now=new Date();
  const currentMonth=MONTH_NAMES[now.getMonth()]+' '+now.getFullYear();
  // Check if any month was open before re-render (stored in data attr)
  const lastOpenMonth=el.dataset.openMonth||currentMonth;
  let opened=false;
  monthOrder.forEach((month,i)=>{
    if(month===lastOpenMonth||(!opened&&i===0)){
      const body=document.getElementById('em_m'+i);
      const arr=document.getElementById('arr_em_m'+i);
      if(body&&!body.classList.contains('open')){body.classList.add('open');if(arr)arr.textContent='▲';opened=true;}
    }
  });
  // Store the open month for next re-render
  el.dataset.openMonth=lastOpenMonth;
}

function editGame(id,field,value){
  const g=G.sched.find(x=>x.id===id);
  if(!g)return;
  if(field==='diamond'){g.diamond=parseInt(value);g.lights=isDiamondLit(g.diamond);}
  else if(field==='home') g.home=value;
  else if(field==='away') g.away=value;
  else if(field==='time') g.time=value;
  g.crossover=g.home===CROSSOVER||g.away===CROSSOVER;
  saveData();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();
}

function removeGame(id){
  if(!checkAdmin()) return;
  const g=G.sched.find(x=>x.id===id);
  if(!g) return;
  if(!confirm(`Remove game #${id}?\n${g.home} vs ${g.away}\n${fmtDate(g.date)} at ${g.time}\n\nThe slot will remain available to fill.\nThis cannot be undone.`)) return;
  // Store the month so Edit Games re-opens to the right place
  const d=new Date(g.date+'T12:00:00');
  const openMonth=MONTH_NAMES[d.getMonth()]+' '+d.getFullYear();
  G.sched=G.sched.filter(x=>x.id!==id);
  delete G.scores[id];
  saveData();
  // Set which month to re-open before re-rendering
  const edi=document.getElementById('edi');
  if(edi) edi.dataset.openMonth=openMonth;
  renderEdit();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();
  showToast(`🗑 Game #${id} removed — slot is open`);
}

function addSlotGame(slotId, dateStr, time, dmId, lights){
  if(!checkAdmin()) return;
  const home=document.getElementById(slotId+'_h')?.value;
  const away=document.getElementById(slotId+'_a')?.value;
  if(!home){alert('Please select a Home team.');return;}
  if(!away){alert('Please select an Away team.');return;}
  if(home===away){alert('Home and Away teams must be different.');return;}
  const YEAR=new Date(dateStr+'T12:00:00').getFullYear().toString().slice(-2);
  const newId=`${YEAR}${String(G.sched.length+1).padStart(3,'0')}`;
  const newGame={
    id: newId, date: dateStr, time: time, diamond: dmId, lights: lights,
    home: home, away: away, bye: '', crossover: home===CROSSOVER||away===CROSSOVER
  };
  G.sched.push(newGame);
  G.sched.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  // Store which month to re-open
  const d=new Date(dateStr+'T12:00:00');
  const openMonth=MONTH_NAMES[d.getMonth()]+' '+d.getFullYear();
  const edi=document.getElementById('edi');
  if(edi) edi.dataset.openMonth=openMonth;
  saveData();
  renderEdit();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();
  showToast(`✓ Game #${newId} added — ${home} vs ${away}`);
}

// ── PLAYOFFS ──────────────────────────────────────────────────────────────────

function getRegularSeasonRanking(){
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const stats={};
  for(const t of leagueTeams) stats[t]={gp:0,w:0,l:0,tie:0,pts:0,rf:0,ra:0};
  for(const g of G.sched){
    const sc=G.scores[g.id];if(!sc)continue;
    const{ch,ca}=capRuns(sc.h,sc.a);
    if(stats[g.home]!==undefined){
      stats[g.home].gp++;stats[g.home].rf+=ch;stats[g.home].ra+=ca;
      if(sc.h>sc.a){stats[g.home].w++;stats[g.home].pts+=2;}
      else if(sc.a>sc.h)stats[g.home].l++;
      else{stats[g.home].tie++;stats[g.home].pts++;}
    }
    if(stats[g.away]!==undefined){
      stats[g.away].gp++;stats[g.away].rf+=ca;stats[g.away].ra+=ch;
      if(sc.a>sc.h){stats[g.away].w++;stats[g.away].pts+=2;}
      else if(sc.h>sc.a)stats[g.away].l++;
      else{stats[g.away].tie++;stats[g.away].pts++;}
    }
  }
  return leagueTeams.slice().sort((a,b)=>
    stats[b].pts-stats[a].pts||(stats[b].rf-stats[b].ra)-(stats[a].rf-stats[a].ra)||a.localeCompare(b)
  ).map((t,i)=>({team:t,seed:i+1,...stats[t]}));
}

function seedPlayoffs(){
  if(!checkAdmin()) return;
  const ranked=getRegularSeasonRanking();
  if(ranked.length<4){alert('Need at least 4 league teams to seed playoffs.');return;}
  const podA=ranked.slice(0,5).map(r=>r.team);
  const podB=ranked.slice(5).map(r=>r.team);
  function recStr(r){const t=r.tie?`-${r.tie}`:'';return `(${r.w}-${r.l}${t}) ${r.pts}pts`;}
  const msg=`Seed playoffs from current standings?\n\nPOD A (Top 5):\n${ranked.slice(0,5).map(r=>`  ${r.seed}. ${r.team} ${recStr(r)}`).join('\n')}\n\nPOD B (Bottom ${podB.length}):\n${ranked.slice(5).map(r=>`  ${r.seed}. ${r.team} ${recStr(r)}`).join('\n')}\n\nThis will reset any existing playoff data.`;
  if(!confirm(msg)) return;
  // Generate round robin games
  function rrGames(teams,pfx){
    const games={};let n=1;
    for(let i=0;i<teams.length;i++)
      for(let j=i+1;j<teams.length;j++){
        const id=`${pfx}RR${String(n).padStart(2,'0')}`;
        games[id]={id,phase:'rr',home:teams[i],away:teams[j],score:null};n++;
      }
    return games;
  }
  G.playoffs={
    seeded:true,podA,podB,
    games:{...rrGames(podA,'PA'),...rrGames(podB,'PB')},
    semis:{podA:{},podB:{}},
    finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}
  };
  saveData();renderPlayoffs();showToast('🏆 Playoffs seeded!');
}

function resetPlayoffs(){
  if(!checkAdmin()) return;
  if(!confirm('Reset all playoff data? This cannot be undone.')) return;
  G.playoffs={seeded:false,podA:[],podB:[],games:{},semis:{podA:{},podB:{}},finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}};
  saveData();renderPlayoffs();showToast('Playoffs reset');
}

function savePlayoffScore(gameId){
  if(!checkAdmin()) return;
  const h=document.getElementById('ph_'+gameId)?.value;
  const a=document.getElementById('pa_'+gameId)?.value;
  const g=G.playoffs.games[gameId];
  if(!g) return;
  if(h===''||a==='') g.score=null;
  else g.score={h:parseInt(h),a:parseInt(a)};
  saveData();renderPlayoffs();
}

function saveSemiScore(pod,key){
  if(!checkAdmin()) return;
  const h=document.getElementById(`psh_${pod}_${key}`)?.value;
  const a=document.getElementById(`psa_${pod}_${key}`)?.value;
  if(!G.playoffs.semis[pod][key]) G.playoffs.semis[pod][key]={home:null,away:null,score:null};
  if(h===''||a==='') G.playoffs.semis[pod][key].score=null;
  else G.playoffs.semis[pod][key].score={h:parseInt(h),a:parseInt(a)};
  saveData();renderPlayoffs();
}

function saveFinalScore(pod){
  if(!checkAdmin()) return;
  const h=document.getElementById('pfh_'+pod)?.value;
  const a=document.getElementById('pfa_'+pod)?.value;
  if(h===''||a==='') G.playoffs.finals[pod].score=null;
  else G.playoffs.finals[pod].score={h:parseInt(h),a:parseInt(a)};
  saveData();renderPlayoffs();
}

function schedulePlayoffGame(plyId, home, away){
  if(!checkAdmin()) return;
  // Show inline scheduling form via a modal-style prompt
  const date=prompt(`Schedule playoff game: ${home} vs ${away}\n\nEnter date (YYYY-MM-DD), e.g. 2026-10-06:`,'2026-10-06');
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)){if(date!==null)alert('Invalid date format. Use YYYY-MM-DD.');return;}
  const time=prompt('Enter start time:','6:30 PM');
  if(!time){return;}
  const dmNames=G.diamonds.map((d,i)=>`${i+1}. ${d.name}`).join('\n');
  const dmChoice=prompt(`Choose diamond:\n${dmNames}\n\nEnter number:`,'1');
  if(!dmChoice) return;
  const dmIndex=parseInt(dmChoice)-1;
  if(isNaN(dmIndex)||dmIndex<0||dmIndex>=G.diamonds.length){alert('Invalid diamond choice.');return;}
  const dm=G.diamonds[dmIndex];

  // Remove any existing sched entry for this playoff game
  G.sched=G.sched.filter(g=>g.plyId!==plyId);

  // Generate ID
  const yr=new Date(date+'T12:00:00').getFullYear().toString().slice(-2);
  const newId=`${yr}P${String(Date.now()).slice(-4)}`;

  G.sched.push({
    id:newId, date, time,
    diamond:dm.id, lights:dm.lights,
    home, away, bye:'',
    crossover:false,
    playoff:true,
    plyId  // link back to the playoff game entry
  });
  G.sched.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  saveData();
  renderPlayoffs();
  renderSched();
  renderScores();
  showToast(`✓ Playoff game scheduled — ${date} · ${time} · ${dm.name}`);
}

function removePlayoffSchedule(plyId){
  if(!checkAdmin()) return;
  if(!confirm('Remove the scheduled date/time/diamond for this playoff game?\n\nThe game result will be kept.')) return;
  G.sched=G.sched.filter(g=>g.plyId!==plyId);
  saveData();
  renderPlayoffs();
  renderSched();
  renderScores();
  showToast('📅 Playoff game unscheduled');
}

function getPlayoffSchedEntry(plyId){
  return G.sched.find(g=>g.plyId===plyId)||null;
}

function podRRStandings(teams,pfx){
  const stats={};
  for(const t of teams) stats[t]={w:0,l:0,tie:0,pts:0,rf:0,ra:0,gp:0};
  const games=Object.values(G.playoffs.games).filter(g=>g.id.startsWith(pfx+'RR'));
  for(const g of games){
    if(!g.score) continue;
    const{h,a}=g.score;const{ch,ca}=capRuns(h,a);
    stats[g.home].gp++;stats[g.home].rf+=ch;stats[g.home].ra+=ca;
    stats[g.away].gp++;stats[g.away].rf+=ca;stats[g.away].ra+=ch;
    if(h>a){stats[g.home].w++;stats[g.home].pts+=2;stats[g.away].l++;}
    else if(a>h){stats[g.away].w++;stats[g.away].pts+=2;stats[g.home].l++;}
    else{stats[g.home].tie++;stats[g.home].pts++;stats[g.away].tie++;stats[g.away].pts++;}
  }
  return teams.slice().sort((a,b)=>stats[b].pts-stats[a].pts||(stats[b].rf-stats[b].ra)-(stats[a].rf-stats[a].ra)||a.localeCompare(b))
    .map((t,i)=>({team:t,rank:i+1,...stats[t]}));
}

function scoreInput(idH,idA,valH,valA,onChange){
  return `<td class="g-si"><input type="number" min="0" class="si" id="${idH}" value="${valH}" placeholder="–" onchange="${onChange}"/></td><td class="g-sep">–</td><td class="g-si"><input type="number" min="0" class="si" id="${idA}" value="${valA}" placeholder="–" onchange="${onChange}"/></td>`;
}

function schedBtn(plyId, home, away){
  const entry=getPlayoffSchedEntry(plyId);
  if(entry){
    return `<td style="white-space:nowrap;padding:0 6px">
      <span style="font-size:11px;color:var(--navy);font-weight:600">📅 ${entry.date} · ${entry.time}</span>
      <span style="font-size:11px;color:var(--muted)"> · ${getDiamondName(entry.diamond)}</span>
      <button onclick="removePlayoffSchedule('${plyId}')" title="Remove schedule" style="margin-left:4px;background:none;border:none;cursor:pointer;color:var(--muted);font-size:12px;padding:0">✕</button>
    </td>`;
  }
  return `<td><button onclick="schedulePlayoffGame('${plyId}','${esc(home)}','${esc(away)}')" style="font-size:11px;padding:3px 8px;background:var(--gray1);border:1.5px solid var(--border);border-radius:5px;cursor:pointer;color:var(--navy);font-weight:600;white-space:nowrap">📅 Schedule</button></td>`;
}

function winnerOf(sc,home,away){
  if(!sc) return null;
  if(sc.h>sc.a) return home;
  if(sc.a>sc.h) return away;
  return null; // tie — force replay or decide manually
}

function renderPod(podLabel,pfx,podKey,seeds){
  const standing=podRRStandings(seeds,pfx);
  const games=Object.values(G.playoffs.games).filter(g=>g.id.startsWith(pfx+'RR')).sort((a,b)=>a.id.localeCompare(b.id));
  const rrTotal=games.length;
  const rrPlayed=games.filter(g=>g.score).length;
  const rrDone=rrPlayed===rrTotal;
  const semis=G.playoffs.semis[podKey];
  const fin=G.playoffs.finals[podKey];

  // Determine seeds after RR
  const s1=standing[0]?.team,s2=standing[1]?.team,s3=standing[2]?.team,s4=standing[3]?.team;
  const isPodA=pfx==='PA';
  // POD A: top 4 advance (seed 5 eliminated), semis: 1v4, 2v3
  // POD B: all 4 advance, semis: 1v4, 2v3
  const elimNote=isPodA?`<div class="notice" style="background:#fff0f0;border-color:var(--red)">⛔ ${standing[4]?.team||'5th place'} is eliminated after round robin — top 4 advance</div>`:'';

  // Semi setup
  if(rrDone&&s1&&s2&&s3&&s4){
    if(!semis.s1){semis.s1={home:s1,away:s4,score:null};saveData();}
    if(!semis.s2){semis.s2={home:s2,away:s3,score:null};saveData();}
  }
  const sm1=semis.s1||{};const sm2=semis.s2||{};
  const semi1winner=winnerOf(sm1.score,sm1.home,sm1.away);
  const semi2winner=winnerOf(sm2.score,sm2.home,sm2.away);

  // Final setup
  if(semi1winner&&semi2winner&&!fin.home){
    fin.home=semi1winner;fin.away=semi2winner;saveData();
  }
  const champion=winnerOf(fin.score,fin.home,fin.away);

  let h=`<div class="card">`;
  h+=`<div class="card-title">${podLabel} <span style="font-size:11px;font-weight:500;color:var(--muted);text-transform:none;letter-spacing:0">${rrPlayed}/${rrTotal} RR games</span></div>`;

  // Seeding / RR standings
  h+=`<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Round Robin Standings</div>`;
  h+=`<div class="st-wrap" style="margin-bottom:12px"><table class="st">
    <colgroup><col style="width:22px"><col><col style="width:28px"><col style="width:28px"><col style="width:28px"><col style="width:28px"><col style="width:38px"><col style="width:32px"><col style="width:32px"><col style="width:38px"><col style="width:60px"></colgroup>
    <thead><tr><th>#</th><th>Team</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>PTS</th><th>RF</th><th>RA</th><th>DIFF</th><th>Status</th></tr></thead>
    <tbody>${standing.map(({team:t,rank,gp,w,l,tie,pts,rf,ra},i)=>{
      const diff=rf-ra;const ds=gp===0?'—':(diff>0?'+'+diff:''+diff);
      let status='',rowStyle='';
      if(rrDone){
        if(isPodA&&i===4){status='<span style="color:var(--red);font-size:10px;font-weight:700">ELIM</span>';rowStyle='opacity:0.5';}
        else if(i<2) status='<span style="color:var(--green);font-size:10px;font-weight:700">SEMI ✓</span>';
        else status='<span style="color:var(--orange);font-size:10px;font-weight:700">SEMI</span>';
      }
      return`<tr style="${rowStyle}"><td class="rank">${rank}</td><td style="font-weight:600">${esc(t)}</td><td class="mono">${gp}</td><td class="mono">${w}</td><td class="mono">${l}</td><td class="mono">${tie}</td><td class="pts">${pts}</td><td class="mono">${rf}</td><td class="mono">${ra}</td><td class="mono">${ds}</td><td>${status}</td></tr>`;
    }).join('')}</tbody></table></div>`;

  // Round Robin games
  h+=`<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Round Robin Games</div>`;
  h+=`<table class="gt" style="margin-bottom:14px">`;
  for(const g of games){
    const sc=g.score;
    const winner=winnerOf(sc,g.home,g.away);
    h+=`<tr class="${sc?'':'empty-slot'}">
      <td class="g-num"><span class="gnum">${g.id}</span></td>
      <td class="g-home" style="font-weight:600${winner===g.home?';color:var(--navy)':''}">${esc(g.home)}</td>
      <td class="g-vs">vs</td>
      <td class="g-away" style="font-weight:600${winner===g.away?';color:var(--navy)':''}">${esc(g.away)}</td>
      ${scoreInput('ph_'+g.id,'pa_'+g.id,sc?sc.h:'',sc?sc.a:'',`savePlayoffScore('${g.id}')`)}
      <td class="g-sc ${sc?'scored':''}">${winner?'✓ '+esc(winner):sc?'Tie':'—'}</td>
      ${schedBtn(g.id,g.home,g.away)}
    </tr>`;
  }
  h+=`</table>`;

  // Elimination bracket
  h+=`<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Elimination Bracket</div>`;
  if(!rrDone){
    h+=`<div class="notice">Complete all round robin games to unlock the bracket.</div>`;
  } else {
    if(isPodA) h+=elimNote;
    // Semis
    h+=`<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px">Semi-Finals</div>`;
    h+=`<table class="gt" style="margin-bottom:10px">`;
    [{key:'s1',g:sm1,label:`1 vs 4`},{key:'s2',g:sm2,label:`2 vs 3`}].forEach(({key,g,label})=>{
      const winner=winnerOf(g.score,g.home,g.away);
      const plyId=`${podKey}_${key}`;
      h+=`<tr class="${g.score?'':'empty-slot'}">
        <td class="g-num"><span class="gnum">${label}</span></td>
        <td class="g-home" style="font-weight:600${winner===g.home?';color:var(--navy)':''}">${esc(g.home||'TBD')}</td>
        <td class="g-vs">vs</td>
        <td class="g-away" style="font-weight:600${winner===g.away?';color:var(--navy)':''}">${esc(g.away||'TBD')}</td>
        ${scoreInput(`psh_${podKey}_${key}`,`psa_${podKey}_${key}`,g.score?g.score.h:'',g.score?g.score.a:'',`saveSemiScore('${podKey}','${key}')`)}
        <td class="g-sc ${g.score?'scored':''}">${winner?'✓ '+esc(winner):g.score?'Tie':'—'}</td>
        ${g.home?schedBtn(plyId,g.home||'',g.away||''):'<td></td>'}
      </tr>`;
    });
    h+=`</table>`;
    // Final
    h+=`<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px">${podLabel} Final</div>`;
    if(!semi1winner||!semi2winner){
      h+=`<div class="notice">Complete both semi-finals to determine the finalists.</div>`;
    } else {
      h+=`<table class="gt" style="margin-bottom:10px"><tr class="${fin.score?'':'empty-slot'}">
        <td class="g-num"><span class="gnum">FINAL</span></td>
        <td class="g-home" style="font-weight:700;color:var(--navy)">${esc(fin.home||'TBD')}</td>
        <td class="g-vs">vs</td>
        <td class="g-away" style="font-weight:700;color:var(--navy)">${esc(fin.away||'TBD')}</td>
        ${scoreInput('pfh_'+podKey,'pfa_'+podKey,fin.score?fin.score.h:'',fin.score?fin.score.a:'',`saveFinalScore('${podKey}')`)}
        <td class="g-sc ${fin.score?'scored':''}">${champion?'🏆 '+esc(champion):fin.score?'Tie':'—'}</td>
        ${fin.home?schedBtn(`${podKey}_final`,fin.home||'',fin.away||''):'<td></td>'}
      </tr></table>`;
      if(champion){
        h+=`<div style="padding:14px 16px;background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:var(--r);color:#fff;text-align:center;margin-bottom:10px">
          <div style="font-size:11px;font-weight:600;opacity:0.6;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${podLabel} Champion</div>
          <div style="font-size:24px;font-weight:800">🏆 ${esc(champion)}</div>
        </div>`;
      }
    }
  }

  h+=`</div>`;
  return h;
}

function renderPlayoffs(){
  const el=document.getElementById('ply');
  if(!el) return;
  const p=G.playoffs||{seeded:false};

  if(!p.seeded){
    const ranked=getRegularSeasonRanking();
    const hasScores=G.sched.some(g=>G.scores[g.id]);
    el.innerHTML=`
      <div class="card">
        <div class="card-title">Playoffs — Setup</div>
        <div class="notice">Seeding is pulled automatically from the final regular season standings. Make sure all regular season scores are entered first.</div>
        ${ranked.length>=9?`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:6px">POD A — Top 5</div>
            ${ranked.slice(0,5).map(r=>{const t=r.tie?`-${r.tie}`:'';return`<div style="font-size:13px;padding:3px 0;display:flex;justify-content:space-between"><span>${r.seed}. ${esc(r.team)}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">(${r.w}-${r.l}${t}) <strong style="color:var(--navy)">${r.pts}pts</strong></span></div>`;}).join('')}
          </div>
          <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:6px">POD B — Bottom 4</div>
            ${ranked.slice(5).map(r=>{const t=r.tie?`-${r.tie}`:'';return`<div style="font-size:13px;padding:3px 0;display:flex;justify-content:space-between"><span>${r.seed}. ${esc(r.team)}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">(${r.w}-${r.l}${t}) <strong style="color:var(--navy)">${r.pts}pts</strong></span></div>`;}).join('')}
          </div>
        </div>`:''}
        <button class="btn btn-primary" onclick="seedPlayoffs()">🏆 Seed Playoffs from Standings</button>
        ${!hasScores?'<div style="margin-top:8px;font-size:12px;color:var(--muted)">⚠ No scores entered yet — standings may not reflect final order</div>':''}
      </div>
      <div class="card">
        <div class="card-title">Format</div>
        <div style="display:grid;gap:10px">
          <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);margin-bottom:6px">POD A — Top 5 Teams</div>
            <div style="font-size:13px;color:var(--text);display:grid;gap:3px">
              <div>① Round Robin — each team plays the other 4 once (10 games)</div>
              <div>② 5th place is <strong>eliminated</strong></div>
              <div>③ Semi-Finals — Seed 1 vs 4 · Seed 2 vs 3</div>
              <div>④ POD A Final — Semi winners meet</div>
            </div>
          </div>
          <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);margin-bottom:6px">POD B — Bottom 4 Teams</div>
            <div style="font-size:13px;color:var(--text);display:grid;gap:3px">
              <div>① Round Robin — each team plays the other 3 once (6 games)</div>
              <div>② Semi-Finals — Seed 1 vs 4 · Seed 2 vs 3</div>
              <div>③ POD B Final — Semi winners meet</div>
            </div>
          </div>
        </div>
      </div>`;
    return;
  }

  let html=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
    <div style="font-size:13px;color:var(--muted)">Seeded from regular season standings · Admin PIN required for changes</div>
    <button class="btn btn-sm" onclick="resetPlayoffs()" style="color:var(--red);border-color:var(--red)">↺ Reset</button>
  </div>`;
  html+=renderPod('POD A — Top 5','PA','podA',p.podA);
  html+=renderPod('POD B — Bottom 4','PB','podB',p.podB);
  el.innerHTML=html;
}
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