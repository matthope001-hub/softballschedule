// ── CHAMPIONS ─────────────────────────────────────────────────────────────────

const CHAMPIONS_SEED=[
  {year:2026,podA:null,podB:null,note:'Season in progress'},
  {year:2025,podA:'Kibosh',podB:'JAFT'},
  {year:2024,podA:'Alcoballics',podB:'Steel City Sluggers'},
  {year:2023,podA:'Basic Pitches',podB:'Landon Longballers'},
  {year:2022,champion:'Alcoballics'},
  {year:2018,champion:'One Hit Wonders'},
  {year:2017,champion:'Stiff Competition'},
  {year:2016,champion:'Stiff Competition'},
  {year:2015,champion:'Stiff Competition'},
  {year:2014,champion:'Stiff Competition'},
  {year:2013,champion:'Institutes'},
  {year:2012,champion:'Stiff Competition'},
  {year:2011,champion:'Institutes'},
  {year:2010,champion:'Institutes'},
  {year:2009,champion:'Road Runners'},
  {year:2008,champion:'Institutes'},
  {year:2007,champion:'Dilligaf'},
  {year:2006,champion:'Institutes'},
  {year:2005,champion:'Institutes'},
  {year:2004,champion:"Assholes & Bitches"},
  {year:2003,champion:'Mars Metal Maniacs'},
  {year:2002,champion:'Admiral Inn'},
  {year:2001,champion:'Admiral Inn'},
  {year:2000,champion:'Mustangs'},
  {year:1999,champion:'Mustangs'},
  {year:1998,champion:'Road Runners'},
  {year:1997,champion:'Play It Again Sports'},
  {year:1996,champion:"Carrera's Mustangs"},
];

