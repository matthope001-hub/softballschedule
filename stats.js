// ── STATS ─────────────────────────────────────────────────────────────────────

const TEAM_COLOURS=[
  '#e63946','#2a9d8f','#f4a261','#264653','#6a4c93',
  '#1982c4','#8ac926','#e9c46a','#ff595e','#4cc9f0'
];

function renderStats(){
  const el=document.getElementById('sta');
  if(!el)return;
  if(!document.getElementById('tab-stats')?.classList.contains('active')){
    el.dataset.stale='1';
    return;
  }
  el.dataset.stale='0';
  if(!G.sched.length){el.innerHTML='<div class="empty">Generate a schedule to view stats</div>';return;}

  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const allTeams=G.teams;
  const schedDiamondIds=[...new Set(G.sched.map(g=>g.diamond))].sort((a,b)=>a-b);

  // ── accumulate ──
  const ts={};
  for(const t of allTeams){ts[t]={total:0,home:0,away:0,dh:0,fields:{}};schedDiamondIds.forEach(d=>ts[t].fields[d]=0);}
  const h2h={};const coGames={};
  for(const t of leagueTeams){h2h[t]={};for(const u of leagueTeams)h2h[t][u]=0;coGames[t]=0;}
  const nightCount={};

  for(const g of G.sched){
    if(ts[g.home]){ts[g.home].total++;ts[g.home].home++;ts[g.home].fields[g.diamond]=(ts[g.home].fields[g.diamond]||0)+1;}
    if(ts[g.away]){ts[g.away].total++;ts[g.away].away++;ts[g.away].fields[g.diamond]=(ts[g.away].fields[g.diamond]||0)+1;}
    if(h2h[g.home]&&h2h[g.home][g.away]!==undefined)h2h[g.home][g.away]++;
    if(h2h[g.away]&&h2h[g.away][g.home]!==undefined)h2h[g.away][g.home]++;
    if(g.crossover){if(coGames[g.home]!==undefined)coGames[g.home]++;if(coGames[g.away]!==undefined)coGames[g.away]++;}
    const key=`${g.date}§${g.diamond}`;
    nightCount[key]=(nightCount[key]||0)+1;
  }
  for(const g of G.sched){
    const key=`${g.date}§${g.diamond}`;
    if((nightCount[key]||0)>=2){if(ts[g.home])ts[g.home].dh++;if(ts[g.away])ts[g.away].dh++;}
  }

  // ── season highlights ──
  const scored=G.sched.filter(g=>G.scores[g.id]&&!g.playoff);
  const teamW={},teamL={},teamRF={},teamRA={};
  let totalRuns=0,shutouts=0,biggestMargin=0,biggestGame=null,highestTotal=0,highestGame=null;
  for(const t of leagueTeams){teamW[t]=0;teamL[t]=0;teamRF[t]=0;teamRA[t]=0;}
  for(const g of scored){
    const sc=G.scores[g.id];
    const total=sc.h+sc.a;
    totalRuns+=total;
    if(sc.h===0||sc.a===0)shutouts++;
    const margin=Math.abs(sc.h-sc.a);
    if(margin>biggestMargin){biggestMargin=margin;biggestGame=g;}
    if(total>highestTotal){highestTotal=total;highestGame=g;}
    if(leagueTeams.includes(g.home)){teamRF[g.home]+=sc.h;teamRA[g.home]+=sc.a;if(sc.h>sc.a)teamW[g.home]++;else if(sc.a>sc.h)teamL[g.home]++;}
    if(leagueTeams.includes(g.away)){teamRF[g.away]+=sc.a;teamRA[g.away]+=sc.h;if(sc.a>sc.h)teamW[g.away]++;else if(sc.h>sc.a)teamL[g.away]++;}
  }
  const avgRuns=scored.length?Math.round(totalRuns/scored.length*10)/10:0;
  const mostRF=leagueTeams.slice().sort((a,b)=>(teamRF[b]||0)-(teamRF[a]||0));
  const bestDef=leagueTeams.slice().sort((a,b)=>(teamRA[a]||0)-(teamRA[b]||0));
  const mostW=leagueTeams.slice().sort((a,b)=>(teamW[b]||0)-(teamW[a]||0));
  const mostL=leagueTeams.slice().sort((a,b)=>(teamL[b]||0)-(teamL[a]||0));

  function hCard(icon,label,value,sub=''){
    return`<div style="padding:12px 14px;background:var(--white);border:1.5px solid var(--border);border-radius:var(--r-sm);display:flex;flex-direction:column;gap:2px;min-width:0">
      <div style="font-size:18px;line-height:1">${icon}</div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-top:4px">${label}</div>
      <div style="font-size:13px;font-weight:800;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(value)}</div>
      ${sub?`<div style="font-size:11px;color:var(--muted)">${sub}</div>`:''}
    </div>`;
  }

  const bwSc=biggestGame?G.scores[biggestGame.id]:null;
  const hsSc=highestGame?G.scores[highestGame.id]:null;
  const played=scored.length;
  const total=G.sched.filter(g=>!g.playoff).length;

  // ── games per team table ──
  // Show D-cols behind a toggle so the table doesn't sprawl
  const dColsHtml=schedDiamondIds.map(d=>`<th style="min-width:56px">D${d}</th>`).join('');
  const dToggleId='_stats_dcols_'+Date.now();

  const teamRows=allTeams.map(t=>{
    const s=ts[t];
    const isCO=t===CROSSOVER;
    const dCells=schedDiamondIds.map(d=>{
      const v=s.fields[d]||0;
      return`<td style="font-family:var(--mono);font-size:12px;color:${v===0?'var(--muted)':'var(--text)'}">${v||'—'}</td>`;
    }).join('');
    return`<tr style="background:${isCO?'#f0fff4':'var(--white)'}">
      <th style="text-align:left;font-weight:${isCO?'700':'600'};color:${isCO?'#15803d':'var(--text)');padding:7px 12px;font-size:13px;white-space:nowrap">${esc(t)}${isCO?'<span style="font-size:10px;color:#15803d;margin-left:4px">CO</span>':''}</th>
      <td style="font-weight:800;font-family:var(--mono);font-size:13px;color:var(--navy)">${s.total}</td>
      <td style="font-family:var(--mono);font-size:12px">${s.home}</td>
      <td style="font-family:var(--mono);font-size:12px">${s.away}</td>
      <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${s.dh}</td>
      ${dCells}
    </tr>`;
  }).join('');

  // ── h2h matrix ──
  // Abbreviated team names for column headers
  function abbr(name){
    const words=name.split(/\s+/);
    if(words.length===1)return name.slice(0,4);
    return words.map(w=>w[0]).join('').toUpperCase().slice(0,4);
  }
  const colW=36;
  const h2hColHeaders=leagueTeams.map(t=>`<th style="width:${colW}px;min-width:${colW}px;max-width:${colW}px;text-align:center;padding:4px 2px;font-size:10px;font-weight:700;color:var(--muted);white-space:normal;word-break:break-all;line-height:1.2" title="${esc(t)}">${abbr(t)}</th>`).join('');

  const h2hRows=leagueTeams.map(r=>{
    const cells=leagueTeams.map(c=>{
      if(r===c)return`<td style="background:var(--surface2);color:var(--muted);text-align:center;font-size:12px">—</td>`;
      const v=h2h[r][c]||0;
      const ok=v>=2;
      return`<td style="text-align:center;font-family:var(--mono);font-size:13px;font-weight:${ok?'700':'400'};color:${ok?'var(--navy)':'var(--muted)'}">${v||'0'}</td>`;
    }).join('');
    const co=coGames[r]||0;
    return`<tr>
      <th style="text-align:left;padding:6px 10px;font-size:12px;font-weight:600;white-space:nowrap;min-width:120px">${esc(r)}</th>
      ${cells}
      <td style="text-align:center;font-family:var(--mono);font-size:13px;font-weight:700;color:#15803d;background:#f0fff4">${co}</td>
    </tr>`;
  }).join('');

  // ── diamond usage summary ──
  const dUsageRows=schedDiamondIds.map(d=>{
    const total=allTeams.reduce((s,t)=>s+(ts[t]?.fields[d]||0),0);
    return`<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:var(--mono);font-size:12px;font-weight:800;color:var(--navy);min-width:28px">D${d}</span>
      <span style="font-size:12px;color:var(--muted);flex:1">${esc(getDiamondName(d))}</span>
      <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--text)">${total} games</span>
    </div>`;
  }).join('');

  const tdStyle=`style="padding:7px 10px;border-bottom:1px solid var(--border);text-align:center"`;
  const thStyle=`style="padding:7px 10px;background:var(--surface2);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);text-align:center;border-bottom:2px solid var(--border)"`;

  el.innerHTML=`
  <div class="metric-grid" style="margin-bottom:12px">
    <div class="metric"><div class="metric-label">Games Played</div><div class="metric-value">${played}</div></div>
    <div class="metric"><div class="metric-label">Remaining</div><div class="metric-value">${total-played}</div></div>
    <div class="metric"><div class="metric-label">Total Games</div><div class="metric-value">${total}</div></div>
    <div class="metric"><div class="metric-label">Avg Runs/Game</div><div class="metric-value">${played?avgRuns:'—'}</div></div>
  </div>

  ${played?`<div class="card" style="margin-bottom:12px">
    <div class="card-title">⚡ Season Highlights</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
      ${hCard('🏏','Most Runs Scored',mostRF[0]||'—',mostRF[0]?`${teamRF[mostRF[0]]} runs`:'')}
      ${hCard('🛡','Best Defense',bestDef[0]||'—',bestDef[0]?`${teamRA[bestDef[0]]} allowed`:'')}
      ${hCard('🥇','Most Wins',mostW[0]||'—',mostW[0]?`${teamW[mostW[0]]} wins`:'')}
      ${hCard('📉','Most Losses',mostL[0]||'—',mostL[0]?`${teamL[mostL[0]]} losses`:'')}
      ${hCard('💥','Biggest Win',biggestGame?(bwSc.h>bwSc.a?biggestGame.home:biggestGame.away):'—',biggestGame?`${Math.max(bwSc.h,bwSc.a)}–${Math.min(bwSc.h,bwSc.a)} (+${biggestMargin})`:'')}
      ${hCard('🔥','Highest Scoring',highestGame?`${highestGame.home} vs ${highestGame.away}`:'—',highestGame?`${hsSc.h}–${hsSc.a} (${highestTotal} runs)`:'')}
      ${hCard('🦺','Shutouts',String(shutouts),'combined')}
      ${hCard('⚾','Total Runs',String(totalRuns),'this season')}
    </div>
  </div>`:''}

  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="card-title" style="margin:0">Games Per Team</div>
      <button onclick="(function(){var el=document.getElementById('_dcols');var btn=document.getElementById('_dcolsbtn');var vis=el.style.display!=='none';el.style.display=vis?'none':'';btn.textContent=vis?'Show Diamonds ▾':'Hide Diamonds ▴';})()" id="_dcolsbtn"
        style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:5px;border:1.5px solid var(--border);background:var(--white);color:var(--muted);cursor:pointer">
        Show Diamonds ▾
      </button>
    </div>
    <div class="matrix-wrap">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--surface2)">
          <th style="text-align:left;padding:7px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);border-bottom:2px solid var(--border)">Team</th>
          <th ${thStyle}>Total</th>
          <th ${thStyle}>Home</th>
          <th ${thStyle}>Away</th>
          <th ${thStyle}>DH Nights</th>
          <th id="_dcols" colspan="${schedDiamondIds.length}" style="display:none;padding:0;border-bottom:2px solid var(--border)">
            <table style="width:100%;border-collapse:collapse"><thead><tr>${schedDiamondIds.map(d=>`<th ${thStyle}>D${d}</th>`).join('')}</tr></thead></table>
          </th>
        </tr></thead>
        <tbody>${allTeams.map(t=>{
          const s=ts[t];
          const isCO=t===CROSSOVER;
          const dCells=schedDiamondIds.map(d=>{
            const v=s.fields[d]||0;
            return`<td ${tdStyle} style="font-family:var(--mono);font-size:12px;color:${v===0?'var(--muted)':'var(--text)'};padding:7px 10px;border-bottom:1px solid var(--border);text-align:center">${v||'—'}</td>`;
          }).join('');
          return`<tr style="background:${isCO?'#f0fff4':'var(--white)'}">
            <th style="text-align:left;padding:7px 12px;font-weight:${isCO?'700':'500'};color:${isCO?'#15803d':'var(--text)'};font-size:13px;white-space:nowrap;border-bottom:1px solid var(--border)">${esc(t)}${isCO?'<span style="font-size:10px;font-weight:800;color:#15803d;margin-left:5px;background:#dcfce7;padding:1px 5px;border-radius:3px">CO</span>':''}</th>
            <td ${tdStyle} style="font-weight:800;font-family:var(--mono);font-size:14px;color:var(--navy);padding:7px 10px;border-bottom:1px solid var(--border);text-align:center">${s.total}</td>
            <td ${tdStyle} style="font-family:var(--mono);font-size:12px;padding:7px 10px;border-bottom:1px solid var(--border);text-align:center">${s.home}</td>
            <td ${tdStyle} style="font-family:var(--mono);font-size:12px;padding:7px 10px;border-bottom:1px solid var(--border);text-align:center">${s.away}</td>
            <td ${tdStyle} style="font-family:var(--mono);font-size:12px;color:var(--muted);padding:7px 10px;border-bottom:1px solid var(--border);text-align:center">${s.dh}</td>
            <td id="_drow_${esc(t)}" colspan="${schedDiamondIds.length}" style="display:none;padding:0;border-bottom:1px solid var(--border)">
              <table style="width:100%;border-collapse:collapse"><tbody><tr>${dCells}</tr></tbody></table>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="card-title" style="margin-bottom:8px">Head-to-Head Matrix</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Games scheduled per pair · <strong style="color:#15803d">CO</strong> = vs CrossOver · ≥2 shown bold</div>
    <div class="matrix-wrap">
      <table style="border-collapse:collapse;font-size:12px">
        <thead>
          <tr>
            <th style="min-width:120px;text-align:left;padding:6px 10px;background:var(--surface2);border-bottom:2px solid var(--border);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted)">vs →</th>
            ${leagueTeams.map(t=>`<th title="${esc(t)}" style="width:36px;min-width:36px;text-align:center;padding:6px 4px;background:var(--surface2);border-bottom:2px solid var(--border);font-size:10px;font-weight:700;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:36px">${abbr(t)}</th>`).join('')}
            <th style="width:36px;min-width:36px;text-align:center;padding:6px 4px;background:#f0fff4;border-bottom:2px solid var(--border);font-size:10px;font-weight:700;color:#15803d">CO</th>
          </tr>
        </thead>
        <tbody>${h2hRows}</tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-title" style="margin-bottom:8px">Diamond Usage</div>
    ${dUsageRows}
  </div>

  <div class="card" style="margin-top:12px">
    <div class="card-title">📈 Standings History</div>
    <div id="standings-history-chart" style="height:260px;position:relative"></div>
  </div>`;

  // Fix the diamond column toggle — needs to also toggle per-row cells
  // Replace the toggle button with a proper working version
  const btn=document.getElementById('_dcolsbtn');
  if(btn){
    btn.onclick=function(){
      const showing=btn.textContent.includes('Hide');
      allTeams.forEach(t=>{
        const cell=document.getElementById('_drow_'+esc(t));
        if(cell)cell.style.display=showing?'none':'';
      });
      btn.textContent=showing?'Show Diamonds ▾':'Hide Diamonds ▴';
    };
  }

  try{renderStandingsHistoryChart();}catch(e){}
}

// ── STANDINGS HISTORY CHART ───────────────────────────────────────────────────
function renderStandingsHistoryChart(){
  const el=document.getElementById('standings-history-chart');
  if(!el)return;
  const leagueTeams=G.teams.filter(t=>t!==CROSSOVER);
  const scoredGames=G.sched.filter(g=>G.scores[g.id]&&!g.playoff&&!g.crossover)
    .sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  if(!scoredGames.length){el.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:13px">No scored games yet</div>';return;}

  const pts={};for(const t of leagueTeams)pts[t]=0;
  const snapshots=[];
  for(const g of scoredGames){
    const sc=G.scores[g.id];
    if(leagueTeams.includes(g.home)){if(sc.h>sc.a)pts[g.home]+=2;else if(sc.h===sc.a)pts[g.home]+=1;}
    if(leagueTeams.includes(g.away)){if(sc.a>sc.h)pts[g.away]+=2;else if(sc.h===sc.a)pts[g.away]+=1;}
    snapshots.push({date:g.date,...Object.fromEntries(leagueTeams.map(t=>[t,pts[t]]))});
  }

  const W=el.offsetWidth||600,H=260;
  const pad={t:10,r:10,b:30,l:28};
  const cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  const maxPts=Math.max(1,...leagueTeams.map(t=>pts[t]));
  const n=snapshots.length;
  const xScale=i=>pad.l+i*(cw/(n-1||1));
  const yScale=v=>pad.t+ch-(v/maxPts)*ch;

  const lines=leagueTeams.map((t,ti)=>{
    const col=TEAM_COLOURS[ti%TEAM_COLOURS.length];
    const d=snapshots.map((s,i)=>`${i===0?'M':'L'}${xScale(i).toFixed(1)},${yScale(s[t]).toFixed(1)}`).join(' ');
    return`<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`;
  }).join('');

  const xLabels=[];
  const step=Math.max(1,Math.floor(n/6));
  for(let i=0;i<n;i+=step){
    const d=snapshots[i].date;
    const[,m,day]=d.split('-');
    xLabels.push(`<text x="${xScale(i).toFixed(1)}" y="${H-6}" text-anchor="middle" font-size="10" fill="var(--muted)">${parseInt(m)}/${parseInt(day)}</text>`);
  }

  const yLabels=[];
  const yStep=Math.ceil(maxPts/4);
  for(let v=0;v<=maxPts;v+=yStep){
    yLabels.push(`<text x="${pad.l-4}" y="${(yScale(v)+4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`);
    yLabels.push(`<line x1="${pad.l}" y1="${yScale(v).toFixed(1)}" x2="${W-pad.r}" y2="${yScale(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`);
  }

  const legend=leagueTeams.map((t,ti)=>{
    const col=TEAM_COLOURS[ti%TEAM_COLOURS.length];
    return`<div style="display:flex;align-items:center;gap:4px;font-size:11px;white-space:nowrap"><span style="width:12px;height:3px;background:${col};display:inline-block;border-radius:2px"></span>${esc(t)}</div>`;
  }).join('');

  el.innerHTML=`
    <svg width="${W}" height="${H}" style="display:block;overflow:visible">
      ${yLabels.join('')}${lines}${xLabels.join('')}
    </svg>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;padding:0 ${pad.l}px">${legend}</div>`;
}
