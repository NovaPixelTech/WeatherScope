'use strict';
/**
 * WeatherScope "Today at a Glance" - dashboard wiring tests
 * =========================================================================
 * The engine is pure, so what can still break is the glue: the browser global,
 * the script order, the element ids the app binds, the placement of the card,
 * the accessibility scaffolding the renderer relies on, and whether the render
 * layer escapes what the engine returns.
 *
 *     node --test
 *
 * No DOM library is needed: these assertions read the markup, the stylesheet and
 * the source, and they drive the engine itself with a realistic payload.
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
  vm.runInContext(read('glance.js'), sandbox);
  return sandbox.WeatherScopeGlance || sandbox.window.WeatherScopeGlance;
}

const Glance = loadAsBrowserGlobal();

// ==========================================================================
// 1. Script loading
// ==========================================================================
test('glance.js registers itself as a browser global', () => {
  assert.ok(Glance, 'WeatherScopeGlance global is missing');
  assert.equal(typeof Glance.build, 'function');
  assert.ok(Glance.THRESHOLDS);
  assert.ok(Glance.VERDICTS.good);
  assert.ok(Glance.VERDICTS.umbrella);
});

test('glance.js is loaded before app.js so the global exists at init', () => {
  const glanceScript = html.indexOf('src="glance.js"');
  const appScript = html.indexOf('src="app.js"');
  assert.notEqual(glanceScript, -1, 'glance.js is not loaded by index.html');
  assert.notEqual(appScript, -1, 'app.js is not loaded by index.html');
  assert.ok(glanceScript < appScript);
});

// ==========================================================================
// 2. Markup + element bindings
// ==========================================================================
test('every element the glance renders into exists and is bound', () => {
  const ids = [
    'glance-card',
    'glance-location',
    'glance-location-meta',
    'glance-temp',
    'glance-temp-symbol',
    'glance-feels-like',
    'glance-condition',
    'glance-weather-icon',
    'glance-metrics',
    'glance-verdict',
    'glance-verdict-icon',
    'glance-verdict-headline',
    'glance-verdict-detail',
    'glance-wear',
    'glance-wear-icon',
    'glance-wear-headline',
    'glance-wear-detail',
  ];

  ids.forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `#${id} is missing from index.html`);
    assert.ok(
      appSource.includes(`getElementById('${id}')`),
      `#${id} is never read by app.js`
    );
  });
});

test('the glance card is the first card in the dashboard', () => {
  const dashboard = html.indexOf('id="weather-dashboard"');
  const glance = html.indexOf('id="glance-card"');
  const hero = html.indexOf('id="hero-card"');

  assert.ok(dashboard !== -1 && glance !== -1 && hero !== -1);
  assert.ok(dashboard < glance, 'the glance must live inside the dashboard');
  assert.ok(glance < hero, '"Today at a glance" must come before the hero card');
});

test('"what to wear" sits under the verdict, inside the glance card', () => {
  const verdict = html.indexOf('id="glance-verdict"');
  const wear = html.indexOf('id="glance-wear"');
  const hero = html.indexOf('id="hero-card"');

  assert.ok(verdict !== -1 && wear !== -1, 'the wear strip is missing from index.html');
  assert.ok(verdict < wear, 'the clothing answer belongs under the verdict');
  assert.ok(wear < hero, 'the wear strip must stay inside the glance card');
});

test('the card starts hidden so a refresh never flashes yesterday\'s answer', () => {
  assert.match(html, /<section class="card glance-card" id="glance-card"[^>]*hidden/);
});

test('the markup ships the accessibility scaffolding the renderer relies on', () => {
  const section = html.slice(html.indexOf('id="glance-card"'), html.indexOf('id="hero-card"'));

  assert.match(section, /aria-labelledby="glance-heading"/, 'the card needs an accessible name');
  assert.match(section, /id="glance-heading"[^>]*>Today at a glance</, 'the visible heading must match');
  assert.match(section, /role="status"/, 'the verdict is the card\'s answer and must be announced');
  assert.match(section, /aria-live="polite"/);
  assert.match(section, /id="glance-metrics" role="list"/, 'the metrics need a list role');
  assert.match(section, /aria-hidden="true"/, 'decorative glyphs must be hidden from AT');
});

// ==========================================================================
// 3. Styling
// ==========================================================================
test('every glance class the renderer uses is styled', () => {
  [
    'glance-card',
    'glance-head',
    'glance-location',
    'glance-location-name',
    'glance-location-meta',
    'glance-temp',
    'glance-temp-main',
    'glance-temp-value',
    'glance-temp-symbol',
    'glance-feels-like',
    'glance-condition',
    'glance-weather-icon',
    'glance-condition-text',
    'glance-metrics',
    'glance-metric',
    'glance-metric-label',
    'glance-metric-value',
    'glance-metric-note',
    'glance-metric-hint',
    'glance-verdict',
    'glance-verdict-icon',
    'glance-verdict-label',
    'glance-verdict-headline',
    'glance-verdict-detail',
    'glance-wear',
    'glance-wear-icon',
    'glance-wear-label',
    'glance-wear-headline',
    'glance-wear-detail',
  ].forEach((name) => {
    assert.ok(css.includes(`.${name}`), `.${name} has no styles`);
  });
});

test('every tone the engine can emit has a visible colour', () => {
  ['good', 'caution', 'warn', 'bad', 'unknown'].forEach((tone) => {
    assert.match(css, new RegExp(`\\.glance-verdict\\[data-tone='${tone}'\\]`), `tone ${tone} is unstyled`);
  });
});

test('the wear strip starts hidden and colours every tone it can inherit', () => {
  assert.match(html, /<div class="glance-wear" id="glance-wear"[^>]*hidden/);
  assert.match(css, /\.glance-wear\[hidden\]\s*\{\s*display:\s*none;/);
  ['good', 'caution', 'warn', 'bad', 'unknown'].forEach((tone) => {
    assert.match(css, new RegExp(`\\.glance-wear\\[data-tone='${tone}'\\]`), `tone ${tone} is unstyled`);
  });
});

test('the glance mirrors the clothing tile instead of re-analysing the forecast', () => {
  const block = appSource.slice(
    appSource.indexOf('function renderGlanceWear('),
    appSource.indexOf('function generateShareText(')
  );

  assert.ok(block.length > 0, 'renderGlanceWear was not found');
  assert.match(block, /getAdviceProfile\(data\)/, 'it must reuse the memoised profile');
  assert.match(block, /\.clothing/, 'it reads the clothing decision');
  assert.doesNotMatch(block, /WeatherScopeAdvice\.analyze\(/, 'the hourly payload must not be analysed twice');
});

test('the assistant card is untouched: it still builds its own clothing tile', () => {
  const advice = read('advice.js');
  const order = (advice.match(/const ADVICE_ORDER = \[([^\]]*)\]/) || [])[1] || '';

  assert.ok(order.includes('clothing'), 'the clothing tile is still in the assistant grid');
  assert.match(appSource, /window\.WeatherScopeAdvice\.ADVICE_ORDER\.forEach/, 'the assistant still renders its tiles');
  assert.match(appSource, /getElementById\('glance-wear'\)/, 'the glance strip has its own binding');
});

test('the spoken-only metric hint is genuinely hidden, not just small', () => {
  const block = css.slice(css.indexOf('.glance-metric-hint {'), css.indexOf('.glance-verdict {'));
  assert.ok(block.length > 0, '.glance-metric-hint has no styles');
  assert.match(block, /position:\s*absolute/);
  assert.match(block, /clip-path:\s*inset\(50%\)/);
});

test('the hidden card stays hidden despite the flex display', () => {
  assert.match(css, /\.glance-card\[hidden\]\s*\{\s*display:\s*none;/);
});

// ==========================================================================
// 4. Render safety
// ==========================================================================
test('the render layer writes engine text with textContent, never innerHTML', () => {
  const block = appSource.slice(
    appSource.indexOf('function renderGlance('),
    appSource.indexOf('function renderWeather()')
  );

  assert.ok(block.length > 0, 'renderGlance was not found');

  const assignments = block.match(/[\w.]*\s*\binnerHTML\s*=\s*[^;]+;/g) || [];
  assignments.forEach((line) => {
    const clears = /innerHTML\s*=\s*'';\s*$/.test(line);
    const generatedIcon = /glanceWeatherIcon\.innerHTML\s*=\s*getWeatherSvg\(/.test(line);
    assert.ok(clears || generatedIcon, `unexpected innerHTML use: ${line}`);
  });

  assert.ok((block.match(/textContent/g) || []).length >= 9);
});

test('a payload that throws cannot take the dashboard down with it', () => {
  const block = appSource.slice(appSource.indexOf('function renderGlance('), appSource.indexOf('function renderWeather()'));
  assert.match(block, /try\s*\{/);
  assert.match(block, /catch\s*\(/);
  assert.match(block, /card\.hidden = true/, 'an unusable payload must hide the card');
});

test('the glance never persists anything about the visitor', () => {
  const block = appSource.slice(
    appSource.indexOf('function glanceFormat()'),
    appSource.indexOf('function renderWeather()')
  );
  assert.ok(block.length > 0, 'the glance block was not found');
  assert.ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(block));
});

test('the glance is rendered from the same payload as the rest of the dashboard', () => {
  const renderWeather = appSource.slice(
    appSource.indexOf('function renderWeather()'),
    appSource.indexOf('function renderHourlyForecast(')
  );

  assert.match(renderWeather, /renderGlance\(data\);/, 'renderWeather must paint the glance');
  // ...and before it switches to the dashboard, so the summary is never stale.
  const glanceAt = renderWeather.indexOf('renderGlance(data);');
  const revealAt = renderWeather.indexOf("elements.dashboard.classList.remove('hidden')");
  assert.ok(glanceAt !== -1 && revealAt !== -1 && glanceAt < revealAt);
});

// ==========================================================================
// 5. A realistic payload renders
// ==========================================================================
const FORMAT = {
  temp: (c) => String(Math.round(c)),
  tempSymbol: '°C',
  wind: (kmh) => Number(kmh).toFixed(1),
  windSymbol: 'km/h',
  precip: (mm) => Number(mm).toFixed(1),
  precipSymbol: 'mm',
  percent: (v) => `${Math.round(v)}%`,
  cardinal: () => 'NW',
  conditionLabel: (code) => (code === 3 ? 'Overcast' : 'Clear sky'),
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
    precipitation: time.map(() => 0),
    precipitation_probability: time.map((_, i) => (i % 17 < 4 ? 65 : 5)),
    wind_speed_10m: time.map(() => 14),
    weather_code: time.map(() => 3),
  };
}

test('a realistic payload produces a full set of renderable strings', () => {
  const glance = Glance.build({
    current: {
      temperature_2m: 17,
      apparent_temperature: 16,
      weather_code: 3,
      relative_humidity_2m: 72,
      wind_speed_10m: 14,
      wind_direction_10m: 315,
      precipitation: 0,
      time: '2026-10-02T14:00',
    },
    hourly: realisticHourly(),
    currentTime: '2026-10-02T14:00',
    city: { name: 'Gütersloh', admin1: 'North Rhine-Westphalia', country: 'Germany' },
    format: FORMAT,
  });

  assert.equal(glance.ok, true);
  assert.equal(glance.location.name, 'Gütersloh');
  assert.equal(glance.condition, 'Overcast');
  assert.ok(glance.temperature.length > 0);
  assert.ok(glance.feelsLike.length > 0);
  assert.ok(glance.verdict.icon.length > 0);
  assert.ok(glance.verdict.text.length > 0);
  assert.ok(glance.verdict.detail.length > 0);

  glance.metrics.forEach((metric) => {
    assert.ok(metric.label.length > 0, 'a metric has no label');
    assert.ok(metric.value.length > 0, `metric ${metric.key} has no value`);
    assert.equal(typeof metric.hint === 'string' || metric.hint === null, true);
  });
});

test('the app binds the same element ids the engine output is painted into', () => {
  // The metric node classes are created by app.js, so they must exist in CSS
  // (covered above) *and* be spelled identically in both files.
  ['glance-metric', 'glance-metric-label', 'glance-metric-value', 'glance-metric-note', 'glance-metric-hint']
    .forEach((name) => {
      assert.ok(appSource.includes(`className = '${name}'`), `app.js never creates .${name}`);
    });
});