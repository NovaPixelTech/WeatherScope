/**
 * WeatherScope "Today at a Glance" - summary engine tests
 * =========================================================================
 * Zero-dependency tests for `glance.js`, run with the Node test runner:
 *
 *     node --test
 *
 * There is no build step and no test framework in this project, so the suite
 * uses only `node:test` + `node:assert` and hand-rolled fixtures that mirror
 * the shape of an Open-Meteo payload.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Glance = require('../glance.js');

// ==========================================================================
// Fixture helpers
// ==========================================================================

/**
 * Build an hourly payload whose hours start at `startHour:00` on 2026-10-02 and
 * roll the calendar forward past midnight, exactly like a real payload.
 */
function buildHourly(spec) {
  const count = spec.temps.length;
  const startHour = parseInt(String(spec.now).slice(0, 2), 10);
  const pad2 = (n) => String(n).padStart(2, '0');

  const midnight = Date.UTC(2026, 9, 2);
  const time = [];
  for (let i = 0; i < count; i++) {
    const stamp = new Date(midnight + (startHour + i) * 3600000);
    time.push(`${stamp.getUTCFullYear()}-${pad2(stamp.getUTCMonth() + 1)}-${pad2(stamp.getUTCDate())}T${pad2(stamp.getUTCHours())}:00`);
  }

  const fill = (value, fallback) => {
    if (Array.isArray(value)) return value.slice(0, count);
    return new Array(count).fill(value === undefined ? fallback : value);
  };

  return {
    time,
    temperature_2m: fill(spec.temps),
    apparent_temperature: fill(spec.apparent, null),
    precipitation: fill(spec.mm, 0),
    precipitation_probability: fill(spec.chance, 0),
    wind_speed_10m: fill(spec.wind, 8),
    weather_code: fill(spec.code, 3),
  };
}

/** A mild, dry, cloudy day: 00:00-23:00, 18 °C, 5% rain, light wind. */
function buildDay(overrides = {}) {
  return buildHourly(Object.assign({
    now: '00:00',
    temps: new Array(24).fill(18),
    apparent: new Array(24).fill(17),
    chance: 5,
    mm: 0,
    wind: 8,
    code: 3,
  }, overrides));
}

/** Formatters that mimic app.js in Celsius mode. */
const CELSIUS_FORMAT = {
  temp: (c) => String(Math.round(c)),
  tempSymbol: '°C',
  wind: (kmh) => Number(kmh).toFixed(1),
  windSymbol: 'km/h',
  precip: (mm) => Number(mm).toFixed(1),
  precipSymbol: 'mm',
  percent: (v) => `${Math.round(v)}%`,
  cardinal: (deg) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][
    Math.round(((deg % 360) < 0 ? deg + 360 : deg) / 22.5) % 16
  ],
  conditionLabel: (code) => ({ 0: 'Clear sky', 2: 'Partly cloudy', 3: 'Overcast', 61: 'Slight rain', 95: 'Thunderstorm' }[code] || 'Unknown'),
};

/** Formatters that mimic app.js in Fahrenheit mode. */
const FAHRENHEIT_FORMAT = Object.assign({}, CELSIUS_FORMAT, {
  temp: (c) => String(Math.round((c * 9) / 5 + 32)),
  tempSymbol: '°F',
  wind: (kmh) => (kmh * 0.621371).toFixed(1),
  windSymbol: 'mph',
  precip: (mm) => (mm * 0.0393701).toFixed(2),
  precipSymbol: 'in',
});

function build(current, hourly, extra = {}, format = CELSIUS_FORMAT) {
  return Glance.build(Object.assign({
    current,
    hourly,
    currentTime: '2026-10-02T12:00',
    city: { name: 'Gütersloh', admin1: 'North Rhine-Westphalia', country: 'Germany' },
    format,
  }, extra));
}

/** The mock case: 17 °C, feels like 16 °C, overcast, 20% rain, 14 km/h, 72%. */
function typicalCurrent(overrides = {}) {
  return Object.assign({
    temperature_2m: 17,
    apparent_temperature: 16,
    weather_code: 3,
    relative_humidity_2m: 72,
    wind_speed_10m: 14,
    wind_direction_10m: 315,
    precipitation: 0,
  }, overrides);
}

