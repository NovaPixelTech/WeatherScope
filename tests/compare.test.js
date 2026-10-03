'use strict';
/**
 * WeatherScope Compare Locations - comparison engine tests
 * =========================================================================
 * `compare.js` is pure by design (no DOM, no network, no clock), so it can be
 * driven directly here with realistic Open-Meteo payloads.
 *
 *     node --test
 *
 * The properties worth protecting are the ones a comparison can get subtly,
 * silently wrong: refusing a duplicate, degrading one failed column without
 * taking the others down, never inventing a difference between equals, and
 * never letting a missing reading masquerade as zero.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const Compare = require(path.join(__dirname, '..', 'compare.js'));

// --- Fixtures ---------------------------------------------------------------

function city(name, country, latitude, longitude, extra = {}) {
  return { name, country, latitude, longitude, ...extra };
}

const ATHENS = city('Athens', 'Greece', 37.9838, 23.7275, { admin1: 'Attica', timezone: 'Europe/Athens' });
const OSLO = city('Oslo', 'Norway', 59.9139, 10.7522, { admin1: 'Oslo', timezone: 'Europe/Oslo' });
const CAIRO = city('Cairo', 'Egypt', 30.0444, 31.2357, { admin1: 'Cairo', timezone: 'Africa/Cairo' });
const QUITO = city('Quito', 'Ecuador', -0.1807, -78.4678, { admin1: 'Pichincha', timezone: 'America/Guayaquil' });

/**
 * A realistic single-location payload. Overrides are merged one level deep, so
 * a test only has to state the field it actually cares about.
 */
