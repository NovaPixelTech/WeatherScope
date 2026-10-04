'use strict';
/**
 * WeatherScope live city cameras - runtime tests
 * =========================================================================
 * The engine tests prove what a camera normalises to, and the wiring tests prove
 * the markup and the source agree. Neither can catch the failure mode that made
 * this feature useless in the first place: a panel that is wired correctly and
 * still shows nothing. A frozen frame, a stream that is polled like a photo, a
 * throttle cached as "this city has no camera" - every one of those looks
 * perfect in a source-reading test.
 *
 * So this file runs the camera controller itself against a hand-written DOM stub
 * and drives it the way a visitor would: scroll a panel into view, watch it fill
 * in, let the poll tick fire, cycle to the next camera, pause it, scroll it back
 * off screen, and see what the directory does when it throttles us.
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

const appSource = read('app.js');
const engineSource = read('cameras.js');
const html = read('index.html');

/**
 * The camera controller, lifted out of `app.js` and run on its own.
 *
 * Everything from the panel markup through to the sorting section is the
 * feature, and it only needs a few things from the rest of the app: the
 * translation helpers, the fetch timeout, the two mount points it fills and the
 * compare state. Extracting the block rather than booting the whole 6,000-line
 * file keeps these tests about the panel, and a missing dependency shows up
 * immediately as a ReferenceError instead of as a mysterious timeout.
 */
const PANEL_START = appSource.indexOf('const CAMERA_PANEL_HTML');
const CONTROLLER_START = appSource.indexOf('const CAMERA_PREFERENCE_KEY');
const CONTROLLER_END = appSource.indexOf('// Adaptive Result Sorting');
const panelSource = appSource.slice(PANEL_START, appSource.indexOf('const CARD_TEMPLATE'));
const controllerSource = [
  panelSource,
  appSource.slice(CONTROLLER_START, appSource.lastIndexOf('// ====', CONTROLLER_END)),
].join('\n');

function loadController(sandboxGlobals) {
  const sandbox = Object.assign({
    console: { log() {}, warn() {}, error() {} },
    JSON, Promise, Math, Date, Map, Set, Error, URL, URLSearchParams,
    AbortController, Number, Object, Array, String, Boolean, isFinite, parseInt, parseFloat,
  }, sandboxGlobals);
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(engineSource, sandbox, { filename: 'cameras.js' });

  const factory = vm.runInContext(
    `(function (t, tp, REQUEST_TIMEOUT, elements, state) {
      ${controllerSource}
      return {
        CAMERA_PANEL_HTML,
        cameraState,
        bindCameraPanel,
        adoptCameraPanel,
        mountCameraPanel,
        resetCameraCard,
        requestCityCamera,
        refreshCityCameras,
        observeCityCards,
        setCardCameraVisible,
        paintCameraCard,
        showNextCamera,
        toggleCardCamera,
        blockCameraLookups,
        resolveCityCamera,
        camerasEnabled,
        setCamerasEnabled,
        cameraLookupBlocked,
        cityIdOf,
        syncGlanceCamera,
        renderCompareCameras,
        releaseCompareCameras,
        releaseCameraPanel,
      };
    })`,
    sandbox,
    { filename: 'app.js#cameras' }
  );

  return factory(
    (key, vars, fallback) => (fallback === undefined ? key : fallback),
    (oneKey, manyKey, count, vars, englishOne) => (count === 1 ? englishOne : englishOne),
    12000,
    sandboxGlobals.elements,
    sandboxGlobals.state
  );
}

// ==========================================================================
// A DOM small enough to read, large enough to run a panel
// ==========================================================================

const VOID_TAGS = new Set(['img', 'br', 'input', 'hr', 'source', 'meta', 'link']);

function createClassList(node) {
  const read = () => (node.attributes.class || '').split(/\s+/).filter(Boolean);
  const write = (list) => { node.attributes.class = list.join(' '); };

  return {
    add: (...names) => write([...new Set([...read(), ...names.filter(Boolean)])]),
    remove: (...names) => write(read().filter((c) => !names.includes(c))),
    contains: (name) => read().includes(name),
    toggle: (name, force) => {
      const on = force === undefined ? !read().includes(name) : !!force;
      if (on) this.add(name);
      else this.remove(name);
      return on;
    },
    _list: read,
  };
}

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

