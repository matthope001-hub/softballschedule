// ── PLAYOFFS ──────────────────────────────────────────────────────────────────

function getRegularSeasonRanking(){
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const stats={};
  for(const t of leagueTeams) stats[t]={gp:0,w:0,l:0,tie:0,pts:0,rf:0,ra:0};

  const h2hStats={};
  for(const t of leagueTeams){
    h2hStats[t]={};
    for(const u of leagueTeams) h2hStats[t][u]={pts:0,games:[]};
  }

  const scoredGames=[...G.sched].filter(g=>
    !g.playoff&&
    G.scores[g.id]&&
    stats[g.home]!==undefined&&
    stats[g.away]!==undefined&&
    g.home!==CROSSOVER&&g.away!==CROSSOVER
  );
  scoredGames.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));

  for(const g of scoredGames){
    const sc=G.scores[g.id];
    const{ch,ca}=capRuns(sc.h,sc.a);
    stats[g.home].gp++;stats[g.home].rf+=ch;stats[g.home].ra+=ca;
    if(sc.h>sc.a){stats[g.home].w++;stats[g.home].pts+=2;}
    else if(sc.a>sc.h)stats[g.home].l++;
    else{stats[g.home].tie++;stats[g.home].pts++;}

    stats[g.away].gp++;stats[g.away].rf+=ca;stats[g.away].ra+=ch;
    if(sc.a>sc.h){stats[g.away].w++;stats[g.away].pts+=2;}
    else if(sc.h>sc.a)stats[g.away].l++;
    else{stats[g.away].tie++;stats[g.away].pts++;}

    const homePts=sc.h>sc.a?2:sc.h===sc.a?1:0;
    const awayPts=sc.a>sc.h?2:sc.h===sc.a?1:0;
    h2hStats[g.home][g.away].pts+=homePts;
    h2hStats[g.home][g.away].games.push({date:g.date,homePts});
    h2hStats[g.away][g.home].pts+=awayPts;
    h2hStats[g.away][g.home].games.push({date:g.date,homePts:awayPts});
  }

  function stableRand(a,b){return(a+b).split('').reduce((n,c)=>n+c.charCodeAt(0),0)%2===0;}

  function tiebreak(group){
    if(group.length===1) return group[0];
    const h2hPts={};
    for(const t of group){
      h2hPts[t]=0;
      for(const u of group) if(u!==t) h2hPts[t]+=(h2hStats[t][u]?.pts||0);
    }
    const maxH2H=Math.max(...group.map(t=>h2hPts[t]));
    const afterH2H=group.filter(t=>h2hPts[t]===maxH2H);
    if(afterH2H.length===1) return afterH2H[0];
    const allGames=[];
    for(let i=0;i<afterH2H.length;i++)
      for(let j=i+1;j<afterH2H.length;j++){
        const a=afterH2H[i],b=afterH2H[j];
        for(const g of(h2hStats[a][b]?.games||[]))
          allGames.push({date:g.date,winner:g.homePts===2?a:g.homePts===0?b:null});
      }
    allGames.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    for(const g of allGames) if(g.winner&&afterH2H.includes(g.winner)) return g.winner;
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
  saveData();renderPlayoffs();renderPlayoffsAdmin();showToast('🏆 Playoffs seeded!');
}

function resetPlayoffs(){
  if(!checkAdmin()) return;
  if(!confirm('Reset all playoff data? This cannot be undone.')) return;
  G.playoffs={seeded:false,podA:[],podB:[],games:{},semis:{podA:{},podB:{}},finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}};
  saveData();renderPlayoffs();renderPlayoffsAdmin();showToast('Playoffs reset');
}

function _clampScore(val){
  const n=parseInt(val);
  return isNaN(n)?null:Math.max(0,n);
}

function savePlayoffScore(gameId){
  if(!isAdmin){showToast('🔒 Unlock Admin to enter scores');return;}
  const hEl=document.getElementById('ph_'+gameId);
  const aEl=document.getElementById('pa_'+gameId);
  const hRaw=hEl?.value;
  const aRaw=aEl?.value;
  const g=G.playoffs.games[gameId];
  if(!g) return;
  if(hRaw===''&&aRaw===''){g.score=null;saveData();renderPlayoffs();renderPlayoffsAdmin();return;}
  const h=_clampScore(hRaw??'');
  const a=_clampScore(aRaw??'');
  if(h===null||a===null) return;
  g.score={h,a};
  saveData();renderPlayoffs();renderPlayoffsAdmin();
}

function saveSemiScore(pod,key){
  if(!isAdmin){showToast('🔒 Unlock Admin to enter scores');return;}
  const hEl=document.getElementById(`psh_${pod}_${key}`);
  const aEl=document.getElementById(`psa_${pod}_${key}`);
  const hRaw=hEl?.value;
  const aRaw=aEl?.value;
  if(!G.playoffs.semis[pod][key]) G.playoffs.semis[pod][key]={home:null,away:null,score:null};
  if(hRaw===''&&aRaw===''){G.playoffs.semis[pod][key].score=null;saveData();renderPlayoffs();renderPlayoffsAdmin();return;}
  const h=_clampScore(hRaw??'');
  const a=_clampScore(aRaw??'');
  if(h===null||a===null) return;
  G.playoffs.semis[pod][key].score={h,a};
  saveData();renderPlayoffs();renderPlayoffsAdmin();
}

