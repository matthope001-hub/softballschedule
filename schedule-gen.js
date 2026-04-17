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
  const dhDiamonds=activeDiamonds.filter(d=>d.id!==9&&d.lights);   // e.g. D12
  const singleDiamonds=activeDiamonds.filter(d=>d.id!==9&&!d.lights); // e.g. D5, D13, D14

  const nights=getGameNights(ss,se,days);
  if(!nights.length){alert('No game nights in selected date range.');return;}

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

  // ── Build all required league pair slots (tfaced × each unique pair) ──────
  // Each DH diamond consumes ONE pair (2 games: 6:30 + 8:15 H/A swap)
  // Each single diamond consumes ONE pair (1 game: 6:30 only)
  // So tfaced=2 with 9 league teams = 36 unique pairs × 2 = 72 pair-slots needed
  const allPairs=[];
  for(let i=0;i<leagueTeams.length;i++)
    for(let j=i+1;j<leagueTeams.length;j++)
      for(let f=0;f<tfaced;f++)
        allPairs.push([leagueTeams[i],leagueTeams[j]]);

  // Shuffle for randomness, then we'll pick optimally per night
  shuffle(allPairs);

  // ── Home count tracker for H/A balance ───────────────────────────────────
  const hc={};
  for(const t of G.teams) hc[t]=0;

  const sched=[];
  const gameSeq={};

  // CrossOver rotation
  const coOpponents=shuffle([...leagueTeams]);
  let coIdx=0;

  // Track which pairs have been used (for pair-slot consumption)
  // We'll use a queue approach: remaining pairs in order
  const remainingPairs=[...allPairs];

  // ── Per-night slot capacities ─────────────────────────────────────────────
  // Each night: dhDiamonds.length DH slots + singleDiamonds.length single slots
  // Each DH slot = 1 pair used, 2 games produced
  // Each single slot = 1 pair used, 1 game produced
  // CONSTRAINT: each league team plays AT MOST 2 games per night (i.e. 1 DH)
  // CONSTRAINT: a team on a DH diamond cannot appear on any other diamond that night

  for(let ni=0;ni<nights.length;ni++){
    const date=nights[ni];
    const yr=date.slice(2,4);
    if(!gameSeq[yr]) gameSeq[yr]=0;

    // Teams busy tonight (already slotted into a game this night)
    const busyTonight=new Set();

    // ── D9 CrossOver ────────────────────────────────────────────────────────
    const isCOBye=coByeSet.has(ni);
    if(d9&&!isCOBye){
      const opp=coOpponents[coIdx%coOpponents.length];
      coIdx++;
      busyTonight.add(opp); // CO opponent is busy for both slots on D9
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:9,lights:true,home:CROSSOVER,away:opp,bye:'',crossover:true});
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:9,lights:true,home:opp,away:CROSSOVER,bye:'',crossover:true});
    }

    // ── DH league diamonds (e.g. D12) ───────────────────────────────────────
    // Rule: one pair per DH diamond, plays 6:30 AND 8:15 (H/A swapped)
    // Both teams are locked to that diamond for the full night — no other games
    for(const dm of dhDiamonds){
      // Find the first available pair where neither team is busy tonight
      const pairIdx=remainingPairs.findIndex(([t1,t2])=>
        !busyTonight.has(t1)&&!busyTonight.has(t2)
      );
      if(pairIdx===-1) continue; // no valid pair available tonight for this diamond

      const [t1,t2]=remainingPairs.splice(pairIdx,1)[0];
      const [h1,a1]=pickHA(t1,t2,hc);

      // Mark BOTH teams busy for the entire night (they play 2 games on this diamond)
      busyTonight.add(h1);
      busyTonight.add(a1);

      // Game 1 — 6:30 PM
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:true,home:h1,away:a1,bye:'',crossover:false});
      hc[h1]=(hc[h1]||0)+1;

      // Game 2 — 8:15 PM H/A swapped
      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T2,diamond:dm.id,lights:true,home:a1,away:h1,bye:'',crossover:false});
      hc[a1]=(hc[a1]||0)+1;
    }

    // ── Single diamonds (D5, D13, D14) — 6:30 only ──────────────────────────
    // Each gets a unique pair; teams on single diamonds play ONCE tonight
    for(const dm of singleDiamonds){
      const pairIdx=remainingPairs.findIndex(([t1,t2])=>
        !busyTonight.has(t1)&&!busyTonight.has(t2)
      );
      if(pairIdx===-1) continue;

      const [t1,t2]=remainingPairs.splice(pairIdx,1)[0];
      const [h,a]=pickHA(t1,t2,hc);

      busyTonight.add(h);
      busyTonight.add(a);

      gameSeq[yr]++;
      sched.push({id:`${yr}${String(gameSeq[yr]).padStart(3,'0')}`,date,time:T1,diamond:dm.id,lights:false,home:h,away:a,bye:'',crossover:false});
      hc[h]=(hc[h]||0)+1;
    }
  }

  if(remainingPairs.length>0){
    const msg=`⚠ ${remainingPairs.length} matchup(s) could not be scheduled — not enough game nights or too many conflicts.\n\nProceed with partial schedule?`;
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
  showToast(`✓ Schedule generated — ${sched.length} games across ${nights.length} nights${byeNote}`);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function pickHA(t1,t2,hc){
  const h1=hc[t1]||0,h2=hc[t2]||0;
  if(h1<h2) return[t1,t2];
  if(h2<h1) return[t2,t1];
  return Math.random()<0.5?[t1,t2]:[t2,t1];
}
