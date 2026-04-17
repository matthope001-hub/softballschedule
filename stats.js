// ── STATS ─────────────────────────────────────────────────────────────────────

const TEAM_COLOURS=[
  '#e63946','#2a9d8f','#f4a261','#264653','#6a4c93',
  '#1982c4','#8ac926','#e9c46a','#ff595e','#4cc9f0'
];

function renderStats(){
  const el=document.getElementById('sta');
  if(!el)return;
  if(!document.getElementById('tab-stats')?.classList.contains('active')){
    el.dataset.stale='1';return;
  }
  el.dataset.stale='0';
  if(!G.sched.length){el.innerHTML='<div class="empty">Generate a schedule to view stats</div>';return;}

  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const allTeams=G.teams;
  const schedDiamondIds=[...new Set(G.sched.map(g=>g.diamond))].sort((a,b)=>a-b);

  // ── accumulate ──
  const ts={};
  for(const t of allTeams){ts[t]={total:0,home:0,away:0,dh:0,fields:{}};schedDiamondIds.forEach(d=>ts[t].fields[d]=0);}
  const h2h={};const coGames={};
  for(const t of leagueTeams){h2h[t]={};for(const u of leagueTeams)h2h[t][u]=0;coGames[t]=0;}
  const nightCount={};

  for(const g of G.sched){
    if(ts[g.home]){ts[g.home].total++;ts[g.home].home++;ts[g.home].fields[g.diamond]=(ts[g.home].fields[g.diamond]||0)+1;}
    if(ts[g.away]){ts[g.away].total++;ts[g.away].away++;ts[g.away].fields[g.diamond]=(ts[g.away].fields[g.diamond]||0)+1;}
    if(h2h[g.home]&&h2h[g.home][g.away]!==undefined)h2h[g.home][g.away]++;
    if(h2h[g.away]&&h2h[g.away][g.home]!==undefined)h2h[g.away][g.home]++;
    if(g.crossover){if(coGames[g.home]!==undefined)coGames[g.home]++;if(coGames[g.away]!==undefined)coGames[g.away]++;}
    const key=`${g.date}§${g.diamond}`;
    nightCount[key]=(nightCount[key]||0)+1;
  }
  for(const g of G.sched){
    const key=`${g.date}§${g.diamond}`;
    if((nightCount[key]||0)>=2){if(ts[g.home])ts[g.home].dh++;if(ts[g.away])ts[g.away].dh++;}
  }

  // ── season highlights ──
  const scored=G.sched.filter(g=>G.scores[g.id]&&!g.playoff);
  const teamW={},teamL={},teamRF={},teamRA={};
  let totalRuns=0,shutouts=0,biggestMargin=0,biggestGame=null,highestTotal=0,highestGame=null;
  for(const t of leagueTeams){teamW[t]=0;teamL[t]=0;teamRF[t]=0;teamRA[t]=0;}
  for(const g of scored){
    const sc=G.scores[g.id];
    const tot=sc.h+sc.a;
    totalRuns+=tot;
    if(sc.h===0||sc.a===0)shutouts++;
    const margin=Math.abs(sc.h-sc.a);
    if(margin>biggestMargin){biggestMargin=margin;biggestGame=g;}
    if(tot>highestTotal){highestTotal=tot;highestGame=g;}
    if(leagueTeams.includes(g.home)){teamRF[g.home]+=sc.h;teamRA[g.home]+=sc.a;if(sc.h>sc.a)teamW[g.home]++;else if(sc.a>sc.h)teamL[g.home]++;}
    if(leagueTeams.includes(g.away)){teamRF[g.away]+=sc.a;teamRA[g.away]+=sc.h;if(sc.a>sc.h)teamW[g.away]++;else if(sc.h>sc.a)teamL[g.away]++;}
  }
  const avgRuns=scored.length?(Math.round(totalRuns/scored.length*10)/10):0;
  const mostRF=leagueTeams.slice().sort((a,b)=>(teamRF[b]||0)-(teamRF[a]||0));
  const bestDef=leagueTeams.slice().sort((a,b)=>(teamRA[a]||0)-(teamRA[b]||0));
  const mostW=leagueTeams.slice().sort((a,b)=>(teamW[b]||0)-(teamW[a]||0));
  const mostL=leagueTeams.slice().sort((a,b)=>(teamL[b]||0)-(teamL[a]||0));

  function hCard(icon,label,value,sub){
    return`<div style="padding:12px 14px;background:var(--white);border:1.5px solid var(--border);border-radius:6px;display:flex;flex-direction:column;gap:2px;min-width:0">
      <div style="font-size:18px;line-height:1">${icon}</div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-top:4px">${label}</div>
      <div style="font-size:13px;font-weight:800;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(value)}</div>
      ${sub?`<div style="font-size:11px;color:var(--muted)">${sub}</div>`:''}
    </div>`;
  }

  const bwSc=biggestGame?G.scores[biggestGame.id]:null;
  const hsSc=highestGame?G.scores[highestGame.id]:null;
  const played=scored.length;
  const total=G.sched.filter(g=>!g.playoff).length;

  // ── inject scoped styles once ──
  if(!document.getElementById('_stats_css')){
    const s=document.createElement('style');
    s.id='_stats_css';
    s.textContent=`
      .st2{border-collapse:collapse;width:100%;font-size:13px}
      .st2 th,.st2 td{padding:8px 12px;border-bottom:1px solid var(--border);white-space:nowrap}
      .st2 thead th{background:var(--surface2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);border-bottom:2px solid var(--border)}
      .st2 tbody tr:last-child td,.st2 tbody tr:last-child th{border-bottom:none}
      .st2 tbody tr:hover{background:var(--surface2)}
      .st2 .row-label{text-align:left;font-weight:600;color:var(--text)}
      .st2 .num{font-family:var(--mono);text-align:center;color:var(--text)}
      .st2 .num-dim{font-family:var(--mono);text-align:center;color:var(--muted)}
      .st2 .num-bold{font-family:var(--mono);text-align:center;font-weight:800;color:var(--navy)}
      .st2 .co-row{background:#f0fff4!important}
      .st2 .co-row .row-label{color:#15803d;font-weight:700}
      .st2 .self-cell{background:var(--surface2);text-align:center;color:var(--muted)}
      .st2 .h2h-match{font-family:var(--mono);text-align:center;font-weight:700;color:var(--navy)}
      .st2 .h2h-zero{font-family:var(--mono);text-align:center;color:var(--muted)}
      .st2 .h2h-co{font-family:var(--mono);text-align:center;font-weight:700;color:#15803d;background:#f0fff4}
      .st2 .h2h-col-head{background:var(--surface2);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--muted);text-align:center;border-bottom:2px solid var(--border);max-width:52px;overflow:hidden;text-overflow:ellipsis}
      .st2 .h2h-co-head{background:#f0fff4;font-size:10px;font-weight:700;color:#15803d;text-align:center;border-bottom:2px solid var(--border)}
      .mat-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
    `;
    document.head.appendChild(s);
  }

  // ── h2h column abbreviations ──
  function abbr(name){
    const w=name.trim().split(/\s+/);
    if(w.length===1)return name.slice(0,5).toUpperCase();
    // Use first letter of each word, max 4 chars
    return w.map(x=>x[0]).join('').toUpperCase().slice(0,4);
  }

  // ── diamond columns (collapsed by default) ──
  const dHeads=schedDiamondIds.map(d=>`<th class="h2h-col-head" style="min-width:44px">D${d}</th>`).join('');
  const dToggle=`<button id="_stats_dtoggle" onclick="statsToggleDcols()" style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:5px;border:1.5px solid var(--border);background:var(--white);color:var(--muted);cursor:pointer;margin-left:auto">D-cols ▾</button>`;

  // ── build games-per-team table ──
  const gptRows=allTeams.map(t=>{
    const s=ts[t];
    const isCO=t===CROSSOVER;
    const dCells=schedDiamondIds.map(d=>{
      const v=s.fields[d]||0;
      return`<td class="st2-dcol${v===0?' num-dim':' num'}" style="display:none;text-align:center;font-family:var(--mono);padding:8px 12px;border-bottom:1px solid var(--border)">${v||'—'}</td>`;
    }).join('');
    return`<tr class="${isCO?'co-row':''}">
      <th class="row-label" style="padding:8px 12px;border-bottom:1px solid var(--border)">${esc(t)}${isCO?'<span style="font-size:10px;font-weight:800;color:#15803d;margin-left:5px;background:#dcfce7;padding:1px 5px;border-radius:3px;vertical-align:middle">CO</span>':''}</th>
      <td class="num-bold" style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:center;font-family:var(--mono);font-size:14px;font-weight:800;color:var(--navy)">${s.total}</td>
      <td class="num" style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:center;font-family:var(--mono)">${s.home}</td>
      <td class="num" style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:center;font-family:var(--mono)">${s.away}</td>
      <td class="num" style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:center;font-family:var(--mono);color:var(--muted)">${s.dh}</td>
      ${dCells}
    </tr>`;
  }).join('');

  const dHeadCells=schedDiamondIds.map(d=>`<th class="st2-dcol-head" style="display:none;min-width:44px;background:var(--surface2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);text-align:center;padding:8px 12px;border-bottom:2px solid var(--border)">D${d}</th>`).join('');

  // ── build h2h matrix ──
  const h2hColHeads=leagueTeams.map(t=>`<th class="h2h-col-head" title="${esc(t)}" style="padding:8px 6px;min-width:52px;max-width:52px;text-overflow:ellipsis;overflow:hidden">${abbr(t)}</th>`).join('');

  const h2hRows=leagueTeams.map(r=>{
    const cells=leagueTeams.map(c=>{
      if(r===c)return`<td class="self-cell" style="padding:8px 6px;border-bottom:1px solid var(--border)">—</td>`;
      const v=h2h[r][c]||0;
      return`<td class="${v>=2?'h2h-match':'h2h-zero'}" style="padding:8px 6px;border-bottom:1px solid var(--border)">${v}</td>`;
    }).join('');
    return`<tr>
      <th style="text-align:left;padding:8px 12px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px;white-space:nowrap;min-width:130px">${esc(r)}</th>
      ${cells}
      <td class="h2h-co" style="padding:8px 6px;border-bottom:1px solid var(--border)">${coGames[r]||0}</td>
    </tr>`;
  }).join('');

  // ── diamond usage ──
  const dUsage=schedDiamondIds.map(d=>{
    const tot=allTeams.reduce((s,t)=>s+(ts[t]?.fields[d]||0),0);
    const pct=total>0?Math.round(tot/total*100):0;
    return`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:var(--mono);font-size:12px;font-weight:800;color:var(--navy);min-width:26px">D${d}</span>
      <span style="font-size:12px;color:var(--muted);flex:1">${esc(getDiamondName(d))}</span>
      <div style="width:80px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:var(--navy);border-radius:3px"></div>
      </div>
      <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--text);min-width:52px;text-align:right">${tot} games</span>
    </div>`;
  }).join('');

  el.innerHTML=`
  <div class="metric-grid" style="margin-bottom:12px">
    <div class="metric"><div class="metric-label">Games Played</div><div class="metric-value">${played}</div></div>
    <div class="metric"><div class="metric-label">Remaining</div><div class="metric-value">${total-played}</div></div>
    <div class="metric"><div class="metric-label">Total Games</div><div class="metric-value">${total}</div></div>
    <div class="metric"><div class="metric-label">Avg Runs/Game</div><div class="metric-value">${played?avgRuns:'—'}</div></div>
  </div>

  ${played?`<div class="card" style="margin-bottom:12px">
    <div class="card-title">⚡ Season Highlights</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
      ${hCard('🏏','Most Runs Scored',mostRF[0]||'—',mostRF[0]?`${teamRF[mostRF[0]]} runs`:'')}
      ${hCard('🛡','Best Defense',bestDef[0]||'—',bestDef[0]?`${teamRA[bestDef[0]]} allowed`:'')}
      ${hCard('🥇','Most Wins',mostW[0]||'—',mostW[0]?`${teamW[mostW[0]]} wins`:'')}
      ${hCard('📉','Most Losses',mostL[0]||'—',mostL[0]?`${teamL[mostL[0]]} losses`:'')}
      ${hCard('💥','Biggest Win',biggestGame?(bwSc.h>bwSc.a?biggestGame.home:biggestGame.away):'—',biggestGame?`${Math.max(bwSc.h,bwSc.a)}–${Math.min(bwSc.h,bwSc.a)} (+${biggestMargin} runs)`:'')}
      ${hCard('🔥','Highest Scoring',highestGame?`${highestGame.home} vs ${highestGame.away}`:'—',highestGame?`${hsSc.h}–${hsSc.a} (${highestTotal} runs)`:'')}
      ${hCard('🦺','Shutouts',String(shutouts),'combined')}
      ${hCard('⚾','Total Runs',String(totalRuns),'this season')}
    </div>
  </div>`:''}

  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div class="card-title" style="margin:0">Games Per Team</div>
      ${dToggle}
    </div>
    <div class="mat-wrap">
      <table class="st2">
        <thead><tr>
          <th style="text-align:left;min-width:140px">Team</th>
          <th style="min-width:52px;text-align:center">Total</th>
          <th style="min-width:52px;text-align:center">Home</th>
          <th style="min-width:52px;text-align:center">Away</th>
          <th style="min-width:68px;text-align:center">DH Nights</th>
          ${dHeadCells}
        </tr></thead>
        <tbody>${gptRows}</tbody>
      </table>
    </div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div style="margin-bottom:6px">
      <div class="card-title" style="margin-bottom:2px">Head-to-Head Matrix</div>
      <div style="font-size:11px;color:var(--muted)">Scheduled games per pair · <strong style="color:#15803d">CO</strong> col = vs CrossOver · Bold = matchup complete (≥2)</div>
    </div>
    <div class="mat-wrap">
      <table class="st2">
        <thead><tr>
          <th style="text-align:left;min-width:130px">vs →</th>
          ${h2hColHeads}
          <th class="h2h-co-head" style="padding:8px 6px;min-width:44px">CO</th>
        </tr></thead>
        <tbody>${h2hRows}</tbody>
      </table>
    </div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="card-title" style="margin-bottom:8px">Diamond Usage</div>
    ${dUsage}
  </div>

  <div class="card">
    <div class="card-title">📈 Standings History</div>
    <div id="standings-history-chart" style="height:260px;position:relative"></div>
  </div>`;

  try{renderStandingsHistoryChart();}catch(e){}
}