function saveFinalScore(pod){
  if(!isAdmin){showToast('🔒 Unlock Admin to enter scores');return;}
  const hEl=document.getElementById('pfh_'+pod);
  const aEl=document.getElementById('pfa_'+pod);
  const hRaw=hEl?.value;
  const aRaw=aEl?.value;
  if(hRaw===''&&aRaw===''){G.playoffs.finals[pod].score=null;saveData();renderPlayoffs();renderPlayoffsAdmin();return;}
  const h=_clampScore(hRaw??'');
  const a=_clampScore(aRaw??'');
  if(h===null||a===null) return;
  G.playoffs.finals[pod].score={h,a};
  saveData();renderPlayoffs();renderPlayoffsAdmin();
}

// ── ANALOG CLOCK PICKER ───────────────────────────────────────────────────────
function _plyRenderClock(){
  const state=window._plyModalState;
  const el=document.getElementById('_pm_clock_face');
  if(!el) return;
  const isHour=state.clockStep==='hour';
  const size=220;
  const cx=size/2,cy=size/2,r=size/2-10;
  let items=[];
  if(isHour){for(let h=1;h<=12;h++) items.push({label:String(h),val:h});}
  else{['00','05','10','15','20','25','30','35','40','45','50','55'].forEach((m,i)=>items.push({label:m,val:m}));}
  const hands=items.map((item,i)=>{
    const angle=(i/items.length)*2*Math.PI-Math.PI/2;
    const hr=r*0.72;
    const x=cx+hr*Math.cos(angle);
    const y=cy+hr*Math.sin(angle);
    const selected=isHour?(state.hour===item.val):(state.min===item.val);
    return{...item,x,y,selected};
  });
  const sel=hands.find(h=>h.selected);
  const handLine=sel?`<line x1="${cx}" y1="${cy}" x2="${sel.x}" y2="${sel.y}" stroke="#0d1b2e" stroke-width="2.5" stroke-linecap="round"/>`:'';
  const centerDot=`<circle cx="${cx}" cy="${cy}" r="4" fill="#0d1b2e"/>`;
  const circles=hands.map(h=>`
    <g onclick="_plyClockTap('${h.val}')" style="cursor:pointer">
      <circle cx="${h.x}" cy="${h.y}" r="18" fill="${h.selected?'#0d1b2e':'transparent'}"/>
      <text x="${h.x}" y="${h.y}" text-anchor="middle" dominant-baseline="central"
        font-size="13" font-weight="${h.selected?'800':'600'}" fill="${h.selected?'#fff':'#0d1b2e'}"
        font-family="sans-serif">${h.label}</text>
    </g>`).join('');
  el.innerHTML=`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;margin:0 auto">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#f7f8fb" stroke="#e2e6ec" stroke-width="1.5"/>
      ${handLine}${centerDot}${circles}
    </svg>
    <div style="text-align:center;margin-top:8px;font-size:22px;font-weight:800;color:#0d1b2e;letter-spacing:1px">
      ${state.hour}:${state.min}
      <span onclick="_plySetAmpm('AM')" style="font-size:14px;font-weight:700;cursor:pointer;color:${state.ampm==='AM'?'#0d1b2e':'#9aacbf'}">AM</span>
      <span style="color:#e2e6ec;margin:0 2px">/</span>
      <span onclick="_plySetAmpm('PM')" style="font-size:14px;font-weight:700;cursor:pointer;color:${state.ampm==='PM'?'#0d1b2e':'#9aacbf'}">PM</span>
    </div>
    <div style="text-align:center;margin-top:4px;font-size:11px;font-weight:600;color:#6b7d94;text-transform:uppercase;letter-spacing:0.5px">
      ${isHour?'Tap hour → then tap minutes':'Tap minutes'}
    </div>`;
}

function _plyClockTap(val){
  const state=window._plyModalState;
  if(state.clockStep==='hour'){state.hour=parseInt(val);state.clockStep='minute';}
  else{state.min=String(val).padStart(2,'0');state.clockStep='hour';}
  const el=document.getElementById('_pm_time');
  if(el) el.value=`${state.hour}:${state.min} ${state.ampm}`;
  _plyRenderClock();_plyModalRefresh();
}

function _plySetAmpm(ap){
  window._plyModalState.ampm=ap;
  const el=document.getElementById('_pm_time');
  if(el) el.value=`${window._plyModalState.hour}:${window._plyModalState.min} ${ap}`;
  _plyRenderClock();_plyModalRefresh();
}

function _plySelectDiamond(id){
  window._plyModalState.diamond=id;
  _plyModalRefresh();
}

