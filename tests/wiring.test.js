'use strict';
/**
 * WeatherScope Weather Assistant - dashboard wiring tests
 * =========================================================================
 * The engine is pure, so what can still break is the glue: the browser global,
 * the script order, the element ids the app binds, the placement of the card,
 * and whether the render layer escapes what the engine returns.
 *
 *     node --test
 *
 * No DOM library is needed: these assertions read the markup and the source,
 * and they drive the engine itself with a realistic hourly payload.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

const html = read('index.html');
const appSource = read('app.js');
const css = read('styles.css');

// --- The engine as the browser actually loads it ---------------------------

function loadAsBrowserGlobal() {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('advice.js'), sandbox);
  return sandbox.WeatherScopeAdvice || sandbox.window.WeatherScopeAdvice;
}

const Advice = loadAsBrowserGlobal();

// ==========================================================================
// 1. Script loading
// ==========================================================================
test('advice.js registers itself as a browser global', () => {
  assert.ok(Advice, 'WeatherScopeAdvice global is missing');
  assert.equal(typeof Advice.getAdviceBundle, 'function');
  assert.equal(typeof Advice.getRecommendations, 'function');
  assert.equal(typeof Advice.analyze, 'function');
});

test('advice.js is loaded before app.js so the global exists at init', () => {
  const adviceScript = html.indexOf('src="advice.js"');
  const appScript = html.indexOf('src="app.js"');
  assert.notEqual(adviceScript, -1, 'advice.js is not loaded by index.html');
  assert.notEqual(appScript, -1, 'app.js is not loaded by index.html');
  assert.ok(adviceScript < appScript);
});

// ==========================================================================
// 2. Markup + element bindings
// ==========================================================================
test('every element the assistant renders into exists and is bound', () => {
  const ids = [
    'assistant-card',
    'assistant-scope',
    'assistant-summary',
    'assistant-summary-icon',
    'assistant-summary-headline',
    'assistant-summary-detail',
    'assistant-grid',
    'assistant-window-tabs',
    'assistant-window-answer',
  ];

  ids.forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `#${id} is missing from index.html`);
    assert.ok(
      appSource.includes(`getElementById('${id}')`),
      `#${id} is never read by app.js`
    );
  });
});

test('the assistant card sits directly after the hero card', () => {
  const hero = html.indexOf('id="hero-card"');
  const assistant = html.indexOf('id="assistant-card"');
  const metrics = html.indexOf('aria-label="Key Weather Metrics"');

  assert.ok(hero !== -1 && assistant !== -1 && metrics !== -1);
  assert.ok(hero < assistant, 'the assistant must come after the current-weather card');
  assert.ok(assistant < metrics, 'the assistant must come before the metrics grid');
});

test('the markup ships the accessibility scaffolding the renderer relies on', () => {
  assert.match(html, /role="radiogroup"/, 'the window tabs need a radiogroup');
  assert.match(html, /aria-live="polite"/, 'live regions are needed for the spoken updates');
  assert.match(html, /class="assistant-grid" id="assistant-grid" role="list"/);
});

test('the card starts hidden so an unfinished load never flashes a stale answer', () => {
  assert.match(html, /<section class="card assistant-card" id="assistant-card"[^>]*hidden/);
});

// ==========================================================================
// 3. Styling
// ==========================================================================
test('every assistant class used by the renderer is styled', () => {
  [
    'assistant-card',
    'assistant-header',
    'assistant-summary',
    'assistant-grid',
    'assistant-tile',
    'assistant-window',
    'assistant-window-tab',
    'assistant-window-answer',
  ].forEach((name) => {
    assert.ok(css.includes(`.${name}`), `.${name} has no styles`);
  });
});

test('the window tabs expose a visible keyboard focus ring', () => {
  const block = css.slice(css.indexOf('.assistant-window-tab:focus-visible'));
  assert.ok(block.length > 0);
  assert.match(block.slice(0, 160), /outline/);
});

// ==========================================================================
// 4. Render safety
// ==========================================================================
test('the render layer writes engine text with textContent, never innerHTML', () => {
  const block = appSource.slice(
    appSource.indexOf('function renderAssistant('),
    appSource.indexOf('function renderDailyForecast(')
  );

  assert.ok(block.length > 0, 'renderAssistant was not found');
  // The only innerHTML assignment in the block clears the grid before it is
  // rebuilt from real DOM nodes.
  const assignments = block.match(/[\w.]*\s*\binnerHTML\s*=\s*[^;]+;/g) || [];
  assignments.forEach((line) => {
    assert.match(line, /innerHTML\s*=\s*'';\s*$/, `unexpected innerHTML use: ${line}`);
  });
  assert.ok((block.match(/textContent/g) || []).length >= 6);
});

test('the assistant never persists anything about the visitor', () => {
  const block = appSource.slice(
    appSource.indexOf('function adviceFormat()'),
    appSource.indexOf('function renderDailyForecast(')
  );
  assert.ok(block.length > 0, 'the assistant block was not found');
  assert.ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(block));
});

// ==========================================================================
// 5. A realistic forecast renders
// ==========================================================================
const FORMAT = {
  temp: (c) => String(Math.round(c)),
  tempSymbol: '°C',
  wind: (k) => Number(k).toFixed(1),
  windSymbol: 'km/h',
  precip: (m) => Number(m).toFixed(1),
  precipSymbol: 'mm',
};

function realisticHourly() {
  const time = [];
  for (let i = 0; i < 48; i++) {
    const d = new Date(Date.UTC(2026, 9, 2, 12) + i * 3600000);
    time.push(d.toISOString().slice(0, 13) + ':00');
  }
  return {
    time,
    temperature_2m: time.map((_, i) => 14 + 8 * Math.sin(((i + 12) % 24) / 24 * Math.PI * 2)),
    apparent_temperature: time.map((_, i) => 12 + 8 * Math.sin(((i + 12) % 24) / 24 * Math.PI * 2)),
    precipitation: time.map((_, i) => (i % 17 < 4 ? 0.8 : 0)),
    precipitation_probability: time.map((_, i) => (i % 17 < 4 ? 65 : 5)),
    wind_speed_10m: time.map(() => 14),
    cloud_cover: time.map(() => 40),
    weather_code: time.map((_, i) => (i % 17 < 4 ? 61 : 2)),
    is_day: time.map((_, i) => {
      const hour = (i + 12) % 24;
      return hour >= 7 && hour <= 19 ? 1 : 0;
    }),
  };
}

test('a realistic payload produces a full set of renderable strings', () => {
  const profile = Advice.analyze({
    hourly: realisticHourly(),
    currentTime: '2026-10-02T12:00',
    uvMax: 5,
    format: FORMAT,
  });

  assert.equal(profile.ok, true);

  const built = Advice.getRecommendations(profile, 'afternoon');
  Advice.ADVICE_ORDER.forEach((key) => {
    const tile = built.decisions[key];
    assert.ok(tile, `missing tile: ${key}`);
    assert.ok(tile.headline.length > 0, `empty headline: ${key}`);
    assert.ok(['good', 'warn', 'bad', 'unknown'].includes(tile.tone), `bad tone on ${key}`);
  });

  assert.ok(built.summary.headline.length > 0);
  assert.ok(built.rainWindow.headline.length > 0);
  assert.equal(built.rainWindow.window, 'afternoon');
});

test('the memoised profile survives a window switch without re-analysing', () => {
  const profile = Advice.analyze({
    hourly: realisticHourly(),
    currentTime: '2026-10-02T12:00',
    format: FORMAT,
  });

  const first = Advice.getRecommendations(profile, 'morning');
  const second = Advice.getRecommendations(profile, 'evening');

  assert.equal(first.rainWindow.window, 'morning');
  assert.equal(second.rainWindow.window, 'evening');
  assert.equal(first.rainWindow.headline === second.rainWindow.headline, false,
    'the answer should depend on the selected window');
  Advice.ADVICE_ORDER.forEach((key) => {
    assert.equal(first.decisions[key].headline, second.decisions[key].headline);
  });
});

test('a city with no forecast data hides the card instead of showing empty tiles', () => {
  const profile = Advice.analyze({ hourly: null, currentTime: null, format: FORMAT });
  assert.equal(profile.ok, false);

  const built = Advice.getRecommendations(profile, 'morning');
  Advice.ADVICE_ORDER.forEach((key) => {
    assert.equal(built.decisions[key].ok, false);
    assert.equal(built.decisions[key].headline, 'Not enough forecast data');
  });
});