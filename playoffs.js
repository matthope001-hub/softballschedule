// ── PLAYOFFS ──────────────────────────────────────────────────────────────────

// ── BUG FIX #1: filter g.playoff so playoff scores don't pollute regular season stats
// ── BUG FIX #2: use full 3-tier tiebreaker (H2H → last matchup → coin toss)
//               matching standings.js exactly, so seeds match the displayed table
function getRegularSeasonRanking(){
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const stats={};
  for(const t of leagueTeams) stats[t]={gp:0,w:0,l:0,tie:0,pts:0,rf:0,ra:0};

  // Build H2H tracking (same structure as standings.js)
  const h2hStats={};
  for(const t of leagueTeams){
    h2hStats[t]={};
    for(const u of leagueTeams) h2hStats[t][u]={pts:0,games:[]};
  }

  const scoredGames=[...G.sched].filter(g=>
    !g.playoff&&  // FIX #1: exclude playoff games
    G.scores[g.id]&&
    stats[g.home]!==undefined&&
    stats[g.away]!==undefined&&
    g.home!==CROSSOVER&&g.away!==CROSSOVER
  );
  scoredGames.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));

  for(const g of scoredGames){
    const sc=G.scores[g.id];
    const{ch,ca}=capRuns(sc.h,sc.a);
    // Regular stats
    stats[g.home].gp++;stats[g.home].rf+=ch;stats[g.home].ra+=ca;
    if(sc.h>sc.a){stats[g.home].w++;stats[g.home].pts+=2;}
    else if(sc.a>sc.h)stats[g.home].l++;
    else{stats[g.home].tie++;stats[g.home].pts++;}

    stats[g.away].gp++;stats[g.away].rf+=ca;stats[g.away].ra+=ch;
    if(sc.a>sc.h){stats[g.away].w++;stats[g.away].pts+=2;}
    else if(sc.h>sc.a)stats[g.away].l++;
    else{stats[g.away].tie++;stats[g.away].pts++;}

    // H2H tracking
    const hw=sc.h>sc.a,aw=sc.a>sc.h,tie=sc.h===sc.a;
    h2hStats[g.home][g.away].games.push({date:g.date,homePts:hw?2:tie?1:0});
    h2hStats[g.away][g.home].games.push({date:g.date,homePts:aw?2:tie?1:0});
    if(hw)h2hStats[g.home][g.away].pts+=2;
    else if(aw)h2hStats[g.away][g.home].pts+=2;
    else{h2hStats[g.home][g.away].pts+=1;h2hStats[g.away][g.home].pts+=1;}
  }

  // Also accumulate CrossOver games in regular stats (non-H2H)
  for(const g of G.sched){
    if(g.playoff||!G.scores[g.id]) continue;
    if(g.home===CROSSOVER||g.away===CROSSOVER){
      const sc=G.scores[g.id];
      const{ch,ca}=capRuns(sc.h,sc.a);
      if(stats[g.home]!==undefined){
        stats[g.home].gp++;stats[g.home].rf+=ch;stats[g.home].ra+=ca;
        if(sc.h>sc.a){stats[g.home].w++;stats[g.home].pts+=2;}
        else if(sc.a>sc.h)stats[g.home].l++;
        else{stats[g.home].tie++;stats[g.home].pts++;}
      }
      if(stats[g.away]!==undefined){
        stats[g.away].gp++;stats[g.away].rf+=ca;stats[g.away].ra+=ch;
        if(sc.a>sc.h){stats[g.away].w++;stats[g.away].pts+=2;}
        else if(sc.h>sc.a)stats[g.away].l++;
        else{stats[g.away].tie++;stats[g.away].pts++;}
      }
    }
  }

  // FIX #2: Full 3-tier tiebreaker — mirrors standings.js exactly
  function stableRand(a,b){let h=0;for(const c of (a+b))h=(h*31+c.charCodeAt(0))>>>0;return h%2===0;}

  function tiebreak(group){
    const h2hPts={};
    for(const t of group){
      h2hPts[t]=0;
      for(const u of group) if(u!==t) h2hPts[t]+=h2hStats[t][u]?.pts||0;
    }
    const maxH2H=Math.max(...group.map(t=>h2hPts[t]));
    const afterH2H=group.filter(t=>h2hPts[t]===maxH2H);
    if(afterH2H.length===1) return afterH2H[0];
    // Tiebreaker b: winner of most recent matchup
    const allGames=[];
    for(let i=0;i<afterH2H.length;i++)
      for(let j=i+1;j<afterH2H.length;j++){
        const a=afterH2H[i],b=afterH2H[j];
        for(const g of(h2hStats[a][b]?.games||[]))
          allGames.push({date:g.date,winner:g.homePts===2?a:g.homePts===0?b:null});
      }
    allGames.sort((a,b)=>b.date.localeCompare(a.date));
    for(const g of allGames) if(g.winner&&afterH2H.includes(g.winner)) return g.winner;
    // Tiebreaker c: stable coin toss
    return afterH2H.sort((a,b)=>stableRand(a,b)?-1:1)[0];
  }

  const sorted=leagueTeams.slice().sort((a,b)=>stats[b].pts-stats[a].pts);
  const ranked=[];
  let i=0;
  while(i<sorted.length){
    let j=i+1;
    while(j<sorted.length&&stats[sorted[j]].pts===stats[sorted[i]].pts) j++;
    const group=sorted.slice(i,j);
    if(group.length===1){
      ranked.push({team:group[0],tied:false});
    } else {
      const rankGroup=(g)=>{
        if(!g.length) return[];
        const winner=tiebreak(g);
        return[{team:winner,tied:g.length>1},...rankGroup(g.filter(t=>t!==winner))];
      };
      ranked.push(...rankGroup(group).map((r,idx)=>({...r,tied:idx>0||group.length>1})));
    }
    i=j;
  }

  return ranked.map((r,i)=>({...r,seed:i+1,...stats[r.team]}));
}

