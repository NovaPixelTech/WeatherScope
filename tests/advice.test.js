/**
 * SkyCast Weather Assistant - recommendation engine tests
 * =========================================================================
 * Zero-dependency tests for `advice.js`, run with the Node test runner:
 *
 *     node --test
 *
 * There is no build step and no test framework in this project, so the suite
 * uses only `node:test` + `node:assert` and a hand-rolled fixture builder that
 * mirrors the shape of an Open-Meteo hourly payload.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Advice = require('../advice.js');

// ==========================================================================
// Fixture helpers
// ==========================================================================

/**
 * Build an hourly payload.
 *
 * @param {object} spec
 * @param {string} spec.now            "HH:MM" local time to start from
 * @param {number} spec.date           day of month to stamp the hours onto
 * @param {number[]} spec.temps        one value per hour (Celsius)
 * @param {object}   [overrides]       per-hour arrays: chance, mm, apparent,
 *                                     wind, cloud, code, isDay
 */
function buildHourly(spec) {
  const count = spec.temps.length;
  const startHour = parseInt(String(spec.now).slice(0, 2), 10);

  const pad2 = (n) => String(n).padStart(2, '0');
  // Real Open-Meteo payloads always carry full ISO timestamps, so the fixture
  // rolls the calendar forward past midnight instead of wrapping the hour.
  const midnight = Date.UTC(2026, 9, spec.date);
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
    cloud_cover: fill(spec.cloud, 20),
    weather_code: fill(spec.code, 1),
    is_day: fill(spec.isDay, null),
  };
}

/** Default day: 00:00-23:00, mild, dry, light wind, daylight 07:00-19:00. */
function buildDay(overrides = {}) {
  const hours = 24;
  const temps = new Array(hours).fill(18);
  const isDay = new Array(hours).fill(0);
  for (let h = 7; h <= 19; h++) isDay[h] = 1;

  const base = { now: '00:00', date: 2, temps, isDay };
  return buildHourly(Object.assign(base, overrides));
}

function context(hourly, extra = {}) {
  const first = hourly && Array.isArray(hourly.time) ? hourly.time[0] : undefined;
  return Object.assign({ hourly, currentTime: first, rainWindowKey: 'morning' }, extra);
}

/** Formatters that mimic app.js in Celsius mode. */
const CELSIUS_FORMAT = {
  temp: (c) => String(Math.round(c)),
  tempSymbol: '°C',
  wind: (kmh) => Number(kmh).toFixed(1),
  windSymbol: 'km/h',
  precip: (mm) => Number(mm).toFixed(1),
  precipSymbol: 'mm',
};

/** Formatters that mimic app.js in Fahrenheit mode. */
const FAHRENHEIT_FORMAT = {
  temp: (c) => String(Math.round((c * 9) / 5 + 32)),
  tempSymbol: '°F',
  wind: (kmh) => (kmh * 0.621371).toFixed(1),
  windSymbol: 'mph',
  precip: (mm) => (mm * 0.0393701).toFixed(2),
  precipSymbol: 'in',
};

function bundle(hourly, extra = {}, format = CELSIUS_FORMAT) {
  return Advice.getAdviceBundle(context(hourly, Object.assign({ format }, extra)));
}

// ==========================================================================
// 1. Umbrella
// ==========================================================================
test('umbrella: a dry day needs no umbrella', () => {
  const advice = bundle(buildDay({ chance: 5, mm: 0 })).decisions.umbrella;
  assert.equal(advice.verdict, 'unlikely');
  assert.equal(advice.headline, 'Probably not');
  assert.match(advice.detail, /stays low/);
});

test('umbrella: moderate chance advises one and names the window', () => {
  const chance = new Array(24).fill(10);
  for (let h = 14; h <= 16; h++) chance[h] = 45;
  const advice = bundle(buildDay({ chance })).decisions.umbrella;

  assert.equal(advice.verdict, 'likely');
  assert.equal(advice.headline, 'Bring an umbrella');
  assert.equal(advice.window, '14:00-17:00');
  assert.match(advice.detail, /14:00/);
  assert.match(advice.detail, /17:00/);
});

test('umbrella: 80% chance means definitely', () => {
  const chance = new Array(24).fill(10);
  chance[11] = 80;
  const advice = bundle(buildDay({ chance })).decisions.umbrella;
  assert.equal(advice.verdict, 'definitely');
  assert.equal(advice.headline, 'Definitely bring an umbrella');
});

