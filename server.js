/**
 * WeatherScope server - static app + accounts and favorite cities
 * =========================================================================
 * The app itself is a plain static site and still runs by double-clicking
 * `index.html`. But a *saved city* is only worth anything if it follows the
 * person who saved it, and that needs somewhere to keep the account and the
 * list. This file is that somewhere, and it deliberately adds **no dependency**:
 * it is built from Node's own `http`, `crypto`, `fs` and `path`, so `node
 * server.js` is the whole install step.
 *
 * It serves two things:
 *
 *   * the static app (same files, same paths the PowerShell server served), and
 *   * a small JSON API under `/api/*`:
 *
 *       POST /api/auth/register  { username, password } -> { token, user, favorites }
 *       POST /api/auth/login     { username, password } -> { token, user, favorites }
 *       POST /api/auth/logout                           -> { ok }
 *       GET  /api/auth/me                               -> { user, favorites }
 *       GET  /api/favorites                             -> { favorites }
 *       PUT  /api/favorites      { favorites: [...] }   -> { favorites }
 *       GET  /api/alerts                                -> { alerts }
 *       PUT  /api/alerts         { alerts: [...] }      -> { alerts }
 *       GET  /api/profile                               -> { profile }
 *       PUT  /api/profile        { profile: {...} }     -> { profile }
 *
 * Security, in the order it matters:
 *
 *   * **Passwords are never stored.** Each account keeps a random 16-byte salt
 *     and a scrypt-derived 64-byte key; verification is a `timingSafeEqual`
 *     against a freshly derived key, so a stolen `users.json` is not a stolen
 *     password list.
 *   * **No cookies, so no CSRF.** The session token travels in an
 *     `Authorization: Bearer` header and is only ever read from there - a form
 *     on another site cannot set it, and the API sends no CORS allowance.
 *   * **The body is bounded and parsed, never executed.** Requests are capped
 *     at 64 KB, the JSON is parsed inside a `try`, and every field is then run
 *     through the *same* `favorites.js` engine the browser uses.
 *   * **Login is rate-limited per IP** so a weak password cannot be brute-forced
 *     at request speed, and an unknown username still costs a scrypt call so
 *     the response time never says whether an account exists.
 *   * **The static half stays inside the app directory.** A resolved path that
 *     escapes it, or that reaches into `data/`, is a 404.
 *
 * Sessions live in memory and expire (30 days by default), so restarting the
 * server signs everyone out - but no account or favorite is ever lost, because
 * those live in `data/users.json`, written atomically.
 *
 * Running it:  `node server.js`   (env: PORT, HOST, WEATHERSCOPE_DATA)
 */

'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const Favorites = require('./favorites.js');
const Alerts = require('./alerts.js');

// ==========================================================================
// Constants
// ==========================================================================
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '127.0.0.1';
const MAX_BODY_BYTES = 64 * 1024;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** 10 credential attempts per IP per 15 minutes unless configured otherwise. */
const DEFAULT_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 10 };

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// ==========================================================================
// Password hashing
// ==========================================================================

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scrypt(password, salt);
  return { salt: salt.toString('hex'), hash: derived.toString('hex') };
}

/** Constant-time comparison, and a guaranteed-false answer for a bad record. */
async function verifyPassword(password, salt, hash) {
  if (typeof salt !== 'string' || typeof hash !== 'string') return false;

  let saltBuffer;
  let expected;
  try {
    saltBuffer = Buffer.from(salt, 'hex');
    expected = Buffer.from(hash, 'hex');
  } catch (err) {
    return false;
  }
  if (saltBuffer.length === 0 || expected.length !== SCRYPT_KEYLEN) return false;

  const derived = await scrypt(password, saltBuffer);
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

// ==========================================================================
// The user store - `data/users.json`, written atomically
// ==========================================================================

function emptyStore() {
  return { version: 1, users: {} };
}

/**
 * Loads the accounts file, quarantining a corrupt one rather than silently
 * overwriting it - a parse error must never cost anyone their data.
 */
function loadStore(filePath, log) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return emptyStore();
  }

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.users !== 'object' || parsed.users === null) {
      throw new Error('unexpected shape');
    }
    return { version: 1, users: parsed.users };
  } catch (err) {
    const quarantine = filePath + '.corrupt-' + Date.now();
    try {
      fs.renameSync(filePath, quarantine);
      log('users.json could not be parsed; moved to ' + quarantine);
    } catch (renameErr) {
      log('users.json could not be parsed and could not be moved: ' + renameErr.message);
    }
    return emptyStore();
  }
}