function seedPlayoffs(){
  if(!checkAdmin()) return;
  const ranked=getRegularSeasonRanking();
  if(ranked.length<4){alert('Need at least 4 league teams to seed playoffs.');return;}
  const podA=ranked.slice(0,5).map(r=>r.team);
  const podB=ranked.slice(5).map(r=>r.team);
  function recStr(r){const t=r.tie?`-${r.tie}`:'';return `(${r.w}-${r.l}${t}) ${r.pts}pts`;}
  const msg=`Seed playoffs from current standings?\n\nPOD A (Top 5):\n${ranked.slice(0,5).map(r=>`  ${r.seed}. ${r.team} ${recStr(r)}`).join('\n')}\n\nPOD B (Bottom ${podB.length}):\n${ranked.slice(5).map(r=>`  ${r.seed}. ${r.team} ${recStr(r)}`).join('\n')}\n\nThis will reset any existing playoff data.`;
  if(!confirm(msg)) return;
  function rrGames(teams,pfx){
    const games={};let n=1;
    for(let i=0;i<teams.length;i++)
      for(let j=i+1;j<teams.length;j++){
        const id=`${pfx}RR${String(n).padStart(2,'0')}`;
        games[id]={id,phase:'rr',home:teams[i],away:teams[j],score:null};n++;
      }
    return games;
  }
  G.playoffs={
    seeded:true,podA,podB,
    games:{...rrGames(podA,'PA'),...rrGames(podB,'PB')},
    semis:{podA:{},podB:{}},
    finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}
  };
  saveData();renderPlayoffs();showToast('🏆 Playoffs seeded!');
}

function resetPlayoffs(){
  if(!checkAdmin()) return;
  if(!confirm('Reset all playoff data? This cannot be undone.')) return;
  G.playoffs={seeded:false,podA:[],podB:[],games:{},semis:{podA:{},podB:{}},finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}};
  saveData();renderPlayoffs();showToast('Playoffs reset');
}

// ── BUG FIX #3: clamp scores to >= 0 in all save functions
function _clampScore(val){
  const n=parseInt(val);
  return isNaN(n)?null:Math.max(0,n);
}