test('umbrella: continuous rain all day is "definitely" and the window spans the day', () => {
  const advice = bundle(buildDay({ chance: 90, mm: 3 })).decisions.umbrella;
  assert.equal(advice.verdict, 'definitely');
  assert.equal(advice.window, '00:00-24:00');
  assert.match(advice.detail, /00:00/);
});

test('umbrella: steady drizzle with a low percentage still advises one', () => {
  // Light but measurable rain for a few hours only: not a soaking day.
  const mm = new Array(24).fill(0);
  [9, 10, 11, 12].forEach((h) => { mm[h] = 0.6; });
  const advice = bundle(buildDay({ chance: 20, mm })).decisions.umbrella;
  assert.equal(advice.verdict, 'likely');
  assert.match(advice.detail, /09:00-13:00/);
});

test('umbrella: missing precipitation data returns the graceful state', () => {
  const hourly = buildDay();
  delete hourly.precipitation_probability;
  delete hourly.precipitation;
  const advice = bundle(hourly).decisions.umbrella;
  assert.equal(advice.ok, false);
  assert.equal(advice.verdict, 'unknown');
  assert.equal(advice.headline, 'Not enough forecast data');
});

// ==========================================================================
// 2. Best time for a walk
// ==========================================================================
test('walk: picks the driest comfortable daylight window', () => {
  const chance = new Array(24).fill(60);
  for (let h = 10; h <= 12; h++) chance[h] = 5;
  const mm = new Array(24).fill(1);
  for (let h = 10; h <= 12; h++) mm[h] = 0;
  const temps = new Array(24).fill(18);

  const advice = bundle(buildDay({ chance, mm, temps })).decisions.walk;
  assert.equal(advice.window, '10:00-13:00');
  assert.equal(advice.verdict, 'good');
  assert.match(advice.detail, /18°C/);
  assert.match(advice.detail, /light wind/);
});

test('walk: rain all day means no ideal period, but a driest window is still shown', () => {
  const chance = new Array(24).fill(85);
  chance[9] = 70;
  const advice = bundle(buildDay({ chance, mm: new Array(24).fill(0.5) })).decisions.walk;
  assert.equal(advice.verdict, 'none');
  assert.equal(advice.headline, 'No ideal period today');
  assert.match(advice.detail, /driest window is/);
});

test('a window that rounds to one temperature never prints a "20-20" range', () => {
  // 19.6 and 20.4 are half a degree apart but both render as 20.
  const temps = new Array(24).fill(20);
  temps[10] = 19.6;
  temps[11] = 20.4;
  const advice = bundle(buildDay({ temps, apparent: temps, chance: 0 })).decisions.walk;
  assert.doesNotMatch(advice.detail, /20-20/);
  assert.match(advice.detail, /20°C/);
});

test('walk: prefers daylight over an equally dry night hour', () => {
  // 02:00-04:00 is dry but dark; 09:00-11:00 is dry and in daylight.
  const chance = new Array(24).fill(70);
  [2, 3, 9, 10].forEach((h) => (chance[h] = 5));
  const advice = bundle(buildDay({ chance })).decisions.walk;
  assert.equal(advice.window, '09:00-11:00');
});

test('walk: a short forecast cannot produce a window', () => {
  const advice = bundle(buildDay({ now: '22:00', temps: [12, 11, 10] })).decisions.walk;
  // Only three hours left of the local day -> the engine switches to next-24h,
  // but this payload has nothing beyond them, so the answer stays graceful.
  assert.ok(['none', 'good', 'unknown'].includes(advice.verdict));
});

// ==========================================================================
// 3. Car wash
// ==========================================================================
test('car wash: a long dry stretch is a good day', () => {
  const advice = bundle(buildDay({ chance: 0, mm: 0 })).decisions.carWash;
  assert.equal(advice.verdict, 'good');
  assert.match(advice.headline, /wash the car/i);
  assert.match(advice.detail, /Dry conditions/);
});

