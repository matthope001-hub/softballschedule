// ── PLAYOFFS ──────────────────────────────────────────────────────────────────

function getRegularSeasonRanking(){
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const stats={};
  for(const t of leagueTeams) stats[t]={gp:0,w:0,l:0,tie:0,pts:0,rf:0,ra:0};
  for(const g of G.sched){
    const sc=G.scores[g.id];if(!sc)continue;
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
  return leagueTeams.slice().sort((a,b)=>
    stats[b].pts-stats[a].pts||(stats[b].rf-stats[b].ra)-(stats[a].rf-stats[a].ra)||a.localeCompare(b)
  ).map((t,i)=>({team:t,seed:i+1,...stats[t]}));
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
  // Generate round robin games
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

function savePlayoffScore(gameId){
  if(!checkAdmin()) return;
  const h=document.getElementById('ph_'+gameId)?.value;
  const a=document.getElementById('pa_'+gameId)?.value;
  const g=G.playoffs.games[gameId];
  if(!g) return;
  if(h===''||a==='') g.score=null;
  else g.score={h:parseInt(h),a:parseInt(a)};
  saveData();renderPlayoffs();
}

function saveSemiScore(pod,key){
  if(!checkAdmin()) return;
  const h=document.getElementById(`psh_${pod}_${key}`)?.value;
  const a=document.getElementById(`psa_${pod}_${key}`)?.value;
  if(!G.playoffs.semis[pod][key]) G.playoffs.semis[pod][key]={home:null,away:null,score:null};
  if(h===''||a==='') G.playoffs.semis[pod][key].score=null;
  else G.playoffs.semis[pod][key].score={h:parseInt(h),a:parseInt(a)};
  saveData();renderPlayoffs();
}

function saveFinalScore(pod){
  if(!checkAdmin()) return;
  const h=document.getElementById('pfh_'+pod)?.value;
  const a=document.getElementById('pfa_'+pod)?.value;
  if(h===''||a==='') G.playoffs.finals[pod].score=null;
  else G.playoffs.finals[pod].score={h:parseInt(h),a:parseInt(a)};
  saveData();renderPlayoffs();
}

function schedulePlayoffGame(plyId, home, away){
  if(!checkAdmin()) return;
  // Show inline scheduling form via a modal-style prompt
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

  // Remove any existing sched entry for this playoff game
  G.sched=G.sched.filter(g=>g.plyId!==plyId);

  // Generate ID
  const yr=new Date(date+'T12:00:00').getFullYear().toString().slice(-2);
  const newId=`${yr}P${String(Date.now()).slice(-4)}`;

  G.sched.push({
    id:newId, date, time,
    diamond:dm.id, lights:dm.lights,
    home, away, bye:'',
    crossover:false,
    playoff:true,
    plyId  // link back to the playoff game entry
  });
  G.sched.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  saveData();
  renderPlayoffs();
  renderSched();
  renderScores();
  showToast(`✓ Playoff game scheduled — ${date} · ${time} · ${dm.name}`);
}

function removePlayoffSchedule(plyId){
  if(!checkAdmin()) return;
  if(!confirm('Remove the scheduled date/time/diamond for this playoff game?\n\nThe game result will be kept.')) return;
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

function podRRStandings(teams,pfx){
  const stats={};
  for(const t of teams) stats[t]={w:0,l:0,tie:0,pts:0,rf:0,ra:0,gp:0};
  const games=Object.values(G.playoffs.games).filter(g=>g.id.startsWith(pfx+'RR'));
  for(const g of games){
    if(!g.score) continue;
    const{h,a}=g.score;const{ch,ca}=capRuns(h,a);
    stats[g.home].gp++;stats[g.home].rf+=ch;stats[g.home].ra+=ca;
    stats[g.away].gp++;stats[g.away].rf+=ca;stats[g.away].ra+=ch;
    if(h>a){stats[g.home].w++;stats[g.home].pts+=2;stats[g.away].l++;}
    else if(a>h){stats[g.away].w++;stats[g.away].pts+=2;stats[g.home].l++;}
    else{stats[g.home].tie++;stats[g.home].pts++;stats[g.away].tie++;stats[g.away].pts++;}
  }
  return teams.slice().sort((a,b)=>stats[b].pts-stats[a].pts||(stats[b].rf-stats[b].ra)-(stats[a].rf-stats[a].ra)||a.localeCompare(b))
    .map((t,i)=>({team:t,rank:i+1,...stats[t]}));
}

function scoreInput(idH,idA,valH,valA,onChange){
  return `<td class="g-si"><input type="number" min="0" class="si" id="${idH}" value="${valH}" placeholder="–" onchange="${onChange}"/></td><td class="g-sep">–</td><td class="g-si"><input type="number" min="0" class="si" id="${idA}" value="${valA}" placeholder="–" onchange="${onChange}"/></td>`;
}

function schedBtn(plyId, home, away){
  const entry=getPlayoffSchedEntry(plyId);
  if(entry){
    return `<td style="white-space:nowrap;padding:0 6px">
      <span style="font-size:11px;color:var(--navy);font-weight:600">📅 ${entry.date} · ${entry.time}</span>
      <span style="font-size:11px;color:var(--muted)"> · ${getDiamondName(entry.diamond)}</span>
      <button onclick="removePlayoffSchedule('${plyId}')" title="Remove schedule" style="margin-left:4px;background:none;border:none;cursor:pointer;color:var(--muted);font-size:12px;padding:0">✕</button>
    </td>`;
  }
  return `<td><button onclick="schedulePlayoffGame('${plyId}','${esc(home)}','${esc(away)}')" style="font-size:11px;padding:3px 8px;background:var(--gray1);border:1.5px solid var(--border);border-radius:5px;cursor:pointer;color:var(--navy);font-weight:600;white-space:nowrap">📅 Schedule</button></td>`;
}

function winnerOf(sc,home,away){
  if(!sc) return null;
  if(sc.h>sc.a) return home;
  if(sc.a>sc.h) return away;
  return null; // tie — force replay or decide manually
}

function renderPod(podLabel,pfx,podKey,seeds){
  const standing=podRRStandings(seeds,pfx);
  const games=Object.values(G.playoffs.games).filter(g=>g.id.startsWith(pfx+'RR')).sort((a,b)=>a.id.localeCompare(b.id));
  const rrTotal=games.length;
  const rrPlayed=games.filter(g=>g.score).length;
  const rrDone=rrPlayed===rrTotal;
  const semis=G.playoffs.semis[podKey];
  const fin=G.playoffs.finals[podKey];

  // Determine seeds after RR
  const s1=standing[0]?.team,s2=standing[1]?.team,s3=standing[2]?.team,s4=standing[3]?.team;
  const isPodA=pfx==='PA';
  // POD A: top 4 advance (seed 5 eliminated), semis: 1v4, 2v3
  // POD B: all 4 advance, semis: 1v4, 2v3
  const elimNote=isPodA?`<div class="notice" style="background:#fff0f0;border-color:var(--red)">⛔ ${standing[4]?.team||'5th place'} is eliminated after round robin — top 4 advance</div>`:'';

  // Semi setup
  if(rrDone&&s1&&s2&&s3&&s4){
    if(!semis.s1){semis.s1={home:s1,away:s4,score:null};saveData();}
    if(!semis.s2){semis.s2={home:s2,away:s3,score:null};saveData();}
  }
  const sm1=semis.s1||{};const sm2=semis.s2||{};
  const semi1winner=winnerOf(sm1.score,sm1.home,sm1.away);
  const semi2winner=winnerOf(sm2.score,sm2.home,sm2.away);

  // Final setup
  if(semi1winner&&semi2winner&&!fin.home){
    fin.home=semi1winner;fin.away=semi2winner;saveData();
  }
  const champion=winnerOf(fin.score,fin.home,fin.away);

  let h=`<div class="card">`;
  h+=`<div class="card-title">${podLabel} <span style="font-size:11px;font-weight:500;color:var(--muted);text-transform:none;letter-spacing:0">${rrPlayed}/${rrTotal} RR games</span></div>`;

  // Seeding / RR standings
  h+=`<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Round Robin Standings</div>`;
  h+=`<div class="st-wrap" style="margin-bottom:12px"><table class="st">
    <colgroup><col style="width:22px"><col><col style="width:28px"><col style="width:28px"><col style="width:28px"><col style="width:28px"><col style="width:38px"><col style="width:32px"><col style="width:32px"><col style="width:38px"><col style="width:60px"></colgroup>
    <thead><tr><th>#</th><th>Team</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>PTS</th><th>RF</th><th>RA</th><th>DIFF</th><th>Status</th></tr></thead>
    <tbody>${standing.map(({team:t,rank,gp,w,l,tie,pts,rf,ra},i)=>{
      const diff=rf-ra;const ds=gp===0?'—':(diff>0?'+'+diff:''+diff);
      let status='',rowStyle='';
      if(rrDone){
        if(isPodA&&i===4){status='<span style="color:var(--red);font-size:10px;font-weight:700">ELIM</span>';rowStyle='opacity:0.5';}
        else if(i<2) status='<span style="color:var(--green);font-size:10px;font-weight:700">SEMI ✓</span>';
        else status='<span style="color:var(--orange);font-size:10px;font-weight:700">SEMI</span>';
      }
      return`<tr style="${rowStyle}"><td class="rank">${rank}</td><td style="font-weight:600">${esc(t)}</td><td class="mono">${gp}</td><td class="mono">${w}</td><td class="mono">${l}</td><td class="mono">${tie}</td><td class="pts">${pts}</td><td class="mono">${rf}</td><td class="mono">${ra}</td><td class="mono">${ds}</td><td>${status}</td></tr>`;
    }).join('')}</tbody></table></div>`;

  // Round Robin games
  h+=`<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Round Robin Games</div>`;
  h+=`<table class="gt" style="margin-bottom:14px">`;
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
    // Semis
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
    // Final
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
            ${ranked.slice(0,5).map(r=>{const t=r.tie?`-${r.tie}`:'';return`<div style="font-size:13px;padding:3px 0;display:flex;justify-content:space-between"><span>${r.seed}. ${esc(r.team)}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">(${r.w}-${r.l}${t}) <strong style="color:var(--navy)">${r.pts}pts</strong></span></div>`;}).join('')}
          </div>
          <div style="padding:12px;background:var(--gray1);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:6px">POD B — Bottom 4</div>
            ${ranked.slice(5).map(r=>{const t=r.tie?`-${r.tie}`:'';return`<div style="font-size:13px;padding:3px 0;display:flex;justify-content:space-between"><span>${r.seed}. ${esc(r.team)}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">(${r.w}-${r.l}${t}) <strong style="color:var(--navy)">${r.pts}pts</strong></span></div>`;}).join('')}
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