// ── diamond column toggle ─────────────────────────────────────────────────────
function statsToggleDcols(){
  const btn=document.getElementById('_stats_dtoggle');
  const heads=document.querySelectorAll('.st2-dcol-head');
  const cells=document.querySelectorAll('.st2-dcol');
  const showing=btn&&btn.textContent.includes('▴');
  const display=showing?'none':'';
  heads.forEach(el=>el.style.display=display);
  cells.forEach(el=>el.style.display=display);
  if(btn)btn.textContent=showing?'D-cols ▾':'D-cols ▴';
}

// ── standings history chart ───────────────────────────────────────────────────
function renderStandingsHistoryChart(){
  const el=document.getElementById('standings-history-chart');
  if(!el)return;
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const scoredGames=G.sched.filter(g=>G.scores[g.id]&&!g.playoff&&!g.crossover)
    .sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  if(!scoredGames.length){
    el.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:13px">No scored games yet</div>';
    return;
  }
  const pts={};for(const t of leagueTeams)pts[t]=0;
  const snapshots=[];
  for(const g of scoredGames){
    const sc=G.scores[g.id];
    if(leagueTeams.includes(g.home)){if(sc.h>sc.a)pts[g.home]+=2;else if(sc.h===sc.a)pts[g.home]+=1;}
    if(leagueTeams.includes(g.away)){if(sc.a>sc.h)pts[g.away]+=2;else if(sc.h===sc.a)pts[g.away]+=1;}
    snapshots.push({date:g.date,...Object.fromEntries(leagueTeams.map(t=>[t,pts[t]]))});
  }
  const W=el.offsetWidth||600,H=260;
  const pad={t:10,r:10,b:30,l:28};
  const cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  const maxPts=Math.max(1,...leagueTeams.map(t=>pts[t]));
  const n=snapshots.length;
  const xScale=i=>pad.l+i*(cw/(n-1||1));
  const yScale=v=>pad.t+ch-(v/maxPts)*ch;
  const lines=leagueTeams.map((t,ti)=>{
    const col=TEAM_COLOURS[ti%TEAM_COLOURS.length];
    const d=snapshots.map((s,i)=>`${i===0?'M':'L'}${xScale(i).toFixed(1)},${yScale(s[t]).toFixed(1)}`).join(' ');
    return`<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`;
  }).join('');
  const xLabels=[];
  const step=Math.max(1,Math.floor(n/6));
  for(let i=0;i<n;i+=step){
    const[,m,day]=snapshots[i].date.split('-');
    xLabels.push(`<text x="${xScale(i).toFixed(1)}" y="${H-6}" text-anchor="middle" font-size="10" fill="var(--muted)">${parseInt(m)}/${parseInt(day)}</text>`);
  }
  const yLines=[];
  const yStep=Math.ceil(maxPts/4);
  for(let v=0;v<=maxPts;v+=yStep){
    yLines.push(`<text x="${pad.l-4}" y="${(yScale(v)+4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`);
    yLines.push(`<line x1="${pad.l}" y1="${yScale(v).toFixed(1)}" x2="${W-pad.r}" y2="${yScale(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`);
  }
  const legend=leagueTeams.map((t,ti)=>`<div style="display:flex;align-items:center;gap:4px;font-size:11px;white-space:nowrap"><span style="width:12px;height:3px;background:${TEAM_COLOURS[ti%TEAM_COLOURS.length]};display:inline-block;border-radius:2px"></span>${esc(t)}</div>`).join('');
  el.innerHTML=`
    <svg width="${W}" height="${H}" style="display:block;overflow:visible">${yLines.join('')}${lines}${xLabels.join('')}</svg>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;padding:0 ${pad.l}px">${legend}</div>`;
}