test('car wash: rain later means not ideal, and says when', () => {
  const chance = new Array(24).fill(0);
  const mm = new Array(24).fill(0);
  for (let h = 15; h <= 18; h++) {
    chance[h] = 70;
    mm[h] = 0.6;
  }
  const advice = bundle(buildDay({ chance, mm })).decisions.carWash;
  assert.equal(advice.verdict, 'bad');
  assert.match(advice.headline, /Not ideal/);
  assert.match(advice.detail, /15:00/);
});

test('car wash: strong wind is flagged but does not veto a dry day', () => {
  const advice = bundle(buildDay({ chance: 0, mm: 0, wind: 42 })).decisions.carWash;
  assert.equal(advice.verdict, 'good');
  assert.match(advice.detail, /windy/i);
});

test('car wash: continuous rain all day', () => {
  const advice = bundle(buildDay({ chance: 95, mm: 4 })).decisions.carWash;
  assert.notEqual(advice.verdict, 'good');
});

// ==========================================================================
// 4. Cycling
// ==========================================================================
test('cycling: dry mild light winds is a yes', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(17), wind: 9, chance: 5 })).decisions.cycling;
  assert.equal(advice.verdict, 'good');
  assert.equal(advice.headline, 'Good for cycling');
});

test('cycling: gale-force wind is a no', () => {
  const wind = new Array(24).fill(9);
  for (let h = 13; h <= 17; h++) wind[h] = 52;
  const advice = bundle(buildDay({ wind })).decisions.cycling;
  assert.equal(advice.verdict, 'wind');
  assert.match(advice.headline, /Not ideal/);
  assert.match(advice.detail, /km\/h/);
  assert.match(advice.detail, /13:00/);
});

test('cycling: rain probability rules it out', () => {
  const chance = new Array(24).fill(5);
  for (let h = 8; h <= 12; h++) chance[h] = 65;
  const advice = bundle(buildDay({ chance, mm: new Array(24).fill(0.3) })).decisions.cycling;
  assert.equal(advice.verdict, 'rain');
});

test('cycling: extreme cold is a caution, not a green light', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(-8), wind: 5, chance: 0 })).decisions.cycling;
  assert.equal(advice.verdict, 'cold');
});

// ==========================================================================
// 5. Swimming (outdoor)
// ==========================================================================
test('swimming: warm dry light wind is good outdoor swimming weather', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(26), chance: 5, wind: 8 })).decisions.swimming;
  assert.equal(advice.verdict, 'good');
  assert.match(advice.headline, /outdoor swimming/i);
});

test('swimming: cool air is not ideal', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(14), chance: 0 })).decisions.swimming;
  assert.equal(advice.verdict, 'cold');
  assert.match(advice.headline, /Not ideal/);
});

test('swimming: rain overrides warmth', () => {
  const chance = new Array(24).fill(0);
  for (let h = 10; h <= 14; h++) chance[h] = 55;
  const advice = bundle(buildDay({ temps: new Array(24).fill(28), chance })).decisions.swimming;
  assert.equal(advice.verdict, 'rain');
});

test('swimming: never claims anything about water temperature', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(27), chance: 0 })).decisions.swimming;
  const text = `${advice.headline} ${advice.detail}`.toLowerCase();
  assert.ok(!/water (is|temp)/.test(text));
});

// ==========================================================================
// 6. Clothing
// ==========================================================================
test('clothing: t-shirt weather when warm and dry', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(24), apparent: new Array(24).fill(24), chance: 0, wind: 6 })).decisions.clothing;
  assert.equal(advice.verdict, 't-shirt');
  assert.equal(advice.headline, 'T-shirt weather');
});

test('clothing: light jacket in mild conditions', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(16), apparent: new Array(24).fill(15), chance: 0 })).decisions.clothing;
  assert.equal(advice.verdict, 'jacket');
  assert.match(advice.headline, /Light jacket/);
});

test('clothing: cold plus rain means warm jacket and umbrella', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(11), apparent: new Array(24).fill(9), chance: 70, mm: 1 })).decisions.clothing;
  assert.equal(advice.verdict, 'cold-rain');
  assert.match(advice.headline, /Warm jacket \+ umbrella/);
});

test('clothing: negative temperatures are handled', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(-6), apparent: new Array(24).fill(-9), chance: 0 })).decisions.clothing;
  assert.equal(advice.verdict, 'freezing');
  assert.match(advice.detail, /-9°C/);
});

