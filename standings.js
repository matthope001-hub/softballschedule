// ── STANDINGS ─────────────────────────────────────────────────────────────────

function capRuns(h,a){
  if(h===a)return{ch:h,ca:a};
  if(h>a)return{ch:Math.min(h,a+CAP),ca:a};
  return{ch:h,ca:Math.min(a,h+CAP)};
}

// ── SHARED TIEBREAK UTILITIES ─────────────────────────────────────────────────
// PATCH: extracted from computeStandings(), getRegularSeasonRanking(), and
// podRRStandings() — previously three independent copies. All callers now use
// these two functions, so any tiebreak fix applies everywhere at once.

// Build a h2h stats map for a set of teams and scored games.
// games must be pre-filtered (no playoffs, no crossover, scored only).
// Returns { [teamA]: { [teamB]: { pts: number, games: [{date,homePts}] } } }
function _buildH2H(teams,games){
  const h2h={};
  for(const t of teams){
    h2h[t]={};
    for(const u of teams) h2h[t][u]={pts:0,games:[]};
  }
  const sorted=[...games].sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  for(const g of sorted){
    if(!h2h[g.home]||!h2h[g.away]) continue;
    const sc=g.score||g._sc; // support both playoff game shape and sched shape
    if(!sc) continue;
    const hw=sc.h>sc.a,aw=sc.a>sc.h,tie=sc.h===sc.a;
    const homePts=hw?2:tie?1:0;
    const awayPts=aw?2:tie?1:0;
    h2h[g.home][g.away].pts+=homePts;
    h2h[g.home][g.away].games.push({date:g.date,homePts});
    h2h[g.away][g.home].pts+=awayPts;
    h2h[g.away][g.home].games.push({date:g.date,homePts:awayPts});
  }
  return h2h;
}

// Stable hash for deterministic coin-toss fallback.
function _stableHash(a,b){
  const s=a<b?a+b:b+a;
  let h=0;
  for(let i=0;i<s.length;i++) h=(Math.imul(31,h)+s.charCodeAt(i))|0;
  return h%2===0;
}

// Recursively rank a group of tied teams using the league tiebreak rules:
//   a) head-to-head points among tied teams
//   b) winner of most recent matchup among tied teams
//   c) stable hash coin-toss
// h2h: output of _buildH2H()
// Returns ordered array of team names (best first).
function _rankTiedGroup(group,h2h){
  if(group.length===1) return group;

  // a) head-to-head points
  const h2hPts={};
  for(const t of group){
    h2hPts[t]=0;
    for(const u of group) if(u!==t) h2hPts[t]+=h2h[t]?.[u]?.pts||0;
  }
  const maxH2H=Math.max(...group.map(t=>h2hPts[t]));
  const afterH2H=group.filter(t=>h2hPts[t]===maxH2H);

  if(afterH2H.length===1){
    return[afterH2H[0],..._rankTiedGroup(group.filter(t=>t!==afterH2H[0]),h2h)];
  }

  // b) most recent head-to-head matchup result
  const allGames=[];
  for(let i=0;i<afterH2H.length;i++)
    for(let j=i+1;j<afterH2H.length;j++){
      const a=afterH2H[i],b=afterH2H[j];
      for(const g of(h2h[a]?.[b]?.games||[]))
        allGames.push({date:g.date,winner:g.homePts===2?a:g.homePts===0?b:null});
    }
  allGames.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  for(const g of allGames){
    if(g.winner&&afterH2H.includes(g.winner)){
      return[g.winner,..._rankTiedGroup(afterH2H.filter(t=>t!==g.winner),h2h),
             ...group.filter(t=>!afterH2H.includes(t))];
    }
  }

  // c) stable hash coin-toss
  const sorted=[...afterH2H].sort((a,b)=>_stableHash(a,b)?-1:1);
  return[...sorted,...group.filter(t=>!afterH2H.includes(t))];
}

// Rank a full list of teams by pts desc, applying tiebreak within tied groups.
// stats: { [team]: { pts } }  h2h: output of _buildH2H()
// Returns [{ team, tied }]
function _rankTeams(teams,stats,h2h){
  const sorted=teams.slice().sort((a,b)=>stats[b].pts-stats[a].pts);
  const ranked=[];
  let i=0;
  while(i<sorted.length){
    let j=i+1;
    while(j<sorted.length&&stats[sorted[j]].pts===stats[sorted[i]].pts) j++;
    const group=sorted.slice(i,j);
    if(group.length===1){
      ranked.push({team:group[0],tied:false});
    } else {
      const order=_rankTiedGroup(group,h2h);
      ranked.push(...order.map((t,idx)=>({team:t,tied:true})));
    }
    i=j;
  }
  return ranked;
}

