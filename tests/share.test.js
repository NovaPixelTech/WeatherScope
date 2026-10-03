'use strict';
/**
 * WeatherScope share links - link format + dashboard wiring tests
 * =========================================================================
 * The share button used to send `window.location.href`, i.e. the same generic
 * address for every city. What has to be true now is that the link *is* the
 * shared forecast: it names the city, the cards the sender was looking at and
 * the unit, and opening it lands on those cards.
 *
 *     node --test
 *
 * No DOM library is needed: `share.js` is pure and is driven directly, while
 * the wiring assertions read the markup, the stylesheet and the source.
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
  // URL / URLSearchParams are host objects, so the sandbox has to be handed
  // them: a bare context has no URL at all.
  const sandbox = { window: {}, console, URL, URLSearchParams };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('share.js'), sandbox);
  return sandbox.WeatherScopeShare || sandbox.window.WeatherScopeShare;
}

const Share = loadAsBrowserGlobal();

/**
 * Arrays built inside the sandbox carry that realm's prototype, which
 * `deepStrictEqual` treats as a mismatch, so they are copied into this realm
 * before they are compared.
 */
const list = (value) => Array.from(value);

const TOKYO = {
  city: 'Tokyo',
  region: 'Tokyo',
  country: 'Japan',
  latitude: 35.6762,
  longitude: 139.6503,
  timezone: 'Asia/Tokyo',
  cards: ['glance', 'hourly'],
  unit: 'f',
  windowKey: 'evening',
};

// ==========================================================================
// 1. Script loading
// ==========================================================================
test('share.js registers itself as a browser global', () => {
  assert.ok(Share, 'WeatherScopeShare global is missing');
  assert.equal(typeof Share.buildShareUrl, 'function');
  assert.equal(typeof Share.parseShareLink, 'function');
  assert.deepEqual(list(Share.CARD_KEYS), ['glance', 'hero', 'assistant', 'metrics', 'hourly', 'daily']);
  list(Share.CARD_KEYS).forEach((key) => {
    assert.ok(Share.CARD_LABELS[key], `card ${key} has no human label`);
  });
});

test('share.js is loaded before app.js so the global exists at init', () => {
  const shareScript = html.indexOf('src="share.js"');
  const appScript = html.indexOf('src="app.js"');
  assert.notEqual(shareScript, -1, 'share.js is not loaded by index.html');
  assert.notEqual(appScript, -1, 'app.js is not loaded by index.html');
  assert.ok(shareScript < appScript);
});

// ==========================================================================
// 2. The link names the city and the cards
// ==========================================================================
test('the built link carries the city, its coordinates and the shared cards', () => {
  const url = Share.buildShareUrl('https://weatherscope.test/index.html', TOKYO);
  const parsed = Share.parseShareLink(url);

  assert.ok(url.startsWith('https://weatherscope.test/index.html?'), url);
  assert.equal(parsed.city, 'Tokyo');
  assert.equal(parsed.country, 'Japan');
  assert.equal(parsed.latitude, 35.6762);
  assert.equal(parsed.longitude, 139.6503);
  assert.equal(parsed.timezone, 'Asia/Tokyo');
  assert.deepEqual(list(parsed.cards), ['glance', 'hourly']);
  assert.equal(parsed.unit, 'f');
  assert.equal(parsed.windowKey, 'evening');
});

test('the link is never the bare page address', () => {
  const url = Share.buildShareUrl('https://weatherscope.test/index.html', TOKYO);
  assert.notEqual(url, 'https://weatherscope.test/index.html');
  assert.match(url, /city=Tokyo/);
  assert.match(url, /cards=glance%2Chourly|/, url);
});

test('re-sharing replaces the previous link instead of stacking parameters', () => {
  const first = Share.buildShareUrl('https://weatherscope.test/index.html', TOKYO);
  const second = Share.buildShareUrl(first, Object.assign({}, TOKYO, { city: 'Oslo', latitude: 59.9139, longitude: 10.7522 }));

  assert.equal(second.match(/city=/g).length, 1, second);
  assert.equal(second.match(/cards=/g).length, 1, second);
  assert.equal(Share.parseShareLink(second).city, 'Oslo');
});

test('a link read back and written out again is byte-identical', () => {
  const once = Share.buildShareUrl('https://weatherscope.test/index.html', TOKYO);
  const twice = Share.buildShareUrl('https://weatherscope.test/index.html', Share.parseShareLink(once));
  assert.equal(twice, once);
});

test('a link survives a non-http base such as a file:// page', () => {
  const url = Share.buildShareUrl('file:///C:/apps/weatherscope/index.html', TOKYO);
  assert.match(url, /^file:\/\/\/C:\/apps\/weatherscope\/index\.html\?/);
  assert.equal(Share.parseShareLink(url).city, 'Tokyo');
});

test('a stale hash is dropped rather than carried into the share', () => {
  const url = Share.buildShareUrl('https://weatherscope.test/index.html#some-anchor', TOKYO);
  assert.equal(url.indexOf('#'), -1, url);
});