function savePlayoffScore(gameId){
  if(!checkAdmin()) return;
  const hRaw=document.getElementById('ph_'+gameId)?.value;
  const aRaw=document.getElementById('pa_'+gameId)?.value;
  const g=G.playoffs.games[gameId];
  if(!g) return;
  if(hRaw===''||aRaw==='') g.score=null;
  else{
    const h=_clampScore(hRaw),a=_clampScore(aRaw);
    if(h===null||a===null) return;
    g.score={h,a};
  }
  saveData();renderPlayoffs();
}

function saveSemiScore(pod,key){
  if(!checkAdmin()) return;
  const hRaw=document.getElementById(`psh_${pod}_${key}`)?.value;
  const aRaw=document.getElementById(`psa_${pod}_${key}`)?.value;
  if(!G.playoffs.semis[pod][key]) G.playoffs.semis[pod][key]={home:null,away:null,score:null};
  if(hRaw===''||aRaw==='') G.playoffs.semis[pod][key].score=null;
  else{
    const h=_clampScore(hRaw),a=_clampScore(aRaw);
    if(h===null||a===null) return;
    G.playoffs.semis[pod][key].score={h,a};
  }
  saveData();renderPlayoffs();
}

function saveFinalScore(pod){
  if(!checkAdmin()) return;
  const hRaw=document.getElementById('pfh_'+pod)?.value;
  const aRaw=document.getElementById('pfa_'+pod)?.value;
  if(hRaw===''||aRaw==='') G.playoffs.finals[pod].score=null;
  else{
    const h=_clampScore(hRaw),a=_clampScore(aRaw);
    if(h===null||a===null) return;
    G.playoffs.finals[pod].score={h,a};
  }
  saveData();renderPlayoffs();
}

function schedulePlayoffGame(plyId, home, away){
  if(!checkAdmin()) return;
  const date=prompt(`Schedule playoff game: ${home} vs ${away}\n\nEnter date (YYYY-MM-DD), e.g. 2026-10-06:`,'2026-10-06');
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)){if(date!==null)alert('Invalid date format. Use YYYY-MM-DD.');return;}
  const time=prompt('Enter start time:','6:30 PM');
  if(!time){return;}
  const dmNames=G.diamonds.map((d,i)=>`${i+1}. ${d.name}`).join('\n');
  const dmChoice=prompt(`Choose diamond:\n${dmNames}\n\nEnter number:`,'1');
  if(!dmChoice) return;
  const dmIndex=parseInt(dmChoice)-1;
  if(isNaN(dmIndex)||dmIndex<0||dmIndex>=G.diamonds.length){alert('Invalid diamond choice.');return;}
  const dm=G.diamonds[dmIndex];
  // Remove any existing schedule entry for this plyId
  G.sched=G.sched.filter(g=>g.plyId!==plyId);
  const yr=date.slice(2,4);
  const existingIds=G.sched.map(g=>g.id).filter(id=>id.startsWith(yr));
  let maxSeq=0;
  for(const id of existingIds){const n=parseInt(id.slice(2));if(!isNaN(n)&&n>maxSeq)maxSeq=n;}
  const newId=`${yr}${String(maxSeq+1).padStart(3,'0')}`;
  G.sched.push({
    id:newId,date,time,diamond:dm.id,lights:dm.lights,
    home,away,bye:'',crossover:false,playoff:true,plyId
  });
  G.sched.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  saveData();
  renderPlayoffs();
  renderSched();
  renderScores();
  showToast(`📅 Playoff game scheduled — ${home} vs ${away}`);
}

function removePlayoffSchedule(plyId){
  if(!checkAdmin()) return;
  G.sched=G.sched.filter(g=>g.plyId!==plyId);
  saveData();
  renderPlayoffs();
  renderSched();
  renderScores();
  showToast('📅 Playoff game unscheduled');
}

function getPlayoffSchedEntry(plyId){
  return G.sched.find(g=>g.plyId===plyId)||null;
}

