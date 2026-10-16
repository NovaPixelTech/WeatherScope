'use strict';
/**
 * WeatherScope server - accounts & favorites API tests
 * =========================================================================
 * The server is the only part of the app that keeps other people's data, so it
 * is exercised for real: the actual `server.js` is started on an ephemeral port
 * with a throwaway data directory, and driven over HTTP with the built-in
 * `fetch`. No mocks, no framework.
 *
 * The behaviours that matter, and that this suite pins down:
 *   * register -> login -> me -> favorites, round-tripped;
 *   * a duplicate (case-insensitive) username is refused;
 *   * a wrong password and an unknown account are the same 401;
 *   * a favorited city is validated with the same engine the browser uses;
 *   * the API is unreachable without a session, and a revoked one dies;
 *   * the accounts file never contains a password;
 *   * the static half cannot be walked out of, and cannot read `data/`.
 *
 *     node --test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const Root = path.join(__dirname, '..');
const { createWeatherScopeServer } = require(path.join(Root, 'server.js'));
const Favorites = require(path.join(Root, 'favorites.js'));

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'weatherscope-test-'));
}

/** Boots a real server on 127.0.0.1:0 and returns a small HTTP client. */
async function boot(options) {
  const dataDir = (options && options.dataDir) || tempDir();
  const server = createWeatherScopeServer({
    staticDir: Root,
    dataDir: dataDir,
    rateLimit: options && options.rateLimit !== undefined ? options.rateLimit : false,
    sessionTtlMs: options && options.sessionTtlMs,
    log: () => {},
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = 'http://127.0.0.1:' + port;

  async function request(method, apiPath, config) {
    const settings = config || {};
    const headers = {};
    if (settings.token) headers.Authorization = 'Bearer ' + settings.token;
    if (settings.body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(base + apiPath, {
      method: method,
      headers: headers,
      body: settings.body === undefined ? undefined : (typeof settings.body === 'string' ? settings.body : JSON.stringify(settings.body)),
      redirect: 'manual',
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }
    return { status: response.status, payload: payload, headers: response.headers, text: null };
  }

  async function text(method, resourcePath) {
    const response = await fetch(base + resourcePath, { method: method });
    return { status: response.status, body: await response.text() };
  }

  return {
    base: base,
    dataDir: dataDir,
    store: server.weatherscope.store,
    request: request,
    text: text,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// ==========================================================================
// 1. The static half
// ==========================================================================
test('the app is served at the root, and /data is not', async () => {
  const app = await boot();
  try {
    const index = await app.text('GET', '/');
    assert.equal(index.status, 200);
    assert.match(index.body, /WeatherScope/);

    const script = await app.text('GET', '/favorites.js');
    assert.equal(script.status, 200, 'the favorites engine must be served');
    assert.match(script.body, /WeatherScopeFavorites/);

    const data = await app.text('GET', '/data/users.json');
    assert.equal(data.status, 404, 'the accounts file must never be downloadable');

    const encoded = await app.text('GET', '/data%2Fusers.json');
    assert.equal(encoded.status, 404);

    const missing = await app.text('GET', '/nope.html');
    assert.equal(missing.status, 404);
  } finally {
    await app.close();
  }
});

// ==========================================================================
// 2. Register / login / me
// ==========================================================================
test('an account can be created, used and read back', async () => {
  const app = await boot();
  try {
    const register = await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    assert.equal(register.status, 201);
    assert.equal(register.payload.ok, true);
    assert.equal(register.payload.user.username, 'Alice');
    assert.equal(typeof register.payload.token, 'string');
    assert.ok(register.payload.token.length >= 32);
    assert.deepEqual(register.payload.favorites, []);

    const me = await app.request('GET', '/api/auth/me', { token: register.payload.token });
    assert.equal(me.status, 200);
    assert.equal(me.payload.user.username, 'Alice');
  } finally {
    await app.close();
  }
});

test('the same account can sign in again and gets its own session', async () => {
  const app = await boot();
  try {
    const first = await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    const login = await app.request('POST', '/api/auth/login', {
      body: { username: 'alice', password: 'correct horse battery' },
    });

    assert.equal(login.status, 200);
    assert.equal(login.payload.user.username, 'Alice', 'the original spelling is kept');
    assert.notEqual(login.payload.token, first.payload.token);

    // The old session survives a second sign-in.
    const me = await app.request('GET', '/api/auth/me', { token: first.payload.token });
    assert.equal(me.status, 200);
  } finally {
    await app.close();
  }
});

test('a username is case-insensitively unique', async () => {
  const app = await boot();
  try {
    await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    const dupe = await app.request('POST', '/api/auth/register', {
      body: { username: 'ALICE', password: 'another password here' },
    });
    assert.equal(dupe.status, 409);
    assert.equal(dupe.payload.code, 'username-taken');
  } finally {
    await app.close();
  }
});

test('a wrong password and an unknown account are indistinguishable', async () => {
  const app = await boot();
  try {
    await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });

    const wrong = await app.request('POST', '/api/auth/login', {
      body: { username: 'Alice', password: 'not the password' },
    });
    const unknown = await app.request('POST', '/api/auth/login', {
      body: { username: 'Nobody', password: 'not the password' },
    });

    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.payload.code, 'invalid-credentials');
    assert.equal(unknown.payload.code, 'invalid-credentials');
  } finally {
    await app.close();
  }
});

test('registration applies the shared credential rules', async () => {
  const app = await boot();
  try {
    const short = await app.request('POST', '/api/auth/register', {
      body: { username: 'ab', password: 'correct horse battery' },
    });
    assert.equal(short.status, 400);
    assert.equal(short.payload.code, 'usernameLength');

    const weak = await app.request('POST', '/api/auth/register', {
      body: { username: 'bob', password: 'short' },
    });
    assert.equal(weak.status, 400);
    assert.equal(weak.payload.code, 'passwordTooShort');

    const charset = await app.request('POST', '/api/auth/register', {
      body: { username: '<script>', password: 'correct horse battery' },
    });
    assert.equal(charset.status, 400);
    assert.equal(charset.payload.code, 'usernameCharset');
  } finally {
    await app.close();
  }
});

test('a malformed body is a 400, not a crash', async () => {
  const app = await boot();
  try {
    const broken = await app.request('POST', '/api/auth/register', { body: '{ not json' });
    assert.equal(broken.status, 400);
    assert.equal(broken.payload.code, 'invalid');

    const empty = await app.request('POST', '/api/auth/login', { body: '' });
    assert.equal(empty.status, 401);
  } finally {
    await app.close();
  }
});

// ==========================================================================
// 3. Sessions
// ==========================================================================
test('logout revokes exactly the session that asked for it', async () => {
  const app = await boot();
  try {
    const register = await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    const second = await app.request('POST', '/api/auth/login', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });

    const logout = await app.request('POST', '/api/auth/logout', { token: register.payload.token });
    assert.equal(logout.status, 200);

    const dead = await app.request('GET', '/api/auth/me', { token: register.payload.token });
    assert.equal(dead.status, 401);
    assert.equal(dead.payload.code, 'unauthorized');

    const alive = await app.request('GET', '/api/auth/me', { token: second.payload.token });
    assert.equal(alive.status, 200, 'the other session must keep working');
  } finally {
    await app.close();
  }
});

test('a nonsense or missing token never reaches an account', async () => {
  const app = await boot();
  try {
    const noHeader = await app.request('GET', '/api/auth/me');
    assert.equal(noHeader.status, 401);

    const nonsense = await app.request('GET', '/api/favorites', { token: 'not-a-real-token' });
    assert.equal(nonsense.status, 401);
    assert.equal(nonsense.payload.code, 'unauthorized');
  } finally {
    await app.close();
  }
});

test('an expired session is refused', async () => {
  const app = await boot({ sessionTtlMs: 5 });
  try {
    const register = await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    await new Promise((resolve) => setTimeout(resolve, 15));
    const me = await app.request('GET', '/api/auth/me', { token: register.payload.token });
    assert.equal(me.status, 401);
  } finally {
    await app.close();
  }
});

// ==========================================================================
// 4. Favorites
// ==========================================================================
test('favorites are saved, sanitized and read back', async () => {
  const app = await boot();
  try {
    const register = await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    const token = register.payload.token;

    const put = await app.request('PUT', '/api/favorites', {
      token: token,
      body: {
        favorites: [
          { name: 'Paris', admin1: 'Île-de-France', country: 'France', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
          { name: 'Paris again', latitude: 48.8566, longitude: 2.3522 },
          { name: 'Broken' },
          { name: '<img>', latitude: 200, longitude: 200 },
        ],
      },
    });

    assert.equal(put.status, 200);
    assert.equal(put.payload.favorites.length, 1, 'duplicates and junk must collapse');
    assert.equal(put.payload.favorites[0].name, 'Paris');

    const get = await app.request('GET', '/api/favorites', { token: token });
    assert.equal(get.status, 200);
    assert.equal(get.payload.favorites.length, 1);
    assert.equal(get.payload.favorites[0].timezone, 'Europe/Paris');
  } finally {
    await app.close();
  }
});

test('favorites cannot be replaced with something that is not a list', async () => {
  const app = await boot();
  try {
    const register = await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    const bad = await app.request('PUT', '/api/favorites', {
      token: register.payload.token,
      body: { favorites: 'Paris' },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.payload.code, 'invalid');
  } finally {
    await app.close();
  }
});

test('favorites are capped at the shared limit', async () => {
  const app = await boot();
  try {
    const register = await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    const favorites = [];
    for (let i = 0; i < Favorites.MAX_FAVORITES + 8; i += 1) {
      favorites.push({ name: 'City' + i, latitude: i / 100, longitude: i / 100 });
    }
    const put = await app.request('PUT', '/api/favorites', {
      token: register.payload.token,
      body: { favorites: favorites },
    });
    assert.equal(put.payload.favorites.length, Favorites.MAX_FAVORITES);
  } finally {
    await app.close();
  }
});

test('the favorites list is not reachable without a session', async () => {
  const app = await boot();
  try {
    const read = await app.request('GET', '/api/favorites');
    assert.equal(read.status, 401);

    const write = await app.request('PUT', '/api/favorites', { body: { favorites: [] } });
    assert.equal(write.status, 401);
  } finally {
    await app.close();
  }
});

// ==========================================================================
// 4b. Alerts - the same whole-collection contract as favorites
// ==========================================================================
test('alerts are saved, sanitized and read back', async () => {
  const app = await boot();
  try {
    const register = await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    assert.deepEqual(register.payload.alerts, [], 'a fresh account has no rules');
    const token = register.payload.token;

    const put = await app.request('PUT', '/api/alerts', {
      token: token,
      body: {
        alerts: [
          { id: 'rain-1', cityKey: '48.8566,2.3522', cityName: 'Paris', metric: 'rainChance', comparator: 'above', threshold: 60, window: 'h2', enabled: true, createdAt: 5 },
          { id: 'rain-1', cityKey: '48.8566,2.3522', cityName: 'Paris', metric: 'rainChance', comparator: 'above', threshold: 60, window: 'h2' },
          { cityKey: 'not-coords', cityName: 'Paris', metric: 'rainChance', window: 'h2' },
          { cityKey: '0,0', cityName: 'Nowhere', metric: 'made-up', window: 'h2' },
        ],
      },
    });

    assert.equal(put.status, 200);
    assert.equal(put.payload.alerts.length, 1, 'duplicates and junk must collapse');
    assert.equal(put.payload.alerts[0].cityName, 'Paris');

    const get = await app.request('GET', '/api/alerts', { token: token });
    assert.equal(get.status, 200);
    assert.equal(get.payload.alerts.length, 1);
    assert.equal(get.payload.alerts[0].window, 'h2');

    // A later sign-in hands the rules back with the account.
    const login = await app.request('POST', '/api/auth/login', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    assert.equal(login.payload.alerts.length, 1);

    const me = await app.request('GET', '/api/auth/me', { token: token });
    assert.equal(me.payload.alerts.length, 1);
  } finally {
    await app.close();
  }
});

test('alerts cannot be replaced with something that is not a list', async () => {
  const app = await boot();
  try {
    const register = await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    const bad = await app.request('PUT', '/api/alerts', {
      token: register.payload.token,
      body: { alerts: 'rain' },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.payload.code, 'invalid');
  } finally {
    await app.close();
  }
});

test('the alerts list is not reachable without a session', async () => {
  const app = await boot();
  try {
    const read = await app.request('GET', '/api/alerts');
    assert.equal(read.status, 401);

    const write = await app.request('PUT', '/api/alerts', { body: { alerts: [] } });
    assert.equal(write.status, 401);
  } finally {
    await app.close();
  }
});

// ==========================================================================
// 5. Storage
// ==========================================================================
test('accounts and favorites survive a restart, passwords do not', async () => {
  const dataDir = tempDir();
  const password = 'correct horse battery';

  const first = await boot({ dataDir: dataDir });
  let token;
  try {
    const register = await first.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: password },
    });
    token = register.payload.token;
    await first.request('PUT', '/api/favorites', {
      token: token,
      body: { favorites: [{ name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo' }] },
    });
    await first.request('PUT', '/api/alerts', {
      token: token,
      body: {
        alerts: [{
          id: 'tokyo-rain', cityKey: '35.6762,139.6503', cityName: 'Tokyo',
          metric: 'rainChance', comparator: 'above', threshold: 50, window: 'h2',
        }],
      },
    });
  } finally {
    await first.close();
  }

  // The file on disk must never contain the password in any form.
  const raw = fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8');
  assert.ok(!raw.includes(password), 'the password must never be written to disk');
  const parsed = JSON.parse(raw);
  assert.equal(typeof parsed.users.alice.salt, 'string');
  assert.equal(typeof parsed.users.alice.hash, 'string');
  assert.notEqual(parsed.users.alice.hash, password);

  const second = await boot({ dataDir: dataDir });
  try {
    // The old session is gone (sessions are in memory), but the account is not.
    const stale = await second.request('GET', '/api/auth/me', { token: token });
    assert.equal(stale.status, 401);

    const login = await second.request('POST', '/api/auth/login', {
      body: { username: 'Alice', password: password },
    });
    assert.equal(login.status, 200);
    assert.equal(login.payload.favorites.length, 1);
    assert.equal(login.payload.favorites[0].name, 'Tokyo');
    assert.equal(login.payload.alerts.length, 1);
    assert.equal(login.payload.alerts[0].cityName, 'Tokyo');
  } finally {
    await second.close();
  }
});

test('a corrupt accounts file is quarantined, never overwritten', async () => {
  const dataDir = tempDir();
  fs.writeFileSync(path.join(dataDir, 'users.json'), '{ this is not json');

  const app = await boot({ dataDir: dataDir });
  try {
    const register = await app.request('POST', '/api/auth/register', {
      body: { username: 'Alice', password: 'correct horse battery' },
    });
    assert.equal(register.status, 201, 'the server must still start and work');

    const quarantined = fs.readdirSync(dataDir).filter((name) => name.includes('.corrupt-'));
    assert.equal(quarantined.length, 1, 'the original file must be kept, not overwritten');
    assert.equal(fs.readFileSync(path.join(dataDir, quarantined[0]), 'utf8'), '{ this is not json');
  } finally {
    await app.close();
  }
});

// ==========================================================================
// 6. Abuse handling
// ==========================================================================
test('credential attempts are rate-limited per client', async () => {
  const app = await boot({ rateLimit: { windowMs: 60 * 1000, max: 3 } });
  try {
    const attempt = () => app.request('POST', '/api/auth/login', {
      body: { username: 'Alice', password: 'whatever password' },
    });

    assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 401);

    const throttled = await attempt();
    assert.equal(throttled.status, 429);
    assert.equal(throttled.payload.code, 'rate-limited');
    assert.ok(Number(throttled.headers.get('retry-after')) > 0);
  } finally {
    await app.close();
  }
});

test('an oversized body is refused', async () => {
  const app = await boot();
  try {
    const huge = JSON.stringify({ username: 'alice', password: 'x'.repeat(80 * 1024) });
    const response = await app.request('POST', '/api/auth/register', { body: huge });
    assert.equal(response.status, 400);
  } finally {
    await app.close();
  }
});

test('wrong methods and unknown API paths get honest answers', async () => {
  const app = await boot();
  try {
    const wrongMethod = await app.request('GET', '/api/auth/login');
    assert.equal(wrongMethod.status, 405);

    const unknown = await app.request('GET', '/api/does-not-exist');
    assert.equal(unknown.status, 404);
    assert.equal(unknown.payload.code, 'not-found');

    const health = await app.request('GET', '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.payload.ok, true);
  } finally {
    await app.close();
  }
});
