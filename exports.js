// ── EXPORTS ───────────────────────────────────────────────────────────────────

function exportCSV(){
  if(!G.sched.length){alert('No schedule to export.');return;}
  const rows=[['Game ID','Date','Day','Time','Diamond','Home','Away','Home Score','Away Score','Type']];
  for(const g of G.sched){
    const sc=G.scores[g.id];
    const[y,m,d]=g.date.split('-').map(Number);
    const day=new Date(y,m-1,d).toLocaleDateString('en-CA',{weekday:'long'});
    const type=g.playoff?'Playoff':g.crossover?'CrossOver':'League';
    rows.push([`#${g.id}`,g.date,day,g.time||'',getDiamondName(g.diamond),g.home,g.away,sc?sc.h:'',sc?sc.a:'',type]);
  }
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`HCCSL_${G.currentSeason||2026}_Schedule.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('⬇ CSV downloaded');
}

function exportPrint(){
  if(!G.sched.length){alert('No schedule to export.');return;}
  const rows=G.sched.map(g=>{
    const sc=G.scores[g.id];
    const type=g.playoff?'🏆 Playoff':g.crossover?'CrossOver':'League';
    return`<tr>
      <td>#${esc(g.id)}</td>
      <td>${esc(fmtDate(g.date))}</td>
      <td>${esc(g.time||'')}</td>
      <td>${esc(getDiamondName(g.diamond))}</td>
      <td>${esc(g.home)}</td>
      <td>${esc(g.away)}</td>
      <td style="text-align:center">${sc?`${sc.h} – ${sc.a}`:''}</td>
      <td>${type}</td>
    </tr>`;
  }).join('');
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>HCCSL ${G.currentSeason||2026} Schedule</title>
  <style>body{font-family:sans-serif;font-size:12px;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#1a2744;color:#fff}tr:nth-child(even){background:#f5f5f5}@media print{button{display:none}}</style>
  </head><body>
  <h2>HCCSL ${G.currentSeason||2026} — Full Schedule</h2>
  <p>Exported ${new Date().toLocaleDateString()}</p>
  <button onclick="window.print()">🖨 Print</button>
  <table><thead><tr><th>Game</th><th>Date</th><th>Time</th><th>Diamond</th><th>Home</th><th>Away</th><th>Score</th><th>Type</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`);
  win.document.close();
}

function exportICal(){
  if(!G.sched.length){alert('No schedule to export.');return;}
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//HCCSL//Schedule//EN','CALSCALE:GREGORIAN'];
  for(const g of G.sched){
    const[y,mo,d]=g.date.split('-').map(Number);
    let[hr,mn]=g.time?g.time.replace(' PM','').replace(' AM','').split(':').map(Number):[18,30];
    if(g.time&&g.time.includes('PM')&&hr!==12) hr+=12;
    const pad=n=>String(n).padStart(2,'0');
    const dtStart=`${y}${pad(mo)}${pad(d)}T${pad(hr)}${pad(mn||0)}00`;
    const endHr=hr+1;const endMn=(mn||0)+30;
    const dtEnd=`${y}${pad(mo)}${pad(d)}T${pad(endHr)}${pad(endMn)}00`;
    const summary=`HCCSL: ${g.home} vs ${g.away}`;
    const desc=`Game #${g.id} · ${getDiamondName(g.diamond)} · ${g.crossover?'CrossOver':g.playoff?'Playoff':'League'}`;
    lines.push('BEGIN:VEVENT',`DTSTART:${dtStart}`,`DTEND:${dtEnd}`,`SUMMARY:${summary}`,`DESCRIPTION:${desc}`,`LOCATION:Turner Park, Hamilton ON`,`UID:hccsl-${g.id}@hccsl`,`STATUS:CONFIRMED`,'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob=new Blob([lines.join('\r\n')],{type:'text/calendar'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`HCCSL_${G.currentSeason||2026}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📅 iCal downloaded');
}