function payload(overrides = {}) {
  const base = {
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
      precipitation_probability: [10, 35, 60],
    },
    daily: {
      temperature_2m_max: [28.4],
      temperature_2m_min: [19.1],
      precipitation_probability_max: [55],
      uv_index_max: [6.8],
      wind_speed_10m_max: [21.5],
      sunrise: ['2026-08-12T06:34'],
      sunset: ['2026-08-12T20:16'],
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

/** One filled location slot. */
function slot(selected, overrides = {}) {
  return { city: selected, weather: payload(overrides), error: null };
}

function select(...cities) {
  return cities.map((selected) => ({ city: selected, weather: null, error: null }));
}

// ==========================================================================
// 1. Identity
// ==========================================================================

test('cityKey prefers the bundled id, so renames cannot duplicate a column', () => {
  const a = city('Paris', 'France', 48.85, 2.35, { id: 2988507 });
  const b = city('Paris, Ile-de-France', 'France', 48.9, 2.4, { id: 2988507 });
  assert.equal(Compare.cityKey(a), Compare.cityKey(b));
  assert.ok(Compare.isSameCity(a, b));
});

test('accent, case and punctuation differences do not make a duplicate', () => {
  assert.ok(Compare.isSameCity(city('São Paulo', 'Brazil', -23.55, -46.63), city('sao paulo', 'BRAZIL', -23.55, -46.63)));
  assert.ok(Compare.isSameCity(city('Gütersloh', 'Germany', 51.9, 8.4), city('Gutersloh', 'Germany', 51.9, 8.4)));
});

test('a missing country does not block a match', () => {
  // The GPS fallback resolves to coordinates with no country at all.
  assert.ok(Compare.isSameCity(city('Athens', '', 37.98, 23.72), ATHENS));
});

test('genuinely different places are not collapsed', () => {
  assert.equal(Compare.isSameCity(ATHENS, OSLO), false);
  assert.equal(Compare.isSameCity(city('Paris', 'France', 48.85, 2.35), city('Paris', 'Texas', 33.4, -97.1)), false);
});

test('cityLabel is the "Name, Country" form used in every sentence', () => {
  assert.equal(Compare.cityLabel(ATHENS), 'Athens, Greece');
  assert.equal(Compare.cityLabel(city('Nowhere', '', 0, 0)), 'Nowhere');
  assert.equal(Compare.cityLabel(null), 'Unknown location');
});

// ==========================================================================
// 2. Selection
// ==========================================================================

test('addLocation appends a fresh, empty slot', () => {
  const result = Compare.addLocation(select(ATHENS), OSLO);
  assert.equal(result.added, true);
  assert.equal(result.reason, null);
  assert.equal(result.locations.length, 2);
  assert.equal(result.locations[1].city.name, 'Oslo');
  assert.equal(result.locations[1].weather, null);
  assert.equal(result.locations[1].error, null);
});

test('addLocation refuses a duplicate and says why', () => {
  const result = Compare.addLocation(select(ATHENS, OSLO), city('Athens', 'Greece', 37.98, 23.72));
  assert.equal(result.added, false);
  assert.equal(result.reason, 'duplicate');
  assert.equal(result.locations.length, 2, 'a refused add must not mutate the list');
});

test('addLocation stops at the maximum and says why', () => {
  let list = select();
  [ATHENS, OSLO, CAIRO, QUITO].forEach((c) => {
    const result = Compare.addLocation(list, c);
    assert.equal(result.added, true);
    list = result.locations;
  });

  const overflow = Compare.addLocation(list, city('Lima', 'Peru', -12.05, -77.04));
  assert.equal(overflow.added, false);
  assert.equal(overflow.reason, 'full');
  assert.equal(overflow.locations.length, Compare.THRESHOLDS.maxLocations);
});

test('addLocation rejects a place it could never fetch weather for', () => {
  const result = Compare.addLocation(select(ATHENS), { name: 'Nowhere', country: 'X', latitude: null, longitude: null });
  assert.equal(result.added, false);
  assert.equal(result.reason, 'invalid');
});

test('removing is index-based and out-of-range indexes are a no-op', () => {
  const list = select(ATHENS, OSLO, CAIRO);
  assert.deepEqual(Compare.removeLocation(list, 1).map((s) => s.city.name), ['Athens', 'Cairo']);
  assert.deepEqual(Compare.removeLocation(list, -1).map((s) => s.city.name), ['Athens', 'Oslo', 'Cairo']);
  assert.deepEqual(Compare.removeLocation(list, 99).map((s) => s.city.name), ['Athens', 'Oslo', 'Cairo']);
});

test('re-picking the same place keeps its fetched weather', () => {
  const list = [slot(ATHENS), slot(OSLO)];
  const same = Compare.replaceLocation(list, 0, city('Athens', 'Greece', 37.9838, 23.7275));
  assert.ok(same[0].weather, 'identical re-pick must not throw the data away');

  const swapped = Compare.replaceLocation(list, 0, CAIRO);
  assert.equal(swapped[0].city.name, 'Cairo');
  assert.equal(swapped[0].weather, null, 'a new place has no weather yet');
});

test('replacing out of range leaves the list untouched', () => {
  const list = [slot(ATHENS), slot(OSLO)];

  assert.deepEqual(
    Compare.replaceLocation(list, 99, CAIRO).map((s) => s.city.name),
    ['Athens', 'Oslo'],
    'an index past the end must not append'
  );
  assert.deepEqual(
    Compare.replaceLocation(list, -1, CAIRO).map((s) => s.city.name),
    ['Athens', 'Oslo']
  );
  assert.deepEqual(
    Compare.replaceLocation(list, 1, null).map((s) => s.city.name),
    ['Athens', 'Oslo'],
    'a null place must not blank a slot'
  );
});

test('isSameCity tolerates incomplete records', () => {
  assert.equal(Compare.isSameCity(null, ATHENS), false);
  assert.equal(Compare.isSameCity(ATHENS, undefined), false);
  // Same coordinates from a re-pick is the same place, not a duplicate slot.
  assert.equal(Compare.isSameCity(ATHENS, city('Athens', 'Greece', 37.9838, 23.7275)), true);
});

test('moveLocation reorders without dropping or cloning a slot', () => {
  const list = [slot(ATHENS), slot(OSLO), slot(CAIRO)];

  const up = Compare.moveLocation(list, 2, -1);
  assert.deepEqual(up.map((s) => s.city.name), ['Athens', 'Cairo', 'Oslo']);
  assert.equal(up[1], list[2], 'the same slot object is moved, not rebuilt');

  const offEnd = Compare.moveLocation(list, 0, -1);
  assert.deepEqual(offEnd.map((s) => s.city.name), ['Athens', 'Oslo', 'Cairo']);
  assert.deepEqual(Compare.moveLocation(list, 2, 1).map((s) => s.city.name), ['Athens', 'Oslo', 'Cairo']);
});

test('canCompare needs two, canAddMore stops at four', () => {
  assert.equal(Compare.canCompare(select()), false);
  assert.equal(Compare.canCompare(select(ATHENS)), false);
  assert.equal(Compare.canCompare(select(ATHENS, OSLO)), true);

  assert.equal(Compare.canAddMore(select(ATHENS, OSLO, CAIRO)), true);
  assert.equal(Compare.canAddMore(select(ATHENS, OSLO, CAIRO, QUITO)), false);
});

test('clearLocations empties the list', () => {
  assert.deepEqual(Compare.clearLocations(select(ATHENS, OSLO)), []);
});

// ==========================================================================
// 3. Reading one location
// ==========================================================================

test('rain chance comes from the hour stamped on the current reading', () => {
  const entry = Compare.toEntry(ATHENS, payload());
  // current.time is 14:00, so the second hourly sample (35%) is the one.
  assert.equal(entry.rainChance, 35);
});

test('sunrise and sunset are reduced to clock times', () => {
  const entry = Compare.toEntry(ATHENS, payload());
  assert.equal(entry.sun, '06:34 / 20:16');
});

test('a payload with no hourly or daily section degrades to nulls', () => {
  const entry = Compare.toEntry(ATHENS, { current: { temperature_2m: 20 } });
  assert.equal(entry.rainChance, null);
  assert.equal(entry.high, null);
  assert.equal(entry.low, null);
  assert.equal(entry.dailyRainChance, null);
  assert.equal(entry.sun, null);
});

// ==========================================================================
// 4. The current-conditions table
// ==========================================================================

test('every current metric renders a string for a healthy payload', () => {
  const table = Compare.buildTable([slot(ATHENS), slot(OSLO)], Compare.DEFAULT_FORMAT);

  assert.equal(table.columns.length, 2);
  assert.equal(table.okCount, 2);
  table.rows.forEach((row) => {
    assert.ok(row.label, `row ${row.key} has no label`);
    assert.equal(row.cells.length, 2);
    row.cells.forEach((cell, i) => {
      assert.equal(typeof cell.text, 'string', `row ${row.key} col ${i} text`);
      assert.notEqual(cell.text, '', `row ${row.key} col ${i} produced no text`);
    });
  });
});

test('a failed column degrades to unavailable while the others stay readable', () => {
  const list = [
    { city: ATHENS, weather: payload(), error: null },
    { city: OSLO, weather: null, error: 'Request timed out after 12 seconds' },
    slot(CAIRO),
  ];

  const table = Compare.buildTable(list, Compare.DEFAULT_FORMAT);

  assert.deepEqual(table.columns.map((c) => c.status), ['ok', 'error', 'ok']);
  assert.equal(table.okCount, 2);
  assert.equal(table.columns[1].error, 'Request timed out after 12 seconds');

  const temperature = table.rows.find((row) => row.key === 'temperature');
  assert.equal(temperature.cells[0].available, true);
  assert.equal(temperature.cells[1].available, false);
  assert.equal(temperature.cells[1].text, '--');
  assert.equal(temperature.cells[2].available, true);
});

test('a missing reading is unavailable, never a zero', () => {
  const list = [
    slot(ATHENS, { current: { precipitation: null } }),
    slot(OSLO, { current: { precipitation: 1.4 } }),
  ];

  const row = Compare.buildTable(list, Compare.DEFAULT_FORMAT).rows.find((r) => r.key === 'precipitation');
  assert.equal(row.cells[0].available, false);
  assert.equal(row.cells[0].value, null);
  assert.equal(row.cells[1].available, true);
  assert.equal(row.cells[1].value, 1.4);
});

test('extremes are emphasised neutrally, and only when the gap is notable', () => {
  const list = [
    slot(ATHENS, { current: { temperature_2m: 30 } }),
    slot(OSLO, { current: { temperature_2m: 20 } }),
    slot(CAIRO, { current: { temperature_2m: 22 } }),
  ];

  const row = Compare.buildTable(list, Compare.DEFAULT_FORMAT).rows.find((r) => r.key === 'temperature');
  assert.equal(row.cells[0].emphasis, 'high');
  assert.equal(row.cells[1].emphasis, 'low');
  assert.equal(row.cells[2].emphasis, null);
});

test('a sub-threshold spread emphasises nothing', () => {
  const list = [
    slot(ATHENS, { current: { temperature_2m: 21 } }),
    slot(OSLO, { current: { temperature_2m: 20 } }),
  ];
  const row = Compare.buildTable(list, Compare.DEFAULT_FORMAT).rows.find((r) => r.key === 'temperature');
  row.cells.forEach((cell) => assert.equal(cell.emphasis, null));
});

test('ties mark every equal extreme rather than picking an arbitrary winner', () => {
  const list = [
    slot(ATHENS, { current: { temperature_2m: 30 } }),
    slot(OSLO, { current: { temperature_2m: 30 } }),
    slot(CAIRO, { current: { temperature_2m: 10 } }),
  ];
  const row = Compare.buildTable(list, Compare.DEFAULT_FORMAT).rows.find((r) => r.key === 'temperature');
  assert.deepEqual(row.cells.map((c) => c.emphasis), ['high', 'high', 'low']);
});

test('spread needs at least two readable values', () => {
  const single = Compare.buildTable([slot(ATHENS)], Compare.DEFAULT_FORMAT);
  const span = Compare.spread(Compare.CURRENT_METRICS.find((m) => m.key === 'temperature'), single.columns);
  assert.deepEqual(span.high, []);
  assert.equal(span.notable, false);
});

test('the table survives a location with no weather object at all', () => {
  const table = Compare.buildTable([{ city: ATHENS }, { city: null, weather: null }], Compare.DEFAULT_FORMAT);
  assert.deepEqual(table.columns.map((c) => c.status), ['error', 'error']);
  table.rows.forEach((row) => {
    row.cells.forEach((cell) => {
      assert.equal(cell.text, '--');
      assert.equal(cell.available, false);
    });
  });
});

// ==========================================================================
// 5. The forecast table
// ==========================================================================

test('the forecast table exposes today high, low, rain, UV and wind', () => {
  const table = Compare.buildForecastTable([slot(ATHENS), slot(OSLO)], Compare.DEFAULT_FORMAT);
  assert.deepEqual(table.rows.map((r) => r.key), ['high', 'low', 'rainChance', 'uvMax', 'windMax']);

  const high = table.rows[0];
  assert.equal(high.cells[0].value, 28.4);
  assert.equal(high.cells[0].text, '28');
});

test('max wind is available because the shared query asks for it', () => {
  const row = Compare.buildForecastTable([slot(ATHENS)], Compare.DEFAULT_FORMAT).rows.find((r) => r.key === 'windMax');
  assert.equal(row.cells[0].value, 21.5);
});

// ==========================================================================
// 6. Insights
// ==========================================================================

test('a big temperature gap produces one sentence naming both cities', () => {
  const list = [
    slot(ATHENS, { current: { temperature_2m: 31 } }),
    slot(OSLO, { current: { temperature_2m: 14 } }),
  ];

  const insights = Compare.buildInsights(list, Compare.DEFAULT_FORMAT);
  const sentence = insights.find((s) => s.includes('Athens') && s.includes('Oslo'));

  assert.ok(sentence, `expected a temperature sentence, got ${JSON.stringify(insights)}`);
  // The gap is 17 degrees, and the warmer city is the one named first.
  assert.equal(sentence, 'Athens, Greece is 17° warmer than Oslo, Norway.');
});

test('locations that are simply alike produce no temperature sentence', () => {
  const list = [
    slot(ATHENS, { current: { temperature_2m: 24 } }),
    slot(OSLO, { current: { temperature_2m: 23 } }),
  ];
  assert.equal(
    Compare.buildInsights(list, Compare.DEFAULT_FORMAT).some((s) => /Athens/.test(s) && /Oslo/.test(s)),
    false,
    'a 1° difference must stay unmentioned'
  );
});

test('identical locations never get a difference invented between them', () => {
  assert.deepEqual(Compare.buildInsights([slot(ATHENS), slot(ATHENS)], Compare.DEFAULT_FORMAT), []);
});

test('one failed column is excluded rather than treated as the extreme', () => {
  const list = [
    slot(ATHENS, { current: { temperature_2m: 24 } }),
    { city: OSLO, weather: null, error: 'Weather data unavailable' },
  ];
  // One readable location is not a comparison at all.
  assert.deepEqual(Compare.buildInsights(list, Compare.DEFAULT_FORMAT), []);
});

test('insights never exceed the statement budget', () => {
  const list = [
    slot(ATHENS, {
      current: { temperature_2m: 40, apparent_temperature: 41, wind_speed_10m: 60, uv_index: 11, relative_humidity_2m: 5, precipitation: 9, cloud_cover: 0 },
    }),
    slot(OSLO, {
      current: { temperature_2m: 2, apparent_temperature: 0, wind_speed_10m: 4, uv_index: 0.2, relative_humidity_2m: 95, precipitation: 0, cloud_cover: 100 },
    }),
  ];

  const insights = Compare.buildInsights(list, Compare.DEFAULT_FORMAT);
  assert.ok(insights.length > 0);
  assert.ok(
    insights.length <= Compare.THRESHOLDS.maxInsights,
    `emitted ${insights.length} sentences, budget is ${Compare.THRESHOLDS.maxInsights}`
  );
});

test('insight wording stays factual, never good/bad', () => {
  const list = [
    slot(ATHENS, { current: { temperature_2m: 34, apparent_temperature: 36, wind_speed_10m: 44, relative_humidity_2m: 10, cloud_cover: 0, uv_index: 10, precipitation: 6 } }),
    slot(OSLO, { current: { temperature_2m: 8, apparent_temperature: 5, wind_speed_10m: 6, relative_humidity_2m: 88, cloud_cover: 95, uv_index: 0.5, precipitation: 0 } }),
  ];

  Compare.buildInsights(list, Compare.DEFAULT_FORMAT).forEach((sentence) => {
    assert.doesNotMatch(sentence, /\b(best|worst|better|worse|good|bad|perfect|terrible)\b/i, sentence);
  });
});

test('wind sentences carry their unit, so no sentence ends in a bare number', () => {
  const list = [
    slot(ATHENS, { current: { wind_speed_10m: 60 } }),
    slot(OSLO, { current: { wind_speed_10m: 8 } }),
  ];

  const format = { ...Compare.DEFAULT_FORMAT, windSymbol: 'km/h' };
  const wind = Compare.buildInsights(list, format).find((s) => /[Ww]ind/.test(s));

  assert.ok(wind, 'expected a wind sentence');
  assert.match(wind, /km\/h/);
});

test('a metric with no insight function never reaches the list', () => {
  // "Weather" and "Sunrise / sunset" are categorical: there is no gap to rank.
  const list = [
    slot(ATHENS, { current: { weather_code: 0 } }),
    slot(OSLO, { current: { weather_code: 95 } }),
  ];
  assert.equal(Compare.buildInsights(list, Compare.DEFAULT_FORMAT).some((s) => /Clear sky|Thunderstorm/.test(s)), false);
});

// ==========================================================================
// 7. Robustness
// ==========================================================================

test('a caller-supplied formatter is used verbatim, so units stay owned by the app', () => {
  const format = {
    ...Compare.DEFAULT_FORMAT,
    temp: (value) => `${Math.round((value * 9) / 5 + 32)}°F`,
    windSymbol: 'mph',
  };

  const row = Compare.buildTable([slot(ATHENS, { current: { temperature_2m: 20 } })], format)
    .rows.find((r) => r.key === 'temperature');

  assert.equal(row.cells[0].text, '68°F');
});

test('a throwing formatter degrades one cell instead of breaking the table', () => {
  const format = {
    ...Compare.DEFAULT_FORMAT,
    temp: () => {
      throw new Error('boom');
    },
  };

  const table = Compare.buildTable([slot(ATHENS), slot(OSLO)], format);
  const row = table.rows.find((r) => r.key === 'temperature');

  assert.equal(row.cells[0].text, '--');
  assert.equal(row.cells[1].available, true, 'the underlying reading is still known');
});

test('buildTable and buildInsights tolerate a malformed list', () => {
  assert.doesNotThrow(() => Compare.buildTable(null, null));
  assert.doesNotThrow(() => Compare.buildTable(undefined, undefined));
  assert.deepEqual(Compare.buildInsights(null, null), []);
  assert.doesNotThrow(() => Compare.buildForecastTable([], null));
});