// ==========================================================================
// 1. The shape of a glance
// ==========================================================================
test('a typical day renders every field the card paints', () => {
  const glance = build(typicalCurrent(), buildDay({ temps: new Array(24).fill(17), apparent: new Array(24).fill(16), chance: 20, wind: 14 }));

  assert.equal(glance.ok, true);
  assert.equal(glance.location.name, 'Gütersloh');
  assert.equal(glance.location.meta, 'North Rhine-Westphalia, Germany');
  assert.equal(glance.temperature, '17');
  assert.equal(glance.tempSymbol, '°C');
  assert.equal(glance.feelsLike, '16°C');
  assert.equal(glance.condition, 'Overcast');
  assert.deepEqual(glance.metrics.map((m) => m.label), ['Rain', 'Wind', 'Humidity']);
  assert.deepEqual(glance.metrics.map((m) => m.value), ['20%', '14.0 km/h', '72%']);
});

test('the rain metric names its own meaning, because "20%" is ambiguous', () => {
  const glance = build(typicalCurrent(), buildDay({ chance: 20 }));
  const rain = glance.metrics[0];

  assert.equal(rain.hint, 'peak chance today');
  assert.equal(glance.metrics[2].hint, 'relative humidity');
});

test('the wind metric carries the cardinal direction as a note', () => {
  const glance = build(typicalCurrent({ wind_direction_10m: 315 }), buildDay());
  assert.equal(glance.metrics[1].note, 'NW');
});

test('a missing reading renders "--" instead of a fabricated number', () => {
  const glance = build(
    { temperature_2m: 17, weather_code: 3 },
    { time: ['2026-10-02T12:00'], temperature_2m: [17], weather_code: [3] }
  );

  assert.equal(glance.metrics[0].value, '--');
  assert.equal(glance.metrics[0].hint, 'not reported');
  assert.equal(glance.metrics[1].value, '--');
  assert.equal(glance.metrics[2].value, '--');
});

test('a location without admin1/country still renders', () => {
  const glance = build(typicalCurrent(), buildDay(), { city: { name: 'Somewhere' } });
  assert.equal(glance.location.name, 'Somewhere');
  assert.equal(glance.location.meta, '');
});

// ==========================================================================
// 2. The verdict ladder
// ==========================================================================
test('a dry, mild day is Good weather', () => {
  const glance = build(typicalCurrent(), buildDay({ chance: 5, wind: 8 }));

  assert.equal(glance.verdict.id, 'good');
  assert.equal(glance.verdict.text, 'Good weather');
  assert.equal(glance.verdict.tone, 'good');
  assert.equal(glance.verdict.icon, '\uD83D\uDC4D');
  assert.match(glance.verdict.detail, /^Dry /);
});

test('a likely-rain day is Umbrella recommended', () => {
  // 20% chance / 0.0 mm is below the umbrella threshold: still good weather.
  const borderline = build(
    typicalCurrent({ temperature_2m: 12, apparent_temperature: 10 }),
    buildDay({ temps: new Array(24).fill(12), apparent: new Array(24).fill(10), chance: 20, mm: 0 })
  );
  assert.equal(borderline.verdict.id, 'good');

  // The wettest stretch is 15:00, i.e. after "now", so it is still today's rain.
  const wet = build(
    typicalCurrent({ temperature_2m: 12, apparent_temperature: 10 }),
    buildDay({
      temps: new Array(24).fill(12),
      apparent: new Array(24).fill(10),
      chance: [20, 20, 65, 70, 20, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 70, 0, 0, 0, 0, 0, 0, 0, 0],
      mm: [0, 0, 0.5, 1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2, 0, 0, 0, 0, 0, 0, 0, 0],
    })
  );

  assert.equal(wet.verdict.id, 'umbrella');
  assert.equal(wet.verdict.text, 'Umbrella recommended');
  assert.equal(wet.verdict.tone, 'caution');
  assert.equal(wet.verdict.icon, '\u2614');
  assert.match(wet.verdict.detail, /70%/);
  assert.match(wet.verdict.detail, /15:00/);
});

test('rain already falling is reported as such, not as a percentage', () => {
  const glance = build(
    typicalCurrent({ precipitation: 1.2, temperature_2m: 12, apparent_temperature: 11 }),
    buildDay({ temps: new Array(24).fill(12), apparent: new Array(24).fill(11), chance: 80, mm: 1.2 })
  );

  assert.equal(glance.verdict.id, 'umbrella');
  assert.match(glance.verdict.detail, /right now/);
});

test('a snow day outranks the umbrella verdict', () => {
  const glance = build(
    typicalCurrent({ temperature_2m: -1, apparent_temperature: -4, weather_code: 71 }),
    buildDay({ temps: new Array(24).fill(-1), apparent: new Array(24).fill(-4), chance: 80, mm: 2, code: 71 })
  );

  assert.equal(glance.verdict.id, 'snow');
  assert.equal(glance.verdict.tone, 'warn');
});

