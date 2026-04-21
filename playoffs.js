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

// ── PLAYOFF SCHEDULER MODAL ───────────────────────────────────────────────────
function schedulePlayoffGame(plyId, home, away){
  if(!checkAdmin()) return;

  // Build conflict data from existing playoff schedule entries
  const existingPly=G.sched.filter(g=>g.playoff&&g.plyId!==plyId);

  // All active diamonds
  const diamonds=G.diamonds.filter(d=>d.active);

  // Remove existing modal if any
  document.getElementById('_ply_modal')?.remove();

  const modal=document.createElement('div');
  modal.id='_ply_modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(13,27,46,0.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px';

  modal.innerHTML=`
    <div style="background:#fff;border-radius:12px;padding:24px;width:100%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,0.25);font-family:var(--font)">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#6b7d94;margin-bottom:4px">Schedule Playoff Game</div>
      <div style="font-size:16px;font-weight:800;color:#0d1b2e;margin-bottom:18px">${esc(home)} <span style="color:#6b7d94;font-weight:400">vs</span> ${esc(away)}</div>

      <div style="display:grid;gap:14px">

        <div>
          <label style="font-size:11px;font-weight:700;color:#6b7d94;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px">Date</label>
          <input type="date" id="_pm_date" value="2026-10-06"
            style="width:100%;font-size:13px;padding:8px 10px;border:1.5px solid #e2e6ec;border-radius:8px;font-family:var(--font);box-sizing:border-box;outline:none"
            oninput="_plyModalRefresh()"/>
        </div>

        <div>
          <label style="font-size:11px;font-weight:700;color:#6b7d94;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px">Time</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px" id="_pm_time_chips">
            ${['6:00 PM','6:30 PM','7:00 PM','7:30 PM','8:00 PM','8:15 PM','8:30 PM'].map(t=>
              `<button type="button" onclick="_plySetTime('${t}')"
                style="padding:5px 12px;border-radius:20px;border:1.5px solid #e2e6ec;background:#f7f8fb;font-size:12px;font-weight:600;color:#0d1b2e;cursor:pointer;font-family:var(--font)"
                id="_pmtc_${t.replace(/[: ]/g,'_')}">${t}</button>`
            ).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="position:relative;flex:1">
              <input type="text" id="_pm_time" placeholder="or type e.g. 7:15 PM"
                style="width:100%;font-size:13px;padding:8px 10px;border:1.5px solid #e2e6ec;border-radius:8px;font-family:var(--font);box-sizing:border-box;outline:none"
                oninput="_plyTimeTyped()"/>
            </div>
          </div>
          <!-- Clock picker -->
          <div id="_pm_clock" style="margin-top:10px;display:none">
            <div style="display:flex;gap:10px;align-items:flex-start">
              <div>
                <div style="font-size:10px;font-weight:700;color:#6b7d94;text-transform:uppercase;margin-bottom:4px">Hour</div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">
                  ${[6,7,8,9].map(h=>`<button type="button" onclick="_plySetHour(${h})"
                    id="_pmh_${h}" style="padding:5px 0;border-radius:6px;border:1.5px solid #e2e6ec;background:#f7f8fb;font-size:12px;font-weight:700;color:#0d1b2e;cursor:pointer;font-family:var(--font)">${h}</button>`).join('')}
                </div>
              </div>
              <div>
                <div style="font-size:10px;font-weight:700;color:#6b7d94;text-transform:uppercase;margin-bottom:4px">Min</div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">
                  ${['00','15','30','45'].map(m=>`<button type="button" onclick="_plySetMin('${m}')"
                    id="_pmm_${m}" style="padding:5px 0;border-radius:6px;border:1.5px solid #e2e6ec;background:#f7f8fb;font-size:12px;font-weight:700;color:#0d1b2e;cursor:pointer;font-family:var(--font)">${m}</button>`).join('')}
                </div>
              </div>
              <div>
                <div style="font-size:10px;font-weight:700;color:#6b7d94;text-transform:uppercase;margin-bottom:4px">AM/PM</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
                  ${['AM','PM'].map(ap=>`<button type="button" onclick="_plySetAmpm('${ap}')"
                    id="_pmap_${ap}" style="padding:5px 0;border-radius:6px;border:1.5px solid #e2e6ec;background:#f7f8fb;font-size:12px;font-weight:700;color:#0d1b2e;cursor:pointer;font-family:var(--font)">${ap}</button>`).join('')}
                </div>
              </div>
            </div>
          </div>
          <button type="button" onclick="_plyToggleClock()" style="margin-top:6px;font-size:11px;color:#1971c2;background:none;border:none;cursor:pointer;padding:0;font-family:var(--font)">🕐 Toggle clock picker</button>
        </div>

        <div>
          <label style="font-size:11px;font-weight:700;color:#6b7d94;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px">Diamond</label>
          <div id="_pm_diamonds" style="display:flex;flex-wrap:wrap;gap:6px"></div>
        </div>

        <div id="_pm_conflicts" style="display:none;background:#fff3bf;border:1px solid #ffe066;border-radius:6px;padding:8px 12px;font-size:12px;color:#7c5c00"></div>

      </div>

      <div style="display:flex;gap:8px;margin-top:20px">
        <button type="button" onclick="_plyModalSubmit('${plyId}','${esc(home)}','${esc(away)}')"
          style="flex:1;padding:10px;background:#0d1b2e;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font)">✓ Confirm</button>
        <button type="button" onclick="document.getElementById('_ply_modal').remove()"
          style="padding:10px 16px;background:none;border:1.5px solid #e2e6ec;border-radius:8px;font-size:13px;color:#6b7d94;cursor:pointer;font-family:var(--font)">Cancel</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});

  // Store state on window for helpers
  window._plyModalState={plyId,home,away,hour:6,min:'30',ampm:'PM',diamond:null,existingPly};
  _plyModalRefresh();
}

function _plyToggleClock(){
  const cl=document.getElementById('_pm_clock');
  if(cl) cl.style.display=cl.style.display==='none'?'block':'none';
}

function _plySetHour(h){
  window._plyModalState.hour=h;
  _plyClockToInput();
}
function _plySetMin(m){
  window._plyModalState.min=m;
  _plyClockToInput();
}
function _plySetAmpm(ap){
  window._plyModalState.ampm=ap;
  _plyClockToInput();
}
function _plyClockToInput(){
  const{hour,min,ampm}=window._plyModalState;
  const t=`${hour}:${min} ${ampm}`;
  const el=document.getElementById('_pm_time');
  if(el) el.value=t;
  // highlight clock buttons
  [6,7,8,9].forEach(h=>{const b=document.getElementById(`_pmh_${h}`);if(b)b.style.background=h===hour?'#0d1b2e':b.style.background='#f7f8fb';if(b)b.style.color=h===hour?'#fff':'#0d1b2e';});
  ['00','15','30','45'].forEach(m=>{const b=document.getElementById(`_pmm_${m}`);if(b){b.style.background=m===window._plyModalState.min?'#0d1b2e':'#f7f8fb';b.style.color=m===window._plyModalState.min?'#fff':'#0d1b2e';}});
  ['AM','PM'].forEach(ap=>{const b=document.getElementById(`_pmap_${ap}`);if(b){b.style.background=ap===ampm?'#0d1b2e':'#f7f8fb';b.style.color=ap===ampm?'#fff':'#0d1b2e';}});
  _plyModalRefresh();
}

function _plySetTime(t){
  const el=document.getElementById('_pm_time');
  if(el) el.value=t;
  // parse into clock state
  const m=t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if(m){window._plyModalState.hour=parseInt(m[1]);window._plyModalState.min=m[2];window._plyModalState.ampm=m[3].toUpperCase();}
  _plyClockToInput();
  _plyModalRefresh();
}

function _plyTimeTyped(){
  _plyModalRefresh();
}

function _plyModalRefresh(){
  const date=document.getElementById('_pm_date')?.value||'';
  const time=document.getElementById('_pm_time')?.value?.trim()||'';
  const state=window._plyModalState;
  const existingPly=state?.existingPly||[];

  // Highlight time chips
  ['6:00 PM','6:30 PM','7:00 PM','7:30 PM','8:00 PM','8:15 PM','8:30 PM'].forEach(t=>{
    const b=document.getElementById('_pmtc_'+t.replace(/[: ]/g,'_'));
    if(b){b.style.background=t===time?'#0d1b2e':'#f7f8fb';b.style.color=t===time?'#fff':'#0d1b2e';b.style.borderColor=t===time?'#0d1b2e':'#e2e6ec';}
  });

  // Build diamond buttons with conflict info
  const dmEl=document.getElementById('_pm_diamonds');
  if(!dmEl) return;
  const diamonds=G.diamonds.filter(d=>d.active);

  // Conflicts: diamonds already booked at this date+time
  const bookedDiamonds=new Set(existingPly.filter(g=>g.date===date&&g.time===time).map(g=>g.diamond));
  // Teams already playing at this date+time
  const busyTeams=new Set(existingPly.filter(g=>g.date===date&&g.time===time).flatMap(g=>[g.home,g.away]));
  const teamConflict=busyTeams.has(state.home)||busyTeams.has(state.away);

  dmEl.innerHTML=diamonds.map(d=>{
    const booked=bookedDiamonds.has(d.id);
    const isSelected=state.diamond===d.id;
    const bg=isSelected?'#0d1b2e':booked?'#fee2e2':'#f7f8fb';
    const color=isSelected?'#fff':booked?'#b91c1c':'#0d1b2e';
    const border=isSelected?'#0d1b2e':booked?'#fca5a5':'#e2e6ec';
    const label=booked?'✗ Booked':'';
    return`<button type="button" ${booked?'disabled':''} onclick="_plySelectDiamond(${d.id})"
      style="padding:5px 12px;border-radius:6px;border:1.5px solid ${border};background:${bg};font-size:12px;font-weight:600;color:${color};cursor:${booked?'not-allowed':'pointer'};font-family:var(--font)">
      D${d.id}${d.lights?' 💡':' 🌙'}${label?` <span style="font-size:10px">${label}</span>`:''}
    </button>`;
  }).join('');

  // Show conflict warnings
  const conflictEl=document.getElementById('_pm_conflicts');
  if(conflictEl){
    const msgs=[];
    if(teamConflict){
      const who=[state.home,state.away].filter(t=>busyTeams.has(t));
      msgs.push(`⚠ ${who.join(' and ')} already ha${who.length>1?'ve':'s'} a game scheduled at this date and time.`);
    }
    if(msgs.length){conflictEl.style.display='block';conflictEl.innerHTML=msgs.join('<br>');}
    else{conflictEl.style.display='none';}
  }
}

function _plySelectDiamond(id){
  window._plyModalState.diamond=id;
  _plyModalRefresh();
}

function _plyModalSubmit(plyId,home,away){
  const date=document.getElementById('_pm_date')?.value;
  const time=document.getElementById('_pm_time')?.value?.trim();
  const dmId=window._plyModalState?.diamond;

  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('Please enter a valid date.');return;}
  if(!time){alert('Please select or enter a time.');return;}
  if(!dmId){alert('Please select a diamond.');return;}

  const dm=G.diamonds.find(d=>d.id===dmId);

  // Final conflict check — warn but allow override for teams
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