// ── BUG FIX #2 (cont): podRRStandings with H2H tiebreaker for correct semi seeding
function podRRStandings(teams,pfx){
  const stats={};
  for(const t of teams) stats[t]={w:0,l:0,tie:0,pts:0,rf:0,ra:0,gp:0};
  const h2h={};
  for(const t of teams){h2h[t]={};for(const u of teams)h2h[t][u]={pts:0,games:[]};}

  const games=Object.values(G.playoffs.games).filter(g=>g.id.startsWith(pfx+'RR'));
  const sortedGames=[...games].sort((a,b)=>a.id.localeCompare(b.id));
  for(const g of sortedGames){
    if(!g.score) continue;
    const{h,a}=g.score;const{ch,ca}=capRuns(h,a);
    stats[g.home].gp++;stats[g.home].rf+=ch;stats[g.home].ra+=ca;
    stats[g.away].gp++;stats[g.away].rf+=ca;stats[g.away].ra+=ch;
    const hw=h>a,aw=a>h,tie=h===a;
    if(hw){stats[g.home].w++;stats[g.home].pts+=2;stats[g.away].l++;h2h[g.home][g.away].pts+=2;}
    else if(aw){stats[g.away].w++;stats[g.away].pts+=2;stats[g.home].l++;h2h[g.away][g.home].pts+=2;}
    else{stats[g.home].tie++;stats[g.home].pts++;stats[g.away].tie++;stats[g.away].pts++;h2h[g.home][g.away].pts++;h2h[g.away][g.home].pts++;}
    h2h[g.home][g.away].games.push({id:g.id,winner:hw?g.home:aw?g.away:null});
    h2h[g.away][g.home].games.push({id:g.id,winner:aw?g.away:hw?g.home:null});
  }

  function stableRand(a,b){let h=0;for(const c of (a+b))h=(h*31+c.charCodeAt(0))>>>0;return h%2===0;}

  function tiebreak(group){
    const h2hPts={};
    for(const t of group){h2hPts[t]=0;for(const u of group)if(u!==t)h2hPts[t]+=h2h[t][u]?.pts||0;}
    const maxH2H=Math.max(...group.map(t=>h2hPts[t]));
    const afterH2H=group.filter(t=>h2hPts[t]===maxH2H);
    if(afterH2H.length===1) return afterH2H[0];
    const allGames=[];
    for(let i=0;i<afterH2H.length;i++)
      for(let j=i+1;j<afterH2H.length;j++){
        const a=afterH2H[i],b=afterH2H[j];
        for(const g of(h2h[a][b]?.games||[]))
          allGames.push({id:g.id,winner:g.winner});
      }
    allGames.sort((a,b)=>b.id.localeCompare(a.id));
    for(const g of allGames) if(g.winner&&afterH2H.includes(g.winner)) return g.winner;
    return afterH2H.sort((a,b)=>stableRand(a,b)?-1:1)[0];
  }

  const sorted=teams.slice().sort((a,b)=>stats[b].pts-stats[a].pts);
  const ranked=[];
  let i=0;
  while(i<sorted.length){
    let j=i+1;
    while(j<sorted.length&&stats[sorted[j]].pts===stats[sorted[i]].pts) j++;
    const group=sorted.slice(i,j);
    if(group.length===1){ranked.push({team:group[0]});}
    else{
      const rankGroup=(g)=>{
        if(!g.length) return[];
        const winner=tiebreak(g);
        return[{team:winner},...rankGroup(g.filter(t=>t!==winner))];
      };
      ranked.push(...rankGroup(group));
    }
    i=j;
  }
  return ranked.map((r,i)=>({rank:i+1,...stats[r.team],team:r.team}));
}

function scoreInput(idH,idA,valH,valA,onChange){
  return `<td class="g-si"><input type="number" min="0" class="si" id="${idH}" value="${valH}" placeholder="–" onchange="${onChange}"/></td><td class="g-sep">–</td><td class="g-si"><input type="number" min="0" class="si" id="${idA}" value="${valA}" placeholder="–" onchange="${onChange}"/></td>`;
}

