/**
 * WeatherScope Compare Locations - Comparison Engine
 * =========================================================================
 * Answers one question - *"What's the weather like in these places, and how
 * different are they?"* - from the Open-Meteo payloads the app already
 * fetches.
 *
 * Design rules this module deliberately follows (mirroring `advice.js`):
 *
 *  * **Pure and deterministic.** No DOM, no network, no clock, no randomness,
 *    no storage. The same locations always yield the same rows and the same
 *    insight sentences, so the logic is testable in plain Node
 *    (see `tests/compare.test.js`) and cannot drift from the UI.
 *  * **No unit logic and no weather-code mapping of its own.** Every value is
 *    rendered through caller-injected formatters (app.js passes `formatTemp`,
 *    `formatWindSpeed`, `formatPrecip`, ...) and its existing WMO lookup, so the
 *    comparison follows the active degC / degF toggle and the single WMO_MAP
 *    exactly like the rest of WeatherScope. Every raw number handled here stays in
 *    the Open-Meteo source units: Celsius, km/h, mm, percent.
 *  * **Never guesses.** A location whose readings are missing or whose request
 *    failed becomes an explicit "unavailable" column rather than a silent zero,
 *    and every getter degrades instead of throwing.
 *  * **One thresholds object.** Every cut-off that decides whether a difference
 *    is worth telling the user about lives in `THRESHOLDS`.
 *
 * Loading contract: plain classic script (no build step). It publishes
 * `window.WeatherScopeCompare`, and also supports `module.exports` for the tests.
 */

