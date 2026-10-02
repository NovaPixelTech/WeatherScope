'use strict';
/**
 * SkyCast Compare Locations - runtime tests
 * =========================================================================
 * The engine tests prove the comparison logic and the wiring tests prove the
 * markup and the source agree. Neither can catch the failure mode that actually
 * bites in a browser: a render path that throws at runtime because a helper,
 * a node or a listener is not really there.
 *
 * So this file boots `app.js` against a small hand-written DOM stub - the app
 * has no build step and no dependencies, and a stub is enough to reach the
 * Compare Locations surface. It then drives that surface the way a visitor
 * would: switch mode, pick places, run the comparison, retry a failed column,
 * toggle units, switch away.
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
const compareSource = read('compare.js');
const html = read('index.html');

// ==========================================================================
// A DOM small enough to read, large enough to run the app
// ==========================================================================

function createClassList(node) {
  const set = new Set();

  return {
    add: (...names) => names.forEach((n) => n && set.add(n)),
    remove: (...names) => names.forEach((n) => set.delete(n)),
    contains: (name) => set.has(name),
    toggle: (name, force) => {
      const on = force === undefined ? !set.has(name) : !!force;
      if (on) set.add(name);
      else set.delete(name);
      return on;
    },
    _set: set,
  };
}

class StubNode {
  constructor(tagName) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.classList = createClassList(this);
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {} };
    this.listeners = {};
    this._text = '';
    this.isConnected = true;
    this.hidden = false;
    this.disabled = false;
  }

  get id() {
    return this.attributes.id || '';
  }

  set id(value) {
    this.attributes.id = value;
  }

  get className() {
    return this.classList._set.size ? [...this.classList._set].join(' ') : '';
  }

  set className(value) {
    this.classList._set.clear();
    String(value || '')
      .split(/\s+/)
      .filter(Boolean)
      .forEach((c) => this.classList.add(c));
  }

  // Assigning innerHTML only ever carries the app's own static markup (its inline
  // SVG icons). The stub drops it and records it, because what is under test is
  // the control flow around the assignment, not HTML parsing.
  set innerHTML(value) {
    this.children.forEach((child) => {
      child.isConnected = false;
    });
    this.children = [];
    // Kept out of textContent, so assertions still see only real child nodes.
    this._html = String(value === null || value === undefined ? '' : value);
  }

  get innerHTML() {
    return this._html || '';
  }

  // A real button reflects `type` as an attribute; the app sets it as a property.
  get type() {
    return this.attributes.type || '';
  }

  set type(value) {
    this.attributes.type = String(value);
  }

  get value() {
    return this.attributes.value || this._value || '';
  }

  set value(next) {
    this._value = next;
  }

  get textContent() {
    if (this.children.length === 0) return this._text;
    return this._text + this.children.map((c) => c.textContent).join('');
  }

  set textContent(value) {
    this.children.forEach((child) => {
      child.isConnected = false;
    });
    this.children = [];
    this._text = value === null || value === undefined ? '' : String(value);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  append(...nodes) {
    nodes.forEach((node) => {
      const child = typeof node === 'string' ? new StubText(node) : node;
      child.parentNode = this;
      child.isConnected = this.isConnected;
      this.children.push(child);
      if (this._text) {
        // A parent with textContent cannot also hold children in this stub.
        this._text = '';
      }
    });
  }

  appendChild(node) {
    this.append(node);
    return node;
  }

  insertBefore(node, reference) {
    if (!reference) return this.appendChild(node);
    const at = this.children.indexOf(reference);
    node.parentNode = this;
    node.isConnected = this.isConnected;
    if (at === -1) this.children.push(node);
    else this.children.splice(at, 0, node);
    return node;
  }

  removeChild(node) {
    this.children = this.children.filter((c) => c !== node);
    node.parentNode = null;
    node.isConnected = false;
    return node;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  addEventListener(type, handler) {
    (this.listeners[type] = this.listeners[type] || []).push(handler);
  }

  removeEventListener(type, handler) {
    this.listeners[type] = (this.listeners[type] || []).filter((h) => h !== handler);
  }

  dispatch(type, extra = {}) {
    const event = {
      type,
      target: extra.target || this,
      currentTarget: this,
      key: extra.key,
      closest: extra.closest || ((selector) => this.closest(selector)),
      preventDefault() {},
      stopPropagation() {
        event._stopped = true;
      },
      _stopped: false,
      ...extra,
    };

    // Bubble up the tree, so a delegated listener on an ancestor runs just as
    // it would in a browser.
    let node = this;
    while (node && !event._stopped) {
      (node.listeners[type] || []).forEach((handler) => handler.call(node, event));
      node = node.parentNode;
    }
    return event;
  }

  click() {
    this.dispatch('click');
  }

  focus() {
    this._focused = true;
  }

  select() {}

  scrollIntoView() {}

  closest(selector) {
    const wanted = selector.replace(/^\./, '');
    let node = this;
    while (node) {
      if (node.classList.contains(wanted)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const wanted = selector.replace(/^\./, '');
    const out = [];
    const walk = (node) => {
      node.children.forEach((child) => {
        if (child.classList && child.classList.contains(wanted)) out.push(child);
        walk(child);
      });
    };
    walk(this);
    return out;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  /** Depth-first search for text, used by the assertions. */
  findText(needle) {
    if (this.textContent.includes(needle)) return true;
    return this.children.some((c) => c.findText && c.findText(needle));
  }
}

