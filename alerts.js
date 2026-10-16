/**
 * WeatherScope Weather Alerts - rule engine
 * =========================================================================
 * Turns the hourly Open-Meteo forecast into answers to a visitor's own
 * questions: "will it rain in the next two hours?", "does it freeze tonight?",
 * "is a thunderstorm coming in the next six hours?". A rule is a small,
 * declarative object - a city, a parameter, a comparator, a threshold and a
 * window - and this module is the one place that decides whether that rule
 * fires, using *exactly* the payload the dashboard already fetched.
 *
 * Design rules (mirroring `advice.js` / `glance.js`):
 *
 *  * **Pure and deterministic.** No DOM, no network, no clock, no randomness.
 *    `now` and the city's UTC offset are injected, so the same rule against the
 *    same forecast always yields the same verdict and the whole engine is
 *    testable in plain Node (see `tests/alerts.test.js`).
 *  * **Canonical units only.** Thresholds are stored in the Open-Meteo units -
 *    Celsius, millimetres, centimetres, km/h - exactly like `advice.js`. The UI
 *    converts the visitor's °C/°F and km/h/mph input on the way in and out; the
 *    engine never sees a display unit.
 *  * **Never guesses.** A metric with no readings in the window is `notEnoughData`
 *    rather than a false alarm, and anything off storage or the wire can only
 *    ever fail closed.
 *
 * Loading contract: plain classic script (no build step). It publishes
 * `window.WeatherScopeAlerts`, and also supports `module.exports` for the
 * server and the tests.
 */