class StubNode {
  constructor(tagName) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.attributes = {};
    this.childNodes = [];
    this.listeners = {};
    this.parentNode = null;
    this.hidden = false;
    this._text = '';
    this.paused = true;
    this.classList = createClassList(this);
    this.style = { setProperty() {}, removeProperty() {} };
    this.dataset = new Proxy({}, {
      get: (_, prop) => (typeof prop === 'string' ? this.attributes[`data-${kebab(prop)}`] : undefined),
      set: (_, prop, value) => { this.attributes[`data-${kebab(prop)}`] = String(value); return true; },
      has: (_, prop) => `data-${kebab(prop)}` in this.attributes,
      deleteProperty: (_, prop) => { delete this.attributes[`data-${kebab(prop)}`]; return true; },
    });
  }

  get children() {
    return this.childNodes.filter((node) => node instanceof StubNode);
  }

  get id() { return this.attributes.id || ''; }
  set id(value) { this.attributes.id = value; }

  get className() { return this.attributes.class || ''; }
  set className(value) { this.attributes.class = value; }

  get src() { return this.attributes.src || ''; }
  set src(value) { this.attributes.src = String(value); }

  get alt() { return this.attributes.alt || ''; }
  set alt(value) { this.attributes.alt = String(value); }

  get href() { return this.attributes.href || ''; }
  set href(value) { this.attributes.href = String(value); }

  get type() { return this.attributes.type || ''; }
  set type(value) { this.attributes.type = String(value); }

  get title() { return this.attributes.title || ''; }
  set title(value) { this.attributes.title = String(value); }

  get value() { return this._value === undefined ? '' : this._value; }
  set value(next) { this._value = next; }

  get muted() { return this._muted === undefined ? false : this._muted; }
  set muted(next) { this._muted = !!next; }

  get disabled() { return this._disabled === undefined ? false : this._disabled; }
  set disabled(next) { this._disabled = !!next; }

  get textContent() {
    if (this.childNodes.length === 0) return this._text;
    return this._text + this.childNodes.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this.childNodes.forEach((child) => { child.isConnected = false; });
    this.childNodes = [];
    this._text = value === null || value === undefined ? '' : String(value);
  }

  set innerHTML(value) {
    this.childNodes.forEach((child) => { child.isConnected = false; });
    this.childNodes = [];
    this._text = '';
    this.appendChild(parseFragment(String(value || ''), this.ownerDocument));
  }

  get innerHTML() { return this._html || ''; }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; }
  hasAttribute(name) { return name in this.attributes; }
  removeAttribute(name) { delete this.attributes[name]; }

  appendChild(node) {
    node.parentNode = this;
    node.isConnected = true;
    this.childNodes.push(node);
    if (this._text) this._text = '';
    return node;
  }

  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); return nodes.length; }
  removeChild(node) {
    this.childNodes = this.childNodes.filter((c) => c !== node);
    node.parentNode = null;
    return node;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }

  addEventListener(type, handler) {
    (this.listeners[type] = this.listeners[type] || []).push(handler);
  }

  removeEventListener(type, handler) {
    this.listeners[type] = (this.listeners[type] || []).filter((h) => h !== handler);
  }

  dispatch(type, extra = {}) {
    const event = Object.assign({
      type,
      target: this,
      currentTarget: this,
      preventDefault() {},
      stopPropagation() { this._stopped = true; },
      _stopped: false,
    }, extra);
    let node = this;
    while (node && !event._stopped) {
      (node.listeners[type] || []).forEach((handler) => handler.call(node, event));
      node = node.parentNode;
    }
    return event;
  }

  click() { this.dispatch('click'); }
  focus() { this._focused = true; }
  select() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { top: 0, bottom: 500, left: 0, right: 500 }; }

  closest(selector) {
    const test = selectorMatcher(selector);
    let node = this;
    while (node) {
      if (node instanceof StubNode && test(node)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const test = selectorMatcher(selector);
    const found = [];
    const walk = (node) => {
      node.childNodes.forEach((child) => {
        if (child instanceof StubNode) {
          if (test(child)) found.push(child);
          walk(child);
        }
      });
    };
    walk(this);
    return found;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }

  // --- Media element behaviour ---------------------------------------------
  canPlayType(type) {
    return /mpegurl|mp4|webm/.test(type) ? 'maybe' : '';
  }

  play() {
    this.paused = false;
    this.plays = (this.plays || 0) + 1;
    return this._playResult === undefined ? Promise.resolve() : this._playResult;
  }

  pause() { this.paused = true; }
  load() { this.loads = (this.loads || 0) + 1; }
}

/**
 * A tiny selector matcher: `.class`, `[attr]`, `[attr="value"]`, `tag`, and
 * `tag.class`. That is the whole vocabulary the panel and the camera controller
 * use, and anything richer would be a parser pretending to be a browser.
 */
function selectorMatcher(selector) {
  const text = String(selector).trim();
  const tagMatch = text.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  const tag = tagMatch ? tagMatch[1].toLowerCase() : '';
  const rest = tagMatch ? text.slice(tagMatch[1].length) : text;

  const classes = (rest.match(/\.[-\w]+/g) || []).map((name) => name.slice(1));
  const attrs = [];
  const attrPattern = /\[([-\w]+)(?:\s*=\s*["']?([^\]"']*)["']?)?\]/g;
  let attr = attrPattern.exec(rest);
  while (attr) {
    attrs.push({ name: attr[1], value: attr[2] });
    attr = attrPattern.exec(rest);
  }

  return (node) => {
    if (!(node instanceof StubNode)) return false;
    if (tag && node.tagName.toLowerCase() !== tag) return false;
    if (!classes.every((name) => node.classList.contains(name))) return false;
    return attrs.every((wanted) => (
      wanted.value === undefined
        ? node.hasAttribute(wanted.name)
        : node.getAttribute(wanted.name) === wanted.value
    ));
  };
}

/**
 * Just enough HTML to mount the panel.
 *
 * The panel is injected as a template string, so a runtime test has to be able to
 * read that string back as nodes - otherwise every assertion about the panel
 * would be an assertion about a string.
 */
function parseFragment(source, ownerDocument) {
  const root = ownerDocument.createElement('div');
  const stack = [root];
  let cursor = 0;

  const pushText = (text) => {
    if (!text) return;
    const parent = stack[stack.length - 1];
    parent.appendChild(new StubText(text));
  };

  while (cursor < source.length) {
    const open = source.indexOf('<', cursor);
    if (open === -1) { pushText(source.slice(cursor)); break; }
    pushText(source.slice(cursor, open));
    const close = source.indexOf('>', open);
    if (close === -1) break;
    const tag = source.slice(open + 1, close);
    cursor = close + 1;

    if (tag.startsWith('/')) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    const selfClosing = tag.endsWith('/');
    const body = selfClosing ? tag.slice(0, -1) : tag;
    const nameMatch = body.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
    if (!nameMatch) continue;
    const name = nameMatch[0].toLowerCase();
    const element = ownerDocument.createElement(name);
    element.ownerDocument = ownerDocument;
    applyAttributes(element, body.slice(name.length));
    stack[stack.length - 1].appendChild(element);
    if (!selfClosing && !VOID_TAGS.has(name)) stack.push(element);
  }

  return root;
}

function applyAttributes(element, source) {
  const pattern = /([^\s=]+)(?:\s*=\s*"([^"]*)")?/g;
  let match = pattern.exec(source);
  while (match) {
    element.setAttribute(match[1], match[2] === undefined ? '' : match[2]);
    match = pattern.exec(source);
  }
  // `hidden` in the template has to mean hidden, not "an empty attribute".
  if ('hidden' in element.attributes) element.hidden = true;
}