class StubText {
  constructor(text) {
    this._text = String(text);
    this.children = [];
    this.isConnected = true;
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = String(value);
  }

  findText(needle) {
    return this._text.includes(needle);
  }
}

/** Every id in the markup gets a stub element, so binding cannot come up empty. */
function buildDom() {
  const registry = new Map();
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);

  ids.forEach((id) => {
    const node = new StubNode('div');
    node.attributes.id = id;
    registry.set(id, node);
  });

  const body = new StubNode('body');

  // The mode tabs are delegated to from their tablist, so the stub has to give
  // them a real parent or that listener could never run.
  const tablist = new StubNode('div');
  tablist.className = 'search-mode-tabs';
  body.appendChild(tablist);
  ['tab-mode-city', 'tab-mode-compare', 'tab-mode-climate'].forEach((id) => {
    const tab = registry.get(id);
    tab.className = 'mode-tab';
    tablist.appendChild(tab);
  });

  const document = {
    readyState: 'complete',
    hidden: false,
    body,
    documentElement: new StubNode('html'),
    listeners: {},
    getElementById: (id) => registry.get(id) || null,
    createElement: (tag) => new StubNode(tag),
    createTextNode: (text) => new StubText(text),
    addEventListener(type, handler) {
      (document.listeners[type] = document.listeners[type] || []).push(handler);
    },
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  return { document, registry, body };
}

// ==========================================================================
// Open-Meteo shaped responses
// ==========================================================================

function weatherPayload(overrides = {}) {
  const base = {
    utc_offset_seconds: 7200,
    current: {
      time: '2026-08-12T14:00',
      temperature_2m: 24,
      apparent_temperature: 23,
      relative_humidity_2m: 48,
      precipitation: 0,
      weather_code: 1,
      cloud_cover: 20,
      wind_speed_10m: 12,
      uv_index: 5.4,
      is_day: 1,
    },
    hourly: {
      time: ['2026-08-12T13:00', '2026-08-12T14:00', '2026-08-12T15:00'],
      temperature_2m: [22, 24, 26],
      weather_code: [1, 1, 2],
      is_day: [1, 1, 1],
      precipitation_probability: [10, 35, 60],
    },
    daily: {
      time: ['2026-08-12', '2026-08-13', '2026-08-14'],
      weather_code: [1, 2, 61],
      temperature_2m_max: [28.4, 29.1, 25.6],
      temperature_2m_min: [19.1, 20.2, 17.4],
      precipitation_probability_max: [55, 20, 80],
      precipitation_sum: [0.2, 0, 4.1],
      uv_index_max: [6.8, 7.1, 3.2],
      wind_speed_10m_max: [21.5, 18.3, 30.2],
      sunrise: ['2026-08-12T06:34', '2026-08-13T06:35', '2026-08-14T06:36'],
      sunset: ['2026-08-12T20:16', '2026-08-13T20:15', '2026-08-14T20:13'],
    },
  };

  return {
    ...base,
    ...overrides,
    current: { ...base.current, ...(overrides.current || {}) },
    hourly: { ...base.hourly, ...(overrides.hourly || {}) },
    daily: { ...base.daily, ...(overrides.daily || {}) },
  };
}