function schedBtn(plyId, home, away){
  const entry=getPlayoffSchedEntry(plyId);
  if(entry){
    return `<td style="padding:4px 6px;white-space:nowrap">
      <div style="display:inline-flex;align-items:center;gap:8px;background:#0d1b2e;border-radius:6px;padding:5px 10px">
        <span style="font-size:12px">📅</span>
        <div style="line-height:1.4">
          <div style="font-size:12px;font-weight:700;color:#fff">${entry.date} · ${entry.time}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6)">${getDiamondName(entry.diamond)}</div>
        </div>
        <button onclick="removePlayoffSchedule('${plyId}')" title="Remove scheduled date" style="margin-left:2px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:4px;cursor:pointer;color:rgba(255,255,255,0.7);font-size:11px;padding:2px 6px;line-height:1">✕</button>
      </div>
    </td>`;
  }
  return `<td style="padding:4px 6px">
    <button onclick="schedulePlayoffGame('${plyId}','${esc(home)}','${esc(away)}')" style="font-size:11px;padding:4px 10px;background:var(--surface2);border:1.5px solid var(--border2);border-radius:5px;cursor:pointer;color:var(--navy);font-weight:600;white-space:nowrap;font-family:var(--font)">📅 Schedule</button>
  </td>`;
}

function winnerOf(sc,home,away){
  if(!sc) return null;
  if(sc.h>sc.a) return home;
  if(sc.a>sc.h) return away;
  return null;
}

