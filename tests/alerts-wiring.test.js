'use strict';
/**
 * WeatherScope Weather Alerts - wiring tests
 * =========================================================================
 * The alerts engine (`alerts.js`) has its own suite, and the server and the
 * favorites client are covered where they live. What this file protects is the
 * glue no engine test can see:
 *
 *   1. the script order that makes the browser global available at init;
 *   2. the element ids the app binds and the markup that must exist for them;
 *   3. the placement that keeps the bell and its panel anchored in the header;
 *   4. the styling of every class the render layer creates;
 *   5. that every alerts.* string the UI can show exists in all six languages;
 *   6. that a rule is composed as text, never as markup.
 *
 *     node --test
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

const I18n = require(path.join(ROOT, 'i18n.js'));
I18n.translations.fr = require(path.join(ROOT, 'fr.js'));

const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Ids present in the markup. */
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

function loadAsBrowserGlobal() {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('alerts.js'), sandbox);
  return sandbox.WeatherScopeAlerts || sandbox.window.WeatherScopeAlerts;
}

const Alerts = loadAsBrowserGlobal();

// ==========================================================================
// 1. Script loading
// ==========================================================================
test('alerts.js registers itself as a browser global for the app to use', () => {
  assert.ok(Alerts, 'WeatherScopeAlerts global is missing');
  assert.equal(typeof Alerts.sanitizeAlerts, 'function');
  assert.equal(typeof Alerts.evaluate, 'function');
  assert.equal(typeof Alerts.windowRange, 'function');
});

test('alerts.js is loaded before app.js so the global exists at init', () => {
  const alertsScript = html.indexOf('src="alerts.js"');
  const appScript = html.indexOf('src="app.js"');
  assert.notEqual(alertsScript, -1, 'alerts.js is not loaded by index.html');
  assert.notEqual(appScript, -1, 'app.js is not loaded by index.html');
  assert.ok(alertsScript < appScript, 'alerts.js must load before app.js');
});

// ==========================================================================
// 2. Markup + element bindings
// ==========================================================================
test('every weather-alert element exists and is bound', () => {
  [
    'alerts-btn',
    'alerts-badge',
    'alerts-panel',
    'alerts-panel-title',
    'alerts-close-btn',
    'alerts-signed-out',
    'alerts-signed-in',
    'alerts-signin-hint',
    'alerts-active-list',
    'alerts-active-empty',
    'alerts-status',
    'alerts-add-btn',
    'alerts-refresh-btn',
    'alerts-notify-btn',
    'alerts-rules-list',
    'alerts-rules-empty',
    'alerts-form',
    'alerts-form-title',
    'alerts-city',
    'alerts-metric',
    'alerts-comparator',
    'alerts-comparator-row',
    'alerts-threshold',
    'alerts-threshold-row',
    'alerts-threshold-unit',
    'alerts-window',
    'alerts-form-error',
    'alerts-save-btn',
    'alerts-cancel-btn',
  ].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `#${id} is missing from index.html`);
    assert.ok(
      appSource.includes(`getElementById('${id}')`),
      `#${id} is never read by app.js`
    );
  });
});

test('the alert bell and its panel live in the header controls', () => {
  const controls = html.indexOf('class="header-controls"');
  const headerEnd = html.indexOf('</header>');
  const button = html.indexOf('id="alerts-btn"');
  const panel = html.indexOf('id="alerts-panel"');

  assert.ok(controls !== -1 && headerEnd !== -1, 'the header is missing');
  assert.ok(button > controls && button < headerEnd, 'the bell is not in the header');
  assert.ok(panel > html.indexOf('class="language-picker"'),
    'the alerts panel must sit inside the header controls, after the pickers');
  assert.ok(panel < html.indexOf('</header>'), 'the alerts panel left the header');
});

test('the alerts panel opens hidden, like the account panel', () => {
  const open = html.slice(html.indexOf('<div class="alerts-panel'));
  assert.match(open.slice(0, open.indexOf('>')), /class="alerts-panel[^"]*\bhidden\b/,
    'the alerts panel must start hidden');
});