class StubText {
  constructor(text) { this._text = String(text); this.childNodes = []; }
  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); }
  get classList() { return { contains: () => false }; }
  get dataset() { return {}; }
}

/**
 * IntersectionObserver the test drives by hand, so visibility is a decision the
 * test makes rather than something a layout engine has to fake.
 *
 * Every instance is recorded on the shared `observers` list, because the
 * controller builds its own observer internally.
 */
const observers = [];

class StubObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options || {};
    this.observed = [];
    observers.push(this);
  }

  observe(node) { this.observed.push(node); }
  unobserve(node) { this.observed = this.observed.filter((n) => n !== node); }
  disconnect() { this.observed = []; }

  /** Fire entries as if the browser had scrolled them into (or out of) view. */
  enter(nodes) { this.callback(nodes.map((target) => ({ target, isIntersecting: true })), this); }
  leave(nodes) { this.callback(nodes.map((target) => ({ target, isIntersecting: false })), this); }
}

/** The controller's live observer - the most recent one it built. */
function lastObserver() {
  return observers[observers.length - 1] || null;
}

function buildDocument() {
  const registry = new Map();
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  ids.forEach((id) => {
    const node = new StubNode('div');
    node.attributes.id = id;
    registry.set(id, node);
  });

  const body = new StubNode('body');

  const document = {
    readyState: 'complete',
    hidden: false,
    body,
    documentElement: new StubNode('html'),
    listeners: {},
    getElementById: (id) => registry.get(id) || null,
    createElement: (tag) => {
      const node = new StubNode(tag);
      node.ownerDocument = document;
      return node;
    },
    createTextNode: (text) => new StubText(text),
    addEventListener(type, handler) {
      (document.listeners[type] = document.listeners[type] || []).push(handler);
    },
    removeEventListener() {},
    querySelector(selector) { return body.querySelector(selector); },
    querySelectorAll(selector) { return body.querySelectorAll(selector); },
  };

  [body, document.documentElement].forEach((node) => { node.ownerDocument = document; });
  registry.forEach((node) => {
    node.ownerDocument = document;
    // Every known element really sits in the document, so a click on a control
    // can bubble up to the card that contains it.
    body.appendChild(node);
  });
  document.documentElement.appendChild(body);

  return { document, registry, body };
}

