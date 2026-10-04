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
   * The directory's coverage index.
   *
   * `GET /api/registries` answers with every registry *and the exact city names
   * that registry covers*, without downloading a single camera. That makes it
   * the discovery half of the API: one request turns "we have no idea where the
   * cameras are" into a list of places worth asking about, which is what the
   * camera browser is built from. It is the same response the app already reads
   * for refresh cadences, so the catalogue costs no extra request.
   */
  const REGISTRIES_ENDPOINT = 'https://datumfeed.com/api/registries';

  /**
   * The directory's frame endpoint, passed through unmodified from the source.
   *
   * This is the single most useful thing the API publishes and the reason a
   * wall of cameras is worth building at all:
   *
   *  * **CORS is solved on every camera.** Most sources do not send
   *    `Access-Control-Allow-Origin`, which makes their pixels unreadable from a
   *    browser no matter what the app does. The endpoint does.
   *  * **The source's own cadence is applied server-side.** Frames are cached
   *    per camera for `registry.minPollIntervalS` and served with a matching
   *    `Cache-Control: max-age`, so a grid of live frames costs the sources
   *    nothing extra and the browser refreshes them on its own. No timer, no
   *    polling loop, no rate-limit arithmetic in the app.
   *  * **A dead source degrades instead of erroring**: if the upstream is down
   *    but an older frame is cached, the older frame is served.
   *
   * `proxyOk` is a *legal* field, not a technical one: a registry that does not
   * permit server-side proxying answers 403 here, so `frameUrl` is asked per
   * registry rather than assumed. Today all seven allow it, and that is checked
   * rather than trusted.
   */
  const FRAME_ENDPOINT = 'https://datumfeed.com/api/cameras';

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
   * How many cameras a wall shows at once.
   *
   * A wall is a picture, not a directory: past a dozen the tiles stop being
   * countable and the frames start costing the browser more than the answer is
   * worth.
   */
  const REGION_CANDIDATE_LIMIT = 12;

  /**
   * How many the `?city=` request actually asks for, which is more than the wall
   * shows.
   *
   * `verificationStatus: 'contradicted'` cameras are dropped *after* the page is
   * read, so asking for exactly as many as are displayed hands back a half-empty
   * wall on any registry where a decent share are flagged - Austin returns 8 of
   * 12 asked for. Over-fetching costs nothing: it is the same single request,
   * far under the directory's 500-per-page ceiling.
   */
  const REGION_FETCH_LIMIT = 30;

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
      proxyOk: registry.proxyOk === true ? true : (registry.proxyOk === false ? false : null),
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
  // Coverage discovery
  // ==========================================================================
  /**
   * Words the directory itself uses for a covered place, and which the app has
   * no other name for.
   *
   * The registry index names its cities as slugs (`bay area`), and a slug is not
   * something to hand a visitor. Mapping only the ones the directory chose *not*
   * to spell out keeps the rule simple: anything not listed here is simply a
   * lower-cased slug turned back into title case, which is exactly right for
   * `san francisco`, `toronto` and `washington`.
   */
  const REGION_TITLES = {
    'bay area': 'Bay Area',
    austin: 'Austin',
    california: 'California',
    london: 'London',
    ontario: 'Ontario',
    ottawa: 'Ottawa',
    toronto: 'Toronto',
    washington: 'Washington',
  };

  /** Two-letter country code -> the flag the browser can render without a request. */
  const COUNTRY_FLAGS = {
    CA: '\u{1F1E8}\u{1F1E6}',
    GB: '\u{1F1EC}\u{1F1E7}',
    US: '\u{1F1FA}\u{1F1F8}',
  };

  /**
   * The directory's slug for a place, as `?city=` wants it.
   *
   * Matching on the directory's side is case-, space- and punctuation-insensitive,
   * so slugging to lowercase-with-hyphens is a faithful round trip and never
   * guesses: a name it does not recognise comes back as a 400 that names the
   * cities it does cover.
   */
  function regionQuery(slug) {
    const raw = text(slug).toLowerCase();
    if (!raw) return '';
    return raw.replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  /** A place's slug as something a visitor can read. */
  function regionTitle(slug) {
    const query = regionQuery(slug);
    if (!query) return '';
    return REGION_TITLES[query] || query
      .split('-')
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }

  /**
   * The catalogue of every city the directory covers, one entry per city.
   *
   * Built from `GET /api/registries`, so it is the whole world of free public
   * cameras in one request and costs nothing per city. A city is listed under
   * the registry that publishes it, which is also the licence whose attribution
   * has to travel with any frame from it - so the two are kept together rather
   * than looked up later.
   *
   * `count` is deliberately *absent*. The index publishes a camera count per
   * registry, not per city, so showing a registry's total on one of its cities
   * would be a number about somewhere else. The exact count is asked for when a
   * city is actually opened.
   */
  function catalogRegions(registriesBody) {
    if (!Array.isArray(registriesBody)) return [];
    const catalog = [];
    const seen = new Set();

    registriesBody.forEach((registry) => {
      if (!registry || typeof registry !== 'object') return;
      const registrySlug = text(registry.slug);
      const regionSlug = regionQuery(registry.city);
      if (!registrySlug || !regionSlug) return;

      const attribution = text(registry.attribution);
      const attributionUrl = safeUrl(registry.licenseUrl);
      const cities = Array.isArray(registry.cities) ? registry.cities : [];

      cities.forEach((citySlug) => {
        const query = regionQuery(citySlug);
        // One entry per physical place. Ontario 511 and the City of Toronto both
        // publish the Gardiner/DVP sites, so without this the same city appears
        // twice under two licences.
        if (!query || seen.has(query)) return;
        seen.add(query);

        catalog.push({
          query,
          name: regionTitle(citySlug),
          registry: registrySlug,
          registryName: text(registry.name) || registrySlug,
          country: text(registry.country).toUpperCase(),
          flag: COUNTRY_FLAGS[text(registry.country).toUpperCase()] || '',
          attribution,
          attributionUrl,
          pollSeconds: positiveInt(registry.minPollIntervalS) || DEFAULT_POLL_SECONDS,
        });
      });
    });

    return catalog;
  }

  /**
   * The cities that belong to one registry, for rendering them as a group.
   *
   * Grouping is the honest shape here: a city on its own says nothing about why
   * it has cameras and a visitor with a European city in mind should be able to
   * see, before clicking anything, that coverage is regional.
   */
  function groupRegionsByRegistry(catalog) {
    const groups = [];
    const bySlug = new Map();
    (Array.isArray(catalog) ? catalog : []).forEach((entry) => {
      if (!entry || !entry.registry) return;
      let group = bySlug.get(entry.registry);
      if (!group) {
        group = {
          registry: entry.registry,
          registryName: entry.registryName,
          country: entry.country,
          flag: entry.flag,
          attribution: entry.attribution,
          attributionUrl: entry.attributionUrl,
          cities: [],
        };
        bySlug.set(entry.registry, group);
        groups.push(group);
      }
      group.cities.push(entry);
    });
    return groups;
  }

  /**
   * Case- and accent-insensitive filter over the catalogue.
   *
   * Deliberately not diacritic-stripping through `normalize()`: the catalogue is
   * a list of places, and a visitor typing "sao" should find "Sacramento"
   * whether or not their keyboard produced an accent. Falls back to `indexOf`
   * so a substring match still works on a browser without `normalize`.
   */
  function filterRegions(catalog, query) {
    const list = Array.isArray(catalog) ? catalog : [];
    const raw = text(query);
    if (!raw) return list.slice();

    let needle = raw.toLowerCase();
    const canNormalize = typeof String.prototype.normalize === 'function';
    if (canNormalize) {
      try {
        needle = needle.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      } catch (err) {
        needle = raw.toLowerCase();
      }
    }

    return list.filter((entry) => {
      if (!entry) return false;
      const haystack = (entry.name + ' ' + entry.registryName).toLowerCase();
      if (haystack.indexOf(needle) !== -1) return true;
      if (!canNormalize) return false;
      try {
        return haystack.normalize('NFD').replace(/[\u0300-\u036f]/g, '').indexOf(needle) !== -1;
      } catch (err) {
        return false;
      }
    });
  }

  /**
   * The frame URL for a camera, through the directory.
   *
   * Preferred over the source's own `feedUrl` for every reason above: CORS
   * solved, the source's cadence applied for us, and a stale frame served rather
   * than an error when the source is down. Returns null when the camera has no
   * usable id, which is the only case where the raw feed URL is the better
   * answer - see `imageSource`.
   */
  function frameProxyUrl(camera) {
    const id = camera && typeof camera === 'object' ? text(camera.id) : text(camera);
    if (!id) return null;
    return FRAME_ENDPOINT + '/' + encodeURIComponent(id) + '/frame';
  }

  /**
   * Where a camera's picture should be drawn from.
   *
   * The proxy first, because it is strictly the better source; the raw feed URL
   * only as the fallback for a camera the directory will not proxy - which is
   * legal (`proxyOk: false`) rather than technical, so it can change without
   * anything breaking. `null` means neither, and the card says so instead of
   * showing a broken frame.
   */
  function imageSource(camera) {
    if (!camera) return null;
    if (camera.proxyOk === false) return safeUrl(camera.imageUrl);
    const proxied = frameProxyUrl(camera);
    if (proxied) return proxied;
    return safeUrl(camera.imageUrl);
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

  /**
   * The cameras of one *catalogued* city.
   *
   * The same engine as `findCameras`, asked a different way. `findCameras` has
   * to guess a bounding box around a point, which is the only thing it can do
   * for an arbitrary city - and a box drawn around Paris finds nothing, because
   * Paris genuinely has nothing. This asks the directory to resolve a place it
   * *knows*, which is what makes the camera browser work at all: the catalogue
   * says where the cameras are, and this says which ones.
   *
   * Ranking is by the directory's own order rather than by distance, because a
   * `?city=` answer is not centred on anything the app asked for - there is no
   * point to measure from. The wall shows several at once, so "nearest to what"
   * would be a fiction.
   */
  async function findRegionCameras(citySlug, options) {
    const settings = options || {};
    const query = regionQuery(citySlug);
    if (!query || typeof settings.fetchJson !== 'function') return [];

    const url = DIRECTORY_ENDPOINT +
      '?city=' + encodeURIComponent(query) +
      '&limit=' + (positiveInt(settings.limit) || REGION_FETCH_LIMIT) +
      '&minTrust=' + (positiveInt(settings.minTrust) || MIN_TRUST);

    let body;
    try {
      body = await settings.fetchJson(url);
    } catch (err) {
      // A 400 here means the catalogue and the directory have drifted apart -
      // the city was withdrawn. It is reported, never cached as "none", so the
      // next visit picks up the corrected index.
      if (settings.onFailure) settings.onFailure(err);
      return [];
    }
    if (!body) {
      if (settings.onFailure) settings.onFailure(new Error('Camera directory returned no payload'));
      return [];
    }

    const rawCameras = body && Array.isArray(body.cameras) ? body.cameras : [];
    const cameras = rawCameras.reduce((list, raw) => {
      if (raw && raw.verificationStatus === 'contradicted') return list;
      const camera = normalizeCamera(raw, { pollSecondsByRegistry: settings.pollSecondsByRegistry });
      if (camera) list.push(camera);
      return list;
    }, []);
    if (settings.onBudget) settings.onBudget(remainingBudget(settings.responseHeaders));
    if (settings.onResolved) settings.onResolved(body.resolved);
    return cameras.slice(0, REGION_CANDIDATE_LIMIT);
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
    REGISTRIES_ENDPOINT,
    FRAME_ENDPOINT,
    REGION_TITLES,
    COUNTRY_FLAGS,
    BBOX_RADIUS_DEG,
    MIN_TRUST,
    CANDIDATE_LIMIT,
    REGION_CANDIDATE_LIMIT,
    REGION_FETCH_LIMIT,
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
    findRegionCameras,
    regionQuery,
    regionTitle,
    catalogRegions,
    groupRegionsByRegistry,
    filterRegions,
    frameProxyUrl,
    imageSource,
  };
});
