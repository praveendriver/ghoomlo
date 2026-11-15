/* =============================================================
   Yatra. — Data sources module
   Browser-side wrappers for free + key-gated travel APIs.
   Each function falls back gracefully if a key is missing.
   ============================================================= */

(function (global) {
  'use strict';

  // ---- Tiny in-memory + sessionStorage cache ----
  const CACHE_PREFIX = 'yatra:cache:';
  const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
  function cacheGet(key, opts) {
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const fresh = Date.now() - obj.t <= CACHE_TTL_MS;
      if (!fresh && !(opts && opts.staleOk)) return null;
      return obj.v;
    } catch (_) { return null; }
  }
  // Returns {value, ageMs} for stale fallback paths so callers can show
  // "last updated" hints. Returns null only when we have nothing at all.
  function cacheGetWithAge(key) {
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return { value: obj.v, ageMs: Date.now() - obj.t };
    } catch (_) { return null; }
  }
  function cacheSet(key, value) {
    try {
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
    } catch (_) { /* quota or disabled */ }
  }

  // Mark an object as stale (live fetch failed, returning cached value).
  // Non-enumerable so JSON.stringify of widget data stays clean.
  function markStale(value, info) {
    if (value == null) return value;
    try {
      Object.defineProperty(value, '_stale', { value: { ...info }, enumerable: false, configurable: true });
    } catch (_) { /* frozen object — give up silently */ }
    return value;
  }
  // Parse a fetch Response and detect SerpAPI quota exhaustion.
  // Returns { ok, quota, json } so callers don't need to re-parse.
  async function readSerpResponse(r) {
    if (!r) return { ok: false, quota: false, json: null };
    let json = null;
    try { json = await r.json(); } catch (_) { /* non-JSON body */ }
    if (r.status === 429) return { ok: false, quota: true, json };
    if (!r.ok) return { ok: false, quota: false, json };
    if (json && typeof json === 'object' && json.error) {
      const code = (json.code || '').toString();
      return { ok: false, quota: code === 'quota_exceeded', json };
    }
    return { ok: true, quota: false, json };
  }

  // ---- Proxy base (same origin; /api/*) ----
  const API_BASE = '/api';

  // Probe whether we're behind the proxy (proxy.py) or just static (python -m http.server).
  // /api/* on a plain static server returns 404 → we surface a helpful state.
  // Any non-404 response (200, 400, 429, 500, …) means the proxy route is wired,
  // which is all we need to know — individual endpoints handle their own errors.
  let _proxyReady = null;
  async function probeProxy() {
    if (_proxyReady !== null) return _proxyReady;
    try {
      const r = await fetch(`${API_BASE}/holidays?country=IN&year=2026`, { method: 'GET' });
      _proxyReady = r.status !== 404;
    } catch (_) { _proxyReady = false; }
    return _proxyReady;
  }

  // ============================================================
  // WEATHER — Open-Meteo (no key)
  // ============================================================
  const Weather = {
    /**
     * Forecast for `days` ahead at coordinates.
     * Returns: { dates: [iso], tmax: [°C], tmin: [°C], rain: [mm], code: [WMO] }
     */
    async forecast(lat, lon, days = 7) {
      const k = `wx:${lat.toFixed(2)},${lon.toFixed(2)}:${days}`;
      const cached = cacheGet(k);
      if (cached) return cached;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=${days}`;
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        const j = await r.json();
        const out = {
          dates: j.daily.time,
          tmax: j.daily.temperature_2m_max,
          tmin: j.daily.temperature_2m_min,
          rain: j.daily.precipitation_sum,
          code: j.daily.weathercode,
          tz: j.timezone,
        };
        cacheSet(k, out);
        return out;
      } catch (_) { return null; }
    },

    summary(fc) {
      if (!fc || !fc.tmax) return null;
      const tmax = Math.round(Math.max(...fc.tmax));
      const tmin = Math.round(Math.min(...fc.tmin));
      const rain = fc.rain.reduce((a, b) => a + (b || 0), 0).toFixed(1);
      return { tmax, tmin, rainTotal: rain };
    },

    iconForCode(code) {
      // WMO weather codes → simple buckets
      if (code >= 95) return 'storm';
      if (code >= 80) return 'shower';
      if (code >= 71) return 'snow';
      if (code >= 61) return 'rain';
      if (code >= 51) return 'drizzle';
      if (code >= 45) return 'fog';
      if (code >= 3) return 'cloud';
      if (code >= 1) return 'partlysunny';
      return 'sunny';
    },
  };

  // ============================================================
  // RESTAURANTS — Overpass (no key) primary
  // ============================================================
  const Restaurants = {
    /**
     * Find vegetarian restaurants within `radiusM` of (lat, lon).
     * Returns array of: { id, name, lat, lon, cuisine, hours, mapsUrl }
     */
    async vegetarianNear(lat, lon, radiusM = 1500) {
      const k = `rest:${lat.toFixed(3)},${lon.toFixed(3)}:${radiusM}:veg`;
      const cached = cacheGet(k);
      if (cached) return cached;

      const q = `[out:json][timeout:25];(node["amenity"="restaurant"]["diet:vegetarian"~"yes|only"](around:${radiusM},${lat},${lon});node["amenity"="restaurant"]["diet:vegan"~"yes|only"](around:${radiusM},${lat},${lon}););out body 30;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
      try {
        const r = await fetch(url);
        if (!r.ok) return [];
        const j = await r.json();
        const items = (j.elements || [])
          .filter((e) => e.tags && e.tags.name)
          .map((e) => ({
            id: e.id,
            name: e.tags.name,
            lat: e.lat,
            lon: e.lon,
            cuisine: e.tags.cuisine || null,
            hours: e.tags.opening_hours || null,
            phone: e.tags.phone || e.tags['contact:phone'] || null,
            website: e.tags.website || e.tags['contact:website'] || null,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lon}`,
            zomatoSearchUrl: `https://www.zomato.com/search?q=${encodeURIComponent(e.tags.name)}`,
          }));
        cacheSet(k, items);
        return items;
      } catch (_) { return []; }
    },
  };

  // ============================================================
  // CURRENCY — Frankfurter (no key)
  // ============================================================
  const Currency = {
    async convert(amount, from, to) {
      if (from === to) return amount;
      const k = `fx:${from}:${to}`;
      let rate = cacheGet(k);
      if (!rate) {
        try {
          const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
          const j = await r.json();
          rate = j.rates && j.rates[to];
          if (rate) cacheSet(k, rate);
        } catch (_) { return null; }
      }
      return rate ? amount * rate : null;
    },
  };

  // ============================================================
  // PLACES — Wikipedia REST (no key)
  // ============================================================
  const Places = {
    async summary(title) {
      const k = `wp:${title}`;
      const cached = cacheGet(k);
      if (cached) return cached;
      try {
        const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        if (!r.ok) return null;
        const j = await r.json();
        const out = {
          title: j.title,
          extract: j.extract,
          thumbnail: j.thumbnail && j.thumbnail.source,
          url: j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page,
        };
        cacheSet(k, out);
        return out;
      } catch (_) { return null; }
    },
  };

  // ============================================================
  // HOLIDAYS — via /api/holidays (Calendarific upstream)
  // ============================================================
  const Holidays = {
    async list(country, year) {
      if (!(await probeProxy())) return [];
      const k = `hol:${country}:${year}`;
      const cached = cacheGet(k);
      if (cached) return cached;
      try {
        const r = await fetch(`${API_BASE}/holidays?country=${country}&year=${year}`);
        if (!r.ok) return [];
        const j = await r.json();
        const items = (j.response && j.response.holidays) || [];
        cacheSet(k, items);
        return items;
      } catch (_) { return []; }
    },
  };

  // ============================================================
  // FLIGHTS — via /api/flights (SerpAPI Google Flights upstream)
  // ============================================================
  const Flights = {
    async snapshot({ origin, destination, departDate, returnDate, pax = 4, kidAges = '' }) {
      if (!(await probeProxy())) return null;
      const k = `fl:${origin}-${destination}-${departDate}-${returnDate}-${pax}`;
      const cached = cacheGet(k);
      if (cached) return cached;
      try {
        const params = new URLSearchParams({
          origin, destination,
          depart: departDate, return: returnDate,
          pax: String(pax),
        });
        if (kidAges) {
          params.set('kids', String(kidAges.split(',').length));
          params.set('kidAges', kidAges);
        }
        const r = await fetch(`${API_BASE}/flights?${params}`);
        const parsed = await readSerpResponse(r);
        if (!parsed.ok) {
          const stale = cacheGetWithAge(k);
          if (stale) return markStale(stale.value, { reason: parsed.quota ? 'quota' : 'error', ageMs: stale.ageMs });
          return null;
        }
        const j = parsed.json;
        const best = (j.best_flights && j.best_flights[0]) || (j.other_flights && j.other_flights[0]);
        if (!best) return null;
        const out = {
          price: best.price,
          duration: best.total_duration,
          carriers: best.flights ? best.flights.map((f) => f.airline) : [],
          bookingToken: best.booking_token,
          flightCount: (j.best_flights || []).length + (j.other_flights || []).length,
        };
        cacheSet(k, out);
        return out;
      } catch (_) {
        const stale = cacheGetWithAge(k);
        if (stale) return markStale(stale.value, { reason: 'error', ageMs: stale.ageMs });
        return null;
      }
    },
  };

  // ============================================================
  // HOTELS — via /api/hotels (SerpAPI Google Hotels upstream)
  // ============================================================
  const Hotels = {
    async search({ dest, checkin, checkout, adults = 2, kids = 2, kidAges = '6,9', hotelClass = '' }) {
      if (!(await probeProxy())) return null;
      const k = `ht:${dest}-${checkin}-${checkout}-${adults}-${kids}-${hotelClass}`;
      const cached = cacheGet(k);
      if (cached) return cached;
      try {
        const params = new URLSearchParams({
          dest, checkin, checkout, adults: String(adults), kids: String(kids), kidAges,
        });
        if (hotelClass) params.set('class', hotelClass);
        const r = await fetch(`${API_BASE}/hotels?${params}`);
        const parsed = await readSerpResponse(r);
        if (!parsed.ok) {
          const stale = cacheGetWithAge(k);
          if (stale) return markStale(stale.value, { reason: parsed.quota ? 'quota' : 'error', ageMs: stale.ageMs });
          return null;
        }
        const j = parsed.json;
        const props = (j.properties || []).map((p) => ({
          name: p.name,
          rate: p.rate_per_night && p.rate_per_night.lowest,
          totalRate: p.total_rate && p.total_rate.lowest,
          rating: p.overall_rating,
          reviews: p.reviews,
          hotelClass: p.hotel_class,
          gpsCoordinates: p.gps_coordinates,
          link: p.link,
          amenities: p.amenities,
          thumbnail: (p.images && p.images[0] && p.images[0].thumbnail) || null,
        }));
        cacheSet(k, props);
        return props;
      } catch (_) {
        const stale = cacheGetWithAge(k);
        if (stale) return markStale(stale.value, { reason: 'error', ageMs: stale.ageMs });
        return null;
      }
    },
  };

  // ============================================================
  // GOOGLE LOCAL — via /api/local (SerpAPI google_local upstream)
  // Restaurants with hours, ratings, photos, real Google data
  // ============================================================
  const GoogleLocal = {
    async search({ q, location }) {
      if (!(await probeProxy())) return null;
      const k = `gl:${q}:${location}`;
      const cached = cacheGet(k);
      if (cached) return cached;
      try {
        const params = new URLSearchParams({ q, location });
        const r = await fetch(`${API_BASE}/local?${params}`);
        const parsed = await readSerpResponse(r);
        if (!parsed.ok) {
          const stale = cacheGetWithAge(k);
          if (stale) return markStale(stale.value, { reason: parsed.quota ? 'quota' : 'error', ageMs: stale.ageMs });
          return null;
        }
        const j = parsed.json;
        const items = (j.local_results || []).map((x) => ({
          name: x.title,
          type: x.type,
          rating: x.rating,
          reviews: x.reviews,
          hours: x.hours,
          address: x.address,
          phone: x.phone,
          gps: x.gps_coordinates,
          place_id: x.place_id,
          mapsUrl: x.gps_coordinates
            ? `https://www.google.com/maps/search/?api=1&query=${x.gps_coordinates.latitude},${x.gps_coordinates.longitude}`
            : `https://www.google.com/maps/search/${encodeURIComponent(x.title)}`,
          thumbnail: x.thumbnail,
        }));
        cacheSet(k, items);
        return items;
      } catch (_) {
        const stale = cacheGetWithAge(k);
        if (stale) return markStale(stale.value, { reason: 'error', ageMs: stale.ageMs });
        return null;
      }
    },
  };

  // ============================================================
  // TRIPADVISOR — wraps /api/tripadvisor → tripadvisor.py CLI
  // Returns top match for a name+type (hotel/attraction/restaurant)
  // ============================================================
  const TripAdvisor = {
    /** Search TripAdvisor with optional geo + country filters.
     *  Pass { query, type, lat, lon, country, city } — passing lat/lon biases the
     *  search and drops results outside radius_km (default 80km). country is ISO-2.
     *  If only `query` is given, falls back to global search (legacy behaviour) but
     *  trip pages should always pass at least country + city.
     */
    async search({ query, type = 'hotel', lat, lon, country, city, radiusKm }) {
      if (!query) return null;
      const k = `ta:${type}:${query}|${country || ''}|${city || ''}|${lat || ''},${lon || ''}`;
      const cached = cacheGet(k);
      if (cached) return cached;
      if (!(await probeProxy())) return null;
      try {
        const params = new URLSearchParams({ query, type });
        if (lat && lon) {
          params.set('lat', String(lat));
          params.set('lon', String(lon));
          if (radiusKm) params.set('radius_km', String(radiusKm));
        }
        if (country) params.set('country', country);
        if (city) params.set('city', city);
        const r = await fetch(`${API_BASE}/tripadvisor?${params}`);
        if (!r.ok) return null;
        const arr = await r.json();
        const top = Array.isArray(arr) && arr.length ? arr[0] : null;
        if (top) cacheSet(k, top);
        return top;
      } catch (_) { return null; }
    },
  };

  // ============================================================
  // INFLUENCERS — corpus written by scripts/influencers/corpus_builder.py
  // Browser fetches the cached JSON via /api/influencer-content (or static).
  // ============================================================
  const Influencers = {
    async _loadAll() {
      // v2 — old cache could be missing places_mentioned[].lat/lon (added 2026-06)
      const k = 'infl:all:v2';
      const cached = cacheGet(k);
      if (cached) return cached;
      // Try proxy first, fall back to static file
      let payload = null;
      try {
        const r = await fetch(`${API_BASE}/influencer-content`);
        if (r.ok) payload = await r.json();
      } catch (_) { /* try static */ }
      if (!payload) {
        try {
          const r = await fetch('/_shared/data/influencer-content.json');
          if (r.ok) payload = await r.json();
        } catch (_) { /* nothing */ }
      }
      if (!payload) payload = { items: [], stats: { total: 0 } };
      cacheSet(k, payload);
      return payload;
    },

    /**
     * Top N items mentioning `destinationName` (case-insensitive match against
     * `destinations[].name`). Sorted by topical_match + recency desc.
     */
    async forDestination(destinationName, limit = 8) {
      const payload = await this._loadAll();
      const items = (payload.items || []).filter((it) =>
        (it.destinations || []).some((d) => (d.name || '').toLowerCase() === destinationName.toLowerCase()));
      items.sort((a, b) => {
        const sa = (a.score_components?.topical_match || 0) + (a.score_components?.recency || 0);
        const sb = (b.score_components?.topical_match || 0) + (b.score_components?.recency || 0);
        return sb - sa;
      });
      return items.slice(0, limit);
    },

    /** Count of distinct creators that mention this destination — for hub-page badges. */
    async creatorCount(destinationName) {
      const items = await this.forDestination(destinationName, 200);
      return new Set(items.map((it) => it.creator).filter(Boolean)).size;
    },

    /** Place-level lookup. Returns first quote we have about a specific named place. */
    async quoteForPlace(placeName) {
      const payload = await this._loadAll();
      for (const it of payload.items || []) {
        for (const p of it.places_mentioned || []) {
          if ((p.name || '').toLowerCase() === placeName.toLowerCase() && p.quote) {
            return { creator: it.creator, url: it.url, source: it.source, quote: p.quote, sentiment: p.sentiment };
          }
        }
      }
      return null;
    },
  };

  // ============================================================
  // CURATOR'S PICKS — synthesis-{slug}.json written by synthesizer.py
  // Combines influencer mentions + TripAdvisor ratings into 4 buckets:
  // must_do / must_eat / must_buy / unique_experience.
  // ============================================================
  function _slug(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  const CuratorsPicks = {
    async forDestination(destinationName) {
      const slug = _slug(destinationName);
      const k = `cp:${slug}`;
      const cached = cacheGet(k);
      if (cached) return cached;
      try {
        const r = await fetch(`/_shared/data/synthesis-${slug}.json`);
        if (!r.ok) return null;
        const j = await r.json();
        cacheSet(k, j);
        return j;
      } catch (_) { return null; }
    },
  };

  // ============================================================
  // EXPORT
  // ============================================================
  global.YatraData = { Weather, Restaurants, Currency, Places, Holidays, Flights, Hotels, GoogleLocal, TripAdvisor, Influencers, CuratorsPicks, probeProxy };
})(window);
