/* =============================================================
   Per-section trip maps — Leaflet, no API key, no tracker
   ============================================================= */
/* Mirrors the home page's #journal-map pattern but localized: each section
 * that opts in by including <aside class="section-with-map__map"
 *   data-trip-map="<scope>"> gets its own Leaflet instance. The map is
 * sticky within that section, scrolls with it, and unmounts when out of view.
 *
 * Scopes: 'itinerary' | 'hotels' | 'restaurants' | 'creators'
 * Each scope has a loader that scrapes the rendered DOM (or fetches data) to
 * produce pins. Loaders are async because hotels/restaurants render after
 * the home page's data fetch settles. */
(function () {
  'use strict';

  // Esri World Imagery — free satellite tiles, no key required. Attribution
  // required per their terms of use (Esri, Maxar, Earthstar Geographics).
  // NOTE: Esri's URL has no {s} placeholder; do NOT pass `subdomains: undefined`
  // to L.tileLayer — that overrides Leaflet's 'abc' default and crashes
  // _getSubdomain() ("Cannot read properties of undefined (reading 'length')").
  const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const TILE_ATTRIB =
    'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
  // Optional reference overlay with city / road labels on top of imagery.
  const LABELS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

  const instances = []; // { host, map, layerGroup, scope }

  window.TripMap = {
    init: initAll,
    refresh: refreshAll,
    focus: focusOn,
  };

  /* ---------- bootstrap ---------- */
  function initAll() {
    const hosts = document.querySelectorAll('[data-trip-map]');
    if (!hosts.length) return;
    if (!window.YATRA_TRIP_DEFAULTS || !Array.isArray(window.YATRA_TRIP_DEFAULTS.cities)) return;

    loadLeaflet().then(() => {
      hosts.forEach((host) => {
        try {
          mountOne(host);
        } catch (err) {
          console.error('[trip-map] mount failed for scope=' + host.dataset.tripMap, err);
          host.innerHTML = '<div class="trip-map-error">Map failed to mount (' + (err && err.message ? err.message : 'unknown') + ').</div>';
        }
      });
      bindCardClicks();
    }).catch((err) => {
      console.error('[trip-map] Leaflet failed to load', err);
      hosts.forEach((h) => { h.innerHTML = '<div class="trip-map-error">Leaflet library failed to load.</div>'; });
    });
  }

  /* ---------- card click → focus map ---------- */
  let cardClicksBound = false;
  function bindCardClicks() {
    if (cardClicksBound) return;
    cardClicksBound = true;
    document.addEventListener('click', onCardActivate);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest && e.target.closest('[data-map-scope][data-lat][data-lon]');
      if (!card) return;
      e.preventDefault();
      onCardActivate(e);
    });
  }
  function onCardActivate(e) {
    // Don't hijack clicks on real links/buttons inside the card
    if (e.target.closest && e.target.closest('a, button')) return;
    const card = e.target.closest && e.target.closest('[data-map-scope][data-lat][data-lon]');
    if (!card) return;
    const lat = parseFloat(card.dataset.lat);
    const lon = parseFloat(card.dataset.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    focusOn(card.dataset.mapScope, lat, lon, card.dataset.name || '');
    // Visual selection state on the cards within this scope
    document
      .querySelectorAll('[data-map-scope="' + card.dataset.mapScope + '"]')
      .forEach((c) => c.classList.remove('is-map-active'));
    card.classList.add('is-map-active');
  }
  function focusOn(scope, lat, lon, name) {
    const inst = instances.find((i) => i.scope === scope);
    if (!inst) return;
    inst.map.flyTo([lat, lon], 16, { duration: 0.6 });
    // Open popup on the matching marker if we can find one nearby
    const markers = inst.markers || [];
    const hit = markers.find((m) => {
      const ll = m.getLatLng();
      return Math.abs(ll.lat - lat) < 0.0008 && Math.abs(ll.lng - lon) < 0.0008;
    });
    if (hit) {
      setTimeout(() => hit.openPopup(), 650);
    } else if (name) {
      L.popup({ className: 'trip-map-popup' })
        .setLatLng([lat, lon])
        .setContent('<strong>' + escapeHtml(name) + '</strong>')
        .openOn(inst.map);
    }
  }

  function refreshAll() {
    instances.forEach((inst) => loadAndRender(inst));
  }

  /* ---------- per-host setup ---------- */
  function mountOne(host) {
    if (host.dataset.tripMapMounted === '1') return;
    host.dataset.tripMapMounted = '1';

    const scope = host.dataset.tripMap;
    const mapHost = document.createElement('div');
    mapHost.className = 'trip-map-host';
    host.appendChild(mapHost);

    const legend = document.createElement('div');
    legend.className = 'trip-map-legend';
    legend.innerHTML = `
      <span><span class="dot saffron"></span>${legendLabel(scope)}</span>
      <span><span class="dot slate"></span>Trip cities</span>
      <span><span class="dot star"></span>Your pick</span>
    `;
    host.appendChild(legend);

    const cities = window.YATRA_TRIP_DEFAULTS.cities;
    const center = computeCenter(cities);
    const map = L.map(mapHost, {
      zoomControl: true,
      scrollWheelZoom: false,
      worldCopyJump: true,
    }).setView([center.lat, center.lon], pickStartingZoom(cities));

    const tiles = L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIB,
    });
    tiles.on('tileerror', () => {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd',
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      tiles.remove();
    });
    tiles.addTo(map);
    // Translucent place-name labels on top of imagery for legibility
    L.tileLayer(LABELS_URL, { maxZoom: 19, opacity: 0.85, pane: 'overlayPane' }).addTo(map);

    // Click map to enable scroll-zoom briefly (mirrors a common UX pattern so
    // the page doesn't hijack scroll until the user explicitly engages).
    map.on('click', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());

    const layerGroup = L.layerGroup().addTo(map);
    const inst = { host, map, layerGroup, scope };
    instances.push(inst);
    loadAndRender(inst);
  }

  function legendLabel(scope) {
    return scope === 'itinerary'   ? 'Day stops'
         : scope === 'hotels'      ? 'Hotels'
         : scope === 'restaurants' ? 'Veg restaurants'
         : scope === 'creators'    ? 'Creator picks'
         : scope === 'curator'     ? 'Curator picks'
         : 'Locations';
  }

  /* ---------- render ---------- */
  async function loadAndRender(inst) {
    inst.layerGroup.clearLayers();
    inst.markers = [];
    let pins = [];
    try {
      switch (inst.scope) {
        case 'itinerary':   pins = await loadItineraryPins();   break;
        case 'hotels':      pins = await loadHotelPins();       break;
        case 'restaurants': pins = await loadRestaurantPins();  break;
        case 'creators':    pins = await loadCreatorPins();     break;
        case 'curator':     pins = await loadCuratorPins();     break;
      }
    } catch (err) {
      console.warn('[trip-map]', inst.scope, 'load failed', err);
    }

    // Ambient: trip cities as small slate dots so context survives.
    const cities = window.YATRA_TRIP_DEFAULTS.cities || [];
    const ambient = cities
      .filter((c) => !pins.some((p) => Math.abs(p.lat - c.lat) < 0.05 && Math.abs(p.lon - c.lon) < 0.05))
      .map((c) => ({ lat: c.lat, lon: c.lon, label: c.name, kind: 'ambient' }));

    [...ambient, ...pins].forEach((p) => {
      const marker = addMarker(inst.layerGroup, p);
      if (marker && p.kind !== 'ambient') inst.markers.push(marker);
    });

    const fitTo = pins.length ? pins : (cities.length ? cities.map((c) => ({ lat: c.lat, lon: c.lon })) : []);
    if (fitTo.length === 1) {
      inst.map.setView([fitTo[0].lat, fitTo[0].lon], 13);
    } else if (fitTo.length > 1) {
      const bounds = L.latLngBounds(fitTo.map((p) => [p.lat, p.lon]));
      inst.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
    // Re-measure after first render in case sticky/grid sized the host late.
    setTimeout(() => inst.map.invalidateSize(), 100);
  }

  function addMarker(group, p) {
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return null;
    const cls =
      p.kind === 'ambient'  ? 'trip-pin trip-pin--ambient' :
      p.kind === 'userpick' ? 'trip-pin trip-pin--user'    :
                              'trip-pin trip-pin--active';
    const icon = L.divIcon({
      className: cls,
      html: `<span class="trip-pin-dot"></span>${p.label ? '<span class="trip-pin-label">' + escapeHtml(p.label) + '</span>' : ''}`,
      iconSize: null,
    });
    const marker = L.marker([p.lat, p.lon], { icon, riseOnHover: true });
    if (p.popupHtml) {
      marker.bindPopup(p.popupHtml, { maxWidth: 240, className: 'trip-map-popup' });
    } else if (p.label) {
      marker.bindPopup(escapeHtml(p.label));
    }
    marker.addTo(group);
    return marker;
  }

  /* ---------- loaders ---------- */
  async function loadItineraryPins() {
    const cities = window.YATRA_TRIP_DEFAULTS.cities || [];
    const days = document.querySelectorAll('#itinerary details.day, #itinerary .day');
    const pins = [];
    days.forEach((d, idx) => {
      const titleEl = d.querySelector('.day-title');
      const dateEl = d.querySelector('.day-date');
      const title = titleEl ? titleEl.textContent.trim() : 'Day ' + (idx + 1);
      const date = dateEl ? dateEl.textContent.trim() : '';
      const matched = cities.find((c) => title.toLowerCase().includes(c.name.toLowerCase()));
      const center = matched || cities[0];
      if (!center) return;
      pins.push({
        lat: center.lat, lon: center.lon,
        label: 'Day ' + (idx + 1),
        kind: 'active',
        popupHtml: `<strong>${escapeHtml(date)}</strong><br>${escapeHtml(title)}<br><small>${escapeHtml(center.name)}</small>`,
      });
    });
    return jitterDuplicates(pins);
  }

  async function loadHotelPins() {
    const cities = window.YATRA_TRIP_DEFAULTS.cities || [];
    const cards = document.querySelectorAll('#hotels .hotel-card');
    const pins = [];
    cards.forEach((card) => {
      const nameEl = card.querySelector('.hotel-name, h3, h4');
      const name = nameEl ? nameEl.textContent.trim() : (card.dataset.name || null);
      if (!name) return;
      // Prefer real GPS from the card if rendered; otherwise fall back to city center
      const cardLat = parseFloat(card.dataset.lat);
      const cardLon = parseFloat(card.dataset.lon);
      if (!Number.isNaN(cardLat) && !Number.isNaN(cardLon)) {
        pins.push({
          lat: cardLat, lon: cardLon,
          label: name,
          kind: 'active',
          popupHtml: `<strong>${escapeHtml(name)}</strong>`,
        });
        return;
      }
      let city = card.dataset.city || null;
      if (!city) {
        const txt = card.textContent.toLowerCase();
        const m = cities.find((c) => txt.includes(c.name.toLowerCase()));
        if (m) city = m.name;
      }
      const matched = cities.find((c) => c.name === city) || cities[0];
      if (!matched) return;
      pins.push({
        lat: matched.lat, lon: matched.lon,
        label: name,
        kind: 'active',
        popupHtml: `<strong>${escapeHtml(name)}</strong><br><small>${escapeHtml(matched.name)}</small>`,
      });
    });
    return jitterDuplicates(pins);
  }

  async function loadRestaurantPins() {
    const cards = document.querySelectorAll('#veg-restaurants .veg-card');
    const pins = [];
    cards.forEach((card) => {
      let lat = parseFloat(card.dataset.lat);
      let lon = parseFloat(card.dataset.lon);
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        const link = card.querySelector('a.chip[href*="google.com/maps/search"]');
        if (!link) return;
        const m = decodeURIComponent(link.href).match(/query=([\-\d.]+),([\-\d.]+)/);
        if (!m) return;
        lat = parseFloat(m[1]);
        lon = parseFloat(m[2]);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
      }
      const name = card.dataset.name || (card.querySelector('.veg-card-title') || {}).textContent || '';
      pins.push({
        lat, lon,
        label: name.replace(/\s*(Google|OSM)\s*$/, '').trim(),
        kind: 'active',
        popupHtml: `<strong>${escapeHtml(name.trim())}</strong>`,
      });
    });
    return pins;
  }

  async function loadCreatorPins() {
    if (!window.YatraData || !window.YatraData.Influencers || !window.YatraData.Influencers.forDestination) return [];
    const cities = window.YATRA_TRIP_DEFAULTS.cities || [];
    const seen = new Set();
    const pins = [];
    for (const c of cities) {
      let items = [];
      try { items = await window.YatraData.Influencers.forDestination(c.name); } catch (_) { items = []; }
      items.forEach((it) => {
        (it.places_mentioned || []).forEach((pm) => {
          if (typeof pm.lat !== 'number' || typeof pm.lon !== 'number') return;
          const k = pm.lat.toFixed(3) + ',' + pm.lon.toFixed(3) + ',' + (pm.name || '');
          if (seen.has(k)) return;
          seen.add(k);
          pins.push({
            lat: pm.lat, lon: pm.lon,
            label: pm.name || 'Place',
            kind: 'active',
            popupHtml: `<strong>${escapeHtml(pm.name || 'Place')}</strong><br><small>${escapeHtml((it.creator || '') + (pm.sentiment ? ' · ' + pm.sentiment : ''))}</small>`,
          });
        });
      });
    }
    return pins;
  }

  async function loadCuratorPins() {
    const cards = document.querySelectorAll('#curator-picks .curator-card, #curator-picks-root .curator-card');
    if (!cards.length) return [];
    const cities = window.YATRA_TRIP_DEFAULTS.cities || [];

    // Build name→coords lookup from the influencer corpus (which already has
    // lat/lon stamped on places_mentioned[]).
    const lookup = {};
    if (window.YatraData && window.YatraData.Influencers && window.YatraData.Influencers._loadAll) {
      try {
        const payload = await window.YatraData.Influencers._loadAll();
        (payload.items || []).forEach((it) => {
          (it.places_mentioned || []).forEach((pm) => {
            if (typeof pm.lat === 'number' && typeof pm.lon === 'number' && pm.name) {
              const key = pm.name.toLowerCase().trim();
              if (!lookup[key]) lookup[key] = { lat: pm.lat, lon: pm.lon };
            }
          });
        });
      } catch (_) { /* fall through */ }
    }

    const pins = [];
    cards.forEach((card) => {
      const nameEl = card.querySelector('.curator-card-name');
      const name = nameEl ? nameEl.textContent.trim() : null;
      if (!name) return;
      // Climb to the .curator-city wrapper to grab the city name from the head
      const cityWrap = card.closest('.curator-city');
      const cityHeadEl = cityWrap ? cityWrap.querySelector('.curator-city-head') : null;
      const cityName = cityHeadEl ? cityHeadEl.firstChild.textContent.trim() : null;

      let coords = lookup[name.toLowerCase().trim()];
      if (!coords) {
        // Fallback: place at the trip city center (will be jittered if duplicates)
        const matched = cities.find((c) => cityName && c.name.toLowerCase() === cityName.toLowerCase()) || cities[0];
        if (matched) coords = { lat: matched.lat, lon: matched.lon };
      }
      if (!coords) return;
      pins.push({
        lat: coords.lat, lon: coords.lon,
        label: name,
        kind: 'active',
        popupHtml: `<strong>${escapeHtml(name)}</strong>${cityName ? '<br><small>' + escapeHtml(cityName) + '</small>' : ''}`,
      });
    });
    return jitterDuplicates(pins);
  }

  /* ---------- helpers ---------- */
  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    // Drop SRI on purpose: when running with a content blocker / VPN /
    // alternate CDN cache, unpkg can return a slightly different gzipped
    // payload (different magic bytes) and the SRI check fails silently —
    // which surfaces as "Map failed to load." for every map on the page.
    // We try unpkg first, jsDelivr second, cdnjs third.
    const SOURCES = [
      { js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',                        css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' },
      { js: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',             css: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css' },
      { js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',        css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css' },
    ];
    return SOURCES.reduce((chain, src) => chain.catch(() => loadOne(src)), Promise.reject());

    function loadOne({ js, css }) {
      return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = css;
        document.head.appendChild(link);

        const s = document.createElement('script');
        s.src = js;
        s.async = true;
        s.onload = () => (window.L && window.L.map) ? resolve() : reject(new Error('leaflet missing'));
        s.onerror = () => reject(new Error('leaflet load failed: ' + js));
        document.head.appendChild(s);
      });
    }
  }

  function computeCenter(cities) {
    const lat = cities.reduce((a, c) => a + c.lat, 0) / cities.length;
    const lon = cities.reduce((a, c) => a + c.lon, 0) / cities.length;
    return { lat, lon };
  }

  function pickStartingZoom(cities) {
    if (cities.length <= 1) return 12;
    const lats = cities.map((c) => c.lat);
    const lons = cities.map((c) => c.lon);
    const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons));
    if (span < 0.5) return 11;
    if (span < 2) return 9;
    if (span < 8) return 6;
    return 4;
  }

  function jitterDuplicates(pins) {
    const seen = new Map();
    return pins.map((p) => {
      const key = p.lat.toFixed(3) + ',' + p.lon.toFixed(3);
      const count = (seen.get(key) || 0);
      seen.set(key, count + 1);
      if (count === 0) return p;
      const angle = count * 1.2;
      const r = 0.0015 * count;
      return Object.assign({}, p, { lat: p.lat + r * Math.cos(angle), lon: p.lon + r * Math.sin(angle) });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }
})();