test('clothing: very hot temperatures are handled', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(36), apparent: new Array(24).fill(38), chance: 0 }), { uvMax: 9 }).decisions.clothing;
  assert.equal(advice.verdict, 'hot');
  assert.match(advice.headline, /Light clothing/);
  assert.match(advice.detail, /Sun protection/);
});

test('clothing: a big daily swing mentions time of day', () => {
  const temps = new Array(24).fill(6);
  for (let h = 12; h <= 19; h++) temps[h] = 21;
  const advice = bundle(buildDay({ temps, apparent: temps, chance: 0 })).decisions.clothing;
  assert.match(advice.detail, /Coolest near/);
  assert.match(advice.detail, /warmest near/);
});

// ==========================================================================
// 7. Time-window answer
// ==========================================================================
test('rain window: dry morning', () => {
  const advice = bundle(buildDay({ chance: 5 }), { rainWindowKey: 'morning' }).rainWindow;
  assert.equal(advice.verdict, 'dry');
  assert.match(advice.headline, /looks dry/);
  assert.match(advice.detail, /06:00-09:00/);
});

test('rain window: wet afternoon reports the peak hour', () => {
  const chance = new Array(24).fill(5);
  chance[16] = 72;
  const advice = bundle(buildDay({ chance, mm: new Array(24).fill(0.4) }), { rainWindowKey: 'afternoon' }).rainWindow;
  assert.equal(advice.verdict, 'likely');
  assert.match(advice.headline, /afternoon/);
  assert.match(advice.detail, /72%/);
  assert.match(advice.detail, /16:00/);
});

test('rain window: a window with no remaining hours degrades gracefully', () => {
  // 00:00 now with three forecast hours: the 15:00-18:00 window has no data.
  const advice = bundle(
    buildHourly({ now: '00:00', date: 2, temps: [10, 11, 12] }),
    { rainWindowKey: 'afternoon' }
  ).rainWindow;
  assert.equal(advice.verdict, 'unavailable');
});

test('rain window: unknown key falls back to the first window', () => {
  const advice = bundle(buildDay(), { rainWindowKey: 'nonsense' }).rainWindow;
  assert.equal(advice.window, Advice.RAIN_WINDOWS[0].key);
});

// ==========================================================================
// 8. Daily summary
// ==========================================================================
test('summary: pleasant dry day', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(18), chance: 0, wind: 8 })).summary;
  assert.equal(advice.verdict, 'nice');
  assert.match(advice.headline, /Great day to be outside/);
});

test('summary: wet later today becomes a wet-afternoon headline', () => {
  const chance = new Array(24).fill(0);
  const mm = new Array(24).fill(0);
  for (let h = 14; h <= 17; h++) {
    chance[h] = 65;
    mm[h] = 0.5;
  }
  const advice = bundle(buildDay({ chance, mm })).summary;
  assert.equal(advice.verdict, 'wet-later');
  assert.match(advice.headline, /Wet afternoon ahead/);
  assert.match(advice.detail, /before 14:00/);
});

test('summary: continuous rain says take an umbrella', () => {
  const advice = bundle(buildDay({ chance: 95, mm: 4 })).summary;
  assert.equal(advice.verdict, 'definitely');
  assert.match(advice.headline, /umbrella/i);
});

test('summary: freezing day', () => {
  const advice = bundle(buildDay({ temps: new Array(24).fill(-3), apparent: new Array(24).fill(-5), chance: 0 })).summary;
  assert.equal(advice.verdict, 'cold');
  assert.match(advice.headline, /Cold today/);
});

test('summary: snow is reported as snow', () => {
  const code = new Array(24).fill(1);
  for (let h = 8; h <= 12; h++) code[h] = 73;
  const advice = bundle(buildDay({ code, temps: new Array(24).fill(-1), chance: 90, mm: 1 })).summary;
  assert.match(advice.headline, /Snowy today/);
});

// ==========================================================================
// 9. Units
// ==========================================================================
test('units: celsius mode renders Celsius and km/h', () => {
  const c = bundle(buildDay({ temps: new Array(24).fill(18), chance: 0 })).decisions.walk;
  assert.match(c.detail, /°C/);
  assert.ok(!/°F/.test(c.detail));
});

test('units: fahrenheit mode renders Fahrenheit and mph', () => {
  const f = bundle(
    buildDay({ temps: new Array(24).fill(18), chance: 0, wind: 20 }),
    {},
    FAHRENHEIT_FORMAT
  ).decisions.walk;
  assert.match(f.detail, /°F/);
  assert.ok(!/°C/.test(f.detail));
  assert.match(f.detail, /mph/);
});

