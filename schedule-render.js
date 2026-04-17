// ── SCHEDULE RENDER ───────────────────────────────────────────────────────────

let schedFilterTeam    = null;
let schedFilterDiamond = null;

function toggleAccordion(bodyId, arrId){
  const body=document.getElementById(bodyId);
  const arr=document.getElementById(arrId);
  if(!body)return;
  const open=body.classList.toggle('open');
  if(arr)arr.textContent=open?'▲':'▼';
}

function monthAccordion(month,inner,idx,prefix,openSlots){
  const bodyId=`${prefix}_m${idx}`;
  const arrId=`arr_${prefix}_m${idx}`;
  const slotBadge=openSlots>0?`<span style="background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;margin-left:8px">${openSlots} OPEN</span>`:'';
  return`<div class="acc-wrap">
    <div class="acc-head" onclick="toggleAccordion('${bodyId}','${arrId}')">
      <span class="acc-title">${month}${slotBadge}</span>
      <span class="acc-arr" id="${arrId}">▼</span>
    </div>
    <div class="acc-body" id="${bodyId}">${inner}</div>
  </div>`;
}

function sunsetBadge(dateStr){
  const UNSAFE=['2026-09-15','2026-09-22','2026-09-29'];
  const CAUTION=['2026-09-08'];
  if(UNSAFE.includes(dateStr))return`<span style="font-size:10px;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:3px;font-weight:700;margin-left:6px">🌙 NO LIGHTS</span>`;
  if(CAUTION.includes(dateStr))return`<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:3px;font-weight:700;margin-left:6px">⚠ LOW LIGHT</span>`;
  return'';
}

function renderSeasonBanner(){
  const el=document.getElementById('season-banner');
  if(!el)return;
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
  if(!el)return;
  const scored=G.sched.filter(g=>G.scores[g.id]&&!g.playoff)
    .sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||''))
    .slice(0,5);
  if(!scored.length){el.innerHTML='';return;}
  el.innerHTML=`<div style="margin-bottom:10px">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);margin-bottom:6px">Recent Results</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
    ${scored.map(g=>{
      const sc=G.scores[g.id];
      const hw=sc.h>sc.a,aw=sc.a>sc.h;
      return`<div style="padding:6px 10px;background:var(--white);border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:12px">
        <div style="font-weight:${hw?'800':'400'};color:${hw?'var(--navy)':'var(--muted)'}">${esc(g.home)} ${sc.h}</div>
        <div style="font-weight:${aw?'800':'400'};color:${aw?'var(--navy)':'var(--muted)'}">${esc(g.away)} ${sc.a}</div>
      </div>`;
    }).join('')}
    </div>
  </div>`;
}

// ── FILTER ────────────────────────────────────────────────────────────────────

function renderFilterChips(){
  const filterBar=document.getElementById('team-filter-bar');
  if(!filterBar)return;

  if(!G.sched.length){
    filterBar.style.display='none';
    return;
  }
  filterBar.style.display='';

  // ── Team chips
  const teamEl=document.getElementById('team-filter-chips');
  if(teamEl){
    const chips=[
      `<button onclick="setTeamFilter(null,this)" class="chip-filter${schedFilterTeam===null?' active':''}">All Teams</button>`
    ].concat(
      G.teams.map(t=>`<button onclick="setTeamFilter(${JSON.stringify(t)},this)" class="chip-filter${schedFilterTeam===t?' active':''}">${esc(t)}</button>`)
    );
    teamEl.innerHTML=chips.join('');
  }

  // ── Diamond chips — build from active diamonds in schedule
  let dmEl=document.getElementById('diamond-filter-chips');
  if(!dmEl){
    // Create diamond filter row if it doesn't exist yet
    const row=document.createElement('div');
    row.style.cssText='margin-top:8px';
    row.innerHTML=`<div class="filter-label" style="margin-bottom:4px">Filter by Diamond</div><div id="diamond-filter-chips" class="filter-chips"></div>`;
    filterBar.appendChild(row);
    dmEl=document.getElementById('diamond-filter-chips');
  }

  if(dmEl){
    const usedDiamonds=[...new Set(G.sched.map(g=>g.diamond))].sort((a,b)=>a-b);
    const dmChips=[
      `<button onclick="setDiamondFilter(null,this)" class="chip-filter${schedFilterDiamond===null?' active':''}">All Diamonds</button>`
    ].concat(
      usedDiamonds.map(d=>`<button onclick="setDiamondFilter(${JSON.stringify(d)},this)" class="chip-filter${schedFilterDiamond===d?' active':''}">${getDiamondName(d)}</button>`)
    );
    dmEl.innerHTML=dmChips.join('');
  }
}

function setTeamFilter(team, btn){
  schedFilterTeam=team;
  document.querySelectorAll('#team-filter-chips .chip-filter').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  _renderSchedGames();
  _updateFilterLabel();
}

function setDiamondFilter(diamond, btn){
  schedFilterDiamond=diamond;
  document.querySelectorAll('#diamond-filter-chips .chip-filter').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  _renderSchedGames();
  _updateFilterLabel();
}

