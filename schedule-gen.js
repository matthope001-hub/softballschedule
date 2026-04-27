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

  if(!ss||!se){_genSchedRunning=false;alert('Set season start and end dates first.');return;}
  const days=getSelectedDays();
  if(!days.length){_genSchedRunning=false;alert('Select at least one game night.');return;}

  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  if(leagueTeams.length<2){_genSchedRunning=false;alert('Need at least 2 league teams.');return;}

  const activeDiamonds=G.diamonds.filter(d=>d.active);
  const d9=activeDiamonds.find(d=>d.id===9);
  const dhDiamonds=activeDiamonds.filter(d=>d.id!==9&&d.lights);
  const singleDiamonds=activeDiamonds.filter(d=>d.id!==9&&!d.lights);

  const nights=getGameNights(ss,se,days);
  if(!nights.length){_genSchedRunning=false;alert('No game nights in selected date range.');return;}

  console.log('Schedule gen:',{nights:nights.length,leagueTeams:leagueTeams.length,d9:!!d9,dhDiamonds:dhDiamonds.length,singleDiamonds:singleDiamonds.length});

  // ── Per-team game counter ─────────────────────────────────────────────────
  const teamGames={};
  for(const t of leagueTeams) teamGames[t]=0;
  const atCap=(t)=>gptInput!=null&&(teamGames[t]||0)>=gptInput;

  // ── Pair history ──────────────────────────────────────────────────────────
  const pairHistory={};
  const pairKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
  const pairCount=(a,b)=>pairHistory[pairKey(a,b)]||0;
  const pairIncrement=(a,b)=>{const k=pairKey(a,b);pairHistory[k]=(pairHistory[k]||0)+1;};

  // ── H/A balance tracker ───────────────────────────────────────────────────
  const hcMap={};
  for(const t of G.teams) hcMap[t]=0;

  // ── CrossOver bye nights ──────────────────────────────────────────────────
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

  // ── CrossOver rotation ────────────────────────────────────────────────────
  const coOpponents=shuffle([...leagueTeams]);
  let coIdx=0;

  // ── Pair queue — cycles through all 28 pairs before repeating ────────────
  const allPairs=[];
  for(let i=0;i<leagueTeams.length;i++)
    for(let j=i+1;j<leagueTeams.length;j++)
      allPairs.push([leagueTeams[i],leagueTeams[j]]);

  let pairQueue=shuffle([...allPairs]);

  function nextPair(busySet){
    const avgGames=Object.values(teamGames).reduce((a,b)=>a+b,0)/leagueTeams.length;
    const threshold=avgGames+4;// allow max 4 games above average before deprioritizing

    // First pass — prefer balanced teams
    for(let i=0;i<pairQueue.length;i++){
      const[t1,t2]=pairQueue[i];
      if(!busySet.has(t1)&&!busySet.has(t2)&&!atCap(t1)&&!atCap(t2)
        &&(teamGames[t1]||0)<=threshold&&(teamGames[t2]||0)<=threshold){
        pairQueue.splice(i,1);
        if(pairQueue.length===0) pairQueue=shuffle([...allPairs]);
        pairIncrement(t1,t2);
        return[t1,t2];
      }
    }
    // Second pass — relax threshold, take anyone available
    for(let i=0;i<pairQueue.length;i++){
      const[t1,t2]=pairQueue[i];
      if(!busySet.has(t1)&&!busySet.has(t2)&&!atCap(t1)&&!atCap(t2)){
        pairQueue.splice(i,1);
        if(pairQueue.length===0) pairQueue=shuffle([...allPairs]);
        pairIncrement(t1,t2);
        return[t1,t2];
      }
    }
    // Refill and final try
    pairQueue=shuffle([...allPairs]);
    for(let i=0;i<pairQueue.length;i++){
      const[t1,t2]=pairQueue[i];
      if(!busySet.has(t1)&&!busySet.has(t2)&&!atCap(t1)&&!atCap(t2)){
        pairQueue.splice(i,1);
        pairIncrement(t1,t2);
        return[t1,t2];
      }
    }
    return null;
  }

  const sched=[];
  const gameSeq={};

  for(let ni=0;ni<nights.length;ni++){
    const date=nights[ni];
    const yr=date.slice(2,4);
    if(!gameSeq[yr]) gameSeq[yr]=0;

    const busy=new Set();

    // ── D9: CrossOver — 2 different opponents ─────────────────────────────
    if(d9&&!coByeSet.has(ni)){
      const n=coOpponents.length;
      let oppA=null;
      for(let attempt=0;attempt<n;attempt++){
        const c=coOpponents[(coIdx+attempt)%n];
        if(!busy.has(c)&&!atCap(c)){oppA=c;coIdx=(coIdx+attempt+1)%n;break;}
      }
      let oppB=null;
      for(let attempt=0;attempt<n;attempt++){
        const c=coOpponents[(coIdx+attempt)%n];
        if(!busy.has(c)&&!atCap(c)&&c!==oppA){oppB=c;coIdx=(coIdx+attempt+1)%n;break;}
      }
      if(oppA){
        busy.add(oppA);
        teamGames[oppA]=(teamGames[oppA]||0)+1;
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:9,lights:true,home:CROSSOVER,away:oppA,bye:'',crossover:true});
      }
      if(oppB){
        busy.add(oppB);
        teamGames[oppB]=(teamGames[oppB]||0)+1;
        hcMap[oppB]=(hcMap[oppB]||0)+1;
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:9,lights:true,home:oppB,away:CROSSOVER,bye:'',crossover:true});
      }
    }

    // ── Singles first (D13, D14), then D12 gets remainder ────────────────
    let remaining=leagueTeams.filter(t=>!busy.has(t)&&!atCap(t));

    for(const dm of singleDiamonds){
      if(remaining.length<2){
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:false,home:'',away:'',bye:'',crossover:false,open:true});
        continue;
      }
      const busySet=new Set(leagueTeams.filter(t=>!remaining.includes(t)));
      const pair=nextPair(busySet);
      if(!pair){
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:false,home:'',away:'',bye:'',crossover:false,open:true});
        continue;
      }
      const[t1,t2]=pair;
      remaining=remaining.filter(t=>t!==t1&&t!==t2);
      const[h,a]=pickHA(t1,t2,hcMap);
      busy.add(h);busy.add(a);
      teamGames[h]=(teamGames[h]||0)+1;
      teamGames[a]=(teamGames[a]||0)+1;
      hcMap[h]=(hcMap[h]||0)+1;
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:false,home:h,away:a,bye:'',crossover:false});
    }

    for(const dm of dhDiamonds){
      if(remaining.length<2){
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:true,home:'',away:'',bye:'',crossover:false,open:true});
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:dm.id,lights:true,home:'',away:'',bye:'',crossover:false,open:true});
        continue;
      }
      const busySet=new Set(leagueTeams.filter(t=>!remaining.includes(t)));
      const pair=nextPair(busySet);
      if(!pair){
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:true,home:'',away:'',bye:'',crossover:false,open:true});
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:dm.id,lights:true,home:'',away:'',bye:'',crossover:false,open:true});
        continue;
      }
      const[t1,t2]=pair;
      const[h,a]=pickHA(t1,t2,hcMap);
      busy.add(h);busy.add(a);
      teamGames[h]=(teamGames[h]||0)+2;
      teamGames[a]=(teamGames[a]||0)+2;
      hcMap[h]=(hcMap[h]||0)+1;
      hcMap[a]=(hcMap[a]||0)+1;
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:true,home:h,away:a,bye:'',crossover:false});
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:dm.id,lights:true,home:a,away:h,bye:'',crossover:false});
    }
  }

  // ── Validation: no team > 2 games/night ──────────────────────────────────
  const nightCount={};
  for(const g of sched){
    if(g.open||g.crossover) continue;
    const k1=`${g.date}|${g.home}`;
    const k2=`${g.date}|${g.away}`;
    nightCount[k1]=(nightCount[k1]||0)+1;
    nightCount[k2]=(nightCount[k2]||0)+1;
  }
  const violations=Object.entries(nightCount).filter(([,c])=>c>2);
  if(violations.length){
    console.warn('⚠ >2 games/night:',violations);
    showToast(`⚠ Warning: ${violations.length} team/night(s) exceed 2 games`,6000);
  }

  // ── Validation: tfaced distribution ──────────────────────────────────────
  const underPairs=[];
  for(let i=0;i<leagueTeams.length;i++){
    for(let j=i+1;j<leagueTeams.length;j++){
      const t1=leagueTeams[i],t2=leagueTeams[j];
      const count=pairCount(t1,t2);
      if(count<tfaced) underPairs.push(`${t1} vs ${t2}: ${count}/${tfaced}`);
    }
  }
  if(underPairs.length){
    console.warn('⚠ Times Faced not met:',underPairs);
    showToast(`⚠ Warning: ${underPairs.length} pair(s) below tfaced=${tfaced}`,6000);
  }

  // ── GPT check ─────────────────────────────────────────────────────────────
  if(gptInput!=null){
    const under=leagueTeams.filter(t=>(teamGames[t]||0)<gptInput);
    const over=leagueTeams.filter(t=>(teamGames[t]||0)>gptInput);
    if(under.length||over.length){
      const lines=[];
      if(over.length) lines.push(`Over  ${gptInput}: ${over.map(t=>`${t}(${teamGames[t]})`).join(', ')}`);
      if(under.length) lines.push(`Under ${gptInput}: ${under.map(t=>`${t}(${teamGames[t]})`).join(', ')}`);
      if(!confirm(`⚠ GPT=${gptInput} not met:\n\n${lines.join('\n')}\n\nProceed anyway?`)){_genSchedRunning=false;return;}
    }
  }

  const coNights=nights.length-coByeSet.size;
  const gamesPerDiamond={};
  for(const g of sched){const did=g.diamond||'unknown';gamesPerDiamond[did]=(gamesPerDiamond[did]||0)+1;}
  console.log('Games per diamond:',gamesPerDiamond);
  console.log('Pair history:',pairHistory);
  console.log('Team games:',teamGames);

  G.sched=sched;
  G.scores={};
  G.playoffs={
    seeded:false,format:'podrr',podA:[],podB:[],games:{},
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
  let hash=0;
  const s=t1+t2;
  for(let i=0;i<s.length;i++) hash=(Math.imul(31,hash)+s.charCodeAt(i))|0;
  return hash&1?[t1,t2]:[t2,t1];
}