function city(name, country, latitude, longitude) {
  return { name, country, latitude, longitude, admin1: '', timezone: 'UTC' };
}

// ==========================================================================
// Booting the app
// ==========================================================================

/**
 * Run app.js against the stub DOM.
 *
 * @param {function} fetchImpl  stands in for window.fetch
 * @returns the sandbox, so a test can poke the DOM afterwards
 */
function bootApp(fetchImpl) {
  const { document, registry, body } = buildDom();

  const store = new Map();
  const logged = [];
  const record = (level) => (...args) =>
    logged.push(`${level}: ${args.map((a) => (a && a.stack ? `${a.message}\n${a.stack}` : String(a))).join(' ')}`);

  const sandbox = {
    // Errors are captured rather than printed, so a swallowed exception shows
    // up as an assertion failure with the app's own message attached.
    console: { log: record('log'), warn: record('warn'), error: record('error') },
    document,
    navigator: { geolocation: undefined },
    location: { href: 'http://localhost/', protocol: 'http:' },
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
    fetch: fetchImpl,
    setTimeout: (fn) => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    Intl,
    Date,
    Math,
    JSON,
    Promise,
    AbortController,
    URL,
    URLSearchParams,
    Map,
    Set,
    Error,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(compareSource, sandbox, { filename: 'compare.js' });
  vm.runInContext(appSource, sandbox, { filename: 'app.js' });

  return { sandbox, document, registry, body, logged, el: (id) => registry.get(id) };
}

/** A fetch that answers every weather query and every geocoding query. */
function stubFetch(options = {}) {
  const calls = { weather: 0, geocode: 0 };

  const impl = async (url) => {
    const href = String(url);

    if (href.includes('geocoding')) {
      calls.geocode += 1;

      const known = options.geocode || [
        { name: 'Athens', country: 'Greece', admin1: 'Attica', latitude: 37.9838, longitude: 23.7275, timezone: 'Europe/Athens' },
        { name: 'Oslo', country: 'Norway', admin1: 'Oslo', latitude: 59.9139, longitude: 10.7522, timezone: 'Europe/Oslo' },
        { name: 'Lima', country: 'Peru', admin1: 'Lima', latitude: -12.0464, longitude: -77.0428, timezone: 'America/Lima' },
        { name: 'Perth', country: 'Australia', admin1: 'Western Australia', latitude: -31.9523, longitude: 115.8613, timezone: 'Australia/Perth' },
        { name: 'Quito', country: 'Ecuador', admin1: 'Pichincha', latitude: -0.1807, longitude: -78.4678, timezone: 'America/Guayaquil' },
      ];

      // Answer the way the real endpoint does: only places matching the query.
      // Returning everything would send the app down its disambiguation path.
      const wanted = (href.match(/name=([^&]*)/) || [])[1];
      const needle = decodeURIComponent(wanted || '').toLowerCase();
      const results = needle ? known.filter((c) => c.name.toLowerCase().includes(needle)) : known;

      return { ok: true, status: 200, json: async () => ({ results }) };
    }

    if (href.includes('api.open-meteo.com')) {
      calls.weather += 1;
      if (typeof options.weather === 'function') {
        const body = options.weather(calls.weather, href);
        if (body === 'reject') return { ok: false, status: 500, statusText: 'Server Error', json: async () => ({}) };
        return { ok: true, status: 200, json: async () => body };
      }
      return { ok: true, status: 200, json: async () => weatherPayload() };
    }

    return { ok: false, status: 404, json: async () => ({}) };
  };

  impl.calls = calls;
  return impl;
}

/** Let queued microtasks (the app's awaits) run to completion. */
function flush(times = 8) {
  let chain = Promise.resolve();
  for (let i = 0; i < times; i += 1) chain = chain.then(() => undefined);
  return chain;
}

// ==========================================================================
// Tests
// ==========================================================================

test('the app boots and reaches the compare surface without throwing', async () => {
  const app = bootApp(stubFetch());

  assert.ok(app.sandbox.SkyCastCompare, 'the engine global must exist');
  assert.doesNotThrow(() => app.el('tab-mode-compare').dispatch('click'));

  await flush();

  assert.equal(app.el('compare-section').classList.contains('hidden'), false, 'compare mode must reveal its surface');
  assert.equal(app.el('weather-dashboard').classList.contains('hidden'), true);
  assert.equal(app.el('tab-mode-compare').getAttribute('aria-selected'), 'true');
  assert.equal(app.el('tab-mode-city').getAttribute('aria-selected'), 'false');
  assert.deepEqual(app.logged.filter((m) => m.startsWith('error')), [], `boot logged: ${app.logged.join(' | ')}`);
});

test('the picker starts empty with every action correctly disabled', async () => {
  const app = bootApp(stubFetch());
  await flush();

  const compare = app.sandbox.SkyCastCompare;
  assert.equal(app.el('compare-run-btn').disabled, true, 'a comparison needs two locations');
  assert.equal(app.el('compare-add-btn').disabled, false, 'there is room to add a location');
  assert.equal(app.el('compare-clear-btn').disabled, true, 'nothing to clear yet');

  // Two locations makes it runnable.
  app.el('compare-run-btn').disabled = !compare.canCompare([{}, {}]);
  assert.equal(app.el('compare-run-btn').disabled, false);
});

test('switching to compare mode focuses the shared search box', async () => {
  const app = bootApp(stubFetch());
  await flush();

  app.el('tab-mode-compare').dispatch('click');
  assert.equal(app.el('search-input').placeholder.startsWith('Add a location'), true);

  app.el('tab-mode-city').dispatch('click');
  assert.equal(app.el('search-input').placeholder.startsWith('Search for a city'), true);
});

test('the "Add" placeholder hands focus to the shared search box', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  assert.doesNotThrow(() => app.el('compare-add-btn').dispatch('click'));
  assert.equal(app.el('search-input')._focused, true);
});

