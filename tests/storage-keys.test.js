'use strict';
/**
 * WeatherScope storage keys - the rename migration tests
 * =========================================================================
 * The app was called SkyCast and kept its unit and last city under
 * `skycast_*` localStorage keys. Those keys are now `weatherscope_*`, and the
 * one thing this suite exists to prove is that the rename did not quietly cost
 * anyone their settings: a pre-rename value has to be adopted, and a value
 * written after the rename has to win over any stale legacy value left behind.
 *
 *     node --test
 *
 * No DOM library is needed. `document.readyState` is reported as 'loading' with
 * a no-op listener, so `app.js` finishes evaluating its state and never calls
 * `init()` - which is all this needs, because the unit is read while the state
 * object is being built.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

/** Evaluates app.js against a seeded storage and returns what it left behind. */
function boot(seed = {}) {
  const local = new Map(Object.entries(seed));
  const session = new Map();

  const storage = (map) => ({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  });

  const documentStub = {
    // 'loading' defers init() onto a listener that is never fired, so only the
    // top-level state (and therefore the unit migration) is exercised.
    readyState: 'loading',
    addEventListener() {},
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {} }),
  };

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    document: documentStub,
    navigator: {},
    location: { href: 'http://localhost/', protocol: 'http:' },
    localStorage: storage(local),
    sessionStorage: storage(session),
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout: () => 0,
    setInterval: () => 0,
    clearTimeout: () => 0,
    clearInterval: () => 0,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => 0,
    Intl, Date, Math, JSON, Promise, AbortController, URL, URLSearchParams, Map, Set, Error,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(appSource, sandbox, { filename: 'app.js' });

  return { local, session };
}

// ==========================================================================
// 1. The rename itself
// ==========================================================================
test('the persisted keys carry the new name', () => {
  assert.match(appSource, /unit:\s*'weatherscope_unit'/, 'the unit key was not renamed');
  assert.match(appSource, /lastCity:\s*'weatherscope_last_city'/, 'the last-city key was not renamed');
  assert.match(appSource, /globalCache:\s*'weatherscope_global_cache'/, 'the session cache key was not renamed');
});

test('a pre-rename key is named in exactly one place', () => {
  // Everything outside the legacy map - which is the only thing allowed to spell
  // a `skycast_*` key - must reach storage through the helpers.
  const withoutLegacyMap = appSource.replace(
    appSource.slice(appSource.indexOf('const LEGACY_STORAGE_KEYS'), appSource.indexOf('/** Reads a key')),
    ''
  );
  const strays = withoutLegacyMap
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => /skycast_/.test(line) && !/^\s*(\/\/|\*)/.test(line));
  assert.deepEqual(strays, [], 'a legacy key is spelled out outside the migration map');

  // And the map holds all three, so a future key cannot be added without one.
  const legacyMap = appSource.slice(
    appSource.indexOf('const LEGACY_STORAGE_KEYS'),
    appSource.indexOf('/** Reads a key')
  );
  assert.equal((legacyMap.match(/skycast_/g) || []).length, 3);
});

// ==========================================================================
// 2. Nothing is lost across the rename
// ==========================================================================
test('a SkyCast visitor keeps their Fahrenheit preference', () => {
  const { local } = boot({ skycast_unit: 'fahrenheit' });
  assert.equal(local.get('weatherscope_unit'), 'fahrenheit', 'the unit was not carried over');
  assert.equal(local.has('skycast_unit'), false, 'the legacy unit key was left behind');
});

test('a SkyCast visitor keeps their last city', () => {
  // The last city is read from inside init(), behind the whole dashboard
  // binding, so this asserts the wiring rather than driving the DOM. The
  // migration itself is the shared `readStored` helper, which the unit tests
  // below exercise end to end.
  assert.match(
    appSource,
    /const saved = readStored\(STORAGE_KEYS\.lastCity, LEGACY_STORAGE_KEYS\.lastCity\)/,
    'init() does not read the last city through the migration helper'
  );
  assert.equal(
    (appSource.match(/localStorage\.getItem\('weatherscope_last_city'\)/g) || []).length,
    0,
    'init() bypasses the migration helper'
  );
});

test('the in-session 72-city cache is migrated too', () => {
  const { session } = boot();
  // The session cache is only read lazily, so assert the pair is wired up
  // rather than manufacturing a cache entry the app would not otherwise write.
  assert.equal(session.has('skycast_global_cache'), false);
  assert.match(appSource, /sessionStorage\.getItem\(LEGACY_STORAGE_KEYS\.globalCache\)/);
  assert.match(appSource, /sessionStorage\.setItem\(STORAGE_KEYS\.globalCache/);
});

// ==========================================================================
// 3. The rename never clobbers anything
// ==========================================================================
test('a value written after the rename beats a stale legacy one', () => {
  const { local } = boot({
    skycast_unit: 'celsius',
    weatherscope_unit: 'fahrenheit',
  });
  assert.equal(local.get('weatherscope_unit'), 'fahrenheit', 'the newer choice was overwritten');
  assert.equal(local.has('skycast_unit'), false, 'the stale legacy key was left behind');
});

test('a fresh visitor gets no storage keys invented for them', () => {
  const { local } = boot();
  assert.deepEqual([...local.keys()], [], 'booting invented storage entries');
});

// ==========================================================================
// 4. Writes go to the new key only
// ==========================================================================
test('every storage write targets the new key and clears the legacy one', () => {
  assert.equal(
    (appSource.match(/localStorage\.setItem\('skycast_/g) || []).length,
    0,
    'a raw legacy write survived'
  );
  assert.equal(
    (appSource.match(/sessionStorage\.setItem\('skycast_/g) || []).length,
    0,
    'a raw legacy session write survived'
  );
  // writeStored() is what both persisted settings go through, so it is the one
  // place that has to drop the old key on the way out.
  const writeStored = appSource.slice(
    appSource.indexOf('function writeStored('),
    appSource.indexOf('// State Management')
  );
  assert.match(writeStored, /localStorage\.setItem\(key, value\)/);
  assert.match(writeStored, /localStorage\.removeItem\(legacyKey\)/, 'a legacy key can come back to life');
});
