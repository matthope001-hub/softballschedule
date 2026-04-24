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
  const html=`<!DOCTYPE html><html><head><title>HCCSL ${G.currentSeason||2026} Schedule</title>
  <style>body{font-family:sans-serif;font-size:12px;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#1a2744;color:#fff}tr:nth-child(even){background:#f5f5f5}@media print{button{display:none}}</style>
  </head><body>
  <h2>HCCSL ${G.currentSeason||2026} — Full Schedule</h2>
  <p>Exported ${new Date().toLocaleDateString()}</p>
  <button onclick="window.print()">🖨 Print</button>
  <table><thead><tr><th>Game</th><th>Date</th><th>Time</th><th>Diamond</th><th>Home</th><th>Away</th><th>Score</th><th>Type</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`;
  const blob=new Blob([html],{type:'text/html'});
  const url=URL.createObjectURL(blob);
  const win=window.open(url,'_blank');
  if(!win)alert('Popup blocked — allow popups for print/PDF export');
}

// PATCH: iCal export now uses TZID:America/Toronto with correct local time
// instead of bare (floating) timestamps that calendar apps interpret as UTC,
// causing games to appear 4–5 hours off for Eastern time users.
function exportICal(){
  if(!G.sched.length){alert('No schedule to export.');return;}

  const pad=n=>String(n).padStart(2,'0');

  // Parse "6:30 PM" / "8:15 PM" style strings into {h,m} in 24h.
  function parseTime(timeStr){
    if(!timeStr) return{h:18,m:30};
    const upper=timeStr.trim().toUpperCase();
    const isPM=upper.includes('PM');
    const isAM=upper.includes('AM');
    const parts=upper.replace(/[^0-9:]/g,'').split(':');
    let h=parseInt(parts[0])||18;
    const m=parseInt(parts[1])||0;
    if(isPM&&h!==12) h+=12;
    if(isAM&&h===12) h=0;
    return{h,m};
  }

  // Build a TZID-qualified timestamp string: TZID=America/Toronto:YYYYMMDDTHHmmss
  function dtLocal(dateStr,timeStr){
    const[y,mo,d]=dateStr.split('-');
    const{h,m}=parseTime(timeStr);
    return`TZID=America/Toronto:${y}${mo}${d}T${pad(h)}${pad(m)}00`;
  }

  // Timezone definition block for America/Toronto (covers EST/EDT transitions)
  const tzBlock=[
    'BEGIN:VTIMEZONE',
    'TZID:America/Toronto',
    'BEGIN:STANDARD',
    'DTSTART:19671029T020000',
    'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19870405T020000',
    'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'END:DAYLIGHT',
    'END:VTIMEZONE'
  ].join('\r\n');

  const lines=[
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HCCSL//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:HCCSL Schedule',
    'X-WR-TIMEZONE:America/Toronto',
    tzBlock
  ];

  for(const g of G.sched){
    const{h:startH,m:startM}=parseTime(g.time);
    // Games are 1h30m; end = start + 90 minutes
    const totalStartMin=startH*60+startM;
    const totalEndMin=totalStartMin+90;
    const endH=Math.floor(totalEndMin/60);
    const endM=totalEndMin%60;
    const[y,mo,d]=g.date.split('-');

    const dtStart=`TZID=America/Toronto:${y}${mo}${d}T${pad(startH)}${pad(startM)}00`;
    const dtEnd=`TZID=America/Toronto:${y}${mo}${d}T${pad(endH)}${pad(endM)}00`;
    const summary=`HCCSL: ${g.home} vs ${g.away}`;
    const desc=`Game #${g.id} · ${getDiamondName(g.diamond)} · ${g.crossover?'CrossOver':g.playoff?'Playoff':'League'}`;

    lines.push(
      'BEGIN:VEVENT',
      `DTSTART;${dtStart}`,
      `DTEND;${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:Turner Park\\, Hamilton ON`,
      `UID:hccsl-${g.id}@hccsl`,
      `STATUS:CONFIRMED`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  const blob=new Blob([lines.join('\r\n')],{type:'text/calendar;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`HCCSL_${G.currentSeason||2026}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📅 iCal downloaded');
}