(function (root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root) root.WeatherScopeAlerts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ==========================================================================
  // Limits & patterns - the single place these are defined
  // ==========================================================================
  const MAX_ALERTS = 50;
  const MAX_NAME_LENGTH = 120;
  const MAX_ID_LENGTH = 96;

  /** `"48.8566,2.3522"` - the same coordinate identity the favorites engine uses. */
  const CITY_KEY_PATTERN = /^-?\d{1,3}(?:\.\d{1,4})?,-?\d{1,3}(?:\.\d{1,4})?$/;

  /** A stored id: opaque, but bounded and safe to put in an attribute. */
  const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,96}$/;

  // ==========================================================================
  // Parameters
  // --------------------------------------------------------------------------
  // `field` is the Open-Meteo hourly array, `unit` is the canonical unit the
  // threshold is stored in, and `[min,max]` clips a hand-edited request so no
  // rule can ask a question the data cannot answer. `kind` is `number` for
  // everything measurable and `code` for the WMO weather code, which is a
  // category rather than a magnitude.
  // ==========================================================================
  const METRICS = {
    rainChance: {
      id: 'rainChance', field: 'precipitation_probability', unit: '%', group: 'rain',
      kind: 'number', defaultComparator: 'above', defaultThreshold: 60, min: 0, max: 100, step: 5,
    },
    rainAmount: {
      id: 'rainAmount', field: 'precipitation', unit: 'mm', group: 'rain',
      kind: 'number', defaultComparator: 'above', defaultThreshold: 1, min: 0, max: 200, step: 0.5,
    },
    snow: {
      id: 'snow', field: 'snowfall', unit: 'cm', group: 'snow',
      kind: 'number', defaultComparator: 'above', defaultThreshold: 1, min: 0, max: 100, step: 0.5,
    },
    temperature: {
      id: 'temperature', field: 'temperature_2m', unit: '°C', group: 'temperature',
      kind: 'number', defaultComparator: 'below', defaultThreshold: 0, min: -90, max: 60, step: 1,
    },
    apparent: {
      id: 'apparent', field: 'apparent_temperature', unit: '°C', group: 'temperature',
      kind: 'number', defaultComparator: 'above', defaultThreshold: 30, min: -90, max: 70, step: 1,
    },
    wind: {
      id: 'wind', field: 'wind_speed_10m', unit: 'km/h', group: 'wind',
      kind: 'number', defaultComparator: 'above', defaultThreshold: 40, min: 0, max: 400, step: 5,
    },
    gust: {
      id: 'gust', field: 'wind_gusts_10m', unit: 'km/h', group: 'wind',
      kind: 'number', defaultComparator: 'above', defaultThreshold: 60, min: 0, max: 500, step: 5,
    },
    storm: {
      id: 'storm', field: 'weather_code', unit: '', group: 'storm',
      kind: 'code', defaultComparator: 'present', defaultThreshold: 0, codes: [95, 96, 99],
    },
    uv: {
      id: 'uv', field: 'uv_index', unit: '', group: 'uv',
      kind: 'number', defaultComparator: 'above', defaultThreshold: 6, min: 0, max: 20, step: 1,
    },
  };

  const METRIC_IDS = Object.keys(METRICS);

  // ==========================================================================
  // Look-ahead windows
  // --------------------------------------------------------------------------
  // Every window resolves to a half-open index range `[start, end)` into the
  // hourly `time` array. The hour windows are simply "the next N hours"; the
  // day windows are found by the calendar date of the city's *local* clock, so
  // "today" means today where the city is, not where the visitor is.
  // ==========================================================================
  const WINDOWS = {
    h1: { id: 'h1', kind: 'hours', hours: 1 },
    h2: { id: 'h2', kind: 'hours', hours: 2 },
    h3: { id: 'h3', kind: 'hours', hours: 3 },
    h6: { id: 'h6', kind: 'hours', hours: 6 },
    h12: { id: 'h12', kind: 'hours', hours: 12 },
    h24: { id: 'h24', kind: 'hours', hours: 24 },
    today: { id: 'today', kind: 'today' },
    tomorrow: { id: 'tomorrow', kind: 'tomorrow' },
    d3: { id: 'd3', kind: 'hours', hours: 72 },
    d7: { id: 'd7', kind: 'hours', hours: 168 },
  };

  const WINDOW_IDS = Object.keys(WINDOWS);

  const COMPARATORS = ['above', 'below', 'present'];

  // ==========================================================================
  // Small helpers
  // ==========================================================================
  function asString(value) {
    return typeof value === 'string' ? value : '';
  }

  /** Trimmed text with no control characters - or '' when it cannot be a name. */
  function cleanText(value, maxLength) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (maxLength && trimmed.length > maxLength) return '';
    return /[\u0000-\u001f\u007f]/.test(trimmed) ? '' : trimmed;
  }

  function pick(object, primary, alternate) {
    if (!object) return undefined;
    return object[primary] !== undefined ? object[primary] : object[alternate];
  }

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  function pad2(value) {
    return value < 10 ? '0' + value : String(value);
  }

  /** `"2026-10-16T13:00"` for a real instant shifted into the city's clock. */
  function hourString(localMs) {
    const d = new Date(localMs);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate())
      + 'T' + pad2(d.getUTCHours()) + ':00';
  }

  /** `"2026-10-16"` for a real instant shifted into the city's clock. */
  function dateString(localMs) {
    const d = new Date(localMs);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  const DAY_MS = 24 * 60 * 60 * 1000;

  // ==========================================================================
  // Rules
  // ==========================================================================

  /**
   * One rule, reduced to what the engine can trust, or null when it could not be
   * a rule. The id is kept when it is already a safe token and otherwise derived
   * from the rule's own fields, so re-sanitising the same rule is stable.
   */
  function sanitizeAlert(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const metricId = asString(raw.metric);
    const metric = METRICS[metricId];
    if (!metric) return null;

    const windowId = asString(raw.window);
    if (!WINDOWS[windowId]) return null;

    const cityKey = asString(raw.cityKey).trim();
    if (!CITY_KEY_PATTERN.test(cityKey)) return null;

    const cityName = cleanText(pick(raw, 'cityName', 'name'), MAX_NAME_LENGTH);
    if (!cityName) return null;

    const isCode = metric.kind === 'code';
    let comparator = asString(raw.comparator) || metric.defaultComparator;
    if (isCode) comparator = 'present';
    else if (comparator !== 'above' && comparator !== 'below') comparator = metric.defaultComparator;

    let threshold = 0;
    if (!isCode) {
      threshold = Number(raw.threshold);
      if (!Number.isFinite(threshold)) threshold = metric.defaultThreshold;
      threshold = round2(clamp(threshold, metric.min, metric.max));
    }

    const enabled = raw.enabled === undefined ? true : !!raw.enabled;
    const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : 0;

    const givenId = asString(raw.id).trim();
    const id = givenId && givenId.length <= MAX_ID_LENGTH && ID_PATTERN.test(givenId)
      ? givenId
      : cityKey + '|' + metricId + '|' + windowId + '|' + comparator + '|' + threshold;

    return {
      id: id,
      cityKey: cityKey,
      cityName: cityName,
      metric: metricId,
      comparator: comparator,
      threshold: threshold,
      window: windowId,
      enabled: enabled,
      createdAt: createdAt,
    };
  }

  /** The list as it is allowed to exist: each entry a real rule, no duplicates, capped. */
  function sanitizeAlerts(raw) {
    if (!Array.isArray(raw)) return [];

    const seen = {};
    const out = [];

    for (let i = 0; i < raw.length; i += 1) {
      if (out.length >= MAX_ALERTS) break;
      const rule = sanitizeAlert(raw[i]);
      if (!rule) continue;
      if (seen[rule.id]) continue;
      seen[rule.id] = true;
      out.push(rule);
    }

    return out;
  }

  // ==========================================================================
  // Evaluation
  // ==========================================================================

  /**
   * The index range a window covers, or null when the forecast cannot describe
   * it. `times` are the city-local ISO hour strings Open-Meteo returns.
   */
  function windowRange(windowId, times, nowMs, utcOffsetSeconds) {
    const def = WINDOWS[windowId];
    if (!def || !Array.isArray(times) || !times.length) return null;

    const localNow = nowMs + utcOffsetSeconds * 1000;
    const target = hourString(localNow);

    // The first hour at or after the city's current hour. Hours already past
    // (a stale cache) simply start the window at the forecast's first entry.
    let start = times.length;
    for (let i = 0; i < times.length; i += 1) {
      if (times[i] >= target) { start = i; break; }
    }

    if (def.kind === 'hours') {
      return { start: start, end: Math.min(times.length, start + def.hours) };
    }

    if (def.kind === 'today') {
      const today = dateString(localNow);
      let end = start;
      while (end < times.length && times[end].slice(0, 10) === today) end += 1;
      return { start: start, end: end };
    }

    if (def.kind === 'tomorrow') {
      const tomorrow = dateString(localNow + DAY_MS);
      let s = start;
      while (s < times.length && times[s].slice(0, 10) < tomorrow) s += 1;
      let e = s;
      while (e < times.length && times[e].slice(0, 10) === tomorrow) e += 1;
      return { start: s, end: e };
    }

    return null;
  }

  /**
   * Whether one rule fires against one forecast.
   *
   * @param {object} rule      a sanitized rule
   * @param {object} forecast  an Open-Meteo payload (needs `hourly` and, ideally,
   *                           `utc_offset_seconds`)
   * @param {object} [options] `{ nowMs, utcOffsetSeconds }` - injected for tests
   * @returns {object} `{ triggered, reason, ... }` - never throws
   */
  function evaluate(rule, forecast, options) {
    const opts = options || {};
    const metric = METRICS[rule && rule.metric];
    if (!metric) return { triggered: false, reason: 'unknown-metric', rule: rule || null };

    const hourly = forecast && forecast.hourly;
    if (!hourly || !Array.isArray(hourly.time) || !hourly.time.length) {
      return { triggered: false, reason: 'no-data', rule: rule, metric: metric.id };
    }

    const offset = Number.isFinite(forecast.utc_offset_seconds)
      ? forecast.utc_offset_seconds
      : (Number.isFinite(opts.utcOffsetSeconds) ? opts.utcOffsetSeconds : 0);
    const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();

    const range = windowRange(rule.window, hourly.time, nowMs, offset);
    if (!range || range.start >= range.end) {
      return { triggered: false, reason: 'no-data', rule: rule, metric: metric.id };
    }

    const { start, end } = range;
    const series = hourly[metric.field];

    if (metric.kind === 'code') {
      const codes = Array.isArray(series) ? series : [];
      for (let i = start; i < end; i += 1) {
        const code = Number(codes[i]);
        if (metric.codes.indexOf(code) !== -1) {
          return {
            triggered: true, reason: 'ok', rule: rule, metric: metric.id, kind: 'code',
            code: code, value: code, valueTime: hourly.time[i], hours: end - start,
          };
        }
      }
      return { triggered: false, reason: 'no-code', rule: rule, metric: metric.id, kind: 'code', hours: end - start };
    }

    const values = [];
    if (Array.isArray(series)) {
      for (let i = start; i < end; i += 1) {
        const value = Number(series[i]);
        if (Number.isFinite(value)) values.push({ v: value, i: i });
      }
    }
    if (!values.length) {
      return { triggered: false, reason: 'no-data', rule: rule, metric: metric.id, hours: end - start };
    }

    let peak = values[0];
    let trough = values[0];
    for (let k = 1; k < values.length; k += 1) {
      if (values[k].v > peak.v) peak = values[k];
      if (values[k].v < trough.v) trough = values[k];
    }

    const below = rule.comparator === 'below';
    const decisive = below ? trough : peak;
    const triggered = below ? trough.v <= rule.threshold : peak.v >= rule.threshold;

    return {
      triggered: triggered,
      reason: triggered ? 'ok' : 'below-threshold',
      rule: rule,
      metric: metric.id,
      kind: 'number',
      value: decisive.v,
      peak: peak.v,
      trough: trough.v,
      peakTime: hourly.time[peak.i],
      valueTime: hourly.time[decisive.i],
      unit: metric.unit,
      hours: values.length,
    };
  }

  /** Every rule's verdict against one forecast, in the order given. */
  function evaluateAll(rules, forecast, options) {
    const list = Array.isArray(rules) ? rules : [];
    return list.map(function (rule) {
      return { rule: rule, result: evaluate(rule, forecast, options) };
    });
  }

  /** The rule's fields as a stable key, for de-duplicating UI drafts. */
  function ruleSignature(rule) {
    const clean = sanitizeAlert(rule);
    if (!clean) return '';
    return [clean.cityKey, clean.metric, clean.window, clean.comparator, clean.threshold].join('|');
  }

  return {
    MAX_ALERTS: MAX_ALERTS,
    MAX_NAME_LENGTH: MAX_NAME_LENGTH,
    METRICS: METRICS,
    METRIC_IDS: METRIC_IDS,
    WINDOWS: WINDOWS,
    WINDOW_IDS: WINDOW_IDS,
    COMPARATORS: COMPARATORS.slice(),
    CITY_KEY_PATTERN: CITY_KEY_PATTERN,
    sanitizeAlert: sanitizeAlert,
    sanitizeAlerts: sanitizeAlerts,
    ruleSignature: ruleSignature,
    windowRange: windowRange,
    evaluate: evaluate,
    evaluateAll: evaluateAll,
  };
});