// 2023 season archive
const ARCHIVE_2023=[
  {date:'2023-05-23',time:'6:30 PM',away:'Foul Poles',home:'Basic Pitches',diamond:'D12',as:8,hs:15},
  {date:'2023-05-23',time:'6:30 PM',away:'Alcoballics',home:'One Hit Wonders',diamond:'D13',as:22,hs:16},
  {date:'2023-05-23',time:'6:30 PM',away:'Landon Longballers',home:'JAFT',diamond:'D14',as:4,hs:6},
  {date:'2023-05-23',time:'6:30 PM',away:'Steel City Sluggers',home:'Wayco',diamond:'D5',as:12,hs:11},
  {date:'2023-05-23',time:'6:30 PM',away:'Kibosh',home:'Stiff Competition',diamond:'D9',as:8,hs:9},
  {date:'2023-05-23',time:'8:15 PM',away:'Kibosh',home:'Foul Poles',diamond:'D12',as:9,hs:7},
  {date:'2023-05-23',time:'8:15 PM',away:'Basic Pitches',home:'Steel City Sluggers',diamond:'D9',as:7,hs:11},
  {date:'2023-05-30',time:'6:30 PM',away:'JAFT',home:'Stiff Competition',diamond:'D12',as:10,hs:11},
  {date:'2023-05-30',time:'6:30 PM',away:'Steel City Sluggers',home:'Foul Poles',diamond:'D13',as:15,hs:5},
  {date:'2023-05-30',time:'6:30 PM',away:'One Hit Wonders',home:'Wayco',diamond:'D14',as:7,hs:8},
  {date:'2023-05-30',time:'6:30 PM',away:'Basic Pitches',home:'Alcoballics',diamond:'D5',as:6,hs:11},
  {date:'2023-05-30',time:'6:30 PM',away:'Landon Longballers',home:'Kibosh',diamond:'D9',as:11,hs:5},
  {date:'2023-05-30',time:'8:15 PM',away:'JAFT',home:'Wayco',diamond:'D12',as:12,hs:7},
  {date:'2023-05-30',time:'8:15 PM',away:'Landon Longballers',home:'Stiff Competition',diamond:'D9',as:9,hs:5},
  {date:'2023-06-06',time:'6:30 PM',away:'Kibosh',home:'Wayco',diamond:'D12',as:9,hs:6},
  {date:'2023-06-06',time:'6:30 PM',away:'Alcoballics',home:'JAFT',diamond:'D13',as:7,hs:10},
  {date:'2023-06-06',time:'6:30 PM',away:'Basic Pitches',home:'Stiff Competition',diamond:'D14',as:4,hs:14},
  {date:'2023-06-06',time:'6:30 PM',away:'One Hit Wonders',home:'Steel City Sluggers',diamond:'D5',as:9,hs:15},
  {date:'2023-06-06',time:'6:30 PM',away:'Foul Poles',home:'Landon Longballers',diamond:'D9',as:10,hs:12},
  {date:'2023-06-06',time:'8:15 PM',away:'Kibosh',home:'One Hit Wonders',diamond:'D12',as:10,hs:9},
  {date:'2023-06-06',time:'8:15 PM',away:'Foul Poles',home:'Wayco',diamond:'D9',as:8,hs:6},
  {date:'2023-06-13',time:'6:30 PM',away:'Alcoballics',home:'Stiff Competition',diamond:'D12',as:11,hs:12},
  {date:'2023-06-13',time:'6:30 PM',away:'Landon Longballers',home:'Steel City Sluggers',diamond:'D13',as:13,hs:11},
  {date:'2023-06-13',time:'6:30 PM',away:'One Hit Wonders',home:'JAFT',diamond:'D14',as:4,hs:13},
  {date:'2023-06-13',time:'6:30 PM',away:'Wayco',home:'Kibosh',diamond:'D5',as:6,hs:12},
  {date:'2023-06-13',time:'6:30 PM',away:'Basic Pitches',home:'Foul Poles',diamond:'D9',as:5,hs:11},
  {date:'2023-06-13',time:'8:15 PM',away:'Alcoballics',home:'Landon Longballers',diamond:'D12',as:16,hs:10},
  {date:'2023-06-13',time:'8:15 PM',away:'Wayco',home:'Basic Pitches',diamond:'D9',as:8,hs:14},
  {date:'2023-06-20',time:'6:30 PM',away:'Stiff Competition',home:'Kibosh',diamond:'D12',as:5,hs:10},
  {date:'2023-06-20',time:'6:30 PM',away:'JAFT',home:'Basic Pitches',diamond:'D13',as:9,hs:11},
  {date:'2023-06-20',time:'6:30 PM',away:'Foul Poles',home:'Alcoballics',diamond:'D14',as:8,hs:5},
  {date:'2023-06-20',time:'6:30 PM',away:'Steel City Sluggers',home:'One Hit Wonders',diamond:'D5',as:5,hs:11},
  {date:'2023-06-20',time:'6:30 PM',away:'Wayco',home:'Landon Longballers',diamond:'D9',as:12,hs:9},
  {date:'2023-06-20',time:'8:15 PM',away:'Stiff Competition',home:'Steel City Sluggers',diamond:'D12',as:9,hs:11},
  {date:'2023-06-20',time:'8:15 PM',away:'JAFT',home:'Foul Poles',diamond:'D9',as:8,hs:12},
  {date:'2023-06-27',time:'6:30 PM',away:'One Hit Wonders',home:'Alcoballics',diamond:'D12',as:5,hs:13},
  {date:'2023-06-27',time:'6:30 PM',away:'Kibosh',home:'JAFT',diamond:'D13',as:8,hs:9},
  {date:'2023-06-27',time:'6:30 PM',away:'Landon Longballers',home:'Foul Poles',diamond:'D14',as:12,hs:8},
  {date:'2023-06-27',time:'6:30 PM',away:'Stiff Competition',home:'Wayco',diamond:'D5',as:7,hs:9},
  {date:'2023-06-27',time:'6:30 PM',away:'Basic Pitches',home:'Steel City Sluggers',diamond:'D9',as:14,hs:11},
  {date:'2023-06-27',time:'8:15 PM',away:'One Hit Wonders',home:'Landon Longballers',diamond:'D12',as:10,hs:13},
  {date:'2023-06-27',time:'8:15 PM',away:'Kibosh',home:'Basic Pitches',diamond:'D9',as:11,hs:10},
  {date:'2023-07-04',time:'6:30 PM',away:'Foul Poles',home:'Stiff Competition',diamond:'D12',as:8,hs:10},
  {date:'2023-07-04',time:'6:30 PM',away:'Alcoballics',home:'Wayco',diamond:'D13',as:12,hs:6},
  {date:'2023-07-04',time:'6:30 PM',away:'Steel City Sluggers',home:'JAFT',diamond:'D14',as:9,hs:11},
  {date:'2023-07-04',time:'6:30 PM',away:'One Hit Wonders',home:'Kibosh',diamond:'D5',as:5,hs:8},
  {date:'2023-07-04',time:'6:30 PM',away:'Landon Longballers',home:'Basic Pitches',diamond:'D9',as:7,hs:10},
  {date:'2023-07-04',time:'8:15 PM',away:'Foul Poles',home:'JAFT',diamond:'D12',as:11,hs:9},
  {date:'2023-07-04',time:'8:15 PM',away:'Alcoballics',home:'Steel City Sluggers',diamond:'D9',as:9,hs:12},
  {date:'2023-07-11',time:'6:30 PM',away:'Wayco',home:'One Hit Wonders',diamond:'D12',as:8,hs:9},
  {date:'2023-07-11',time:'6:30 PM',away:'Stiff Competition',home:'Landon Longballers',diamond:'D13',as:4,hs:13},
  {date:'2023-07-11',time:'6:30 PM',away:'JAFT',home:'Kibosh',diamond:'D14',as:12,hs:14},
  {date:'2023-07-11',time:'6:30 PM',away:'Basic Pitches',home:'Alcoballics',diamond:'D5',as:11,hs:9},
  {date:'2023-07-11',time:'6:30 PM',away:'Foul Poles',home:'Steel City Sluggers',diamond:'D9',as:8,hs:13},
  {date:'2023-07-11',time:'8:15 PM',away:'Wayco',home:'Stiff Competition',diamond:'D12',as:7,hs:10},
  {date:'2023-07-11',time:'8:15 PM',away:'JAFT',home:'Alcoballics',diamond:'D9',as:8,hs:14},
  {date:'2023-07-18',time:'6:30 PM',away:'Steel City Sluggers',home:'Kibosh',diamond:'D12',as:6,hs:9},
  {date:'2023-07-18',time:'6:30 PM',away:'One Hit Wonders',home:'Foul Poles',diamond:'D13',as:6,hs:11},
  {date:'2023-07-18',time:'6:30 PM',away:'Alcoballics',home:'Basic Pitches',diamond:'D14',as:9,hs:13},
  {date:'2023-07-18',time:'6:30 PM',away:'Wayco',home:'JAFT',diamond:'D5',as:9,hs:8},
  {date:'2023-07-18',time:'6:30 PM',away:'Stiff Competition',home:'Basic Pitches',diamond:'D9',as:5,hs:11},
  {date:'2023-07-18',time:'8:15 PM',away:'Steel City Sluggers',home:'Foul Poles',diamond:'D12',as:8,hs:10},
  {date:'2023-07-18',time:'8:15 PM',away:'One Hit Wonders',home:'Stiff Competition',diamond:'D9',as:9,hs:5},
  {date:'2023-07-25',time:'6:30 PM',away:'Alcoballics',home:'Kibosh',diamond:'D12',as:10,hs:14},
  {date:'2023-07-25',time:'6:30 PM',away:'JAFT',home:'Landon Longballers',diamond:'D13',as:7,hs:12},
  {date:'2023-07-25',time:'6:30 PM',away:'Basic Pitches',home:'One Hit Wonders',diamond:'D14',as:9,hs:11},
  {date:'2023-07-25',time:'6:30 PM',away:'Foul Poles',home:'Wayco',diamond:'D5',as:8,hs:10},
  {date:'2023-07-25',time:'6:30 PM',away:'Stiff Competition',home:'Steel City Sluggers',diamond:'D9',as:8,hs:13},
  {date:'2023-07-25',time:'8:15 PM',away:'Alcoballics',home:'JAFT',diamond:'D12',as:11,hs:8},
  {date:'2023-07-25',time:'8:15 PM',away:'Basic Pitches',home:'Foul Poles',diamond:'D9',as:11,hs:9},
  {date:'2023-08-01',time:'6:30 PM',away:'Kibosh',home:'Landon Longballers',diamond:'D12',as:9,hs:12},
  {date:'2023-08-01',time:'6:30 PM',away:'Wayco',home:'Alcoballics',diamond:'D13',as:5,hs:13},
  {date:'2023-08-01',time:'6:30 PM',away:'JAFT',home:'One Hit Wonders',diamond:'D14',as:9,hs:5},
  {date:'2023-08-01',time:'6:30 PM',away:'Steel City Sluggers',home:'Stiff Competition',diamond:'D5',as:12,hs:8},
  {date:'2023-08-01',time:'6:30 PM',away:'Foul Poles',home:'Basic Pitches',diamond:'D9',as:7,hs:12},
  {date:'2023-08-01',time:'8:15 PM',away:'Kibosh',home:'Wayco',diamond:'D12',as:12,hs:8},
  {date:'2023-08-01',time:'8:15 PM',away:'JAFT',home:'Steel City Sluggers',diamond:'D9',as:11,hs:14},
  {date:'2023-08-08',time:'6:30 PM',away:'Landon Longballers',home:'One Hit Wonders',diamond:'D12',as:10,hs:7},
  {date:'2023-08-08',time:'6:30 PM',away:'Foul Poles',home:'Kibosh',diamond:'D13',as:7,hs:13},
  {date:'2023-08-08',time:'6:30 PM',away:'Wayco',home:'Steel City Sluggers',diamond:'D14',as:9,hs:12},
  {date:'2023-08-08',time:'6:30 PM',away:'Alcoballics',home:'Stiff Competition',diamond:'D5',as:8,hs:9},
  {date:'2023-08-08',time:'6:30 PM',away:'Basic Pitches',home:'JAFT',diamond:'D9',as:10,hs:12},
  {date:'2023-08-08',time:'8:15 PM',away:'Landon Longballers',home:'Alcoballics',diamond:'D12',as:11,hs:14},
  {date:'2023-08-08',time:'8:15 PM',away:'Foul Poles',home:'One Hit Wonders',diamond:'D9',as:9,hs:11},
  {date:'2023-08-15',time:'6:30 PM',away:'Kibosh',home:'Steel City Sluggers',diamond:'D12',as:11,hs:9},
  {date:'2023-08-15',time:'6:30 PM',away:'Stiff Competition',home:'Foul Poles',diamond:'D13',as:7,hs:13},
  {date:'2023-08-15',time:'6:30 PM',away:'Wayco',home:'Basic Pitches',diamond:'D14',as:9,hs:14},
  {date:'2023-08-15',time:'6:30 PM',away:'One Hit Wonders',home:'Alcoballics',diamond:'D5',as:8,hs:11},
  {date:'2023-08-15',time:'6:30 PM',away:'JAFT',home:'Landon Longballers',diamond:'D9',as:8,hs:15},
  {date:'2023-08-15',time:'8:15 PM',away:'Kibosh',home:'JAFT',diamond:'D12',as:9,hs:14},
  {date:'2023-08-15',time:'8:15 PM',away:'Stiff Competition',home:'Wayco',diamond:'D9',as:6,hs:12},
  {date:'2023-08-22',time:'6:30 PM',away:'Basic Pitches',home:'Kibosh',diamond:'D12',as:9,hs:13},
  {date:'2023-08-22',time:'6:30 PM',away:'One Hit Wonders',home:'Landon Longballers',diamond:'D13',as:11,hs:8},
  {date:'2023-08-22',time:'6:30 PM',away:'Alcoballics',home:'Foul Poles',diamond:'D14',as:12,hs:10},
  {date:'2023-08-22',time:'6:30 PM',away:'JAFT',home:'Wayco',diamond:'D5',as:10,hs:11},
  {date:'2023-08-22',time:'6:30 PM',away:'Steel City Sluggers',home:'Stiff Competition',diamond:'D9',as:7,hs:9},
  {date:'2023-08-22',time:'8:15 PM',away:'Basic Pitches',home:'Wayco',diamond:'D12',as:11,hs:9},
  {date:'2023-08-22',time:'8:15 PM',away:'One Hit Wonders',home:'Steel City Sluggers',diamond:'D9',as:8,hs:14},
  {date:'2023-08-29',time:'6:30 PM',away:'Landon Longballers',home:'Stiff Competition',diamond:'D12',as:9,hs:8},
  {date:'2023-08-29',time:'6:30 PM',away:'JAFT',home:'Stiff Competition',diamond:'D14',as:15,hs:11},
  {date:'2023-08-29',time:'6:30 PM',away:'Basic Pitches',home:'One Hit Wonders',diamond:'D5',as:6,hs:7},
  {date:'2023-08-29',time:'6:30 PM',away:'Kibosh',home:'Alcoballics',diamond:'D9',as:4,hs:10},
  {date:'2023-08-29',time:'8:15 PM',away:'Kibosh',home:'Steel City Sluggers',diamond:'D12',as:5,hs:12},
  {date:'2023-09-05',time:'6:30 PM',away:'Stiff Competition',home:'One Hit Wonders',diamond:'D12',as:0,hs:7},
  {date:'2023-09-05',time:'6:30 PM',away:'Landon Longballers',home:'Foul Poles',diamond:'D13',as:11,hs:9},
  {date:'2023-09-05',time:'6:30 PM',away:'JAFT',home:'Alcoballics',diamond:'D14',as:8,hs:8},
  {date:'2023-09-05',time:'6:30 PM',away:'Kibosh',home:'Steel City Sluggers',diamond:'D5',as:13,hs:17},
  {date:'2023-09-05',time:'6:30 PM',away:'Basic Pitches',home:'Wayco',diamond:'D9',as:17,hs:13},
  {date:'2023-09-05',time:'8:15 PM',away:'JAFT',home:'One Hit Wonders',diamond:'D12',as:4,hs:11},
  {date:'2023-09-05',time:'8:15 PM',away:'Landon Longballers',home:'Wayco',diamond:'D9',as:14,hs:10},
];