/**
 * A `fetch` Response, near enough.
 *
 * The header lookup is case-insensitive and answers an empty string for a header
 * that was not sent, because that is exactly how the real object behaves and the
 * rate-limit budget is read from it.
 */
function makeResponse(status, body, headers) {
  const sent = new Map();
  Object.keys(headers || {}).forEach((name) => {
    sent.set(name.toLowerCase(), String(headers[name]));
    sent.set(name, String(headers[name]));
  });

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => (sent.has(String(name).toLowerCase()) ? sent.get(String(name).toLowerCase()) : sent.get(String(name)) || null),
      has: (name) => sent.has(String(name).toLowerCase()),
    },
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

// ==========================================================================
// Directory responses
// ==========================================================================

function rawCamera(overrides = {}) {
  return Object.assign({
    id: 'cam-1',
    name: 'Bridge Street',
    lat: 51.51,
    lon: -0.13,
    feedUrl: 'https://example.org/frame.jpg',
    registry: {
      slug: 'example-transport',
      name: 'Example Transport Authority',
      attribution: 'Example Transport Authority',
      licenseUrl: 'https://example.org/licence',
      minPollIntervalS: 30,
    },
    stats: { trustScore: 90 },
  }, overrides);
}

/** A camera that publishes a live MJPEG stream. */
function rawStream(overrides = {}) {
  return rawCamera(Object.assign({ feedUrl: null, streamUrl: 'https://example.org/live' }, overrides));
}

/** A camera that publishes an HLS stream and no still at all. */
function rawHls(overrides = {}) {
  return rawCamera(Object.assign(
    { feedUrl: null, hlsUrl: 'https://example.org/live/index.m3u8' },
    overrides
  ));
}

function city(overrides = {}) {
  return Object.assign({
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    admin1: 'England',
    latitude: 51.5074,
    longitude: -0.1278,
  }, overrides);
}

/**
 * Boot the controller with a directory that answers as told.
 *
 * `options.payload` is what the camera endpoint returns, `options.status` is the
 * HTTP status it answers with, and `options.headers` is the budget the directory
 * publishes through `Access-Control-Expose-Headers`.
 */
function boot(options = {}) {
  const { document, registry, body } = buildDocument();
  const timers = [];
  const fetches = [];
  const sessionStore = new Map();
  const localStore = new Map();

  const fetchImpl = async (url) => {
    const href = String(url);
    fetches.push(href);

    if (href.includes('/api/cameras')) {
      const status = options.status || 200;
      if (status !== 200) return makeResponse(status, {});
      return makeResponse(200, { cameras: options.payload || [] }, options.headers);
    }
    if (href.includes('/api/registries')) {
      return makeResponse(200, options.registries || { registries: [] });
    }
    return makeResponse(404, {});
  };

  let nextTimerId = 1;
  const sandboxGlobals = {
    document,
    navigator: {},
    location: { href: 'http://localhost/', protocol: 'http:' },
    localStorage: {
      getItem: (key) => (localStore.has(key) ? localStore.get(key) : null),
      setItem: (key, value) => localStore.set(key, String(value)),
      removeItem: (key) => localStore.delete(key),
    },
    sessionStorage: {
      getItem: (key) => (sessionStore.has(key) ? sessionStore.get(key) : null),
      setItem: (key, value) => sessionStore.set(key, String(value)),
      removeItem: (key) => sessionStore.delete(key),
    },
    fetch: fetchImpl,
    setTimeout: (fn, delay) => {
      const id = nextTimerId;
      nextTimerId += 1;
      timers.push({ id, fn, delay: Number(delay) || 0, cancelled: false });
      return id;
    },
    clearTimeout: (id) => {
      const timer = timers.find((entry) => entry.id === id);
      if (timer) timer.cancelled = true;
    },
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    IntersectionObserver: StubObserver,
    AbortController,
    Date,
    Intl,
  };

  const state = { compareLocations: [] };
  const elements = {
    glanceCameraSlot: registry.get('glance-camera-slot'),
    compareCameras: registry.get('compare-cameras'),
  };

  observers.length = 0;
  const controller = loadController(Object.assign(sandboxGlobals, { elements, state }));

  return {
    controller,
    document,
    registry,
    body,
    state,
    elements,
    fetches,
    sessionStore,
    localStore,
    /** Every timer the controller has armed, cancelled or not. */
    timers,
    /** Fire every pending timer once, as a browser reaching its deadline would. */
    runTimers() {
      const pending = timers.filter((entry) => !entry.cancelled);
      timers.length = 0;
      pending.forEach((entry) => entry.fn());
    },
    pendingTimers: () => timers.filter((entry) => !entry.cancelled),
    /** The timers that look like a camera refresh (the source's own cadence). */
    pollTimers: () => timers.filter((entry) => !entry.cancelled && entry.delay >= 15000),
    observer: lastObserver,
  };
}

