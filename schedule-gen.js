// ── SCHEDULE GENERATOR ────────────────────────────────────────────────────────
let _genSchedRunning=false;

function genSched(){
  if(_genSchedRunning){alert('Schedule generation already in progress. Please wait.');return;}
  _genSchedRunning=true;
  
  const ss=document.getElementById('ss')?.value;
  const se=document.getElementById('se')?.value;
  const T1=document.getElementById('time1')?.value||'6:30 PM';
  const T2=document.getElementById('time2')?.value||'8:15 PM';
  const tfaced=parseInt(document.getElementById('tfaced')?.value)||2;
  const cobyes=Math.max(0,parseInt(document.getElementById('cobyes')?.value)||0);
  const gptInput=parseInt(document.getElementById('gpt')?.value)||null;
  const targetDh=parseInt(document.getElementById('targetDh')?.value)||0;

  if(!ss||!se){_genSchedRunning=false;alert('Set season start and end dates first.');return;}
  const days=getSelectedDays();
  if(!days.length){_genSchedRunning=false;alert('Select at least one game night.');return;}

  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  if(leagueTeams.length<2){_genSchedRunning=false;alert('Need at least 2 league teams.');return;}

  const activeDiamonds=G.diamonds.filter(d=>d.active);
  const d9=activeDiamonds.find(d=>d.id===9);
  const dhDiamonds=activeDiamonds.filter(d=>d.id!==9&&d.lights);
  const singleDiamonds=activeDiamonds.filter(d=>d.id!==9&&!d.lights);

  console.log('Schedule gen debug:',{leagueTeams,activeDiamondsCount:activeDiamonds.length,d9:!!d9,dhDiamonds:dhDiamonds.length,singleDiamonds:singleDiamonds.length,teams:G.teams});
  console.log('Active diamonds:',activeDiamonds.map(d=>({id:d.id,name:d.name,active:d.active,lights:d.lights})));
  console.log('Single diamonds (no lights):',singleDiamonds.map(d=>({id:d.id,name:d.name})));
  console.log('DH diamonds:',dhDiamonds.map(d=>({id:d.id,name:d.name})));

  const nights=getGameNights(ss,se,days);
  if(!nights.length){_genSchedRunning=false;alert('No game nights in selected date range.');return;}

  // ── Per-team game counter (league teams only; CrossOver is never capped) ────
  const teamGames={};
  for(const t of leagueTeams) teamGames[t]=0;

  const gamesLeft=(t)=>gptInput!=null?Math.max(0,gptInput-(teamGames[t]||0)):999;

  // ── CrossOver bye nights: evenly distributed ─────────────────────────────
  const coByeSet=new Set();
  if(d9&&cobyes>0){
    const clamped=Math.min(cobyes,nights.length);
    for(let b=0;b<clamped;b++){
      const idx=Math.round((b/clamped)*nights.length);
      for(let offset=0;offset<nights.length;offset++){
        const c=(idx+offset)%nights.length;
        if(!coByeSet.has(c)){coByeSet.add(c);break;}
      }
    }
  }

  // ── Cap-driven pair pool ──────────────────────────────────────────────────
  // Initial pool: tfaced rounds of all unique pairs, shuffled.
  // findPair() also generates on-demand extra-round pairs when pool is exhausted
  // so every team can reach gptInput exactly.
  function freshPool(){
    const pool=[];
    for(let i=0;i<leagueTeams.length;i++)
      for(let j=i+1;j<leagueTeams.length;j++)
        for(let r=0;r<tfaced;r++)
          pool.push([leagueTeams[i],leagueTeams[j]]);
    return shuffle(pool);
  }

  // Check if giving a team a bye on this night would violate strict constraints
  function wouldViolateByeConstraints(t,dateStr,nightIndex){
    // Rule 1: No back-to-back byes
    const lastBye=teamLastByeNight[t]||-2;
    if(lastBye===nightIndex-1) return true;
    // Rule 2: Max 1 bye per month
    const monthKey=dateStr.slice(0,7); // 'YYYY-MM'
    const monthByes=teamByesByMonth[t][monthKey]||0;
    if(monthByes>=1) return true;
    return false;
  }

  // Calculate bye rotation priority score (lower = higher priority to play)
  // Prioritizes teams with fewer byes and teams who didn't have bye last week
  function byePriorityScore(t,currentNight,dateStr){
    const byeCount=teamByeCount[t]||0;
    const lastBye=teamLastByeNight[t]||-2;
    // CRITICAL: Teams that would violate bye constraints get massive priority boost
    const wouldViolate=wouldViolateByeConstraints(t,dateStr,currentNight);
    const violationPenalty=wouldViolate?-5000:0; // Negative = higher priority
    const backToBackPenalty=(lastBye===currentNight-1)?1000:0;
    return byeCount+backToBackPenalty+violationPenalty;
  }

  // Sort candidates by bye rotation priority (teams who need games most go first)
  function sortByByePriority(candidates,currentNight,dateStr){
    return candidates.sort((a,b)=>{
      const scoreA=byePriorityScore(a,currentNight,dateStr);
      const scoreB=byePriorityScore(b,currentNight,dateStr);
      if(scoreA!==scoreB) return scoreA-scoreB;
      // Tie-breaker: random shuffle for fairness
      return Math.random()-0.5;
    });
  }

  // Find and remove the best pair from pool for a slot needing `needed` games each.
  // Falls back to an on-demand extra-round pair when pool is exhausted.
  // Respects bye rotation: prioritizes teams with fewer byes and no recent bye.
  function findPair(pool,busy,needed,currentNight,dateStr){
    // Filter valid pairs and score them by bye priority
    const validPairs=pool.map((pair,idx)=>({pair,idx})).filter(({pair:[t1,t2]})=>{
      if(busy.has(t1)||busy.has(t2)) return false;
      return gamesLeft(t1)>=needed&&gamesLeft(t2)>=needed;
    });
    
    if(validPairs.length>0){
      // Sort by combined bye priority score (lower = more urgent to play)
      validPairs.sort((a,b)=>{
        const scoreA=byePriorityScore(a.pair[0],currentNight,dateStr)+byePriorityScore(a.pair[1],currentNight,dateStr);
        const scoreB=byePriorityScore(b.pair[0],currentNight,dateStr)+byePriorityScore(b.pair[1],currentNight,dateStr);
        return scoreA-scoreB;
      });
      // Take the best pair
      const best=validPairs[0];
      return pool.splice(best.idx,1)[0];
    }

    // Pool exhausted — try extra-round pair on demand (only when GPT set)
    if(gptInput==null) return null;
    let eligible=leagueTeams.filter(t=>gamesLeft(t)>=needed&&!busy.has(t));
    // Sort by bye priority to ensure fair rotation
    eligible=sortByByePriority(eligible,currentNight,dateStr);
    for(let i=0;i<eligible.length;i++)
      for(let j=i+1;j<eligible.length;j++)
        return [eligible[i],eligible[j]];
    return null;
  }

  // Find pair respecting DH limit when targetDh is set
  // Also respects bye rotation priority
  function findPairWithDhLimit(pool,busy,needed,targetDh,teamDhCount,currentNight,dateStr){
    const validPairs=pool.map((pair,idx)=>({pair,idx})).filter(({pair:[t1,t2]})=>{
      if(busy.has(t1)||busy.has(t2)) return false;
      if(teamDhCount[t1]>=targetDh || teamDhCount[t2]>=targetDh) return false;
      return gamesLeft(t1)>=needed&&gamesLeft(t2)>=needed;
    });
    
    if(validPairs.length>0){
      // Sort by combined bye priority score
      validPairs.sort((a,b)=>{
        const scoreA=byePriorityScore(a.pair[0],currentNight,dateStr)+byePriorityScore(a.pair[1],currentNight,dateStr);
        const scoreB=byePriorityScore(b.pair[0],currentNight,dateStr)+byePriorityScore(b.pair[1],currentNight,dateStr);
        return scoreA-scoreB;
      });
      const best=validPairs[0];
      return pool.splice(best.idx,1)[0];
    }
    return null;
  }

  let pool=freshPool();
  
  console.log('Pair pool created:',{poolSize:pool.length,leagueTeamsCount:leagueTeams.length,tfaced});
  
  if(pool.length===0){
    alert('Error: No valid team pairs could be created. Need at least 2 league teams.');
    _genSchedRunning=false;
    return;
  }

  // hcMap: home-game count per team, used to balance H/A assignment
  const hcMap={};
  for(const t of G.teams) hcMap[t]=0;

  const sched=[];
  const gameSeq={};
  
  // Track DH nights per team when using target mode
  const teamDhCount={};
  for(const t of leagueTeams) teamDhCount[t]=0;

  // Track bye counts and last bye night for balanced bye rotation
  const teamByeCount={};
  const teamLastByeNight={};
  for(const t of leagueTeams){teamByeCount[t]=0;teamLastByeNight[t]=-2;}

  // STRICT BYE CONSTRAINTS: Track byes per month (YYYY-MM) and back-to-back
  const teamByesByMonth={};  // {team: {'2024-05': 1, '2024-06': 0}}
  for(const t of leagueTeams){teamByesByMonth[t]={};}
  
  console.log('Starting schedule generation:',{nights:nights.length,dhDiamonds:dhDiamonds.length,singleDiamonds:singleDiamonds.length,leagueTeams:leagueTeams.length});

  for(let ni=0;ni<nights.length;ni++){
    const date=nights[ni];
    const yr=date.slice(2,4);
    if(!gameSeq[yr]) gameSeq[yr]=0;

    const busy=new Set();

    // ── D9: CrossOver DH ─────────────────────────────────────────────────────
    // RULE: League team is HOME for game 1 (CrossOver is the VISITING/away team).
    //       CrossOver is HOME for game 2 (league team is away).
    if(d9&&!coByeSet.has(ni)){
      let opp=null;
      // Sort eligible opponents by bye priority (teams who need games most go first)
      const eligibleCO=shuffle([...leagueTeams]).filter(c=>gamesLeft(c)>=2&&!busy.has(c));
      const sortedCO=sortByByePriority(eligibleCO,ni,date);
      if(sortedCO.length>0){
        opp=sortedCO[0];
      }
      if(opp){
        busy.add(opp);
        teamGames[opp]=(teamGames[opp]||0)+2;
        gameSeq[yr]++;
        // Game 1 @ T1 — league team HOME, CrossOver AWAY (visiting)
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:9,lights:true,home:opp,away:CROSSOVER,bye:'',crossover:true});
        gameSeq[yr]++;
        // Game 2 @ T2 — CrossOver HOME, league team AWAY
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:9,lights:true,home:CROSSOVER,away:opp,bye:'',crossover:true});
      }
    }

    // ── DH league diamonds (lights=true, e.g. D12) ───────────────────────────
    // With targetDh support: limit DH nights per team when target is set
    for(const dm of dhDiamonds){

      // When targetDh is set, try to find a pair where both teams have capacity
      let dhPair=null;
      if(targetDh>0){
        dhPair=findPairWithDhLimit(pool,busy,2,targetDh,teamDhCount,ni,date);
      }
      // If no target or no pair with capacity, fall back to standard findPair
      if(!dhPair){
        dhPair=findPair(pool,busy,2,ni,date);
      }
      
      if(dhPair){
        const [t1,t2]=dhPair;
        const [h,a]=pickHA(t1,t2,hcMap);
        busy.add(h);busy.add(a);
        teamGames[h]=(teamGames[h]||0)+2;
        teamGames[a]=(teamGames[a]||0)+2;
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:true,home:h,away:a,bye:'',crossover:false});
        hcMap[h]=(hcMap[h]||0)+1;
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:dm.id,lights:true,home:a,away:h,bye:'',crossover:false});
        hcMap[a]=(hcMap[a]||0)+1;
        // Track DH nights for both teams
        if(targetDh>0){
          teamDhCount[h]++;
          teamDhCount[a]++;
        }
        continue;
      }

      // Attempt 2: single fallback — one pair needs exactly 1 game each.
      // 6:30 gets a real game; 8:15 becomes an open slot.
      const sPair=findPair(pool,busy,1,ni,date);
      if(sPair){
        const [t1,t2]=sPair;
        const [h,a]=pickHA(t1,t2,hcMap);
        busy.add(h);busy.add(a);
        teamGames[h]=(teamGames[h]||0)+1;
        teamGames[a]=(teamGames[a]||0)+1;
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:true,home:h,away:a,bye:'',crossover:false});
        hcMap[h]=(hcMap[h]||0)+1;
        // Do NOT increment hcMap[a] here — the 8:15 slot is open, not a real game for `a`
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:dm.id,lights:true,home:'',away:'',bye:'',crossover:false,open:true});
        continue;
      }

      // No valid pair — both slots open
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:true,home:'',away:'',bye:'',crossover:false,open:true});
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:dm.id,lights:true,home:'',away:'',bye:'',crossover:false,open:true});
    }

    // ── Single diamonds (no lights, e.g. D5, D13, D14) — 6:30 only ──────────
    for(const dm of singleDiamonds){
      const pair=findPair(pool,busy,1,ni,date);
      if(!pair){
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:false,home:'',away:'',bye:'',crossover:false,open:true});
        continue;
      }
      const [t1,t2]=pair;
      const [h,a]=pickHA(t1,t2,hcMap);
      busy.add(h);busy.add(a);
      teamGames[h]=(teamGames[h]||0)+1;
      teamGames[a]=(teamGames[a]||0)+1;
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:false,home:h,away:a,bye:'',crossover:false});
      hcMap[h]=(hcMap[h]||0)+1;
    }

    // ── Track byes for rotation balance ───────────────────────────────────────
    // Teams not in 'busy' set got a bye this night
    for(const t of leagueTeams){
      if(!busy.has(t)){
        teamByeCount[t]=(teamByeCount[t]||0)+1;
        teamLastByeNight[t]=ni;
        // Track monthly byes for strict constraint enforcement
        const monthKey=date.slice(0,7);
        teamByesByMonth[t][monthKey]=(teamByesByMonth[t][monthKey]||0)+1;
      }
    }
  }

  console.log('Schedule generation complete:',{totalGames:sched.length,byNight:sched.reduce((acc,g)=>{acc[g.date]=(acc[g.date]||0)+1;return acc;},{}),byeCounts:teamByeCount});
  
  // ── GPT exactness check ───────────────────────────────────────────────────
  if(gptInput!=null){
    const under=leagueTeams.filter(t=>(teamGames[t]||0)<gptInput);
    const over =leagueTeams.filter(t=>(teamGames[t]||0)>gptInput);
    if(under.length||over.length){
      const lines=[];
      if(over.length)  lines.push(`Over  ${gptInput}: ${over.map(t=>`${t}(${teamGames[t]})`).join(', ')}`);
      if(under.length) lines.push(`Under ${gptInput}: ${under.map(t=>`${t}(${teamGames[t]})`).join(', ')}`);
      if(!confirm(`⚠ GPT=${gptInput} not met for all teams:\n\n${lines.join('\n')}\n\nProceed anyway?`)){_genSchedRunning=false;return;}
    }
  }

  // ── Validation: no team > 2 games/night ──────────────────────────────────
  const nightCount={};
  for(const g of sched){
    if(g.open) continue;
    const k1=`${g.date}|${g.home}`;
    const k2=`${g.date}|${g.away}`;
    nightCount[k1]=(nightCount[k1]||0)+1;
    nightCount[k2]=(nightCount[k2]||0)+1;
  }
  const violations=Object.entries(nightCount).filter(([,c])=>c>2);
  if(violations.length){
    console.warn('⚠ Schedule warning — >2 games/night detected:',violations);
    showToast(`⚠ Warning: ${violations.length} team/night(s) exceed 2 games — please review and edit`,6000);
  }

  // ── Validation: tfaced minimum requirement ────────────────────────────────
  // Every pair must play each other at least tfaced times
  const pairCounts={};
  for(const t1 of leagueTeams){
    pairCounts[t1]={};
    for(const t2 of leagueTeams) pairCounts[t1][t2]=0;
  }
  for(const g of sched){
    if(g.crossover||g.open||!g.home||!g.away) continue;
    if(pairCounts[g.home]?.[g.away]!==undefined){
      pairCounts[g.home][g.away]++;
      pairCounts[g.away][g.home]++;
    }
  }
  const underPairs=[];
  for(let i=0;i<leagueTeams.length;i++){
    for(let j=i+1;j<leagueTeams.length;j++){
      const t1=leagueTeams[i],t2=leagueTeams[j];
      const count=pairCounts[t1][t2];
      if(count<tfaced) underPairs.push(`${t1} vs ${t2}: ${count}/${tfaced}`);
    }
  }
  if(underPairs.length>0){
    console.warn('⚠ Times Faced minimum not met:',underPairs);
    showToast(`⚠ Warning: ${underPairs.length} pair(s) below tfaced=${tfaced} — please review and edit`,6000);
  }

  // ── Validation: bye distribution check ──────────────────────────────────────
  const byeValues=Object.values(teamByeCount);
  const maxByes=Math.max(...byeValues);
  const minByes=Math.min(...byeValues);
  const byeDiff=maxByes-minByes;

  // Check for back-to-back byes (teams who had bye on consecutive nights)
  const backToBackTeams=[];
  for(const t of leagueTeams){
    if(teamLastByeNight[t]>=1){
      // Check all nights to see if team had any back-to-back byes
      for(let ni=1;ni<nights.length;ni++){
        const hadByeNight1=!sched.some(g=>!g.open&&g.date===nights[ni-1]&&(g.home===t||g.away===t));
        const hadByeNight2=!sched.some(g=>!g.open&&g.date===nights[ni]&&(g.home===t||g.away===t));
        if(hadByeNight1&&hadByeNight2){
          backToBackTeams.push(t);
          break;
        }
      }
    }
  }

  // Check for monthly bye violations (max 1 per month)
  const monthlyViolationTeams=[];
  for(const t of leagueTeams){
    for(const monthKey in teamByesByMonth[t]){
      if(teamByesByMonth[t][monthKey]>1){
        monthlyViolationTeams.push(`${t} (${monthKey}: ${teamByesByMonth[t][monthKey]} byes)`);
        break;
      }
    }
  }

  if(byeDiff>1||backToBackTeams.length>0||monthlyViolationTeams.length>0){
    let warnMsg='⚠ Bye constraint violation detected:\n';
    if(byeDiff>1) warnMsg+=`\nUneven distribution: ${minByes}-${maxByes} byes per team (diff: ${byeDiff})`;
    if(backToBackTeams.length>0) warnMsg+=`\nBack-to-back byes: ${backToBackTeams.join(', ')}`;
    if(monthlyViolationTeams.length>0) warnMsg+=`\nMultiple byes in one month: ${monthlyViolationTeams.join(', ')}`;
    console.warn('Bye constraint warning:',{byeDiff,backToBackTeams,monthlyViolationTeams,teamByeCount,teamByesByMonth});
    showToast(`⚠ Warning: Bye constraints violated — please review and edit`,6000);
  }

  const coNights=nights.length-coByeSet.size;
  
  // Debug: count games per diamond
  const gamesPerDiamond={};
  for(const g of sched){
    const did=g.diamond||'unknown';
    gamesPerDiamond[did]=(gamesPerDiamond[did]||0)+1;
  }
  console.log('Games per diamond:',gamesPerDiamond);
  console.log('D14 games count:',gamesPerDiamond[14]||0,'(should be >0 if D14 is active and used)');
  
  G.sched=sched;
  G.scores={};
  G.playoffs={
    seeded:false,podA:[],podB:[],games:{},
    semis:{podA:{},podB:{}},
    finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}
  };
  saveData();
  try{renderSched();}catch(e){console.error('renderSched error:',e);}
  try{renderScores();}catch(e){console.error('renderScores error:',e);}
  try{renderStandings();}catch(e){console.error('renderStandings error:',e);}
  try{renderStats();}catch(e){console.error('renderStats error:',e);}
  try{renderEdit();}catch(e){console.error('renderEdit error:',e);}
  const byeNote=cobyes>0?` · CrossOver plays ${coNights}/${nights.length} nights`:'';
  const gptNote=gptInput?` · League teams capped at ${gptInput} games`:'';
  showToast(`✓ Schedule generated — ${sched.length} games across ${nights.length} nights${byeNote}${gptNote}`);
  _genSchedRunning=false;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function pickHA(t1,t2,hc){
  const h1=hc[t1]||0,h2=hc[t2]||0;
  if(h1<h2) return[t1,t2];
  if(h2<h1) return[t2,t1];
  return Math.random()<0.5?[t1,t2]:[t2,t1];
}