(function (root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root) root.WeatherScopeCompare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ==========================================================================
  // Thresholds & limits - the single place to tune the whole feature
  // --------------------------------------------------------------------------
  // Values are in the Open-Meteo source units (Celsius, km/h, mm, percent); the
  // visible text is produced by the injected formatters.
  // ==========================================================================
  const THRESHOLDS = {
    /** A comparison needs at least two locations to mean anything. */
    minLocations: 2,
    /** Hard cap on columns: past four the table stops fitting any screen. */
    maxLocations: 4,

    /**
     * Smallest gap that makes a difference worth a sentence. Below these the
     * locations are simply "about the same" and stay unmentioned.
     */
    notable: {
      temperature: 2,
      apparent: 2,
      wind: 5,
      uv: 2,
      rainChance: 15,
      humidity: 20,
      cloudCover: 30,
      precipitation: 0.5,
      high: 3,
      low: 3,
    },

    /**
     * Statement budget. "At a glance" is a summary, not a second dashboard, so
     * the engine never emits more than this many sentences no matter how many
     * metrics diverge.
     */
    maxInsights: 5,

    /**
     * Two geocoding results closer than this (in degrees, roughly 5 km of
     * latitude) describe the same place.
     */
    samePlaceDeg: 0.05,
  };

  // ==========================================================================
  // Small helpers
  // ==========================================================================
  function isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  const UNKNOWN = '--';

  /** Case-, accent- and punctuation-insensitive form, for identity checks. */
  function normalizeText(value) {
    return String(value === null || value === undefined ? '' : value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /** Stable identity for a selected place: bundled id, else name + country. */
  function cityKey(city) {
    if (!city) return '';
    if (city.id) return `id:${String(city.id).toLowerCase()}`;
    return `nc:${normalizeText(city.name)}|${normalizeText(city.country)}`;
  }

  /**
   * Do these two selections describe the same place?
   *
   * Bundled `WORLD_CITIES` entries carry a stable `id`, so those compare by id.
   * Anything else compares by name + country, and finally by proximity, because
   * geocoding happily returns the same town as "Paris, France" and "Paris, FR".
   */
  function isSameCity(a, b) {
    if (!a || !b) return false;

    const keyA = cityKey(a);
    const keyB = cityKey(b);
    if (keyA && keyA === keyB) return true;

    if (normalizeText(a.name) === normalizeText(b.name)) {
      // A missing country (e.g. the GPS fallback) must not block a match.
      if (!a.country || !b.country || normalizeText(a.country) === normalizeText(b.country)) {
        return true;
      }
    }

    if (isNumber(a.latitude) && isNumber(b.latitude) && isNumber(a.longitude) && isNumber(b.longitude)) {
      return (
        Math.abs(a.latitude - b.latitude) <= THRESHOLDS.samePlaceDeg &&
        Math.abs(a.longitude - b.longitude) <= THRESHOLDS.samePlaceDeg
      );
    }

    return false;
  }

  /** "Athens, Greece" - the label used in insights, never hard-coded elsewhere. */
  function cityLabel(city) {
    if (!city) return 'Unknown location';
    const name = city.name || 'Unknown location';
    return city.country ? `${name}, ${city.country}` : String(name);
  }

  // ==========================================================================
  // Location selection / state management
  // --------------------------------------------------------------------------
  // Every mutation returns a fresh array, so the caller can hand the result
  // straight into state and re-render; nothing here touches the DOM.
  // ==========================================================================

  /**
   * Append a location.
   *
   * @returns {{locations: object[], added: boolean, reason: string|null}}
   *   `reason` is 'duplicate', 'full' or 'invalid' when nothing was added - the
   *   caller turns that into a friendly, announced message.
   */
  function addLocation(locations, city) {
    const list = Array.isArray(locations) ? locations.slice() : [];

    if (!city || !isNumber(city.latitude) || !isNumber(city.longitude)) {
      return { locations: list, added: false, reason: 'invalid' };
    }
    if (list.some((slot) => isSameCity(slot.city, city))) {
      return { locations: list, added: false, reason: 'duplicate' };
    }
    if (list.length >= THRESHOLDS.maxLocations) {
      return { locations: list, added: false, reason: 'full' };
    }

    list.push({ city, weather: null, error: null });
    return { locations: list, added: true, reason: null };
  }

  /** Remove one slot by index; an out-of-range index is a no-op. */
  function removeLocation(locations, index) {
    const list = Array.isArray(locations) ? locations : [];
    if (index < 0 || index >= list.length) return list.slice();
    const next = list.slice();
    next.splice(index, 1);
    return next;
  }

  /** Swap the place inside a slot, keeping its weather only if it still applies. */
  function replaceLocation(locations, index, city) {
    const list = Array.isArray(locations) ? locations : [];
    if (index < 0 || index >= list.length || !city) return list.slice();

    const next = list.slice();
    const current = next[index];

    // Re-selecting the same place should not throw the fetched data away.
    const unchanged = current && isSameCity(current.city, city);
    next[index] = {
      city,
      weather: unchanged ? current.weather : null,
      error: unchanged ? current.error : null,
    };
    return next;
  }

  /** Move a slot by `delta` (-1 up, +1 down). Used by the reorder buttons. */
  function moveLocation(locations, index, delta) {
    const list = Array.isArray(locations) ? locations : [];
    if (index < 0 || index >= list.length) return list.slice();

    const target = index + (delta || 0);
    if (target < 0 || target >= list.length) return list.slice();

    const next = list.slice();
    const moved = next.splice(index, 1)[0];
    next.splice(target, 0, moved);
    return next;
  }

  function clearLocations() {
    return [];
  }

  function canAddMore(locations) {
    return (Array.isArray(locations) ? locations.length : 0) < THRESHOLDS.maxLocations;
  }

  function canCompare(locations) {
    return (Array.isArray(locations) ? locations.length : 0) >= THRESHOLDS.minLocations;
  }

  // ==========================================================================
  // Formatters
  // --------------------------------------------------------------------------
  // The app injects its own so degC / degF (and km/h / mph, mm / in) stay owned
  // by exactly one place. These defaults only exist so the engine can be driven
  // standalone in tests, and degrade to "--" rather than throwing.
  const DEFAULT_FORMAT = {
    temp: (value) => (isNumber(value) ? String(Math.round(value)) : UNKNOWN),
    tempGap: (value) => (isNumber(value) ? `${Math.round(Math.abs(value))}\u00b0` : UNKNOWN),
    wind: (value) => (isNumber(value) ? value.toFixed(1) : UNKNOWN),
    windGap: (value) => (isNumber(value) ? Math.abs(value).toFixed(1) : UNKNOWN),
    precip: (value) => (isNumber(value) ? value.toFixed(1) : UNKNOWN),
    percent: (value) => (isNumber(value) ? `${Math.round(value)}%` : UNKNOWN),
    uv: (value) => (isNumber(value) ? value.toFixed(1) : UNKNOWN),
    conditionLabel: () => UNKNOWN,
  };

  function withDefaults(format) {
    return Object.assign({}, DEFAULT_FORMAT, format || {});
  }

  function translate(format, key, vars, fallback) {
    return format && typeof format.t === 'function'
      ? format.t(key, vars, fallback)
      : fallback;
  }

  // ==========================================================================
  // Metric definitions
  // --------------------------------------------------------------------------
  // One declarative table drives the comparison grid, the "most different"
  // highlighting and the insight sentences, so a metric can never be added in
  // one place and forgotten in another.
  //
  // `read` pulls the raw number out of one location's normalised entry, `text`
  // renders it, and `insight` phrases the comparison. Raw numbers are always in
  // Open-Meteo units; only `text` sees the display unit.
  // ==========================================================================
  const CURRENT_METRICS = [
    {
      key: 'condition',
      label: 'Weather', i18nKey: 'compareEngine.metricCondition',
      icon: '⛅',
      kind: 'text',
      read: (entry) => (entry.current ? entry.current.weather_code : null),
      text: (entry, format) => format.conditionLabel(entry.current.weather_code),
      // A condition is categorical, so there is no numeric gap to threshold.
      insight: null,
    },
    {
      key: 'temperature',
      label: 'Temperature', i18nKey: 'compareEngine.metricTemperature',
      icon: '🌡️',
      kind: 'number',
      unit: 'temp',
      read: (entry) => (entry.current ? entry.current.temperature_2m : null),
      text: (entry, format) => format.temp(entry.current.temperature_2m),
      // "Athens is 10°C warmer than Gütersloh."
      insight: (high, low, diff, format) =>
        translate(format, 'compareEngine.insightTemperature', { city: cityLabel(high.city), gap: format.tempGap(diff), word: translate(format, diff > 0 ? 'compareEngine.gapWarmer' : 'compareEngine.gapCooler', null, diff > 0 ? 'warmer' : 'cooler'), other: cityLabel(low.city) }, `${cityLabel(high.city)} is ${format.tempGap(diff)} ${diff > 0 ? 'warmer' : 'cooler'} than ${cityLabel(low.city)}.`),
    },
    {
      key: 'apparent',
      label: 'Feels like', i18nKey: 'compareEngine.metricApparent',
      icon: '🤗',
      kind: 'number',
      unit: 'temp',
      read: (entry) => (entry.current ? entry.current.apparent_temperature : null),
      text: (entry, format) => format.temp(entry.current.apparent_temperature),
      insight: (high, low, diff, format) =>
        translate(format, 'compareEngine.insightApparent', { gap: format.tempGap(diff), word: translate(format, diff > 0 ? 'compareEngine.gapWarmer' : 'compareEngine.gapCooler', null, diff > 0 ? 'warmer' : 'cooler'), city: cityLabel(high.city), other: cityLabel(low.city) }, `It feels ${format.tempGap(diff)} ${diff > 0 ? 'warmer' : 'cooler'} in ${cityLabel(high.city)} than in ${cityLabel(low.city)}.`),
    },
    {
      key: 'rainChance',
      label: 'Rain chance', i18nKey: 'compareEngine.metricRainChance',
      icon: '☔',
      kind: 'number',
      unit: 'percent',
      read: (entry) => entry.rainChance,
      text: (entry, format) => format.percent(entry.rainChance),
      // Phrased against the *lower* probability - "who stays drier" is a fact,
      // not a judgement.
      insight: (high, low, diff, format) =>
        translate(format, 'compareEngine.insightRain', { city: cityLabel(low.city), low: format.percent(low.value), high: format.percent(high.value) }, `${cityLabel(low.city)} has the lower chance of rain (${format.percent(low.value)} vs ${format.percent(high.value)}).`),
    },
    {
      key: 'wind',
      label: 'Wind', i18nKey: 'compareEngine.metricWind',
      icon: '💨',
      kind: 'number',
      unit: 'wind',
      read: (entry) => (entry.current ? entry.current.wind_speed_10m : null),
      text: (entry, format) => format.wind(entry.current.wind_speed_10m),
      insight: (high, low, diff, format) =>
        translate(format, 'compareEngine.insightWind', { gap: format.windGap(diff), city: cityLabel(high.city), other: cityLabel(low.city) }, `Wind is ${format.windGap(diff)} ${getWindUnitSymbol(format)} stronger in ${cityLabel(high.city)} than in ${cityLabel(low.city)}.`),
    },
    {
      key: 'uv',
      label: 'UV index', i18nKey: 'compareEngine.metricUv',
      icon: '☀️',
      kind: 'number',
      unit: 'uv',
      read: (entry) => (entry.current ? entry.current.uv_index : null),
      text: (entry, format) => format.uv(entry.current.uv_index),
      insight: (high, low) =>
        translate(format, 'compareEngine.insightUv', { gap: (high.value - low.value).toFixed(1), city: cityLabel(high.city), other: cityLabel(low.city) }, `The UV index is higher in ${cityLabel(high.city)} (${high.value.toFixed(1)} vs ${low.value.toFixed(1)}).`),
    },
    {
      key: 'humidity',
      label: 'Humidity', i18nKey: 'compareEngine.metricHumidity',
      icon: '💧',
      kind: 'number',
      unit: 'percent',
      read: (entry) => (entry.current ? entry.current.relative_humidity_2m : null),
      text: (entry, format) => format.percent(entry.current.relative_humidity_2m),
      insight: (high, low) =>
        translate(format, 'compareEngine.insightCloud', { gap: Math.round(Math.abs(high.value - low.value)), city: cityLabel(high.city), other: cityLabel(low.city) }, `Humidity is ${Math.round(Math.abs(high.value - low.value))} percentage points higher in ${cityLabel(high.city)} than in ${cityLabel(low.city)}.`),
    },
    {
      key: 'precipitation',
      label: 'Precipitation', i18nKey: 'compareEngine.metricPrecipitation',
      icon: '🌧️',
      kind: 'number',
      unit: 'precip',
      read: (entry) => (entry.current ? entry.current.precipitation : null),
      text: (entry, format) => format.precip(entry.current.precipitation),
      insight: (high, low, diff, format) =>
        translate(format, 'compareEngine.insightPrecip', { gap: format.precip(high.value - low.value), city: cityLabel(high.city), other: cityLabel(low.city) }, `More precipitation is falling in ${cityLabel(high.city)} right now (${format.precip(high.value)} vs ${format.precip(low.value)}).`),
    },
    {
      key: 'cloudCover',
      label: 'Cloud cover', i18nKey: 'compareEngine.metricCloudCover',
      icon: '☁️',
      kind: 'number',
      unit: 'percent',
      read: (entry) => (entry.current ? entry.current.cloud_cover : null),
      text: (entry, format) => format.percent(entry.current.cloud_cover),
      insight: (high, low) =>
        translate(format, 'compareEngine.insightCloud', { gap: Math.round(high.value - low.value), city: cityLabel(high.city), other: cityLabel(low.city) }, `${cityLabel(high.city)} is cloudier than ${cityLabel(low.city)} right now (${Math.round(high.value)}% vs ${Math.round(low.value)}%).`),
    },
    {
      key: 'sun',
      label: 'Sunrise / sunset', i18nKey: 'compareEngine.metricSun',
      icon: '🌅',
      kind: 'text',
      read: (entry) => entry.sun,
      text: (entry) => entry.sun || UNKNOWN,
      insight: null,
    },
  ];

  const DAILY_METRICS = [
    {
      key: 'high',
      label: 'High', i18nKey: 'share.high',
      icon: '🔺',
      kind: 'number',
      unit: 'temp',
      read: (entry) => entry.high,
      text: (entry, format) => format.temp(entry.high),
      insight: (high, low, diff, format) =>
        `Today's high is ${format.tempGap(diff)} higher in ${cityLabel(high.city)} than in ${cityLabel(low.city)}.`,
    },
    {
      key: 'low',
      label: 'Low', i18nKey: 'share.low',
      icon: '🔻',
      kind: 'number',
      unit: 'temp',
      read: (entry) => entry.low,
      text: (entry, format) => format.temp(entry.low),
      insight: (high, low, diff, format) =>
        `Overnight is ${format.tempGap(diff)} colder in ${cityLabel(low.city)} than in ${cityLabel(high.city)}.`,
    },
    {
      key: 'rainChance',
      label: 'Rain chance', i18nKey: 'compareEngine.metricRainChance',
      icon: '☔',
      kind: 'number',
      unit: 'percent',
      read: (entry) => entry.dailyRainChance,
      text: (entry, format) => format.percent(entry.dailyRainChance),
      insight: (high, low) =>
        `${cityLabel(high.city)} has the higher chance of rain today (${Math.round(high.value)}% vs ${Math.round(low.value)}%).`,
    },
    {
      key: 'uvMax',
      label: 'Max UV', i18nKey: 'compareEngine.metricMaxUv',
      icon: '☀️',
      kind: 'number',
      unit: 'uv',
      read: (entry) => entry.uvMax,
      text: (entry, format) => format.uv(entry.uvMax),
      insight: (high, low) =>
        `Today's peak UV index is higher in ${cityLabel(high.city)} (${high.value.toFixed(1)} vs ${low.value.toFixed(1)}).`,
    },
    {
      key: 'windMax',
      label: 'Max wind', i18nKey: 'compareEngine.metricMaxWind',
      icon: '💨',
      kind: 'number',
      unit: 'wind',
      read: (entry) => entry.windMax,
      text: (entry, format) => format.wind(entry.windMax),
      insight: (high, low, diff, format) =>
        `Today's strongest wind is ${format.windGap(diff)} ${getWindUnitSymbol(format)} faster in ${cityLabel(high.city)} than in ${cityLabel(low.city)}.`,
    },
  ];

  /** "km/h" / "mph", so a sentence never ends in a bare number. */
  function getWindUnitSymbol(format) {
    return format && typeof format.windSymbol === 'string' ? format.windSymbol : '';
  }

  /** Smallest gap for `metric` that is worth mentioning or emphasising. */
  function thresholdFor(metric) {
    const byKey = THRESHOLDS.notable[metric.key];
    if (isNumber(byKey)) return byKey;

    switch (metric.unit) {
      case 'temp':
        return THRESHOLDS.notable.temperature;
      case 'wind':
        return THRESHOLDS.notable.wind;
      case 'uv':
        return THRESHOLDS.notable.uv;
      case 'percent':
        return THRESHOLDS.notable.rainChance;
      case 'precip':
        return THRESHOLDS.notable.precipitation;
      default:
        return 1;
    }
  }

  // ==========================================================================
  // Reading one location's numbers out of an Open-Meteo payload
  // --------------------------------------------------------------------------
  /**
   * Normalise one weather payload into the flat shape the metric table reads.
   * Missing readings stay `null` so they render as "--" and are excluded from
   * every comparison instead of masquerading as zero.
   */
  function toEntry(city, payload) {
    const current = (payload && payload.current) || {};
    const daily = (payload && payload.daily) || {};
    const hourly = (payload && payload.hourly) || {};

    // Rain probability is an hourly product, so "right now" is the value stamped
    // with the current hour - the same lookup the dashboard already uses to
    // place the "Now" card at the head of its 24-hour strip.
    let rainChance = null;
    if (Array.isArray(hourly.time) && Array.isArray(hourly.precipitation_probability)) {
      const prefix = String(current.time || '').slice(0, 13);
      let index = prefix ? hourly.time.findIndex((t) => String(t).startsWith(prefix)) : 0;
      if (index === -1) index = 0;
      rainChance = hourly.precipitation_probability[index];
    }

    const first = (list) => (Array.isArray(list) ? list[0] : undefined);

    let sun = null;
    const sunrise = first(daily.sunrise);
    const sunset = first(daily.sunset);
    if (sunrise || sunset) {
      sun = `${String(sunrise || UNKNOWN).split('T')[1] || UNKNOWN} / ${String(sunset || UNKNOWN).split('T')[1] || UNKNOWN}`;
    }

    // Every reading is coerced to `null` rather than left `undefined`, so "no
    // data" is one shape everywhere and `isNumber` is the only test needed.
    const reading = (value) => (isNumber(value) ? value : null);

    return {
      city,
      current,
      rainChance: reading(rainChance),
      high: reading(first(daily.temperature_2m_max)),
      low: reading(first(daily.temperature_2m_min)),
      dailyRainChance: reading(first(daily.precipitation_probability_max)),
      uvMax: reading(first(daily.uv_index_max)),
      windMax: reading(first(daily.wind_speed_10m_max)),
      sun,
    };
  }

  // ==========================================================================
  // Building the comparison rows
  // ==========================================================================
  /**
   * Turn a location list into the columns + rows the table renders.
   *
   * @param {object[]} locations  [{ city, weather, error }]
   * @param {object}   format     injected formatters (see DEFAULT_FORMAT)
   * @param {object[]} metrics    defaults to CURRENT_METRICS
   * @returns {{columns: object[], rows: object[], okCount: number}}
   */
  function buildTable(locations, format, metrics) {
    const fmt = withDefaults(format);
    const definitions = Array.isArray(metrics) ? metrics : CURRENT_METRICS;
    const list = Array.isArray(locations) ? locations : [];

    const columns = list.map((slot, index) => {
      const city = slot && slot.city;
      const entry = slot && slot.weather ? toEntry(city, slot.weather) : null;

      return {
        index,
        city,
        label: cityLabel(city),
        entry,
        // The status is per-column on purpose: one failed city must not take
        // the whole comparison down with it.
        status: entry ? 'ok' : 'error',
        error: (slot && slot.error) || null,
      };
    });

    const rows = definitions.map((metric) => {
      const cells = columns.map((column) => {
        if (column.status !== 'ok') return { text: UNKNOWN, value: null, available: false, emphasis: null };
        const value = safeRead(metric, column.entry);
        return {
          text: safeText(metric, column.entry, fmt),
          value,
          available: isNumber(value),
          emphasis: null,
        };
      });

      // Mark the extremes by rank only - 'high' / 'low', never "good" or
      // "bad", because neither end of a range is preferable. How a marked
      // value looks is the view layer's decision; the engine only says which
      // end of the row a reading sits on.
      const span = spread(metric, columns);
      if (span.notable) {
        span.high.forEach((index) => {
          cells[index].emphasis = 'high';
        });
        span.low.forEach((index) => {
          cells[index].emphasis = 'low';
        });
      }

      return {
        key: metric.key,
        label: translate(fmt, metric.i18nKey, null, metric.label),
        icon: metric.icon,
        kind: metric.kind,
        unit: metric.unit || null,
        metric,
        cells,
      };
    });

    return {
      columns,
      rows,
      okCount: columns.filter((column) => column.status === 'ok').length,
    };
  }

  /**
   * Column indexes holding the highest / lowest readable value of `metric`,
   * plus whether the gap is big enough to be worth showing.
   */
  function spread(metric, columns) {
    const indexes = [];
    const values = [];

    columns.forEach((column, index) => {
      if (column.status !== 'ok') return;
      const value = safeRead(metric, column.entry);
      if (!isNumber(value)) return;
      indexes.push(index);
      values.push(value);
    });

    if (values.length < THRESHOLDS.minLocations) {
      return { high: [], low: [], max: null, min: null, notable: false };
    }

    const max = Math.max(...values);
    const min = Math.min(...values);

    return {
      high: values.map((value, i) => (value === max ? indexes[i] : -1)).filter((i) => i >= 0),
      low: values.map((value, i) => (value === min ? indexes[i] : -1)).filter((i) => i >= 0),
      max,
      min,
      // A single reading above the threshold is not a comparison.
      notable: max - min >= thresholdFor(metric),
    };
  }

  function safeRead(metric, entry) {
    try {
      const value = metric.read(entry);
      return isNumber(value) ? value : null;
    } catch (err) {
      return null;
    }
  }

  function safeText(metric, entry, format) {
    try {
      return metric.text(entry, format) || UNKNOWN;
    } catch (err) {
      return UNKNOWN;
    }
  }

  // ==========================================================================
  // Insights - "Weather at a glance"
  // ===========================================================================
  /**
   * Which locations hold the highest and lowest readable value of `metric`?
   * A missing reading (or a failed column) is excluded, and a tie yields no
   * extremes at all, so a difference is never invented between equals.
   */
  function extremes(columns, metric) {
    let high = null;
    let low = null;

    columns.forEach((column) => {
      if (column.status !== 'ok') return;
      const value = safeRead(metric, column.entry);
      if (!isNumber(value)) return;
      const point = { city: column.city, label: column.label, value };
      if (!high || value > high.value) high = point;
      if (!low || value < low.value) low = point;
    });

    return { high, low };
  }

  /**
   * Dynamic, neutral statements derived from the actual numbers - never
   * hard-coded city names or values, and never "better" / "worse" unless the
   * metric genuinely implies it (rain probability is the only one phrased that
   * way, and even then as a fact about staying drier).
   *
   * @returns {string[]} at most THRESHOLDS.maxInsights sentences
   */
  function buildInsights(locations, format, metrics) {
    const fmt = withDefaults(format);
    const definitions = Array.isArray(metrics) ? metrics : CURRENT_METRICS;

    const table = buildTable(locations, fmt, definitions);
    if (table.okCount < THRESHOLDS.minLocations) return [];

    const findings = [];

    definitions.forEach((metric, order) => {
      if (typeof metric.insight !== 'function') return;

      const { high, low } = extremes(table.columns, metric);
      if (!high || !low || high.city === low.city) return;

      const gap = high.value - low.value;
      const threshold = thresholdFor(metric);
      // Below the threshold the two locations are simply "about the same".
      if (gap < threshold) return;

      let text;
      try {
        text = metric.insight(high, low, gap, fmt);
      } catch (err) {
        return;
      }
      if (text) {
        // Rank by how far past its own threshold the gap is, so the most
        // striking differences come first and a metric that is barely notable
        // can never push a decisive one out of the list.
        findings.push({ text, ratio: gap / threshold, order });
      }
    });

    findings.sort((a, b) => (b.ratio - a.ratio) || (a.order - b.order));
    return findings.slice(0, THRESHOLDS.maxInsights).map((finding) => finding.text);
  }

  /**
   * Today's forecast table (the optional second section). It has the same shape
   * as `buildTable`, so the renderer is shared with the current-conditions one.
   */
  function buildForecastTable(locations, format) {
    return buildTable(locations, format, DAILY_METRICS);
  }

  return {
    THRESHOLDS,
    CURRENT_METRICS,
    DAILY_METRICS,
    // Location selection
    addLocation,
    removeLocation,
    replaceLocation,
    moveLocation,
    clearLocations,
    canAddMore,
    canCompare,
    isSameCity,
    cityKey,
    cityLabel,
    // Data shaping
    toEntry,
    buildTable,
    buildForecastTable,
    buildInsights,
    spread,
    extremes,
    DEFAULT_FORMAT,
    utils: { isNumber, normalizeText },
  };
});
