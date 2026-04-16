// ── SCHEDULE RENDER ───────────────────────────────────────────────────────────

function toggleAcc(id){
  const body=document.getElementById(id);
  if(!body) return;
  const isOpen=body.classList.toggle('open');
  const arr=document.getElementById('arr_'+id);
  if(arr) arr.textContent=isOpen?'▲':'▼';
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
  el.innerHTML=`<div class="season-banner">
    <span class="sb-title">⚾ ${G.currentSeason||2026} Season</span>
    <span class="sb-dates">${ss} → ${se}</span>
    <span class="sb-prog">${scored}/${total} games scored (${pct}%)</span>
  </div>`;
}

function renderLastResults(){
  const el=document.getElementById('last-results');
  if(!el) return;
  const scored=G.sched.filter(g=>G.scores[g.id]&&!g.playoff)
    .sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||'')).slice(0,5);
  if(!scored.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="last-results-wrap">
    <div class="section-label">Recent Results</div>
    <div class="result-cards">
    ${scored.map(g=>{
      const sc=G.scores[g.id];
      const hw=sc.h>sc.a,aw=sc.a>sc.h;
      return`<div class="result-card">
        <div class="result-row${hw?' win':''}">${esc(g.home)} <span class="result-score">${sc.h}</span></div>
        <div class="result-row${aw?' win':''}">${esc(g.away)} <span class="result-score">${sc.a}</span></div>
      </div>`;
    }).join('')}
    </div>
  </div>`;
}

function renderFilterChips(){
  const el=document.getElementById('team-filter-chips');
  if(!el) return;
  const filterBar=document.getElementById('team-filter-bar');
  const exportBar=document.getElementById('export-bar');
  if(!G.sched.length){
    if(filterBar) filterBar.classList.remove('vis');
    if(exportBar) exportBar.classList.remove('vis');
    return;
  }
  if(filterBar) filterBar.classList.add('vis');
  if(exportBar) exportBar.classList.add('vis');
  el.innerHTML=`<button onclick="setSchedFilter(null,this)" class="fc fc-all${schedFilterTeam===null?' active':''}">All</button>`
    +G.teams.map(t=>`<button onclick="setSchedFilter('${esc(t)}',this)" class="fc fc-team${schedFilterTeam===t?' active':''}">${esc(t)}</button>`).join('');
}

function setSchedFilter(team,btn){
  schedFilterTeam=team;
  document.querySelectorAll('.fc').forEach(b=>b.classList.remove('active'));
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

  const monthMap={},monthOrder=[];
  for(const g of filtered){
    const ml=monthLabel(g.date);
    if(!monthMap[ml]){monthMap[ml]=[];monthOrder.push(ml);}
    monthMap[ml].push(g);
  }

  let html='';
  monthOrder.forEach((month,mi)=>{
    let inner='';
    let lastDate='';
    let tableOpen=false;
    for(const g of monthMap[month]){
      if(g.date!==lastDate){
        if(tableOpen) inner+='</tbody></table>';
        inner+=`<div class="day-head">${fmtDate(g.date)}${sunsetBadge(g.date)}</div><table class="gt"><tbody>`;
        tableOpen=true;
        lastDate=g.date;
      }
      const sc=G.scores[g.id];
      const isCO=g.crossover,isPly=g.playoff;
      const trClass=isPly?'g-playoff':isCO?'g-co':'';
      const badge=isPly?'<span class="gbadge gbadge-ply">🏆 PLY</span>':
                  isCO?'<span class="gbadge gbadge-co">CO</span>':'';
      let midHtml='<span class="g-vs-lbl">vs</span>';
      if(sc){
        const hW=sc.h>sc.a,aW=sc.a>sc.h;
        midHtml=`<span class="gscore${hW?' gscore-w':aW?' gscore-l':''}">${sc.h}</span>`
               +`<span class="gscore-sep">–</span>`
               +`<span class="gscore${aW?' gscore-w':hW?' gscore-l':''}">${sc.a}</span>`;
      }
      inner+=`<tr class="${trClass}">
        <td class="g-num"><span class="gnum">#${g.id}</span></td>
        <td class="g-time"><span class="time-lbl${g.time==='8:15 PM'?' late':''}">${g.time||'TBD'}</span></td>
        <td class="g-home">${esc(g.home)}${badge}</td>
        <td class="g-vs">${midHtml}</td>
        <td class="g-away">${esc(g.away)}</td>
        <td class="g-dm"><span class="dbadge${isDiamondLit(g.diamond)?'':' nl'}">${getDiamondName(g.diamond)}</span></td>
      </tr>`;
    }
    if(tableOpen) inner+='</tbody></table>';
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
  const monthMap={},monthOrder=[];
  for(const g of nonPlayoff){
    const ml=monthLabel(g.date);
    if(!monthMap[ml]){monthMap[ml]=[];monthOrder.push(ml);}
    monthMap[ml].push(g);
  }

  let html='';
  monthOrder.forEach((month,mi)=>{
    let inner='';
    let lastDate='';
    let tableOpen=false;
    for(const g of monthMap[month]){
      if(g.date!==lastDate){
        if(tableOpen) inner+='</tbody></table>';
        inner+=`<div class="day-head">${fmtDate(g.date)}</div><table class="gt"><tbody>`;
        tableOpen=true;
        lastDate=g.date;
      }
      const sc=G.scores[g.id];
      const hVal=sc?sc.h:'',aVal=sc?sc.a:'';
      const isCO=g.crossover;
      const wxd=G.wxDates&&G.wxDates[g.id];
      inner+=`<tr class="${isCO?'g-co':''}${wxd?' wx-row':''}">
        <td class="g-num"><span class="gnum">#${g.id}</span></td>
        <td class="g-time"><span class="time-lbl${g.time==='8:15 PM'?' late':''}">${g.time||'TBD'}</span></td>
        <td class="g-home">${esc(g.home)}</td>
        <td class="g-si"><input class="si" type="number" min="0" max="99" value="${hVal}" placeholder="–"
          onchange="saveScore('${g.id}',this.value,document.getElementById('a_${g.id}')?.value)"
          id="h_${g.id}"/></td>
        <td class="g-sep">–</td>
        <td class="g-si"><input class="si" type="number" min="0" max="99" value="${aVal}" placeholder="–"
          onchange="saveScore('${g.id}',document.getElementById('h_${g.id}')?.value,this.value)"
          id="a_${g.id}"/></td>
        <td class="g-away">${esc(g.away)}</td>
        <td class="g-dm"><span class="dbadge${isDiamondLit(g.diamond)?'':' nl'}">${getDiamondName(g.diamond)}</span></td>
        <td class="g-wx"><button class="wx-btn" title="Weather cancellation (7–7 tie)" onclick="applyWeatherResult('${g.id}')">🌧</button></td>
      </tr>`;
    }
    if(tableOpen) inner+='</tbody></table>';
    const scoredCount=monthMap[month].filter(g=>G.scores[g.id]).length;
    html+=monthAccordion(month,inner,mi,'sco',scoredCount);
  });
  el.innerHTML=html;
}
