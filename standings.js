// ── STANDINGS ─────────────────────────────────────────────────────────────────
function capRuns(h,a){
  if(h===a)return{ch:h,ca:a};
  if(h>a)return{ch:Math.min(h,a+CAP),ca:a};
  return{ch:h,ca:Math.min(a,h+CAP)};
}

function renderStandings(){
  const el=document.getElementById('sto');
  const tabActive=document.getElementById('tab-standings')?.classList.contains('active');
  if(!tabActive){ if(el) el.dataset.stale='1'; return; }
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
  </div>
  <div class="card">
    <div class="card-title">📈 Standings History</div>
    <div id="standings-history-chart"></div>
  </div>`;

  // Render the chart after the DOM is updated
  setTimeout(renderStandingsHistoryChart, 0);
}
// ── STANDINGS HISTORY CHART ───────────────────────────────────────────────────

// 9 visually distinct colours for the 9 league teams
const TEAM_COLOURS = [
  '#e63946','#2a9d8f','#e9c46a','#264653','#f4a261',
  '#6a4c93','#1982c4','#8ac926','#ff595e'
];

function buildStandingsHistory() {
  const leagueTeams = G.teams.filter(t => t !== CROSSOVER);
  if (!leagueTeams.length) return { dates: [], positions: {} };

  // Get all unique scored game nights, sorted chronologically
  const scoredDates = [...new Set(
    G.sched
      .filter(g => !g.playoff && G.scores[g.id])
      .map(g => g.date)
  )].sort();

  if (!scoredDates.length) return { dates: [], positions: {} };

  // For each cumulative snapshot, calculate standings position
  const positions = {};
  for (const t of leagueTeams) positions[t] = [];

  for (const snapshotDate of scoredDates) {
    // Build stats using all non-playoff games on or before this date
    const stats = {};
    for (const t of leagueTeams) stats[t] = { pts: 0, rf: 0, ra: 0, gp: 0, w: 0, l: 0, tie: 0 };

    for (const g of G.sched) {
      if (g.playoff) continue;
      if (g.date > snapshotDate) continue;
      const sc = G.scores[g.id];
      if (!sc) continue;
      const { ch, ca } = capRuns(sc.h, sc.a);
      if (stats[g.home] !== undefined) {
        stats[g.home].gp++;
        stats[g.home].rf += ch;
        stats[g.home].ra += ca;
        if (sc.h > sc.a) { stats[g.home].w++; stats[g.home].pts += 2; }
        else if (sc.a > sc.h) stats[g.home].l++;
        else { stats[g.home].tie++; stats[g.home].pts++; }
      }
      if (stats[g.away] !== undefined) {
        stats[g.away].gp++;
        stats[g.away].rf += ca;
        stats[g.away].ra += ch;
        if (sc.a > sc.h) { stats[g.away].w++; stats[g.away].pts += 2; }
        else if (sc.h > sc.a) stats[g.away].l++;
        else { stats[g.away].tie++; stats[g.away].pts++; }
      }
    }

    // Rank teams at this snapshot
    const ranked = leagueTeams.slice().sort((a, b) =>
      stats[b].pts - stats[a].pts ||
      (stats[b].rf - stats[b].ra) - (stats[a].rf - stats[a].ra) ||
      a.localeCompare(b)
    );

    for (let i = 0; i < ranked.length; i++) {
      positions[ranked[i]].push(i + 1);
    }
  }

  return { dates: scoredDates, positions };
}

function renderStandingsHistoryChart() {
  const container = document.getElementById('standings-history-chart');
  if (!container) return;

  const leagueTeams = G.teams.filter(t => t !== CROSSOVER);
  const { dates, positions } = buildStandingsHistory();

  if (!dates.length) {
    container.innerHTML = '<div class="empty" style="padding:1.5rem">Enter some scores to see how standings have changed over the season.</div>';
    return;
  }

  const n = leagueTeams.length; // number of teams
  const W = container.clientWidth || 700;
  const H = 340;
  const PAD = { top: 20, right: 20, bottom: 56, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Map date index → x, position → y
  const xStep = dates.length > 1 ? chartW / (dates.length - 1) : chartW;
  const yStep = chartH / (n - 1 || 1);

  function xOf(i) { return PAD.left + (dates.length > 1 ? i * xStep : chartW / 2); }
  function yOf(pos) { return PAD.top + (pos - 1) * yStep; }

  // Build SVG
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:${H}px;display:block;overflow:visible">`;

  // Grid lines (horizontal — one per position)
  for (let p = 1; p <= n; p++) {
    const y = yOf(p);
    svg += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
    svg += `<text x="${PAD.left - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#94a3b8" font-family="ui-monospace,monospace">${p}</text>`;
  }

  // Vertical date markers
  dates.forEach((d, i) => {
    const x = xOf(i);
    svg += `<line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${H - PAD.bottom}" stroke="#f1f5f9" stroke-width="1"/>`;
    // Date label — show month+day, rotate for space
    const label = new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    svg += `<text x="${x}" y="${H - PAD.bottom + 14}" text-anchor="middle" font-size="10" fill="#94a3b8" font-family="ui-sans-serif,Arial">${label}</text>`;
  });

  // Lines + dots per team
  leagueTeams.forEach((team, ti) => {
    const colour = TEAM_COLOURS[ti % TEAM_COLOURS.length];
    const pts = positions[team] || [];
    if (!pts.length) return;

    // Line path
    const pathD = pts.map((pos, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(pos)}`).join(' ');
    svg += `<path d="${pathD}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;

    // Dots
    pts.forEach((pos, i) => {
      const x = xOf(i); const y = yOf(pos);
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="${colour}" stroke="white" stroke-width="1.5">
        <title>${esc(team)} — Week ${i + 1} (${dates[i]}): Position ${pos}</title>
      </circle>`;
    });

    // End label (last known position)
    const lastX = xOf(pts.length - 1);
    const lastY = yOf(pts[pts.length - 1]);
    // Only show label if we have room (not too crowded at the right edge)
    if (dates.length > 1) {
      svg += `<text x="${lastX + 7}" y="${lastY + 4}" font-size="10" font-weight="600" fill="${colour}" font-family="ui-sans-serif,Arial">${pts[pts.length - 1]}</text>`;
    }
  });

  svg += `</svg>`;

  // Legend
  const legendItems = leagueTeams.map((team, ti) => {
    const colour = TEAM_COLOURS[ti % TEAM_COLOURS.length];
    const lastPos = (positions[team] || []).slice(-1)[0];
    return `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text);white-space:nowrap">
      <svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke="${colour}" stroke-width="2.5"/><circle cx="9" cy="5" r="3.5" fill="${colour}" stroke="white" stroke-width="1"/></svg>
      <span>${esc(team)}${lastPos ? ' <span style="color:var(--muted)">(' + lastPos + ')</span>' : ''}</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">League position over time — lower number = higher in standings · hover dots for details</div>
    ${svg}
    <div style="display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:10px;padding:10px 12px;background:var(--gray1);border-radius:var(--r-sm)">${legendItems}</div>
  `;
}
