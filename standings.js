// ── STANDINGS ─────────────────────────────────────────────────────────────────

function capRuns(h,a){
  if(h===a)return{ch:h,ca:a};
  if(h>a)return{ch:Math.min(h,a+CAP),ca:a};
  return{ch:h,ca:Math.min(a,h+CAP)};
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

  const h2hStats={};
  for(const t of leagueTeams){
    h2hStats[t]={};
    for(const u of leagueTeams) h2hStats[t][u]={pts:0,games:[]};
  }
  const scoredGames=[...G.sched].filter(g=>
    G.scores[g.id]&&!g.playoff&&
    stats[g.home]!==undefined&&stats[g.away]!==undefined&&
    g.home!==CROSSOVER&&g.away!==CROSSOVER
  );
  scoredGames.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  for(const g of scoredGames){
    const sc=G.scores[g.id];
    const hw=sc.h>sc.a,aw=sc.a>sc.h,tie=sc.h===sc.a;
    h2hStats[g.home][g.away].games.push({date:g.date,homePts:hw?2:tie?1:0});
    h2hStats[g.away][g.home].games.push({date:g.date,homePts:aw?2:tie?1:0});
    if(hw)h2hStats[g.home][g.away].pts+=2;
    else if(aw)h2hStats[g.away][g.home].pts+=2;
    else{h2hStats[g.home][g.away].pts+=1;h2hStats[g.away][g.home].pts+=1;}
  }

  function stableRand(a,b){
    let h=0;
    for(let i=0;i<a.length;i++) h=(Math.imul(31,h)+a.charCodeAt(i))|0;
    for(let i=0;i<b.length;i++) h=(Math.imul(31,h)+b.charCodeAt(i))|0;
    return h;
  }

  function h2hWinner(a,b){
    const ab=h2hStats[a][b],ba=h2hStats[b][a];
    if(ab.pts!==ba.pts) return ab.pts>ba.pts?a:b;
    // Last matchup tiebreaker
    const ag=ab.games,bg=ba.games;
    if(ag.length&&bg.length){
      const lastA=ag[ag.length-1],lastB=bg[bg.length-1];
      const lastDate=lastA.date>lastB.date?lastA.date:lastB.date;
      const aLast=ag.filter(g=>g.date===lastDate);
      const bLast=bg.filter(g=>g.date===lastDate);
      if(aLast.length&&bLast.length){
        const aLastPts=aLast[aLast.length-1].homePts;
        const bLastPts=bLast[bLast.length-1].homePts;
        if(aLastPts!==bLastPts) return aLastPts>bLastPts?a:b;
      }
    }
    // Stable coin toss
    return stableRand(a,b)>0?a:b;
  }

  const ranked=[...leagueTeams].map(t=>({team:t,tied:false})).sort((x,y)=>{
    const a=x.team,b=y.team;
    if(stats[b].pts!==stats[a].pts) return stats[b].pts-stats[a].pts;
    // H2H tiebreak
    const winner=h2hWinner(a,b);
    x.tied=true;y.tied=true;
    return winner===a?-1:1;
  });

  const regularSeasonGames=G.sched.filter(g=>!g.playoff&&!g.open&&g.home&&g.away);
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

  // OPT 2: single computation, shared result
  const{leagueTeams,stats,ranked,homeStats,awayStats,teamResults,regularSeasonGames,gp}=computeStandings();

  // ── AGENT: StandingsIntelligence labels ───────────────────────────────────
  // Safe guard: only call if agents.js is loaded
  const siLabels=(typeof AGENTS!=='undefined'&&AGENTS.StandingsIntelligence)
    ? AGENTS.StandingsIntelligence.getLabels()
    : {};

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
      <col style="width:28px"><col><col style="width:140px"><col style="width:58px"><col style="width:46px"><col style="width:36px">
      <col style="width:50px"><col style="width:50px"><col style="width:34px"><col style="width:34px">
      <col style="width:42px"><col style="width:42px"><col style="width:40px"><col style="width:24px">
    </colgroup>
    <thead><tr>
      <th>#</th><th>Team</th><th>Status</th><th>Record</th><th>Win%</th><th>GB</th>
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

      // ── AGENT: StandingsIntelligence badge ──────────────────────────────
      const lbl=siLabels[t];
      const statusCell=lbl
        ?`<td style="white-space:nowrap">
            <span style="font-size:10px;background:${lbl.bg};color:${lbl.color};
                         padding:2px 7px;border-radius:4px;font-weight:700;
                         white-space:nowrap;display:inline-block">${lbl.text}</span>
          </td>`
        :`<td></td>`;

      return`<tr>
        <td class="rank">${idx+1}</td>
        <td style="font-weight:600">${esc(t)}</td>
        ${statusCell}
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

  // ── AGENT: notify bus that standings rendered ──────────────────────────────
  if(typeof AgentBus!=='undefined'){
    AgentBus.publish('standings:rendered',{teams:leagueTeams.length,gp});
  }
}