/**
 * Let the controller's awaits settle.
 *
 * A macrotask boundary per step, not just another `then`: the lookup runs through
 * the injected engine and two fake fetches, and microtask chaining alone does not
 * reliably drain a chain that crosses the sandbox realm boundary.
 */
function flush(steps = 4) {
  let chain = Promise.resolve();
  for (let i = 0; i < steps; i += 1) {
    chain = chain.then(() => new Promise((resolve) => { setImmediate(resolve); }));
  }
  return chain;
}

/** The panel refs, addressed the way a test reads them. */
function panelOf(host) {
  return host.querySelector('[data-ref="camera"]');
}

function refsIn(host) {
  const map = {};
  host.querySelectorAll('[data-ref]').forEach((node) => {
    map[node.getAttribute('data-ref')] = node;
  });
  return map;
}

// ==========================================================================
// Tests
// ==========================================================================

test('a snapshot camera appears in a mounted panel with its name and distance', async () => {
  const { controller, elements } = boot({ payload: [rawCamera()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);

  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  assert.equal(refs.camera.hidden, false, 'the panel stayed hidden after a camera was found');
  assert.equal(refs.cameraName.textContent, 'Bridge Street');
  assert.match(refs.cameraDistance.textContent, /km away/);
  assert.match(refs.cameraImage.src, /^https:\/\/example\.org\/frame\.jpg\?ws=\d+$/);
  assert.match(refs.cameraBadge.textContent, /Live/);
  // A still is not motion, and the badge must not claim it is.
  assert.match(refs.cameraBadge.textContent, /still/i);

  // A panel re-pointed at a city that has already been answered paints from the
  // session cache, without waiting for a network round trip.
  const other = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(other, city({ id: 'paris', name: 'Paris', latitude: 48.85, longitude: 2.35 }));
  assert.equal(other.cameraName.textContent, '', 'an uncached city was answered before it was asked about');
});

test('the attribution the registry requires is shown, linked, beside the frame', async () => {
  const { controller, elements } = boot({ payload: [rawCamera()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  assert.equal(refs.cameraCredit.hidden, false);
  assert.equal(refs.cameraCreditLink.textContent, 'Example Transport Authority');
  assert.equal(refs.cameraCreditLink.href, 'https://example.org/licence');
});

test('a polled still really changes: the next frame is a different URL', async () => {
  // The regression. The panel looked wired and stayed frozen for ever, because
  // the timestamp was written before the URL was built, so no cache-buster was
  // ever added and the browser was handed the same cached URL every tick.
  const { controller, elements, runTimers, pollTimers } = boot({ payload: [rawCamera()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  const first = refs.cameraImage.src;
  assert.match(first, /^https:\/\/example\.org\/frame\.jpg\?ws=\d+$/,
    'the first paint asks for a frame the browser cannot already have cached');

  const timer = pollTimers()[0];
  assert.ok(timer, 'the still feed is never polled, so it can never change');

  runTimers();
  assert.notEqual(refs.cameraImage.src, first, 'the poll handed back the identical URL: a frozen frame');
  assert.match(refs.cameraImage.src, /^https:\/\/example\.org\/frame\.jpg\?ws=\d+$/);

  // And again: a second tick must produce a third distinct URL.
  const second = refs.cameraImage.src;
  runTimers();
  assert.notEqual(refs.cameraImage.src, second, 'the poller stops after one refresh');
});

test('a repaint inside the cadence reuses the frame on screen instead of refetching it', async () => {
  const { controller, elements } = boot({ payload: [rawCamera()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  const shown = refs.cameraImage.src;
  controller.refreshCityCameras();
  assert.equal(refs.cameraImage.src, shown, 'a re-render threw away the frame already on screen');
});

test('an MJPEG stream plays in the image and is never polled', async () => {
  const { controller, elements, runTimers, pendingTimers } = boot({ payload: [rawStream()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  assert.equal(refs.cameraImage.hidden, false, 'an MJPEG stream must be drawn in the <img>');
  assert.equal(refs.cameraImage.src, 'https://example.org/live');
  assert.equal(refs.cameraVideo.hidden, true);
  assert.match(refs.cameraBadge.textContent, /^Live$/, 'a moving feed is not a still');

  // The stream keeps pushing frames; a timer would only restart the connection.
  assert.equal(
    pendingTimers().filter((entry) => entry.delay >= 30000).length,
    0,
    'a stream is being polled as if it were a photo'
  );
  const before = refs.cameraImage.src;
  runTimers();
  assert.equal(refs.cameraImage.src, before, 'the poller cache-busted a live stream');
});

test('an HLS stream plays in the video element', async () => {
  const { controller, elements } = boot({ payload: [rawHls()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  assert.equal(refs.cameraVideo.hidden, false, 'an HLS feed has to be played, not drawn in an <img>');
  assert.equal(refs.cameraVideo.src, 'https://example.org/live/index.m3u8');
  assert.equal(refs.cameraVideo.paused, false, 'the stream was attached but never asked to play');
  assert.equal(refs.cameraImage.hidden, true);
});

test('a stream the browser refuses to autoplay falls back, or says so', async () => {
  const { controller, elements } = boot({ payload: [rawHls()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  // The browser refuses before anything is painted, which is the real order.
  refs.cameraVideo._playResult = Promise.reject(new Error('NotAllowedError'));

  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  // This camera publishes no still at all, so the honest outcome is a stated
  // problem rather than a black rectangle.
  assert.match(refs.cameraNote.textContent, /unavailable/i);
  assert.equal(refs.cameraVideo.hidden, false);
});

test('a city with no camera says so instead of showing an empty box', async () => {
  const { controller, elements } = boot({ payload: [] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  assert.equal(refs.camera.hidden, true, 'an empty panel is on screen');
  assert.equal(refs.cameraNote.hidden, false);
  assert.match(refs.cameraNote.textContent, /No free public camera/i);
});

test('a second camera in range is offered, and cycling reaches it', async () => {
  const { controller, elements } = boot({
    payload: [
      rawCamera({ id: 'near', name: 'Bridge Street', lat: 51.51, lon: -0.13 }),
      rawCamera({ id: 'far', name: 'Ring Road', lat: 51.6, lon: -0.2 }),
    ],
  });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  assert.equal(refs.cameraName.textContent, 'Bridge Street');
  assert.equal(refs.cameraNext.hidden, false, 'the second camera is in range but unreachable');

  refs.cameraNext.click();
  assert.equal(refs.cameraName.textContent, 'Ring Road');
  assert.match(refs.cameraNextLabel.textContent, /2\/2/);

  refs.cameraNext.click();
  assert.equal(refs.cameraName.textContent, 'Bridge Street', 'cycling never wraps back round');
  assert.match(refs.cameraNextLabel.textContent, /1\/2/);
});

test('the next-camera control is absent when there is only one camera', async () => {
  const { controller, elements } = boot({ payload: [rawCamera()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  assert.equal(refs.cameraNext.hidden, true, 'a dead control is on screen for a city with one camera');
});

test('pausing stops the polling and hands the connection back', async () => {
  const { controller, elements, pendingTimers } = boot({ payload: [rawCamera()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  refs.cameraToggle.click();
  assert.equal(refs.cameraPaused, true);
  assert.equal(refs.cameraToggle.getAttribute('aria-pressed'), 'true');
  assert.equal(refs.cameraImage.hasAttribute('src'), false, 'a paused camera still holds its frame');
  assert.equal(refs.cameraBadge.hidden, true);
  assert.equal(pendingTimers().filter((entry) => entry.delay >= 30000).length, 0);

  refs.cameraToggle.click();
  assert.equal(refs.cameraPaused, false);
  assert.match(refs.cameraImage.src, /^https:\/\/example\.org\/frame\.jpg\?ws=\d+$/,
    'resuming did not bring the frame back');
});

test('the pause control does not also open the city behind it', async () => {
  const { controller, elements } = boot({ payload: [rawCamera()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  // The climate card is a role="button" that opens the city, so a click that
  // escaped the control would navigate away from the panel the visitor touched.
  let cardClicks = 0;
  refs.camera.parentNode.parentNode.parentNode.addEventListener('click', () => { cardClicks += 1; });

  refs.cameraToggle.click();
  assert.equal(refs.cameraPaused, true);
  assert.equal(cardClicks, 0, 'the pause click reached the card');
});

test('scrolling a panel off screen stops the timer and releases the media', async () => {
  const { controller, elements, pendingTimers } = boot({ payload: [rawCamera()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  controller.setCardCameraVisible(refs, false);
  assert.equal(refs.cameraImage.hasAttribute('src'), false, 'an off-screen camera keeps its frame');
  assert.equal(pendingTimers().filter((entry) => entry.delay >= 30000).length, 0);

  controller.setCardCameraVisible(refs, true);
  assert.match(refs.cameraImage.src, /^https:\/\/example\.org\/frame\.jpg\?ws=\d+$/,
    'coming back does not restore the view');
});

test('a panel is only looked up once it is on screen', async () => {
  const { controller, elements, fetches } = boot({ payload: [rawCamera()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  await flush();

  const cameraCalls = () => fetches.filter((url) => url.includes('/api/cameras'));
  assert.equal(cameraCalls().length, 0, 'the directory was asked about a card nobody could see');

  controller.setCardCameraVisible(refs, true);
  await flush();
  assert.equal(cameraCalls().length, 1);
});

test('the answer is cached for the session, so a re-render never re-asks', async () => {
  const { controller, elements, fetches, sessionStore } = boot({ payload: [rawCamera()] });

  const first = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(first, city());
  controller.setCardCameraVisible(first, true);
  await flush();

  const second = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(second, city());
  controller.setCardCameraVisible(second, true);
  await flush();

  assert.equal(fetches.filter((url) => url.includes('/api/cameras')).length, 1,
    'a second panel for the same city asked the directory again');
  assert.equal(first.cameraName.textContent, 'Bridge Street');
  assert.equal(second.cameraName.textContent, 'Bridge Street');
  assert.ok([...sessionStore.keys()].some((key) => key.includes('london')),
    'the answer was not persisted for the session');
});

test('a throttled directory is never cached as "this city has no camera"', async () => {
  // The failure this guards: a 429 used to be stored as a definitive answer, so
  // one unlucky request made the app deny cameras everywhere for the rest of the
  // visit, and the panel said "no free public camera" about a city it never asked.
  const { controller, elements, sessionStore, fetches } = boot({ status: 429 });

  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  assert.doesNotMatch(refs.cameraNote.textContent, /No free public camera/i,
    'a throttle is being reported as a fact about the city');
  assert.match(refs.cameraNote.textContent, /unavailable/i);
  assert.equal(sessionStore.size, 0, 'the throttled answer was cached for the session');
  assert.equal(controller.cameraLookupBlocked(), true, 'the app kept asking a directory that just refused it');

  // Every later city is answered from that, without a request, until the
  // cooldown lifts - and then the city is asked again.
  const second = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(second, city({ id: 'paris', name: 'Paris', latitude: 48.85, longitude: 2.35 }));
  controller.setCardCameraVisible(second, true);
  await flush();

  assert.equal(fetches.filter((url) => url.includes('/api/cameras')).length, 1,
    'the app kept hitting a directory it had been told to stop using');
  assert.match(second.cameraNote.textContent, /unavailable/i);
});

test('the throttle cooldown lifts itself and the city is asked again', async () => {
  const { controller, elements, runTimers } = boot({ status: 429 });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();
  assert.equal(controller.cameraLookupBlocked(), true);

  // The cooldown timer is the one that unblocks everything.
  runTimers();
  assert.equal(controller.cameraLookupBlocked(), false, 'a single throttle is permanent');
});

test('the directory is asked for more than one camera, over a wider box', async () => {
  const { controller, elements, fetches } = boot({ payload: [rawCamera()] });
  const refs = controller.mountCameraPanel(elements.compareCameras);
  controller.resetCameraCard(refs, city());
  controller.setCardCameraVisible(refs, true);
  await flush();

  const url = fetches.find((href) => href.includes('/api/cameras'));
  // Half a degree of latitude is ~55km: a tight box around a city centre comes
  // back empty while a camera is genuinely "in" the city a few kilometres out.
  assert.match(url, /limit=(\d+)/);
  assert.ok(Number(url.match(/limit=(\d+)/)[1]) >= 10, 'the search still asks for too few candidates');
});

test('the master switch turns every mounted panel off, and stays off for the visit', async () => {
  const app = boot({ payload: [rawCamera()] });
  const { controller, elements, localStore, fetches } = app;
  const first = controller.mountCameraPanel(elements.compareCameras);
  const second = controller.mountCameraPanel(elements.compareCameras);
  [first, second].forEach((refs, index) => {
    controller.resetCameraCard(refs, city({ id: `city-${index}` }));
    controller.setCardCameraVisible(refs, true);
  });
  await flush();
  // The controller spaces directory lookups apart with a timer, so the second
  // city is only asked once that gap has elapsed.
  app.runTimers();
  await flush();
  assert.equal(fetches.filter((url) => url.includes('/api/cameras')).length, 2);

  controller.setCamerasEnabled(false);
  assert.equal(controller.camerasEnabled(), false);
  assert.equal(localStore.get('weatherscope_city_cameras'), 'off');
  [first, second].forEach((refs) => {
    assert.equal(refs.camera.hidden, true, 'a panel is still showing with the switch off');
    assert.equal(refs.cameraImage.hasAttribute('src'), false, 'the switch does not release the frame');
    assert.match(refs.cameraNote.textContent, /off/i);
  });

  const before = fetches.filter((url) => url.includes('/api/cameras')).length;
  controller.refreshCityCameras();
  assert.equal(fetches.filter((url) => url.includes('/api/cameras')).length, before,
    'the switch is off and the app is still asking the directory');
});

test('the selected city on the dashboard gets a panel, and it survives a new search', async () => {
  const { controller, elements } = boot({ payload: [rawCamera()] });

  const refs = controller.syncGlanceCamera(city());
  assert.ok(refs, 'the dashboard never mounted a camera panel');
  assert.equal(refs.cameraName.textContent, '', 'the panel was not cleared for the new city');

  const panel = panelOf(elements.glanceCameraSlot);
  assert.ok(panel, 'no panel in the glance card');
  assert.equal(controller.cameraState.panels.size, 1);

  // A new search must not leave the previous city's panel registered and running.
  controller.syncGlanceCamera(city({ id: 'paris', name: 'Paris', latitude: 48.85, longitude: 2.35 }));
  assert.equal(controller.cameraState.panels.size, 1, 'each search leaked another panel');
  assert.equal(panelOf(elements.glanceCameraSlot), panel, 'the panel was rebuilt instead of re-pointed');
  assert.equal(panel.querySelector('[data-ref="cameraName"]').textContent, '');
});

test('each compared city gets its own panel, and dropping one releases it', async () => {
  const { controller, elements, state } = boot({ payload: [rawCamera(), rawStream({ id: 'cam-2', lat: 51.6, lon: -0.2 })] });

  state.compareLocations = [
    { city: city({ id: 'london' }) },
    { city: city({ id: 'paris', name: 'Paris', latitude: 48.85, longitude: 2.35 }) },
  ];
  controller.renderCompareCameras();

  const cells = elements.compareCameras.querySelectorAll('.compare-camera-cell');
  assert.equal(cells.length, 2, 'a comparison of two cities has two panels');
  assert.equal(controller.cameraState.panels.size, 2);
  assert.equal(cells[0].querySelector('.compare-camera-city').textContent, 'London');
  assert.equal(cells[1].querySelector('.compare-camera-city').textContent, 'Paris');

  // Removing a city must hand its media back, not just hide it.
  state.compareLocations = [{ city: city({ id: 'london' }) }];
  controller.renderCompareCameras();
  assert.equal(elements.compareCameras.querySelectorAll('.compare-camera-cell').length, 1);
  assert.equal(controller.cameraState.panels.size, 1, 'the dropped city is still holding a panel');
});

test('the panel is registered under its own id, so one observer reaches every view', async () => {
  const { controller, elements } = boot({ payload: [rawCamera()] });
  const first = controller.mountCameraPanel(elements.compareCameras);
  const second = controller.mountCameraPanel(elements.compareCameras);

  assert.notEqual(first.cameraPanelId, second.cameraPanelId, 'two panels share one id');
  assert.equal(first.camera.getAttribute('data-camera-panel'), first.cameraPanelId);
  assert.equal(controller.cameraState.panels.size, 2);

  controller.observeCityCards();
  const observer = lastObserver();
  assert.equal(observer.observed.length, 2, 'the observer is not watching both panels');

  // A visibility change on one panel must not disturb the other.
  controller.resetCameraCard(first, city({ id: 'london' }));
  controller.resetCameraCard(second, city({ id: 'paris', name: 'Paris', latitude: 48.85, longitude: 2.35 }));
  observer.enter([first.camera]);
  await flush();
  assert.equal(first.cameraRecord.status, 'found');
  assert.equal(second.cameraRecord, null, 'the panel that was not on screen was looked up anyway');
});
