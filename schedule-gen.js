// ── SCHEDULE GENERATOR ────────────────────────────────────────────────────────

function genSched(){
  const ss=document.getElementById('ss')?.value;
  const se=document.getElementById('se')?.value;
  const T1=document.getElementById('time1')?.value||'6:30 PM';
  const T2=document.getElementById('time2')?.value||'8:15 PM';
  const tfaced=parseInt(document.getElementById('tfaced')?.value)||2;
  const cobyes=Math.max(0,parseInt(document.getElementById('cobyes')?.value)||0);

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

  // ── FIX: build set of bye-night indices for CrossOver (D9)
  // Evenly distribute cobyes across the season nights
  const coByeSet=new Set();
  if(d9&&cobyes>0){
    const clampedByes=Math.min(cobyes,nights.length);
    // Space byes evenly: pick indices at intervals across the season
    for(let b=0;b<clampedByes;b++){
      const idx=Math.round((b/(clampedByes))*nights.length);
      // Avoid duplicate indices by searching nearby
      let placed=false;
      for(let offset=0;offset<nights.length;offset++){
        const candidate=(idx+offset)%nights.length;
        if(!coByeSet.has(candidate)){coByeSet.add(candidate);placed=true;break;}
      }
      if(!placed) break;
    }
  }

  // Build all required league pairs (tfaced times each)
  const allPairs=[];
  for(let i=0;i<leagueTeams.length;i++)
    for(let j=i+1;j<leagueTeams.length;j++)
      for(let f=0;f<tfaced;f++)
        allPairs.push([leagueTeams[i],leagueTeams[j]]);

  shuffle(allPairs);

  // Home count tracker for H/A balance
  hc={};
  for(const t of G.teams) hc[t]=0;

  const sched=[];
  let pairIdx=0;
  const gameSeq={};

  // CrossOver rotation — only schedule on non-bye nights
  const coOpponents=shuffle([...leagueTeams]);
  let coIdx=0;

  for(let ni=0;ni<nights.length;ni++){
    const date=nights[ni];
    const yr=date.slice(2,4);
    if(!gameSeq[yr]) gameSeq[yr]=0;

    // CrossOver games on D9 — skip if this night is a CO bye
    const isCOBye=coByeSet.has(ni);
    if(d9&&!isCOBye){
      const opp=coOpponents[coIdx%coOpponents.length];
      coIdx++;
      // 6:30 — CrossOver home
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:9,lights:true,home:CROSSOVER,away:opp,bye:'',crossover:true});
      // 8:15 — CrossOver away (H/A swap)
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:9,lights:true,home:opp,away:CROSSOVER,bye:'',crossover:true});
    }

    // DH league diamonds — 2 games each (6:30 + 8:15 H/A swap)
    for(const dm of dhDiamonds){
      if(pairIdx>=allPairs.length) break;
      const pair=allPairs[pairIdx++];
      const [h1,a1]=pickHA(pair[0],pair[1]);
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:true,home:h1,away:a1,bye:'',crossover:false});
      hc[h1]=(hc[h1]||0)+1;
      // 8:15 swap
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:dm.id,lights:true,home:a1,away:h1,bye:'',crossover:false});
      hc[a1]=(hc[a1]||0)+1;
    }

    // Single diamonds — 1 game each (6:30 only)
    for(const dm of singleDiamonds){
      if(pairIdx>=allPairs.length) break;
      const pair=allPairs[pairIdx++];
      const [h,a]=pickHA(pair[0],pair[1]);
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:false,home:h,away:a,bye:'',crossover:false});
      hc[h]=(hc[h]||0)+1;
    }
  }

  if(pairIdx<allPairs.length){
    const remaining=allPairs.length-pairIdx;
    if(!confirm(`Warning: ${remaining} league matchup(s) could not be scheduled — not enough game nights.\n\nProceed with partial schedule?`)) return;
  }

  const coNights=nights.length-coByeSet.size;
  G.sched=sched;
  G.scores={};
  G.playoffs={seeded:false,podA:[],podB:[],games:{},semis:{podA:{},podB:{}},finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}};
  saveData();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();
  renderEdit();
  const byeNote=cobyes>0?` · CrossOver plays ${coNights}/${nights.length} nights`:'';
  showToast(`✓ Schedule generated — ${sched.length} games across ${nights.length} nights${byeNote}`);
}