function _updateFilterLabel(){
  const label=document.getElementById('_filter_active_label');
  if(!label)return;
  const parts=[];
  if(schedFilterTeam){
    const count=G.sched.filter(g=>g.home===schedFilterTeam||g.away===schedFilterTeam).length;
    parts.push(`${esc(schedFilterTeam)} · ${count} games`);
  }
  if(schedFilterDiamond){
    const count=G.sched.filter(g=>g.diamond===schedFilterDiamond).length;
    parts.push(`${getDiamondName(schedFilterDiamond)} · ${count} games`);
  }
  if(parts.length){
    label.innerHTML=`<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--navy);background:#e8edf5;padding:4px 10px;border-radius:20px">
      Showing: ${parts.join(' + ')}
      <button onclick="clearAllFilters()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;line-height:1;padding:0;margin-left:2px" title="Clear filters">×</button>
    </span>`;
  } else {
    label.innerHTML='';
  }
}

function clearAllFilters(){
  schedFilterTeam=null;
  schedFilterDiamond=null;
  renderFilterChips();
  _renderSchedGames();
  _updateFilterLabel();
}

// ── MAIN RENDER ───────────────────────────────────────────────────────────────
function renderSched(){
  renderSeasonBanner();
  renderLastResults();
  renderFilterChips();
  _renderSchedGames();
}

function _renderSchedGames(){
  const el=document.getElementById('so');
  if(!el)return;
  if(!G.sched.length){
    el.innerHTML='<div class="empty">Add teams and generate a schedule to get started</div>';
    return;
  }

  let filtered=G.sched;
  if(schedFilterTeam)    filtered=filtered.filter(g=>g.home===schedFilterTeam||g.away===schedFilterTeam);
  if(schedFilterDiamond) filtered=filtered.filter(g=>g.diamond===schedFilterDiamond);

  if(!filtered.length){
    const desc=[
      schedFilterTeam    ? esc(schedFilterTeam)              : null,
      schedFilterDiamond ? getDiamondName(schedFilterDiamond) : null
    ].filter(Boolean).join(' + ');
    el.innerHTML=`<div id="_filter_active_label" style="margin-bottom:8px"></div><div class="empty">No games found for ${desc}</div>`;
    _updateFilterLabel();
    return;
  }

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
      const badge=isPly
        ?'<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:3px;font-weight:700;margin-left:4px">🏆 PLY</span>'
        :isCO
        ?'<span style="font-size:10px;background:#f0fdf4;color:#166534;padding:1px 5px;border-radius:3px;font-weight:700;margin-left:4px">CO</span>'
        :'';

      let homeStyle='',awayStyle='';
      if(schedFilterTeam){
        if(g.home===schedFilterTeam)homeStyle='font-weight:800;color:var(--navy)';
        if(g.away===schedFilterTeam)awayStyle='font-weight:800;color:var(--navy)';
      }

      const scoreHtml=sc
        ?`<span style="font-family:var(--mono);font-size:13px;font-weight:800;color:${sc.h>sc.a?'var(--navy)':sc.a>sc.h?'var(--muted)':'var(--text)'}">${sc.h}</span>
           <span style="color:var(--muted);margin:0 3px">–</span>
           <span style="font-family:var(--mono);font-size:13px;font-weight:800;color:${sc.a>sc.h?'var(--navy)':sc.h>sc.a?'var(--muted)':'var(--text)'}">${sc.a}</span>`
        :`<span style="color:var(--muted);font-size:12px">vs</span>`;

      inner+=`<div class="game-row${isCO?' co':''}${isPly?' playoff':''}">
        <span class="game-id">#${g.id}</span>
        <span class="game-time">${g.time||'TBD'}</span>
        <span class="game-diamond">${getDiamondName(g.diamond)}</span>
        <span class="game-teams"><span style="${homeStyle}">${esc(g.home)}</span>${badge} ${scoreHtml} <span style="${awayStyle}">${esc(g.away)}</span></span>
      </div>`;
    }
    html+=monthAccordion(month,inner,mi,'so',0);
  });

  el.innerHTML=`<div id="_filter_active_label" style="margin-bottom:8px"></div>${html}`;
  _updateFilterLabel();

  // Auto-open current/soonest month
  const now=toDateStr(new Date());
  let opened=false;
  monthOrder.forEach((month,i)=>{
    if(!opened&&(monthLabel(now)===month||monthMap[month].some(g=>g.date>=now))){
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
  if(!el)return;
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
      const wxBadge=sc?.wx?'<span style="font-size:10px;background:#dbeafe;color:#1e40af;padding:1px 5px;border-radius:3px;font-weight:700;margin-left:4px">🌧 WX</span>':'';
      inner+=`<div class="score-row${isCO?' co':''}">
        <span class="score-id">#${g.id}</span>
        <span class="score-teams">${esc(g.home)} <span style="color:var(--muted);font-size:11px">vs</span> ${esc(g.away)}${wxBadge}</span>
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

  const now=toDateStr(new Date());
  let opened=false;
  monthOrder.forEach((month,i)=>{
    if(!opened&&(monthLabel(now)===month||monthMap[month].some(g=>g.date>=now))){
      const body=document.getElementById(`sc_m${i}`);
      const arr=document.getElementById(`arr_sc_m${i}`);
      if(body){body.classList.add('open');if(arr)arr.textContent='▲';opened=true;}
    }
  });
}

function saveScore(id){
  const hRaw=document.getElementById('sh_'+id)?.value;
  const aRaw=document.getElementById('sa_'+id)?.value;
  if(hRaw===''||aRaw===''){delete G.scores[id];}
  else{const h=Math.max(0,parseInt(hRaw)||0);const a=Math.max(0,parseInt(aRaw)||0);G.scores[id]={h,a};}
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