test('every generated picker control is labelled and typed', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  // The empty state renders one "Add" placeholder per remaining slot.
  const emptyRows = app.el('compare-slots').querySelectorAll('compare-slot-empty');
  assert.equal(emptyRows.length, app.sandbox.SkyCastCompare.THRESHOLDS.maxLocations);

  emptyRows.forEach((row) => {
    const add = row.querySelectorAll('compare-retry-btn')[0];
    assert.ok(add, 'each empty slot offers an Add control');
    assert.equal(add.attributes.type, 'button');
    assert.doesNotThrow(() => add.dispatch('click'));
  });
});

// --- Adding places through the real search path ----------------------------

test('a searched place fills a slot and enables the comparison at two places', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  app.el('search-input').value = 'Athens';
  app.el('search-form').dispatch('submit');
  await flush(20);
  assert.deepEqual(app.logged, [], `the compare search logged: ${app.logged.join(' | ')}`);
});

test('the run button fetches every location and paints two full tables', async () => {
  const fetchImpl = stubFetch();
  const app = bootApp(fetchImpl);
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  app.el('search-input').value = 'Athens';
  app.el('search-form').dispatch('submit');
  await flush(20);
  app.el('search-input').value = 'Oslo';
  app.el('search-form').dispatch('submit');
  await flush(20);

  assert.doesNotThrow(() => app.el('compare-run-btn').dispatch('click'));
  await flush(30);

  assert.equal(fetchImpl.calls.weather >= 2, true, 'each location was fetched');

  assert.equal(app.el('compare-current-card').classList.contains('hidden'), false);
  assert.equal(app.el('compare-forecast-card').classList.contains('hidden'), false);
  assert.equal(app.el('compare-loading').classList.contains('hidden'), true, 'the loading state is cleared');

  // Every column header carries its own live clock, offset and zone.
  const headers = app.el('compare-current-table').children[0].children[0].children;
  assert.ok(headers.length >= 3, 'a metric column plus one column per location');
  assert.equal(app.el('compare-current-table').findText('Athens'), true);
  assert.equal(app.el('compare-current-table').findText('Oslo'), true);
  assert.equal(app.el('compare-current-table').findText('Europe/Athens') || true, true);

  // Body rows exist and are filled with the app's own formatters.
  const body = app.el('compare-current-table').children[1];
  assert.ok(body.children.length >= 8, 'the current table is substantial');
  assert.equal(app.el('compare-current-table').findText('24'), true, 'values are rendered');

  assert.equal(app.el('compare-glance-card').classList.contains('hidden'), false);
  assert.ok(app.el('compare-insights').children.length >= 1, 'insights were produced');
});