test('units: the same forecast produces different text in each mode', () => {
  const hourly = buildDay({ temps: new Array(24).fill(16), chance: 0 });
  const c = bundle(hourly, {}, CELSIUS_FORMAT).decisions.clothing.detail;
  const f = bundle(hourly, {}, FAHRENHEIT_FORMAT).decisions.clothing.detail;
  assert.notEqual(c, f);
  assert.match(c, /16/);
  assert.match(f, /6[01]/); // 16 °C === 61 °F
});

test('units: wind numbers convert with the temperature toggle', () => {
  const hourly = buildDay({ chance: 0, wind: new Array(24).fill(40) });
  const c = bundle(hourly, {}, CELSIUS_FORMAT).decisions.clothing.detail;
  const f = bundle(hourly, {}, FAHRENHEIT_FORMAT).decisions.clothing.detail;
  assert.match(c, /40\.0 km\/h/);
  assert.match(f, /24\.9 mph/);
});

// ==========================================================================
// 10. Missing / ambiguous data
// ==========================================================================
test('missing hourly data: every tile degrades instead of throwing', () => {
  const advice = bundle({});
  assert.equal(advice.ok, false);
  Advice.ADVICE_ORDER.forEach((key) => {
    const item = advice.decisions[key];
    assert.equal(item.ok, false, `${key} should be graceful`);
    assert.equal(item.headline, 'Not enough forecast data');
  });
  assert.equal(advice.summary.ok, false);
  assert.equal(advice.rainWindow.ok, false);
});

test('missing hourly data: null / undefined / empty are all handled', () => {
  [null, undefined, { time: [] }, { time: 'nope' }].forEach((hourly) => {
    const advice = bundle(hourly);
    assert.equal(advice.ok, false);
    assert.equal(advice.decisions.umbrella.headline, 'Not enough forecast data');
  });
});

test('missing hourly data: temperatures present but precipitation absent', () => {
  const hourly = buildDay();
  delete hourly.precipitation_probability;
  delete hourly.precipitation;
  const advice = bundle(hourly);
  assert.equal(advice.decisions.umbrella.ok, false);
  assert.equal(advice.decisions.carWash.ok, false);
  assert.equal(advice.decisions.cycling.ok, true); // does not need rain data
  assert.equal(advice.decisions.walk.ok, true);
});

test('missing hourly data: only two usable hours is not enough', () => {
  const hourly = buildHourly({ now: '22:00', date: 2, temps: [12, 11] });
  const advice = bundle(hourly);
  assert.equal(advice.ok, false);
});

test('missing hourly data: partial arrays do not throw', () => {
  const hourly = buildDay();
  hourly.wind_speed_10m = hourly.wind_speed_10m.slice(0, 5);
  hourly.cloud_cover = undefined;
  const advice = bundle(hourly);
  assert.equal(advice.ok, true);
  Advice.ADVICE_ORDER.forEach((key) => assert.equal(typeof advice.decisions[key].headline, 'string'));
});

test('a throwing getter cannot break the other recommendations', () => {
  // A hostile payload: every array is a getter that explodes.
  const explode = () => { throw new Error('boom'); };
  const hostile = { time: buildDay().time };
  ['temperature_2m', 'apparent_temperature', 'precipitation', 'precipitation_probability',
    'wind_speed_10m', 'cloud_cover', 'weather_code', 'is_day'].forEach((key) => {
    Object.defineProperty(hostile, key, { get: explode });
  });

  // The engine is expected to warn; capture it so the suite output stays clean
  // and so we can assert the warning actually happened.
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  let advice;
  try {
    advice = bundle(hostile);
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warnings.length > 0, 'the engine should report the failure it recovered from');
  assert.equal(advice.ok, false);
  Advice.ADVICE_ORDER.forEach((key) => {
    assert.equal(typeof advice.decisions[key].headline, 'string', `${key} should still render`);
    assert.equal(advice.decisions[key].headline, 'Not enough forecast data');
  });
  assert.equal(typeof advice.summary.headline, 'string');
  assert.equal(typeof advice.rainWindow.headline, 'string');
});