function getChampions(){return G.champions||CHAMPIONS_SEED;}

function champCounts(){
  const counts={},podBCounts={};
  for(const row of getChampions()){
    if(row.champion)counts[row.champion]=(counts[row.champion]||0)+1;
    if(row.podA)counts[row.podA]=(counts[row.podA]||0)+1;
    if(row.podB)podBCounts[row.podB]=(podBCounts[row.podB]||0)+1;
  }
  return{counts,podBCounts};
}

function recordChampions(){
  if(!checkAdmin())return;
  const yr=parseInt(document.getElementById('champ-year')?.value||G.currentSeason);
  const podA=(document.getElementById('champ-poda')?.value||'').trim();
  const podB=(document.getElementById('champ-podb')?.value||'').trim();
  if(!podA){alert('POD A champion is required.');return;}
  const champs=getChampions().filter(c=>c.year!==yr);
  champs.unshift({year:yr,podA:podA||null,podB:podB||null});
  champs.sort((a,b)=>b.year-a.year);
  G.champions=champs;
  saveData();
  renderChampionAdminUI();
  showToast(`🏆 ${yr} Champions saved!`);
}

function renderChampionAdminUI(){
  const el=document.getElementById('champ-admin-list');
  if(!el)return;
  const champs=getChampions().filter(c=>c.podA||c.champion);
  el.innerHTML=champs.slice(0,5).map(c=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--gray1);border-radius:var(--r-sm);font-size:13px">
      <strong style="color:var(--navy);width:40px">${c.year}</strong>
      <span style="flex:1">${esc(c.podA||c.champion||'—')}</span>
      ${c.podB?`<span style="color:var(--muted);font-size:11px">POD B: ${esc(c.podB)}</span>`:''}
    </div>`).join('');
}

function startNewSeason(){
  if(!checkAdmin())return;
  const newYearStr=(document.getElementById('new-season-year')?.value||'').trim();
  const newYear=parseInt(newYearStr);
  if(!newYear||newYear<2000||newYear>2100){alert('Enter a valid season year (e.g. 2027).');return;}
  if(newYear===G.currentSeason){alert(`Already in the ${G.currentSeason} season.`);return;}
  const podA=(document.getElementById('new-season-champ-poda')?.value||'').trim();
  const podB=(document.getElementById('new-season-champ-podb')?.value||'').trim();
  const msg=`Start NEW ${newYear} season?\n\n`
    +`• Archive the ${G.currentSeason} schedule & scores (preserved forever)\n`
    +(podA?`• Record ${G.currentSeason} POD A champion: ${podA}\n`:'')
    +(podB?`• Record ${G.currentSeason} POD B champion: ${podB}\n`:'')
    +`• Clear the current schedule, scores & playoffs\n`
    +`• Set current season to ${newYear}\n\nThis cannot be undone.`;
  if(!confirm(msg))return;

  // Archive current season
  G.seasonArchive[String(G.currentSeason)]={
    season:G.currentSeason,teams:[...G.teams],
    sched:G.sched.map(g=>({...g})),scores:{...G.scores},
    playoffs:JSON.parse(JSON.stringify(G.playoffs)),
    ss:document.getElementById('ss')?.value||'',
    se:document.getElementById('se')?.value||''
  };

  // Record outgoing champions
  if(podA){
    const champs=getChampions().filter(c=>c.year!==G.currentSeason);
    champs.unshift({year:G.currentSeason,podA:podA||null,podB:podB||null});
    champs.sort((a,b)=>b.year-a.year);
    G.champions=champs;
  }

  // Add new season placeholder
  const existingNew=getChampions().find(c=>c.year===newYear);
  if(!existingNew){
    const champs=G.champions||CHAMPIONS_SEED.slice();
    champs.unshift({year:newYear,podA:null,podB:null,note:'Season in progress'});
    champs.sort((a,b)=>b.year-a.year);
    G.champions=champs;
  }

  // Reset live data
  G.currentSeason=newYear;
  G.sched=[];G.scores={};
  G.playoffs={seeded:false,podA:[],podB:[],games:{},semis:{podA:{},podB:{}},finals:{podA:{home:null,away:null,score:null},podB:{home:nu