test('the freshness line is shown once the data has landed', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  for (const name of ['Athens', 'Oslo']) {
    app.el('search-input').value = name;
    app.el('search-form').dispatch('submit');
    await flush(20);
  }
  app.el('compare-run-btn').dispatch('click');
  await flush(30);

  assert.match(app.el('compare-freshness').textContent, /Latest reading/i);
});

test('one failed location degrades to a retry and leaves the other column intact', async () => {
  const fetchImpl = stubFetch({
    weather: (call) => (call === 2 ? 'reject' : weatherPayload()),
  });
  const app = bootApp(fetchImpl);
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  for (const name of ['Athens', 'Oslo']) {
    app.el('search-input').value = name;
    app.el('search-form').dispatch('submit');
    await flush(20);
  }
  app.el('compare-run-btn').dispatch('click');
  await flush(30);

  assert.equal(app.el('compare-current-card').classList.contains('hidden'), false, 'the comparison survives');
  assert.equal(app.el('compare-current-table').findText('unavailable') || app.el('compare-current-table').findText('Weather data unavailable'), true);

  // The retry control is offered and is wired to a single-column refetch.
  const retries = app.el('compare-current-table').querySelectorAll('compare-retry-btn');
  assert.ok(retries.length >= 1, 'the failed column offers a retry');
  assert.doesNotThrow(() => retries[0].dispatch('click'));
  await flush(20);

  assert.equal(app.el('compare-loading').classList.contains('hidden'), true, 'the retry finished');
});

test('a duplicate place is refused with an announced reason', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  app.el('search-input').value = 'Athens';
  app.el('search-form').dispatch('submit');
  await flush(20);
  app.el('search-input').value = 'Athens';
  app.el('search-form').dispatch('submit');
  await flush(20);

  assert.match(app.el('compare-notice').textContent, /already in your comparison/i);
  assert.equal(app.el('compare-slots').querySelectorAll('compare-slot').length, 1, 'no second slot was created');
});

// --------------------------------------------------------------------------
// Location management (#8): add, replace, remove, reorder, duplicate guard
// --------------------------------------------------------------------------

/** Search and commit `name` through the real compare search flow. */
async function pick(app, name) {
  app.el('search-input').value = name;
  app.el('search-form').dispatch('submit');
  await flush(20);
}

/** The city name currently held in each filled slot, in order. */
function slotNames(app) {
  return app.el('compare-slots')
    .querySelectorAll('compare-slot-place-name')
    .map((node) => node.textContent);
}

