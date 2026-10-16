'use strict';
/**
 * WeatherScope Accounts & Favorites - runtime tests (the static-host case)
 * =========================================================================
 * The engine tests prove the local store and the API client, and the wiring
 * tests prove the markup and the source agree. Neither can catch the failure
 * mode this file exists for: the app is served by GitHub Pages (or opened with
 * `file://`), so there is *no* `/api` at all, and account creation has to fall
 * back to the browser store instead of dying on a 404.
 *
 * So this file boots `favorites.js`, `alerts.js` and `app.js` against a
 * hand-written DOM stub whose `fetch` answers every `/api/*` request with a 404
 * - exactly what a static host does - then drives the account form the way a
 * visitor would: open the panel, switch to "create account", fill it in, submit.
 * It then drives the alert bell the same way, where the only backend is the
 * browser store.
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
const favoritesSource = read('favorites.js');
const alertsSource = read('alerts.js');
const html = read('index.html');

// ==========================================================================
// A DOM small enough to read, large enough to run the app
// ==========================================================================

function createClassList() {
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
    this.classList = createClassList();
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {} };
    this.listeners = {};
    this._text = '';
    this.isConnected = true;
    this.hidden = false;
    this.disabled = false;
  }

  get id() { return this.attributes.id || ''; }
  set id(value) { this.attributes.id = value; }

  get className() { return this.classList._set.size ? [...this.classList._set].join(' ') : ''; }
  set className(value) {
    this.classList._set.clear();
    String(value || '').split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c));
  }

  set innerHTML(value) {
    this.children.forEach((child) => { child.isConnected = false; });
    this.children = [];
    this._html = String(value === null || value === undefined ? '' : value);
  }
  get innerHTML() { return this._html || ''; }

  get type() { return this.attributes.type || ''; }
  set type(value) { this.attributes.type = String(value); }

  get value() { return this.attributes.value || this._value || ''; }
  set value(next) { this._value = next; }

  get textContent() {
    if (this.children.length === 0) return this._text;
    return this._text + this.children.map((c) => c.textContent).join('');
  }
  set textContent(value) {
    this.children.forEach((child) => { child.isConnected = false; });
    this.children = [];
    this._text = value === null || value === undefined ? '' : String(value);
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  removeAttribute(name) { delete this.attributes[name]; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }

  append(...nodes) {
    nodes.forEach((node) => {
      const child = typeof node === 'string' ? new StubText(node) : node;
      child.parentNode = this;
      child.isConnected = this.isConnected;
      this.children.push(child);
      if (this._text) this._text = '';
    });
  }
  appendChild(node) { this.append(node); return node; }
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
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }

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
      stopPropagation() { event._stopped = true; },
      _stopped: false,
      ...extra,
    };
    let node = this;
    while (node && !event._stopped) {
      (node.listeners[type] || []).forEach((handler) => handler.call(node, event));
      node = node.parentNode;
    }
    return event;
  }

  click() { this.dispatch('click'); }
  focus() { this._focused = true; }
  blur() {}
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

  querySelector() { return null; }
  querySelectorAll() { return []; }
}

class StubText {
  constructor(text) {
    this._text = String(text);
    this.children = [];
    this.isConnected = true;
  }
  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); }
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
  ['tab-mode-city', 'tab-mode-compare', 'tab-mode-climate', 'tab-mode-cameras'].forEach((id) => {
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
// Booting the app the way GitHub Pages serves it
// ==========================================================================

/**
 * A fetch standing in for a static host: every `/api/*` call is a 404, exactly
 * as GitHub Pages (which cannot run `server.js`) answers it. Anything else is a
 * best-effort empty 200, because the weather calls are not what is under test.
 */