function _plyModalRefresh(){
  const date=document.getElementById('_pm_date')?.value||'';
  const time=document.getElementById('_pm_time')?.value?.trim()||'';
  const state=window._plyModalState;
  const existingPly=state?.existingPly||[];
  const dmEl=document.getElementById('_pm_diamonds');
  if(!dmEl) return;
  const diamonds=G.diamonds.filter(d=>d.active);
  const bookedDiamonds=new Set(existingPly.filter(g=>g.date===date&&g.time===time).map(g=>g.diamond));
  const busyTeams=new Set(existingPly.filter(g=>g.date===date&&g.time===time).flatMap(g=>[g.home,g.away]));
  const teamConflict=busyTeams.has(state.home)||busyTeams.has(state.away);
  dmEl.innerHTML=diamonds.map(d=>{
    const booked=bookedDiamonds.has(d.id);
    const isSelected=state.diamond===d.id;
    const bg=isSelected?'#0d1b2e':booked?'#fee2e2':'#f7f8fb';
    const color=isSelected?'#fff':booked?'#b91c1c':'#0d1b2e';
    const border=isSelected?'#0d1b2e':booked?'#fca5a5':'#e2e6ec';
    return`<button type="button" ${booked?'disabled':''} onclick="_plySelectDiamond(${d.id})"
      style="padding:5px 12px;border-radius:6px;border:1.5px solid ${border};background:${bg};font-size:12px;font-weight:600;color:${color};cursor:${booked?'not-allowed':'pointer'};font-family:sans-serif">
      D${d.id}${d.lights?' 💡':' 🌙'}${booked?' ✗':''}</button>`;
  }).join('');
  const conflictEl=document.getElementById('_pm_conflicts');
  if(conflictEl){
    const msgs=[];
    if(teamConflict){
      const who=[state.home,state.away].filter(t=>busyTeams.has(t));
      msgs.push(`⚠ ${who.join(' and ')} already ha${who.length>1?'ve':'s'} a game at this date and time.`);
    }
    if(msgs.length){conflictEl.style.display='block';conflictEl.innerHTML=msgs.join('<br>');}
    else conflictEl.style.display='none';
  }
}

function _plyModalSubmit(){
  const{plyId,home,away}=window._plyModalState;
  const date=document.getElementById('_pm_date')?.value;
  const time=document.getElementById('_pm_time')?.value?.trim();
  const dmId=window._plyModalState?.diamond;
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('Please enter a valid date.');return;}
  if(!time){alert('Please select a time.');return;}
  if(!dmId){alert('Please select a diamond.');return;}
  const dm=G.diamonds.find(d=>d.id===dmId);
  const existingPly=G.sched.filter(g=>g.playoff&&g.plyId!==plyId);
  const busyTeams=new Set(existingPly.filter(g=>g.date===date&&g.time===time).flatMap(g=>[g.home,g.away]));
  const teamConflict=[home,away].filter(t=>busyTeams.has(t));
  if(teamConflict.length){
    if(!confirm(`⚠ ${teamConflict.join(' and ')} already ha${teamConflict.length>1?'ve':'s'} a game at this time.\n\nSchedule anyway?`)) return;
  }
  G.sched=G.sched.filter(g=>g.plyId!==plyId);
  const yr=date.slice(2,4);
  const maxSeq=G.sched.reduce((max,g)=>{if(!g.id.startsWith(yr))return max;return Math.max(max,parseInt(g.id.slice(2))||0);},0);
  const newId=`${yr}${String(maxSeq+1).padStart(3,'0')}`;
  G.sched.push({id:newId,date,time,diamond:dmId,lights:dm?.lights||false,home,away,bye:'',crossover:false,playoff:true,plyId});
  G.sched.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')||(a.diamond-b.diamond));
  document.getElementById('_ply_modal')?.remove();
  saveData();renderPlayoffs();renderPlayoffsAdmin();renderSched();renderScores();
  showToast(`📅 Playoff game scheduled — ${home} vs ${away}`);
}