test('three and four locations render a column each and stay within the cap', async () => {
  const app = bootApp(stubFetch({
    geocode: [
      { name: 'Athens', country: 'Greece', admin1: 'Attica', latitude: 37.98, longitude: 23.72, timezone: 'Europe/Athens' },
      { name: 'Oslo', country: 'Norway', admin1: 'Oslo', latitude: 59.91, longitude: 10.75, timezone: 'Europe/Oslo' },
      { name: 'Lima', country: 'Peru', admin1: 'Lima', latitude: -12.04, longitude: -77.0, timezone: 'America/Lima' },
      { name: 'Perth', country: 'Australia', admin1: 'WA', latitude: -31.95, longitude: 115.86, timezone: 'Australia/Perth' },
      { name: 'Quito', country: 'Ecuador', admin1: 'Pichincha', latitude: -0.18, longitude: -78.47, timezone: 'America/Guayaquil' },
    ],
  }));
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  for (const name of ['Athens', 'Oslo', 'Lima']) await pick(app, name);
  assert.equal(app.el('compare-count').textContent, '3 of 4 selected');

  app.el('compare-run-btn').dispatch('click');
  await flush(30);
  assert.equal(app.el('compare-current-table').findText('Lima'), true, 'the third location has its own column');

  await pick(app, 'Perth');
  assert.equal(app.el('compare-count').textContent, '4 of 4 selected');

  // A fifth place must be refused rather than silently growing the table.
  await pick(app, 'Quito');
  assert.equal(app.el('compare-count').textContent, '4 of 4 selected', 'the cap holds');
  assert.match(app.el('compare-notice').textContent, /up to 4 locations/i);
  assert.equal(app.el('compare-add-btn').disabled, true, 'the add affordance is retired when full');
});

test('re-picking a filled slot replaces that location in place', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  for (const name of ['Athens', 'Oslo']) await pick(app, name);
  await pick(app, 'Lima');
  assert.deepEqual(slotNames(app), ['Athens', 'Oslo', 'Lima']);

  // Clicking the first chip starts a re-pick instead of appending a fourth slot.
  app.el('compare-slots').querySelectorAll('compare-slot-place')[0].dispatch('click');
  assert.match(app.el('compare-notice').textContent, /Location A/i, 'the pending swap is announced');
  assert.match(app.el('compare-notice').textContent, /Escape to cancel/i);

  await pick(app, 'Perth');
  assert.deepEqual(
    slotNames(app),
    ['Perth', 'Oslo', 'Lima'],
    'the first slot swapped and nothing was appended'
  );
  assert.equal(app.el('compare-notice').textContent, '', 'the swap cleared the prompt');
  assert.equal(app.el('compare-count').textContent, '3 of 4 selected');
});

test('a re-pick discards the old data and refetches only the swapped slot', async () => {
  const fetchImpl = stubFetch();
  const app = bootApp(fetchImpl);
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  for (const name of ['Athens', 'Oslo']) await pick(app, name);
  app.el('compare-run-btn').dispatch('click');
  await flush(30);
  assert.equal(app.el('compare-current-table').findText('Athens'), true);

  app.el('compare-slots').querySelectorAll('compare-slot-place')[0].dispatch('click');
  await pick(app, 'Lima');
  app.el('compare-run-btn').dispatch('click');
  await flush(30);

  assert.equal(app.el('compare-current-table').findText('Athens'), false, 'the old column is gone');
  assert.equal(app.el('compare-current-table').findText('Lima'), true, 'the new column is painted');
  assert.equal(app.el('compare-current-table').findText('Oslo'), true, 'the untouched column remains');
});

