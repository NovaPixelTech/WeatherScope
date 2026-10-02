'use strict';
/**
 * SkyCast Compare Locations - wiring tests
 * =========================================================================
 * `compare.js` is pure, so what can still break is the glue: the browser
 * global, the script order, the element ids the app binds, the third tab, and
 * whether the render layer escapes what the engine returns.
 *
 *     node --test
 *
 * No DOM library is needed, matching `tests/wiring.test.js`: these assertions
 * read the markup, the CSS and the source.
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
  vm.runInContext(read('compare.js'), sandbox);
  return sandbox.SkyCastCompare || sandbox.window.SkyCastCompare;
}

const Compare = loadAsBrowserGlobal();

/** Ids present in the markup. */
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

/**
 * The Compare Locations section of app.js, from the engine lookup down to the
 * last render helper. Anchored on a phrase that appears in exactly one comment.
 */
function compareBlock() {
  const start = appSource.indexOf('function compareEngine()');
  return start === -1 ? '' : appSource.slice(start, appSource.indexOf('// Core Controller Actions'));
}

// ==========================================================================
// 1. Script loading
// ==========================================================================

test('compare.js registers itself as a browser global', () => {
  assert.ok(Compare, 'SkyCastCompare global is missing');
  assert.equal(typeof Compare.buildTable, 'function');
  assert.equal(typeof Compare.buildInsights, 'function');
});

test('compare.js is loaded before app.js so the global exists at init', () => {
  const compareScript = html.indexOf('src="compare.js"');
  const appScript = html.indexOf('src="app.js"');

  assert.notEqual(compareScript, -1, 'compare.js is not loaded by index.html');
  assert.notEqual(appScript, -1, 'app.js is not loaded by index.html');
  assert.ok(compareScript < appScript);
});

// ==========================================================================
// 2. Markup + element bindings
// ==========================================================================