test('a thunderstorm outranks everything else', () => {
  const glance = build(
    typicalCurrent({ temperature_2m: 20, apparent_temperature: 19, weather_code: 95 }),
    buildDay({ temps: new Array(24).fill(20), apparent: new Array(24).fill(19), chance: 90, mm: 5, code: 95 })
  );

  assert.equal(glance.verdict.id, 'storm');
  assert.equal(glance.verdict.tone, 'bad');
});

test('freezing and heat are judged on "feels like", not on the raw reading', () => {
  const cold = build(
    typicalCurrent({ temperature_2m: 2, apparent_temperature: -4 }),
    buildDay({ temps: new Array(24).fill(2), apparent: new Array(24).fill(-4), chance: 5 })
  );
  assert.equal(cold.verdict.id, 'freezing');

  const hot = build(
    typicalCurrent({ temperature_2m: 31, apparent_temperature: 36 }),
    buildDay({ temps: new Array(24).fill(31), apparent: new Array(24).fill(36), chance: 5 })
  );
  assert.equal(hot.verdict.id, 'hot');
});

test('a hot but dry day is still called hot - heat outranks comfort', () => {
  const glance = build(
    typicalCurrent({ temperature_2m: 34, apparent_temperature: 35 }),
    buildDay({ temps: new Array(24).fill(34), apparent: new Array(24).fill(35), chance: 0, wind: 5 })
  );
  assert.equal(glance.verdict.id, 'hot');
});

test('gale-force wind is reported when nothing worse is happening', () => {
  const glance = build(
    typicalCurrent({ wind_speed_10m: 46 }),
    buildDay({ chance: 5, wind: 46 })
  );
  assert.equal(glance.verdict.id, 'gale');
  assert.equal(glance.verdict.tone, 'warn');
});

test('a stray rain code beside a 5% forecast does not demand an umbrella', () => {
  // No probability and no amount anywhere: the code is the only evidence of rain.
  const dry = build(
    { temperature_2m: 17, weather_code: 61 },
    { time: ['2026-10-02T12:00'], temperature_2m: [17], weather_code: [61] }
  );
  assert.equal(dry.verdict.id, 'umbrella', 'a rain code with no readings still means rain');

  // With readings present they win: a 5% / 0.0 mm forecast is a dry day.
  const overridden = build(typicalCurrent({ weather_code: 61 }), buildDay({ chance: 5, mm: 0, code: 61 }));
  assert.equal(overridden.verdict.id, 'good', 'readings win over the code');
});

test('every verdict in the ladder is reachable and uniquely worded', () => {
  const ids = Glance.VERDICT_ORDER;
  assert.deepEqual(ids, Object.keys(Glance.VERDICTS));

  const texts = ids.map((id) => Glance.VERDICTS[id].text);
  assert.equal(new Set(texts).size, texts.length, 'two verdicts share the same sentence');

  ids.forEach((id) => {
    assert.ok(Glance.VERDICTS[id].icon.length > 0, `${id} has no icon`);
    assert.ok(['good', 'caution', 'warn', 'bad'].includes(Glance.VERDICTS[id].tone), `${id} has no tone`);
  });
});

// ==========================================================================
// 3. Units
// ==========================================================================
test('the °F toggle repaints the glance without any logic of its own', () => {
  const current = typicalCurrent({ temperature_2m: 17, apparent_temperature: 16 });
  const hourly = buildDay({ temps: new Array(24).fill(17), apparent: new Array(24).fill(16), chance: 20, wind: 14 });

  const c = build(current, hourly);
  const f = build(current, hourly, {}, FAHRENHEIT_FORMAT);

  assert.equal(c.temperature, '17');
  assert.equal(c.tempSymbol, '°C');
  assert.equal(c.feelsLike, '16°C');
  assert.equal(c.metrics[1].value, '14.0 km/h');

  assert.equal(f.temperature, '63');
  assert.equal(f.tempSymbol, '°F');
  assert.equal(f.feelsLike, '61°F');
  assert.equal(f.metrics[1].value, '8.7 mph');

  // A unit is a display concern, so the verdict itself cannot change.
  assert.equal(f.verdict.id, c.verdict.id);
  assert.equal(f.metrics[0].value, c.metrics[0].value);
});

test('a missing formatter falls back to the built-in defaults', () => {
  // No `format` at all: the engine still paints (its defaults are Celsius), and
  // the only field with no sensible default - the condition label - degrades.
  const glance = Glance.build({ current: typicalCurrent(), hourly: buildDay() });
  assert.equal(glance.temperature, '17');
  assert.equal(glance.tempSymbol, '°C');
  assert.equal(glance.condition, '--');
  assert.ok(glance.verdict.text.length > 0);
});