test('a payload with no city produces no link at all', () => {
  assert.equal(Share.buildShareUrl('https://weatherscope.test/index.html', { latitude: 10, longitude: 10 }), '');
  assert.equal(Share.buildShareUrl('https://weatherscope.test/index.html', {}), '');
});

// ==========================================================================
// 3. The card vocabulary
// ==========================================================================
test('cards come back in page order however they were listed', () => {
  assert.deepEqual(list(Share.sanitizeCards(['daily', 'glance'])), ['glance', 'daily']);
  assert.deepEqual(list(Share.sanitizeCards(['daily', 'daily'])), ['daily']);
});

test('an unknown card is dropped, and a link with no usable card shows the city', () => {
  assert.deepEqual(list(Share.sanitizeCards(['glance', 'evil', 'hourly'])), ['glance', 'hourly']);
  assert.deepEqual(list(Share.sanitizeCards(['evil'])), list(Share.CARD_KEYS));
  assert.deepEqual(list(Share.sanitizeCards([])), list(Share.CARD_KEYS));
  assert.deepEqual(list(Share.parseShareLink('https://weatherscope.test/i.html?city=Oslo').cards), list(Share.CARD_KEYS));
});

test('the card names read back as a sentence for the banner', () => {
  assert.equal(Share.describeCards(['glance', 'hourly']), 'Today at a glance, 24-hour forecast');
});

// ==========================================================================
// 4. Nothing off the wire is trusted
// ==========================================================================
test('a URL that does not name a city is not a shared forecast', () => {
  assert.equal(Share.parseShareLink('https://weatherscope.test/index.html'), null);
  assert.equal(Share.parseShareLink('https://weatherscope.test/index.html?lat=35.6&lon=139.6'), null);
  assert.equal(Share.isShareLink('https://weatherscope.test/index.html?city=Oslo'), true);
  assert.equal(Share.isShareLink('https://weatherscope.test/index.html'), false);
});

test('half a coordinate pair is dropped rather than guessed at', () => {
  const parsed = Share.parseShareLink('https://weatherscope.test/index.html?city=Oslo&lat=59.91');
  assert.equal(parsed.latitude, null);
  assert.equal(parsed.longitude, null);
});

test('nonsense coordinates and units are rejected', () => {
  const parsed = Share.parseShareLink('https://weatherscope.test/index.html?city=Oslo&lat=999&lon=10&unit=kelvin&cards=glance');
  assert.equal(parsed.latitude, null, 'a latitude past the pole is not a place');
  assert.equal(parsed.longitude, null);
  assert.equal(parsed.unit, '', 'an unknown unit falls back to the visitor\'s own');
  assert.deepEqual(list(parsed.cards), ['glance']);
});

test('the full unit names are accepted as well as the short ones', () => {
  assert.equal(Share.parseShareLink('https://weatherscope.test/index.html?city=Oslo&unit=fahrenheit').unit, 'f');
  assert.equal(Share.parseShareLink('https://weatherscope.test/index.html?city=Oslo&unit=C').unit, 'c');
});

test('a city name cannot smuggle control characters into the page', () => {
  const parsed = Share.parseShareLink('https://weatherscope.test/index.html?city=Oslo%0ANew%20York');
  assert.equal(parsed, null);
});

test('the place is described without repeating the city name', () => {
  assert.equal(Share.describePlace({ city: 'Paris', admin1: 'Île-de-France', country: 'France' }), 'Paris, Île-de-France, France');
  assert.equal(Share.describePlace({ city: 'Singapore', admin1: 'Singapore', country: 'Singapore' }), 'Singapore');
  assert.equal(Share.describePlace({}), '');
});

// ==========================================================================
// 5. Markup + bindings for every shareable card
// ==========================================================================
test('every shareable card has a section id and a binding', () => {
  const ids = {
    glance: 'glance-card',
    hero: 'hero-card',
    assistant: 'assistant-card',
    metrics: 'metrics-card',
    hourly: 'hourly-card',
    daily: 'daily-card',
  };

  Object.keys(ids).forEach((key) => {
    const id = ids[key];
    assert.match(html, new RegExp(`id="${id}"`), `${id} is not in the markup`);
    assert.match(appSource, new RegExp(`getElementById\\('${id}'\\)`), `${id} is not bound`);
  });
});

test('the arrival banner and the spoken channel exist and are bound', () => {
  ['shared-banner', 'shared-banner-city', 'shared-banner-cards', 'shared-clear-btn', 'share-status']
    .forEach((id) => {
      assert.match(html, new RegExp(`id="${id}"`), `${id} is not in the markup`);
      assert.match(appSource, new RegExp(`getElementById\\('${id}'\\)`), `${id} is not bound`);
    });

  assert.match(html, /<div id="shared-banner"[^>]*hidden/, 'the banner must not show on an ordinary visit');
  assert.match(html, /id="share-status"[^>]*aria-live="polite"/, 'the confirmation needs a live region');
});