function schedulePlayoffGame(plyId,home,away){
  if(!checkAdmin()) return;
  const existingPly=G.sched.filter(g=>g.playoff&&g.plyId!==plyId);
  document.getElementById('_ply_modal')?.remove();
  const modal=document.createElement('div');
  modal.id='_ply_modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(13,27,46,0.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px';
  window._plyModalState={plyId,home,away,hour:6,min:'30',ampm:'PM',diamond:null,existingPly,clockStep:'hour'};
  modal.innerHTML=`
    <div style="background:#fff;border-radius:12px;padding:24px;width:100%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,0.25);font-family:sans-serif;max-height:90vh;overflow-y:auto">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#6b7d94;margin-bottom:4px">Schedule Playoff Game</div>
      <div style="font-size:16px;font-weight:800;color:#0d1b2e;margin-bottom:18px">${esc(home)} <span style="color:#6b7d94;font-weight:400">vs</span> ${esc(away)}</div>
      <div style="display:grid;gap:16px">
        <div>
          <label style="font-size:11px;font-weight:700;color:#6b7d94;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px">Date</label>
          <input type="date" id="_pm_date" value="2026-10-06" style="width:100%;font-size:13px;padding:8px 10px;border:1.5px solid #e2e6ec;border-radius:8px;font-family:sans-serif;box-sizing:border-box;outline:none" oninput="_plyModalRefresh()"/>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#6b7d94;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px">Time</label>
          <input type="text" id="_pm_time" placeholder="Tap clock to set time" readonly style="width:100%;font-size:15px;font-weight:700;padding:8px 12px;border:1.5px solid #e2e6ec;border-radius:8px;font-family:sans-serif;box-sizing:border-box;outline:none;text-align:center;cursor:default;color:#0d1b2e;background:#f7f8fb"/>
          <div id="_pm_clock_face" style="margin-top:12px"></div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#6b7d94;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px">Diamond</label>
          <div id="_pm_diamonds" style="display:flex;flex-wrap:wrap;gap:6px"></div>
        </div>
        <div id="_pm_conflicts" style="display:none;background:#fff3bf;border:1px solid #ffe066;border-radius:6px;padding:8px 12px;font-size:12px;color:#7c5c00"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:20px">
        <button type="button" onclick="_plyModalSubmit()" style="flex:1;padding:10px;background:#0d1b2e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:sans-serif">✓ Confirm</button>
        <button type="button" onclick="document.getElementById('_ply_modal').remove()" style="padding:10px 16px;background:none;border:1.5px solid #e2e6ec;border-radius:8px;font-size:13px;color:#6b7d94;cursor:pointer;font-family:sans-serif">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
  _plyRenderClock();_plyModalRefresh();
}

function removePlayoffSchedule(plyId){
  if(!checkAdmin()) return;
  G.sched=G.sched.filter(g=>g.plyId!==plyId);
  saveData();renderPlayoffs();renderPlayoffsAdmin();renderSched();renderScores();
  showToast('📅 Playoff game unscheduled');
}

function getPlayoffSchedEntry(plyId){
  return G.sched.find(g=>g.plyId===plyId)||null;
}

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
    if(hw){stats[g.home].w++;stats[g.home].pts+=2;stats[g.away].l++;}
    else if(aw){stats[g.away].w++;stats[g.away].pts+=2;stats[g.home].l++;}
    else{stats[g.home].tie++;stats[g.home].pts++;stats[g.away].tie++;stats[g.away].pts++;}
    const homePts=hw?2:tie?1:0;
    const awayPts=aw?2:tie?1:0;
    h2h[g.home][g.away].pts+=homePts;
    h2h[g.home][g.away].games.push({date:g.date,homePts});
    h2h[g.away][g.home].pts+=awayPts;
    h2h[g.away][g.home].games.push({date:g.date,homePts:awayPts});
  }
  function stableRand(a,b){return(a+b).split('').reduce((n,c)=>n+c.charCodeAt(0),0)%2===0;}
  function tiebreak(group){
    if(group.length===1) return group[0];
    const h2hPts={};
    for(const t of group){h2hPts[t]=0;for(const u of group)if(u!==t)h2hPts[t]+=(h2h[t][u]?.pts||0);}
    const maxH2H=Math.max(...group.map(t=>h2hPts[t]));
    const afterH2H=group.filter(t=>h2hPts[t]===maxH2H);
    if(afterH2H.length===1) return afterH2H[0];
    const allGames=[];
    for(let i=0;i<afterH2H.length;i++)
      for(let j=i+1;j<afterH2H.length;j++){
        const a=afterH2H[i],b=afterH2H[j];
        for(const g of(h2h[a][b]?.games||[]))
          allGames.push({date:g.date,winner:g.homePts===2?a:g.homePts===0?b:null});
      }
    allGames.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
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
    if(group.length===1){ranked.push({team:group[0],...stats[group[0]]});}
    else{
      const rankGroup=(g)=>{
        if(!g.length) return[];
        const winner=tiebreak(g);
        return[{team:winner,...stats[winner]},...rankGroup(g.filter(t=>t!==winner))];
      };
      ranked.push(...rankGroup(group));
    }
    i=j;
  }
  return ranked.map((r,i)=>({...r,rank:i+1}));
}

function scoreInput(idH,idA,valH,valA,onChange){
  return `<td class="g-si"><input type="number" min="0" class="si" id="${idH}" value="${valH}" placeholder="–" onchange="${onChange}"/></td><td class="g-sep">–</td><td class="g-si"><input type="number" min="0" class="si" id="${idA}" value="${valA}" placeholder="–" onchange="${onChange}"/></td>`;
}

function schedBtn(plyId,home,away){
  const entry=getPlayoffSchedEntry(plyId);
  const safeHome=(home||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const safeAway=(away||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  if(entry){
    return `<td style="padding:4px 6px;white-space:nowrap">
      <div style="display:inline-flex;align-items:center;gap:8px;background:#0d1b2e;border-radius:6px;padding:5px 10px">
        <span style="font-size:12px">📅</span>
        <div style="line-height:1.4">
          <div style="font-size:12px;font-weight:700;color:#fff">${entry.date} · ${entry.time}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.6)">${getDiamondName(entry.diamond)}</div>
        </div>
        <button onclick="removePlayoffSchedule('${plyId}')" title="Remove" style="margin-left:2px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:4px;cursor:pointer;color:rgba(255,255,255,0.7);font-size:11px;padding:2px 6px;line-height:1">✕</button>
      </div>
    </td>`;
  }
  return `<td style="padding:4px 6px">
    <button onclick="schedulePlayoffGame('${plyId}','${safeHome}','${safeAway}')" style="font-size:11px;padding:4px 10px;background:#f7f8fb;border:1.5px solid #cdd3dd;border-radius:5px;cursor:pointer;color:#0d1b2e;font-weight:600;white-space:nowrap;font-family:sans-serif">📅 Schedule</button>
  </td>`;
}

function winnerOf(sc,home,away){
  if(!sc) return null;
  if(sc.h>sc.a) return home;
  if(sc.a>sc.h) return away;
  return null;
}

// ── SHARED HELPERS ────────────────────────────────────────────────────────────
function _bracketTeam(team,score,isWinner,isEmpty){
  const bg=isWinner?'#0d1b2e':isEmpty?'#f7f8fb':'#fff';
  const color=isWinner?'#fff':isEmpty?'#9aacbf':'#0d1b2e';
  const border=isWinner?'#0d1b2e':isEmpty?'#e2e6ec':'#cdd3dd';
  return`<div style="background:${bg};border:1.5px solid ${border};border-radius:6px;padding:7px 12px;min-width:160px;display:flex;justify-content:space-between;align-items:center;gap:8px">
    <span style="font-size:13px;font-weight:${isWinner?'800':'600'};color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px">${esc(team||'TBD')}</span>
    ${score!==''&&score!==undefined&&score!==null?`<span style="font-family:monospace;font-size:14px;font-weight:800;color:${isWinner?'#fff':'#0d1b2e'};flex-shrink:0">${score}</span>`:''}
  </div>`;
}

function _bracketGame(label,g,podKey,key,plyId,inputIdH,inputIdA,onChange){
  const w=winnerOf(g.score,g.home,g.away);
  const entry=getPlayoffSchedEntry(plyId);
  const safeHome=(g.home||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const safeAway=(g.away||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const schedInfo=entry
    ?`<div style="font-size:10px;color:#6b7d94;margin-top:5px;text-align:center;display:flex;align-items:center;justify-content:center;gap:4px">
        <span>📅 ${entry.date} · ${entry.time} · ${getDiamondName(entry.diamond)}</span>
        <button onclick="removePlayoffSchedule('${plyId}')" style="background:none;border:none;cursor:pointer;color:#e03131;font-size:11px;padding:0;line-height:1">✕</button>
      </div>`
    :`<div style="text-align:center;margin-top:5px">
        <button onclick="schedulePlayoffGame('${plyId}','${safeHome}','${safeAway}')" style="font-size:10px;padding:3px 10px;background:#f7f8fb;border:1.5px solid #cdd3dd;border-radius:4px;cursor:pointer;color:#0d1b2e;font-weight:600;font-family:sans-serif">📅 Schedule</button>
      </div>`;
  return`<div style="display:flex;flex-direction:column;gap:3px">
    <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;color:#9aacbf;margin-bottom:2px;text-align:center">${label}</div>
    ${_bracketTeam(g.home,g.score?g.score.h:'',w===g.home,!g.home)}
    <div style="display:flex;align-items:center;gap:4px;justify-content:center;padding:2px 0">
      <input type="number" min="0" class="si" id="${inputIdH}" value="${g.score?g.score.h:''}" placeholder="–" onchange="${onChange}" style="width:42px;text-align:center"/>
      <span style="color:#9aacbf;font-size:12px">–</span>
      <input type="number" min="0" class="si" id="${inputIdA}" value="${g.score?g.score.a:''}" placeholder="–" onchange="${onChange}" style="width:42px;text-align:center"/>
    </div>
    ${_bracketTeam(g.away,g.score?g.score.a:'',w===g.away,!g.away)}
    ${schedInfo}
  </div>`;
}

function _buildStandingsTable(standing,rrPlayed,rrTotal,isPodA,rrDone){
  let h=`<div style="font-size:11px;color:var(--muted);margin-bottom:10px">${rrPlayed}/${rrTotal} round robin games played</div>`;
  h+=`<table class="st" style="margin-bottom:12px"><thead><tr><th>#</th><th>Team</th><th>Record</th><th>Pts</th><th>RF</th><th>RA</th><th>Diff</th></tr></thead><tbody>`;
  h+=standing.map((s,i)=>{
    const diff=s.rf-s.ra;
    const elim=isPodA&&i===4&&rrDone;
    return`<tr style="${elim?'opacity:0.45;text-decoration:line-through':''}${i===0?';background:#f0f9ff':''}">
      <td class="rank">${i+1}</td>
      <td style="font-weight:600">${esc(s.team)}</td>
      <td class="rec">${s.w}-${s.l}${s.tie?'-'+s.tie:''}</td>
      <td class="mono" style="font-weight:700;color:var(--navy)">${s.pts}</td>
      <td class="mono">${s.rf}</td><td class="mono">${s.ra}</td>
      <td class="mono">${(diff>0?'+':'')+diff}</td>
    </tr>`;
  }).join('');
  h+=`</tbody></table>`;
  return h;
}

