// ── STATS + STANDINGS HISTORY ─────────────────────────────────────────────────

const TEAM_COLOURS=[
  '#e63946','#2a9d8f','#f4a261','#264653','#6a4c93',
  '#1982c4','#8ac926','#e9c46a','#ff595e','#4cc9f0'
];

function renderStats(){
  const el=document.getElementById('sta');
  if(!el)return;
  // Only rebuild expensive stats+chart when tab is active; mark stale for lazy refresh
  if(!document.getElementById('tab-stats')?.classList.contains('active')){
    el.dataset.stale='1';
    return;
  }
  el.dataset.stale='0';
  if(!G.sched.length){el.innerHTML='<div class="empty">Generate a schedule to view stats</div>';return;}

  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const allTeams=G.teams;
  const schedDiamondIds=[...new Set(G.sched.map(g=>g.diamond))].sort((a,b)=>a-b);

  const ts={};
  for(const t of allTeams){ts[t]={total:0,home:0,away:0,dh:0,fields:{}};schedDiamondIds.forEach(d=>ts[t].fields[d]=0);}
  const h2h={};const coGames={};
  for(const t of leagueTeams){h2h[t]={};for(const u of leagueTeams)h2h[t][u]=0;coGames[t]=0;}
  const dTotal={};schedDiamondIds.forEach(d=>dTotal[d]=0);
  const nightCount={};

  for(const g of G.sched){
    dTotal[g.diamond]=(dTotal[g.diamond]||0)+1;
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

  // Season highlights
  const scored=G.sched.filter(g=>G.scores[g.id]&&!g.playoff);
  const teamW={},teamL={},teamRF={},teamRA={};
  let totalRunsScored=0,shutouts=0,biggestWinMargin=0,biggestWinGame=null,highestTotal=0,highestGame=null;
  for(const t of leagueTeams){teamW[t]=0;teamL[t]=0;teamRF[t]=0;teamRA[t]=0;}
  for(const g of scored){
    const sc=G.scores[g.id];
    const total=sc.h+sc.a;
    totalRunsScored+=total;
    if(sc.h===0||sc.a===0)shutouts++;
    const margin=Math.abs(sc.h-sc.a);
    if(margin>biggestWinMargin){biggestWinMargin=margin;biggestWinGame=g;}
    if(total>highestTotal){highestTotal=total;highestGame=g;}
    if(leagueTeams.includes(g.home)){teamRF[g.home]+=sc.h;teamRA[g.home]+=sc.a;if(sc.h>sc.a)teamW[g.home]++;else if(sc.a>sc.h)teamL[g.home]++;}
    if(leagueTeams.includes(g.away)){teamRF[g.away]+=sc.a;teamRA[g.away]+=sc.h;if(sc.a>sc.h)teamW[g.away]++;else if(sc.h>sc.a)teamL[g.away]++;}
  }
  const avgRuns=scored.length?Math.round(totalRunsScored/scored.length*10)/10:0;
  const mostRF=leagueTeams.slice().sort((a,b)=>(teamRF[b]||0)-(teamRF[a]||0));
  const bestDef=leagueTeams.slice().sort((a,b)=>(teamRA[a]||0)-(teamRA[b]||0));
  const mostW=leagueTeams.slice().sort((a,b)=>(teamW[b]||0)-(teamW[a]||0));
  const mostL=leagueTeams.slice().sort((a,b)=>(teamL[b]||0)-(teamL[a]||0));

  function highlightCard(icon,label,value,sub=''){
    return`<div style="padding:12px 14px;background:var(--white);border:1.5px solid var(--border);border-radius:var(--r-sm);display:flex;flex-direction:column;gap:2px">
      <div style="font-size:18px;line-height:1">${icon}</div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-top:4px">${label}</div>
      <div style="font-size:14px;font-weight:800;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(value)}</div>
      ${sub?`<div style="font-size:11px;color:var(--muted)">${sub}</div>`:''}
    </div>`;
  }

  const bwSc=biggestWinGame?G.scores[biggestWinGame.id]:null;
  const hsSc=highestGame?G.scores[highestGame.id]:null;
  const played=scored.length;
  const total=G.sched.filter(g=>!g.playoff).length;

  el.innerHTML=`
  <div class="metric-grid" style="margin-bottom:12px">
    <div class="metric"><div class="metric-label">Games Played</div><div class="metric-value">${played}</div></div>
    <div class="metric"><div class="metric-label">Remaining</div><div class="metric-value">${total-played}</div></div>
    <div class="metric"><div class="metric-label">Total Games</div><div class="metric-value">${total}</div></div>
    <div class="metric"><div class="metric-label">Avg Runs/Game</div><div class="metric-value">${played?avgRuns:'—'}</div></div>
  </div>

  ${played?`<div class="card">
    <div class="card-title">⚡ Season Highlights</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
      ${highlightCard('🏏','Most Runs Scored',mostRF[0]||'—',mostRF[0]?`${teamRF[mostRF[0]]} runs`:'')}
      ${highlightCard('🛡','Best Defense',bestDef[0]||'—',bestDef[0]?`${teamRA[bestDef[0]]} allowed`:'')}
      ${highlightCard('🥇','Most Wins',mostW[0]||'—',mostW[0]?`${teamW[mostW[0]]} wins`:'')}
      ${highlightCard('📉','Most Losses',mostL[0]||'—',mostL[0]?`${teamL[mostL[0]]} losses`:'')}
      ${highlightCard('💥','Biggest Win',biggestWinGame?(bwSc.h>bwSc.a?biggestWinGame.home:biggestWinGame.away):'—',biggestWinGame?`${Math.max(bwSc.h,bwSc.a)}–${Math.min(bwSc.h,bwSc.a)} (${biggestWinMargin} run margin)`:'')}
      ${highlightCard('🔥','Highest Scoring',highestGame?`${highestGame.home} vs ${highestGame.away}`:'—',highestGame?`${hsSc.h}–${hsSc.a} (${highestTotal} runs)`:'')}
      ${highlightCard('🦺','Shutouts',String(shutouts),'combined')}
      ${highlightCard('⚾','Total Runs',String(totalRunsScored),'this season')}
    </div>
  </div>`:''}

  <div class="card">
    <div class="card-title">Games Per Team</div>
    <div class="matrix-wrap"><table class="matrix">
      <thead><tr>
        <th class="row-label">Team</th>
        <th>Total</th><th>Home</th><th>Away</th><th>DH Nights</th>
        ${schedDiamondIds.map(d=>`<th>${esc(getDiamondName(d))}</th>`).join('')}
      </tr></thead>
      <tbody>${allTeams.map(t=>{
        const s=ts[t];
        const avg=allTeams.reduce((a,u)=>a+(ts[u]?.total||0),0)/allTeams.length;
        const imb=Math.abs(s.total-avg)>2;
        const vals=[s.total,s.home,s.away,s.dh,...schedDiamondIds.map(d=>s.fields[d]||0)];
        return`<tr><th class="row-label">${esc(t)}</th>${vals.map((v,i)=>`<td class="${i===0&&v>0?'played':''} ${i===0&&imb?'warn':''}">${v}</td>`).join('')}</tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>

  <div class="card">
    <div class="card-title">Head-to-Head Matrix</div>
    <div class="notice">Games scheduled between each pair · <span style="color:var(--green);font-weight:600">CO</span> = games vs CrossOver</div>
    <div class="matrix-wrap"><table class="matrix">
      <thead><tr><th class="row-label">vs →</th>${leagueTeams.map(t=>`<th class="col-head"><span>${esc(t)}</span></th>`).join('')}<th class="col-head" style="background:#f0fff4;border-color:#bbf7d0"><span style="color:#15803d">CrossOver</span></th></tr></thead>
      <tbody>${leagueTeams.map(r=>`<tr><th class="row-label">${esc(r)}</th>${leagueTeams.map(c=>r===c?`<td class="self">—</td>`:(h2h[r][c]>0?`<td class="played">${h2h[r][c]}</td>`:`<td class="zero">0</td>`)).join('')}<td style="background:#f0fff4;color:#15803d;font-weight:700;border-color:#bbf7d0;font-family:var(--mono)">${coGames[r]||0}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>

  <div class="card">
    <div class="card-title">📈 Standings History</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Position after each game night — 1st at top</div>
    <div id="standings-history-chart"></div>
  </div>`;

  setTimeout(renderStandingsHistoryChart,0);
}

function buildStandingsHistory(){
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  if(!leagueTeams.length)return{dates:[],positions:{}};
  const scoredDates=[...new Set(G.sched.filter(g=>!g.playoff&&G.scores[g.id]).map(g=>g.date))].sort();
  if(!scoredDates.length)return{dates:[],positions:{}};
  const positions={};
  for(const t of leagueTeams)positions[t]=[];
  for(const snapshotDate of scoredDates){
    const stats={};
    for(const t of leagueTeams)stats[t]={pts:0,rf:0,ra:0};
    for(const g of G.sched){
      if(g.playoff||g.date>snapshotDate)continue;
      const sc=G.scores[g.id];if(!sc)continue;
      const{ch,ca}=capRuns(sc.h,sc.a);
      if(stats[g.home]!==undefined){stats[g.home].rf+=ch;stats[g.home].ra+=ca;if(sc.h>sc.a)stats[g.home].pts+=2;else if(sc.h===sc.a)stats[g.home].pts+=1;}
      if(stats[g.away]!==undefined){stats[g.away].rf+=ca;stats[g.away].ra+=ch;if(sc.a>sc.h)stats[g.away].pts+=2;else if(sc.h===sc.a)stats[g.away].pts+=1;}
    }
    const ranked=leagueTeams.slice().sort((a,b)=>stats[b].pts-stats[a].pts||(stats[b].rf-stats[b].ra)-(stats[a].rf-stats[a].ra)||a.localeCompare(b));
    for(let i=0;i<ranked.length;i++)positions[ranked[i]].push(i+1);
  }
  return{dates:scoredDates,positions};
}

function renderStandingsHistoryChart(){
  const container=document.getElementById('standings-history-chart');
  if(!container)return;
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const{dates,positions}=buildStandingsHistory();

  if(!dates.length){
    container.innerHTML='<div class="empty" style="padding:1.5rem">Enter some scores to see how standings have shifted over the season.</div>';
    return;
  }

  const n=leagueTeams.length;
  const W=Math.max(container.clientWidth||600,340);
  const LEGEND_H=leagueTeams.length>5?44:24; // two rows if many teams
  const H=300+LEGEND_H;
  const PAD={top:16,right:16,bottom:32+LEGEND_H,left:28};
  const chartW=W-PAD.left-PAD.right;
  const chartH=H-PAD.top-PAD.bottom;

  const xOf=i=>PAD.left+(dates.length>1?(i/(dates.length-1))*chartW:chartW/2);
  const yOf=pos=>PAD.top+((pos-1)/(n-1||1))*chartH;

  let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;overflow:visible">`;

  // ── Background grid ──
  for(let p=1;p<=n;p++){
    const y=yOf(p);
    const isTop=p===1;
    svg+=`<line x1="${PAD.left}" y1="${y}" x2="${W-PAD.right}" y2="${y}"
      stroke="${isTop?'#c7d2fe':'#e5e7eb'}" stroke-width="${isTop?1.5:1}" stroke-dasharray="${isTop?'':'4 3'}"/>`;
    svg+=`<text x="${PAD.left-6}" y="${y+4}" text-anchor="end" font-size="10"
      fill="${isTop?'#4f46e5':'#9ca3af'}" font-weight="${isTop?'700':'400'}">${p}</text>`;
  }

  // ── X axis date labels ──
  const maxLabels=Math.min(dates.length,8);
  const labelStep=Math.max(1,Math.ceil(dates.length/maxLabels));
  for(let i=0;i<dates.length;i+=labelStep){
    const[,m,d]=dates[i].split('-');
    svg+=`<text x="${xOf(i)}" y="${H-PAD.bottom+14}" text-anchor="middle"
      font-size="9" fill="#9ca3af">${parseInt(m)}/${parseInt(d)}</text>`;
  }
  // Always label last date
  if(dates.length>1){
    const[,m,d]=dates[dates.length-1].split('-');
    svg+=`<text x="${xOf(dates.length-1)}" y="${H-PAD.bottom+14}" text-anchor="middle"
      font-size="9" fill="#9ca3af">${parseInt(m)}/${parseInt(d)}</text>`;
  }

  // ── Lines & dots per team ──
  leagueTeams.forEach((t,ti)=>{
    const pos=positions[t];
    if(!pos||!pos.length)return;
    const color=TEAM_COLOURS[ti%TEAM_COLOURS.length];

    // Line
    const pts=pos.map((p,i)=>`${xOf(i).toFixed(1)},${yOf(p).toFixed(1)}`).join(' ');
    svg+=`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"
      stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;

    // Dots (skip if dense)
    if(dates.length<=20){
      pos.forEach((p,i)=>{
        svg+=`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p).toFixed(1)}" r="${i===pos.length-1?4.5:3}"
          fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
      });
    } else {
      // Only draw first and last dot when dense
      [0,pos.length-1].forEach(i=>{
        svg+=`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(pos[i]).toFixed(1)}" r="3.5"
          fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
      });
    }
  });

  // ── Legend (bottom, wrapping rows) ──
  const COL_W=Math.floor(W/Math.min(leagueTeams.length,5));
  const legendY=H-LEGEND_H+4;
  leagueTeams.forEach((t,ti)=>{
    const col=ti%5;
    const row=Math.floor(ti/5);
    const lx=PAD.left+col*COL_W;
    const ly=legendY+row*20;
    const color=TEAM_COLOURS[ti%TEAM_COLOURS.length];
    // Current position badge
    const curPos=positions[t]?.length?positions[t][positions[t].length-1]:null;
    svg+=`<rect x="${lx}" y="${ly+1}" width="10" height="10" rx="2" fill="${color}"/>`;
    svg+=`<text x="${lx+14}" y="${ly+10}" font-size="10" fill="#374151" font-weight="500">${esc(t)}${curPos?` (${curPos})`:''}</text>`;
  });

  svg+='</svg>';
  container.innerHTML=svg;
}
