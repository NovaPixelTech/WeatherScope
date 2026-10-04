'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const I18n = require('../i18n.js');
I18n.translations.fr = require('../fr.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const i18nSource = fs.readFileSync(path.join(__dirname, '..', 'i18n.js'), 'utf8');
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

// ==========================================================================
// Country recognition
// --------------------------------------------------------------------------
// The IP services disagree about what a "country" is. Some answer
// `{"country_code":"DE"}`, some `{"country":"Germany"}`, some a description
// already written in the visitor's own language - and one of the reasons they
// disagree is that each is localising the same country for its own audience.
// So all three shapes have to be recognised, and they all have to agree.
// ==========================================================================

test('an ISO 3166-1 alpha-2 code is the shape to trust first', () => {
  const expected = {
    DE: 'de', AT: 'de', CH: 'de',
    GR: 'el', CY: 'el',
    IT: 'it', SM: 'it',
    ES: 'es', MX: 'es', AR: 'es',
    FR: 'fr', BE: 'fr', SN: 'fr',
    US: 'en', GB: 'en', IE: 'en', CA: 'en', AU: 'en', NZ: 'en',
  };
  Object.keys(expected).forEach((code) => {
    assert.equal(I18n.langForCountry(code), expected[code], `${code} resolved wrongly`);
  });
});

test('a country with no embedded dictionary resolves to nothing, not to English', () => {
  // Guessing here is worse than declining: a visitor in Japan, Portugal or
  // South Africa is better served by their browser's preference than by a
  // language nobody chose.
  ['JP', 'BR', 'CN', 'IN', 'ZA', 'NG', 'PT', 'NL', 'PL', 'TR', 'TH'].forEach((code) => {
    assert.equal(I18n.langForCountry(code), null, `${code} should have no opinion`);
  });
});

test('a country named in English is recognised', () => {
  const expected = {
    GERMANY: 'de', AUSTRIA: 'de', SWITZERLAND: 'de',
    GREECE: 'el', CYPRUS: 'el',
    ITALY: 'it', 'SAN MARINO': 'it',
    SPAIN: 'es', MEXICO: 'es', ARGENTINA: 'es',
    FRANCE: 'fr', BELGIUM: 'fr', SENEGAL: 'fr', MADAGASCAR: 'fr',
  };
  Object.keys(expected).forEach((name) => {
    assert.equal(I18n.langForCountry(name), expected[name], `${name} resolved wrongly`);
  });
});

test('the same country named in each embedded language agrees with its own code', () => {
  // This is the case a hand-written alias table gets wrong: a German name for
  // France must still answer `fr`, because it is still France.
  const byCountry = {
    DE: ['Germany', 'Deutschland', 'Germania', 'Allemagne', '\u0393\u03b5\u03c1\u03bc\u03b1\u03bd\u03af\u03b1'],
    GR: ['Greece', 'Griechenland', 'Grecia', 'Gr\u00e8ce', '\u0395\u03bb\u03bb\u03ac\u03b4\u03b1', '\u0395\u03bb\u039b\u0391\u03a3'],
    IT: ['Italy', 'Italia', 'Italie', 'Italien', '\u0399\u03c4\u03b1\u03bb\u03af\u03b1'],
    ES: ['Spain', 'Espa\u00f1a', 'Espagne', 'Spanien', '\u0399\u03c3\u03c0\u03b1\u03bd\u03af\u03b1'],
    FR: ['France', 'Frankreich', 'Francia', '\u0393\u03b1\u03bb\u03bb\u03af\u03b1'],
    BE: ['Belgium', 'Belgique'],
    CH: ['Switzerland', 'Schweiz'],
  };
  Object.keys(byCountry).forEach((code) => {
    const expected = I18n.langForCountry(code);
    byCountry[code].forEach((name) => {
      assert.equal(I18n.langForCountry(name), expected,
        `"${name}" is ${code}, so it must resolve to ${expected}, not to the language it is written in`);
    });
  });
});

test('casing, accents and stray punctuation do not decide the language', () => {
  ['germany', 'GERMANY', '  Germany  ', 'GerMaNy'].forEach((form) => {
    assert.equal(I18n.langForCountry(form), 'de', `"${form}" resolved wrongly`);
  });
  // "ESPANA" with no tilde is what services send when the encoding is mangled.
  assert.equal(I18n.langForCountry('ESPANA'), 'es');
  assert.equal(I18n.langForCountry('MEXICO'), 'es');
  assert.equal(I18n.langForCountry('HAITI'), 'fr');
  assert.equal(I18n.langForCountry("Cote d'Ivoire"), 'fr');
});

test('a trailing qualifier is ignored, because services send the long UN form', () => {
  assert.equal(I18n.langForCountry('Bolivia (Plurinational State of)'), 'es');
  assert.equal(I18n.langForCountry('Germany (Federal Republic of)'), 'de');
});

test('"UK" is resolved even though it is not an ISO code', () => {
  // It is two letters, so a strict alpha-2 branch would reject it outright.
  assert.equal(I18n.langForCountry('UK'), 'en');
  assert.equal(I18n.langForCountry('GB'), 'en');
});

test('nothing recognisable resolves to nothing rather than throwing', () => {
  ['', '   ', 'Atlantis', 'ZZ', 'Narnia', null, undefined, 42, {}, []].forEach((input) => {
    assert.equal(I18n.langForCountry(input), null, `${JSON.stringify(input)} should have no opinion`);
  });
});

test('the localized-name index is derived from the codes, not maintained by hand', () => {
  // If these two ever drift apart the localized lookups start answering with a
  // different language than the code for the same country, which is the exact
  // bug this table is derived to make impossible.
  assert.doesNotMatch(i18nSource, /'\u0393\u0395\u03a1\u039c\u0391\u039d\u0399\u0391':/, 'a hand-written cross-language alias is back');
  assert.doesNotMatch(i18nSource, /'FRANKREICH':\s*'de'/, 'a German name for France must not answer German');
  assert.doesNotMatch(i18nSource, /'GRIECHENLAND':\s*'de'/, 'a German name for Greece must not answer German');
  assert.doesNotMatch(i18nSource, /'ITALIEN':\s*'de'/, 'a German name for Italy must not answer German');
  assert.doesNotMatch(i18nSource, /'SPANIEN':\s*'de'/, 'a German name for Spain must not answer German');
  assert.match(i18nSource, /Intl\.DisplayNames/);
});