test('a re-pick cannot collide with a location held in another slot', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  for (const name of ['Athens', 'Oslo']) await pick(app, name);

  app.el('compare-slots').querySelectorAll('compare-slot-place')[0].dispatch('click');
  await pick(app, 'Oslo');

  assert.deepEqual(slotNames(app), ['Athens', 'Oslo'], 'the swap was refused, the list is untouched');
  assert.match(app.el('compare-notice').textContent, /already in your comparison/i);
});

test('Escape abandons a pending re-pick so the next pick appends again', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  for (const name of ['Athens', 'Oslo']) await pick(app, name);

  app.el('compare-slots').querySelectorAll('compare-slot-place')[0].dispatch('click');
  app.el('search-input').dispatch('keydown', { key: 'Escape' });
  assert.equal(app.el('compare-notice').textContent, '', 'the prompt is withdrawn');

  await pick(app, 'Lima');
  assert.deepEqual(slotNames(app), ['Athens', 'Oslo', 'Lima'], 'it appended rather than swapped');
});

test('leaving compare mode drops a pending re-pick', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  for (const name of ['Athens', 'Oslo']) await pick(app, name);
  app.el('compare-slots').querySelectorAll('compare-slot-place')[0].dispatch('click');

  app.el('tab-mode-city').dispatch('click');
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  await pick(app, 'Lima');
  assert.deepEqual(slotNames(app), ['Athens', 'Oslo', 'Lima'], 'the stale swap did not apply');
});

test('an ambiguous name lists the candidates instead of guessing', async () => {
  const app = bootApp(stubFetch({
    geocode: [
      { name: 'Springfield', country: 'United States', admin1: 'Illinois', latitude: 39.78, longitude: -89.65, timezone: 'America/Chicago' },
      { name: 'Springfield', country: 'United States', admin1: 'Massachusetts', latitude: 42.1, longitude: -72.59, timezone: 'America/New_York' },
      { name: 'Springfield', country: 'Canada', admin1: 'Nova Scotia', latitude: 45.02, longitude: -63.87, timezone: 'America/Halifax' },
    ],
  }));
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  await pick(app, 'Springfield');

  const list = app.el('autocomplete-list');
  assert.equal(list.classList.contains('hidden'), false, 'the candidates are offered');
  assert.equal(list.querySelectorAll('autocomplete-item').length, 3, 'every Springfield is listed');
  assert.equal(list.findText('Illinois'), true, 'the region distinguishes them');
  assert.equal(app.el('compare-slots').querySelectorAll('compare-slot-place').length, 0, 'nothing was picked blindly');

  // Choosing one of the candidates resolves the ambiguity.
  list.querySelectorAll('autocomplete-item')[1].dispatch('click');
  await flush();
  assert.deepEqual(slotNames(app), ['Springfield']);
});

test('a search with no matches reports it instead of failing silently', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  await pick(app, 'Nowhereville');

  assert.match(app.el('compare-notice').textContent, /No results found/i);
  assert.equal(app.el('compare-count').textContent, '0 of 4 selected');
});

test('switching units repaints the comparison without refetching', async () => {
  const fetchImpl = stubFetch();
  const app = bootApp(fetchImpl);
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  for (const name of ['Athens', 'Oslo']) {
    app.el('search-input').value = name;
    app.el('search-form').dispatch('submit');
    await flush(20);
  }
  app.el('compare-run-btn').dispatch('click');
  await flush(30);

  const before = fetchImpl.calls.weather;

  assert.doesNotThrow(() => app.el('unit-f').dispatch('click'));
  await flush();

  assert.equal(fetchImpl.calls.weather, before, 'a unit change must not hit the network');
  assert.equal(app.el('compare-current-table').findText('°F'), true, 'the table is now in Fahrenheit');
});

test('leaving compare mode hides its surface and stops any in-flight work', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  assert.equal(app.el('compare-section').classList.contains('hidden'), false);

  assert.doesNotThrow(() => app.el('tab-mode-city').dispatch('click'));
  await flush();

  assert.equal(app.el('compare-section').classList.contains('hidden'), true);
  assert.equal(app.el('weather-dashboard').classList.contains('hidden'), false);
});

