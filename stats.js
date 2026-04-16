// ── STATS + STANDINGS HISTORY ─────────────────────────────────────────────────

const TEAM_COLOURS=[
  '#e63946','#2a9d8f','#e9c46a','#264653','#f4a261',
  '#6a4c93','#1982c4','#8ac926','#ff595e'
];

function renderStats(){
  const el=document.getElementById('sta');
  if(!el)return;
  const tabActive=document.getElementById('tab-stats')?.classList.contains('active');
  if(!tabActive){el.dataset.stale='1';return;}
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
    // DH count — same night same diamond
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
    if(leagueTeams.includes(g.home)){teamRF[g.home]=(teamRF[g.home]||0)+sc.h;teamRA[g.home]=(teamRA[g.home]||0)+sc.a;if(sc.h>sc.a)teamW[g.home]++;else if(sc.a>sc.h)teamL[g.home]++;}
    if(leagueTeams.includes(g.away)){teamRF[g.away]=(teamRF[g.away]||0)+sc.a;teamRA[g.away]=(teamRA[g.away]||0)+sc.h;if(sc.a>sc.h)teamW[g.away]++;else if(sc.h>sc.a)teamL[g.away]++;}
  }
  const avgRunsPerGame=scored.length?Math.round(totalRunsScored/scored.length*10)/10:0;
  const mostRuns=leagueTeams.length?leagueTeams.reduce((a,b)=>(teamRF[a]||0)>=(teamRF[b]||0)?a:b,leagueTeams[0]):'';
  const bestDef=leagueTeams.length?leagueTeams.reduce((a,b)=>(teamRA[a]||0)<=(teamRA[b]||0)?a:b,leagueTeams[0]):'';
  const mostWins=leagueTeams.length?leagueTeams.reduce((a,b)=>(teamW[a]||0)>=(teamW[b]||0)?a:b,leagueTeams[0]):'';
  const mostLosses=leagueTeams.length?leagueTeams.reduce((a,b)=>(teamL[a]||0)>=(teamL[b]||0)?a:b,leagueTeams[0]):'';

  const sorted=leagueTeams.slice().sort((a,b)=>ts[b].total-ts[a].total);

  const gpRows=sorted.map(t=>{
    const s=ts[t];
    const imb=s.home&&s.away&&Math.abs(s.home-s.away)>2;
    return`<tr>
      <td>${esc(t)}</td>
      <td class="gold">${s.total}</td>
      <td class="${imb?'warn':''}">${s.home}</td>
      <td class="${imb?'warn':''}">${s.away}</td>
      <td>${s.dh}</td>
    </tr>`;
  }).join('');

  el.innerHTML=`
  <div class="card">
    <div class="card-title">⚡ Season Highlights</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px">
      <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Most Runs Scored</div>
        <div style="font-size:18px;font-weight:800;color:var(--navy)">${esc(mostRuns)}</div>
        <div style="font-size:12px;color:var(--muted)">${teamRF[mostRuns]||0} runs</div>
      </div>
      <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Best Defense</div>
        <div style="font-size:18px;font-weight:800;color:var(--navy)">${esc(bestDef)}</div>
        <div style="font-size:12px;color:var(--muted)">${teamRA[bestDef]||0} runs allowed</div>
      </div>
      <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Most Wins</div>
        <div style="font-size:18px;font-weight:800;color:var(--navy)">${esc(mostWins)}</div>
        <div style="font-size:12px;color:var(--muted)">${teamW[mostWins]||0} wins</div>
      </div>
      <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Most Losses</div>
        <div style="font-size:18px;font-weight:800;color:var(--navy)">${esc(mostLosses)}</div>
        <div style="font-size:12px;color:var(--muted)">${teamL[mostLosses]||0} losses</div>
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
    ${biggestWinGame?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="padding:12px;background:#fff8ee;border:1px solid #fcd34d;border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Biggest Win</div>
        <div style="font-size:13px;font-weight:700">${esc(G.scores[biggestWinGame.id].h>G.scores[biggestWinGame.id].a?biggestWinGame.home:biggestWinGame.away)}</div>
        <div style="font-size:12px;color:var(--muted)">${G.scores[biggestWinGame.id].h}–${G.scores[biggestWinGame.id].a} · ${biggestWinGame.date}</div>
      </div>
      <div style="padding:12px;background:#fff8ee;border:1px solid #fcd34d;border-radius:var(--r-sm)">
        <div style="font-size:10px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:4px">Highest Scoring Game</div>
        <div style="font-size:13px;font-weight:700">${highestGame?esc(highestGame.home)+' vs '+esc(highestGame.away):''}</div>
        <div style="font-size:12px;color:var(--muted)">${highestGame?G.scores[highestGame.id].h+'–'+G.scores[highestGame.id].a+' · '+highestGame.date:''}</div>
      </div>
    </div>`:''}
  </div>

  <div class="card">
    <div class="card-title">Games Per Team</div>
    <div class="notice">Amber = Home/Away imbalance &gt; 2</div>
    <table class="games-table"><thead><tr><th>Team</th><th>Total</th><th>Home</th><th>Away</th><th>DH Nights</th></tr></thead>
    <tbody>${gpRows}</tbody></table>
  </div>

  <div class="card">
    <div class="card-title">Diamond Usage — Overall</div>
    <table class="games-table"><thead><tr><th>Diamond</th><th>Lights</th><th>Total Games</th></tr></thead>
    <tbody>${schedDiamondIds.map(d=>`<tr><td>${getDiamondName(d)}</td><td>${isDiamondLit(d)?'Yes':'No'}</td><td class="gold">${dTotal[d]||0}</td></tr>`).join('')}</tbody></table>
  </div>

  <div class="card">
    <div class="card-title">Diamond Usage — Per Team</div>
    <div class="notice">Amber = Spread &gt; 2 between most and least used diamond</div>
    <div class="matrix-wrap"><table class="matrix">
      <thead><tr><th class="row-label">Team</th>${schedDiamondIds.map(d=>`<th title="${getDiamondName(d)}">D${d}</th>`).join('')}</tr></thead>
      <tbody>${sorted.map(t=>{
        const vals=schedDiamondIds.map(d=>ts[t].fields[d]||0);
        const nonZero=vals.filter(v=>v>0);
        const imb=nonZero.length>1&&Math.max(...nonZero)-Math.min(...nonZero)>2;
        const mx=Math.max(...vals);
        return`<tr><th class="row-label">${esc(t)}</th>${schedDiamondIds.map((d,i)=>`<td class="${vals[i]>0&&vals[i]===mx?'played':''} ${imb?'warn':''}">${vals[i]}</td>`).join('')}</tr>`;
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
  if(!dates.length){container.innerHTML='<div class="empty" style="padding:1.5rem">Enter some scores to see how standings have changed over the season.</div>';return;}
  const n=leagueTeams.length;
  const W=container.clientWidth||700;
  const H=340;
  const PAD={top:20,right:20,bottom:56,left:36};
  const chartW=W-PAD.left-PAD.right;
  const chartH=H-PAD.top-PAD.bottom;
  const xStep=dates.length>1?chartW/(dates.length-1):chartW;
  const yStep=chartH/(n-1||1);
  function xOf(i){return PAD.left+(dates.length>1?i*xStep:chartW/2);}
  function yOf(pos){return PAD.top+(pos-1)*yStep;}
  let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:${H}px">`;
  // Grid lines
  for(let p=1;p<=n;p++){
    const y=yOf(p);
    svg+=`<line x1="${PAD.left}" y1="${y}" x2="${W-PAD.right}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`;
    svg+=`<text x="${PAD.left-6}" y="${y+4}" text-anchor="end" font-size="10" fill="#9ca3af">${p}</text>`;
  }
  // Lines per team
  leagueTeams.forEach((t,ti)=>{
    const pos=positions[t];
    if(!pos||!pos.length)return;
    const color=TEAM_COLOURS[ti%TEAM_COLOURS.length];
    const pts=pos.map((p,i)=>`${xOf(i)},${yOf(p)}`).join(' ');
    svg+=`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    pos.forEach((p,i)=>{svg+=`<circle cx="${xOf(i)}" cy="${yOf(p)}" r="3" fill="${color}"/>`;});
    const last=pos[pos.length-1];
    svg+=`<text x="${xOf(pos.length-1)+6}" y="${yOf(last)+4}" font-size="10" fill="${color}" font-weight="600">${esc(t)}</text>`;
  });
  // X axis date labels (sample up to 6)
  const step=Math.max(1,Math.floor(dates.length/6));
  for(let i=0;i<dates.length;i+=step){
    const[,m,d]=dates[i].split('-');
    svg+=`<text x="${xOf(i)}" y="${H-PAD.bottom+14}" text-anchor="middle" font-size="9" fill="#9ca3af">${parseInt(m)}/${parseInt(d)}</text>`;
  }
  svg+='</svg>';
  container.innerHTML=svg;
}