function staticHostFetch(url) {
  const target = String(url);
  if (/(^|\/)api\//.test(target)) {
    return Promise.resolve({ ok: false, status: 404, json: async () => ({ ok: false, code: 'not-found' }) });
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
}

/**
 * Boot `favorites.js` then `app.js` against the stub DOM, with a static host's
 * fetch and a real (Map-backed) `localStorage`.
 *
 * @returns {{ sandbox, registry, store, el, flush }}
 */
function bootStaticHost() {
  const { document, registry, body } = buildDom();
  const store = new Map();
  const logged = [];

  const sandbox = {
    console: { log: (...a) => logged.push(a.join(' ')), warn() {}, error(...a) { logged.push(a.join(' ')); } },
    document,
    navigator: { geolocation: undefined },
    location: { href: 'https://example.github.io/WeatherScope/', protocol: 'https:' },
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
    fetch: staticHostFetch,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    Intl, Date, Math, JSON, Promise, AbortController, URL, URLSearchParams, Map, Set, Error,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(favoritesSource, sandbox, { filename: 'favorites.js' });
  vm.runInContext(alertsSource, sandbox, { filename: 'alerts.js' });
  vm.runInContext(appSource, sandbox, { filename: 'app.js' });

  return {
    sandbox,
    registry,
    store,
    body,
    logged,
    el: (id) => registry.get(id),
    flush: async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setImmediate(r)); },
  };
}

function storedAccounts(store) {
  const raw = store.get('weatherscope_accounts');
  return raw ? JSON.parse(raw) : null;
}

// ==========================================================================
// The static-host flow
// ==========================================================================
test('on a static host the account panel offers the browser store, not an error', async () => {
  const app = bootStaticHost();
  await app.flush();

  // The health probe hit a 404, so the app knows there is no server...
  assert.equal(app.sandbox.document.getElementById('auth-note').classList.contains('hidden'), false,
    'the local-account note should be visible when no API answers');
  // ...and it must say the account lives in this browser, not that it is broken.
  assert.match(app.el('auth-note').textContent, /browser/i);
  assert.doesNotMatch(app.el('auth-note').textContent, /node server\.js/i);
});

test('creating an account on a static host succeeds and persists locally', async () => {
  const app = bootStaticHost();
  await app.flush();

  // Open the panel, switch to "create account", and fill the form.
  app.el('account-btn').click();
  app.el('account-mode-register').click();
  app.el('auth-username').value = 'Alice';
  app.el('auth-password').value = 'long enough password';
  app.el('account-form').dispatch('submit');
  await app.flush();

  // The session is a local one, kept in localStorage...
  const session = JSON.parse(app.store.get('weatherscope_auth'));
  assert.ok(session && session.token.startsWith('local:'), 'the session is not a local one');
  assert.equal(session.username, 'Alice');

  // ...and the account itself was written to the browser store, hashed.
  const accounts = storedAccounts(app.store);
  assert.ok(accounts && accounts.users.alice, 'the account was not stored');
  assert.equal(accounts.users.alice.username, 'Alice');
  assert.ok(String(app.store.get('weatherscope_accounts')).indexOf('long enough password') === -1,
    'the plaintext password reached storage');

  // The panel flips to the signed-in view.
  assert.match(app.el('account-welcome').textContent, /Alice/);
  // No account/favorites path threw (the empty weather stub logs an unrelated
  // render error, which is not what this test is about).
  const accountErrors = app.logged.filter((line) => /error/i.test(line) && /account|auth|favorit/i.test(line));
  assert.deepEqual(accountErrors, [], 'the account flow logged an error');
});

test('saving a favorite on a static host round-trips through the local store', async () => {
  const app = bootStaticHost();
  await app.flush();

  app.el('auth-username').value = 'Bob';
  app.el('auth-password').value = 'another long password';
  app.el('account-mode-register').click();
  app.el('account-form').dispatch('submit');
  await app.flush();

  // The hero star saves the city on screen. With no city loaded the test drives
  // the engine through the app's own client instead of faking weather.
  const favorites = app.sandbox.WeatherScopeFavorites;
  const client = favorites.createLocalClient({ storage: app.sandbox.localStorage });
  const token = JSON.parse(app.store.get('weatherscope_auth')).token;

  await client.saveFavorites(token, [{ name: 'Paris', latitude: 48.8566, longitude: 2.3522 }]);
  const saved = await client.getFavorites(token);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'Paris');

  // A reload of the same page must find that favorite again.
  const accounts = storedAccounts(app.store);
  assert.equal(accounts.users.bob.favorites.length, 1);
  assert.equal(accounts.users.bob.favorites[0].name, 'Paris');
});

