// ── EDIT GAMES ────────────────────────────────────────────────────────────────
function byeTeamsEdit(dateStr){
  const playing=new Set();
  for(const g of G.sched){
    if(g.date===dateStr&&!g.open){
      if(g.home) playing.add(g.home);
      if(g.away) playing.add(g.away);
    }
  }
  const byeList=G.teams.filter(t=>!playing.has(t));
  return byeList.length?`<span style="font-size:10px;background:var(--surface2);color:var(--muted);padding:1px 6px;border-radius:3px;margin-left:6px">Bye: ${byeList.join(', ')}</span>`:'';
}

function renderEdit(){
  const el=document.getElementById('edi');
  if(!G.sched.length){el.innerHTML='<div class="empty">Generate a schedule to edit games</div>';return;}

  const ssEl=document.getElementById('ss');
  const seEl=document.getElementById('se');
  let days=getSelectedDays();
  if(!days.length) days=[2];

  const ssVal=ssEl?.value||'2026-05-19';
  const seVal=seEl?.value||'2026-09-29';

  const windowNights=getGameNights(ssVal, seVal, days);
  const schedDates=new Set(G.sched.map(g=>g.date));
  const extraDates=[...schedDates].filter(d=>!windowNights.includes(d)).sort();
  const allNights=[...new Set([...windowNights,...extraDates])].sort();

  const T1=document.getElementById('time1')?.value||'6:30 PM';
  const T2=document.getElementById('time2')?.value||'8:15 PM';

  const allDiamondIds=[...new Set([
    ...getDiamondIds(),
    ...G.sched.map(g=>g.diamond)
  ])].sort((a,b)=>a-b);

  const monthMap={};const monthOrder=[];
  for(const dateStr of allNights){
    const ml=monthLabel(dateStr);
    if(!monthMap[ml]){monthMap[ml]=[];monthOrder.push(ml);}
    monthMap[ml].push(dateStr);
  }

  let html=`<div class="notice" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <span>Edit or remove scheduled games · Add teams to open slots · Changes require admin PIN</span>
    <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
      <button onclick="clearScheduleOnly()" style="padding:6px 14px;background:none;color:var(--red);border:1.5px solid var(--red);border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;font-family:var(--font)">🗑 Clear Schedule</button>
      <button onclick="showAddGameForm()" style="padding:6px 14px;background:var(--navy);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;font-family:var(--font)">+ Add Game</button>
    </div>
  </div>
  <div id="add-game-form" style="display:none"></div>`;

  monthOrder.forEach((month,mi)=>{
    let inner='';
    let monthOpenSlots=0;
    for(const dateStr of monthMap[month]){
      inner+=`<div class="day-head">${fmtDate(dateStr)}${sunsetBadge(dateStr)}${byeTeamsEdit(dateStr)}</div>`;
      const nightGames=G.sched.filter(g=>g.date===dateStr).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
      const usedAt1=new Set(nightGames.filter(g=>g.time!==T2).map(g=>g.diamond));
      const usedAt2=new Set(nightGames.filter(g=>g.time===T2).map(g=>g.diamond));
      const openAt1=getDiamondIds().filter(d=>!usedAt1.has(d));
      const openAt2=G.diamonds.filter(d=>d.lights).map(d=>d.id).filter(d=>!usedAt2.has(d));
      monthOpenSlots+=openAt1.length+openAt2.length;

      for(const g of nightGames){
        const isCO=g.home===CROSSOVER||g.away===CROSSOVER;
        const isLate=g.time===T2;
        inner+=`<div class="edit-row${isLate?' late':''}" style="border-left:3px solid ${isCO?'#27ae60':'var(--navy2)'}">
  <div class="edit-row-meta">
    <span class="time-lbl${isLate?' late':''}">${g.time}</span>
    <span class="gnum">#${g.id}</span>
    <span style="font-size:11px;color:var(--muted)">${getDiamondName(g.diamond)}${isDiamondLit(g.diamond)?' 💡':' 🌙'}</span>
    <button onclick="removeGame('${g.id}')" title="Remove game #${g.id}" style="margin-left:auto;padding:2px 7px;background:none;border:1.5px solid var(--border);border-radius:5px;cursor:pointer;color:var(--red);font-size:13px;line-height:1">🗑</button>
  </div>
  <div class="edit-row-controls">
    <select onchange="editGame('${g.id}','home',this.value)" class="sel">
      ${G.teams.map(t=>`<option value="${esc(t)}"${t===g.home?' selected':''}>${esc(t)}</option>`).join('')}
    </select>
    <span style="font-size:11px;color:var(--muted);flex-shrink:0">vs</span>
    <select onchange="editGame('${g.id}','away',this.value)" class="sel">
      ${G.teams.map(t=>`<option value="${esc(t)}"${t===g.away?' selected':''}>${esc(t)}</option>`).join('')}
    </select>
    <select onchange="editGame('${g.id}','diamond',this.value)" class="sel" style="min-width:110px">
      ${allDiamondIds.map(d=>`<option value="${d}"${d===g.diamond?' selected':''}>${getDiamondName(d)}${isDiamondLit(d)?' 💡':' 🌙'}</option>`).join('')}
    </select>
    <select onchange="editGame('${g.id}','time',this.value)" class="sel" style="min-width:80px">
      <option value="${T1}"${g.time===T1?' selected':''}>${T1}</option>
      <option value="${T2}"${g.time===T2?' selected':''}>${T2}</option>
    </select>
  </div>
</div>`;
      }

      for(const dmId of openAt1){
        const dm=G.diamonds.find(d=>d.id===dmId);
        const badge=dm?.lights?`💡 ${getDiamondName(dmId)}`:`🌙 ${getDiamondName(dmId)}`;
        const slotId=`slot_${dateStr}_${dmId}_1`;
        const teamOpts=G.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
        inner+=`<div class="edit-row open-slot">
          <span class="time-lbl" style="width:54px;flex-shrink:0">${T1}</span>
          <span style="font-size:11px;color:var(--gray3);flex-shrink:0;min-width:50px">${badge}</span>
          <select class="sel" id="${slotId}_h" style="font-size:12px"><option value="">— Home —</option>${teamOpts}</select>
          <span style="font-size:11px;color:var(--muted);flex-shrink:0">vs</span>
          <select class="sel" id="${slotId}_a" style="font-size:12px"><option value="">— Away —</option>${teamOpts}</select>
          <button onclick="addSlotGame('${slotId}','${dateStr}','${T1}',${dmId},${dm?.lights?'true':'false'})" style="flex-shrink:0;padding:4px 10px;background:var(--navy);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">+ Add</button>
        </div>`;
      }

      for(const dmId of openAt2){
        const dm=G.diamonds.find(d=>d.id===dmId);
        const badge=`💡 ${getDiamondName(dmId)}`;
        const slotId=`slot_${dateStr}_${dmId}_2`;
        const teamOpts=G.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
        inner+=`<div class="edit-row open-slot late">
          <span class="time-lbl late" style="width:54px;flex-shrink:0">${T2}</span>
          <span style="font-size:11px;color:var(--gray3);flex-shrink:0;min-width:50px">${badge}</span>
          <select class="sel" id="${slotId}_h" style="font-size:12px"><option value="">— Home —</option>${teamOpts}</select>
          <span style="font-size:11px;color:var(--muted);flex-shrink:0">vs</span>
          <select class="sel" id="${slotId}_a" style="font-size:12px"><option value="">— Away —</option>${teamOpts}</select>
          <button onclick="addSlotGame('${slotId}','${dateStr}','${T2}',${dmId},${dm?.lights?'true':'false'})" style="flex-shrink:0;padding:4px 10px;background:var(--navy);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">+ Add</button>
        </div>`;
      }
    }
    html+=monthAccordion(month,inner,mi,'em',monthOpenSlots);
  });

  el.innerHTML=html;
  const now=new Date();
  const currentMonth=MONTH_NAMES[now.getMonth()]+' '+now.getFullYear();
  const lastOpenMonth=el.dataset.openMonth||currentMonth;
  let opened=false;
  monthOrder.forEach((month,i)=>{
    if(month===lastOpenMonth||(!opened&&i===0)){
      const body=document.getElementById('em_m'+i);
      const arr=document.getElementById('arr_em_m'+i);
      if(body&&!body.classList.contains('open')){body.classList.add('open');if(arr)arr.textContent='▲';opened=true;}
    }
  });
  el.dataset.openMonth=lastOpenMonth;
}

