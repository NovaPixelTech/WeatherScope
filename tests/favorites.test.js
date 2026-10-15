'use strict';
/**
 * WeatherScope Favorites - engine & API-client tests
 * =========================================================================
 * `favorites.js` is the one place that decides what a saved city is allowed to
 * be, and the server requires the very same file. So this suite pins down two
 * things:
 *
 *   1. the validation itself - a value off the wire, out of storage, or out of
 *      a hand-edited request can only ever fail closed; and
 *   2. the request contract - the paths, headers, body and error codes the app
 *      and the server agree on - driven through an injected fake `fetch`, so no
 *      network and no server are needed.
 *
 *     node --test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'favorites.js'), 'utf8');

// --- Load it exactly the way the browser does ------------------------------
function loadAsBrowserGlobal() {
  const sandbox = { window: {}, console, setTimeout, clearTimeout };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.WeatherScopeFavorites || sandbox.window.WeatherScopeFavorites;
}

const F = require(path.join(ROOT, 'favorites.js'));
const BrowserF = loadAsBrowserGlobal();

// ==========================================================================
// 0. Loading contract
// ==========================================================================
test('favorites.js registers itself as a browser global and as a module', () => {
  assert.ok(BrowserF, 'WeatherScopeFavorites global is missing');
  assert.equal(typeof BrowserF.normalizeCity, 'function');
  assert.equal(typeof BrowserF.createClient, 'function');
  assert.equal(typeof F.addFavorite, 'function', 'the server must be able to require it');
  assert.equal(F.MAX_FAVORITES, BrowserF.MAX_FAVORITES);
});

test('the module exposes the limits both halves depend on', () => {
  assert.equal(typeof F.MAX_FAVORITES, 'number');
  assert.ok(F.MAX_FAVORITES >= 5);
  assert.equal(typeof F.USERNAME_MIN, 'number');
  assert.equal(typeof F.PASSWORD_MIN, 'number');
  assert.ok(F.PASSWORD_MIN >= 8, 'a password floor weaker than 8 is not a floor');
});

// ==========================================================================
// 1. normalizeCity
// ==========================================================================
test('a well-formed city is normalized without inventing fields', () => {
  assert.deepEqual(
    F.normalizeCity({ name: 'Paris', admin1: 'Île-de-France', country: 'France', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' }),
    { name: 'Paris', latitude: 48.8566, longitude: 2.3522, admin1: 'Île-de-France', country: 'France', timezone: 'Europe/Paris' }
  );
});

test('City Search field names are accepted as aliases', () => {
  const city = F.normalizeCity({ city: 'Tokyo', region: 'Tokyo', lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' });
  assert.equal(city.name, 'Tokyo');
  assert.equal(city.admin1, 'Tokyo');
  assert.equal(city.latitude, 35.6762);
  assert.equal(city.timezone, 'Asia/Tokyo');
});

test('coordinates are rounded to four decimals', () => {
  const city = F.normalizeCity({ name: 'X', latitude: 48.856614123, longitude: 2.352218765 });
  assert.equal(city.latitude, 48.8566);
  assert.equal(city.longitude, 2.3522);
});

test('a city without a name is rejected', () => {
  assert.equal(F.normalizeCity({ latitude: 1, longitude: 2 }), null);
  assert.equal(F.normalizeCity({ name: '   ', latitude: 1, longitude: 2 }), null);
  assert.equal(F.normalizeCity({ name: 'A\u0000B', latitude: 1, longitude: 2 }), null);
  assert.equal(F.normalizeCity({ name: 'x'.repeat(200), latitude: 1, longitude: 2 }), null);
});

test('every unusable coordinate shape is rejected, not coerced', () => {
  const bad = [
    { name: 'No coords' },
    { name: 'Lone lat', latitude: 10 },
    { name: 'Lone lon', longitude: 10 },
    { name: 'Null coords', latitude: null, longitude: null },
    { name: 'NaN', latitude: NaN, longitude: 2 },
    { name: 'Infinity', latitude: Infinity, longitude: 2 },
    { name: 'Past the pole', latitude: 91, longitude: 2 },
    { name: 'Past the date line', latitude: 10, longitude: 181 },
    { name: 'Empty string', latitude: '', longitude: '' },
    { name: 'Not a number', latitude: 'north', longitude: 'east' },
  ];
  bad.forEach((city) => {
    assert.equal(F.normalizeCity(city), null, `${city.name} must be rejected`);
  });
});

test('Number(null) is not allowed to place a city on the equator', () => {
  // The classic bug: Number(null) === 0 would happily become a coordinate.
  assert.equal(F.normalizeCity({ name: 'Ghost', latitude: null, longitude: null }), null);
  assert.equal(F.normalizeCity({ name: 'Ghost', latitude: 0, longitude: 0 }).latitude, 0);
});

test('a timezone that is not an IANA-looking id is dropped, not kept', () => {
  const city = F.normalizeCity({ name: 'X', latitude: 1, longitude: 2, timezone: '<script>' });
  assert.equal(city.timezone, undefined);
  assert.ok(!Object.prototype.hasOwnProperty.call(city, 'timezone'));
  assert.equal(F.normalizeCity({ name: 'X', latitude: 1, longitude: 2, timezone: 'America/Argentina/Buenos_Aires' }).timezone, 'America/Argentina/Buenos_Aires');
});

// ==========================================================================
// 2. Identity
// ==========================================================================
test('identity is the coordinate pair, so the same place collapses', () => {
  const a = F.normalizeCity({ name: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522 });
  const b = F.normalizeCity({ name: 'Paris', country: 'France', latitude: 48.85661, longitude: 2.35219 });
  assert.equal(F.cityKey(a), F.cityKey(b));
  assert.equal(F.isFavorite([a], b), true);
});

test('two cities of the same name in different places are different entries', () => {
  const parisFr = F.normalizeCity({ name: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522 });
  const parisTx = F.normalizeCity({ name: 'Paris', country: 'United States', latitude: 33.6609, longitude: -95.5555 });
  assert.notEqual(F.cityKey(parisFr), F.cityKey(parisTx));
});

test('an invalid city has no identity', () => {
  assert.equal(F.cityKey(null), '');
  assert.equal(F.cityKey({ name: 'Nowhere' }), '');
});

// ==========================================================================
// 3. describeCity
// ==========================================================================
test('describeCity names the place the way the dashboard does', () => {
  assert.equal(
    F.describeCity({ name: 'Paris', admin1: 'Île-de-France', country: 'France', latitude: 1, longitude: 2 }),
    'Paris, Île-de-France, France'
  );
  assert.equal(F.describeCity({ name: 'Singapore', country: 'Singapore', latitude: 1, longitude: 2 }), 'Singapore');
  assert.equal(F.describeCity({ name: 'Nowhere' }), '');
});

// ==========================================================================
// 4. sanitizeFavorites
// ==========================================================================
test('sanitizeFavorites keeps only real cities, de-duplicated and capped', () => {
  const raw = [
    { name: 'A', latitude: 1, longitude: 1 },
    { name: 'A copy', latitude: 1, longitude: 1 },
    { name: 'Broken' },
    null,
    'Tokyo',
    { name: 'B', latitude: 2, longitude: 2 },
  ];
  const clean = F.sanitizeFavorites(raw);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].name, 'A');
  assert.equal(clean[1].name, 'B');
});

test('sanitizeFavorites refuses anything that is not an array', () => {
  assert.deepEqual(F.sanitizeFavorites(null), []);
  assert.deepEqual(F.sanitizeFavorites('Paris'), []);
  assert.deepEqual(F.sanitizeFavorites(undefined), []);
});

test('sanitizeFavorites caps the list at MAX_FAVORITES', () => {
  const raw = [];
  for (let i = 0; i < F.MAX_FAVORITES + 10; i += 1) {
    raw.push({ name: 'City' + i, latitude: i / 100, longitude: i / 100 });
  }
  assert.equal(F.sanitizeFavorites(raw).length, F.MAX_FAVORITES);
});

// ==========================================================================
// 5. add / remove
// ==========================================================================
test('addFavorite reports why it did or did not change the list', () => {
  const paris = { name: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522 };

  const first = F.addFavorite([], paris);
  assert.equal(first.changed, true);
  assert.equal(first.reason, 'ok');
  assert.equal(first.list.length, 1);

  const again = F.addFavorite(first.list, paris);
  assert.equal(again.changed, false);
  assert.equal(again.reason, 'duplicate');

  const invalid = F.addFavorite(first.list, { name: 'Nowhere' });
  assert.equal(invalid.changed, false);
  assert.equal(invalid.reason, 'invalid');

  const full = [];
  for (let i = 0; i < F.MAX_FAVORITES; i += 1) full.push({ name: 'C' + i, latitude: i / 100, longitude: 1 });
  const overflow = F.addFavorite(full, { name: 'One too many', latitude: 80, longitude: 80 });
  assert.equal(overflow.changed, false);
  assert.equal(overflow.reason, 'full');
  assert.equal(overflow.list.length, F.MAX_FAVORITES);
});

test('addFavorite never mutates the list it was handed', () => {
  const list = [];
  const result = F.addFavorite(list, { name: 'Paris', latitude: 1, longitude: 2 });
  assert.equal(list.length, 0);
  assert.equal(result.list.length, 1);
});

test('removeFavorite works by city and by key, and says when there is nothing to remove', () => {
  const paris = { name: 'Paris', latitude: 48.8566, longitude: 2.3522 };
  const tokyo = { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503 };
  const list = [paris, tokyo];

  const byCity = F.removeFavorite(list, paris);
  assert.equal(byCity.changed, true);
  assert.deepEqual(byCity.list.map((c) => c.name), ['Tokyo']);

  const byKey = F.removeFavorite(list, F.cityKey(tokyo));
  assert.deepEqual(byKey.list.map((c) => c.name), ['Paris']);

  const missing = F.removeFavorite(list, { name: 'Nowhere', latitude: 5, longitude: 5 });
  assert.equal(missing.changed, false);
  assert.equal(missing.reason, 'missing');

  const invalid = F.removeFavorite(list, null);
  assert.equal(invalid.changed, false);
  assert.equal(invalid.reason, 'invalid');
});

// ==========================================================================
// 6. Credential rules
// ==========================================================================
test('validateUsername accepts ordinary names and trims them', () => {
  assert.deepEqual(F.validateUsername('  alice  '), { valid: true, reason: '', username: 'alice' });
  assert.equal(F.validateUsername('a.b-c_1').valid, true);
  assert.equal(F.validateUsername('Yiannis').valid, true);
});

test('validateUsername refuses empty, short, long and punctuated names', () => {
  assert.equal(F.validateUsername('').reason, 'usernameRequired');
  assert.equal(F.validateUsername('   ').reason, 'usernameRequired');
  assert.equal(F.validateUsername('ab').reason, 'usernameLength');
  assert.equal(F.validateUsername('x'.repeat(F.USERNAME_MAX + 1)).reason, 'usernameLength');
  assert.equal(F.validateUsername('has space').reason, 'usernameCharset');
  assert.equal(F.validateUsername('.leading').reason, 'usernameCharset');
  assert.equal(F.validateUsername('trailing.').reason, 'usernameCharset');
  assert.equal(F.validateUsername('<script>').reason, 'usernameCharset');
  assert.equal(F.validateUsername(null).reason, 'usernameRequired');
});

test('validatePassword enforces a floor, a ceiling and nothing else', () => {
  assert.equal(F.validatePassword('correct horse battery').valid, true);
  assert.equal(F.validatePassword('').reason, 'passwordRequired');
  assert.equal(F.validatePassword('short').reason, 'passwordTooShort');
  assert.equal(F.validatePassword('x'.repeat(F.PASSWORD_MAX + 1)).reason, 'passwordTooLong');
  assert.equal(F.validatePassword(null).reason, 'passwordRequired');
  // A password may contain anything, including characters a username may not.
  assert.equal(F.validatePassword('a b<c>&"\'/').valid, true);
});

test('validateCredentials reports the first problem only', () => {
  assert.deepEqual(F.validateCredentials({ username: 'ab', password: 'short' }), {
    valid: false, reason: 'usernameLength', username: 'ab', password: '',
  });
  assert.deepEqual(F.validateCredentials({ username: 'alice', password: 'short' }), {
    valid: false, reason: 'passwordTooShort', username: 'alice', password: '',
  });
  assert.equal(F.validateCredentials({ username: 'alice', password: 'long enough' }).valid, true);
});

// ==========================================================================
// 7. The API client, against a fake fetch
// ==========================================================================
function jsonResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status: status, json: async () => payload };
}

function recordingFetch(response) {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url: url, options: options });
    if (typeof response === 'function') return response(url, options);
    return response;
  };
  fetchFn.calls = calls;
  return fetchFn;
}

test('register posts JSON to the right path and reads the session back', async () => {
  const fetchFn = recordingFetch(jsonResponse(201, {
    ok: true,
    token: 'tok-123',
    user: { username: 'Alice' },
    favorites: [{ name: 'Paris', latitude: 48.8566, longitude: 2.3522 }],
  }));
  const client = F.createClient({ fetchFn: fetchFn, timeoutMs: 0 });

  const result = await client.register('Alice', 'long enough password');

  assert.equal(result.token, 'tok-123');
  assert.equal(result.username, 'Alice');
  assert.equal(result.favorites.length, 1);

  assert.equal(fetchFn.calls.length, 1);
  assert.equal(fetchFn.calls[0].url, '/api/auth/register');
  assert.equal(fetchFn.calls[0].options.method, 'POST');
  assert.equal(fetchFn.calls[0].options.headers['Content-Type'], 'application/json');
  assert.equal(fetchFn.calls[0].options.headers.Accept, 'application/json');
  assert.deepEqual(JSON.parse(fetchFn.calls[0].options.body), { username: 'Alice', password: 'long enough password' });
});

test('register validates locally and never touches the network when it fails', async () => {
  const fetchFn = recordingFetch(jsonResponse(201, { ok: true }));
  const client = F.createClient({ fetchFn: fetchFn, timeoutMs: 0 });

  await assert.rejects(() => client.register('ab', 'long enough'), (err) => {
    assert.equal(err.name, 'FavoriteApiError');
    assert.equal(err.code, 'usernameLength');
    return true;
  });
  await assert.rejects(() => client.register('alice', 'short'), (err) => {
    assert.equal(err.code, 'passwordTooShort');
    return true;
  });
  assert.equal(fetchFn.calls.length, 0, 'a locally invalid credential must not be sent');
});

test('a wrong password surfaces as invalid-credentials', async () => {
  const fetchFn = recordingFetch(jsonResponse(401, { ok: false, code: 'invalid-credentials' }));
  const client = F.createClient({ fetchFn: fetchFn, timeoutMs: 0 });
  await assert.rejects(() => client.login('alice', 'long enough'), (err) => {
    assert.equal(err.code, 'invalid-credentials');
    assert.equal(err.status, 401);
    return true;
  });
});

test('a taken username, a throttle and a broken server map to their own codes', async () => {
  const taken = F.createClient({ fetchFn: recordingFetch(jsonResponse(409, { ok: false, code: 'username-taken' })), timeoutMs: 0 });
  await assert.rejects(() => taken.register('alice', 'long enough'), (err) => err.code === 'username-taken');

  const throttled = F.createClient({ fetchFn: recordingFetch(jsonResponse(429, { ok: false, code: 'rate-limited' })), timeoutMs: 0 });
  await assert.rejects(() => throttled.login('alice', 'long enough'), (err) => err.code === 'rate-limited');

  const broken = F.createClient({ fetchFn: recordingFetch(jsonResponse(500, null)), timeoutMs: 0 });
  await assert.rejects(() => broken.me('tok'), (err) => err.code === 'server');
});

test('an error page that is not JSON is still classified by status', async () => {
  const fetchFn = recordingFetch({
    ok: false,
    status: 401,
    json: async () => { throw new Error('not json'); },
  });
  const client = F.createClient({ fetchFn: fetchFn, timeoutMs: 0 });
  await assert.rejects(() => client.me('tok'), (err) => err.code === 'invalid-credentials');
});

test('a static host with no API reads as unavailable, not a server error', async () => {
  // A plain static server (or GitHub Pages) answers a POST to an /api route it
  // does not have with 404/405; the app must say "start the server", not
  // "something went wrong".
  const notFound = F.createClient({ fetchFn: recordingFetch(jsonResponse(404, {})), timeoutMs: 0 });
  await assert.rejects(() => notFound.register('alice', 'long enough'), (err) => err.code === 'unavailable');

  const methodNotAllowed = F.createClient({ fetchFn: recordingFetch(jsonResponse(405, {})), timeoutMs: 0 });
  await assert.rejects(() => methodNotAllowed.register('alice', 'long enough'), (err) => err.code === 'unavailable');
});

test('an SPA fallback that answers 200 with HTML is unavailable, never a silent success', async () => {
  const fetchFn = recordingFetch({
    ok: true,
    status: 200,
    json: async () => { throw new Error('not json'); },
  });
  const client = F.createClient({ fetchFn: fetchFn, timeoutMs: 0 });
  await assert.rejects(() => client.register('alice', 'long enough'), (err) => err.code === 'unavailable');
});

test('a bare 401 from an expired session is invalid-credentials and gets the app to sign out', async () => {
  const client = F.createClient({
    fetchFn: recordingFetch({ ok: false, status: 401, json: async () => ({}) }),
    timeoutMs: 0,
  });
  await assert.rejects(() => client.getFavorites('stale'), (err) => err.code === 'invalid-credentials');
});

test('a dead network is a network error, never a crash', async () => {
  const client = F.createClient({
    fetchFn: async () => { throw new Error('offline'); },
    timeoutMs: 0,
  });
  await assert.rejects(() => client.login('alice', 'long enough'), (err) => {
    assert.equal(err.code, 'network');
    assert.equal(err.status, 0);
    return true;
  });
});

test('a missing fetch is reported as unavailable', async () => {
  const client = F.createClient({ timeoutMs: 0 });
  await assert.rejects(() => client.login('alice', 'long enough'), (err) => err.code === 'unavailable');
});

test('the bearer token travels on the header of every authenticated call', async () => {
  const fetchFn = recordingFetch((url) => {
    if (url === '/api/auth/me') return jsonResponse(200, { ok: true, user: { username: 'Alice' }, favorites: [] });
    return jsonResponse(200, { ok: true, favorites: [] });
  });
  const client = F.createClient({ fetchFn: fetchFn, timeoutMs: 0 });

  await client.me('tok-9');
  await client.getFavorites('tok-9');
  await client.saveFavorites('tok-9', []);

  fetchFn.calls.forEach((call) => {
    assert.equal(call.options.headers.Authorization, 'Bearer tok-9');
  });
  assert.equal(fetchFn.calls[0].url, '/api/auth/me');
  assert.equal(fetchFn.calls[1].url, '/api/favorites');
  assert.equal(fetchFn.calls[2].options.method, 'PUT');
});

test('getFavorites sanitizes a hostile payload before the app can render it', async () => {
  const client = F.createClient({
    fetchFn: recordingFetch(jsonResponse(200, {
      ok: true,
      favorites: [
        { name: 'Paris', latitude: 48.8566, longitude: 2.3522 },
        { name: 'Hostile', latitude: 999, longitude: 999 },
        { name: '<img src=x onerror=alert(1)>', latitude: null, longitude: null },
        'not a city',
      ],
    })),
    timeoutMs: 0,
  });

  const favorites = await client.getFavorites('tok');
  assert.equal(favorites.length, 1);
  assert.equal(favorites[0].name, 'Paris');
});

test('saveFavorites sends only cities the engine accepts, and returns what was stored', async () => {
  const fetchFn = recordingFetch((url, options) => {
    const sent = JSON.parse(options.body);
    return jsonResponse(200, { ok: true, favorites: sent.favorites });
  });
  const client = F.createClient({ fetchFn: fetchFn, timeoutMs: 0 });

  const saved = await client.saveFavorites('tok', [
    { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
    { name: 'Bad' },
    { name: 'Tokyo again', latitude: 35.6762, longitude: 139.6503 },
  ]);

  const sent = JSON.parse(fetchFn.calls[0].options.body);
  assert.equal(sent.favorites.length, 1);
  assert.equal(sent.favorites[0].name, 'Tokyo');
  assert.deepEqual(saved, sent.favorites);
});

test('logout is best-effort: it sends the token, and an unreachable server is not an error', async () => {
  const ok = recordingFetch(jsonResponse(200, { ok: true }));
  await F.createClient({ fetchFn: ok, timeoutMs: 0 }).logout('tok');
  assert.equal(ok.calls.length, 1);
  assert.equal(ok.calls[0].options.headers.Authorization, 'Bearer tok');

  const dead = recordingFetch(async () => { throw new Error('offline'); });
  await F.createClient({ fetchFn: dead, timeoutMs: 0 }).logout('tok');

  const noToken = recordingFetch(jsonResponse(200, { ok: true }));
  await F.createClient({ fetchFn: noToken, timeoutMs: 0 }).logout('');
  assert.equal(noToken.calls.length, 0, 'no token means nothing to revoke');
});

test('a base URL is honoured for a client served from elsewhere', async () => {
  const fetchFn = recordingFetch(jsonResponse(200, { ok: true, user: { username: 'A' }, favorites: [] }));
  const client = F.createClient({ fetchFn: fetchFn, baseUrl: 'http://127.0.0.1:3000/', timeoutMs: 0 });
  await client.me('tok');
  assert.equal(fetchFn.calls[0].url, 'http://127.0.0.1:3000/api/auth/me');
});

test('a timeout aborts the request and reports it as a network failure', async () => {
  let aborted = false;
  class FakeAbortController {
    constructor() { this.signal = { aborted: false }; }
    abort() { aborted = true; this.signal.aborted = true; }
  }

  const client = F.createClient({
    fetchFn: (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener = undefined;
      // The real fetch rejects when the signal aborts; emulate by watching the flag.
      const check = setInterval(() => {
        if (aborted) {
          clearInterval(check);
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        }
      }, 1);
    }),
    AbortController: FakeAbortController,
    timeoutMs: 5,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  });

  await assert.rejects(() => client.login('alice', 'long enough'), (err) => err.code === 'network');
  assert.equal(aborted, true, 'the timer must abort the in-flight request');
});

test('apiErrorCode falls back to server for anything unrecognised', () => {
  assert.equal(F.apiErrorCode({ code: 'network' }), 'network');
  assert.equal(F.apiErrorCode({ code: 'made-up' }), 'server');
  assert.equal(F.apiErrorCode(null), 'server');
  assert.equal(F.apiErrorCode(new Error('plain')), 'server');
});

// ==========================================================================
// 8. The local (browser-only) account client
// ==========================================================================
/** A Map-backed storage, exactly the three methods the client asks for. */
function memoryStorage(seed) {
  const map = new Map(seed ? Object.entries(seed) : []);
  return {
    map: map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

/**
 * A deterministic, fast stand-in for PBKDF2. It is a real one-way-ish mix (the
 * plaintext never appears in the output), so the "no plaintext in storage"
 * assertions stay meaningful without paying for 100k iterations per test.
 */
function fakeHasher(password, salt) {
  let h = 0;
  const text = String(salt) + '\u0000' + String(password);
  for (let i = 0; i < text.length; i += 1) h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0;
  return { hash: 'h' + h.toString(16), algo: 'test' };
}

function localClient(storage) {
  return F.createLocalClient({
    storage: storage,
    hasher: fakeHasher,
    now: () => 1234,
    randomSalt: () => 'salt-fixed',
  });
}

test('the local client exposes the same contract as the API client', () => {
  const client = localClient(memoryStorage());
  ['register', 'login', 'logout', 'me', 'getFavorites', 'saveFavorites'].forEach((method) => {
    assert.equal(typeof client[method], 'function', `local client is missing ${method}`);
  });
  assert.equal(client.available, true);
  assert.equal(F.isLocalToken('local:alice'), true);
  assert.equal(F.isLocalToken('deadbeef'), false);
});

test('a local account is created, signed in and remembered', async () => {
  const storage = memoryStorage();
  const client = localClient(storage);

  const created = await client.register('Alice', 'long enough password');
  assert.equal(created.username, 'Alice');
  assert.equal(F.isLocalToken(created.token), true);
  assert.deepEqual(created.favorites, []);

  // Case-insensitive sign-in, same as the server.
  const signedIn = await client.login('alice', 'long enough password');
  assert.equal(signedIn.username, 'Alice');
  assert.equal(signedIn.token, created.token);

  const me = await client.me(created.token);
  assert.equal(me.username, 'Alice');

  // The password itself is never stored - only a salt and a derived hash.
  const raw = storage.map.get(F.LOCAL_ACCOUNTS_KEY);
  assert.ok(raw.indexOf('long enough password') === -1, 'the password leaked into storage');
  assert.ok(raw.indexOf('salt-fixed') !== -1, 'the salt should be stored');
});

test('a second local account with the same name is refused', async () => {
  const client = localClient(memoryStorage());
  await client.register('Alice', 'long enough password');
  await assert.rejects(() => client.register('alice', 'another password'), (err) => err.code === 'username-taken');
});

test('a wrong local password is invalid-credentials, never a silent pass', async () => {
  const client = localClient(memoryStorage());
  const created = await client.register('Alice', 'long enough password');
  await assert.rejects(() => client.login('Alice', 'the wrong password!!'), (err) => err.code === 'invalid-credentials');
  await assert.rejects(() => client.login('Ghost', 'long enough password'), (err) => err.code === 'invalid-credentials');
  // The failed attempts must not have broken the real session.
  const me = await client.me(created.token);
  assert.equal(me.username, 'Alice');
});

test('local favorites round-trip through saveFavorites, sanitized', async () => {
  const client = localClient(memoryStorage());
  const created = await client.register('Alice', 'long enough password');

  const saved = await client.saveFavorites(created.token, [
    { name: 'Paris', latitude: 48.8566, longitude: 2.3522 },
    { name: 'Hostile', latitude: 999, longitude: 999 },
    { name: 'Paris again', latitude: 48.8566, longitude: 2.3522 },
  ]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'Paris');

  assert.deepEqual(await client.getFavorites(created.token), saved);
  assert.deepEqual((await client.me(created.token)).favorites, saved);
});

test('a token that names no local account is unauthorized', async () => {
  const client = localClient(memoryStorage());
  await assert.rejects(() => client.me('local:Ghost'), (err) => err.code === 'unauthorized');
  await assert.rejects(() => client.getFavorites('local:Ghost'), (err) => err.code === 'unauthorized');
  await assert.rejects(() => client.saveFavorites('local:Ghost', []), (err) => err.code === 'unauthorized');
  await assert.rejects(() => client.me('not-a-local-token'), (err) => err.code === 'unauthorized');
});

test('the local client validates locally and reports it is unusable without storage', async () => {
  const client = localClient(memoryStorage());
  await assert.rejects(() => client.register('ab', 'long enough password'), (err) => err.code === 'usernameLength');
  await assert.rejects(() => client.register('Alice', 'short'), (err) => err.code === 'passwordTooShort');

  const dead = F.createLocalClient({ storage: null, hasher: fakeHasher });
  assert.equal(dead.available, false);
  await assert.rejects(() => dead.register('Alice', 'long enough password'), (err) => err.code === 'unavailable');
});

test('a corrupt local store is discarded rather than thrown', async () => {
  const storage = memoryStorage({ [F.LOCAL_ACCOUNTS_KEY]: '{ not json' });
  const client = localClient(storage);
  const created = await client.register('Alice', 'long enough password');
  assert.equal(created.username, 'Alice');
  assert.equal((await client.login('Alice', 'long enough password')).username, 'Alice');
});

test('the default hasher never writes the plaintext password, and can still verify it', async () => {
  const storage = memoryStorage();
  const client = F.createLocalClient({ storage: storage, randomSalt: () => 'fixed-salt' });

  await client.register('Alice', 'hunter2-but-long');
  const raw = storage.map.get(F.LOCAL_ACCOUNTS_KEY);
  assert.ok(raw.indexOf('hunter2-but-long') === -1, 'the plaintext password reached storage');

  const record = JSON.parse(raw).users.alice;
  assert.ok(['pbkdf2', 'weak'].indexOf(record.algo) !== -1, 'an unexpected hash method was recorded');
  assert.equal((await client.login('Alice', 'hunter2-but-long')).username, 'Alice');
  await assert.rejects(() => client.login('Alice', 'not-the-password'), (err) => err.code === 'invalid-credentials');
});
