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
    'cameraVideo',
    'cameraBadge',
    'cameraToggle',
    'cameraToggleLabel',
    'cameraNext',
    'cameraNextLabel',
    'cameraName',
    'cameraDistance',
    'cameraCredit',
    'cameraNote',
  ];
  // One binding function serves every view, so the assertion is that each ref is
  // listed for binding and present in the shared markup - not that each of the
  // three views repeats its own copy of the query.
  assert.match(appSource, /const CAMERA_REF_NAMES = \[/);
  assert.match(appSource, /root\.querySelector\(`\[data-ref="\$\{name\}"\]`\)/,
    'nothing binds the panel by data-ref any more');
  refs.forEach((ref) => {
    assert.match(appSource, new RegExp(`'${ref}'`), `${ref} is not in CAMERA_REF_NAMES`);
    assert.match(appSource, new RegExp(`data-ref="${ref}"`), `the panel has no [data-ref="${ref}"]`);
  });
});

test('the panel is defined once and mounted wherever a city is shown', () => {
  // One markup string, three homes. If a fourth view is added it must mount the
  // same panel rather than grow a fourth copy of the markup.
  const markupDefinitions = appSource.match(/const CAMERA_PANEL_HTML = `/g) || [];
  assert.equal(markupDefinitions.length, 1, 'the panel markup is duplicated');
  assert.match(appSource, /\$\{CAMERA_PANEL_HTML\}/, 'the climate card does not use the shared panel');
  assert.match(html, /id="glance-camera-slot"/, 'the dashboard has no place for the city camera');
  assert.match(html, /id="compare-cameras"/, 'the comparison has no place for the city cameras');
  ['syncGlanceCamera', 'renderCompareCameras', 'mountCameraPanel'].forEach((fn) => {
    assert.match(appSource, new RegExp(`function ${fn}\\(`), `${fn} is missing`);
  });
});

test('the panel starts hidden, so a city with no camera shows nothing at all', () => {
  assert.match(appSource, /<figure class="city-camera" data-ref="camera" hidden>/);
  assert.match(appSource, /<p class="city-camera-note" data-ref="cameraNote" hidden>/);
});

test('the panel is lazy and async decoded, because a grid of them is expensive', () => {
  assert.match(appSource, /data-ref="cameraImage"[^>]*loading="lazy"/);
  assert.match(appSource, /data-ref="cameraImage"[^>]*decoding="async"/);
  // A stream is a live connection, so the video must not be preloaded: `none`
  // keeps the browser from opening it before the card is on screen.
  assert.match(appSource, /data-ref="cameraVideo"[^>]*preload="none"/);
});

test('the pause control is a real button with a pressed state', () => {
  assert.match(appSource, /<button[\s\S]{0,300}class="city-camera-toggle"[\s\S]{0,300}aria-pressed="false"/);
});

test('every panel carries the id the observer resolves it by', () => {
  assert.match(appSource, /card\.dataset\.cityId = city\.id/);
  assert.match(appSource, /refs\.camera\.dataset\.cameraPanel = refs\.cameraPanelId/);
  assert.match(appSource, /entry\.target\.dataset\.cameraPanel/);
  assert.match(appSource, /cameraState\.panels\.set\(refs\.cameraPanelId, refs\)/,
    'a mounted panel is never registered, so the observer cannot reach it');
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
  const assignments = appSource.match(/(?:cameraImage\.src|cameraVideo\.src|video\.src) = [^;]+;/g) || [];
  assert.ok(assignments.length >= 2, 'the media sources are assigned in fewer places than expected');
  assignments.forEach((line) => {
    assert.doesNotMatch(line, /innerHTML|insertAdjacentHTML|outerHTML/,
      'a third-party URL must never be parsed as markup');
  });
});

test('no camera field is written with innerHTML', () => {
  const from = appSource.indexOf('function paintCameraCard');
  const to = appSource.indexOf('// --- Polling');
  assert.ok(from !== -1 && to > from, 'the paint helpers are not where the test expects them');
  const body = appSource.slice(from, to);
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
  assert.match(appSource, /readCameraCache\(cityIdOf\(city\)\)/);
});

test('camera answers live in session storage, never in local storage', () => {
  // A camera's answer is true for a minute, so persisting it past the visit
  // would be a stale claim about a place.
  const from = appSource.indexOf('function readCameraCache');
  const to = appSource.indexOf('// --- Painting one panel');
  assert.ok(from !== -1 && to > from, 'the camera cache helpers are not where the test expects them');
  const body = appSource.slice(from, to);
  assert.match(body, /sessionStorage/);
  assert.doesNotMatch(body, /localStorage/);
});

test('the anonymous rate-limit budget stops the app asking again', () => {
  assert.match(appSource, /isBudgetExhausted/);
  assert.match(appSource, /blockCameraLookups\(\)/);
  assert.match(appSource, /CAMERA_RETRY_COOLDOWN_MS/);
});

test('being throttled is not cached as "no camera here"', () => {
  // The regression this guards: a 429 used to be stored as a definitive "none",
  // so one unlucky request made the app deny cameras for the whole session.
  const from = appSource.indexOf('async function resolveCityCamera');
  const to = appSource.indexOf('function unknownCameraRecord');
  assert.ok(from !== -1 && to > from, 'the lookup is not where the test expects it');
  const body = appSource.slice(from, to);
  assert.match(body, /return unknownCameraRecord\(city\)/,
    'a blocked lookup has no "we were not allowed to ask" answer');
  // Everything the lookup *does* persist is a real answer from the directory.
  const failureBranch = body.slice(
    body.indexOf('if (failure)'),
    body.indexOf('const record = { status:')
  );
  assert.ok(failureBranch.length > 0, 'a failed lookup is never noticed');
  assert.doesNotMatch(failureBranch, /writeCameraCache/,
    'a transient failure is being written to the session cache');
  const persisted = body.slice(body.indexOf('const record = { status:'));
  assert.match(persisted, /writeCameraCache\(city\.id, record\)/);
  assert.match(persisted, /cameras\.length \? 'found' : 'none'/);

  const unknown = appSource.slice(to, appSource.indexOf('function blockCameraLookups'));
  assert.match(unknown, /status: 'unknown'/, 'the blocked answer does not say why it is unknown');
  assert.doesNotMatch(unknown, /writeCameraCache/,
    'the blocked answer is cached, so the city can never be asked about again');
});

test('the cooldown ends by itself, so a temporary 429 is not permanent', () => {
  const from = appSource.indexOf('function blockCameraLookups');
  const to = appSource.indexOf('function cityIdOf');
  assert.ok(from !== -1 && to > from, 'the cooldown is not where the test expects it');
  const body = appSource.slice(from, to);
  assert.match(body, /setTimeout/, 'the block is never lifted');
  assert.match(body, /refreshCityCameras\(\)/, 'nothing re-asks when the cooldown expires');
  assert.match(body, /status === 'unknown'[\s\S]*cameraState\.records\.delete/,
    'the blocked answers are kept, so the retry can never happen');
});

test('the badge only claims motion where there is motion', () => {
  // A polled still that says "Live" is a claim the picture cannot support.
  assert.match(appSource, /function cameraBadgeLabel/);
  assert.match(appSource, /camera\.still/, 'a still feed is labelled exactly like a stream');
  assert.match(appSource, /isPlayableStream\(camera\)\s*\?\s*t\('camera\.live'/);
});

test('a stream is played, not polled', () => {
  const from = appSource.indexOf('function syncCameraPolling');
  const end = appSource.indexOf('async function requestCityCamera');
  const slice = appSource.slice(from, end);
  assert.match(slice, /(isStreamFeed|engine\.isStream)\(camera\)/,
    'a stream is polled as if it were a still, tearing the connection down on every tick');
  const timer = slice.slice(slice.indexOf('setTimeout'));
  assert.doesNotMatch(timer, /cameraImage\.src/,
    'the still path is the only one allowed to assign a fresh frame');
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

test('pausing releases the media as well as the timer', () => {
  assert.match(appSource, /refs\.cameraImage\.removeAttribute\('src'\)/,
    'a paused camera still holds the image it was not allowed to show');
  assert.match(appSource, /refs\.cameraBadge\.hidden = true/);
  assert.match(appSource, /refs\.cameraVideo\.pause\(\)/,
    'a paused panel leaves the stream running behind a dim frame');
});

test('the frame timestamp is read before it is written', () => {
  // The frozen-frame bug: stamping `cameraFrameShownAt` before asking for the URL
  // made the elapsed time zero, so no cache-buster was added and the browser was
  // handed back the identical URL it already had cached - forever.
  const from = appSource.indexOf('function applyCameraFrame');
  const to = appSource.indexOf('function setCameraPausedState');
  assert.ok(from !== -1 && to > from, 'applyCameraFrame is not where the test expects it');
  const body = appSource.slice(from, to);

  const read = body.indexOf('const shownAt = refs.cameraFrameShownAt');
  const clock = body.indexOf('const now = Date.now()');
  const url = body.indexOf('engine.nextFrameUrl(camera, now)');
  const write = body.indexOf('refs.cameraFrameShownAt = now');

  assert.ok(read !== -1, 'the previous frame time is never read');
  assert.ok(clock !== -1, 'the function never asks the clock what time it is');
  assert.ok(url > clock && url > read, 'the URL is built before the previous frame time is known');
  assert.ok(write > url, 'the frame time is written before the URL is built, so the same URL comes back');
});

test('a re-render reuses the frame on screen instead of asking the source again', () => {
  const from = appSource.indexOf('function applyCameraFrame');
  const to = appSource.indexOf('function setCameraPausedState');
  const body = appSource.slice(from, to);

  // The cadence rule belongs to the engine, so the controller asks it rather than
  // keeping a second copy of "when is this frame stale".
  assert.match(body, /engine\.frameIsCurrent\(camera, now, \{ frameBase: shownAt \}\)/,
    'the panel cannot tell whether the frame it is showing is still current');
  assert.match(body, /if \(url && url !== showing\)/,
    'the same URL is assigned again, which is a request the browser may not make');
});

test('releasing the media forgets the frame time, so nothing stale is reused', () => {
  const from = appSource.indexOf('function releaseCameraMedia');
  const to = appSource.indexOf('// --- Resolving one city');
  assert.ok(from !== -1 && to > from, 'releaseCameraMedia is not where the test expects it');
  const body = appSource.slice(from, to);
  assert.match(body, /refs\.cameraFrameShownAt = 0/,
    'a released panel still believes it is showing a frame, so the browser is handed its cached copy');
});

test('going off screen hands back the connection, not just the timer', () => {
  const from = appSource.indexOf('function setCardCameraVisible');
  const to = appSource.indexOf('function refreshCityCameras');
  assert.ok(from !== -1 && to > from, 'the visibility handler is not where the test expects it');
  const body = appSource.slice(from, to);
  assert.match(body, /stopCameraPolling\(refs\)/);
  assert.match(body, /releaseCameraMedia\(refs\)/,
    'an off-screen MJPEG stream stays connected');
});

// ==========================================================================
// 6. Styling
// ==========================================================================
test('every camera class the renderer uses is styled', () => {
  [
    '.city-camera',
    '.city-camera-frame',
    '.city-camera-image',
    '.city-camera-video',
    '.city-camera-badge',
    '.city-camera-live-dot',
    '.city-camera-toggle',
    '.city-camera-next',
    '.city-camera-caption',
    '.city-camera-name',
    '.city-camera-distance',
    '.city-camera-credit',
    '.city-camera-note',
    '.camera-toggle',
    '.climate-controls-row',
    '.glance-camera-slot',
    '.compare-cameras',
    '.compare-camera-cell',
    '.compare-camera-city',
    '.compare-camera-mount',
  ].forEach((selector) => {
    assert.ok(css.includes(selector), `${selector} is used but never styled`);
  });
});

test('the master switch is reachable from every view, not just the climate grid', () => {
  // Cameras now appear on the dashboard and in the comparison too, so a switch
  // buried in the climate results header left those two views uncontrollable.
  const toggle = html.indexOf('id="camera-toggle"');
  const header = html.indexOf('class="header-controls"');
  const climateControls = html.indexOf('class="climate-controls-row"');
  assert.ok(toggle !== -1, 'the camera toggle is missing');
  assert.ok(header !== -1 && toggle > header, 'the camera toggle is not in the header');
  assert.ok(climateControls === -1 || toggle < climateControls,
    'the camera toggle is still only reachable from the climate results');
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
  assert.match(css, /\.city-camera-next:focus-visible/);
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
