/**
 * WeatherScope - Free Live City Cameras
 * =========================================================================
 * The "is it raining there *right now*" layer that a forecast cannot give you.
 * For every city the app displays, this engine answers one question: is there a
 * free public camera near that city, and which frame should we show?
 *
 * Design notes
 * ------------
 *  * **No API key, no build step.** The camera directory is queried over plain
 *    CORS-enabled HTTPS, exactly like the Open-Meteo calls the app already makes.
 *  * **Pure.** Like advice.js / glance.js / compare.js, this file touches no DOM,
 *    no network and no clock of its own: the controller injects `fetchJson`, and
 *    the clock is passed in. That is what keeps it unit-testable in plain Node.
 *  * **Honest about absence.** Plenty of cities have no free public camera. That
 *    is a normal answer, not an error, and the engine returns `null` rather than
 *    a placeholder frame.
 *
 * Loading contract: plain classic script (no build step). It publishes
 * `window.WeatherScopeCameras`, and also supports `module.exports` for the tests.
 */

(function (root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root) root.WeatherScopeCameras = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ==========================================================================
  // The camera directory
  // ==========================================================================
  /**
   * Datumfeed publishes an index of *verified* public cameras - government
   * traffic and transit feeds whose terms allow redistribution - together with
   * the licence and attribution each registry requires. It needs no key to
   * browse, answers `Access-Control-Allow-Origin: *`, and takes a bounding box,
   * so one request covers any city in the app whether or not it is covered: an
   * uncovered area is an empty list, not an error.
   */
  const DIRECTORY_ENDPOINT = 'https://datumfeed.com/api/cameras';

  /** Half-width of the search box around a city, in degrees (~28km of latitude). */
  const BBOX_RADIUS_DEG = 0.25;

  /**
   * `minTrust` floor. The directory publishes cameras it has never polled with a
   * `null` score; those are excluded rather than treated as zero, so asking for
   * a floor is how we get "has been seen working" instead of "is listed".
   */
  const MIN_TRUST = 20;

  /** How many candidates to pull before ranking them by distance. */
  const CANDIDATE_LIMIT = 8;

  /**
   * Fallback refresh cadence when a registry does not publish one. Snapshot
   * feeds are polled rather than streamed, so this is deliberately unhurried.
   */
  const DEFAULT_POLL_SECONDS = 60;

  /** The directory rate-limits anonymous browsing; stop before it throttles us. */
  const MIN_REMAINING_BUDGET = 2;

  const EARTH_RADIUS_KM = 6371;

  // ==========================================================================
  // Geography
  // ==========================================================================

  /** `minLon,minLat,maxLon,maxLat` around a point, clamped to the globe. */
  function bboxFor(latitude, longitude, radiusDeg) {
    const radius = typeof radiusDeg === 'number' && radiusDeg > 0 ? radiusDeg : BBOX_RADIUS_DEG;
    const lat = clamp(Number(latitude), -90, 90);
    const lon = clamp(Number(longitude), -180, 180);
    const latPad = Math.min(radius, 90 - Math.abs(lat));
    const lonPad = Math.min(radius, 180 - Math.abs(lon));
    return [
      round(lon - lonPad),
      round(lat - latPad),
      round(lon + lonPad),
      round(lat + latPad),
    ].join(',');
  }

  /** Great-circle distance in kilometres. */
  function haversineKm(a, b) {
    const lat1 = toRad(Number(a.latitude !== undefined ? a.latitude : a.lat));
    const lat2 = toRad(Number(b.latitude !== undefined ? b.latitude : b.lat));
    const lon1 = toRad(Number(a.longitude !== undefined ? a.longitude : a.lon));
    const lon2 = toRad(Number(b.longitude !== undefined ? b.longitude : b.lon));
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // ==========================================================================
  // Normalising a directory response
  // ==========================================================================
  /**
   * One camera, reduced to exactly what the card renders. Anything the
   * directory sends that we do not understand is dropped rather than passed
   * through, because every field here ends up in the DOM.
   */
  function normalizeCamera(raw, options) {
    const settings = options || {};
    if (!raw || typeof raw !== 'object') return null;

    const lat = numberOrNull(raw.lat);
    const lon = numberOrNull(raw.lon);
    const imageUrl = safeUrl(raw.feedUrl);
    if (imageUrl === null || lat === null || lon === null) return null;

    const registry = raw.registry && typeof raw.registry === 'object' ? raw.registry : {};
    const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    const pollSeconds = positiveInt(settings.pollSecondsByRegistry && settings.pollSecondsByRegistry[registry.slug]) ||
      positiveInt(registry.minPollIntervalS) ||
      DEFAULT_POLL_SECONDS;

    return {
      id: text(raw.id),
      name: text(raw.name) || text(registry.name),
      latitude: lat,
      longitude: lon,
      imageUrl,
      pollSeconds,
      source: text(registry.name),
      attribution: text(registry.attribution),
      attributionUrl: safeUrl(registry.licenseUrl),
      trustScore: numberOrNull(stats.trustScore),
    };
  }

  /**
   * Turn a directory payload into ranked candidates.
   *
   * `verificationStatus: 'contradicted'` is dropped on purpose: the directory
   * flags cameras whose feed is not serving an image or whose coordinates do
   * not match the registry, and showing one of those in a weather card would be
   * worse than showing nothing.
   */
  function parseCameraResponse(body, options) {
    const settings = options || {};
    const cameras = body && Array.isArray(body.cameras) ? body.cameras : [];
    const normalized = [];
    cameras.forEach((raw) => {
      if (raw && raw.verificationStatus === 'contradicted') return;
      const camera = normalizeCamera(raw, settings);
      if (camera) normalized.push(camera);
    });
    return rankByDistance(normalized, settings.latitude, settings.longitude);
  }

  /** Nearest first. A camera without coordinates can never be ranked. */
  function rankByDistance(cameras, latitude, longitude) {
    if (!Array.isArray(cameras)) return [];
    const origin = { latitude, longitude };
    return cameras
      .filter((camera) => camera && typeof camera.latitude === 'number' && typeof camera.longitude === 'number')
      .map((camera) => ({ camera, km: haversineKm(camera, origin) }))
      .sort((a, b) => a.km - b.km)
      .map((entry) => Object.assign({}, entry.camera, { distanceKm: Math.round(entry.km * 10) / 10 }));
  }

  /**
   * The camera to show for a city: the closest one, or null when the city has
   * no free public camera. `null` is a first-class answer - the card then says
   * so instead of pretending.
   */
  function pickCamera(cameras) {
    if (!Array.isArray(cameras) || cameras.length === 0) return null;
    return cameras[0] || null;
  }

  // ==========================================================================
  // Rate limiting
  // ==========================================================================
  /**
   * Remaining anonymous requests, or null when the header was not exposed.
   * The directory publishes it through `Access-Control-Expose-Headers`, so a
   * browser can read it and stop asking before it gets throttled.
   */
  function remainingBudget(headers) {
    if (!headers) return null;
    const raw = typeof headers.get === 'function' ? headers.get('x-ratelimit-remaining') : headers['x-ratelimit-remaining'];
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  /** True once the anonymous budget is too thin to keep asking. */
  function isBudgetExhausted(remaining) {
    return typeof remaining === 'number' && remaining <= MIN_REMAINING_BUDGET;
  }

  // ==========================================================================
  // Frame URLs
  // ==========================================================================
  /**
   * Snapshot feeds are polled, not streamed, so the same URL has to be asked for
   * again to see a new frame - but no more often than the registry asks for, so
   * the cache-buster is only added once the cadence has elapsed.
   */
  function frameUrl(camera, nowMs, options) {
    if (!camera || typeof camera.imageUrl !== 'string') return '';
    const settings = options || {};
    const now = typeof nowMs === 'number' ? nowMs : 0;
    const cadenceMs = Math.max(1, positiveInt(camera.pollSeconds) || DEFAULT_POLL_SECONDS) * 1000;
    const base = String(settings.frameBase || '');
    if (!base || now - base < cadenceMs) return camera.imageUrl;
    return appendBust(camera.imageUrl, now);
  }

  function appendBust(url, stamp) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'ws=' + stamp;
  }

  // ==========================================================================
  // Caching
  // ==========================================================================
  /** Session-scoped cache key. Cameras change every minute, so nothing persists. */
  function cacheKey(cityId) {
    return 'weatherscope_city_camera_' + String(cityId || '');
  }

  // ==========================================================================
  // Controller-facing API
  // ==========================================================================
  /**
   * Ask the directory for the cameras around a city.
   *
   * `fetchJson` is injected so the engine owns no network code of its own;
   * `pollSecondsByRegistry` is the cached `/api/registries` map, which supplies
   * each source's own polite refresh cadence.
   */
  async function findCameras(city, options) {
    const settings = options || {};
    if (!city || typeof settings.fetchJson !== 'function') return [];
    const lat = numberOrNull(city.latitude);
    const lon = numberOrNull(city.longitude);
    if (lat === null || lon === null) return [];

    const url = DIRECTORY_ENDPOINT +
      '?bbox=' + encodeURIComponent(bboxFor(lat, lon, settings.radiusDeg)) +
      '&limit=' + (positiveInt(settings.limit) || CANDIDATE_LIMIT) +
      '&minTrust=' + (positiveInt(settings.minTrust) || MIN_TRUST);

    let body;
    try {
      body = await settings.fetchJson(url);
    } catch (err) {
      return [];
    }
    if (!body) return [];

    const cameras = parseCameraResponse(body, {
      latitude: lat,
      longitude: lon,
      pollSecondsByRegistry: settings.pollSecondsByRegistry,
    });
    if (settings.onBudget) settings.onBudget(remainingBudget(settings.responseHeaders));
    return cameras;
  }

  // ==========================================================================
  // Small helpers (kept local so the engine needs nothing from the app)
  // ==========================================================================
  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function round(value) {
    return Math.round(value * 1e4) / 1e4;
  }

  function toRad(value) {
    return (Number.isFinite(value) ? value : 0) * (Math.PI / 180);
  }

  /**
   * A finite number, or null.
   *
   * Written out rather than left as `Number(value)` because of what that does
   * to the values a directory actually sends when it has nothing to report:
   * `Number(null)`, `Number('')`, `Number(false)` and `Number([])` are all 0, so
   * a camera with `"lat": null` would be placed at Null Island in the Gulf of
   * Guinea and ranked as though it were the nearest camera in the world.
   */
  function numberOrNull(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const number = Number(trimmed);
    return Number.isFinite(number) ? number : null;
  }

  function positiveInt(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  /**
   * Only http(s) survives. A camera feed is a third-party string that ends up
   * in an `src`, so `javascript:` and `data:` must never reach it.
   */
  function safeUrl(value) {
    const raw = text(value);
    if (!raw) return null;
    try {
      const parsed = new URL(raw, 'https://datumfeed.com/');
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.href;
    } catch (err) {
      return null;
    }
  }

  return {
    DIRECTORY_ENDPOINT,
    BBOX_RADIUS_DEG,
    MIN_TRUST,
    DEFAULT_POLL_SECONDS,
    MIN_REMAINING_BUDGET,
    bboxFor,
    haversineKm,
    normalizeCamera,
    parseCameraResponse,
    rankByDistance,
    pickCamera,
    remainingBudget,
    isBudgetExhausted,
    frameUrl,
    cacheKey,
    findCameras,
  };
});