function createStore(dataDir, log) {
  fs.mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, 'users.json');
  const store = loadStore(filePath, log);

  // Writes are serialized so two concurrent registrations cannot interleave a
  // read-modify-write and lose one another's account.
  let queue = Promise.resolve();

  function persist() {
    queue = queue.then(() => new Promise((resolve) => {
      const tmp = filePath + '.' + process.pid + '.tmp';
      const payload = JSON.stringify(store, null, 2);
      fs.writeFile(tmp, payload, (writeErr) => {
        if (writeErr) {
          log('Failed to write users.json: ' + writeErr.message);
          resolve();
          return;
        }
        fs.rename(tmp, filePath, (renameErr) => {
          if (renameErr) log('Failed to commit users.json: ' + renameErr.message);
          resolve();
        });
      });
    }));
    return queue;
  }

  /** Usernames are case-insensitive; the first spelling is kept for display. */
  function find(username) {
    if (typeof username !== 'string') return null;
    const key = username.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(store.users, key) ? store.users[key] : null;
  }

  async function create(username, password) {
    const key = username.trim().toLowerCase();
    const { salt, hash } = await hashPassword(password);
    const record = {
      username: username,
      salt: salt,
      hash: hash,
      createdAt: Date.now(),
      favorites: [],
      alerts: [],
      profile: Favorites.defaultProfile(),
    };
    store.users[key] = record;
    await persist();
    return record;
  }

  async function setFavorites(record, favorites) {
    record.favorites = favorites;
    await persist();
    return record.favorites;
  }

  async function setAlerts(record, alerts) {
    record.alerts = alerts;
    await persist();
    return record.alerts;
  }

  async function setProfile(record, profile) {
    record.profile = profile;
    await persist();
    return record.profile;
  }

  return {
    find: find,
    create: create,
    setFavorites: setFavorites,
    setAlerts: setAlerts,
    setProfile: setProfile,
    persist: persist,
  };
}

// ==========================================================================
// Sessions - in memory, expiring, dropped on restart
// ==========================================================================

function createSessions(ttlMs) {
  const byToken = new Map();

  function prune(now) {
    byToken.forEach((session, token) => {
      if (session.expiresAt <= now) byToken.delete(token);
    });
  }

  return {
    issue(username) {
      const token = crypto.randomBytes(32).toString('hex');
      byToken.set(token, { username: username, expiresAt: Date.now() + ttlMs });
      return token;
    },
    get(token) {
      if (typeof token !== 'string' || !token) return null;
      const session = byToken.get(token);
      if (!session) return null;
      if (session.expiresAt <= Date.now()) {
        byToken.delete(token);
        return null;
      }
      return session;
    },
    revoke(token) {
      byToken.delete(token);
    },
    prune: prune,
  };
}

// ==========================================================================
// Rate limiting
// ==========================================================================

function createRateLimiter(config) {
  if (config === false) {
    return { check: () => true, retryAfter: () => 0 };
  }
  const settings = Object.assign({}, DEFAULT_RATE_LIMIT, config || {});
  const hits = new Map();

  return {
    check(ip) {
      const now = Date.now();
      const entry = hits.get(ip);
      if (!entry || entry.resetAt <= now) {
        hits.set(ip, { count: 1, resetAt: now + settings.windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= settings.max;
    },
    retryAfter(ip) {
      const entry = hits.get(ip);
      if (!entry) return 0;
      return Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 1000));
    },
  };
}

// ==========================================================================
// Request helpers
// ==========================================================================

function sendJson(res, status, payload, extraHeaders) {
  const body = JSON.stringify(payload);
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }, extraHeaders || {});
  res.writeHead(status, headers);
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    // A declared length over the limit is refused before a single byte is read.
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      reject(Object.assign(new Error('payload too large'), { code: 'too-large' }));
      return;
    }

    const chunks = [];
    let size = 0;
    let done = false;

    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limit) {
        done = true;
        // Pause rather than destroy, so the 400 we are about to send can
        // actually reach the client instead of being reset with the socket.
        req.pause();
        reject(Object.assign(new Error('payload too large'), { code: 'too-large' }));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', (err) => {
      if (done) return;
      done = true;
      reject(err);
    });
  });
}

