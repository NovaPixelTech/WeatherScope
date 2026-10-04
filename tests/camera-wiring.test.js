'use strict';
/**
 * WeatherScope free live city cameras - glue tests
 * =========================================================================
 * `cameras.test.js` covers the pure engine. What can still break here is the
 * glue between it and the page, and it is the glue that carries the promises:
 *
 *   * the panel is inside a `role="button"` card, so its own controls have to
 *     stop their events from opening the city's dashboard;
 *   * the frame is a third-party string, so it must be an attribute assignment
 *     and never `innerHTML`;
 *   * a still that refreshes on its own must be pausable, and the pause control
 *     has to say which state it is in to assistive tech, not just look it;
 *   * the directory is rate-limited and third-party, so a card is only asked
 *     about once it is on screen, and nothing is asked at boot;
 *   * "no free camera" has to be stated, not left as an empty box.
 *
 *     node --test
 *
 * No DOM library is needed: these assertions read the markup and the source.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

const html = read('index.html');
const appSource = read('app.js');
const css = read('styles.css');

// ==========================================================================
// 1. Markup
// ==========================================================================
test('the on/off switch exists and is bound', () => {
  assert.match(html, /id="camera-toggle"/, 'the camera toggle is missing from index.html');
  assert.match(appSource, /cameraToggle: document\.getElementById\('camera-toggle'\)/);
  assert.match(
    appSource,
    /elements\.cameraToggle\.addEventListener\('click'/,
    'the toggle is in the markup but nothing listens to it'
  );
});

test('the toggle states its own on/off state, not just its colour', () => {
  assert.match(html, /id="camera-toggle"[\s\S]{0,200}aria-pressed="true"/);
  assert.match(appSource, /toggle\.setAttribute\('aria-pressed', enabled \? 'true' : 'false'\)/);
});

test('the card panel ships every part the renderer fills in', () => {
  const refs = [
    'camera',
    'cameraImage',
    'cameraBadge',
    'cameraToggle',
    'cameraToggleLabel',
    'cameraName',
    'cameraDistance',
    'cameraCredit',
    'cameraNote',
  ];
  refs.forEach((ref) => {
    assert.match(appSource, new RegExp(`${ref}: card\\.querySelector\\('\\[data-ref="${ref}"\\]'\\)`),
      `the card never binds [data-ref="${ref}"]`);
    assert.match(appSource, new RegExp(`data-ref="${ref}"`), `CARD_TEMPLATE has no [data-ref="${ref}"]`);
  });
});

test('the panel starts hidden, so a city with no camera shows nothing at all', () => {
  assert.match(appSource, /<figure class="city-camera" data-ref="camera" hidden>/);
  assert.match(appSource, /<p class="city-camera-note" data-ref="cameraNote" hidden>/);
});

test('the frame is lazy and async decoded, because a grid of them is expensive', () => {
  assert.match(appSource, /data-ref="cameraImage"[^>]*loading="lazy"/);
  assert.match(appSource, /data-ref="cameraImage"[^>]*decoding="async"/);
});

test('the pause control is a real button with a pressed state', () => {
  assert.match(appSource, /<button[\s\S]{0,300}class="city-camera-toggle"[\s\S]{0,300}aria-pressed="false"/);
});

test('the card carries the city id the observer resolves panels by', () => {
  assert.match(appSource, /card\.dataset\.cityId = city\.id/);
  assert.match(appSource, /entry\.target\.dataset\.cityId/);
});

// ==========================================================================
// 2. The event problem: a control inside a button
// ==========================================================================
test('the camera controls do not also open the city', () => {
  // The card is `role="button"`, so a click that reaches the card handler would
  // navigate away from the panel the visitor just touched.
  const toggleHandler = appSource.match(
    /refs\.cameraToggle\.addEventListener\('click',[\s\S]{0,200}?\);/
  );
  assert.ok(toggleHandler, 'the pause control has no click handler');
  assert.match(toggleHandler[0], /event\.stopPropagation\(\)/,
    'a click on Pause would also trigger the card, opening the dashboard');

  const keyHandler = appSource.match(
    /refs\.cameraToggle\.addEventListener\('keydown',[\s\S]{0,240}?\);/
  );
  assert.ok(keyHandler, 'the pause control has no keydown handler');
  assert.match(keyHandler[0], /event\.stopPropagation\(\)/,
    'a key press on Pause would also trigger the card');
});

test('a frame that fails to load leaves the rest of the card intact', () => {
  assert.match(appSource, /cameraImage\.addEventListener\('error'/, 'no failure handling on the frame');
  assert.match(appSource, /cameraFailed = true/, 'a failed frame is never recorded, so it would retry forever');
});

// ==========================================================================
// 3. XSS: the feed URL is a third-party string
// ==========================================================================
test('the feed URL is only ever assigned as an attribute', () => {
  const assignments = appSource.match(/cameraImage\.src = [^;]+;/g) || [];
  assert.ok(assignments.length >= 2, 'the frame is assigned in more than one place');
  assignments.forEach((line) => {
    assert.doesNotMatch(line, /innerHTML|insertAdjacentHTML|outerHTML/,
      'a third-party URL must never be parsed as markup');
  });
});

test('no camera field is written with innerHTML', () => {
  const painted = appSource.slice(appSource.indexOf('function paintCameraCard'));
  const end = painted.indexOf('function cameraFrameUrl');
  const body = end === -1 ? painted : painted.slice(0, end);
  assert.doesNotMatch(body, /innerHTML/, 'the camera panel must be painted with textContent and attributes');
});

// ==========================================================================
// 4. Rate limiting and laziness
// ==========================================================================
test('cameras are not looked up for a card that has not been seen', () => {
  assert.match(appSource, /IntersectionObserver/, 'the grid is not watched for visibility');
  assert.match(appSource, /rootMargin: '200px 0px'/,
    'a camera is looked up only once its card is genuinely on screen');
  assert.match(appSource, /observeCityCards\(\);/,
    'the observer is built but never attached to a render');
});

test('lookups are spaced, so a fast scroll cannot burst the directory', () => {
  assert.match(appSource, /CAMERA_LOOKUP_SPACING_MS/);
  assert.match(appSource, /nextLookupAt/);
});

test('the "no camera" answer is cached like any other, so a re-sort never re-asks', () => {
  assert.match(appSource, /writeCameraCache\(city\.id, record\)/);
  assert.match(appSource, /readCameraCache\(city\.id\)/);
});

test('camera answers live in session storage, never in local storage', () => {
  // A camera's answer is true for a minute, so persisting it past the visit
  // would be a stale claim about a place.
  const from = appSource.indexOf('function readCameraCache');
  const to = appSource.indexOf('// --- Painting one card');
  assert.ok(from !== -1 && to > from, 'the camera cache helpers are not where the test expects them');
  const body = appSource.slice(from, to);
  assert.match(body, /sessionStorage/);
  assert.doesNotMatch(body, /localStorage/);
});

test('the anonymous rate-limit budget stops the app asking again', () => {
  assert.match(appSource, /isBudgetExhausted/);
  assert.match(appSource, /budgetSpent/);
});

test('nothing is fetched for cameras until the grid is actually searched', () => {
  // The observer is only attached inside the climate render, so a visitor who
  // never runs a climate search makes zero camera requests.
  const initBody = appSource.slice(appSource.indexOf('function init()'));
  assert.doesNotMatch(initBody, /requestCityCamera\(refs\)/,
    'a camera lookup is being started at init');
  assert.doesNotMatch(initBody, /findCameras\(/,
    'the camera directory is being queried at init');
});

// ==========================================================================
// 5. The polite-refresh cadence
// ==========================================================================
test('the source cadence is used, and never a hard-coded one', () => {
  assert.match(appSource, /cameraCadence/, 'the registry cadence is never fetched');
  assert.match(appSource, /pollSecondsByRegistry: cadence/);
  assert.match(appSource, /camera\.pollSeconds \|\| 60/);
});

test('polling only runs while the card is on screen and unpaused', () => {
  const body = appSource.slice(appSource.indexOf('function syncCameraPolling'));
  const end = appSource.indexOf('async function requestCityCamera');
  const slice = appSource.slice(appSource.indexOf('function syncCameraPolling'), end);
  assert.match(slice, /refs\.cameraVisible/);
  assert.match(slice, /!refs\.cameraPaused/);
  assert.match(slice, /stopCameraPolling\(refs\)/,
    'an off-screen or paused card keeps its timer running');
});

test('pausing releases the image as well as the timer', () => {
  assert.match(appSource, /refs\.cameraImage\.removeAttribute\('src'\)/,
    'a paused camera still holds the image it was not allowed to show');
  assert.match(appSource, /refs\.cameraBadge\.hidden = true/);
});

// ==========================================================================
// 6. Styling
// ==========================================================================
test('every camera class the renderer uses is styled', () => {
  [
    '.city-camera',
    '.city-camera-frame',
    '.city-camera-image',
    '.city-camera-badge',
    '.city-camera-live-dot',
    '.city-camera-toggle',
    '.city-camera-caption',
    '.city-camera-name',
    '.city-camera-distance',
    '.city-camera-credit',
    '.city-camera-note',
    '.camera-toggle',
    '.climate-controls-row',
  ].forEach((selector) => {
    assert.ok(css.includes(selector), `${selector} is used but never styled`);
  });
});

test('the panel keeps its shape on a phone instead of collapsing', () => {
  assert.match(css, /\.city-camera-frame \{[\s\S]{0,220}aspect-ratio: 16 \/ 9/,
    'the frame has no intrinsic ratio, so it jumps the card as the image loads');
});

test('the live badge is honest about motion and the pulse respects the reader', () => {
  assert.match(css, /@keyframes camera-live-pulse/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]{0,200}camera-live-dot/,
    'the pulsing live dot is never switched off for reduced motion');
});

test('the controls are keyboard reachable', () => {
  assert.match(css, /\.city-camera-toggle:focus-visible/);
  assert.match(css, /\.camera-toggle:focus-visible/);
});

test('the advice grid stays two columns at every width', () => {
  const grid = css.match(/\.assistant-grid \{[\s\S]*?\}/g) || [];
  assert.ok(grid.length >= 1, '.assistant-grid is not styled');
  grid.forEach((rule) => {
    assert.match(rule, /repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
      'a breakpoint collapses the advice row to one column');
  });
});

test('the advice tile overrides come after the base rule, so they take effect', () => {
  const base = css.indexOf('.assistant-tile {');
  const narrow = css.indexOf('@media (max-width: 640px)');
  assert.ok(narrow > base,
    'the 640px tile overrides are declared before .assistant-tile, so the base rule wins the cascade and the tighter type never applies');
});
