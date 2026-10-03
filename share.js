/**
 * SkyCast Share Links - the deep-link encoder/decoder
 * =========================================================================
 * The share button used to hand out `window.location.href`: the same generic
 * address for every city, which told the recipient nothing. A shared forecast is
 * only useful if the link itself *is* the forecast, so the city, the cards worth
 * looking at, the unit and the assistant's rain window travel in the query
 * string and are re-applied when the link is opened:
 *
 *     index.html?city=Tokyo&region=Tokyo&country=Japan&lat=35.6762
 *                 &lon=139.6503&tz=Asia/Tokyo&cards=glance,hourly&unit=c
 *                 &window=morning
 *
 * Design rules this module deliberately follows (mirroring `glance.js`):
 *
 *  * **Pure and deterministic.** No DOM, no network, no clock, no storage. The
 *    same payload always yields the same link, so it is testable in plain Node
 *    (see `tests/share.test.js`) and the app cannot drift from the format.
 *  * **Readable, not encoded.** Plain readable parameters rather than an opaque
 *    base64 blob: the link survives being pasted through a chat app that mangles
 *    it, and a human can see which city it opens.
 *  * **Never trusted.** Every field is validated on the way in. Unknown card
 *    keys, a nonsense unit, a missing coordinate pair or a stray hash are
 *    dropped, and a URL that does not name a city is not a share link at all -
 *    so a hand-edited or hostile link can only ever fail closed.
 *
 * Loading contract: plain classic script (no build step). It publishes
 * `window.SkyCastShare`, and also supports `module.exports` for the tests.
 */