// ── OPT 2: computeStandings() — single source of truth ───────────────────────
// Returns { leagueTeams, stats, h2hStats, ranked, homeStats, awayStats,
//           teamResults, regularSeasonGames, gp }
function computeStandings(){
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const stats={};
  for(const t of leagueTeams) stats[t]={gp:0,w:0,l:0,tie:0,pts:0,rf:0,ra:0};

  for(const g of G.sched){
    if(g.playoff) continue;
    const sc=G.scores[g.id]; if(!sc) continue;
    const{ch,ca}=capRuns(sc.h,sc.a);
    if(stats[g.home]!==undefined){
      stats[g.home].gp++;stats[g.home].rf+=ch;stats[g.home].ra+=ca;
      if(sc.h>sc.a){stats[g.home].w++;stats[g.home].pts+=2;}
      else if(sc.a>sc.h) stats[g.home].l++;
      else{stats[g.home].tie++;stats[g.home].pts++;}
    }
    if(stats[g.away]!==undefined){
      stats[g.away].gp++;stats[g.away].rf+=ca;stats[g.away].ra+=ch;
      if(sc.a>sc.h){stats[g.away].w++;stats[g.away].pts+=2;}
      else if(sc.h>sc.a) stats[g.away].l++;
      else{stats[g.away].tie++;stats[g.away].pts++;}
    }
  }

  // Build h2h using shared utility — attach scores as _sc for shape compatibility
  const scoredLeagueGames=G.sched.filter(g=>
    G.scores[g.id]&&!g.playoff&&
    stats[g.home]!==undefined&&stats[g.away]!==undefined&&
    g.home!==CROSSOVER&&g.away!==CROSSOVER
  ).map(g=>({...g,_sc:G.scores[g.id]}));

  const h2hStats=_buildH2H(leagueTeams,scoredLeagueGames);
  const ranked=_rankTeams(leagueTeams,stats,h2hStats);

  // Home/away split and results timeline
  const regularSeasonGames=G.sched.filter(g=>!g.playoff);
  const regularSeasonScores=regularSeasonGames.filter(g=>G.scores[g.id]);
  const gp=regularSeasonScores.length;
  const homeStats={},awayStats={};
  for(const t of leagueTeams){homeStats[t]={w:0,l:0,tie:0};awayStats[t]={w:0,l:0,tie:0};}
  const teamResults={};
  for(const t of leagueTeams) teamResults[t]=[];
  const chronoGames=[...regularSeasonScores].sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  for(const g of chronoGames){
    const sc=G.scores[g.id];
    if(homeStats[g.home]!==undefined){
      if(sc.h>sc.a){homeStats[g.home].w++;teamResults[g.home].push('W');}
      else if(sc.a>sc.h){homeStats[g.home].l++;teamResults[g.home].push('L');}
      else{homeStats[g.home].tie++;teamResults[g.home].push('T');}
    }
    if(awayStats[g.away]!==undefined){
      if(sc.a>sc.h){awayStats[g.away].w++;teamResults[g.away].push('W');}
      else if(sc.h>sc.a){awayStats[g.away].l++;teamResults[g.away].push('L');}
      else{awayStats[g.away].tie++;teamResults[g.away].push('T');}
    }
  }

  return{leagueTeams,stats,h2hStats,ranked,homeStats,awayStats,teamResults,regularSeasonGames,gp};
}

// ── RENDER STANDINGS ──────────────────────────────────────────────────────────
function renderStandings(){
  const el=document.getElementById('sto');
  const tabActive=document.getElementById('tab-standings')?.classList.contains('active');
  if(!tabActive){if(el)el.dataset.stale='1';return;}
  if(!G.teams.length){el.innerHTML='<div class="empty">Add teams to get started</div>';return;}

  const{leagueTeams,stats,ranked,homeStats,awayStats,teamResults,regularSeasonGames,gp}=computeStandings();

  function last10(t){const r=teamResults[t].slice(-10);const w=r.filter(x=>x==='W').length,l=r.filter(x=>x==='L').length;return r.length?`${w}-${l}`:'—';}
  function streak(t){const r=teamResults[t];if(!r.length)return{s:'—',cls:''};const last=r[r.length-1];let cnt=0;for(let i=r.length-1;i>=0&&r[i]===last;i--)cnt++;return{s:`${last}${cnt}`,cls:last==='W'?'w':last==='L'?'l':'t'};}
  const leader=ranked[0]?.team;
  function gb(t){if(t===leader)return'—';const ls=stats[leader],ts2=stats[t];const gbVal=((ls.w-ts2.w)+(ts2.l-ls.l))/2;return gbVal<=0?'—':gbVal%1===0?String(gbVal):`${gbVal}`;}
  function winPct(t){const s=stats[t];if(s.gp===0)return'—';return(s.pts/(s.gp*2)).toFixed(3).replace(/^0/,'');}

  const remainingRegular=regularSeasonGames.filter(g=>!G.scores[g.id]).length;
  const totalRegular=regularSeasonGames.length;

  el.innerHTML=`
  <div class="metric-grid">
    <div class="metric"><div class="metric-label">Teams</div><div class="metric-value">${leagueTeams.length}</div></div>
    <div class="metric"><div class="metric-label">Played</div><div class="metric-value">${gp}</div></div>
    <div class="metric"><div class="metric-label">Remaining</div><div class="metric-value">${remainingRegular}</div></div>
    <div class="metric"><div class="metric-label">Total Games</div><div class="metric-value">${totalRegular}</div></div>
  </div>
  <div class="notice">W=2 · T=1 · L=0 · Tiebreakers: a) H2H points · b) Last matchup · c) Coin toss · RF/RA capped at +7</div>
  <div class="st-wrap"><table class="st">
    <colgroup>
      <col style="width:28px"><col><col style="width:58px"><col style="width:46px"><col style="width:36px">
      <col style="width:50px"><col style="width:50px"><col style="width:34px"><col style="width:34px">
      <col style="width:42px"><col style="width:42px"><col style="width:40px"><col style="width:24px">
    </colgroup>
    <thead><tr>
      <th>#</th><th>Team</th><th>Record</th><th>Win%</th><th>GB</th>
      <th>Home</th><th>Away</th><th>RF</th><th>RA</th><th>Diff</th><th>Last 10</th><th>Streak</th><th></th>
    </tr></thead>
    <tbody>${ranked.map(({team:t,tied},idx)=>{
      const s=stats[t];
      const diff=s.rf-s.ra;
      const ds=(diff>0?'+':'')+diff;
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

  if(el.dataset.stale) delete el.dataset.stale;
}
