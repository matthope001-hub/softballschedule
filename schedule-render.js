// ── SCHEDULE RENDER ───────────────────────────────────────────────────────────
let schedFilterTeam=null;
let schedFilterDiamond=null;

function toggleAccordion(bodyId,arrId){
  const body=document.getElementById(bodyId);
  const arr=document.getElementById(arrId);
  if(!body)return;
  body.classList.toggle('open');
  if(arr)arr.textContent=body.classList.contains('open')?'▲':'▼';
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
  const total=G.sched.filter(g=>!g.playoff&&!g.open).length;
  const scored=G.sched.filter(g=>!g.playoff&&!g.open&&G.scores[g.id]).length;
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
    .slice(0,10);
  if(!scored.length){el.innerHTML='';return;}

  // Calculate team records
  const records={};
  for(const t of G.teams){records[t]={w:0,l:0};}
  for(const g of G.sched){
    const sc=G.scores[g.id];
    if(!sc||g.playoff||g.open)continue;
    if(sc.h>sc.a){records[g.home].w++;records[g.away].l++;}
    else if(sc.a>sc.h){records[g.away].w++;records[g.home].l++;}
  }
  const fmtRec=t=>{const r=records[t]||{w:0,l:0};return`${r.w}-${r.l}`;};

  const tickerItems=scored.map(g=>{
    const sc=G.scores[g.id];
    const hw=sc.h>sc.a,aw=sc.a>sc.h;
    const homeClass=hw?'winner':'loser';
    const awayClass=aw?'winner':'loser';
    return`<span class="ticker-item">
      <span class="${homeClass}">${esc(g.home)} (${fmtRec(g.home)})</span>
      <span class="score">${sc.h}-${sc.a}</span>
      <span class="${awayClass}">${esc(g.away)} (${fmtRec(g.away)})</span>
      <span style="opacity:0.5">|</span>
      <span style="opacity:0.7;font-size:11px">${g.date}</span>
    </span>`;
  }).join('');

  // Duplicate items for seamless loop
  el.innerHTML=`<div class="ticker-content">${tickerItems}${tickerItems}</div>`;
}

// ── FILTER ────────────────────────────────────────────────────────────────────
function renderFilterChips(){
  const filterBar=document.getElementById('filter-bar');
  const exportBar=document.getElementById('export-bar');

  if(!G.sched.length){
    if(filterBar)filterBar.style.display='none';
    if(exportBar)exportBar.classList.remove('vis');
    return;
  }

  if(filterBar)filterBar.style.display='block';
  if(exportBar)exportBar.classList.add('vis');

  // Team chips — use data-team attribute to avoid apostrophe issues
  const teamEl=document.getElementById('team-filter-chips');
  if(teamEl){
    const chips=[
      `<button onclick="setTeamFilter(null,this)" class="chip-filter${schedFilterTeam===null?' active':''}">All Teams</button>`
    ].concat(
      G.teams.map(t=>`<button onclick="setTeamFilter(this.dataset.team,this)" data-team="${esc(t)}" class="chip-filter${schedFilterTeam===t?' active':''}">${esc(t)}</button>`)
    );
    teamEl.innerHTML=chips.join('');
  }

  // Diamond chips — use data-diamond attribute
  const dmEl=document.getElementById('diamond-filter-chips');
  if(dmEl){
    const usedDiamonds=[...new Set(G.sched.filter(g=>!g.open).map(g=>g.diamond))].sort((a,b)=>a-b);
    const dmChips=[
      `<button onclick="setDiamondFilter(null,this)" class="chip-filter${schedFilterDiamond===null?' active':''}">All Diamonds</button>`
    ].concat(
      usedDiamonds.map(d=>`<button onclick="setDiamondFilter(parseInt(this.dataset.diamond),this)" data-diamond="${d}" class="chip-filter${schedFilterDiamond===d?' active':''}">${getDiamondName(d)}</button>`)
    );
    dmEl.innerHTML=dmChips.join('');
  }
}

