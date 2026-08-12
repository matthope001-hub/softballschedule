// ── DAY-LEVEL WEATHER BADGES (Schedule + Scores tabs) ─────────────────────────
// Adds per-game-night weather badges using Open-Meteo:
//   - Forecast API for today .. +15 days (16-day forecast window)
//   - Historical Archive API for any past game date
// Does not modify renderSched()/renderScores() — wraps them so this file can be
// added standalone without touching schedule-render.js.

const _wxCache = {}; // date (YYYY-MM-DD) -> {code,tmax,tmin,wind,rainPct,precip,isForecast}

const _WX_LAT = 43.2557;
const _WX_LON = -79.8711;

const _WMO_ICON = {
  0:'☀️',1:'🌤',2:'⛅',3:'☁️',
  45:'🌫',48:'🌫',
  51:'🌦',53:'🌦',55:'🌧',
  61:'🌧',63:'🌧',65:'🌧',
  71:'🌨',73:'🌨',75:'❄️',77:'🌨',
  80:'🌦',81:'🌧',82:'⛈',
  85:'🌨',86:'❄️',
  95:'⛈',96:'⛈',99:'⛈'
};

function _wxWindIcon(kmh){
  if(kmh>=50) return '🌪️';
  if(kmh>=30) return '💨';
  return '';
}

function _wxSeverity(rec){
  const rain = rec.rainPct;
  const precip = rec.precip||0;
  if((rain!=null&&rain>=60)||precip>=5) return 'red';
  if((rain!=null&&rain>=30)||precip>0||rec.wind>=40) return 'amber';
  return 'neutral';
}

function _wxBadgeHtml(dateStr){
  const rec=_wxCache[dateStr];
  if(!rec) return '';
  const sev=_wxSeverity(rec);
  const colors={
    red:   {bg:'#fee2e2',fg:'#991b1b'},
    amber: {bg:'#fef3c7',fg:'#92400e'},
    neutral:{bg:'var(--surface2,#f3f4f6)',fg:'var(--muted,#6b7280)'}
  }[sev];
  const icon=_WMO_ICON[rec.code]||'🌡';
  const windIcon=_wxWindIcon(rec.wind);
  const rainPart=(rec.rainPct!=null&&rec.rainPct>=30)?` · ${Math.round(rec.rainPct)}%`:'';
  const precipPart=(rec.precip>0)?` · ${rec.precip.toFixed(1)}mm`:'';
  const label=`${icon} ${Math.round(rec.tmax)}°/${Math.round(rec.tmin)}°C · ${Math.round(rec.wind)}km/h${windIcon?' '+windIcon:''}${rainPart}${precipPart}`;
  return `<span class="wx-day-badge" style="font-size:10px;background:${colors.bg};color:${colors.fg};padding:1px 6px;border-radius:3px;font-weight:700;margin-left:6px;white-space:nowrap">${label}</span>`;
}

// ── FETCH + CACHE ──────────────────────────────────────────────────────────────
async function _refreshDayForecasts(){
  if(!G.sched||!G.sched.length) return;
  const today=toDateStr(new Date());
  const maxForecast=toDateStr(new Date(Date.now()+15*86400000));

  const allDates=[...new Set(G.sched.filter(g=>!g.playoff&&!g.open).map(g=>g.date))];
  const needed=allDates.filter(d=>!_wxCache[d]);
  if(!needed.length){ _paintWxBadges(); return; }

  const pastDates=needed.filter(d=>d<today);
  const futureDates=needed.filter(d=>d>=today&&d<=maxForecast);
  // Dates beyond the 15-day forecast window simply won't get a badge yet.

  const jobs=[];
  if(pastDates.length){
    const start=pastDates.reduce((a,b)=>a<b?a:b);
    const end=pastDates.reduce((a,b)=>a>b?a:b);
    jobs.push(_fetchWxRange('https://archive-api.open-meteo.com/v1/archive',start,end,false));
  }
  if(futureDates.length){
    const start=futureDates.reduce((a,b)=>a<b?a:b);
    const end=futureDates.reduce((a,b)=>a>b?a:b);
    jobs.push(_fetchWxRange('https://api.open-meteo.com/v1/forecast',start,end,true));
  }

  try{
    await Promise.all(jobs);
  }catch(e){
    console.warn('Day weather fetch failed:',e);
  }
  _paintWxBadges();
}

async function _fetchWxRange(baseUrl,startDate,endDate,isForecast){
  const dailyParams=isForecast
    ? 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max'
    : 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max';
  const url=`${baseUrl}?latitude=${_WX_LAT}&longitude=${_WX_LON}&daily=${dailyParams}&timezone=America%2FToronto&start_date=${startDate}&end_date=${endDate}`;
  const res=await fetch(url);
  if(!res.ok) throw new Error(`HTTP ${res.status} (${baseUrl})`);
  const data=await res.json();
  const d=data.daily;
  if(!d||!d.time) return;
  for(let i=0;i<d.time.length;i++){
    const dateStr=d.time[i];
    _wxCache[dateStr]={
      code: d.weathercode ? d.weathercode[i] : null,
      tmax: d.temperature_2m_max ? d.temperature_2m_max[i] : null,
      tmin: d.temperature_2m_min ? d.temperature_2m_min[i] : null,
      wind: d.windspeed_10m_max ? d.windspeed_10m_max[i] : 0,
      rainPct: (isForecast && d.precipitation_probability_max) ? d.precipitation_probability_max[i] : null,
      precip: d.precipitation_sum ? d.precipitation_sum[i] : 0,
      isForecast
    };
  }
}

// ── PAINT BADGES INTO EXISTING day-head ELEMENTS ──────────────────────────────
// Matches day-head elements (in DOM order) to the same chronologically-sorted
// unique date list used to build them, avoiding any need to alter renderSched()
// or renderScores() directly.
function _paintWxBadges(){
  ['so','sco','sc'].forEach(containerId=>{
    const container=document.getElementById(containerId);
    if(!container) return;
    const heads=container.querySelectorAll('.day-head');
    if(!heads.length) return;

    const uniqueDates=[...new Set(
      G.sched.filter(g=>!g.playoff&&!g.open).map(g=>g.date)
    )].sort();

    if(heads.length!==uniqueDates.length) return; // structure mismatch — skip safely

    heads.forEach((headEl,i)=>{
      const dateStr=uniqueDates[i];
      const existing=headEl.querySelector('.wx-day-badge');
      if(existing) existing.remove();
      const badge=_wxBadgeHtml(dateStr);
      if(badge) headEl.insertAdjacentHTML('beforeend',badge);
    });
  });
}

// ── HOOK INTO EXISTING RENDER FUNCTIONS ────────────────────────────────────────
// Wrap (don't replace) renderSched/renderScores so day badges refresh after
// either tab re-renders, without editing schedule-render.js.
(function(){
  function wrap(fnName){
    const orig=window[fnName];
    if(typeof orig!=='function') return;
    window[fnName]=function(...args){
      const result=orig.apply(this,args);
      _refreshDayForecasts();
      return result;
    };
  }
  // Delay wrapping until other scripts have defined these functions.
  document.addEventListener('DOMContentLoaded',function(){
    wrap('renderSched');
    wrap('renderScores');
  });
})();