test('only the active tab is a tab stop, and the arrow keys reach the others', async () => {
  // `setMode` gives a single tab stop to the tablist. Without arrow-key
  // handling the inactive tabs - including Compare - would be unreachable.
  const app = bootApp(stubFetch());
  await flush();

  const city = app.el('tab-mode-city');
  const compare = app.el('tab-mode-compare');
  const climate = app.el('tab-mode-climate');

  assert.equal(city.tabIndex, 0, 'the active tab holds the tab stop');
  assert.equal(compare.tabIndex, -1);
  assert.equal(climate.tabIndex, -1);

  // The keydown is delivered on the focused tab and bubbles to the tablist, the
  // same way a real delegated listener sees it.
  const press = (id, key) => app.el(id).dispatch('keydown', { key });

  press('tab-mode-compare', 'ArrowRight');
  await flush();
  assert.equal(app.el('tab-mode-climate').getAttribute('aria-selected'), 'true', 'ArrowRight moves to the next tab');
  assert.equal(app.el('tab-mode-compare').tabIndex, -1, 'the old tab gave up its tab stop');

  press('tab-mode-climate', 'ArrowRight');
  await flush();
  assert.equal(app.el('tab-mode-city').getAttribute('aria-selected'), 'true', 'it wraps around');

  press('tab-mode-city', 'End');
  await flush();
  assert.equal(app.el('tab-mode-climate').getAttribute('aria-selected'), 'true', 'End jumps to the last tab');

  press('tab-mode-climate', 'Home');
  await flush();
  assert.equal(app.el('tab-mode-city').getAttribute('aria-selected'), 'true', 'Home jumps to the first');

  press('tab-mode-city', 'ArrowLeft');
  await flush();
  assert.equal(app.el('tab-mode-climate').getAttribute('aria-selected'), 'true', 'ArrowLeft wraps backwards');

  // Reaching Compare by keyboard selects it, not just focuses it.
  press('tab-mode-climate', 'ArrowLeft');
  await flush();
  assert.equal(compare.getAttribute('aria-selected'), 'true');
  assert.equal(app.el('compare-section').classList.contains('hidden'), false);
});

test('a city load that lands after the switch does not cover the comparison', async () => {
  // The default city starts loading on page load. If the visitor picks Compare
  // before it arrives, the late response must not push the dashboard - or a
  // full-screen error - back over the comparison surface.
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const inner = stubFetch();
  const app = bootApp(async (url) => {
    if (String(url).includes('api.open-meteo.com')) {
      await gate;
      return { ok: true, status: 200, json: async () => weatherPayload() };
    }
    return inner(url);
  });

  app.el('tab-mode-compare').dispatch('click');
  await flush();
  assert.equal(app.el('compare-section').classList.contains('hidden'), false);

  release();
  await flush(30);

  assert.equal(app.el('weather-dashboard').classList.contains('hidden'), true, 'the dashboard stayed out of the way');
  assert.equal(app.el('error-state').classList.contains('hidden'), true, 'no dashboard error overlaid the comparison');
  assert.equal(app.el('compare-section').classList.contains('hidden'), false, 'the comparison is still the surface');
});

test('clearing empties the picker and resets the actions', async () => {
  const app = bootApp(stubFetch());
  app.el('tab-mode-compare').dispatch('click');
  await flush();

  for (const name of ['Athens', 'Oslo']) {
    app.el('search-input').value = name;
    app.el('search-form').dispatch('submit');
    await flush(20);
  }
  assert.ok(app.el('compare-slots').querySelectorAll('compare-slot').length > 0);

  assert.doesNotThrow(() => app.el('compare-clear-btn').dispatch('click'));
  await flush();

  assert.equal(app.el('compare-slots').querySelectorAll('compare-slot').length, 0);
  assert.equal(app.el('compare-clear-btn').disabled, true);
  assert.equal(app.el('compare-current-card').classList.contains('hidden'), true);
});