function setTeamFilter(team,btn){
  schedFilterTeam=team||null;
  document.querySelectorAll('#team-filter-chips .chip-filter').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  _renderSchedGames();
  _updateFilterLabel();
}

function setDiamondFilter(diamond,btn){
  schedFilterDiamond=diamond||null;
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

  let filtered=G.sched.filter(g=>!g.open);
  if(schedFilterTeam)    filtered=filtered.filter(g=>g.home===schedFilterTeam||g.away===schedFilterTeam);
  if(schedFilterDiamond) filtered=filtered.filter(g=>g.diamond===schedFilterDiamond);

  if(!filtered.length){
    const desc=[
      schedFilterTeam    ? esc(schedFilterTeam)               : null,
      schedFilterDiamond ? getDiamondName(schedFilterDiamond)  : null
    ].filter(Boolean).join(' + ');
    el.innerHTML=`<div class="empty">No games found for ${desc}</div>`;
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
        ?'<span style="font-size:10px;background:#e0f2fe;color:#0369a1;padding:1px 5px;border-radius:3px;font-weight:700;margin-left:4px">CO</span>'
        :'';
      const homeStyle=sc&&sc.h>sc.a?'font-weight:800;color:var(--navy)':'';
      const awayStyle=sc&&sc.a>sc.h?'font-weight:800;color:var(--navy)':'';
      const scoreHtml=sc
        ?`<span style="font-family:var(--mono);font-size:13px;font-weight:800;color:${sc.h>sc.a?'var(--navy)':sc.h<sc.a?'var(--muted)':'var(--text)'}">${sc.h}</span>
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

  // Auto-open current or soonest upcoming month
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
        <span class="game-id">#${g.id}</span>
        <span class="game-time">${g.time||''}</span>
        <span class="game-diamond">${getDiamondName(g.diamond)}</span>
        <span class="game-teams">${esc(g.home)}${wxBadge} vs ${esc(g.away)}</span>
        <span class="score-inputs">
          <input type="number" class="si" min="0" max="99" value="${hVal}" onchange="saveScore('${g.id}',this,'h')" placeholder="H"/>
          <span style="color:var(--muted);font-size:11px;margin:0 2px">–</span>
          <input type="number" class="si" min="0" max="99" value="${aVal}" onchange="saveScore('${g.id}',this,'a')" placeholder="A"/>
        </span>
        <button class="wx-btn" title="Weather cancellation (7–7 tie)" onclick="saveWeather('${g.id}')">🌧</button>
      </div>`;
    }
    html+=monthAccordion(month,inner,mi,'sco',0);
  });

  const sco=document.getElementById('sco');
  if(sco){
    sco.innerHTML=html;
    const now=toDateStr(new Date());
    let opened=false;
    monthOrder.forEach((month,i)=>{
      if(!opened&&(monthLabel(now)===month||monthMap[month].some(g=>g.date>=now))){
        const body=document.getElementById(`sco_m${i}`);
        const arr=document.getElementById(`arr_sco_m${i}`);
        if(body){body.classList.add('open');if(arr)arr.textContent='▲';opened=true;}
      }
    });
    if(!opened&&monthOrder.length){
      const body=document.getElementById('sco_m0');
      const arr=document.getElementById('arr_sco_m0');
      if(body){body.classList.add('open');if(arr)arr.textContent='▲';}
    }
  }
}

// ── SCORE SAVE ────────────────────────────────────────────────────────────────
function saveScore(id,input,side){
  if(!isAdmin){showToast('🔒 Unlock Admin to enter scores');return;}
  const val=parseInt(input.value);
  if(isNaN(val)||val<0){input.value='';return;}
  if(!G.scores[id]) G.scores[id]={h:'',a:''};
  G.scores[id][side]=val;
  saveData();
  renderSched();
  renderStandings();
}

function saveWeather(id){
  if(!isAdmin){showToast('🔒 Unlock Admin to enter scores');return;}
  G.scores[id]={h:7,a:7,wx:true};
  saveData();
  renderScores();
  renderSched();
  renderStandings();
}