async function readJson(req) {
  const text = await readBody(req, MAX_BODY_BYTES);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    throw Object.assign(new Error('invalid json'), { code: 'bad-json' });
  }
}

function bearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : '';
}

function clientIp(req) {
  // The server binds to a local interface by default, so the socket address is
  // the honest answer; a forwarded header is deliberately not trusted here.
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// ==========================================================================
// Static file serving
// ==========================================================================

function serveStatic(req, res, staticDir, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request');
    return;
  }

  if (decoded === '/' || decoded === '') decoded = '/index.html';

  const relative = decoded.replace(/^\/+/, '');
  const resolved = path.resolve(staticDir, relative);
  const root = path.resolve(staticDir);

  // Traversal, absolute escapes, and the accounts file are all refused before
  // the filesystem is touched.
  const insideRoot = resolved === root || resolved.startsWith(root + path.sep);
  const blocked = relative.split(/[\\/]/).some((part) => part === 'data' || part === 'node_modules' || part.startsWith('.'));
  if (!insideRoot || blocked) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  fs.stat(resolved, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const type = CONTENT_TYPES[path.extname(resolved).toLowerCase()] || 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      'Content-Length': stats.size,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };
    // The app is edited in place, so no long-lived cache: a reload must show
    // the current file rather than yesterday's script.
    headers['Cache-Control'] = 'no-cache';

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(resolved).pipe(res);
  });
}

// ==========================================================================
// The API
// ==========================================================================