// FIX #5: gate on isAdmin, FIX #11: validate home !== away
function editGame(id,field,value){
  if(!isAdmin){showToast('🔒 Admin PIN required to edit games');return;}
  const g=G.sched.find(x=>x.id===id);
  if(!g)return;
  const newHome=field==='home'?value:g.home;
  const newAway=field==='away'?value:g.away;
  if(newHome===newAway){showToast('⚠ Home and Away teams must be different');return;}
  if(field==='diamond'){g.diamond=parseInt(value);g.lights=isDiamondLit(g.diamond);}
  else if(field==='home') g.home=value;
  else if(field==='away') g.away=value;
  else if(field==='time') g.time=value;
  g.crossover=g.home===CROSSOVER||g.away===CROSSOVER;
  saveData();
  renderSched();
  renderScores();
  renderStandings();
}

function removeGame(id){
  if(!checkAdmin()) return;
  const g=G.sched.find(x=>x.id===id);
  if(!g) return;
  if(!confirm(`Remove game #${id}?\n${g.home} vs ${g.away}\n${fmtDate(g.date)} at ${g.time}\n\nThe slot will remain available to fill.\nThis cannot be undone.`)) return;
  const d=new Date(g.date+'T12:00:00');
  const openMonth=MONTH_NAMES[d.getMonth()]+' '+d.getFullYear();
  G.sched=G.sched.filter(x=>x.id!==id);
  delete G.scores[id];
  saveData();
  const edi=document.getElementById('edi');
  if(edi) edi.dataset.openMonth=openMonth;
  renderEdit();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();
  showToast(`🗑 Game #${id} removed — slot is open`);
}

