'use strict';
/**
 * WeatherScope Accounts & Favorites - wiring tests
 * =========================================================================
 * The favorites engine (`favorites.js`) and the server are covered by their
 * own suites. What this file protects is the glue that no engine test can see:
 *
 *   1. the script order that makes the browser global available at init;
 *   2. the element ids the app binds and the markup that must exist for them;
 *   3. the placement that keeps the panel anchored and the bar reachable;
 *   4. the styling of every class the render layer creates; and
 *   5. that the render layer writes a saved name as text, never as markup.
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

const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)]
  .map((match) => match[1]).sort();

// --- The engine as the browser actually loads it ---------------------------
function loadAsBrowserGlobal() {
  const sandbox = { window: {}, console, setTimeout, clearTimeout };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('favorites.js'), sandbox);
  return sandbox.WeatherScopeFavorites || sandbox.window.WeatherScopeFavorites;
}

const Favorites = loadAsBrowserGlobal();

// ==========================================================================
// 1. Script loading
// ==========================================================================
test('favorites.js registers itself as a browser global for the app to use', () => {
  assert.ok(Favorites, 'WeatherScopeFavorites global is missing');
  assert.equal(typeof Favorites.createClient, 'function');
  assert.equal(typeof Favorites.isFavorite, 'function');
  assert.equal(typeof Favorites.cityKey, 'function');
  // The browser-only store ships with the same global, so a static host can
  // still offer accounts.
  assert.equal(typeof Favorites.createLocalClient, 'function');
  assert.equal(typeof Favorites.isLocalToken, 'function');
});

test('the app falls back to the local store when no API answers', () => {
  // The router is what makes GitHub Pages usable: a `local:` session is routed
  // to the browser store, and a fresh sign-up only falls through on a host with
  // no API at all (unavailable/network), never on a real rejected credential.
  const block = appSource.slice(
    appSource.indexOf('function getServerFavoritesClient()'),
    appSource.indexOf('function readStoredSession()')
  );
  assert.ok(block.length > 0, 'getFavoritesClient was not found');
  assert.match(block, /createLocalClient/, 'the app never builds a local client');
  assert.match(block, /isLocalToken/, 'the router does not tell local sessions apart');
  assert.match(block, /'unavailable'/, 'the fallback never triggers on a missing API');
  assert.match(block, /'network'/, 'the fallback never triggers on a dead network');
});

test('the panel explains a browser-only account instead of a dead end', () => {
  assert.match(appSource, /account\.localNote/, 'the local-only caveat is never shown');
  assert.match(appSource, /account\.hintLocal/, 'the hint still promises other devices');
  assert.equal(typeof I18n.translations.en['account.localNote'], 'string');
  assert.equal(typeof I18n.translations.en['account.hintLocal'], 'string');
});

test('favorites.js is loaded before app.js so the global exists at init', () => {
  const favoritesScript = html.indexOf('src="favorites.js"');
  const appScript = html.indexOf('src="app.js"');
  assert.notEqual(favoritesScript, -1, 'favorites.js is not loaded by index.html');
  assert.notEqual(appScript, -1, 'app.js is not loaded by index.html');
  assert.ok(favoritesScript < appScript, 'favorites.js must load before app.js');
});

// ==========================================================================
// 2. Markup + element bindings
// ==========================================================================
test('every account and favorites element exists and is bound', () => {
  const ids = [
    'account-btn',
    'account-btn-label',
    'account-panel',
    'account-panel-title',
    'account-close-btn',
    'account-signed-out',
    'account-signed-in',
    'account-mode-signin',
    'account-mode-register',
    'account-form',
    'auth-username',
    'auth-password',
    'auth-error',
    'auth-submit-btn',
    'auth-note',
    'account-welcome',
    'account-fav-count',
    'account-signout-btn',
    'favorites-bar',
    'favorites-chips',
    'favorites-status',
    'favorite-btn',
  ];

  ids.forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `#${id} is missing from index.html`);
    assert.ok(
      appSource.includes(`getElementById('${id}')`),
      `#${id} is never read by app.js`
    );
  });
});

test('the account button and its panel live in the header controls', () => {
  const controls = html.indexOf('class="header-controls"');
  const headerEnd = html.indexOf('</header>');
  const button = html.indexOf('id="account-btn"');
  const panel = html.indexOf('id="account-panel"');

  assert.ok(controls !== -1 && headerEnd !== -1, 'the header is missing');
  assert.ok(button > controls && button < headerEnd, 'the account button is not in the header');
  // The panel is anchored to .header-controls (position: relative), so it must
  // be its descendant; a sibling placed after </header> could not anchor.
  assert.ok(panel > html.indexOf('class="language-picker"'),
    'the account panel must sit inside the header controls, after the pickers');
  assert.ok(panel < html.indexOf('</header>'), 'the account panel left the header');
});

test('the favorites bar sits above the main area so a saved city is one click away', () => {
  const bar = html.indexOf('id="favorites-bar"');
  const status = html.indexOf('id="favorites-status"');
  const main = html.indexOf('<main');
  assert.ok(bar !== -1, 'the favorites bar is missing');
  assert.ok(status !== -1, 'the favorites live region is missing');
  assert.ok(main !== -1, 'the main area is missing');
  assert.ok(status > bar, 'the live region belongs after the bar');
  assert.ok(html.indexOf('id="favorites-bar"') < html.indexOf('id="favorites-status"'));
  assert.ok(html.indexOf('id="favorites-status"') < html.indexOf('<main'),
    'the favorites bar must sit above the main area');
});

test('the hero star is a real toggle with pressed state', () => {
  const block = html.slice(html.indexOf('id="favorite-btn"') - 220, html.indexOf('id="favorite-btn"') + 260);
  assert.match(block, /class="[^"]*favorite-btn/, 'the star has no styling hook');
  assert.match(block, /aria-pressed="false"/, 'the star is missing its pressed state');
  assert.match(block, /data-i18n-aria-label="favorites\.saveAria"/);
});

// ==========================================================================
// 3. Styling
// ==========================================================================
test('every account and favorites class used by the renderer is styled', () => {
  [
    'account-btn',
    'account-panel',
    'account-panel-head',
    'account-panel-title',
    'account-close-btn',
    'account-view',
    'account-hint',
    'account-mode-switch',
    'account-mode-btn',
    'account-form',
    'account-field',
    'account-field-label',
    'account-error',
    'account-note',
    'account-submit-btn',
    'account-signout-btn',
    'account-welcome',
    'account-count',
    'favorites-bar',
    'favorites-chips',
    'favorite-chip',
    'favorite-chip-main',
    'favorite-chip-star',
    'favorite-chip-name',
    'favorite-chip-remove',
    'favorite-btn',
  ].forEach((name) => {
    assert.ok(css.includes(`.${name}`), `.${name} has no styles`);
  });
});

test('the account button and chip remove control expose a visible focus ring', () => {
  for (const selector of ['.account-btn:focus-visible', '.favorite-chip-remove:focus-visible']) {
    const block = css.slice(css.indexOf(selector));
    assert.ok(block.length > 0 && css.includes(selector), `${selector} is missing`);
    assert.match(block.slice(0, 160), /outline/, `${selector} needs a focus ring`);
  }
});

test('the panel is anchored to the header controls, not the viewport', () => {
  const controls = css.slice(css.indexOf('.header-controls {'));
  assert.match(controls.slice(0, 260), /position:\s*relative/,
    '.header-controls must be a positioning context for the panel');
  const panel = css.slice(css.indexOf('.account-panel {'));
  assert.match(panel.slice(0, 200), /position:\s*absolute/);
});

// ==========================================================================
// 4. Localisation
// ==========================================================================
test('every account. and favorites. key the UI uses exists in English', () => {
  const refs = new Set();
  const pattern = /['"]((?:account|favorites)\.[A-Za-z]+)['"]|data-i18n(?:-aria-label|-title|-content|-placeholder|-value)?=['"]((?:account|favorites)\.[A-Za-z]+)['"]/g;
  for (const source of [appSource, html]) {
    let match;
    while ((match = pattern.exec(source))) refs.add(match[1] || match[2]);
  }
  assert.ok(refs.size > 20, 'expected the account/favorites vocabulary to be used');
  [...refs].filter((key) => !key.endsWith('.js')).forEach((key) => {
    assert.equal(typeof I18n.translations.en[key], 'string', `English is missing ${key}`);
  });
});

test('all six languages translate the account/favorites keys with the same placeholders', () => {
  const english = I18n.translations.en;
  const keys = Object.keys(english).filter((key) => key.startsWith('account.') || key.startsWith('favorites.'));
  assert.ok(keys.length >= 40, 'the account/favorites vocabulary shrank unexpectedly');

  for (const lang of ['el', 'de', 'it', 'es', 'fr']) {
    const translated = I18n.translations[lang];
    assert.ok(translated, `${lang} dictionary is missing`);
    keys.forEach((key) => {
      assert.equal(typeof translated[key], 'string', `${lang} is missing ${key}`);
      assert.deepEqual(placeholders(translated[key]), placeholders(english[key]),
        `${lang}.${key} must keep the English interpolation placeholders`);
    });
  }
});

// ==========================================================================
// 5. Render safety
// ==========================================================================
test('a saved city name is written as text, never as markup', () => {
  const start = appSource.indexOf('function renderFavoritesBar()');
  const end = appSource.indexOf('function updateFavoriteButton()');
  const block = appSource.slice(start, end);

  assert.ok(start !== -1 && end > start, 'renderFavoritesBar was not found');
  assert.match(block, /name\.textContent\s*=\s*city\.name/,
    'the chip name must be set with textContent');
  assert.doesNotMatch(block, /innerHTML\s*=[^;]*city/,
    'a saved name must never reach innerHTML');
});

test('the signed-out star points at the account panel instead of failing silently', () => {
  const block = appSource.slice(appSource.indexOf('function toggleFavorite()'));
  assert.match(block.slice(0, 900), /openAccountPanel\(\)/,
    'toggling while signed out must open the account panel');
  assert.match(block.slice(0, 900), /favorites\.signInHint/,
    'toggling while signed out must explain why');
});
