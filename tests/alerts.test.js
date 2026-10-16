'use strict';
/**
 * WeatherScope Weather Alerts - engine tests
 * =========================================================================
 * `alerts.js` decides whether a visitor's rule fires, so this suite pins down
 * the two things that could quietly lie to someone:
 *
 *   1. the window maths - "the next 2 hours" and "tomorrow" have to mean the
 *      city's own clock, not the visitor's; and
 *   2. the verdict - a rule fires only when a real reading in that window meets
 *      the comparator, and stays quiet (never a false alarm) when the data or
 *      the window is missing.
 *
 * The engine is pure, so `now` and the UTC offset are injected and the whole
 * thing runs in plain Node with no DOM, no network and no clock.
 *
 *     node --test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'alerts.js'), 'utf8');

// The engine as the browser loads it (a classic script publishing a global).
function loadAsBrowser() {
  const sandbox = { console, Date, Math, JSON, Number, Array, Object, String };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.WeatherScopeAlerts;
}

const A = require(path.join(ROOT, 'alerts.js'));

// ==========================================================================
// A small, fully controlled forecast
// --------------------------------------------------------------------------
// 96 hourly entries from 2026-10-16T00:00 in the city's own clock (offset 0),
// so index N is hour N and day boundaries fall on every 24th index.
// ==========================================================================

const NOW = Date.UTC(2026, 9, 16, 10, 30); // 2026-10-16T10:30, city-local too

function buildForecast(overrides) {
  const time = [];
  const hourly = {
    time: time,
    temperature_2m: [],
    apparent_temperature: [],
    precipitation: [],
    precipitation_probability: [],
    weather_code: [],
    wind_speed_10m: [],
    wind_gusts_10m: [],
    snowfall: [],
    uv_index: [],
  };

  const start = Date.UTC(2026, 9, 16, 0, 0);
  for (let i = 0; i < 96; i += 1) {
    const d = new Date(start + i * 3600000);
    const pad = (n) => (n < 10 ? '0' + n : String(n));
    time.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`);
    hourly.temperature_2m.push(15);
    hourly.apparent_temperature.push(15);
    hourly.precipitation.push(0);
    hourly.precipitation_probability.push(0);
    hourly.weather_code.push(0);
    hourly.wind_speed_10m.push(5);
    hourly.wind_gusts_10m.push(10);
    hourly.snowfall.push(0);
    hourly.uv_index.push(0);
  }

  Object.keys(overrides || {}).forEach((field) => {
    const spec = overrides[field];
    Object.keys(spec).forEach((index) => {
      hourly[field][Number(index)] = spec[index];
    });
  });

  return { latitude: 0, longitude: 0, utc_offset_seconds: 0, hourly: hourly };
}

function rule(overrides) {
  return A.sanitizeAlert(Object.assign({
    cityKey: '0,0', cityName: 'Testville', metric: 'rainChance',
    comparator: 'above', threshold: 60, window: 'h2', enabled: true, createdAt: 1,
  }, overrides));
}

const opts = { nowMs: NOW, utcOffsetSeconds: 0 };

// ==========================================================================
// 1. Loading & the shape of a rule
// ==========================================================================
test('the engine loads as a browser global and via require', () => {
  const browser = loadAsBrowser();
  assert.equal(typeof browser.evaluate, 'function');
  assert.equal(typeof browser.sanitizeAlerts, 'function');
  assert.deepEqual(browser.METRIC_IDS, A.METRIC_IDS);
});

test('a rule is normalized: defaults filled, values clamped, id derived', () => {
  const r = A.sanitizeAlert({ cityKey: '48.8566,2.3522', cityName: 'Paris', metric: 'rainAmount', window: 'h1' });
  assert.equal(r.comparator, 'above'); // metric default
  assert.equal(r.threshold, 1); // metric default
  assert.equal(r.enabled, true);
  assert.ok(r.id.length > 0);

  // A hand-edited threshold is clipped into the range the data can answer.
  const clipped = A.sanitizeAlert({ cityKey: '0,0', cityName: 'X', metric: 'rainChance', window: 'h1', threshold: 9999 });
  assert.equal(clipped.threshold, 100);

  // The weather code is a category: the comparator is forced to `present`.
  const storm = A.sanitizeAlert({ cityKey: '0,0', cityName: 'X', metric: 'storm', window: 'h1', comparator: 'above', threshold: 42 });
  assert.equal(storm.comparator, 'present');
  assert.equal(storm.threshold, 0);
});

test('a rule that could not be a rule is dropped, never stored', () => {
  assert.equal(A.sanitizeAlert(null), null);
  assert.equal(A.sanitizeAlert({ cityKey: 'nope', cityName: 'X', metric: 'rainChance', window: 'h1' }), null);
  assert.equal(A.sanitizeAlert({ cityKey: '0,0', cityName: '', metric: 'rainChance', window: 'h1' }), null);
  assert.equal(A.sanitizeAlert({ cityKey: '0,0', cityName: 'X', metric: 'made-up', window: 'h1' }), null);
  assert.equal(A.sanitizeAlert({ cityKey: '0,0', cityName: 'X', metric: 'rainChance', window: 'later' }), null);
});

test('a list is de-duplicated by id and capped', () => {
  const one = { cityKey: '0,0', cityName: 'X', metric: 'rainChance', window: 'h1', id: 'r1' };
  const list = A.sanitizeAlerts([one, one, { cityKey: '1,1', cityName: 'Y', metric: 'wind', window: 'h2', id: 'r2' }]);
  assert.equal(list.length, 2);

  const many = [];
  for (let i = 0; i < A.MAX_ALERTS + 20; i += 1) {
    many.push({ cityKey: '0,0', cityName: 'X', metric: 'rainChance', window: 'h1', threshold: i % 101, id: 'r' + i });
  }
  assert.equal(A.sanitizeAlerts(many).length, A.MAX_ALERTS);
});

// ==========================================================================
// 2. Windows against the city's own clock
// ==========================================================================
test('an hour window is the next N hours from the city\'s current hour', () => {
  const f = buildForecast({});
  // 10:30 local -> the current hour index is 10, so "next 2 hours" is 10..11.
  assert.deepEqual(A.windowRange('h2', f.hourly.time, NOW, 0), { start: 10, end: 12 });
  assert.deepEqual(A.windowRange('h1', f.hourly.time, NOW, 0), { start: 10, end: 11 });
  assert.deepEqual(A.windowRange('h24', f.hourly.time, NOW, 0), { start: 10, end: 34 });
});

test('today and tomorrow follow the calendar date of the city, not the visitor', () => {
  const f = buildForecast({});
  assert.deepEqual(A.windowRange('today', f.hourly.time, NOW, 0), { start: 10, end: 24 });
  assert.deepEqual(A.windowRange('tomorrow', f.hourly.time, NOW, 0), { start: 24, end: 48 });

  // A visitor six hours behind: the city is already into the next day, so
  // "tomorrow" must move with the *city's* clock.
  const behind = NOW - 6 * 3600000;
  assert.deepEqual(A.windowRange('today', f.hourly.time, behind, 0), { start: 4, end: 24 });
});

test('the UTC offset shifts the city clock the window is measured on', () => {
  const f = buildForecast({});
  // City is UTC+3: at 10:30 UTC it is 13:30 there, so the window starts at 13.
  assert.deepEqual(A.windowRange('h2', f.hourly.time, NOW, 3 * 3600), { start: 13, end: 15 });
});

// ==========================================================================
// 3. Verdicts
// ==========================================================================
test('a rain-chance rule fires on the peak of the window', () => {
  const f = buildForecast({ precipitation_probability: { 11: 70, 20: 90 } });
  const inWindow = A.evaluate(rule({ metric: 'rainChance', threshold: 60, window: 'h2' }), f, opts);
  assert.equal(inWindow.triggered, true);
  assert.equal(inWindow.peak, 70);
  assert.equal(inWindow.valueTime, f.hourly.time[11]);

  // The 90% at hour 20 is outside the two-hour window and must not count.
  const later = A.evaluate(rule({ metric: 'rainChance', threshold: 80, window: 'h2' }), f, opts);
  assert.equal(later.triggered, false);
  const wide = A.evaluate(rule({ metric: 'rainChance', threshold: 80, window: 'h24' }), f, opts);
  assert.equal(wide.triggered, true);
});

test('a temperature rule fires on the trough when the comparator is `below`', () => {
  const f = buildForecast({ temperature_2m: { 18: -4 } });
  const freezing = A.evaluate(rule({ metric: 'temperature', comparator: 'below', threshold: 0, window: 'today' }), f, opts);
  assert.equal(freezing.triggered, true);
  assert.equal(freezing.value, -4);

  // A warm hour elsewhere must not satisfy a "below" rule.
  const f2 = buildForecast({});
  assert.equal(A.evaluate(rule({ metric: 'temperature', comparator: 'below', threshold: 0, window: 'today' }), f2, opts).triggered, false);
});

test('a snow rule reads snowfall and a wind rule reads wind speed', () => {
  const f = buildForecast({ snowfall: { 12: 2.5 }, wind_speed_10m: { 13: 55 } });
  assert.equal(A.evaluate(rule({ metric: 'snow', threshold: 1, window: 'h6' }), f, opts).triggered, true);
  assert.equal(A.evaluate(rule({ metric: 'wind', threshold: 50, window: 'h6' }), f, opts).triggered, true);
  assert.equal(A.evaluate(rule({ metric: 'wind', threshold: 80, window: 'h6' }), f, opts).triggered, false);
});

test('a storm rule fires when a thunderstorm code appears anywhere in the window', () => {
  const f = buildForecast({ weather_code: { 30: 95 } });
  assert.equal(A.evaluate(rule({ metric: 'storm', window: 'tomorrow' }), f, opts).triggered, true);
  assert.equal(A.evaluate(rule({ metric: 'storm', window: 'today' }), f, opts).triggered, false);
});

test('a UV rule reads the hourly uv index', () => {
  const f = buildForecast({ uv_index: { 12: 8 } });
  assert.equal(A.evaluate(rule({ metric: 'uv', threshold: 6, window: 'h3' }), f, opts).triggered, true);
  assert.equal(A.evaluate(rule({ metric: 'uv', threshold: 11, window: 'h3' }), f, opts).triggered, false);
});

// ==========================================================================
// 4. Degrading, never alarming
// ==========================================================================
test('a metric the payload does not carry is not-enough-data, never a false alarm', () => {
  const f = buildForecast({});
  delete f.hourly.snowfall;
  const result = A.evaluate(rule({ metric: 'snow', window: 'h6' }), f, opts);
  assert.equal(result.triggered, false);
  assert.equal(result.reason, 'no-data');
});

test('a forecast with no hourly block is not-enough-data', () => {
  const result = A.evaluate(rule({ window: 'h1' }), { current: {} }, opts);
  assert.equal(result.triggered, false);
  assert.equal(result.reason, 'no-data');
});

test('evaluateAll returns a verdict per rule, in order', () => {
  const f = buildForecast({ precipitation_probability: { 11: 70 } });
  const rules = [
    rule({ metric: 'rainChance', threshold: 60, window: 'h2', id: 'a' }),
    rule({ metric: 'rainChance', threshold: 90, window: 'h2', id: 'b' }),
  ];
  const results = A.evaluateAll(rules, f, opts);
  assert.equal(results.length, 2);
  assert.equal(results[0].result.triggered, true);
  assert.equal(results[1].result.triggered, false);
});