// FIX #3: safe ID generation — no collision after deletions
function nextGameId(dateStr){
  const YEAR=new Date(dateStr+'T12:00:00').getFullYear().toString().slice(-2);
  const maxSeq=G.sched.reduce((max,g)=>{
    if(!g.id.startsWith(YEAR)) return max;
    return Math.max(max, parseInt(g.id.slice(2))||0);
  },0);
  return `${YEAR}${String(maxSeq+1).padStart(3,'0')}`;
}

function addSlotGame(slotId, dateStr, time, dmId, lights){
  if(!checkAdmin()) return;
  const home=document.getElementById(slotId+'_h')?.value;
  const away=document.getElementById(slotId+'_a')?.value;
  if(!home){alert('Please select a Home team.');return;}
  if(!away){alert('Please select an Away team.');return;}
  if(home===away){alert('Home and Away teams must be different.');return;}
  const newId=nextGameId(dateStr);
  const newGame={
    id:newId, date:dateStr, time:time, diamond:dmId, lights:lights,
    home:home, away:away, bye:'', crossover:home===CROSSOVER||away===CROSSOVER
  };
  G.sched.push(newGame);
  G.sched.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  const d=new Date(dateStr+'T12:00:00');
  const openMonth=MONTH_NAMES[d.getMonth()]+' '+d.getFullYear();
  const edi=document.getElementById('edi');
  if(edi) edi.dataset.openMonth=openMonth;
  saveData();
  renderEdit();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();
  showToast(`✓ Game #${newId} added — ${home} vs ${away}`);
}

// ── CLEAR SCHEDULE ONLY ───────────────────────────────────────────────────────
function clearScheduleOnly(){
  if(!checkAdmin()) return;
  const gameCount=G.sched.length;
  const scoreCount=Object.keys(G.scores).length;
  if(!confirm(`Clear the entire schedule?\n\nThis will remove:\n  • ${gameCount} scheduled games\n  • ${scoreCount} entered scores\n  • All playoff brackets\n\nThis will KEEP:\n  ✓ Your ${G.teams.length} teams\n  ✓ Your diamond configuration\n  ✓ Season dates and settings\n\nThis cannot be undone.`)) return;
  if(!confirm(`Final confirmation — delete all ${gameCount} games?`)) return;
  G.sched=[];
  G.scores={};
  G.playoffs={
    seeded:false,podA:[],podB:[],games:{},
    semis:{podA:{},podB:{}},
    finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}
  };
  saveData();
  renderEdit();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();
  showToast('🗑 Schedule cleared — teams and diamonds preserved');
}