test('the local store survives a fresh boot of the same browser', async () => {
  // First visit: create an account.
  const first = bootStaticHost();
  await first.flush();
  first.el('auth-username').value = 'Carol';
  first.el('auth-password').value = 'a third long password';
  first.el('account-mode-register').click();
  first.el('account-form').dispatch('submit');
  await first.flush();

  // Second visit: hand the same localStorage to a new boot and sign in.
  const store = first.store;
  const { document, registry } = buildDom();
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    document,
    navigator: { geolocation: undefined },
    location: { href: 'https://example.github.io/WeatherScope/', protocol: 'https:' },
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
    fetch: staticHostFetch,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    Intl, Date, Math, JSON, Promise, AbortController, URL, URLSearchParams, Map, Set, Error,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(favoritesSource, sandbox, { filename: 'favorites.js' });
  vm.runInContext(alertsSource, sandbox, { filename: 'alerts.js' });
  vm.runInContext(appSource, sandbox, { filename: 'app.js' });
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setImmediate(r));

  // The stored local session is picked back up without touching the network.
  assert.match(registry.get('account-welcome').textContent, /Carol/);
});

// ==========================================================================
// Weather alerts, on the same static host
// ==========================================================================
test('the alert bell is offered once the engine is present, and explains itself signed out', async () => {
  const app = bootStaticHost();
  await app.flush();

  // alerts.js loaded, so the bell is on screen rather than hidden.
  assert.ok(app.sandbox.WeatherScopeAlerts, 'the alert engine is missing');
  assert.equal(app.el('alerts-btn').classList.contains('hidden'), false, 'the bell should be offered');
  assert.equal(app.el('alerts-badge').classList.contains('hidden'), true, 'an empty badge must hide');
  assert.match(app.el('alerts-panel-title').textContent, /alert/i);

  // Signed out the panel holds a pointer to the account form, not a dead form.
  assert.equal(app.el('alerts-signed-out').classList.contains('hidden'), false);
  assert.equal(app.el('alerts-signed-in').classList.contains('hidden'), true);
  assert.match(app.el('alerts-signin-hint').textContent, /sign in/i);
});

test('the bell toggles the panel, and only one popover is open at a time', async () => {
  const app = bootStaticHost();
  await app.flush();

  // The stub does not parse the markup's attributes, so seed the closed state
  // the panel's `class="alerts-panel hidden"` would have carried on a real load.
  app.el('alerts-panel').classList.add('hidden');
  assert.equal(app.el('alerts-panel').classList.contains('hidden'), true, 'the panel starts closed');

  app.el('alerts-btn').click();
  assert.equal(app.el('alerts-panel').classList.contains('hidden'), false, 'the bell did not open the panel');
  assert.equal(app.el('alerts-btn').getAttribute('aria-expanded'), 'true');

  app.el('alerts-btn').click();
  assert.equal(app.el('alerts-panel').classList.contains('hidden'), true, 'the bell did not close the panel');

  // Opening the account panel closes the alerts panel rather than stacking them.
  app.el('alerts-btn').click();
  app.el('account-btn').click();
  assert.equal(app.el('alerts-panel').classList.contains('hidden'), true, 'two popovers stayed open');
});

test('signing in with no rules shows both empty states, and New alert asks for a favorite first', async () => {
  const app = bootStaticHost();
  await app.flush();

  app.el('auth-username').value = 'Dana';
  app.el('auth-password').value = 'yet another long password';
  app.el('account-mode-register').click();
  app.el('account-form').dispatch('submit');
  await app.flush();

  // Signed in, so the alerts panel flips to its real view...
  assert.equal(app.el('alerts-signed-in').classList.contains('hidden'), false);
  assert.equal(app.el('alerts-signed-out').classList.contains('hidden'), true);
  // ...with both empty states spoken from translated strings.
  assert.equal(app.el('alerts-rules-empty').classList.contains('hidden'), false);
  assert.match(app.el('alerts-rules-empty').textContent, /no weather alerts/i);
  assert.equal(app.el('alerts-active-empty').classList.contains('hidden'), false);
  assert.equal(app.el('alerts-badge').classList.contains('hidden'), true);

  // With no saved city there is nothing to alert on, so the app says so rather
  // than opening a form whose city menu would be empty.
  app.el('alerts-btn').click();
  app.el('alerts-add-btn').click();
  assert.match(app.el('alerts-status').textContent, /favorite/i);
  assert.equal(app.el('alerts-form').classList.contains('hidden'), true, 'the form should stay closed');

  // No alert path threw.
  const alertErrors = app.logged.filter((line) => /error/i.test(line) && /alert/i.test(line));
  assert.deepEqual(alertErrors, [], 'the alert flow logged an error');
});