function createApiHandler(config) {
  const store = config.store;
  const sessions = config.sessions;
  const limiter = config.limiter;
  const log = config.log;

  function publicUser(record) {
    return { username: record.username, createdAt: record.createdAt || 0 };
  }

  function authenticate(req) {
    const token = bearerToken(req);
    const session = sessions.get(token);
    if (!session) return null;
    const record = store.find(session.username);
    if (!record) return null;
    return { token: token, record: record };
  }

  return async function handleApi(req, res, urlPath) {
    const method = req.method || 'GET';

    if (urlPath === '/api/health' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        service: 'weatherscope',
        favorites: Favorites.MAX_FAVORITES,
        alerts: Alerts.MAX_ALERTS,
        contacts: Favorites.MAX_CONTACTS,
      });
      return true;
    }

    // --- Register ----------------------------------------------------------
    if (urlPath === '/api/auth/register') {
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, code: 'method-not-allowed' });
        return true;
      }
      if (!limiter.check(clientIp(req))) {
        sendJson(res, 429, { ok: false, code: 'rate-limited' }, { 'Retry-After': String(limiter.retryAfter(clientIp(req))) });
        return true;
      }

      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        sendJson(res, 400, { ok: false, code: 'invalid' });
        return true;
      }

      const credentials = Favorites.validateCredentials(body);
      if (!credentials.valid) {
        sendJson(res, 400, { ok: false, code: credentials.reason });
        return true;
      }

      if (store.find(credentials.username)) {
        sendJson(res, 409, { ok: false, code: 'username-taken' });
        return true;
      }

      const record = await store.create(credentials.username, credentials.password);
      const token = sessions.issue(record.username);
      log('Registered account ' + record.username);
      sendJson(res, 201, {
        ok: true,
        token: token,
        user: publicUser(record),
        favorites: Favorites.sanitizeFavorites(record.favorites),
        alerts: Alerts.sanitizeAlerts(record.alerts),
        profile: Favorites.sanitizeProfile(record.profile),
      });
      return true;
    }

    // --- Login -------------------------------------------------------------
    if (urlPath === '/api/auth/login') {
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, code: 'method-not-allowed' });
        return true;
      }
      if (!limiter.check(clientIp(req))) {
        sendJson(res, 429, { ok: false, code: 'rate-limited' }, { 'Retry-After': String(limiter.retryAfter(clientIp(req))) });
        return true;
      }

      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        sendJson(res, 400, { ok: false, code: 'invalid' });
        return true;
      }

      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const record = store.find(username);

      // Always spend a scrypt call, and always with a real salt, so a missing
      // account and a wrong password take the same time to answer.
      const salt = record ? record.salt : crypto.randomBytes(SALT_BYTES).toString('hex');
      const hash = record ? record.hash : crypto.randomBytes(SCRYPT_KEYLEN).toString('hex');
      const ok = await verifyPassword(password, salt, hash);

      if (!record || !ok) {
        sendJson(res, 401, { ok: false, code: 'invalid-credentials' });
        return true;
      }

      const token = sessions.issue(record.username);
      sendJson(res, 200, {
        ok: true,
        token: token,
        user: publicUser(record),
        favorites: Favorites.sanitizeFavorites(record.favorites),
        alerts: Alerts.sanitizeAlerts(record.alerts),
        profile: Favorites.sanitizeProfile(record.profile),
      });
      return true;
    }

    // --- Logout ------------------------------------------------------------
    if (urlPath === '/api/auth/logout') {
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, code: 'method-not-allowed' });
        return true;
      }
      sessions.revoke(bearerToken(req));
      sendJson(res, 200, { ok: true });
      return true;
    }

    // --- The email-notification profile -----------------------------------
    if (urlPath === '/api/profile') {
      const auth = authenticate(req);
      if (!auth) {
        sendJson(res, 401, { ok: false, code: 'unauthorized' });
        return true;
      }

      if (method === 'GET') {
        sendJson(res, 200, { ok: true, profile: Favorites.sanitizeProfile(auth.record.profile) });
        return true;
      }

      if (method === 'PUT') {
        let body;
        try {
          body = await readJson(req);
        } catch (err) {
          sendJson(res, 400, { ok: false, code: 'invalid' });
          return true;
        }
        // Unlike favorites and alerts, a profile is a single object, so a stray
        // array or scalar is refused outright rather than coerced.
        if (!body || typeof body.profile !== 'object' || body.profile === null || Array.isArray(body.profile)) {
          sendJson(res, 400, { ok: false, code: 'invalid' });
          return true;
        }
        const saved = await store.setProfile(auth.record, Favorites.sanitizeProfile(body.profile));
        sendJson(res, 200, { ok: true, profile: saved });
        return true;
      }

      sendJson(res, 405, { ok: false, code: 'method-not-allowed' });
      return true;
    }

    // --- Identity, favorites and alerts require a live session -------------
    if (urlPath === '/api/auth/me' || urlPath === '/api/favorites' || urlPath === '/api/alerts') {
      const auth = authenticate(req);

      if (urlPath === '/api/auth/me') {
        if (method !== 'GET') {
          sendJson(res, 405, { ok: false, code: 'method-not-allowed' });
          return true;
        }
        if (!auth) {
          sendJson(res, 401, { ok: false, code: 'unauthorized' });
          return true;
        }
        sendJson(res, 200, {
          ok: true,
          user: publicUser(auth.record),
          favorites: Favorites.sanitizeFavorites(auth.record.favorites),
          alerts: Alerts.sanitizeAlerts(auth.record.alerts),
          profile: Favorites.sanitizeProfile(auth.record.profile),
        });
        return true;
      }

      // /api/favorites and /api/alerts are the same shape: a whole collection
      // the client replaces in one PUT, validated by its own engine.
      const collection = urlPath === '/api/alerts' ? 'alerts' : 'favorites';
      const sanitize = urlPath === '/api/alerts' ? Alerts.sanitizeAlerts : Favorites.sanitizeFavorites;
      const save = urlPath === '/api/alerts' ? store.setAlerts : store.setFavorites;

      if (method === 'GET') {
        if (!auth) {
          sendJson(res, 401, { ok: false, code: 'unauthorized' });
          return true;
        }
        const payload = { ok: true };
        payload[collection] = sanitize(auth.record[collection]);
        sendJson(res, 200, payload);
        return true;
      }

      if (method === 'PUT') {
        if (!auth) {
          sendJson(res, 401, { ok: false, code: 'unauthorized' });
          return true;
        }
        let body;
        try {
          body = await readJson(req);
        } catch (err) {
          sendJson(res, 400, { ok: false, code: 'invalid' });
          return true;
        }
        if (!Array.isArray(body[collection])) {
          sendJson(res, 400, { ok: false, code: 'invalid' });
          return true;
        }
        const saved = await save(auth.record, sanitize(body[collection]));
        const payload = { ok: true };
        payload[collection] = saved;
        sendJson(res, 200, payload);
        return true;
      }

      sendJson(res, 405, { ok: false, code: 'method-not-allowed' });
      return true;
    }

    // Any other /api path is a JSON 404 rather than a static file.
    sendJson(res, 404, { ok: false, code: 'not-found' });
    return true;
  };
}

