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

  // The host object, reached from inside the factory too: the local account
  // store is the one place that needs `localStorage` and Web Crypto, and it is
  // resolved defensively so the module still loads in a bare sandbox.
  const globalObject = typeof globalThis !== 'undefined'
    ? globalThis
    : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null));

  // ==========================================================================
  // Limits - the single place these are defined, for the client and the server
  // ==========================================================================
  const MAX_FAVORITES = 24;
  const COORD_PRECISION = 4;
  const MAX_NAME_LENGTH = 120;
  const MAX_TIMEZONE_LENGTH = 64;

  // The email-notification profile. Addresses are stored as opaque strings and
  // only ever rendered with textContent; the cap keeps a hand-edited request
  // from turning an account into a mailing list.
  const MAX_CONTACTS = 10;
  const MAX_EMAIL_LENGTH = 254; // the practical RFC 5321 limit
  const MAX_CONTACT_NAME_LENGTH = 60;

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

  /**
   * A loose copy of an alert-rule list. `favorites.js` deliberately does not
   * validate a rule's shape - that is `alerts.js`'s job, on both the client and
   * the server - but it does bound the array so a hand-edited request cannot
   * ask to store an unbounded payload.
   */
  function asAlertList(value) {
    return Array.isArray(value) ? value.slice(0, 200) : [];
  }

  // ==========================================================================
  // The email-notification profile
  // ==========================================================================
  // An account may carry an address of its own and a short list of friends, so
  // that a triggered alert can *also* go out by email. Nothing here sends mail:
  // delivery needs the Node server running, which a static host cannot do, so
  // this half only keeps the addresses valid, bounded and de-duplicated. Address
  // syntax is checked pragmatically - reject typos, not the RFC - because the
  // value is only ever handed to a mailer as an opaque string.

  /** One `@`, a dotted domain, no spaces or runs of dots. `''` when unusable. */
  function normalizeEmail(raw) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || value.length > MAX_EMAIL_LENGTH) return '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '';
    if (value.indexOf('..') !== -1) return '';

    const at = value.indexOf('@');
    const local = value.slice(0, at);
    const domain = value.slice(at + 1);
    if (!local || local.charAt(0) === '.' || local.charAt(local.length - 1) === '.') return '';
    // A domain cannot start or end with a dot or a hyphen.
    if ('. -'.indexOf(domain.charAt(0)) !== -1) return '';
    if ('. -'.indexOf(domain.charAt(domain.length - 1)) !== -1) return '';
    return value;
  }

  /** True when `raw` is a usable address; the shape the account form checks. */
  function isValidEmail(raw) {
    return normalizeEmail(raw) !== '';
  }

  /** A friend: how to reach them, what to call them, and whether they are on. */
  function sanitizeContact(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const email = normalizeEmail(raw.email);
    if (!email) return null;
    return {
      name: cleanText(raw.name, MAX_CONTACT_NAME_LENGTH),
      email: email,
      enabled: raw.enabled !== false,
    };
  }

  /**
   * A bounded, de-duplicated friend list. Identity is the address (compared
   * case-insensitively), so the same person cannot be added twice with different
   * capitalisation, and the first spelling is kept for display.
   */
  function sanitizeContacts(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = {};
    const out = [];
    for (let i = 0; i < raw.length; i += 1) {
      const contact = sanitizeContact(raw[i]);
      if (!contact) continue;
      const key = contact.email.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push(contact);
      if (out.length >= MAX_CONTACTS) break;
    }
    return out;
  }

  /** A profile with nothing turned on - what a brand-new account starts with. */
  function defaultProfile() {
    return { emailEnabled: false, email: '', contacts: [] };
  }

  /** The whole profile, sanitized: `{ emailEnabled, email, contacts }`. */
  function sanitizeProfile(raw) {
    const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
      emailEnabled: data.emailEnabled === true,
      email: normalizeEmail(data.email),
      contacts: sanitizeContacts(data.contacts),
    };
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
        alerts: asAlertList(payload && payload.alerts),
        profile: sanitizeProfile(payload && payload.profile),
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
          alerts: asAlertList(payload && payload.alerts),
          profile: sanitizeProfile(payload && payload.profile),
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

      /** The account's alert rules; the alerts engine fixes their shape. */
      async getAlerts(token) {
        const payload = await request('GET', '/api/alerts', { token: token });
        return asAlertList(payload && payload.alerts);
      },

      /** Replaces the alert rules with `alerts`, returning what was stored. */
      async saveAlerts(token, alerts) {
        const payload = await request('PUT', '/api/alerts', {
          token: token,
          body: { alerts: asAlertList(alerts) },
        });
        return asAlertList(payload && payload.alerts);
      },

      /** The account's email-notification profile, sanitized. */
      async getProfile(token) {
        const payload = await request('GET', '/api/profile', { token: token });
        return sanitizeProfile(payload && payload.profile);
      },

      /** Replaces the profile with `profile`, returning what was stored. */
      async saveProfile(token, profile) {
        const payload = await request('PUT', '/api/profile', {
          token: token,
          body: { profile: sanitizeProfile(profile) },
        });
        return sanitizeProfile(payload && payload.profile);
      },
    };
  }

  // ==========================================================================
  // The local half - a same-browser account store
  // ==========================================================================
  // A static host (GitHub Pages, `file://`) can serve the whole app but can
  // never run `server.js`, so there is no `/api` to sign in against. Rather than
  // leave the account panel dead, the app falls back to this store: the same
  // username/password/favorites contract, kept in `localStorage` on the one
  // device. It is deliberately honest about being local - a password is salted
  // and hashed (PBKDF2 where Web Crypto exists) so a plaintext password is never
  // written, but it is *not* a security boundary: any script on the origin can
  // read `localStorage`. It exists so favorites still work offline of any server.

  /** The `localStorage` key the browser-only account store lives under. */
  const LOCAL_ACCOUNTS_KEY = 'weatherscope_accounts';

  /** Local sessions are told apart from server tokens by this prefix. */
  const LOCAL_SESSION_PREFIX = 'local:';

  /** True when `token` names a local (browser-only) session rather than a server one. */
  function isLocalToken(token) {
    return typeof token === 'string' && token.indexOf(LOCAL_SESSION_PREFIX) === 0;
  }

  function defaultLocalStorage() {
    try {
      const store = globalObject && globalObject.localStorage;
      if (store && typeof store.getItem === 'function' && typeof store.setItem === 'function') {
        return store;
      }
    } catch (err) {
      // Access throws in a sandboxed iframe or a locked-down browser: no store.
    }
    return null;
  }

  function toHex(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
      out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return out;
  }

  /** A salted fallback used only where Web Crypto is missing. Never plaintext. */
  function weakHash(text) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 + c, 2654435761) >>> 0;
    }
    return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }

  function subtleCrypto() {
    try {
      const c = globalObject && globalObject.crypto;
      if (c && c.subtle && typeof c.subtle.deriveBits === 'function' && typeof c.subtle.importKey === 'function') {
        return c.subtle;
      }
    } catch (err) {
      // Ignore and fall back to the weak hash.
    }
    return null;
  }

  /**
   * The default password hasher: PBKDF2-SHA256 (100k iterations) when Web Crypto
   * is present, else the salted fallback. Returns `{ hash, algo }` so a record
   * can be verified with the same method that produced it.
   */
  async function defaultHasher(password, salt, algo) {
    const subtle = algo === 'weak' ? null : subtleCrypto();
    const Encoder = globalObject && globalObject.TextEncoder;
    if (subtle && typeof Encoder === 'function') {
      const encoder = new Encoder();
      const key = await subtle.importKey('raw', encoder.encode(String(password)), { name: 'PBKDF2' }, false, ['deriveBits']);
      const bits = await subtle.deriveBits(
        { name: 'PBKDF2', salt: encoder.encode(String(salt)), iterations: 100000, hash: 'SHA-256' },
        key,
        256
      );
      return { hash: toHex(new Uint8Array(bits)), algo: 'pbkdf2' };
    }
    return { hash: weakHash(String(salt) + '\u0000' + String(password) + '\u0000' + String(salt)), algo: 'weak' };
  }

  function defaultSalt() {
    try {
      const c = globalObject && globalObject.crypto;
      if (c && typeof c.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        c.getRandomValues(bytes);
        return toHex(bytes);
      }
    } catch (err) {
      // Fall through to a time-based salt.
    }
    return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
  }

  /**
   * Builds the browser-only account client. It exposes exactly the methods the
   * API client does (`register`, `login`, `logout`, `me`, `getFavorites`,
   * `saveFavorites`), so the app can route to either one without caring which.
   * `storage`, `hasher`, `now` and `randomSalt` are injectable for tests.
   */
  function createLocalClient(options) {
    const opts = options || {};
    const storage = opts.storage !== undefined ? opts.storage : defaultLocalStorage();
    const accountsKey = asString(opts.accountsKey) || LOCAL_ACCOUNTS_KEY;
    const now = typeof opts.now === 'function' ? opts.now : function () { return Date.now(); };
    const randomSalt = typeof opts.randomSalt === 'function' ? opts.randomSalt : defaultSalt;
    const hasher = typeof opts.hasher === 'function' ? opts.hasher : defaultHasher;

    function readStore() {
      if (!storage || typeof storage.getItem !== 'function') return { v: 1, users: {} };
      let parsed = null;
      try {
        const raw = storage.getItem(accountsKey);
        if (raw) parsed = JSON.parse(raw);
      } catch (err) {
        parsed = null;
      }
      if (!parsed || typeof parsed !== 'object' || typeof parsed.users !== 'object' || parsed.users === null) {
        return { v: 1, users: {} };
      }
      return { v: 1, users: parsed.users };
    }

    function writeStore(store) {
      if (!storage || typeof storage.setItem !== 'function') {
        throw FavoriteApiError('unavailable', 0, 'No local storage is available');
      }
      store.v = 1;
      storage.setItem(accountsKey, JSON.stringify(store));
    }

    function keyOf(username) {
      return String(username).trim().toLowerCase();
    }

    function findUser(store, username) {
      const key = keyOf(username);
      return Object.prototype.hasOwnProperty.call(store.users, key) ? store.users[key] : null;
    }

    async function derive(password, salt, algo) {
      const result = await hasher(password, salt, algo);
      if (typeof result === 'string') return { hash: result, algo: algo || 'custom' };
      return {
        hash: asString(result && result.hash),
        algo: asString(result && result.algo) || algo || 'custom',
      };
    }

    /** The stored record a token names, or a thrown `unauthorized`. */
    function recordFor(token) {
      const store = readStore();
      const record = isLocalToken(token) ? findUser(store, token.slice(LOCAL_SESSION_PREFIX.length)) : null;
      if (!record) throw FavoriteApiError('unauthorized', 0, 'No local session');
      return { store: store, record: record };
    }

    return {
      isLocal: true,
      backend: 'local',
      // False when this browser refuses `localStorage` (private mode, a sandbox):
      // the client still exists, but no account can actually be kept.
      available: !!(storage
        && typeof storage.getItem === 'function'
        && typeof storage.setItem === 'function'
        && typeof storage.removeItem === 'function'),

      async register(username, password) {
        const credentials = validateCredentials({ username: username, password: password });
        if (!credentials.valid) throw FavoriteApiError(credentials.reason, 0, credentials.reason);
        const store = readStore();
        if (findUser(store, credentials.username)) {
          throw FavoriteApiError('username-taken', 0, 'That username is already taken on this device');
        }
        const salt = String(randomSalt());
        const derived = await derive(credentials.password, salt, undefined);
        const record = {
          username: credentials.username,
          salt: salt,
          hash: derived.hash,
          algo: derived.algo,
          createdAt: now(),
          favorites: [],
          alerts: [],
          profile: defaultProfile(),
        };
        store.users[keyOf(credentials.username)] = record;
        writeStore(store);
        return {
          token: LOCAL_SESSION_PREFIX + record.username,
          username: record.username,
          favorites: [],
          alerts: [],
          profile: defaultProfile(),
        };
      },

      async login(username, password) {
        const credentials = validateCredentials({ username: username, password: password });
        if (!credentials.valid) throw FavoriteApiError(credentials.reason, 0, credentials.reason);
        const record = findUser(readStore(), credentials.username);
        if (!record) throw FavoriteApiError('invalid-credentials', 0, 'No such account on this device');
        const derived = await derive(credentials.password, record.salt, record.algo);
        if (derived.hash !== record.hash) throw FavoriteApiError('invalid-credentials', 0, 'That password does not match');
        return {
          token: LOCAL_SESSION_PREFIX + record.username,
          username: record.username,
          favorites: sanitizeFavorites(record.favorites),
          alerts: asAlertList(record.alerts),
          profile: sanitizeProfile(record.profile),
        };
      },

      async logout() {
        // A local session lives only in the app's own storage key, which the
        // caller clears; there is nothing here to revoke.
      },

      async me(token) {
        const found = recordFor(token);
        return {
          username: found.record.username,
          favorites: sanitizeFavorites(found.record.favorites),
          alerts: asAlertList(found.record.alerts),
          profile: sanitizeProfile(found.record.profile),
        };
      },

      async getFavorites(token) {
        return sanitizeFavorites(recordFor(token).record.favorites);
      },

      async saveFavorites(token, favorites) {
        const found = recordFor(token);
        found.record.favorites = sanitizeFavorites(favorites);
        writeStore(found.store);
        return found.record.favorites;
      },

      async getAlerts(token) {
        return asAlertList(recordFor(token).record.alerts);
      },

      async saveAlerts(token, alerts) {
        const found = recordFor(token);
        found.record.alerts = asAlertList(alerts);
        writeStore(found.store);
        return found.record.alerts;
      },

      async getProfile(token) {
        return sanitizeProfile(recordFor(token).record.profile);
      },

      async saveProfile(token, profile) {
        const found = recordFor(token);
        found.record.profile = sanitizeProfile(profile);
        writeStore(found.store);
        return found.record.profile;
      },
    };
  }

  return {
    MAX_FAVORITES: MAX_FAVORITES,
    COORD_PRECISION: COORD_PRECISION,
    MAX_NAME_LENGTH: MAX_NAME_LENGTH,
    MAX_CONTACTS: MAX_CONTACTS,
    MAX_EMAIL_LENGTH: MAX_EMAIL_LENGTH,
    MAX_CONTACT_NAME_LENGTH: MAX_CONTACT_NAME_LENGTH,
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
    normalizeEmail: normalizeEmail,
    isValidEmail: isValidEmail,
    sanitizeContact: sanitizeContact,
    sanitizeContacts: sanitizeContacts,
    defaultProfile: defaultProfile,
    sanitizeProfile: sanitizeProfile,
    createClient: createClient,
    createLocalClient: createLocalClient,
    isLocalToken: isLocalToken,
    LOCAL_ACCOUNTS_KEY: LOCAL_ACCOUNTS_KEY,
    LOCAL_SESSION_PREFIX: LOCAL_SESSION_PREFIX,
  };
});
