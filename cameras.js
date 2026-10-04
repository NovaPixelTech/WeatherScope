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

  /**
   * Half-width of the search box around a city, in degrees (~55km of latitude).
   *
   * Deliberately a whole neighbourhood rather than a single block: public
   * cameras cluster where the traffic and the weather are - ports, mountain
   * passes, ring roads - so a tight box around a city centre very often comes
   * back empty while a camera is genuinely "in" the city a few kilometres out.
   */
  const BBOX_RADIUS_DEG = 0.5;

  /**
   * `minTrust` floor. The directory publishes cameras it has never polled with a
   * `null` score; those are excluded rather than treated as zero, so asking for
   * a floor is how we get "has been seen working" instead of "is listed". The
   * floor is low on purpose - a camera that has been polled a handful of times
   * is still a camera, and refusing to show it costs the visitor the only view
   * of their city.
   */
  const MIN_TRUST = 10;

  /** How many candidates to pull before ranking them by distance. */
  const CANDIDATE_LIMIT = 12;

  /**
   * Fallback refresh cadence when a registry does not publish one. Snapshot
   * feeds are polled rather than streamed, so this is deliberately unhurried.
   */
  const DEFAULT_POLL_SECONDS = 60;

  /**
   * A camera that publishes a *stream* is preferred over an equally close
   * snapshot-only camera, but only within this distance. Past it the snapshot
   * wins: watching a harbour 40km away is not "the weather in this city", while
   * a still of the nearest junction still is.
   */
  const STREAM_PREFERENCE_KM = 25;

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
   *
   * A camera can publish two very different things and the card renders them
   * differently:
   *
   *  * **a stream** - `multipart/x-mixed-replace` (MJPEG), HLS or a plain file.
   *    These are *video*: the browser keeps receiving frames, so the view moves.
   *  * **a snapshot** - one still, re-fetched on a timer. Honest, but stills.
   *
   * Both are kept. `kind` says which one this is, `streamUrl` is the playable
   * one when it exists, and `imageUrl` is a URL that can be drawn in an `<img>`
   * - for an MJPEG camera that is the stream itself, which is exactly how MJPEG
   * is played. An HLS or file camera may have no still at all, and then
   * `imageUrl` is null and the feed is played in a `<video>` instead.
   */
  function normalizeCamera(raw, options) {
    const settings = options || {};
    if (!raw || typeof raw !== 'object') return null;

    const lat = numberOrNull(raw.lat);
    const lon = numberOrNull(raw.lon);
    const registry = raw.registry && typeof raw.registry === 'object' ? raw.registry : {};
    const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};

    const streamUrl = firstSafeUrl(raw, ['streamUrl', 'videoUrl', 'mjpegUrl', 'hlsUrl', 'stream']);
    const kind = streamKind(raw, streamUrl);
    // A stream camera needs no separate still: for MJPEG the stream *is* the
    // image source, and for an HLS/file stream `imageUrl` is only the poster
    // still, which a source is allowed not to publish.
    const imageUrl = kind === 'mjpeg'
      ? streamUrl
      : safeUrl(raw.feedUrl);

    // Something has to be drawable. An HLS or file camera may carry only a
    // stream (its poster is optional), and an MJPEG camera is nothing but its
    // stream, so a camera without either is not a camera we can render.
    if (!imageUrl && (kind === 'snapshot' || kind === 'mjpeg')) return null;
    if (lat === null || lon === null) return null;

    const pollSeconds = positiveInt(settings.pollSecondsByRegistry && settings.pollSecondsByRegistry[registry.slug]) ||
      positiveInt(registry.minPollIntervalS) ||
      DEFAULT_POLL_SECONDS;

    return {
      id: text(raw.id),
      name: text(raw.name) || text(registry.name),
      latitude: lat,
      longitude: lon,
      imageUrl,
      kind,
      streamUrl,
      pollSeconds,
      source: text(registry.name),
      attribution: text(registry.attribution),
      attributionUrl: safeUrl(registry.licenseUrl),
      trustScore: numberOrNull(stats.trustScore),
    };
  }

  /**
   * What kind of feed this is.
   *
   * The directory names its stream fields in more than one way across versions,
   * so the decision is made from the URL and the advertised content type rather
   * than from one field name: a `.m3u8` is HLS, a `.mp4`/`.webm` is a file,
   * `multipart/x-mixed-replace` is MJPEG, and anything else on a stream field
   * is treated as MJPEG because that is what plays in an `<img>`.
   */
  function streamKind(raw, streamUrl) {
    if (!streamUrl) return 'snapshot';
    const contentType = text(raw.streamContentType || raw.contentType || raw.mimeType).toLowerCase();
    if (contentType.indexOf('mpegurl') !== -1 || /\.m3u8(\?|$)/i.test(streamUrl)) return 'hls';
    if (/\.(mp4|webm|ogv|mov)(\?|$)/i.test(streamUrl)) return 'file';
    if (contentType.indexOf('mp4') !== -1 || contentType.indexOf('webm') !== -1) return 'file';
    if (text(raw.streamProtocol).toLowerCase() === 'hls') return 'hls';
    return 'mjpeg';
  }

  /** The first field of these names that is a usable http(s) URL. */
  function firstSafeUrl(raw, names) {
    for (let i = 0; i < names.length; i += 1) {
      const url = safeUrl(raw[names[i]]);
      if (url) return url;
    }
    return null;
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

  /**
   * What the card shows first.
   *
   * Nearest wins, with one exception that answers the request the feature was
   * built for: a camera that publishes a *stream* beats an equally close
   * snapshot-only camera, because a stream is actually moving. The exception is
   * capped at `STREAM_PREFERENCE_KM` so "nearest" still means "nearest".
   */
  function bestCamera(cameras) {
    const nearest = pickCamera(cameras);
    if (!nearest || !Array.isArray(cameras)) return nearest;
    if (isStream(nearest)) return nearest;

    for (let i = 1; i < cameras.length; i += 1) {
      const camera = cameras[i];
      if (!camera || !isStream(camera)) continue;
      if (typeof camera.distanceKm !== 'number' || camera.distanceKm > STREAM_PREFERENCE_KM) continue;
      return camera;
    }
    return nearest;
  }

  /** True when this camera can play as video rather than as a polled still. */
  function isStream(camera) {
    return Boolean(camera) && camera.kind !== 'snapshot' && typeof camera.streamUrl === 'string' && camera.streamUrl !== '';
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
   *
   * `frameBase` is *when the frame currently on screen was shown*, not when the
   * refresh is being requested. Passing "now" here is what makes a polled frame
   * sit there frozen: the elapsed time is always zero, the cache-buster is never
   * added, and the browser is handed the identical URL it already has.
   */
  function frameUrl(camera, nowMs, options) {
    if (!camera || typeof camera.imageUrl !== 'string') return '';
    const settings = options || {};
    const now = typeof nowMs === 'number' ? nowMs : 0;
    // A stream URL is a live connection, not a document. Adding a cache-buster
    // to one would tear the connection down and ask the source to open another,
    // which is the opposite of what a stream does by itself - so a stream's
    // image source is never busted, however long ago it was shown.
    if (isStream(camera)) return camera.imageUrl;
    const cadenceMs = frameCadenceMs(camera);
    const base = Number(settings.frameBase || 0);
    if (!base || !Number.isFinite(base) || now - base < cadenceMs) return camera.imageUrl;
    return appendBust(camera.imageUrl, now);
  }

  /**
   * The URL for the next frame, unconditionally fresh.
   *
   * This is what the poller uses: by the time it fires, the cadence has already
   * elapsed, so the question "should this be a new frame?" is answered. Asking
   * `frameUrl` with a base of "now" is what froze the panel before.
   */
  function nextFrameUrl(camera, nowMs) {
    if (!camera || typeof camera.imageUrl !== 'string') return '';
    // Same rule as `frameUrl`: a stream is left exactly as it was published.
    if (isStream(camera)) return camera.imageUrl;
    return appendBust(camera.imageUrl, typeof nowMs === 'number' ? nowMs : 0);
  }

  /**
   * How long this source wants to be left alone between frames.
   *
   * The floor is 15s whatever a registry publishes: a source asking to be polled
   * every second is either broken or about to be blocked, and neither is worth a
   * visitor's ban.
   */
  function frameCadenceMs(camera) {
    const seconds = camera && Number.isFinite(camera.pollSeconds) && camera.pollSeconds > 0
      ? camera.pollSeconds
      : DEFAULT_POLL_SECONDS;
    return Math.max(15, seconds) * 1000;
  }

  /**
   * True when the frame on screen is still inside its cadence.
   *
   * This is the "is there anything to do?" half of the polling question, kept
   * beside `frameUrl` so the cadence rule lives in one place: a card that is
   * re-rendered - sorted, filtered, switched language - must reuse the frame it
   * is already showing rather than ask the source for it again.
   *
   * A stream is never stale: the browser is holding it open and refreshing it.
   */
  function frameIsCurrent(camera, nowMs, options) {
    if (!camera || typeof camera.imageUrl !== 'string') return false;
    if (isStream(camera)) return true;
    const base = Number((options || {}).frameBase || 0);
    // No timestamp means nothing is known to be on screen, so nothing can be
    // reused - which is exactly what keeps a released panel from being handed a
    // URL the browser still has cached.
    if (!base || !Number.isFinite(base)) return false;
    const now = typeof nowMs === 'number' ? nowMs : 0;
    return now - base < frameCadenceMs(camera);
  }

  /**
   * The last stamp handed out for each frame URL.
   *
   * Millisecond resolution is not quite enough: two refreshes inside the same
   * millisecond - a throttled tab catching up, a timer that fires twice before
   * the clock has ticked - would produce the identical URL, and the browser would
   * answer the second one from the cache it just filled. The stamp only ever
   * moves forward, so every poll is a URL the browser has not seen.
   */
  const lastBustByUrl = new Map();

  function appendBust(url, stamp) {
    const previous = lastBustByUrl.get(url) || 0;
    const next = typeof stamp === 'number' && stamp > previous ? stamp : previous + 1;
    lastBustByUrl.set(url, next);
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'ws=' + next;
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
   *
   * A failed request still returns an empty list - to a visitor, "we could not
   * ask" and "there is nothing there" must look the same - but it is *reported*
   * through `onFailure`. That distinction matters to the controller: an empty
   * answer is worth caching for the session, a failed one is not, and caching a
   * throttle as "no camera here" is how a city ends up falsely claiming to have
   * no public camera for the rest of the visit.
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
      if (settings.onFailure) settings.onFailure(err);
      return [];
    }
    if (!body) {
      if (settings.onFailure) settings.onFailure(new Error('Camera directory returned no payload'));
      return [];
    }

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
    STREAM_PREFERENCE_KM,
    MIN_REMAINING_BUDGET,
    bboxFor,
    haversineKm,
    normalizeCamera,
    parseCameraResponse,
    rankByDistance,
    pickCamera,
    bestCamera,
    isStream,
    streamKind,
    remainingBudget,
    isBudgetExhausted,
    frameUrl,
    frameIsCurrent,
    nextFrameUrl,
    cacheKey,
    findCameras,
  };
});