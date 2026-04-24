// ── EDIT GAMES ────────────────────────────────────────────────────────────────

// OPT 7: Single render dispatcher for all edit actions.
function _markStaleAndRenderActive(skipEdit){
  const sto=document.getElementById('sto'); if(sto) sto.dataset.stale='1';
  const sta=document.getElementById('sta'); if(sta) sta.dataset.stale='1';
  const champ=document.getElementById('champ-content'); if(champ) champ.dataset.stale='1';

  const active=window._activeTab||'schedule';
  if     (active==='schedule')  { try{renderSched();}catch(e){} }
  else if(active==='standings') { try{renderStandings();}catch(e){} }
  else if(active==='stats')     { try{renderStats();}catch(e){} }
  else if(active==='playoffs')  { try{renderPlayoffs();}catch(e){} }

  if(!skipEdit){ try{renderEdit();}catch(e){} }

  if(active==='admin'&&typeof activeAdminTab!=='undefined'&&activeAdminTab==='scores'){
    try{renderScores();}catch(e){}
  }

  try{renderLastResults();}catch(e){}
  try{renderSeasonBanner();}catch(e){}
}

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
  if(!el)return;
  if(!G.sched.length){el.innerHTML='<div class="empty">Generate a schedule to edit games</div>';return;}

  // PATCH: read from G.settings — never from DOM — safe regardless of active tab
  const ssVal=G.settings?.ss||'';
  const seVal=G.settings?.se||'';
  let days=G.settings?.days||[];
  if(!days.length) days=[2];

  const windowNights=(ssVal&&seVal)?getGameNights(ssVal,seVal,days):[];
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

      // Open slots at T1
      for(const dmId of openAt1){
        const slotId=`slot_${dateStr}_${dmId}_1`;
        inner+=`<div class="edit-row open-slot">
  <span class="time-lbl">${T1}</span>
  <span style="font-size:11px;color:var(--muted)">${getDiamondName(dmId)}${isDiamondLit(dmId)?' 💡':' 🌙'} — Open</span>
  <div style="display:flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap">
    <select id="${slotId}_h" class="sel" style="min-width:130px"><option value="">Home…</option>${G.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
    <select id="${slotId}_a" class="sel" style="min-width:130px"><option value="">Away…</option>${G.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
    <button onclick="addSlotGame('${slotId}','${dateStr}','${T1}',${dmId},${isDiamondLit(dmId)})" style="flex-shrink:0;padding:4px 10px;background:var(--navy);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">+ Add</button>
  </div>
</div>`;
      }

      // Open slots at T2 (lit diamonds only)
      for(const dmId of openAt2){
        const slotId=`slot_${dateStr}_${dmId}_2`;
        inner+=`<div class="edit-row open-slot late">
  <span class="time-lbl late">${T2}</span>
  <span style="font-size:11px;color:var(--muted)">${getDiamondName(dmId)} 💡 — Open</span>
  <div style="display:flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap">
    <select id="${slotId}_h" class="sel" style="min-width:130px"><option value="">Home…</option>${G.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
    <select id="${slotId}_a" class="sel" style="min-width:130px"><option value="">Away…</option>${G.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
    <button onclick="addSlotGame('${slotId}','${dateStr}','${T2}',${dmId},true)" style="flex-shrink:0;padding:4px 10px;background:var(--navy);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">+ Add</button>
  </div>
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
  _markStaleAndRenderActive(true);
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
  const edi=document.getElementById('edi');
  if(edi) edi.dataset.openMonth=openMonth;
  saveData();
  _markStaleAndRenderActive();
  showToast(`🗑 Game #${id} removed — slot is open`);
}

function addSlotGame(slotId,dateStr,time,dmId,lights){
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
  _markStaleAndRenderActive();
  showToast(`✓ Game #${newId} added — ${home} vs ${away}`);
}

function clearScheduleOnly(){
  if(!checkAdmin()) return;
  const gameCount=G.sched.length;
  const scoreCount=Object.keys(G.scores).length;
  if(!confirm(`Clear the entire schedule?\n\nThis will remove:\n  • ${gameCount} scheduled games\n  • ${scoreCount} entered scores\n  • All playoff brackets\n\nThis will KEEP:\n  ✓ Your ${G.teams.length} teams\n  ✓ Your diamond configuration\n  ✓ Season dates and settings\n\nThis cannot be undone.`)) return;
  if(!confirm(`Final confirmation — delete all ${gameCount} games?`)) return;
  G.sched=[];
  G.scores={};
  // PATCH: include format:'podrr' so playoff routing survives a schedule clear
  G.playoffs={
    seeded:false,format:'podrr',podA:[],podB:[],games:{},
    semis:{podA:{},podB:{}},
    finals:{podA:{home:null,away:null,score:null},podB:{home:null,away:null,score:null}}
  };
  saveData();
  _markStaleAndRenderActive();
  showToast('🗑 Schedule cleared — teams and diamonds preserved');
}

function showAddGameForm(){
  if(!checkAdmin()) return;
  const form=document.getElementById('add-game-form');
  if(!form) return;
  if(form.style.display!=='none'){ form.style.display='none'; return; }

  const teamOpts=G.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  const dmOpts=G.diamonds.map(d=>`<option value="${d.id}">${esc(d.name)}${d.lights?' 💡':' 🌙'}</option>`).join('');
  const typeOpts=`<option value="regular">Regular Season</option><option value="playoff">🏆 Playoff</option><option value="exhibition">Exhibition</option>`;

  form.innerHTML=`<div style="background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--r-sm);padding:14px 16px;margin:8px 0 12px">
    <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">Add Game</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
      <div><label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Date</label>
        <input type="date" id="agDate" class="sel" style="width:100%"/></div>
      <div><label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Time</label>
        <input type="text" id="agTime" class="sel" placeholder="6:30 PM" style="width:100%"/></div>
      <div><label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Diamond</label>
        <select id="agDiamond" class="sel" style="width:100%">${dmOpts}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
      <div><label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Home</label>
        <select id="agHome" class="sel" style="width:100%"><option value="">Select…</option>${teamOpts}</select></div>
      <div><label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Away</label>
        <select id="agAway" class="sel" style="width:100%"><option value="">Select…</option>${teamOpts}</select></div>
      <div><label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Type</label>
        <select id="agType" class="sel" style="width:100%">${typeOpts}</select></div>
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
  document.getElementById('add-game-form').style.display='none';

  saveData();
  _markStaleAndRenderActive();
  const typeLabel=type==='playoff'?'🏆 Playoff game':type==='exhibition'?'Exhibition game':'Game';
  showToast(`✓ ${typeLabel} #${newId} added — ${home} vs ${away} · ${date}`);
}