// ==========================================================================
// 3. Styling
// ==========================================================================
test('every class the alerts renderer creates is styled', () => {
  [
    'alerts-btn',
    'alerts-badge',
    'alerts-panel',
    'alerts-section-title',
    'alerts-empty',
    'alerts-status',
    'alerts-active-list',
    'alerts-rules-list',
    'alert-active-item',
    'alert-active-city',
    'alert-active-detail',
    'alerts-toolbar',
    'alerts-notify-btn',
    'alerts-form',
    'alerts-threshold-row',
    'alerts-threshold-input',
    'alerts-threshold-unit',
    'alerts-form-actions',
    'alert-rule',
    'alert-rule-toggle',
    'alert-rule-body',
    'alert-rule-city',
    'alert-rule-summary',
    'alert-rule-actions',
    'alert-rule-action',
    'alert-rule-delete',
  ].forEach((name) => {
    assert.ok(css.includes(`.${name}`), `.${name} has no styles`);
  });
});

test('the bell and every rule control expose a visible focus ring', () => {
  for (const selector of ['.alerts-btn:focus-visible', '.alert-rule-action:focus-visible']) {
    assert.ok(css.includes(selector), `${selector} is missing`);
    const block = css.slice(css.indexOf(selector));
    assert.match(block.slice(0, 160), /outline/, `${selector} needs a focus ring`);
  }
});

// ==========================================================================
// 4. Localisation
// ==========================================================================
test('the alert strings used at runtime exist in English', () => {
  const en = I18n.translations.en;
  const fixed = [
    'alerts.button', 'alerts.buttonActive', 'alerts.panelTitle', 'alerts.close',
    'alerts.signInHint', 'alerts.activeHeading', 'alerts.rulesHeading', 'alerts.noActive',
    'alerts.none', 'alerts.new', 'alerts.edit', 'alerts.save', 'alerts.cancel',
    'alerts.check', 'alerts.checking', 'alerts.checked', 'alerts.added', 'alerts.removed',
    'alerts.paused', 'alerts.city', 'alerts.condition', 'alerts.comparator', 'alerts.threshold',
    'alerts.window', 'alerts.above', 'alerts.below', 'alerts.delete', 'alerts.deleteAria',
    'alerts.editAria', 'alerts.toggleAria', 'alerts.at', 'alerts.noFavorites',
    'alerts.errThreshold', 'alerts.errInvalid', 'alerts.enable', 'alerts.enabled',
    'alerts.blocked', 'alerts.notificationTitle', 'alerts.window.hours',
    'alerts.window.today', 'alerts.window.tomorrow', 'alerts.window.d3', 'alerts.window.d7',
  ];
  fixed.forEach((key) => {
    assert.equal(typeof en[key], 'string', `English is missing ${key}`);
  });

  // One label per condition and a window label for every window the engine knows.
  Alerts.METRIC_IDS.forEach((id) => {
    assert.equal(typeof en['alerts.metric.' + id], 'string', `English is missing alerts.metric.${id}`);
  });
  Alerts.WINDOW_IDS.forEach((id) => {
    const def = Alerts.WINDOWS[id];
    const key = def.kind === 'hours' ? 'alerts.window.hours' : 'alerts.window.' + id;
    assert.equal(typeof en[key], 'string', `English is missing ${key} for window ${id}`);
  });
});

test('all six languages carry every alert key with the same placeholders', () => {
  const en = I18n.translations.en;
  const keys = Object.keys(en).filter((key) => key.indexOf('alerts.') === 0);
  assert.ok(keys.length >= 45, 'suspiciously few alert strings');

  for (const lang of ['el', 'de', 'it', 'es', 'fr']) {
    const dictionary = I18n.translations[lang];
    assert.ok(dictionary, `${lang} dictionary is missing`);
    keys.forEach((key) => {
      assert.equal(typeof dictionary[key], 'string', `${lang} is missing ${key}`);
      assert.deepEqual(placeholders(dictionary[key]), placeholders(en[key]),
        `${lang}.${key} must keep the English interpolation placeholders`);
    });
  }
});

// ==========================================================================
// 5. Render safety
// ==========================================================================
test('a rule is described with textContent, never with markup', () => {
  const start = appSource.indexOf('function renderAlertRules()');
  const end = appSource.indexOf('function buildAlertForm()');
  const block = appSource.slice(start, end);

  assert.ok(start !== -1 && end > start, 'renderAlertRules was not found');
  assert.match(block, /city\.textContent\s*=\s*rule\.cityName/,
    'the rule city must be set with textContent');
  assert.doesNotMatch(block, /innerHTML\s*=[^;]*rule/,
    'a rule must never reach innerHTML');
});

test('a browser notification is only raised once a rule has just started to hold', () => {
  const block = appSource.slice(appSource.indexOf('async function checkAlerts'));
  assert.match(block.slice(0, 2600), /state\.alerts\.hydrated\s*&&\s*before\s*&&\s*!before\.triggered/,
    'the transition guard is missing');
});
