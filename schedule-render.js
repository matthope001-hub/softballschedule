// ── SCHEDULE RENDER + SCORES ──────────────────────────────────────────────────

// Sunset safety data for Hamilton ON (43.26°N) — no-lights diamonds (D13/D14)
// Curfew: 6:30 PM start + 1h30m = 8:00 PM must be done
const SUNSET_SAFETY=[
  {from:'2026-05-01',to:'2026-09-07',status:'safe'},
  {from:'2026-09-08',to:'2026-09-08',status:'caution'},  // 7:36 PM — 3 min margin
  {from:'2026-09-09',to:'2026-12-31',status:'unsafe'},
];

function sunsetStatus(dateStr){
  for(const r of SUNSET_SAFETY){
    if(dateStr>=r.from&&dateStr<=r.to) return r.status;
  }
  return 'safe';
}

function sunsetBadge(dateStr){
  const hasNoLit=G.sched.some(g=>g.date===dateStr&&!isDiamondLit(g.diamond)&&g.diamond!==9);
  if(!hasNoLit) return '';
  const st=sunsetStatus(dateStr);
  if(st==='caution') return ` <span style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:6px">⚠ LOW LIGHT</span>`;
  if(st==='unsafe')  return ` <span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:6px">🌙 UNSAFE</span>`;
  return '';
}

function monthAccordion(month,inner,idx,pfx,openSlots){
  const amber=openSlots>0?`<span style="color:#d97706;font-size:11px;font-weight:700;margin-left:8px">${openSlots} OPEN</span>`:'';
  return`<div style="margin-bottom:8px">
    <div onclick="toggleAccordion('${pfx}_m${idx}')" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--navy);color:#fff;border-radius:var(--r-sm);cursor:pointer;user-select:none">
      <span style="font-weight:800;font-size:13px;letter-spacing:0.5px">${month}${amber}</span>
      <span id="arr_${pfx}_m${idx}" style="font-size:12px">▼</span>
    </div>
    <div id="${pfx}_m${idx}" class="accordion-body">${inner}</div>
  </div>`;
}

function toggleAccordion(id){
  const el=document.getElementById(id);
  const arr=document.getElementById('arr_'+id);
  if(!el) return;
  el.classList.toggle('open');
  if(arr) arr.textContent=el.classList.contains('open')?'▲':'▼';
}

function renderSeasonBanner(){
  const el=document.getElementById('season-banner');
  if(!el) return;
  if(!G.sched.length){el.innerHTML='';return;}
  const total=G.sched.filter(g=>!g.playoff).length;
  const scored=G.sched.filter(g=>!g.playoff&&G.scores[g.id]).length;
  const pct=total?Math.round(scored/total*100):0;
  const ss=document.getElementById('ss')?.value||'';
  const se=document.getElementById('se')?.value||'';
  el.innerHTML=`<div style="background:var(--navy);color:#fff;padding:10px 16px;border-radius:var(--r-sm);margin-bottom:10px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <div style="font-size:13px;font-weight:700">⚾ ${G.currentSeason||2026} Season</div>
    <div style="font-size:12px;opacity:0.8">${ss} → ${se}</div>
    <div style="margin-left:auto;font-size:12px;opacity:0.8">${scored}/${total} games scored (${pct}%)</div>
  </div>`;
}

function renderLastResults(){
  const el=document.getElementById('last-results');
  if(!el) return;
  const scored=G.sched.filter(g=>G.scores[g.id]&&!g.playoff).sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||'')).slice(0,5);
  if(!scored.length){el.innerHTML='';return;}
  el.innerHTML=`<div style="margin-bottom:10px">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);margin-bottom:6px">Recent Results</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${scored.map(g=>{
      const sc=G.scores[g.id];
      const homeWin=sc.h>sc.a,awayWin=sc.a>sc.h;
      return`<div style="padding:6px 10px;background:var(--white);border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:12px">
        <div style="font-weight:${homeWin?'800':'400'};color:${homeWin?'var(--navy)':'var(--muted)'}">${esc(g.home)} ${sc.h}</div>
        <div style="font-weight:${awayWin?'800':'400'};color:${awayWin?'var(--navy)':'var(--muted)'}">${esc(g.away)} ${sc.a}</div>
      </div>`;
    }).join('')}
    </div>
  </div>`;
}

