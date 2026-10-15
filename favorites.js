/**
 * WeatherScope Favorites - accounts and saved cities
 * =========================================================================
 * A saved city is only worth anything if it follows the person who saved it,
 * so favorites live behind a real account instead of in one browser's
 * `localStorage`. This module is the one place that knows the shape of that
 * data, and it is deliberately split in two halves:
 *
 *  * **A pure half** - `normalizeCity`, `sanitizeFavorites`, `addFavorite`,
 *    `removeFavorite`, `validateUsername`, `validatePassword`. No DOM, no
 *    network, no clock, no storage. `server.js` requires this same file, so the
 *    browser and the server validate a favorited city with *the same rules* -
 *    a value the client would reject can never be stored, and a value the
 *    server would reject can never be painted.
 *  * **A thin request half** - `createClient({ fetchFn, baseUrl })`. `fetch` is
 *    injected rather than reached for, which is what keeps the API contract
 *    testable in plain Node and lets the app degrade to "accounts unavailable"
 *    when there is no server to talk to at all.
 *
 * Design rules (mirroring `share.js` / `glance.js`):
 *
 *  * **Never trusted.** Coordinates are finite and in range, a name is
 *    required, control characters are dropped, a timezone must look like an
 *    IANA id, and the list is de-duplicated by coordinate and capped. Anything
 *    off the wire can only ever fail closed.
 *  * **Coordinates are the identity.** The same city picked twice from two
 *    different search results ("Paris, France" via autocomplete vs. via GPS)
 *    collapses to one entry, exactly like the share links that travel with it.
 *  * **Missing is not zero.** `Number(null)` is `0`, so an absent coordinate is
 *    rejected rather than coerced into the Gulf of Guinea.
 *
 * Loading contract: plain classic script (no build step). It publishes
 * `window.WeatherScopeFavorites`, and also supports `module.exports` so the
 * server and the tests can use the very same engine.
 */