function renderPod(podLabel,pfx,podKey,seeds){
  const standing=podRRStandings(seeds,pfx);
  const games=Object.values(G.playoffs.games).filter(g=>g.id.startsWith(pfx+'RR')).sort((a,b)=>a.id.localeCompare(b.id));
  const rrTotal=games.length;
  const rrPlayed=games.filter(g=>g.score).length;
  const rrDone=rrPlayed===rrTotal;
  const semis=G.playoffs.semis[podKey];
  const fin=G.playoffs.finals[podKey];

  const s1=standing[0]?.team,s2=standing[1]?.team,s3=standing[2]?.team,s4=standing[3]?.team;
  const isPodA=pfx==='PA';
  const elimNote=isPodA?`<div class="notice" style="background:#fff0f0;border-color:var(--red)">⛔ ${esc(standing[4]?.team||'5th')} is eliminated after the round robin.</div>`:'';

  // Auto-populate semis from RR standings when RR is done
  let stateChanged=false;
  if(rrDone&&s1&&s2&&s3&&s4){
    if(!semis.s1||semis.s1.home!==s1||semis.s1.away!==s4){
      G.playoffs.semis[podKey].s1={home:s1,away:s4,score:semis.s1?.score||null};
      stateChanged=true;
    }
    if(!semis.s2||semis.s2.home!==s2||semis.s2.away!==s3){
      G.playoffs.semis[podKey].s2={home:s2,away:s3,score:semis.s2?.score||null};
      stateChanged=true;
    }
  }

  const sm1=G.playoffs.semis[podKey].s1||{home:s1||'TBD',away:s4||'TBD',score:null};
  const sm2=G.playoffs.semis[podKey].s2||{home:s2||'TBD',away:s3||'TBD',score:null};
  const semi1winner=winnerOf(sm1.score,sm1.home,sm1.away);
  const semi2winner=winnerOf(sm2.score,sm2.home,sm2.away);

  // Auto-populate final
  if(semi1winner&&semi2winner){
    if(!fin.home||fin.home!==semi1winner||fin.away!==semi2winner){
      G.playoffs.finals[podKey].home=semi1winner;
      G.playoffs.finals[podKey].away=semi2winner;
      stateChanged=true;
    }
  }
  if(stateChanged) saveData();

  const champion=winnerOf(fin.score,fin.home,fin.away);

  let h=`<div class="card">
  <div class="card-title">${esc(podLabel)}</div>
  <div style="font-size:11px;color:var(--muted);margin-bottom:10px">${rrPlayed}/${rrTotal} round robin games played</div>`;

  // RR standings table
  h+=`<table class="st" style="margin-bottom:12px"><thead><tr><th>#</th><th>Team</th><th>Record</th><th>Pts</th><th>RF</th><th>RA</th><th>Diff</th></tr></thead><tbody>`;
  h+=standing.map((s,i)=>{
    const diff=s.rf-s.ra;
    const elim=isPodA&&i===4&&rrDone;
    return`<tr style="${elim?'opacity:0.45;text-decoration:line-through':''}${i===0?';background:#f0f9ff':''}">
      <td class="rank">${i+1}</td>
      <td style="font-weight:600">${esc(s.team)}</td>
      <td class="rec">${s.w}-${s.l}${s.tie?'-'+s.tie:''}</td>
      <td class="mono" style="font-weight:700;color:var(--navy)">${s.pts}</td>
      <td class="mono">${s.rf}</td>
      <td class="mono">${s.ra}</td>
      <td class="mono">${(diff>0?'+':'')+diff}</td>
    </tr>`;
  }).join('');
  h+=`</tbody></table>`;

  // RR games
  h+=`<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Round Robin Games</div>`;
  h+=`<table class="gt" style="margin-bottom:12px">`;
  for(const g of games){
    const sc=g.score;
    const winner=winnerOf(sc,g.home,g.away);
    h+=`<tr class="${sc?'':'empty-slot'}">
      <td class="g-num"><span class="gnum">${g.id}</span></td>
      <td class="g-home" style="font-weight:600${winner===g.home?';color:var(--navy)':''}">${esc(g.home)}</td>
      <td class="g-vs">vs</td>
      <td class="g-away" style="font-weight:600${winner===g.away?';color:var(--navy)':''}">${esc(g.away)}</td>
      ${scoreInput('ph_'+g.id,'pa_'+g.id,sc?sc.h:'',sc?sc.a:'',`savePlayoffScore('${g.id}')`)}
      <td class="g-sc ${sc?'scored':''}">${winner?'✓ '+esc(winner):sc?'Tie':'—'}</td>
      ${schedBtn(g.id,g.home,g.away)}
    </tr>`;
  }
  h+=`</table>`;

  // Elimination bracket
  h+=`<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Elimination Bracket</div>`;
  if(!rrDone){
    h+=`<div class="notice">Complete all round robin games to unlock the bracket.</div>`;
  } else {
    if(isPodA) h+=elimNote;
    h+=`<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px">Semi-Finals</div>`;
    h+=`<table class="gt" style="margin-bottom:10px">`;
    [{key:'s1',g:sm1,label:`1 vs 4`},{key:'s2',g:sm2,label:`2 vs 3`}].forEach(({key,g,label})=>{
      const winner=winnerOf(g.score,g.home,g.away);
      const plyId=`${podKey}_${key}`;
      h+=`<tr class="${g.score?'':'empty-slot'}">
        <td class="g-num"><span class="gnum">${label}</span></td>
        <td class="g-home" style="font-weight:600${winner===g.home?';color:var(--navy)':''}">${esc(g.home||'TBD')}</td>
        <td class="g-vs">vs</td>
        <td class="g-away" style="font-weight:600${winner===g.away?';color:var(--navy)':''}">${esc(g.away||'TBD')}</td>
        ${scoreInput(`psh_${podKey}_${key}`,`psa_${podKey}_${key}`,g.score?g.score.h:'',g.score?g.score.a:'',`saveSemiScore('${podKey}','${key}')`)}
        <td class="g-sc ${g.score?'scored':''}">${winner?'✓ '+esc(winner):g.score?'Tie':'—'}</td>
        ${g.home?schedBtn(plyId,g.home||'',g.away||''):'<td></td>'}
      </tr>`;
    });
    h+=`</table>`;
    h+=`<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px">${podLabel} Final</div>`;
    if(!semi1winner||!semi2winner){
      h+=`<div class="notice">Complete both semi-finals to determine the finalists.</div>`;
    } else {
      h+=`<table class="gt" style="margin-bottom:10px"><tr class="${fin.score?'':'empty-slot'}">
        <td class="g-num"><span class="gnum">FINAL</span></td>
        <td class="g-home" style="font-weight:700;color:var(--navy)">${esc(fin.home||'TBD')}</td>
        <td class="g-vs">vs</td>
        <td class="g-away" style="font-weight:700;color:var(--navy)">${esc(fin.away||'TBD')}</td>
        ${scoreInput('pfh_'+podKey,'pfa_'+podKey,fin.score?fin.score.h:'',fin.score?fin.score.a:'',`saveFinalScore('${podKey}')`)}
        <td class="g-sc ${fin.score?'scored':''}">${champion?'🏆 '+esc(champion):fin.score?'Tie':'—'}</td>
        ${fin.home?schedBtn(`${podKey}_final`,fin.home||'',fin.away||''):'<td></td>'}
      </tr></table>`;
      if(champion){
        h+=`<div style="padding:14px 16px;background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:var(--r);color:#fff;text-align:center;margin-bottom:10px">
          <div style="font-size:11px;font-weight:600;opacity:0.6;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${podLabel} Champion</div>
          <div style="font-size:24px;font-weight:800">🏆 ${esc(champion)}</div>
        </div>`;
      }
    }
  }

  h+=`</div>`;
  return h;
}