// ── ADD GAME FORM (any date, any diamond) ─────────────────────────────────────
function showAddGameForm(){
  if(!checkAdmin()) return;
  const form=document.getElementById('add-game-form');
  if(!form) return;
  if(form.style.display!=='none'){ form.style.display='none'; return; }

  const teamOpts=G.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  const dmOpts=G.diamonds.map(d=>`<option value="${d.id}">${esc(d.name)}${d.lights?' 💡':' 🌙'}</option>`).join('');
  const gameTypes=[
    {value:'regular',label:'Regular Season'},
    {value:'playoff',label:'🏆 Playoff'},
    {value:'exhibition',label:'Exhibition / Makeup'},
  ];
  const typeOpts=gameTypes.map(t=>`<option value="${t.value}">${t.label}</option>`).join('');

  form.innerHTML=`
    <div style="background:var(--white);border:1.5px solid var(--navy);border-radius:var(--r);padding:16px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:12px">Add a Game</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">DATE</label>
          <input type="date" id="agDate" style="width:100%;font-size:13px;padding:7px 10px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font);box-sizing:border-box" value="2026-10-06"/>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">TIME</label>
          <input type="text" id="agTime" placeholder="6:30 PM" style="width:100%;font-size:13px;padding:7px 10px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font);box-sizing:border-box" value="6:30 PM"/>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">HOME TEAM</label>
          <select id="agHome" style="width:100%;font-size:13px;padding:7px 10px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font);box-sizing:border-box">
            <option value="">— Select —</option>${teamOpts}
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">AWAY TEAM</label>
          <select id="agAway" style="width:100%;font-size:13px;padding:7px 10px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font);box-sizing:border-box">
            <option value="">— Select —</option>${teamOpts}
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">DIAMOND</label>
          <select id="agDiamond" style="width:100%;font-size:13px;padding:7px 10px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font);box-sizing:border-box">
            ${dmOpts}
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px">GAME TYPE</label>
          <select id="agType" style="width:100%;font-size:13px;padding:7px 10px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font);box-sizing:border-box">
            ${typeOpts}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="submitAddGame()" style="padding:8px 20px;background:var(--navy);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700;font-family:var(--font)">✓ Add Game</button>
        <button onclick="document.getElementById('add-game-form').style.display='none'" style="padding:8px 14px;background:none;border:1.5px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;color:var(--muted);font-family:var(--font)">Cancel</button>
      </div>
    </div>`;
  form.style.display='block';
  document.getElementById('agDate').focus();
}

function submitAddGame(){
  const date=document.getElementById('agDate')?.value;
  const time=document.getElementById('agTime')?.value?.trim();
  const home=document.getElementById('agHome')?.value;
  const away=document.getElementById('agAway')?.value;
  const dmId=parseInt(document.getElementById('agDiamond')?.value);
  const type=document.getElementById('agType')?.value;

  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('Please enter a valid date.');return;}
  if(!time){alert('Please enter a time.');return;}
  if(!home){alert('Please select a home team.');return;}
  if(!away){alert('Please select an away team.');return;}
  if(home===away){alert('Home and away teams must be different.');return;}
  if(isNaN(dmId)){alert('Please select a diamond.');return;}

  const dm=G.diamonds.find(d=>d.id===dmId);
  const newId=nextGameId(date);

  const newGame={
    id:newId, date, time,
    diamond:dmId, lights:dm?.lights||false,
    home, away, bye:'',
    crossover:home===CROSSOVER||away===CROSSOVER,
    playoff:type==='playoff',
    exhibition:type==='exhibition',
  };

  G.sched.push(newGame);
  G.sched.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));

  const d=new Date(date+'T12:00:00');
  const openMonth=MONTH_NAMES[d.getMonth()]+' '+d.getFullYear();
  const edi=document.getElementById('edi');
  if(edi) edi.dataset.openMonth=openMonth;

  saveData();
  renderEdit();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();

  const typeLabel=type==='playoff'?'🏆 Playoff game':type==='exhibition'?'Exhibition game':'Game';
  showToast(`✓ ${typeLabel} #${newId} added — ${home} vs ${away} · ${date}`);
}