(function (root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root) root.WeatherScopeFavorites = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ==========================================================================
  // Limits - the single place these are defined, for the client and the server
  // ==========================================================================
  const MAX_FAVORITES = 24;
  const COORD_PRECISION = 4;
  const MAX_NAME_LENGTH = 120;
  const MAX_TIMEZONE_LENGTH = 64;

  const USERNAME_MIN = 3;
  const USERNAME_MAX = 32;
  const PASSWORD_MIN = 8;
  const PASSWORD_MAX = 200;

  /** Letters/digits at both ends, an inner core that may also hold `_ . -`. */
  const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$/;

  /** IANA zone ids: `Europe/Paris`, `America/Argentina/Buenos_Aires`, `Etc/GMT+5`. */
  const TIMEZONE_PATTERN = /^[A-Za-z0-9_+\/-]{1,64}$/;

  /** Errors the request half can raise, as codes the UI can translate. */
  const ERROR_CODES = [
    'usernameRequired',
    'usernameLength',
    'usernameCharset',
    'passwordRequired',
    'passwordTooShort',
    'passwordTooLong',
    'invalid-credentials',
    'username-taken',
    'unauthorized',
    'invalid',
    'rate-limited',
    'server',
    'network',
    'unavailable',
  ];

  const KNOWN_ERROR_CODES = {};
  ERROR_CODES.forEach((code) => {
    KNOWN_ERROR_CODES[code] = true;
  });

  // ==========================================================================
  // Small helpers
  // ==========================================================================

  /** Trimmed text with no control characters - or '' when it cannot be a name. */
  function cleanText(value, maxLength) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (maxLength && trimmed.length > maxLength) return '';
    // A control character or newline is a mangled paste or an attempted
    // smuggling; neither is a city name, a region or a username.
    return /[\u0000-\u001f\u007f]/.test(trimmed) ? '' : trimmed;
  }

  function roundCoord(value) {
    return Number(value.toFixed(COORD_PRECISION));
  }

  /** Finite degree within `limit`, or null. Never NaN, never Infinity. */
  function toCoord(raw, limit) {
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    if (value < -limit || value > limit) return null;
    return roundCoord(value);
  }

  /** A coordinate only identifies a place as a pair: a lone latitude is not one. */
  function coordPair(latitude, longitude) {
    const lat = toCoord(latitude, 90);
    const lon = toCoord(longitude, 180);
    if (lat === null || lon === null) return { latitude: null, longitude: null };
    return { latitude: lat, longitude: lon };
  }

  function pick(object, primary, alternate) {
    if (!object) return undefined;
    return object[primary] !== undefined ? object[primary] : object[alternate];
  }

  // ==========================================================================
  // Cities
  // ==========================================================================

  /**
   * A city reduced to the fields the app needs to fetch its forecast again:
   * the name to show, the point to fetch, and the zone so its clocks are right.
   * Returns null when the value could not be a city - which is the answer the
   * caller must handle, because a favorites list containing a bad entry is
   * worse than one that quietly drops it.
   */
  function normalizeCity(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const name = cleanText(pick(raw, 'name', 'city'), MAX_NAME_LENGTH);
    if (!name) return null;

    const coords = coordPair(pick(raw, 'latitude', 'lat'), pick(raw, 'longitude', 'lon'));
    if (coords.latitude === null) return null;

    const city = { name: name, latitude: coords.latitude, longitude: coords.longitude };

    const region = cleanText(pick(raw, 'admin1', 'region'), MAX_NAME_LENGTH);
    if (region) city.admin1 = region;

    const country = cleanText(raw.country, MAX_NAME_LENGTH);
    if (country) city.country = country;

    const timezone = cleanText(pick(raw, 'timezone', 'tz'), MAX_TIMEZONE_LENGTH);
    if (timezone && TIMEZONE_PATTERN.test(timezone)) city.timezone = timezone;

    return city;
  }

  /**
   * The identity of a city: its coordinates at four decimals. Names are
   * ambiguous (there is a Paris in France and a Paris in Texas), coordinates
   * are not.
   */
  function cityKey(city) {
    const normalized = normalizeCity(city);
    if (!normalized) return '';
    return normalized.latitude + ',' + normalized.longitude;
  }

  /** "Paris, France" - region only added when it says something new. */
  function describeCity(city) {
    const normalized = normalizeCity(city);
    if (!normalized) return '';

    const parts = [normalized.name];
    const region = normalized.admin1;
    if (region && region.toLowerCase() !== normalized.name.toLowerCase()) parts.push(region);
    const country = normalized.country;
    if (country && country.toLowerCase() !== normalized.name.toLowerCase()) parts.push(country);

    return parts.join(', ');
  }

  /**
   * The list as it is allowed to exist: every entry a real city, no duplicates,
   * no more than `MAX_FAVORITES`. Used on everything that arrives from storage,
   * from the network, or from the visitor.
   */
  function sanitizeFavorites(raw) {
    if (!Array.isArray(raw)) return [];

    const seen = {};
    const out = [];

    for (let i = 0; i < raw.length; i += 1) {
      if (out.length >= MAX_FAVORITES) break;
      const city = normalizeCity(raw[i]);
      if (!city) continue;
      const key = cityKey(city);
      if (!key || seen[key]) continue;
      seen[key] = true;
      out.push(city);
    }

    return out;
  }

  function findFavorite(list, target) {
    const key = typeof target === 'string' ? target : cityKey(target);
    if (!key) return null;
    const cities = sanitizeFavorites(list);
    for (let i = 0; i < cities.length; i += 1) {
      if (cityKey(cities[i]) === key) return cities[i];
    }
    return null;
  }

  function isFavorite(list, city) {
    return findFavorite(list, city) !== null;
  }

  /**
   * Adds a city to the list. Returns the (possibly unchanged) list plus why:
   * `ok`, `duplicate`, `full` or `invalid`. Nothing is ever thrown, because
   * every one of those is a normal answer for a "save this city" button.
   */
  function addFavorite(list, city) {
    const cities = sanitizeFavorites(list);
    const normalized = normalizeCity(city);
    if (!normalized) return { list: cities, changed: false, reason: 'invalid' };

    const key = cityKey(normalized);
    if (findFavorite(cities, key)) return { list: cities, changed: false, reason: 'duplicate' };
    if (cities.length >= MAX_FAVORITES) return { list: cities, changed: false, reason: 'full' };

    return { list: cities.concat([normalized]), changed: true, reason: 'ok' };
  }

  /** Removes a city by object or by key. */
  function removeFavorite(list, target) {
    const cities = sanitizeFavorites(list);
    const key = typeof target === 'string' ? target : cityKey(target);
    if (!key) return { list: cities, changed: false, reason: 'invalid' };

    const next = cities.filter((city) => cityKey(city) !== key);
    if (next.length === cities.length) return { list: cities, changed: false, reason: 'missing' };
    return { list: next, changed: true, reason: 'ok' };
  }

  // ==========================================================================
  // Credentials
  // ==========================================================================

  function validateUsername(raw) {
    const username = typeof raw === 'string' ? raw.trim() : '';
    if (!username) return { valid: false, reason: 'usernameRequired', username: '' };
    if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
      return { valid: false, reason: 'usernameLength', username: username };
    }
    if (!USERNAME_PATTERN.test(username)) {
      return { valid: false, reason: 'usernameCharset', username: username };
    }
    return { valid: true, reason: '', username: username };
  }

  function validatePassword(raw) {
    if (typeof raw !== 'string' || !raw) {
      return { valid: false, reason: 'passwordRequired', password: '' };
    }
    if (raw.length < PASSWORD_MIN) {
      return { valid: false, reason: 'passwordTooShort', password: raw };
    }
    if (raw.length > PASSWORD_MAX) {
      return { valid: false, reason: 'passwordTooLong', password: raw };
    }
    return { valid: true, reason: '', password: raw };
  }

  /** Both fields at once, so the first problem is reported exactly once. */
  function validateCredentials(payload) {
    const data = payload || {};
    const username = validateUsername(data.username);
    if (!username.valid) {
      return { valid: false, reason: username.reason, username: username.username, password: '' };
    }
    const password = validatePassword(data.password);
    if (!password.valid) {
      return { valid: false, reason: password.reason, username: username.username, password: '' };
    }
    return { valid: true, reason: '', username: username.username, password: password.password };
  }

  // ==========================================================================
  // The request half
  // ==========================================================================

  /** A failed request, carrying a translatable `code` and the HTTP status. */
  function FavoriteApiError(code, status, message) {
    const error = new Error(message || code);
    error.name = 'FavoriteApiError';
    error.code = KNOWN_ERROR_CODES[code] ? code : 'server';
    error.status = Number.isFinite(status) ? status : 0;
    return error;
  }

  /** Reads a code off anything that might be one of our errors. */
  function apiErrorCode(error) {
    if (error && typeof error.code === 'string' && KNOWN_ERROR_CODES[error.code]) return error.code;
    return 'server';
  }

  function asString(value) {
    return typeof value === 'string' ? value : '';
  }

  function mapStatus(status, payload) {
    const code = payload && typeof payload.code === 'string' && KNOWN_ERROR_CODES[payload.code]
      ? payload.code
      : '';
    if (status === 400) return code && code !== 'invalid' ? code : 'invalid';
    if (status === 401) return code || 'invalid-credentials';
    if (status === 403) return 'unauthorized';
    // 404/405/501 for a route this client always calls means the request never
    // reached the WeatherScope API - a plain static host (or an SPA fallback)
    // answered instead. That is "no server here", not "the server broke".
    if (status === 404 || status === 405 || status === 501) return 'unavailable';
    if (status === 409) return 'username-taken';
    if (status === 429) return 'rate-limited';
    return 'server';
  }

  /**
   * Builds the API client. `fetchFn` is injected so this file stays pure and the
   * tests can drive it with a fake; `baseUrl` is empty (same origin) by default.
   */
  function createClient(options) {
    const opts = options || {};
    const fetchFn = opts.fetchFn;
    const baseUrl = typeof opts.baseUrl === 'string' ? opts.baseUrl.replace(/\/+$/, '') : '';
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? Math.max(0, opts.timeoutMs) : 12000;
    const AbortCtor = opts.AbortController !== undefined
      ? opts.AbortController
      : (typeof AbortController !== 'undefined' ? AbortController : null);
    // Timers are resolved defensively: the engine must load in a bare sandbox
    // (and on the server) where `setTimeout` need not be a global.
    const hasGlobalTimers = typeof setTimeout === 'function' && typeof clearTimeout === 'function';
    const schedule = typeof opts.setTimeout === 'function'
      ? opts.setTimeout
      : (hasGlobalTimers ? setTimeout : null);
    const unschedule = typeof opts.clearTimeout === 'function'
      ? opts.clearTimeout
      : (hasGlobalTimers ? clearTimeout : null);

    async function request(method, path, config) {
      const settings = config || {};
      if (typeof fetchFn !== 'function') {
        throw FavoriteApiError('unavailable', 0, 'No fetch available');
      }

      const headers = { Accept: 'application/json' };
      if (settings.body !== undefined) headers['Content-Type'] = 'application/json';
      if (settings.token) headers.Authorization = 'Bearer ' + settings.token;

      let controller = null;
      let timer = null;
      if (timeoutMs > 0 && AbortCtor && schedule && unschedule) {
        controller = new AbortCtor();
        timer = schedule(() => controller.abort(), timeoutMs);
      }

      let response;
      try {
        response = await fetchFn(baseUrl + path, {
          method: method,
          headers: headers,
          body: settings.body === undefined ? undefined : JSON.stringify(settings.body),
          signal: controller ? controller.signal : undefined,
        });
      } catch (err) {
        throw FavoriteApiError('network', 0, (err && err.message) || 'Network request failed');
      } finally {
        if (timer !== null) unschedule(timer);
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (err) {
        payload = null;
      }

      const status = Number.isFinite(response.status) ? response.status : 0;

      if (response.ok) {
        if (payload && payload.ok !== false) return payload;
        // A 2xx with no JSON envelope is not this API. The usual cause is a
        // static/SPA host replying with the HTML app shell, so report it as a
        // missing server rather than an opaque "server error".
        if (!payload) {
          throw FavoriteApiError('unavailable', status, 'Unexpected non-JSON response from the server');
        }
      }

      throw FavoriteApiError(
        mapStatus(status, payload),
        status,
        (payload && typeof payload.message === 'string' && payload.message) || ''
      );
    }

    function authPayload(payload, fallbackUsername) {
      const token = asString(payload && payload.token);
      const user = payload && payload.user ? payload.user : {};
      return {
        token: token,
        username: asString(user.username) || asString(payload && payload.username) || fallbackUsername,
        favorites: sanitizeFavorites(payload && payload.favorites),
      };
    }

    return {
      baseUrl: baseUrl,

      /** Creates an account and returns `{ token, username, favorites }`. */
      async register(username, password) {
        const credentials = validateCredentials({ username: username, password: password });
        if (!credentials.valid) throw FavoriteApiError(credentials.reason, 0, credentials.reason);
        const payload = await request('POST', '/api/auth/register', {
          body: { username: credentials.username, password: credentials.password },
        });
        return authPayload(payload, credentials.username);
      },

      /** Signs in and returns `{ token, username, favorites }`. */
      async login(username, password) {
        const credentials = validateCredentials({ username: username, password: password });
        if (!credentials.valid) throw FavoriteApiError(credentials.reason, 0, credentials.reason);
        const payload = await request('POST', '/api/auth/login', {
          body: { username: credentials.username, password: credentials.password },
        });
        return authPayload(payload, credentials.username);
      },

      /** Best-effort sign-out: a rejected or unreachable logout is not an error. */
      async logout(token) {
        if (!token) return;
        try {
          await request('POST', '/api/auth/logout', { token: token, body: {} });
        } catch (err) {
          // Signing out locally is what matters; the token is dropped regardless.
        }
      },

      /** The account a token belongs to, most importantly whether it is still valid. */
      async me(token) {
        const payload = await request('GET', '/api/auth/me', { token: token });
        const user = payload && payload.user ? payload.user : {};
        return {
          username: asString(user.username) || asString(payload && payload.username),
          favorites: sanitizeFavorites(payload && payload.favorites),
        };
      },

      /** The saved cities, sanitized before they are trusted. */
      async getFavorites(token) {
        const payload = await request('GET', '/api/favorites', { token: token });
        return sanitizeFavorites(payload && payload.favorites);
      },

      /** Replaces the saved cities with `favorites`, returning what was stored. */
      async saveFavorites(token, favorites) {
        const payload = await request('PUT', '/api/favorites', {
          token: token,
          body: { favorites: sanitizeFavorites(favorites) },
        });
        return sanitizeFavorites(payload && payload.favorites);
      },
    };
  }

  return {
    MAX_FAVORITES: MAX_FAVORITES,
    COORD_PRECISION: COORD_PRECISION,
    MAX_NAME_LENGTH: MAX_NAME_LENGTH,
    USERNAME_MIN: USERNAME_MIN,
    USERNAME_MAX: USERNAME_MAX,
    PASSWORD_MIN: PASSWORD_MIN,
    PASSWORD_MAX: PASSWORD_MAX,
    ERROR_CODES: ERROR_CODES.slice(),
    FavoriteApiError: FavoriteApiError,
    apiErrorCode: apiErrorCode,
    cleanText: cleanText,
    normalizeCity: normalizeCity,
    cityKey: cityKey,
    describeCity: describeCity,
    sanitizeFavorites: sanitizeFavorites,
    findFavorite: findFavorite,
    isFavorite: isFavorite,
    addFavorite: addFavorite,
    removeFavorite: removeFavorite,
    validateUsername: validateUsername,
    validatePassword: validatePassword,
    validateCredentials: validateCredentials,
    createClient: createClient,
  };
});