(function (root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root) root.SkyCastShare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ==========================================================================
  // The shareable surface - the one place the card vocabulary is defined
  // --------------------------------------------------------------------------
  // The order is the order the cards appear on the page, so a link always reads
  // top-to-bottom and the first entry is the card to scroll to.
  // ==========================================================================
  const CARD_KEYS = ['glance', 'hero', 'assistant', 'metrics', 'hourly', 'daily'];

  /** Human names for the banner and the share confirmation. */
  const CARD_LABELS = {
    glance: 'Today at a glance',
    hero: 'Current weather',
    assistant: "Today's advice",
    metrics: 'Key metrics',
    hourly: '24-hour forecast',
    daily: '7-day forecast',
  };

  /**
   * Coordinates are written at four decimal places: ~11 m, far finer than any
   * forecast grid, and short enough to keep the link readable.
   */
  const COORD_PRECISION = 4;

  /**
   * Only used to parse a relative href (a bare `index.html?...`) into something
   * `URLSearchParams` can read. It is never part of a link that gets shared:
   * `buildShareUrl` writes back whatever base it was handed.
   */
  const FALLBACK_BASE = 'http://localhost/';

  /** ==========================================================================
   * Small helpers - each one exists so the two directions cannot disagree
   * ====================================================================== */

  function cleanText(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    // A control character or a newline in a query value is either a mangled
    // paste or an attempt to smuggle something; neither is a city name.
    return /[\u0000-\u001f\u007f]/.test(trimmed) ? '' : trimmed;
  }

  function roundCoord(value) {
    return Number(value.toFixed(COORD_PRECISION));
  }

  /** Returns a finite number within `limit`, or null. Never NaN, never Infinity. */
  function toCoord(raw, limit) {
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    if (value < -limit || value > limit) return null;
    return roundCoord(value);
  }

  /** A coordinate is only usable as a pair: a lone latitude is not a place. */
  function coordPair(latitude, longitude) {
    const lat = toCoord(latitude, 90);
    const lon = toCoord(longitude, 180);
    if (lat === null || lon === null) return { latitude: null, longitude: null };
    return { latitude: lat, longitude: lon };
  }

  function splitList(raw) {
    return cleanText(raw)
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
  }

  function normalizeUnit(raw) {
    const unit = cleanText(raw).toLowerCase();
    if (unit === 'c' || unit === 'celsius') return 'c';
    if (unit === 'f' || unit === 'fahrenheit') return 'f';
    return '';
  }

  function toUrl(href) {
    try {
      return new URL(cleanText(href) || FALLBACK_BASE, FALLBACK_BASE);
    } catch (e) {
      return null;
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Keeps only known cards, de-duplicated, in page order. An empty or entirely
   * unrecognised list is returned as the full set rather than as "nothing",
   * because a link that opens the city is better than a link that opens nothing.
   */
  function sanitizeCards(cards) {
    if (!Array.isArray(cards)) return CARD_KEYS.slice();

    const wanted = new Set(
      cards
        .map((card) => cleanText(card).toLowerCase())
        .filter((card) => CARD_KEYS.indexOf(card) !== -1)
    );

    if (wanted.size === 0) return CARD_KEYS.slice();
    return CARD_KEYS.filter((key) => wanted.has(key));
  }

  /**
   * "Tokyo, Japan" - the name shown in the share title and the banner. Region is
   * only added when it actually adds something, so a city does not read
   * "Paris, Île-de-France, France" twice over.
   */
  function describePlace(place) {
    const data = place || {};
    const city = cleanText(data.city) || cleanText(data.name);
    if (!city) return '';

    const parts = [city];
    const region = cleanText(data.region) || cleanText(data.admin1);
    if (region && region.toLowerCase() !== city.toLowerCase()) parts.push(region);
    const country = cleanText(data.country);
    if (country && country.toLowerCase() !== city.toLowerCase()) parts.push(country);

    return parts.join(', ');
  }

  /** "Today at a glance, 24-hour forecast" - what the banner reads out. */
  function describeCards(cards) {
    const keys = sanitizeCards(cards);
    return keys.map((key) => CARD_LABELS[key]).join(', ');
  }

  /**
   * Builds the link that *is* the shared forecast. Returns '' when there is
   * nothing worth sharing (no city name), so the caller can refuse rather than
   * send the recipient to a generic page.
   */
  function buildShareUrl(baseHref, payload) {
    const data = payload || {};
    const city = cleanText(data.city) || cleanText(data.name);
    if (!city) return '';

    const url = toUrl(baseHref);
    if (!url) return '';

    // A re-share must not accumulate a previous link's parameters.
    url.search = '';
    url.hash = '';

    const coords = coordPair(data.latitude, data.longitude);
    const timezone = cleanText(data.timezone) || cleanText(data.tz);
    const cards = sanitizeCards(data.cards);
    const unit = normalizeUnit(data.unit);
    const windowKey = cleanText(data.windowKey || data.window);

    const params = new URLSearchParams();
    params.set('city', city);
    if (cleanText(data.region) || cleanText(data.admin1)) {
      params.set('region', cleanText(data.region) || cleanText(data.admin1));
    }
    if (cleanText(data.country)) params.set('country', cleanText(data.country));
    if (coords.latitude !== null) {
      params.set('lat', String(coords.latitude));
      params.set('lon', String(coords.longitude));
    }
    if (timezone) params.set('tz', timezone);
    params.set('cards', cards.join(','));
    if (unit) params.set('unit', unit);
    if (windowKey) params.set('window', windowKey);

    url.search = params.toString();
    return url.toString();
  }

  /**
   * Reads a shared link back into a payload, or null when the URL is not one -
   * i.e. when it does not name a city. Every field is validated here, so the
   * app never has to re-check what came off the wire.
   */
  function parseShareLink(href) {
    const url = toUrl(href);
    if (!url) return null;

    const params = url.searchParams;
    const city = cleanText(params.get('city'));
    if (!city) return null;

    const coords = coordPair(params.get('lat'), params.get('lon'));

    return {
      city: city,
      region: cleanText(params.get('region')),
      country: cleanText(params.get('country')),
      latitude: coords.latitude,
      longitude: coords.longitude,
      timezone: cleanText(params.get('tz')),
      cards: sanitizeCards(splitList(params.get('cards'))),
      unit: normalizeUnit(params.get('unit')),
      windowKey: cleanText(params.get('window')),
    };
  }

  /** Cheap guard for boot: is this URL a shared forecast at all? */
  function isShareLink(href) {
    return parseShareLink(href) !== null;
  }

  return {
    CARD_KEYS: CARD_KEYS.slice(),
    CARD_LABELS: CARD_LABELS,
    COORD_PRECISION: COORD_PRECISION,
    sanitizeCards: sanitizeCards,
    describePlace: describePlace,
    describeCards: describeCards,
    buildShareUrl: buildShareUrl,
    parseShareLink: parseShareLink,
    isShareLink: isShareLink,
  };
});