test('every element the app binds by id exists in the markup', () => {
  const wanted = [...appSource.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(wanted.length > 20, 'suspiciously few bindings found');
  wanted.forEach((id) => assert.ok(htmlIds.has(id), `app.js binds #${id}, which is not in index.html`));
});

test('the comparison surface ships all of its regions', () => {
  [
    'compare-section',
    'compare-slots',
    'compare-count',
    'compare-notice',
    'compare-loading',
    'compare-glance-card',
    'compare-insights',
    'compare-current-card',
    'compare-current-table',
    'compare-forecast-card',
    'compare-forecast-table',
  ].forEach((id) => assert.ok(htmlIds.has(id), `#${id} is missing from index.html`));
});

test('Compare Locations is a third primary tab, in the same tablist', () => {
  assert.ok(htmlIds.has('tab-mode-compare'), 'the compare tab is missing');

  const tabs = [...html.matchAll(/id="(tab-mode-[a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['tab-mode-city', 'tab-mode-compare', 'tab-mode-climate']);
});

test('every tab is a real ARIA tab wired to the shared panel', () => {
  const tabTags = [...html.matchAll(/<button[^>]*id="tab-mode-[a-z]+"[^>]*>/g)].map((m) => m[0]);

  assert.equal(tabTags.length, 3);
  tabTags.forEach((tag) => {
    assert.match(tag, /role="tab"/);
    assert.match(tag, /aria-selected="(true|false)"/);
    assert.match(tag, /aria-controls="main-content"/);
  });
});

test('the comparison starts hidden, so it cannot leak before it is chosen', () => {
  const section = html.slice(html.indexOf('id="compare-section"'));
  const openTag = section.slice(0, section.indexOf('>'));
  assert.match(openTag, /class="[^"]*\bhidden\b/, 'compare-section must start hidden');
});

test('the loading and notice regions announce politely', () => {
  assert.match(html, /id="compare-notice"[^>]*role="status"/);
  assert.match(html, /id="compare-loading"[^>]*role="status"/);
});

test('both tables are given a caption or an accessible name', () => {
  assert.match(html, /<table[^>]*id="compare-current-table"/);
  assert.match(html, /<table[^>]*id="compare-forecast-table"/);
  ['compare-current-heading', 'compare-forecast-heading'].forEach((id) => {
    assert.ok(htmlIds.has(id), `#${id} is missing`);
    assert.match(html, new RegExp(`id="${id}"[^>]*aria-labelledby|id="${id}"`), 'heading must be a real heading');
  });
});

// ==========================================================================
// 3. Placement
// ==========================================================================

test('the comparison sits between the climate section and the dashboard', () => {
  const climate = html.indexOf('id="climate-results-section"');
  const compare = html.indexOf('id="compare-section"');
  const dashboard = html.indexOf('id="weather-dashboard"');

  assert.ok(compare > -1);
  assert.ok(compare < dashboard, 'the comparison must not be pushed below the dashboard');
  assert.ok(climate === -1 || climate < compare, 'the comparison belongs after the climate section');
});

// ==========================================================================
// 4. Source-level guarantees
// ==========================================================================

test('the three modes are all reachable through setMode', () => {
  ['city', 'climate', 'compare'].forEach((mode) => {
    assert.ok(
      new RegExp(`setMode\\('${mode}'\\)`).test(appSource),
      `no call site switches to the "${mode}" mode`
    );
  });
});

test('the app reads its comparison limits from the engine, not a second copy', () => {
  assert.match(appSource, /engine\.THRESHOLDS\.maxLocations/);
  assert.match(appSource, /engine\.canCompare\(/);
  assert.match(appSource, /engine\.canAddMore\(/);
});

test('columns are fetched independently so one failure cannot blank the rest', () => {
  assert.match(appSource, /Promise\.allSettled/);
  // A per-column status, not a single all-or-nothing error.
  assert.match(appSource, /retryIndex/);
});

test('a failed column gets a retry that refetches only itself', () => {
  assert.match(appSource, /loadComparisonWeather\(\{\s*retryIndex/);
});

test('the comparison reuses the dashboard payload for the current city', () => {
  assert.match(appSource, /isSameCity\(state\.currentCity, city\)/);
});

test('the compare section is initialised before first use', () => {
  const init = appSource.slice(appSource.lastIndexOf('function init()'));
  assert.match(init, /renderCompareSection\(\)/);
});

test('every compare picker button has an accessible name', () => {
  // Reorder, remove and the "Add" placeholders are all icon-only, so each one
  // needs a label the screen reader can announce.
  assert.match(appSource, /compareIconButton\('Move earlier'/);
  assert.match(appSource, /compareIconButton\('Move later'/);
  assert.match(appSource, /compareIconButton\(`Remove /);
  assert.match(appSource, /button\.setAttribute\('aria-label', label\)/);
});

test('picker buttons are typed, so Enter in a form never submits them by accident', () => {
  // Reorder, remove, the "Add" placeholders and the per-column retry are all
  // generated buttons that live inside or beside a form.
  const created = [...appSource.matchAll(/(\w+)\.type = 'button';/g)].map((m) => m[1]);
  assert.ok(created.length >= 4, `expected several typed buttons, found ${created.length}`);
  assert.ok(!created.some((v) => v === 'submit'));
});

test('the render layer writes engine text with textContent, never innerHTML', () => {
  const block = compareBlock();
  assert.notEqual(block.length, 0, 'the compare block was not found in app.js');

  // Every innerHTML in the block must be either the app's own inline SVG
  // weather icon, a static icon constant, or clearing a container. Nothing the
  // geocoding or forecast APIs return may ever be interpolated.
  const innerHtml = [...block.matchAll(/(\w[\w.]*)\.innerHTML\s*=\s*([^;]+);/g)];
  innerHtml.forEach(([, target, expr]) => {
    const value = expr.trim();
    const allowed = value === "''" || value === '""' || value === 'iconPath' || /compareConditionIcon/.test(value);
    assert.ok(allowed, `unexpected innerHTML in the compare block: ${target}.innerHTML = ${expr}`);
  });

  // The one variable innerHTML left is fed only by these four static constants.
  const iconArgs = [...block.matchAll(/compareIconButton\([^,]+,\s*([A-Z_]+)/g)].map((m) => m[1]);
  assert.ok(iconArgs.length >= 4, 'expected the reorder/remove controls');
  iconArgs.forEach((arg) => {
    assert.match(arg, /^ICON_/, `compareIconButton was handed "${arg}", which is not a static icon constant`);
    assert.match(appSource, new RegExp(`const ${arg} = '<svg`), `${arg} is not a literal SVG constant`);
  });

  assert.match(block, /value\.textContent = cell\.text/);
  assert.match(block, /ref\.errorText\.textContent !== reason/);
});

test('the shared clock registry is used, so no second timer is started', () => {
  assert.match(appSource, /compareClockIds\.push\(\s*registerClock\(/);
  assert.match(appSource, /function unregisterCompareClocks\(\)/);
});

test('the auto-refresh interval skips a hidden comparison', () => {
  assert.match(appSource, /if \(!isCompareVisible\(\)\) return;/);
});

// ==========================================================================
// 5. Styling
// ==========================================================================

test('every class the compare render layer applies is styled', () => {
  const used = new Set();
  const block = compareBlock();

  [...block.matchAll(/className = '([a-z0-9 -]+)'/g)].forEach((m) => m[1].split(' ').forEach((c) => used.add(c)));
  [...block.matchAll(/classList\.(?:add|toggle|remove)\('([a-z0-9 -]+)'/g)].forEach((m) => m[1].split(' ').forEach((c) => used.add(c)));

  assert.ok(used.size >= 15, `expected many compare classes, found ${used.size}`);
  used.forEach((cls) => assert.ok(css.includes(`.${cls}`), `.${cls} is applied in app.js but never styled`));
});

test('the extreme highlight is neutral, not a good/bad colour', () => {
  const start = css.indexOf('.compare-value[data-emphasis]');
  assert.notEqual(start, -1, 'the extremes are never emphasised');

  const block = css.slice(start, css.indexOf('}', start));
  assert.match(block, /font-weight|background|border|box-shadow/);
  assert.doesNotMatch(block, /--success|--danger|--warning|--green|--red|--orange/i);
});

test('both picker buttons and the table stay usable on a narrow screen', () => {
  assert.match(css, /@media[^{]*max-width/);
  assert.match(css, /\.compare-table-wrap\s*\{[^}]*overflow-x:\s*auto/);
});

test('the comparison ships no new dependency or build step', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'package.json')), false);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//);
});

// ==========================================================================
// 6. A realistic end-to-end pass through the engine
// ==========================================================================

test('two very different places produce a complete, readable comparison', () => {
  const warm = {
    city: { name: 'Athens', country: 'Greece', admin1: 'Attica' },
    weather: {
      current: { time: '2026-08-12T14:00', temperature_2m: 33, apparent_temperature: 35, relative_humidity_2m: 32, precipitation: 0, weather_code: 0, cloud_cover: 4, wind_speed_10m: 18, uv_index: 8.2, is_day: 1 },
      hourly: { time: ['2026-08-12T14:00'], precipitation_probability: [5] },
      daily: { temperature_2m_max: [37], temperature_2m_min: [24], precipitation_probability_max: [5], uv_index_max: [9.1], wind_speed_10m_max: [26], sunrise: ['2026-08-12T06:41'], sunset: ['2026-08-12T20:09'] },
    },
    error: null,
  };

  const cool = {
    city: { name: 'Oslo', country: 'Norway', admin1: 'Oslo' },
    weather: {
      current: { time: '2026-08-12T14:00', temperature_2m: 15, apparent_temperature: 13, relative_humidity_2m: 74, precipitation: 1.2, weather_code: 61, cloud_cover: 88, wind_speed_10m: 24, uv_index: 2.1, is_day: 1 },
      hourly: { time: ['2026-08-12T14:00'], precipitation_probability: [80] },
      daily: { temperature_2m_max: [18], temperature_2m_min: [11], precipitation_probability_max: [85], uv_index_max: [2.6], wind_speed_10m_max: [31], sunrise: ['2026-08-12T05:12'], sunset: ['2026-08-12T21:44'] },
    },
    error: null,
  };

  const format = { ...Compare.DEFAULT_FORMAT, windSymbol: 'km/h' };

  const current = Compare.buildTable([warm, cool], format);
  const forecast = Compare.buildForecastTable([warm, cool], format);
  const insights = Compare.buildInsights([warm, cool], format);

  assert.equal(current.okCount, 2);
  assert.ok(current.rows.length >= 8, 'the current table should be substantial');
  assert.ok(forecast.rows.length >= 4, 'the forecast table should be substantial');
  assert.ok(insights.length > 0, 'two very different places must say something');

  // Every rendered cell has to be printable text, never null/undefined/NaN.
  [current, forecast].forEach((table) => {
    table.rows.forEach((row) => {
      row.cells.forEach((cell) => {
        assert.equal(typeof cell.text, 'string');
        assert.doesNotMatch(cell.text, /NaN|undefined|null/);
      });
    });
  });

  insights.forEach((sentence) => {
    assert.equal(typeof sentence, 'string');
    assert.doesNotMatch(sentence, /NaN|undefined|null/);
  });
});