function renderPlayoffs(){
  const el=document.getElementById('ply');
  if(!el) return;
  const p=G.playoffs||{seeded:false};

  if(!p.seeded){
    const ranked=getRegularSeasonRanking();
    const hasScores=G.sched.some(g=>G.scores[g.id]);
    el.innerHTML=`
      <div class="card">
        <div class="card-title">Playoffs — Setup</div>
        <div class="notice">Seeding is pulled automatically from the final regular season standings. Make sure all regular season scores are entered first.</div>
        ${ranked.length>=9?`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:6px">POD A — Top 5</div>
            ${ranked.slice(0,5).map(r=>{const t=r.tied?` <span style="color:var(--orange);font-size:10px">TB</span>`:'';return`<div style="font-size:13px;padding:3px 0;display:flex;justify-content:space-between"><span>${r.seed}. ${esc(r.team)}${t}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">(${r.w}-${r.l}${r.tie?'-'+r.tie:''}) <strong style="color:var(--navy)">${r.pts}pts</strong></span></div>`;}).join('')}
          </div>
          <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:6px">POD B — Bottom 4</div>
            ${ranked.slice(5).map(r=>{const t=r.tied?` <span style="color:var(--orange);font-size:10px">TB</span>`:'';return`<div style="font-size:13px;padding:3px 0;display:flex;justify-content:space-between"><span>${r.seed}. ${esc(r.team)}${t}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">(${r.w}-${r.l}${r.tie?'-'+r.tie:''}) <strong style="color:var(--navy)">${r.pts}pts</strong></span></div>`;}).join('')}
          </div>
        </div>`:''}
        <button class="btn btn-primary" onclick="seedPlayoffs()">🏆 Seed Playoffs from Standings</button>
        ${!hasScores?'<div style="margin-top:8px;font-size:12px;color:var(--muted)">⚠ No scores entered yet — standings may not reflect final order</div>':''}
      </div>
      <div class="card">
        <div class="card-title">Format</div>
        <div style="display:grid;gap:10px">
          <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);margin-bottom:6px">POD A — Top 5 Teams</div>
            <div style="font-size:13px;color:var(--text);display:grid;gap:3px">
              <div>① Round Robin — each team plays the other 4 once (10 games)</div>
              <div>② 5th place is <strong>eliminated</strong></div>
              <div>③ Semi-Finals — Seed 1 vs 4 · Seed 2 vs 3</div>
              <div>④ POD A Final — Semi winners meet</div>
            </div>
          </div>
          <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);margin-bottom:6px">POD B — Bottom 4 Teams</div>
            <div style="font-size:13px;color:var(--text);display:grid;gap:3px">
              <div>① Round Robin — each team plays the other 3 once (6 games)</div>
              <div>② Semi-Finals — Seed 1 vs 4 · Seed 2 vs 3</div>
              <div>③ POD B Final — Semi winners meet</div>
            </div>
          </div>
        </div>
      </div>`;
    return;
  }

  let html=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
    <div style="font-size:13px;color:var(--muted)">Seeded from regular season standings · Admin PIN required for changes</div>
    <button class="btn btn-sm" onclick="resetPlayoffs()" style="color:var(--red);border-color:var(--red)">↺ Reset</button>
  </div>`;
  html+=renderPod('POD A — Top 5','PA','podA',p.podA);
  html+=renderPod('POD B — Bottom 4','PB','podB',p.podB);
  el.innerHTML=html;
}