// ==========================================================================
// The server
// ==========================================================================

function createWeatherScopeServer(options) {
  const opts = options || {};
  const staticDir = path.resolve(opts.staticDir || __dirname);
  const dataDir = path.resolve(opts.dataDir || process.env.WEATHERSCOPE_DATA || path.join(staticDir, 'data'));
  const log = typeof opts.log === 'function' ? opts.log : () => {};

  const store = createStore(dataDir, log);
  const sessions = createSessions(Number.isFinite(opts.sessionTtlMs) ? opts.sessionTtlMs : SESSION_TTL_MS);
  const limiter = createRateLimiter(opts.rateLimit !== undefined ? opts.rateLimit : true);
  const handleApi = createApiHandler({ store: store, sessions: sessions, limiter: limiter, log: log });

  const server = http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = new URL(req.url || '/', 'http://localhost').pathname;
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('400 Bad Request');
      return;
    }

    // The browser sends a same-origin request, so no CORS allowance is offered
    // and cross-site `fetch` of the API fails closed.
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (urlPath === '/api' || urlPath.startsWith('/api/')) {
      handleApi(req, res, urlPath).catch((err) => {
        log('API error: ' + (err && err.stack ? err.stack : err));
        if (!res.headersSent) sendJson(res, 500, { ok: false, code: 'server' });
        else res.end();
      });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('405 Method Not Allowed');
      return;
    }

    serveStatic(req, res, staticDir, urlPath);
  });

  server.on('listening', () => {
    const timer = setInterval(() => sessions.prune(Date.now()), 60 * 60 * 1000);
    if (typeof timer.unref === 'function') timer.unref();
  });

  // Exposed for tests and for a caller that wants to inspect the store.
  server.weatherscope = { staticDir: staticDir, dataDir: dataDir, store: store };
  return server;
}

function startServer(options) {
  const opts = options || {};
  const port = Number.isFinite(opts.port) ? opts.port : Number(process.env.PORT) || DEFAULT_PORT;
  const host = opts.host || process.env.HOST || DEFAULT_HOST;
  const log = typeof opts.log === 'function' ? opts.log : console.log;

  const server = createWeatherScopeServer(Object.assign({}, opts, { log: log }));
  server.listen(port, host, () => {
    const address = server.address();
    const actual = address && typeof address === 'object' ? address.port : port;
    log('==========================================');
    log(' WeatherScope server running');
    log(` http://${host}:${actual}/`);
    log(' Accounts & favorites: enabled');
    log(' Press Ctrl+C to stop.');
    log('==========================================');
  });
  return server;
}

module.exports = {
  createWeatherScopeServer: createWeatherScopeServer,
  startServer: startServer,
  hashPassword: hashPassword,
  verifyPassword: verifyPassword,
  MAX_BODY_BYTES: MAX_BODY_BYTES,
  SESSION_TTL_MS: SESSION_TTL_MS,
};

if (require.main === module) {
  startServer({});
}