function renderFilterChips(){
  const el=document.getElementById('team-filter-chips');
  if(!el) return;
  const filterBar=document.getElementById('team-filter-bar');
  if(!G.sched.length){if(filterBar)filterBar.style.display='none';return;}
  if(filterBar) filterBar.style.display='';
  el.innerHTML=`<button onclick="setSchedFilter(null,this)" class="chip-filter${schedFilterTeam===null?' active':''}" style="font-size:12px">All</button>`
    +G.teams.map(t=>`<button onclick="setSchedFilter('${esc(t)}',this)" class="chip-filter${schedFilterTeam===t?' active':''}" style="font-size:12px">${esc(t)}</button>`).join('');
}

function setSchedFilter(team,btn){
  schedFilterTeam=team;
  document.querySelectorAll('.chip-filter').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderSched();
}

function renderSched(){
  renderSeasonBanner();
  renderLastResults();
  renderFilterChips();
  const el=document.getElementById('so');
  if(!el) return;
  if(!G.sched.length){el.innerHTML='<div class="empty">Add teams and generate a schedule to get started</div>';return;}

  const filtered=schedFilterTeam
    ?G.sched.filter(g=>g.home===schedFilterTeam||g.away===schedFilterTeam)
    :G.sched;

  const monthMap={};const monthOrder=[];
  for(const g of filtered){
    const ml=monthLabel(g.date);
    if(!monthMap[ml]){monthMap[ml]=[];monthOrder.push(ml);}
    monthMap[ml].push(g);
  }

  let html='';
  monthOrder.forEach((month,mi)=>{
    let inner='';
    let lastDate='';
    for(const g of monthMap[month]){
      if(g.date!==lastDate){
        inner+=`<div class="day-head">${fmtDate(g.date)}${sunsetBadge(g.date)}</div>`;
        lastDate=g.date;
      }
      const sc=G.scores[g.id];
      const isCO=g.crossover;
      const isPly=g.playoff;
      const badge=isPly?'<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:3px;font-weight:700;margin-left:4px">🏆 PLY</span>':
                  isCO?'<span style="font-size:10px;background:#f0fdf4;color:#166534;padding:1px 5px;border-radius:3px;font-weight:700;margin-left:4px">CO</span>':'';
      const scoreHtml=sc
        ?`<span style="font-family:var(--mono);font-size:13px;font-weight:800;color:${sc.h>sc.a?'var(--navy)':sc.a>sc.h?'var(--muted)':'var(--text)'}">${sc.h}</span>
           <span style="color:var(--muted);margin:0 3px">–</span>
           <span style="font-family:var(--mono);font-size:13px;font-weight:800;color:${sc.a>sc.h?'var(--navy)':sc.h>sc.a?'var(--muted)':'var(--text)'}">${sc.a}</span>`
        :`<span style="color:var(--muted);font-size:12px">vs</span>`;
      inner+=`<div class="game-row${isCO?' co':''}${isPly?' playoff':''}">
        <span class="game-id">#${g.id}</span>
        <span class="game-time">${g.time||'TBD'}</span>
        <span class="game-diamond">${getDiamondName(g.diamond)}</span>
        <span class="game-teams">${esc(g.home)}${badge} ${scoreHtml} ${esc(g.away)}</span>
      </div>`;
    }
    html+=monthAccordion(month,inner,mi,'so',0);
  });
  el.innerHTML=html;

  // Auto-open current or soonest upcoming month
  const now=toDateStr(new Date());
  const curMonth=monthLabel(now);
  let opened=false;
  monthOrder.forEach((month,i)=>{
    if(!opened&&(month===curMonth||monthMap[month].some(g=>g.date>=now))){
      const body=document.getElementById(`so_m${i}`);
      const arr=document.getElementById(`arr_so_m${i}`);
      if(body){body.classList.add('open');if(arr)arr.textContent='▲';opened=true;}
    }
  });
  if(!opened&&monthOrder.length){
    const body=document.getElementById('so_m0');
    const arr=document.getElementById('arr_so_m0');
    if(body){body.classList.add('open');if(arr)arr.textContent='▲';}
  }
}