test('the share button is still in the hero actions', () => {
  assert.match(html, /id="share-btn"/);
  assert.match(appSource, /shareBtn\.addEventListener\('click'/);
});

// ==========================================================================
// 6. The app shares a deep link, not the address bar
// ==========================================================================
test('sharing hands over a link built for this city and these cards', () => {
  const block = appSource.slice(
    appSource.indexOf('function shareWeather()'),
    appSource.indexOf('function renderGlanceMetrics(')
  );

  assert.ok(block.length > 0, 'shareWeather was not found');
  assert.match(block, /buildShareUrl\(/, 'it must build a deep link');
  assert.match(block, /currentSharePayload\(\)/, 'the payload comes from the live city and view');
  assert.match(block, /navigator\.share\(\{/, 'the native sheet still receives the link');
  assert.match(block, /copyShareText\(/, 'without a share sheet the link is copied, not just the text');
});

test('the generic page address is no longer what gets shared', () => {
  const shareBlock = appSource.slice(
    appSource.indexOf('function shareWeather()'),
    appSource.indexOf('function renderGlanceMetrics(')
  );
  assert.doesNotMatch(shareBlock, /url:\s*window\.location\.href/, 'the old generic link is back');
});

test('the payload is measured from the cards that are on screen', () => {
  const block = appSource.slice(
    appSource.indexOf('function visibleShareCards()'),
    appSource.indexOf('function currentSharePayload()')
  );

  assert.ok(block.length > 0, 'visibleShareCards was not found');
  assert.match(block, /getBoundingClientRect\(\)/, 'visibility must be measured, not guessed');
  assert.match(block, /node\.hidden/, 'a card that is not rendered is not shared');
  assert.match(block, /return allCards;/, 'an unmeasurable page falls back to the whole city');
});

test('opening a link applies it before the saved or default city', () => {
  const block = appSource.slice(
    appSource.indexOf('function init()'),
    appSource.indexOf("if (document.readyState === 'loading')")
  );

  const shared = block.indexOf('parseShareLink(window.location.href)');
  const saved = block.indexOf('readStored(STORAGE_KEYS.lastCity');
  const fallback = block.indexOf("name: 'Paris'");

  assert.ok(shared > -1, 'init never reads the shared link');
  assert.ok(saved > -1 && fallback > -1, 'init lost its city fallbacks');
  assert.ok(shared < saved, 'the shared link must be read before the saved city');
  assert.ok(shared < fallback, 'the shared link must be read before the default city');
});

test('a shared link loads the shared city, unit and rain window', () => {
  const block = appSource.slice(
    appSource.indexOf('function applySharedLink('),
    appSource.indexOf('// Climate Search Results Rendering')
  );

  assert.ok(block.length > 0, 'applySharedLink was not found');
  assert.match(block, /unitF\.click\(\)/, 'the sender\'s unit must be applied');
  assert.match(block, /state\.adviceWindowKey = payload\.windowKey/, 'the shared rain window must be applied');
  assert.match(block, /loadCityWeather\(city\)/, 'the shared city is loaded from its own coordinates');
  assert.match(block, /revealSharedCards\(payload\)/, 'the shared cards are ringed once they exist');
});

test('the ring only lands on a forecast that actually loaded', () => {
  const block = appSource.slice(
    appSource.indexOf('function applySharedLink('),
    appSource.indexOf('// Climate Search Results Rendering')
  );
  assert.match(block, /state\.sharedPayload !== payload \|\| !state\.currentCity/, 'a superseded or failed load must not be ringed');
});

test('moving to another city drops the shared view instead of leaving it stale', () => {
  const block = appSource.slice(
    appSource.indexOf('async function loadCityWeather('),
    appSource.indexOf('async function handleClimateSearch(')
  );

  assert.match(block, /state\.sharedPayload && !isSameSharedCity\(state\.sharedPayload, city\)/);
  assert.match(block, /clearSharedView\(\)/);

  const clearBlock = appSource.slice(
    appSource.indexOf('function clearSharedView()'),
    appSource.indexOf('function revealSharedCards(')
  );
  assert.match(clearBlock, /classList\.remove\('is-shared'\)/, 'the ring has to be removable');
  assert.match(clearBlock, /sharedBanner\.hidden = true/, 'the banner has to be removable');
});

// ==========================================================================
// 7. Styling and accessibility
// ==========================================================================
test('a shared card is ringed, and the ring is not colour-only', () => {
  assert.match(css, /\.card\.is-shared\s*\{/);
  const block = css.slice(css.indexOf('.card.is-shared {'), css.indexOf('.shared-banner {'));
  assert.ok(block.length > 0, '.card.is-shared has no styles');
  assert.match(block, /border-color/, 'the card itself must change, not only its shadow');
  assert.match(css, /\.shared-banner-label/, 'the banner names the arrival in words too');
});

test('the banner is laid out with flex, so its hidden state is spelled out', () => {
  assert.match(css, /\.shared-banner\[hidden\]\s*\{\s*display:\s*none;/);
});

test('the spoken-only channel is genuinely hidden, not just small', () => {
  const block = css.slice(css.indexOf('.sr-only {'), css.indexOf('.card.is-shared {'));
  assert.ok(block.length > 0, '.sr-only has no styles');
  assert.match(block, /position:\s*absolute/);
  assert.match(block, /clip-path:\s*inset\(50%\)/);
});