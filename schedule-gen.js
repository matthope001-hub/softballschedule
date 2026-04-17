// ── SCHEDULE GENERATOR ────────────────────────────────────────────────────────

function genSched(){
  const ss=document.getElementById('ss')?.value;
  const se=document.getElementById('se')?.value;
  const T1=document.getElementById('time1')?.value||'6:30 PM';
  const T2=document.getElementById('time2')?.value||'8:15 PM';
  const tfaced=parseInt(document.getElementById('tfaced')?.value)||2;
  const cobyes=Math.max(0,parseInt(document.getElementById('cobyes')?.value)||0);
  const gptInput=parseInt(document.getElementById('gpt')?.value)||null; // league teams cap only

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

  // Per-team game cap: applies to league teams only; CrossOver is never capped
  const teamGameCount={};
  for(const t of leagueTeams) teamGameCount[t]=0;
  const teamAtCap=(t)=>gptInput!==null&&(teamGameCount[t]||0)>=gptInput;

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

  // ── Build all required league pair slots ──────────────────────────────────
  const allPairs=[];
  for(let i=0;i<leagueTeams.length;i++)
    for(let j=i+1;j<leagueTeams.length;j++)
      for(let f=0;f<tfaced;f++)
        allPairs.push([leagueTeams[i],leagueTeams[j]]);

  shuffle(allPairs);

  const hc={};
  for(const t of G.teams) hc[t]=0;

  const sched=[];
  const gameSeq={};

  const coOpponents=shuffle([...leagueTeams]);
  let coIdx=0;

  const remainingPairs=[...allPairs];

  for(let ni=0;ni<nights.length;ni++){
    const date=nights[ni];
    const yr=date.slice(2,4);
    if(!gameSeq[yr]) gameSeq[yr]=0;

    const busyTonight=new Set();

    // ── D9 CrossOver (CrossOver itself is never capped) ──────────────────────
    const isCOBye=coByeSet.has(ni);
    if(d9&&!isCOBye){
      // Find a CrossOver opponent not at their league cap and not busy tonight
      let opp=null;
      for(let attempt=0;attempt<coOpponents.length;attempt++){
        const candidate=coOpponents[(coIdx+attempt)%coOpponents.length];
        if(!teamAtCap(candidate)&&!busyTonight.has(candidate)){
          opp=candidate;
          coIdx+=attempt+1;
          break;
        }
      }
      if(opp!==null){
        busyTonight.add(opp);
        // Both D9 games count toward the league opponent's cap
        teamGameCount[opp]=(teamGameCount[opp]||0)+2;
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:9,lights:true,home:CROSSOVER,away:opp,bye:'',crossover:true});
        gameSeq[yr]++;
        sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:9,lights:true,home:opp,away:CROSSOVER,bye:'',crossover:true});
      }
    }

    // ── DH league diamonds (e.g. D12) ───────────────────────────────────────
    for(const dm of dhDiamonds){
      const pairIdx=remainingPairs.findIndex(([t1,t2])=>
        !busyTonight.has(t1)&&!busyTonight.has(t2)&&
        !teamAtCap(t1)&&!teamAtCap(t2)
      );
      if(pairIdx===-1) continue;

      const [t1,t2]=remainingPairs.splice(pairIdx,1)[0];
      const [h1,a1]=pickHA(t1,t2,hc);

      busyTonight.add(h1);
      busyTonight.add(a1);
      // DH = 2 games each
      teamGameCount[h1]=(teamGameCount[h1]||0)+2;
      teamGameCount[a1]=(teamGameCount[a1]||0)+2;

      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:true,home:h1,away:a1,bye:'',crossover:false});
      hc[h1]=(hc[h1]||0)+1;

      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:dm.id,lights:true,home:a1,away:h1,bye:'',crossover:false});
      hc[a1]=(hc[a1]||0)+1;
    }

    // ── Single diamonds (D5, D13, D14) — 6:30 only ──────────────────────────
    for(const dm of singleDiamonds){
      const pairIdx=remainingPairs.findIndex(([t1,t2])=>
        !busyTonight.has(t1)&&!busyTonight.has(t2)&&
        !teamAtCap(t1)&&!teamAtCap(t2)
      );
      if(pairIdx===-1) continue;

      const [t1,t2]=remainingPairs.splice(pairIdx,1)[0];
      const [h,a]=pickHA(t1,t2,hc);

      busyTonight.add(h);
      busyTonight.add(a);
      // Single = 1 game each
      teamGameCount[h]=(teamGameCount[h]||0)+1;
      teamGameCount[a]=(teamGameCount[a]||0)+1;

      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:false,home:h,away:a,bye:'',crossover:false});
      hc[h]=(hc[h]||0)+1;
    }
  }

  if(remainingPairs.length>0){
    const msg=`⚠ ${remainingPairs.length} matchup(s) could not be scheduled — not enough game nights or GPT cap reached.\n\nProceed with partial schedule?`;
    if(!confirm(msg)) return;
  }

  // ── Validation: no team exceeds 2 games/night ────────────────────────────
  const nightTeamCount={};
  for(const g of sched){
    const key=`${g.date}|${g.home}`;
    const key2=`${g.date}|${g.away}`;
    nightTeamCount[key]=(nightTeamCount[key]||0)+1;
    nightTeamCount[key2]=(nightTeamCount[key2]||0)+1;
  }
  const violations=Object.entries(nightTeamCount).filter(([,c])=>c>2);
  if(violations.length){
    console.error('Schedule validation failed — teams with >2 games/night:',violations);
    alert(`⚠ Schedule error: ${violations.length} team/night combination(s) exceed 2 games. Check console. Please regenerate.`);
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
