// ── STATS ─────────────────────────────────────────────────────────────────────

const TEAM_COLOURS=[
  '#e63946','#2a9d8f','#f4a261','#264653','#6a4c93',
  '#1982c4','#8ac926','#e9c46a','#ff595e','#4cc9f0'
];

function renderStats(){
  const el=document.getElementById('sta');
  if(!el)return;
  // OPT 6: stale guard — skip expensive render when tab is not visible.
  // Marked stale by _markStaleAndRenderActive(); re-renders on tab switch.
  const tabActive=document.getElementById('tab-stats')?.classList.contains('active');
  if(!tabActive){el.dataset.stale='1';return;}
  if(el.dataset.stale) delete el.dataset.stale;

  if(!G.sched.length){
    el.innerHTML='<div class="empty">Generate a schedule to view stats<br><br><span style="font-size:12px;color:var(--muted)">Schedule data is needed for team statistics, head-to-head matchups, and diamond usage charts.</span></div>';
    return;
  }

  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const allTeams=G.teams;
  const schedDiamondIds=[...new Set(G.sched.filter(g=>!g.open&&g.diamond!=null).map(g=>g.diamond))].sort((a,b)=>a-b);

  const ts={};
  for(const t of allTeams){
    ts[t]={total:0,home:0,away:0,dh:0,fields:{}};
    schedDiamondIds.forEach(d=>ts[t].fields[d]=0);
  }
  const h2h={};const coGames={};
  for(const t of leagueTeams){h2h[t]={};for(const u of leagueTeams)h2h[t][u]=0;coGames[t]=0;}

  const dGameCount={};
  schedDiamondIds.forEach(d=>dGameCount[d]=0);

  const nightCount={};
  const dhNights={};

  for(const g of G.sched){
    if(g.open)continue;
    dGameCount[g.diamond]=(dGameCount[g.diamond]||0)+1;
    if(ts[g.home]){
      ts[g.home].total++;
      ts[g.home].home++;
      ts[g.home].fields[g.diamond]=(ts[g.home].fields[g.diamond]||0)+1;
    }
    if(ts[g.away]){
      ts[g.away].total++;
      ts[g.away].away++;
      ts[g.away].fields[g.diamond]=(ts[g.away].fields[g.diamond]||0)+1;
    }
    if(h2h[g.home]&&h2h[g.home][g.away]!==undefined)h2h[g.home][g.away]++;
    if(h2h[g.away]&&h2h[g.away][g.home]!==undefined)h2h[g.away][g.home]++;
    if(g.crossover){
      if(coGames[g.home]!==undefined)coGames[g.home]++;
      if(coGames[g.away]!==undefined)coGames[g.away]++;
    }
    const key=`${g.date}§${g.diamond}`;
    nightCount[key]=(nightCount[key]||0)+1;
  }
  // Count DH nights (1 per night per team, not 1 per game)
  for(const g of G.sched){
    if(g.open)continue;
    const key=`${g.date}§${g.diamond}`;
    if((nightCount[key]||0)>=2){
      const homeKey=`${g.home}§${g.date}`;
      const awayKey=`${g.away}§${g.date}`;
      if(ts[g.home]&&!dhNights[homeKey]){ts[g.home].dh++;dhNights[homeKey]=true;}
      if(ts[g.away]&&!dhNights[awayKey]){ts[g.away].dh++;dhNights[awayKey]=true;}
    }
  }

  // Count byes per team (game nights with no game scheduled)
  const ss=document.getElementById('ss')?.value||'';
  const se=document.getElementById('se')?.value||'';
  const days=getSelectedDays();
  const allNights=ss&&se&&days.length?getGameNights(ss,se,days):[];
  for(const t of allTeams) ts[t].byes=0;
  for(const night of allNights){
    const playingThatNight=new Set();
    for(const g of G.sched){
      if(g.date===night&&!g.open){
        if(g.home)playingThatNight.add(g.home);
        if(g.away)playingThatNight.add(g.away);
      }
    }
    if(playingThatNight.size>0){
      for(const t of allTeams){
        if(!playingThatNight.has(t))ts[t].byes++;
      }
    }
  }

  // Scored game highlights
  const scoredGames=G.sched.filter(g=>G.scores[g.id]&&!g.playoff&&!g.open);
  const total=G.sched.filter(g=>!g.playoff&&!g.open).length;
  const played=scoredGames.length;

  let totalRuns=0,shutouts=0;
  const teamRF={},teamRA={},teamW={},teamL={};
  for(const t of leagueTeams){teamRF[t]=0;teamRA[t]=0;teamW[t]=0;teamL[t]=0;}
  let biggestMargin=0,biggestGame=null,highestTotal=0,highestGame=null;
  for(const g of scoredGames){
    const sc=G.scores[g.id];
    totalRuns+=sc.h+sc.a;
    const margin=Math.abs(sc.h-sc.a);
    if(margin>biggestMargin){biggestMargin=margin;biggestGame=g;}
    const tot=sc.h+sc.a;
    if(tot>highestTotal){highestTotal=tot;highestGame=g;}
    if(sc.h===0||sc.a===0)shutouts++;
    if(leagueTeams.includes(g.home)){teamRF[g.home]+=sc.h;teamRA[g.home]+=sc.a;if(sc.h>sc.a)teamW[g.home]++;else if(sc.a>sc.h)teamL[g.home]++;}
    if(leagueTeams.includes(g.away)){teamRF[g.away]+=sc.a;teamRA[g.away]+=sc.h;if(sc.a>sc.h)teamW[g.away]++;else if(sc.h>sc.a)teamL[g.away]++;}
  }
  const avgRuns=played?(totalRuns/played).toFixed(1):'—';
  const mostRF=leagueTeams.slice().sort((a,b)=>(teamRF[b]||0)-(teamRF[a]||0));
  const bestDef=leagueTeams.slice().sort((a,b)=>(teamRA[a]||999)-(teamRA[b]||999));
  const mostW=leagueTeams.slice().sort((a,b)=>(teamW[b]||0)-(teamW[a]||0));
  const mostL=leagueTeams.slice().sort((a,b)=>(teamL[b]||0)-(teamL[a]||0));
  const bwSc=biggestGame?G.scores[biggestGame.id]:null;
  const hsSc=highestGame?G.scores[highestGame.id]:null;

  function hCard(icon,label,val,sub){
    return`<div style="background:var(--surface2);border-radius:var(--r-sm);padding:10px 12px;min-width:120px">
      <div style="font-size:18px;margin-bottom:4px">${icon}</div>
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">${label}</div>
      <div style="font-size:13px;font-weight:800;color:var(--navy)">${val}</div>
      ${sub?`<div style="font-size:11px;color:var(--muted);margin-top:2px">${sub}</div>`:''}
    </div>`;
  }

  // Inject styles once
  if(!document.getElementById('_stats_styles')){
    const s=document.createElement('style');
    s.id='_stats_styles';
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

  function abbr(name){
    const w=name.trim().split(/\s+/);
    if(w.length===1)return name.slice(0,5).toUpperCase();
    return w.map(x=>x[0]).join('').toUpperCase().slice(0,4);
  }

  const dHeadCells=schedDiamondIds.map(d=>`<th class="st2-dcol-head" style="display:none;min-width:44px;background:var(--surface2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);text-align:center;padding:8px 12px;border-bottom:2px solid var(--border)">D${d}</th>`).join('');
  const dToggle=`<button id="_stats_dtoggle" onclick="statsToggleDcols()" style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:5px;border:1.5px solid var(--border);background:var(--white);color:var(--muted);cursor:pointer;margin-left:auto">D-cols ▾</button>`;

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
      <td class="num" style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:center;font-family:var(--mono);color:var(--muted)">${s.byes}</td>
      ${dCells}
    </tr>`;
  }).join('');

  const h2hColHeads=leagueTeams.map(t=>`<th class="h2h-col-head" title="${esc(t)}" style="padding:8px 6px;min-width:52px;max-width:52px;text-overflow:ellipsis;overflow:hidden">${abbr(t)}</th>`).join('');
  const h2hRows=leagueTeams.map(r=>{
    const cells=leagueTeams.map(c=>{
      if(r===c)return`<td class="self-cell" style="padding:8px 6px;border-bottom:1px solid var(--border)">—</td>`;
      const v=h2h[r][c]||0;
      return`<td class="${v>=2?'h2h-match':'h2h-zero'}" style="padding:8px 6px;border-bottom:1px solid var(--border)">${v}</td>`;
    }).join('');
    return`<tr>
      <th class="row-label" style="padding:8px 12px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px;white-space:nowrap;min-width:130px">${esc(r)}</th>
      ${cells}
      <td class="h2h-co" style="padding:8px 6px;border-bottom:1px solid var(--border)">${coGames[r]||0}</td>
    </tr>`;
  }).join('');

  const dUsage=schedDiamondIds.map(d=>{
    const gameCount=dGameCount[d]||0;
    const pct=total>0?Math.round(gameCount/total*100):0;
    return`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:var(--mono);font-size:12px;font-weight:800;color:var(--navy);min-width:26px">D${d}</span>
      <span style="font-size:12px;color:var(--muted);flex:1">${esc(getDiamondName(d))}</span>
      <div style="width:80px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:var(--navy);border-radius:3px"></div>
      </div>
      <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--text);min-width:60px;text-align:right">${gameCount} games</span>
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
      ${hCard('💥','Biggest Win',biggestGame?(sc=>sc.h>sc.a?biggestGame.home:biggestGame.away)(bwSc):'—',biggestGame?`${Math.max(bwSc.h,bwSc.a)}–${Math.min(bwSc.h,bwSc.a)} (+${biggestMargin} runs)`:'')}
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
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Total = games a team appears in (home or away) · Byes = game nights with no game · Diamond cols = appearances on that diamond</div>
    <div class="mat-wrap">
      <table class="st2">
        <thead><tr>
          <th style="text-align:left;min-width:140px">Team</th>
          <th style="min-width:52px;text-align:center">Total</th>
          <th style="min-width:52px;text-align:center">Home</th>
          <th style="min-width:52px;text-align:center">Away</th>
          <th style="min-width:68px;text-align:center">DH Nights</th>
          <th style="min-width:52px;text-align:center">Byes</th>
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
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Actual games scheduled per diamond</div>
    ${dUsage}
  </div>

  <div class="card">
    <div class="card-title">📈 Standings History</div>
    <div id="standings-history-chart" style="height:260px;position:relative"></div>
  </div>`;

  const btn=document.getElementById('_stats_dtoggle');
  if(btn){
    btn.onclick=function(){
      const showing=btn.textContent.includes('▴');
      document.querySelectorAll('.st2-dcol-head,.st2-dcol').forEach(el=>el.style.display=showing?'none':'');
      btn.textContent=showing?'D-cols ▾':'D-cols ▴';
    };
  }

  try{renderStandingsHistoryChart();}catch(e){}
}

// ── diamond column toggle (global fallback) ───────────────────────────────────
function statsToggleDcols(){
  const btn=document.getElementById('_stats_dtoggle');
  if(btn)btn.onclick();
}

// ── standings history chart ───────────────────────────────────────────────────
function renderStandingsHistoryChart(){
  const el=document.getElementById('standings-history-chart');
  if(!el)return;
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const scoredGames=G.sched.filter(g=>!g.open&&G.scores[g.id]&&!g.playoff&&!g.crossover)
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
    const d=snapshots.map((s,i)=>`${i===0?'M':'L'}${xScale(i).toFixed(1)},${yScale(s[t]||0).toFixed(1)}`).join(' ');
    return`<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" opacity="0.85"/>
      <circle cx="${xScale(n-1).toFixed(1)}" cy="${yScale(pts[t]).toFixed(1)}" r="3" fill="${col}"/>`;
  }).join('');
  const yTicks=[0,Math.round(maxPts/2),maxPts].map(v=>`
    <line x1="${pad.l}" y1="${yScale(v).toFixed(1)}" x2="${pad.l+cw}" y2="${yScale(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>
    <text x="${pad.l-4}" y="${(yScale(v)+4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`).join('');
  const xLabels=snapshots.map((s,i)=>{
    if(n<=1||i===0||i===n-1||i===Math.floor(n/2)){
      return`<text x="${xScale(i).toFixed(1)}" y="${(pad.t+ch+18).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--muted)">${s.date.slice(5)}</text>`;
    }return'';
  }).join('');
  const legend=leagueTeams.map((t,ti)=>{
    const col=TEAM_COLOURS[ti%TEAM_COLOURS.length];
    return`<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text)">
      <span style="display:inline-block;width:14px;height:3px;background:${col};border-radius:2px;flex-shrink:0"></span>${esc(t)}
    </div>`;
  }).join('');
  el.innerHTML=`
    <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
      ${yTicks}${lines}${xLabels}
    </svg>
    <div style="display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:8px">${legend}</div>`;
}