// ==========================================================================
// 4. Robustness
// ==========================================================================
test('a payload with nothing usable reports ok:false so the card can hide', () => {
  assert.equal(Glance.build().ok, false);
  assert.equal(Glance.build({}).ok, false);
  assert.equal(Glance.build({ current: null, hourly: null, daily: null }).ok, false);
  assert.equal(Glance.build({ current: { temperature_2m: null, weather_code: null } }).ok, false);
  assert.equal(build({ temperature_2m: 17, weather_code: 3 }, null).ok, true);
});

test('a hostile payload is contained, not propagated', () => {
  const hostile = new Proxy({}, {
    get() {
      throw new Error('boom');
    },
  });

  const glance = Glance.build({ current: hostile, hourly: hostile, daily: hostile, currentTime: hostile });
  assert.equal(glance.ok, false);
  assert.equal(glance.verdict, null);
});

test('partial arrays, null entries and ragged hourly rows never invent data', () => {
  const glance = build(
    typicalCurrent(),
    {
      time: ['2026-10-02T12:00', '2026-10-02T13:00', '2026-10-02T14:00'],
      temperature_2m: [17, null, 18],
      apparent_temperature: [16, null, 17],
      precipitation_probability: [20, null, 30],
      precipitation: [0, null, 0],
      wind_speed_10m: [14, 14],
      weather_code: [3, null, 3],
    }
  );

  assert.equal(glance.ok, true);
  assert.equal(glance.temperature, '17');
  // A `null` entry is "no reading", never 0% and never 0 mm.
  assert.equal(glance.metrics[0].value, '30%');
});

test('"today" stops at midnight, so tomorrow\'s storm cannot leak in', () => {
  const hourly = {
    time: ['2026-10-02T12:00', '2026-10-02T23:00', '2026-10-03T09:00'],
    temperature_2m: [17, 16, 20],
    apparent_temperature: [16, 15, 21],
    precipitation_probability: [5, 5, 5],
    precipitation: [0, 0, 0],
    wind_speed_10m: [10, 12, 45],
    weather_code: [3, 3, 95],
  };

  const glance = build(typicalCurrent(), hourly, { currentTime: '2026-10-02T12:00' });

  assert.equal(glance.verdict.id, 'good');
  assert.notEqual(glance.verdict.id, 'storm');
});

test('hours before "now" are ignored', () => {
  // A freezing night, mild from noon onwards: at 12:00 the cold is already over.
  const hourly = buildDay({
    temps: new Array(12).fill(-9).concat(new Array(12).fill(17)),
    apparent: new Array(12).fill(-12).concat(new Array(12).fill(16)),
  });

  const morning = build(typicalCurrent({ temperature_2m: 17, apparent_temperature: 16 }), hourly, { currentTime: '2026-10-02T12:00' });
  assert.equal(morning.verdict.id, 'good', 'the cold night behind us is not today');

  const night = build(typicalCurrent({ temperature_2m: -7, apparent_temperature: -11 }), hourly, { currentTime: '2026-10-02T02:00' });
  assert.equal(night.verdict.id, 'freezing');
});

test('the daily block is the fallback when the hourly rows are unusable', () => {
  const glance = build(
    typicalCurrent(),
    { time: [] },
    { daily: { precipitation_probability_max: [80] } }
  );

  assert.equal(glance.metrics[0].value, '80%');
  assert.equal(glance.verdict.id, 'umbrella');
});

test('the same payload always yields the same glance', () => {
  const current = typicalCurrent();
  const hourly = buildDay({ chance: 40, mm: 0.3, wind: 14 });
  const first = JSON.stringify(build(current, hourly));
  for (let i = 0; i < 5; i++) {
    assert.equal(JSON.stringify(build(current, hourly)), first);
  }
});

test('no verdict detail leaks an "undefined" or a double space', () => {
  const cases = [
    build(typicalCurrent(), buildDay()),
    build(typicalCurrent({ wind_direction_10m: null }), buildDay({ wind: 46 })),
    build(typicalCurrent({ temperature_2m: -4, apparent_temperature: -6 }), buildDay({ temps: new Array(24).fill(-4), apparent: new Array(24).fill(-6) })),
    build(typicalCurrent({ precipitation: 0.4 }), buildDay({ chance: 90, mm: 0.4 })),
  ];

  cases.forEach((glance) => {
    assert.doesNotMatch(glance.verdict.detail, /undefined|NaN|\s{2}|,\s*\./);
    assert.ok(glance.verdict.detail.endsWith('.'), glance.verdict.detail);
  });
});