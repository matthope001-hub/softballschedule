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
  const d9id = 9;
  const dhIds    = G.diamonds.filter(d =>  d.lights && d.id !== d9id).map(d => d.id); // D12, D5 if lit
  const noLitIds = G.diamonds.filter(d => !d.lights).map(d => d.id);                  // D13, D14

  if(dhIds.length === 0){
    alert('Need at least one lit non-D9 diamond for doubleheaders.'); return;
  }

  const lgSlotsPerNight = dhIds.length + noLitIds.length;
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

  // ── Per-night game rules ──────────────────────────────────────────────────
  // coA   → D9 6:30 (CO game). coB === coA → same team plays CO 6:30 AND 8:15.
  // DH pair → lit non-D9 diamond, 6:30 + 8:15 H/A swap.
  // noLit pair → D13/D14, 6:30 ONLY. No 8:15 slot.

  const coEach = nights / n; // exact integer = TFACED

  function makePool(perTeam){
    const pool = [];
    for(let t=0;t<n;t++) for(let k=0;k<perTeam;k++) pool.push(t);
    return shuffle(pool);
  }

  for(let attempt=0; attempt<2000; attempt++){
    const pairPlayed = {};
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) pairPlayed[i+'_'+j] = 0;
    function pairKey(a,b){ return a<b ? a+'_'+b : b+'_'+a; }
    function pairOk(a,b){ return pairPlayed[pairKey(a,b)] < TFACED; }
    function usePair(a,b){ pairPlayed[pairKey(a,b)]++; }

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
      const dateStr = gameNights[ni];
      const coA     = coANights[ni];
      const coB     = coBNights[ni];
      const coATeam = leagueTeams[coA];
      const coBTeam = leagueTeams[coB];
      const dhPairs = dhByNight[ni];
      const dhTeams = new Set(dhPairs.flat());

      // rest = everyone except coA and DH teams → goes to noLit diamonds
      const rest = [];
      for(let t=0;t<n;t++) if(t!==coA && !dhTeams.has(t)) rest.push(t);

      if(rest.length !== noLitIds.length*2){ assignOk=false; break; }

      // ── FIX 2: Backtracking noLit pairer ────────────────────────────────
      // Guaranteed to find a valid pairing if one exists — no false restarts.
      let noLitPairs = null;
      const usedInBt = new Set();
      function btPair(pairs){
        if(pairs.length === noLitIds.length){ noLitPairs = pairs.slice(); return true; }
        const remaining = rest.filter(t => !usedInBt.has(t));
        const a = remaining[0];
        for(let k=1; k<remaining.length; k++){
          const b = remaining[k];
          if(pairOk(a,b)){
            usedInBt.add(a); usedInBt.add(b);
            pairs.push([a,b]);
            if(btPair(pairs)) return true;
            pairs.pop();
            usedInBt.delete(a); usedInBt.delete(b);
          }
        }
        return false;
      }
      btPair([]);
      if(!noLitPairs){ assignOk=false; break; }
      // ── End Fix 2 ────────────────────────────────────────────────────────

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
      hc[coBTeam]++; gameCounts[coBTeam]++;
      sched.push({
        id:`${YEAR}${String(sched.length+1).padStart(3,'0')}`, date:dateStr, time:TIME2,
        diamond:d9id, lights:true, home:coBTeam, away:CROSSOVER, bye:'', crossover:true
      });
    }

    if(!assignOk) continue;

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
  if(id.startsWith('em_')){
    const edi=document.getElementById('edi');
    if(edi&&!isOpen){
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
    inner+=`<div class="day-head" data-date="${dateStr}">${fmtDate(dateStr)}${sunsetBadge(dateStr)}</div>`;
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

// ── LAST RESULTS TICKER ───────────────────────────────────────────────────────
function renderLastResults(){
  const el=document.getElementById('last-results');
  if(!el) return;

  const today=toDateStr(new Date());

  const scoredDates=[...new Set(
    G.sched.filter(g=>G.scores[g.id]&&g.date<today).map(g=>g.date)
  )].sort().reverse();

  if(!scoredDates.length){el.innerHTML='';return;}

  const lastDate=scoredDates[0];
  const lastGames=G.sched
    .filter(g=>g.date===lastDate&&G.scores[g.id])
    .sort((a,b)=>(a.time||'').localeCompare(b.time||''));

  if(!lastGames.length){el.innerHTML='';return;}

  const dateLabel=fmtDate(lastDate);

  const pills=lastGames.map(g=>{
    const sc=G.scores[g.id];
    const isWx=sc.weather;
    const homeWon=sc.h>sc.a, awayWon=sc.a>sc.h, tied=sc.h===sc.a;
    const isCO=g.home===CROSSOVER||g.away===CROSSOVER;

    function shortName(t){
      const map={
        'Alcoballics':'Alcoballics',
        'Foul Poles':'Foul Poles',
        'JAFT':'JAFT',
        'Landon Longballers':'Longballers',
        'One Hit Wonders':'One Hit Wonders',
        'Steel City Sluggers':'Steel City',
        "Pitch Don't Kill My Vibe":'PDKMV',
        'Wayco':'Wayco',
        'Kibosh':'Kibosh',
        'CrossOver':'CrossOver',
      };
      return map[t]||t;
    }

    const h=shortName(g.home), a=shortName(g.away);
    const scoreStr=isWx?`🌧 7–7`:`${sc.h}–${sc.a}`;
    const winnerStyle='font-weight:700;color:var(--text)';
    const loserStyle='color:var(--muted)';

    return `<div style="display:flex;align-items:center;gap:6px;padding:7px 12px;background:var(--white);border-radius:var(--r-sm);border:1px solid var(--border);flex-shrink:0;white-space:nowrap">
      ${isCO?`<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:#dcfce7;color:#15803d;margin-right:2px">CO</span>`:''}
      <span style="${homeWon?winnerStyle:loserStyle}">${esc(h)}</span>
      <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:${isWx?'#d97706':tied?'var(--muted)':'var(--navy)'};">${scoreStr}</span>
      <span style="${awayWon?winnerStyle:loserStyle}">${esc(a)}</span>
    </div>`;
  }).join('');

  el.innerHTML=`<div style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted)">Last Results</span>
      <span style="font-size:11px;color:var(--muted)">·</span>
      <span style="font-size:11px;font-weight:600;color:var(--navy)">${dateLabel}</span>
    </div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
      ${pills}
    </div>
  </div>`;
}

function renderSeasonBanner(){
  const el=document.getElementById('season-banner');
  if(!el||!G.sched.length) return;

  const now=new Date();
  const today=toDateStr(now);

  const regGames=G.sched.filter(g=>!g.playoff&&!g.exhibition);
  const scoredIds=new Set(Object.keys(G.scores));
  const played=regGames.filter(g=>scoredIds.has(g.id)).length;
  const remaining=regGames.length-played;

  const upcomingDates=[...new Set(regGames.filter(g=>g.date>=today).map(g=>g.date))].sort();
  const nextDate=upcomingDates[0]||null;

  const lastDate=regGames.length?regGames.reduce((a,b)=>a.date>b.date?a:b).date:null;

  const playoffsSeeded=G.playoffs?.seeded;

  let daysUntil=null;
  if(nextDate){
    const diff=new Date(nextDate+'T12:00:00')-new Date(today+'T00:00:00');
    daysUntil=Math.ceil(diff/(1000*60*60*24));
  }

  let icon='⚾', msg='', sub='', bg=`background:linear-gradient(135deg,${`var(--navy)`},${`var(--navy2)`})`, color='#fff';

  if(!lastDate){
    return;
  } else if(today>lastDate&&!playoffsSeeded){
    icon='🏁';
    msg='Regular Season Complete';
    sub='Head to the Playoffs tab to seed the bracket';
    bg='background:linear-gradient(135deg,#1e3a5f,#2d6a4f)';
  } else if(today>lastDate&&playoffsSeeded){
    icon='🏆';
    msg='Playoffs Underway';
    sub='Check the Playoffs tab for bracket and scores';
    bg='background:linear-gradient(135deg,#7c3aed,#4338ca)';
  } else if(daysUntil===0){
    icon='🎽';
    msg='Game Night Tonight!';
    sub=`${remaining} game${remaining!==1?'s':''} remaining in the regular season`;
    bg='background:linear-gradient(135deg,#065f46,#047857)';
  } else if(daysUntil===1){
    icon='📅';
    msg='Game Night Tomorrow';
    sub=`${remaining} game${remaining!==1?'s':''} remaining · ${played} played`;
  } else if(daysUntil!==null){
    icon='📅';
    msg=`Next game in ${daysUntil} day${daysUntil!==1?'s':''}`;
    sub=`${remaining} game${remaining!==1?'s':''} remaining in the regular season · ${played} played`;
  }

  if(!msg){el.innerHTML='';return;}

  el.innerHTML=`<div style="${bg};color:${color};padding:10px 16px;border-radius:var(--r);margin-bottom:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <span style="font-size:22px;line-height:1">${icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:800;letter-spacing:-0.2px">${msg}</div>
      ${sub?`<div style="font-size:12px;opacity:0.8;margin-top:1px">${sub}</div>`:''}
    </div>
    ${remaining>0&&daysUntil!==null?`<div style="text-align:right;flex-shrink:0">
      <div style="font-size:24px;font-weight:900;line-height:1">${remaining}</div>
      <div style="font-size:10px;opacity:0.7;text-transform:uppercase;letter-spacing:0.5px">games left</div>
    </div>`:''}
  </div>`;
}

// ── WEATHER FORECAST (Open-Meteo, Hamilton ON) ────────────────────────────────
const weatherCache={};
const HAMILTON_LAT=43.26;
const HAMILTON_LON=-79.87;

function wmoIcon(code, precip){
  if(code===0) return{icon:'☀️',label:'Clear'};
  if(code<=2)  return{icon:'🌤',label:'Partly cloudy'};
  if(code===3) return{icon:'☁️',label:'Overcast'};
  if(code<=49) return{icon:'🌫',label:'Fog'};
  if(code<=59) return{icon:'🌦',label:'Drizzle'};
  if(code<=69) return{icon:'🌧',label:'Rain'};
  if(code<=79) return{icon:'🌨',label:'Snow'};
  if(code<=82) return{icon:'🌧',label:'Showers'};
  if(code<=84) return{icon:'🌨',label:'Snow showers'};
  if(code<=99) return{icon:'⛈',label:'Thunderstorm'};
  return{icon:'🌡',label:'Unknown'};
}

async function fetchWeatherForDates(dates){
  const today=toDateStr(new Date());
  const cutoff=new Date(); cutoff.setDate(cutoff.getDate()+16);
  const cutoffStr=toDateStr(cutoff);
  const toFetch=dates.filter(d=>d>=today&&d<=cutoffStr&&!weatherCache[d]);
  if(!toFetch.length) return;

  const startDate=toFetch[0];
  const endDate=toFetch[toFetch.length-1];

  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${HAMILTON_LAT}&longitude=${HAMILTON_LON}`+
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`+
      `&timezone=America%2FToronto&start_date=${startDate}&end_date=${endDate}`;
    const res=await fetch(url);
    if(!res.ok) return;
    const data=await res.json();
    const {time,weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max}=data.daily;
    time.forEach((d,i)=>{
      const{icon,label}=wmoIcon(weather_code[i],precipitation_probability_max[i]);
      weatherCache[d]={
        icon, label,
        precip:precipitation_probability_max[i],
        tempHi:Math.round(temperature_2m_max[i]),
        tempLo:Math.round(temperature_2m_min[i]),
        fetched:Date.now()
      };
    });
  }catch(e){
    console.warn('Weather fetch failed:',e);
  }
}

function weatherBadge(dateStr){
  const w=weatherCache[dateStr];
  if(!w) return '';
  const precipColor=w.precip>=60?'#dc2626':w.precip>=30?'#d97706':'#16a34a';
  const precipText=w.precip!=null?`${w.precip}% 🌧`:'';
  return `<span style="margin-left:8px;font-size:11px;font-weight:600;padding:1px 8px;border-radius:4px;background:rgba(0,0,0,0.06);color:var(--text);display:inline-flex;align-items:center;gap:4px">
    ${w.icon} ${w.tempHi}°<span style="opacity:0.5">${w.tempLo}°</span>${precipText?`<span style="color:${precipColor};margin-left:2px">${precipText}</span>`:''}
  </span>`;
}

function renderSched(){
  const el=document.getElementById('so');
  const bar=document.getElementById('export-bar');
  const tabActive=document.getElementById('tab-schedule')?.classList.contains('active');
  if(!tabActive){ if(el) el.dataset.stale='1'; return; }
  if(!G.sched.length){
    el.innerHTML='<div class="empty">Add teams and generate a schedule to get started</div>';
    if(bar)bar.classList.remove('vis');
    document.getElementById('team-filter-bar').classList.remove('vis');
    renderSeasonBanner();
    renderLastResults();
    return;
  }
  if(bar)bar.classList.add('vis');
  renderSchedFilterChips();
  renderSeasonBanner();
  renderLastResults();

  const filtered=schedFilterTeam===null
    ? G.sched
    : G.sched.filter(g=>g.home===schedFilterTeam||g.away===schedFilterTeam);

  if(!filtered.length){
    el.innerHTML=`<div class="empty">No games found for <strong>${esc(schedFilterTeam)}</strong>.</div>`;
    return;
  }

  const grouped=groupSched(filtered);
  el.innerHTML=grouped.map(({month,dates},i)=>monthAccordion(month,buildSchedInner(dates,false),i,'sc')).join('');

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

  const allDates=[...new Set(filtered.map(g=>g.date))].sort();
  fetchWeatherForDates(allDates).then(()=>{
    allDates.forEach(d=>{
      if(!weatherCache[d]) return;
      document.querySelectorAll('.day-head').forEach(el=>{
        if(el.dataset.date===d&&!el.dataset.weatherDone){
          el.innerHTML+=weatherBadge(d);
          el.dataset.weatherDone='1';
        }
      });
    });
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
  G.scores[gid]={h:7,a:7,weather:true};
  saveData();
  const sh=document.getElementById('sh_'+gid);
  const sa=document.getElementById('sa_'+gid);
  if(sh)sh.value=7;
  if(sa)sa.value=7;
  const btn=document.getElementById('wb_'+gid);
  if(btn){btn.style.background='#fef3c7';btn.style.borderColor='#f59e0b';btn.title='Weather cancellation (7–7) — click to clear';}
  renderSched();
  renderStandings();
  renderStats();
}
