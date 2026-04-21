// ── SCHEDULE GENERATOR ────────────────────────────────────────────────────────

function genSched(){
  const ss=document.getElementById('ss')?.value;
  const se=document.getElementById('se')?.value;
  const T1=document.getElementById('time1')?.value||'6:30 PM';
  const T2=document.getElementById('time2')?.value||'8:15 PM';
  const tfaced=parseInt(document.getElementById('tfaced')?.value)||2;
  const cobyes=Math.max(0,parseInt(document.getElementById('cobyes')?.value)||0);
  const gptInput=parseInt(document.getElementById('gpt')?.value)||null;

  if(!ss||!se){alert('Set season start and end dates first.');return;}
  const days=getSelectedDays();
  if(!days.length){alert('Select at least one game night.');return;}

  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  if(leagueTeams.length<2){alert('Need at least 2 league teams.');return;}

  const activeDiamonds=G.diamonds.filter(d=>d.active);
  const d9=activeDiamonds.find(d=>d.id===9);
  const dhDiamonds=activeDiamonds.filter(d=>d.id!==9&&d.lights);
  const singleDiamonds=activeDiamonds.filter(d=>d.id!==9&&!d.lights);

  const nights=getGameNights(ss,se,days);
  if(!nights.length){alert('No game nights in selected date range.');return;}

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
  function freshPool(){
    const pool=[];
    for(let i=0;i<leagueTeams.length;i++)
      for(let j=i+1;j<leagueTeams.length;j++)
        for(let r=0;r<tfaced;r++)
          pool.push([leagueTeams[i],leagueTeams[j]]);
    return shuffle(pool);
  }

  function findPair(pool,busy,needed){
    const idx=pool.findIndex(([t1,t2])=>{
      if(busy.has(t1)||busy.has(t2)) return false;
      return gamesLeft(t1)>=needed&&gamesLeft(t2)>=needed;
    });
    if(idx!==-1) return pool.splice(idx,1)[0];
    if(gptInput==null) return null;
    const eligible=shuffle(leagueTeams.filter(t=>gamesLeft(t)>=needed&&!busy.has(t)));
    for(let i=0;i<eligible.length;i++)
      for(let j=i+1;j<eligible.length;j++)
        return [eligible[i],eligible[j]];
    return null;
  }

  let pool=freshPool();

  const hcMap={};
  for(const t of G.teams) hcMap[t]=0;

  const sched=[];
  const gameSeq={};

  const coOpponents=shuffle([...leagueTeams]);
  let coIdx=0;

  for(let ni=0;ni<nights.length;ni++){
    const date=nights[ni];
    const yr=date.slice(2,4);
    if(!gameSeq[yr]) gameSeq[yr]=0;

    const busy=new Set();

    // ── D9: CrossOver DH ─────────────────────────────────────────────────────
    // RULE: League team is HOME for game 1; CrossOver is VISITING (away).
    //       CrossOver is HOME for game 2 (the return match).
    if(d9&&!coByeSet.has(ni)){
      let opp=null;
      for(let attempt=0;attempt<coOpponents.length;attempt++){
        const c=coOpponents[(coIdx+attempt)%coOpponents.length];
        if(gamesLeft(c)>=2&&!busy.has(c)){
          opp=c;
          coIdx=(coIdx+attempt+1)%coOpponents.length;
          break;
        }
      }
      if(opp){
        busy.add(opp);
        teamGames[opp]=(teamGames[opp]||0)+2;
        gameSeq[yr]++;
        // Game 1 — league team HOME, CrossOver AWAY (visiting)
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:9,lights:true,home:opp,away:CROSSOVER,bye:'',crossover:true});
        gameSeq[yr]++;
        // Game 2 — CrossOver HOME, league team AWAY
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:9,lights:true,home:CROSSOVER,away:opp,bye:'',crossover:true});
      }
    }

    // ── DH league diamonds (lights=true, e.g. D12) ───────────────────────────
    for(const dm of dhDiamonds){

      // Attempt 1: full DH — both teams need ≥2 games
      const dhPair=findPair(pool,busy,2);
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
        continue;
      }

      // Attempt 2: single fallback — 6:30 gets a real game; 8:15 becomes open slot
      const sPair=findPair(pool,busy,1);
      if(sPair){
        const [t1,t2]=sPair;
        const [h,a]=pickHA(t1,t2,hcMap);
        busy.add(h);busy.add(a);
        teamGames[h]=(teamGames[h]||0)+1;
        teamGames[a]=(teamGames[a]||0)+1;
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:true,home:h,away:a,bye:'',crossover:false});
        hcMap[h]=(hcMap[h]||0)+1;
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
      const pair=findPair(pool,busy,1);
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
  }

  // ── GPT exactness check ───────────────────────────────────────────────────
  if(gptInput!=null){
    const under=leagueTeams.filter(t=>(teamGames[t]||0)<gptInput);
    const over =leagueTeams.filter(t=>(teamGames[t]||0)>gptInput);
    if(under.length||over.length){
      const lines=[];
      if(over.length)  lines.push(`Over  ${gptInput}: ${over.map(t=>`${t}(${teamGames[t]})`).join(', ')}`);
      if(under.length) lines.push(`Under ${gptInput}: ${under.map(t=>`${t}(${teamGames[t]})`).join(', ')}`);
      if(!confirm(`⚠ GPT=${gptInput} not met for all teams:\n\n${lines.join('\n')}\n\nProceed anyway?`)) return;
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
    console.error('Validation failed — >2 games/night:',violations);
    alert(`⚠ Schedule error: ${violations.length} team/night(s) exceed 2 games. Check console. Please regenerate.`);
    return;
  }

  const coNights=nights.length-coByeSet.size;
  G.sched=sched;
  G.scores={};
  G.playoffs={
    seeded:false,podA:[],podB:[],games:{},
    semis:{podA:{},podB:{}},
    finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}
  };
  saveData();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();
  renderEdit();
  const byeNote=cobyes>0?` · CrossOver plays ${coNights}/${nights.length} nights`:'';
  const gptNote=gptInput?` · League teams capped at ${gptInput} games`:'';
  showToast(`✓ Schedule generated — ${sched.length} games across ${nights.length} nights${byeNote}${gptNote}`);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function pickHA(t1,t2,hc){
  const h1=hc[t1]||0,h2=hc[t2]||0;
  if(h1<h2) return[t1,t2];
  if(h2<h1) return[t2,t1];
  return Math.random()<0.5?[t1,t2]:[t2,t1];
}
