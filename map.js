// ── PARK MAP ──────────────────────────────────────────────────────────────────

const DIAMOND_COORDS = {
  2:  [43.21130, -79.81950],
  3:  [43.21155, -79.81980],
  4:  [43.21180, -79.81940],
  5:  [43.21205, -79.81905],
  6:  [43.21175, -79.81870],
  7:  [43.21150, -79.81840],
  8:  [43.21125, -79.81810],
  9:  [43.21100, -79.81780],
  10: [43.21075, -79.81750],
  11: [43.21050, -79.81720],
  12: [43.21025, -79.81690],
  13: [43.20980, -79.82050],
  14: [43.20955, -79.82080]
};

function initParkMap() {
  const el = document.getElementById('park-map');
  if (!el) return;
  if (window._leafletMap) {
    window._leafletMap.invalidateSize();
    return;
  }

  const map = L.map('park-map', {
    center: [43.2108, -79.8185],
    zoom: 17,
    zoomControl: true,
    scrollWheelZoom: false
  });

  window._leafletMap = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  const legendEl = document.getElementById('map-legend');
  if (legendEl) legendEl.innerHTML = '';

  G.diamonds.forEach(d => {
    const coords = DIAMOND_COORDS[d.id];
    if (!coords) return;

    const isActive = d.active;
    const hasLights = d.lights;
    const noLightsCapable = d.lightsCapable === false;

    const colour = isActive
      ? (hasLights ? '#1a3a6b' : '#e67e22')
      : '#aaaaaa';

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:28px;height:28px;
        background:${colour};
        border:2px solid #fff;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:11px;font-weight:800;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        font-family:sans-serif;
        line-height:1;
      ">${d.id}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16]
    });

    const statusLine = noLightsCapable
      ? '🚫 No lights infrastructure'
      : hasLights
        ? '💡 Lights — Doubleheader capable'
        : '🌙 No lights — 6:30 PM only';

    const activeLine = isActive ? '✅ Active' : '⬜ Inactive — not scheduled';

    const marker = L.marker(coords, { icon }).addTo(map);
    marker.bindPopup(`
      <div style="font-family:sans-serif;min-width:160px">
        <div style="font-size:14px;font-weight:800;color:#1a3a6b;margin-bottom:4px">
          D${d.id} — ${d.name}
        </div>
        <div style="font-size:12px;color:#555;margin-bottom:2px">${activeLine}</div>
        <div style="font-size:12px;color:#555">${statusLine}</div>
      </div>
    `, { maxWidth: 220 });

    // Legend row
    if (legendEl) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:13px;opacity:' + (isActive ? '1' : '0.45');
      row.innerHTML = `
        <span style="display:inline-flex;align-items:center;justify-content:center;
          width:24px;height:24px;border-radius:50%;background:${colour};
          color:#fff;font-size:10px;font-weight:800;flex-shrink:0">${d.id}</span>
        <span style="font-weight:${isActive ? '600' : '400'};color:var(--text)">${d.name}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--muted)">
          ${noLightsCapable ? '🚫 No lights' : hasLights ? '💡 Lights' : '🌙 No lights'}
          ${isActive ? '' : ' · Inactive'}
        </span>`;
      legendEl.appendChild(row);
    }
  });
}