// ── PUBLIC READ-ONLY POD ──────────────────────────────────────────────────────
function renderPodPublic(podLabel,pfx,podKey,seeds){
  const standing=podRRStandings(seeds,pfx);
  const games=Object.values(G.playoffs.games).filter(g=>g.id.startsWith(pfx+'RR')).sort((a,b)=>a.id.localeCompare(b.id));
  const rrTotal=games.length;
  const rrPlayed=games.filter(g=>g.score).length;
  const rrDone=rrPlayed===rrTotal;
  const fin=G.playoffs.finals[podKey];
  const semis=G.playoffs.semis[podKey];
  const isPodA=pfx==='PA';
  const sm1=semis.s1||{home:'TBD',away:'TBD',score:null};
  const sm2=semis.s2||{home:'TBD',away:'TBD',score:null};
  const semi1winner=winnerOf(sm1.score,sm1.home,sm1.away);
  const semi2winner=winnerOf(sm2.score,sm2.home,sm2.away);
  const champion=winnerOf(fin.score,fin.home,fin.away);

  let h=`<div class="card"><div class="card-title">${esc(podLabel)}</div>`;
  h+=_buildStandingsTable(standing,rrPlayed,rrTotal,isPodA,rrDone);

  h+=`<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Round Robin Results</div>`;
  h+=`<table class="gt" style="margin-bottom:12px">`;
  for(const g of games){
    const sc=g.score;
    const winner=winnerOf(sc,g.home,g.away);
    const entry=getPlayoffSchedEntry(g.id);
    h+=`<tr class="${sc?'':'empty-slot'}">
      <td class="g-num"><span class="gnum">${g.id}</span></td>
      <td class="g-home" style="font-weight:600${winner===g.home?';color:var(--navy)':''}">${esc(g.home)}</td>
      <td class="g-vs">vs</td>
      <td class="g-away" style="font-weight:600${winner===g.away?';color:var(--navy)':''}">${esc(g.away)}</td>
      <td class="g-sc" colspan="3" style="color:var(--text2)">${sc?`${sc.h}–${sc.a}${winner?' · ✓ '+esc(winner):''}`:entry?`📅 ${entry.date} · ${entry.time}`:'—'}</td>
    </tr>`;
  }
  h+=`</table>`;

  h+=`<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Elimination Bracket</div>`;
  if(!rrDone){
    h+=`<div class="notice">Round robin in progress — ${rrPlayed}/${rrTotal} games complete.</div>`;
  } else {
    if(isPodA){
      h+=`<div class="notice" style="background:#fff0f0;border-color:var(--red)">⛔ ${esc(standing[4]?.team||'5th')} eliminated after round robin.</div>`;
      [[sm1,'Semi 1 · 1 vs 4',podKey+'_s1'],[sm2,'Semi 2 · 2 vs 3',podKey+'_s2']].forEach(([g,label,pid])=>{
        const w=winnerOf(g.score,g.home,g.away);
        const entry=getPlayoffSchedEntry(pid);
        h+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px;background:${g.score?'#f0f9ff':'var(--surface)'}">
          <span style="font-size:11px;font-weight:700;color:var(--muted);min-width:80px">${label}</span>
          <span style="font-weight:${w===g.home?'800':'600'};color:${w===g.home?'var(--navy)':'var(--text)'}">${esc(g.home||'TBD')}</span>
          <span style="font-family:var(--mono);font-size:13px;color:var(--muted);margin:0 8px">${g.score?`${g.score.h} – ${g.score.a}`:'vs'}</span>
          <span style="font-weight:${w===g.away?'800':'600'};color:${w===g.away?'var(--navy)':'var(--text)'}">${esc(g.away||'TBD')}</span>
          ${entry&&!g.score?`<span style="font-size:11px;color:var(--muted);margin-left:8px">📅 ${entry.date}</span>`:''}
        </div>`;
      });
      if(fin.home){
        const entry=getPlayoffSchedEntry(podKey+'_final');
        h+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:2px solid var(--navy);border-radius:6px;margin-bottom:6px;background:var(--surface)">
          <span style="font-size:11px;font-weight:800;color:var(--navy);min-width:80px">FINAL</span>
          <span style="font-weight:${champion===fin.home?'800':'600'};color:${champion===fin.home?'var(--navy)':'var(--text)'}">${esc(fin.home)}</span>
          <span style="font-family:var(--mono);font-size:14px;font-weight:800;color:var(--navy);margin:0 8px">${fin.score?`${fin.score.h} – ${fin.score.a}`:'vs'}</span>
          <span style="font-weight:${champion===fin.away?'800':'600'};color:${champion===fin.away?'var(--navy)':'var(--text)'}">${esc(fin.away)}</span>
          ${entry&&!fin.score?`<span style="font-size:11px;color:var(--muted);margin-left:8px">📅 ${entry.date}</span>`:''}
        </div>`;
      } else {
        h+=`<div class="notice">Complete both semi-finals to determine finalists.</div>`;
      }
    } else {
      // POD B read-only bracket
      const finGame={home:fin.home||(semi1winner||'TBD'),away:fin.away||(semi2winner||'TBD'),score:fin.score};
      const connector=`<svg width="48" height="200" viewBox="0 0 48 200" style="flex-shrink:0">
        <path d="M0 50 H24 V150 H0" fill="none" stroke="#cdd3dd" stroke-width="1.5"/>
        <path d="M24 100 H48" fill="none" stroke="#cdd3dd" stroke-width="1.5"/>
      </svg>`;
      function roGame(label,g,pid){
        const w=winnerOf(g.score,g.home,g.away);
        const entry=getPlayoffSchedEntry(pid);
        return`<div style="display:flex;flex-direction:column;gap:3px;min-width:160px">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;color:#9aacbf;text-align:center;margin-bottom:2px">${label}</div>
          ${_bracketTeam(g.home,g.score?g.score.h:'',w===g.home,!g.home)}
          <div style="text-align:center;font-size:12px;color:var(--muted);padding:2px 0">${g.score?`${g.score.h} – ${g.score.a}`:'vs'}</div>
          ${_bracketTeam(g.away,g.score?g.score.a:'',w===g.away,!g.away)}
          ${entry?`<div style="font-size:10px;color:#6b7d94;text-align:center;margin-top:4px">📅 ${entry.date} · ${entry.time} · ${getDiamondName(entry.diamond)}</div>`:''}
        </div>`;
      }
      h+=`<div style="overflow-x:auto;padding-bottom:8px"><div style="display:inline-flex;align-items:center;gap:0;min-width:420px">
        <div style="display:flex;flex-direction:column;gap:24px">
          ${roGame('Semi-Final 1 · 1 vs 4',sm1,podKey+'_s1')}
          ${roGame('Semi-Final 2 · 2 vs 3',sm2,podKey+'_s2')}
        </div>
        ${connector}
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
          ${roGame(`${podLabel} Final`,finGame,podKey+'_final')}
          ${champion?`<div style="margin-top:4px;padding:10px 16px;background:linear-gradient(135deg,#0d1b2e,#1e3057);border-radius:8px;color:#fff;text-align:center;min-width:160px">
            <div style="font-size:10px;opacity:0.6;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">Champion</div>
            <div style="font-size:18px;font-weight:800">🏆 ${esc(champion)}</div>
          </div>`:''}
        </div>
      </div></div>`;
    }
    if(champion){
      h+=`<div style="padding:14px 16px;background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:var(--r);color:#fff;text-align:center;margin-top:12px">
        <div style="font-size:11px;font-weight:600;opacity:0.6;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">${podLabel} Champion</div>
        <div style="font-size:24px;font-weight:800">🏆 ${esc(champion)}</div>
      </div>`;
    }
  }
  h+=`</div>`;
  return h;
}

// ── ADMIN EDITABLE POD ────────────────────────────────────────────────────────
function renderPodAdmin(podLabel,pfx,podKey,seeds){
  const standing=podRRStandings(seeds,pfx);
  const games=Object.values(G.playoffs.games).filter(g=>g.id.startsWith(pfx+'RR')).sort((a,b)=>a.id.localeCompare(b.id));
  const rrTotal=games.length;
  const rrPlayed=games.filter(g=>g.score).length;
  const rrDone=rrPlayed===rrTotal;
  const semis=G.playoffs.semis[podKey];
  const fin=G.playoffs.finals[podKey];
  const isPodA=pfx==='PA';
  const s1=standing[0]?.team,s2=standing[1]?.team,s3=standing[2]?.team,s4=standing[3]?.team;

  let stateChanged=false;
  if(rrDone&&s1&&s2&&s3&&s4){
    if(!semis.s1||semis.s1.home!==s1||semis.s1.away!==s4){G.playoffs.semis[podKey].s1={home:s1,away:s4,score:semis.s1?.score||null};stateChanged=true;}
    if(!semis.s2||semis.s2.home!==s2||semis.s2.away!==s3){G.playoffs.semis[podKey].s2={home:s2,away:s3,score:semis.s2?.score||null};stateChanged=true;}
  }
  const sm1=G.playoffs.semis[podKey].s1||{home:s1||'TBD',away:s4||'TBD',score:null};
  const sm2=G.playoffs.semis[podKey].s2||{home:s2||'TBD',away:s3||'TBD',score:null};
  const semi1winner=winnerOf(sm1.score,sm1.home,sm1.away);
  const semi2winner=winnerOf(sm2.score,sm2.home,sm2.away);
  if(semi1winner&&semi2winner){
    if(!fin.home||fin.home!==semi1winner||fin.away!==semi2winner){
      G.playoffs.finals[podKey].home=semi1winner;G.playoffs.finals[podKey].away=semi2winner;stateChanged=true;
    }
  }
  if(stateChanged) saveData();
  const champion=winnerOf(fin.score,fin.home,fin.away);

  let h=`<div class="card"><div class="card-title">${esc(podLabel)}</div>`;
  h+=_buildStandingsTable(standing,rrPlayed,rrTotal,isPodA,rrDone);

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

  h+=`<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Elimination Bracket</div>`;
  if(!rrDone){
    h+=`<div class="notice">Complete all round robin games to unlock the bracket.</div>`;
  } else if(isPodA){
    h+=`<div class="notice" style="background:#fff0f0;border-color:var(--red)">⛔ ${esc(standing[4]?.team||'5th')} is eliminated after the round robin.</div>`;
    h+=`<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px">Semi-Finals</div>`;
    h+=`<table class="gt" style="margin-bottom:10px">`;
    [{key:'s1',g:sm1,label:'1 vs 4'},{key:'s2',g:sm2,label:'2 vs 3'}].forEach(({key,g,label})=>{
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
  } else {
    const finGame={home:fin.home||(semi1winner||'TBD'),away:fin.away||(semi2winner||'TBD'),score:fin.score};
    const connector=`<svg width="48" height="240" viewBox="0 0 48 240" style="flex-shrink:0">
      <path d="M0 60 H24 V180 H0" fill="none" stroke="#cdd3dd" stroke-width="1.5"/>
      <path d="M24 120 H48" fill="none" stroke="#cdd3dd" stroke-width="1.5"/>
    </svg>`;
    h+=`<div style="overflow-x:auto;padding-bottom:8px"><div style="display:inline-flex;align-items:center;gap:0;min-width:480px">
      <div style="display:flex;flex-direction:column;gap:24px">
        ${_bracketGame('Semi-Final 1 · 1 vs 4',sm1,podKey,'s1',`${podKey}_s1`,`psh_${podKey}_s1`,`psa_${podKey}_s1`,`saveSemiScore('${podKey}','s1')`)}
        ${_bracketGame('Semi-Final 2 · 2 vs 3',sm2,podKey,'s2',`${podKey}_s2`,`psh_${podKey}_s2`,`psa_${podKey}_s2`,`saveSemiScore('${podKey}','s2')`)}
      </div>
      ${connector}
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        ${_bracketGame(`${podLabel} Final`,finGame,podKey,'final',`${podKey}_final`,`pfh_${podKey}`,`pfa_${podKey}`,`saveFinalScore('${podKey}')`)}
        ${champion?`<div style="margin-top:4px;padding:10px 16px;background:linear-gradient(135deg,#0d1b2e,#1e3057);border-radius:8px;color:#fff;text-align:center;min-width:160px">
          <div style="font-size:10px;opacity:0.6;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">Champion</div>
          <div style="font-size:18px;font-weight:800">🏆 ${esc(champion)}</div>
        </div>`:''}
      </div>
    </div></div>`;
  }
  h+=`</div>`;
  return h;
}

// ── PUBLIC PLAYOFFS TAB (display only) ───────────────────────────────────────
function renderPlayoffs(){
  const el=document.getElementById('ply');
  if(!el) return;
  const p=G.playoffs||{seeded:false};
  if(!p.seeded){
    const ranked=getRegularSeasonRanking();
    el.innerHTML=`
      <div class="card">
        <div class="card-title">Playoffs</div>
        <div class="notice">Playoffs have not been seeded yet. Standings will determine seeding once the regular season is complete.</div>
        ${ranked.length>=9?`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          <div style="padding:12px;background:var(--surface2);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:6px">POD A — Top 5</div>
            ${ranked.slice(0,5).map(r=>{const t=r.tied?` <span style="color:var(--orange);font-size:10px">TB</span>`:'';return`<div style="font-size:13px;padding:3px 0;display:flex;justify-content:space-between"><span>${r.seed}. ${esc(r.team)}${t}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">${r.pts}pts</span></div>`;}).join('')}
          </div>
          <div style="padding:12px;background:var(--surface2);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:6px">POD B — Bottom 4</div>
            ${ranked.slice(5).map(r=>{const t=r.tied?` <span style="color:var(--orange);font-size:10px">TB</span>`:'';return`<div style="font-size:13px;padding:3px 0;display:flex;justify-content:space-between"><span>${r.seed}. ${esc(r.team)}${t}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">${r.pts}pts</span></div>`;}).join('')}
          </div>
        </div>`:''}
      </div>
      <div class="card">
        <div class="card-title">Format</div>
        <div style="display:grid;gap:10px">
          <div style="padding:12px;background:var(--surface2);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);margin-bottom:6px">POD A — Top 5 Teams</div>
            <div style="font-size:13px;color:var(--text);display:grid;gap:3px">
              <div>① Round Robin — each team plays the other 4 once (10 games)</div>
              <div>② 5th place is <strong>eliminated</strong></div>
              <div>③ Semi-Finals — Seed 1 vs 4 · Seed 2 vs 3</div>
              <div>④ POD A Final</div>
            </div>
          </div>
          <div style="padding:12px;background:var(--surface2);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);margin-bottom:6px">POD B — Bottom 4 Teams</div>
            <div style="font-size:13px;color:var(--text);display:grid;gap:3px">
              <div>① Round Robin — each team plays the other 3 once (6 games)</div>
              <div>② Semi-Finals — Seed 1 vs 4 · Seed 2 vs 3</div>
              <div>③ POD B Final</div>
            </div>
          </div>
        </div>
      </div>`;
    return;
  }
  let html=`<div style="font-size:13px;color:var(--muted);margin-bottom:12px">Playoff results · Scoring and scheduling managed in Admin → Edit Playoffs</div>`;
  html+=renderPodPublic('POD A — Top 5','PA','podA',p.podA);
  html+=renderPodPublic('POD B — Bottom 4','PB','podB',p.podB);
  el.innerHTML=html;
}

// ── ADMIN PLAYOFFS TAB (editable) ─────────────────────────────────────────────
function renderPlayoffsAdmin(){
  const el=document.getElementById('ply-admin');
  if(!el) return;
  const p=G.playoffs||{seeded:false};
  if(!p.seeded){
    const ranked=getRegularSeasonRanking();
    const hasScores=G.sched.some(g=>G.scores[g.id]);
    el.innerHTML=`
      <div class="card">
        <div class="card-title">Playoffs — Setup</div>
        <div class="notice">Seeding is pulled from final regular season standings. Make sure all regular season scores are entered first.</div>
        ${ranked.length>=9?`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div style="padding:12px;background:var(--surface2);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:6px">POD A — Top 5</div>
            ${ranked.slice(0,5).map(r=>{const t=r.tied?` <span style="color:var(--orange);font-size:10px">TB</span>`:'';return`<div style="font-size:13px;padding:3px 0;display:flex;justify-content:space-between"><span>${r.seed}. ${esc(r.team)}${t}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">(${r.w}-${r.l}${r.tie?'-'+r.tie:''}) <strong style="color:var(--navy)">${r.pts}pts</strong></span></div>`;}).join('')}
          </div>
          <div style="padding:12px;background:var(--surface2);border-radius:var(--r-sm)">
            <div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:6px">POD B — Bottom 4</div>
            ${ranked.slice(5).map(r=>{const t=r.tied?` <span style="color:var(--orange);font-size:10px">TB</span>`:'';return`<div style="font-size:13px;padding:3px 0;display:flex;justify-content:space-between"><span>${r.seed}. ${esc(r.team)}${t}</span><span style="font-family:var(--mono);font-size:12px;color:var(--muted)">(${r.w}-${r.l}${r.tie?'-'+r.tie:''}) <strong style="color:var(--navy)">${r.pts}pts</strong></span></div>`;}).join('')}
          </div>
        </div>`:''}
        <button class="btn btn-primary" onclick="seedPlayoffs()">🏆 Seed Playoffs from Standings</button>
        ${!hasScores?'<div style="margin-top:8px;font-size:12px;color:var(--muted)">⚠ No scores entered yet — standings may not reflect final order</div>':''}
      </div>`;
    return;
  }
  let html=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
    <div style="font-size:13px;color:var(--muted)">Enter scores · Schedule games · Manage bracket</div>
    <button class="btn btn-sm" onclick="resetPlayoffs()" style="color:var(--red);border-color:var(--red)">↺ Reset Playoffs</button>
  </div>`;
  html+=renderPodAdmin('POD A — Top 5','PA','podA',p.podA);
  html+=renderPodAdmin('POD B — Bottom 4','PB','podB',p.podB);
  el.innerHTML=html;
}
