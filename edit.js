// ── EDIT GAMES ────────────────────────────────────────────────────────────────
function renderEdit(){
  const el=document.getElementById('edi');
  if(!G.sched.length){el.innerHTML='<div class="empty">Generate a schedule to edit games</div>';return;}

  const ssEl=document.getElementById('ss');
  const seEl=document.getElementById('se');
  let days=getSelectedDays();
  if(!days.length) days=[2]; // default Tuesday

  const ssVal=ssEl?.value||'2026-05-19';
  const seVal=seEl?.value||'2026-09-29';

  // All nights in the season window
  const windowNights=getGameNights(ssVal, seVal, days);

  // Also include any scheduled game dates that fall outside the window
  // (e.g. if se was saved as Sep 15 but games exist on Sep 22/29)
  const schedDates=new Set(G.sched.map(g=>g.date));
  const extraDates=[...schedDates].filter(d=>!windowNights.includes(d)).sort();

  // Merge and deduplicate, sorted
  const allNights=[...new Set([...windowNights,...extraDates])].sort();

  const T1=document.getElementById('time1')?.value||'6:30 PM';
  const T2=document.getElementById('time2')?.value||'8:15 PM';

  // Group all nights by month
  const monthMap={};const monthOrder=[];
  for(const dateStr of allNights){
    const ml=monthLabel(dateStr);
    if(!monthMap[ml]){monthMap[ml]=[];monthOrder.push(ml);}
    monthMap[ml].push(dateStr);
  }

  let html=`<div class="notice">Edit or remove scheduled games · Add teams to open slots · Changes require admin PIN</div>`;

  monthOrder.forEach((month,mi)=>{
    let inner='';
    let monthOpenSlots=0;
    for(const dateStr of monthMap[month]){
      inner+=`<div class="day-head">${fmtDate(dateStr)}${sunsetBadge(dateStr)}</div>`;
      const nightGames=G.sched.filter(g=>g.date===dateStr).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
      const usedAt1=new Set(nightGames.filter(g=>g.time!==T2).map(g=>g.diamond));
      const usedAt2=new Set(nightGames.filter(g=>g.time===T2).map(g=>g.diamond));
      const openAt1=getDiamondIds().filter(d=>!usedAt1.has(d));
      const openAt2=G.diamonds.filter(d=>d.lights).map(d=>d.id).filter(d=>!usedAt2.has(d));
      monthOpenSlots+=openAt1.length+openAt2.length;

      // Scheduled games
      for(const g of nightGames){
        const isCO=g.home===CROSSOVER||g.away===CROSSOVER;
        const isLate=g.time===T2;
        inner+=`<div class="edit-row${isLate?' late':''}" style="border-left:3px solid ${isCO?'#27ae60':'var(--navy2)'}">
          <span class="time-lbl${isLate?' late':''}" style="width:54px;flex-shrink:0">${g.time}</span>
          <span class="gnum" style="flex-shrink:0;margin-right:4px">#${g.id}</span>
          <select onchange="editGame('${g.id}','home',this.value)" class="sel">
            ${G.teams.map(t=>`<option value="${esc(t)}"${t===g.home?' selected':''}>${esc(t)}</option>`).join('')}
          </select>
          <span style="font-size:11px;color:var(--muted);flex-shrink:0">vs</span>
          <select onchange="editGame('${g.id}','away',this.value)" class="sel">
            ${G.teams.map(t=>`<option value="${esc(t)}"${t===g.away?' selected':''}>${esc(t)}</option>`).join('')}
          </select>
          <select onchange="editGame('${g.id}','diamond',this.value)" class="sel">
            ${getDiamondIds().map(d=>`<option value="${d}"${d===g.diamond?' selected':''}>${getDiamondName(d)}</option>`).join('')}
          </select>
          <select onchange="editGame('${g.id}','time',this.value)" class="sel">
            <option value="${T1}"${g.time===T1?' selected':''}>${T1}</option>
            <option value="${T2}"${g.time===T2?' selected':''}>${T2}</option>
          </select>
          <button onclick="removeGame('${g.id}')" title="Remove game #${g.id}" style="flex-shrink:0;padding:4px 8px;background:none;border:1.5px solid var(--border);border-radius:6px;cursor:pointer;color:var(--red);font-size:14px;line-height:1">🗑</button>
        </div>`;
      }

      // Open slots at T1
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

      // Open slots at T2 (lit diamonds only)
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

  // Auto-open: preserve currently open month if any, else open current month
  const now=new Date();
  const currentMonth=MONTH_NAMES[now.getMonth()]+' '+now.getFullYear();
  // Check if any month was open before re-render (stored in data attr)
  const lastOpenMonth=el.dataset.openMonth||currentMonth;
  let opened=false;
  monthOrder.forEach((month,i)=>{
    if(month===lastOpenMonth||(!opened&&i===0)){
      const body=document.getElementById('em_m'+i);
      const arr=document.getElementById('arr_em_m'+i);
      if(body&&!body.classList.contains('open')){body.classList.add('open');if(arr)arr.textContent='▲';opened=true;}
    }
  });
  // Store the open month for next re-render
  el.dataset.openMonth=lastOpenMonth;
}

function editGame(id,field,value){
  const g=G.sched.find(x=>x.id===id);
  if(!g)return;
  if(field==='diamond'){g.diamond=parseInt(value);g.lights=isDiamondLit(g.diamond);}
  else if(field==='home') g.home=value;
  else if(field==='away') g.away=value;
  else if(field==='time') g.time=value;
  g.crossover=g.home===CROSSOVER||g.away===CROSSOVER;
  saveData();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();
}

function removeGame(id){
  if(!checkAdmin()) return;
  const g=G.sched.find(x=>x.id===id);
  if(!g) return;
  if(!confirm(`Remove game #${id}?\n${g.home} vs ${g.away}\n${fmtDate(g.date)} at ${g.time}\n\nThe slot will remain available to fill.\nThis cannot be undone.`)) return;
  // Store the month so Edit Games re-opens to the right place
  const d=new Date(g.date+'T12:00:00');
  const openMonth=MONTH_NAMES[d.getMonth()]+' '+d.getFullYear();
  G.sched=G.sched.filter(x=>x.id!==id);
  delete G.scores[id];
  saveData();
  // Set which month to re-open before re-rendering
  const edi=document.getElementById('edi');
  if(edi) edi.dataset.openMonth=openMonth;
  renderEdit();
  renderSched();
  renderScores();
  renderStandings();
  renderStats();
  showToast(`🗑 Game #${id} removed — slot is open`);
}

function addSlotGame(slotId, dateStr, time, dmId, lights){
  if(!checkAdmin()) return;
  const home=document.getElementById(slotId+'_h')?.value;
  const away=document.getElementById(slotId+'_a')?.value;
  if(!home){alert('Please select a Home team.');return;}
  if(!away){alert('Please select an Away team.');return;}
  if(home===away){alert('Home and Away teams must be different.');return;}
  const YEAR=new Date(dateStr+'T12:00:00').getFullYear().toString().slice(-2);
  const newId=`${YEAR}${String(G.sched.length+1).padStart(3,'0')}`;
  const newGame={
    id: newId, date: dateStr, time: time, diamond: dmId, lights: lights,
    home: home, away: away, bye: '', crossover: home===CROSSOVER||away===CROSSOVER
  };
  G.sched.push(newGame);
  G.sched.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  // Store which month to re-open
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