test('null entries inside the hourly arrays are treated as missing, not as zero', () => {
  const hourly = buildDay();
  hourly.precipitation_probability = hourly.precipitation_probability.map(() => null);
  hourly.precipitation = hourly.precipitation.map(() => null);
  const advice = bundle(hourly);
  assert.equal(advice.decisions.umbrella.ok, false);
});

test('an unknown window key never throws', () => {
  Advice.ADVICE_ORDER.forEach(() => {});
  const advice = Advice.getRainWindowAdvice(Advice.analyze(context(buildDay())), 'nope');
  assert.equal(typeof advice.headline, 'string');
});

// ==========================================================================
// 11. Late-night / scope handling
// ==========================================================================
test('late at night the engine analyses the next 24 hours instead of a fragment', () => {
  const temps = new Array(24).fill(18);
  const chance = new Array(24).fill(70);
  const hourly = buildHourly({ now: '23:00', date: 2, temps, chance, isDay: new Array(24).fill(1) });
  const advice = Advice.getAdviceBundle({
    hourly,
    currentTime: '2026-10-02T23:00',
    format: CELSIUS_FORMAT,
  });
  assert.equal(advice.scope, 'next24');
  assert.equal(advice.ok, true);
  assert.equal(advice.decisions.umbrella.verdict, 'definitely');
});

// ==========================================================================
// 12. Determinism
// ==========================================================================
test('the same forecast always produces the same advice', () => {
  const hourly = buildDay({ chance: 40, mm: 0.3, wind: 14 });
  const first = bundle(hourly);
  const second = bundle(hourly);
  assert.deepEqual(
    JSON.parse(JSON.stringify(first)),
    JSON.parse(JSON.stringify(second))
  );
});

test('getRecommendations reuses an analysed profile without changing the result', () => {
  // This is the path the dashboard uses: one analyse() call, then the tiles and
  // the window answer are rebuilt from that profile when the window changes.
  const hourly = buildDay({ chance: 55, mm: 0.4, wind: 16 });
  const ctx = context(hourly, { format: CELSIUS_FORMAT });
  const profile = Advice.analyze(ctx);

  const morning = Advice.getRecommendations(profile, 'morning');
  const evening = Advice.getRecommendations(profile, 'evening');

  Advice.ADVICE_ORDER.forEach((key) => {
    assert.deepEqual(
      JSON.parse(JSON.stringify(morning.decisions[key])),
      JSON.parse(JSON.stringify(evening.decisions[key]))
    );
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(morning.summary)),
    JSON.parse(JSON.stringify(evening.summary))
  );

  // Only the window answer differs, and it must answer the window asked for.
  assert.equal(morning.rainWindow.window, 'morning');
  assert.equal(evening.rainWindow.window, 'evening');

  // ...and it matches what the one-shot bundle would have produced.
  const viaBundle = Advice.getAdviceBundle(Object.assign({}, ctx, { rainWindowKey: 'evening' }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(evening)),
    JSON.parse(JSON.stringify({
      decisions: viaBundle.decisions,
      summary: viaBundle.summary,
      rainWindow: viaBundle.rainWindow,
      order: viaBundle.order,
    }))
  );
});

test('getRecommendations degrades cleanly for an unusable profile', () => {
  const built = Advice.getRecommendations(null, 'morning');
  Advice.ADVICE_ORDER.forEach((key) => {
    assert.equal(built.decisions[key].ok, false);
    assert.equal(typeof built.decisions[key].headline, 'string');
  });
  assert.equal(typeof built.summary.headline, 'string');
  assert.equal(typeof built.rainWindow.headline, 'string');
});

test('thresholds are exposed for tuning in one place', () => {
  const rain = Advice.THRESHOLDS.rain;
  assert.strictEqual(rain.umbrellaCertainChance, 70);
  assert.strictEqual(rain.umbrellaChance, 30);
  assert.strictEqual(rain.dryChance, 20);
  assert.ok(rain.umbrellaCertainChance > rain.umbrellaChance);
  assert.ok(rain.umbrellaChance > rain.dryChance);
  assert.equal(Advice.RAIN_WINDOWS.length, 4);
  Advice.RAIN_WINDOWS.forEach((w) => {
    assert.ok(w.start < w.end);
    assert.ok(typeof w.phrase === 'string' && w.phrase.length > 0);
  });
});