// ── SCORES ────────────────────────────────────────────────────────────────────
function renderScores(){
  const el=document.getElementById('sco');
  if(!el) return;
  if(!G.sched.length){el.innerHTML='<div class="empty">Generate a schedule to enter scores</div>';return;}

  const nonPlayoff=G.sched.filter(g=>!g.playoff);
  const monthMap={};const monthOrder=[];
  for(const g of nonPlayoff){
    const ml=monthLabel(g.date);
    if(!monthMap[ml]){monthMap[ml]=[];monthOrder.push(ml);}
    monthMap[ml].push(g);
  }

  let html='';
  monthOrder.forEach((month,mi)=>{
    let inner='';
    let lastDate='';
    for(const g of monthMap[month]){
      if(g.date!==lastDate){
        inner+=`<div class="day-head">${fmtDate(g.date)}</div>`;
        lastDate=g.date;
      }
      const sc=G.scores[g.id];
      const hVal=sc?sc.h:'';
      const aVal=sc?sc.a:'';
      const isCO=g.crossover;
      inner+=`<div class="score-row${isCO?' co':''}">
        <span class="score-id">#${g.id}</span>
        <span class="score-teams">${esc(g.home)} <span style="color:var(--muted);font-size:11px">vs</span> ${esc(g.away)}</span>
        <span class="score-dm">${getDiamondName(g.diamond)} · ${g.time}</span>
        <span class="score-inputs" style="display:flex;align-items:center;gap:4px">
          <input type="number" min="0" class="si" id="sh_${g.id}" value="${hVal}" placeholder="–"
            onchange="saveScore('${g.id}')" style="width:48px"/>
          <span style="color:var(--muted)">–</span>
          <input type="number" min="0" class="si" id="sa_${g.id}" value="${aVal}" placeholder="–"
            onchange="saveScore('${g.id}')" style="width:48px"/>
          <button onclick="weatherGame('${g.id}')" title="Rain — 7–7 tie" style="padding:3px 7px;border-radius:4px;border:1px solid var(--border);background:var(--white);cursor:pointer;font-size:13px">🌧</button>
          ${sc?`<button onclick="clearScore('${g.id}')" title="Clear score" style="padding:3px 7px;border-radius:4px;border:1px solid var(--border);background:var(--white);cursor:pointer;font-size:11px;color:var(--muted)">✕</button>`:''}
        </span>
      </div>`;
    }
    html+=monthAccordion(month,inner,mi,'sc',0);
  });
  el.innerHTML=html;

  // Auto-open current month
  const now=toDateStr(new Date());
  const curMonth=monthLabel(now);
  let opened=false;
  monthOrder.forEach((month,i)=>{
    if(!opened&&(month===curMonth||monthMap[month].some(g=>g.date>=now))){
      const body=document.getElementById(`sc_m${i}`);
      const arr=document.getElementById(`arr_sc_m${i}`);
      if(body){body.classList.add('open');if(arr)arr.textContent='▲';opened=true;}
    }
  });
}

function saveScore(id){
  const h=document.getElementById('sh_'+id)?.value;
  const a=document.getElementById('sa_'+id)?.value;
  if(h===''||a===''){delete G.scores[id];}
  else{G.scores[id]={h:parseInt(h),a:parseInt(a)};}
  saveData();
  renderStandings();
  renderStats();
  renderLastResults();
}

function weatherGame(id){
  G.scores[id]={h:7,a:7,wx:true};
  saveData();
  renderScores();
  renderStandings();
  renderStats();
  showToast('🌧 Weather game — 7–7 tie recorded');
}

function clearScore(id){
  delete G.scores[id];
  saveData();
  renderScores();
  renderStandings();
  renderStats();
}
