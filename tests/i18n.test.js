'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const I18n = require('../i18n.js');
I18n.translations.fr = require('../fr.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)]
  .map((match) => match[1]).sort();

const geoUrls = {
  ipwho: 'https://ipwho.is/',
  country: 'https://api.country.is/',
  geojs: 'https://get.geojs.io/v1/ip/country.json',
  ipinfo: 'https://ipinfo.io/json',
  ipapi: 'https://ipapi.co/json/',
};

function loadIsolatedI18n({ geoResponses, search = '', storedLanguage = null, browserLanguage = 'de' }) {
  const localStorage = {
    getItem: () => storedLanguage ? JSON.stringify({ lang: storedLanguage, v: 1 }) : null,
    setItem: () => {},
    removeItem: () => {},
  };
  const window = {
    localStorage,
    location: { search },
    navigator: { language: browserLanguage, languages: [browserLanguage] },
    Intl,
    fetch: async (url) => {
      const response = geoResponses[url];
      if (!response) return { ok: false, text: async () => '' };
      return { ok: response.ok !== false, text: async () => JSON.stringify(response.body) };
    },
  };
  const sandbox = {
    window,
    URL,
    URLSearchParams,
    Promise,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'i18n.js'), 'utf8'), sandbox);
  return sandbox.I18n;
}

for (const lang of ['it', 'es', 'fr']) {
  test(`${lang} has a built-in translation for every English UI and runtime string`, () => {
    const english = I18n.translations.en;
    const translated = I18n.translations[lang];

    Object.keys(english).forEach((key) => {
      assert.equal(typeof translated[key], 'string', `${lang} is missing ${key}`);
      assert.deepEqual(placeholders(translated[key]), placeholders(english[key]),
        `${lang}.${key} must retain the English interpolation placeholders`);
    });
  });
}

test('Italian and Spanish are available in country detection and the language picker', () => {
  assert.equal(I18n.langForCountry('IT'), 'it');
  assert.equal(I18n.langForCountry('ES'), 'es');
  assert.match(html, /<option value="it">Italiano \(IT\)<\/option>/);
  assert.match(html, /<option value="es">Español \(ES\)<\/option>/);
});

test('French is registered before app startup and selected for French-speaking countries', () => {
  assert.equal(I18n.langForCountry('FR'), 'fr');
  assert.equal(I18n.langForCountry('BE'), 'fr');
  assert.match(html, /<option value="fr">Français \(FR\)<\/option>/);
  assert.ok(html.indexOf('src="fr.js"') > html.indexOf('src="i18n.js"'));
  assert.ok(html.indexOf('src="fr.js"') < html.indexOf('src="app.js"'));
});

test('IP country selects the matching embedded language family', async () => {
  for (const [country, expected] of [
    ['GR', 'el'], ['CY', 'el'], ['FR', 'fr'], ['IT', 'it'], ['ES', 'es'], ['DE', 'de'],
  ]) {
    const isolated = loadIsolatedI18n({
      geoResponses: {
        [geoUrls.ipwho]: { body: { country_code: country, ip: '203.0.113.12', city: 'Example City' } },
      },
    });
    const result = await isolated.detectLanguage();
    assert.equal(result.lang, expected, `${country} should select ${expected}`);
    assert.equal(result.source, 'ip');
    assert.equal(result.country, country);
    assert.equal(result.city, 'Example City');
  }
});

test('country-only geolocation responses can still select the matching dictionary', async () => {
  const isolated = loadIsolatedI18n({ geoResponses: { [geoUrls.country]: { body: { country: 'CY' } } } });
  const result = await isolated.detectLanguage();
  assert.equal(result.lang, 'el');
  assert.equal(result.country, 'CY');
  assert.equal(result.ip, null);
  assert.equal(result.city, null);
});

test('unsupported IP countries and failed lookups default to English, not browser language', async () => {
  const unsupported = loadIsolatedI18n({
    geoResponses: {
      [geoUrls.ipwho]: { body: { country_code: 'JP', ip: '203.0.113.12', city: 'Tokyo' } },
    },
    browserLanguage: 'fr',
  });
  assert.equal((await unsupported.detectLanguage()).lang, 'en');

  const failed = loadIsolatedI18n({ geoResponses: {}, browserLanguage: 'it' });
  const result = await failed.detectLanguage();
  assert.equal(result.lang, 'en');
  assert.equal(result.source, 'default');
});

test('stored manual and URL-selected languages continue to override IP detection', async () => {
  const geoResponses = {
    [geoUrls.ipwho]: { body: { country_code: 'GR', ip: '203.0.113.12', city: 'Athens' } },
  };
  const stored = loadIsolatedI18n({ geoResponses, storedLanguage: 'fr' });
  const storedResult = await stored.detectLanguage();
  assert.equal(storedResult.lang, 'fr');
  assert.equal(storedResult.source, 'stored');

  const query = loadIsolatedI18n({ geoResponses, search: '?lang=es', storedLanguage: 'fr' });
  const queryResult = await query.detectLanguage();
  assert.equal(queryResult.lang, 'es');
  assert.equal(queryResult.source, 'query');
});
