/**
 * SkyCast "Today at a Glance" - Summary Engine
 * =========================================================================
 * The dashboard's first job is to be understood in two or three seconds. This
 * module turns the readings the app *already* has into that one screen: the
 * place, the temperature, how it feels, the sky, three numbers that matter -
 * and a single human verdict instead of raw meteorological data.
 *
 * Design rules this module deliberately follows (mirroring `advice.js`):
 *
 *  * **Pure and deterministic.** No DOM, no network, no clock, no randomness,
 *    no storage. The same payload always yields the same glance, so the logic
 *    is testable in plain Node (see `tests/glance.test.js`) and cannot drift
 *    from the UI.
 *  * **No unit logic and no weather wording of its own.** Every temperature and
 *    wind value is emitted through caller-injected formatters (app.js passes
 *    `formatTemp` / `formatWindSpeed`), and the condition label comes from the
 *    app's own `WMO_MAP` lookup, so the card follows the active degC / degF
 *    toggle and the single source of weather wording exactly like the rest of
 *    SkyCast. Raw numbers stay in the Open-Meteo source units: Celsius, km/h,
 *    mm, percent.
 *  * **Never guesses.** A missing reading renders as "--" and is excluded from
 *    the verdict; a payload with nothing usable at all returns `ok: false` so
 *    the caller hides the card instead of showing a confident-sounding blank.
 *  * **One thresholds object.** Every cut-off that decides which verdict wins
 *    lives in `THRESHOLDS`.
 *
 * Loading contract: plain classic script (no build step). It publishes
 * `window.SkyCastGlance`, and also supports `module.exports` for the tests.
 */

(function (root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root) root.SkyCastGlance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ==========================================================================
  // Thresholds - the single place to tune every verdict
  // --------------------------------------------------------------------------
  // Values are in the Open-Meteo source units (Celsius, km/h, mm, percent). The
  // rain boundaries deliberately reuse the ones the Weather Assistant already
  // applies (see `THRESHOLDS.rain` in advice.js), so the glance card at the top
  // of the page can never tell the visitor the opposite of the card below it.
  // ==========================================================================
  const THRESHOLDS = {
    scope: {
      /** "Today" stops at the next midnight, but never looks further ahead. */
      maxHours: 24,
    },

    rain: {
      /** Peak chance from which an umbrella is worth carrying. */
      peakChance: 30,
      /** Hourly amount (mm/h) that wets you even at a low probability. */
      wetMm: 0.2,
      /** Below this peak chance the day counts as dry. */
      dryChance: 20,
    },

    temp: {
      /** "Feels like" at or below this is genuinely freezing. */
      freezingC: 0,
      /** "Feels like" at or above this is genuinely hot. */
      hotC: 33,
    },

    wind: {
      /** Peak wind of the day at which it stops being a pleasant breeze. */
      galeKmh: 40,
      /** Peak wind mentioned in the "good weather" detail line. */
      breezyKmh: 25,
    },
  };

  // ==========================================================================
  // WMO weather-code groups (kept local: app.js owns the display map)
  // ==========================================================================
  const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82]);
  const SNOW_CODES = new Set([56, 57, 66, 67, 71, 73, 75, 77, 85, 86]);
  const STORM_CODES = new Set([95, 96, 99]);

  // ==========================================================================
  // The verdict ladder
  // --------------------------------------------------------------------------
  // The two verdicts the glance is designed around - "Good weather" and
  // "Umbrella recommended" - are the two everyday outcomes. The rest exist
  // because calling a blizzard or a heatwave "good weather" (or advising an
  // umbrella in a thunderstorm) would be worse than saying nothing. They are
  // ordered by urgency and evaluated top-down, so the most urgent condition
  // that is actually present is the one that is reported.
  // ==========================================================================
  const VERDICTS = {
    storm: { id: 'storm', tone: 'bad', icon: '\u26A8\uFE0F', text: 'Thunderstorms expected' },
    snow: { id: 'snow', tone: 'warn', icon: '\u2744\uFE0F', text: 'Snowy today' },
    freezing: { id: 'freezing', tone: 'bad', icon: '\uD83E\uDD76', text: 'Freezing cold' },
    hot: { id: 'hot', tone: 'bad', icon: '\uD83E\uDD75', text: 'Very hot' },
    umbrella: { id: 'umbrella', tone: 'caution', icon: '\u2614', text: 'Umbrella recommended' },
    gale: { id: 'gale', tone: 'warn', icon: '\uD83D\uDCA8', text: 'Very windy' },
    good: { id: 'good', tone: 'good', icon: '\uD83D\uDC4D', text: 'Good weather' },
  };

  /** Every verdict in the order it is evaluated. */
  const VERDICT_ORDER = ['storm', 'snow', 'freezing', 'hot', 'umbrella', 'gale', 'good'];

  const UNKNOWN = '--';

  // ==========================================================================
  // Small helpers
  // ==========================================================================
  function isNum(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function orNull(value) {
    return isNum(value) ? value : null;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  /** "15:00" for an hour of the day. */
  function hourLabel(hour) {
    return `${pad2(hour)}:00`;
  }

  /** Read a parallel array safely; Open-Meteo omits whole variables sometimes. */
  function pick(arr, index) {
    if (!Array.isArray(arr)) return null;
    return orNull(arr[index]);
  }

  function maxOf(values) {
    let best = null;
    values.forEach((value) => {
      if (isNum(value) && (best === null || value > best)) best = value;
    });
    return best;
  }

  function minOf(values) {
    let best = null;
    values.forEach((value) => {
      if (isNum(value) && (best === null || value < best)) best = value;
    });
    return best;
  }

  // ==========================================================================
  // Formatting (caller-injected; defaults keep the module standalone)
  // ==========================================================================
  const DEFAULT_FORMAT = {
    temp: (celsius) => (isNum(celsius) ? String(Math.round(celsius)) : UNKNOWN),
    tempSymbol: '\u00b0C',
    wind: (kmh) => (isNum(kmh) ? Number(kmh).toFixed(1) : UNKNOWN),
    windSymbol: 'km/h',
    precip: (mm) => (isNum(mm) ? Number(mm).toFixed(1) : UNKNOWN),
    precipSymbol: 'mm',
    percent: (value) => (isNum(value) ? `${Math.round(value)}%` : UNKNOWN),
    cardinal: () => null,
    conditionLabel: () => UNKNOWN,
  };

  function resolveFormat(format) {
    const source = format && typeof format === 'object' ? format : {};
    const pick1 = (key) => (typeof source[key] === 'function' ? source[key] : DEFAULT_FORMAT[key]);
    const pickText = (key) => (typeof source[key] === 'string' ? source[key] : DEFAULT_FORMAT[key]);
    return {
      temp: pick1('temp'),
      tempSymbol: pickText('tempSymbol'),
      wind: pick1('wind'),
      windSymbol: pickText('windSymbol'),
      precip: pick1('precip'),
      precipSymbol: pickText('precipSymbol'),
      percent: pick1('percent'),
      cardinal: pick1('cardinal'),
      conditionLabel: pick1('conditionLabel'),
    };
  }

  /** "18°C" in the active unit. */
  function tempText(format, celsius) {
    if (!isNum(celsius)) return UNKNOWN;
    return `${format.temp(celsius)}${format.tempSymbol}`;
  }

  /** "17-20°C", collapsing to a single value when the range is degenerate. */
  function tempRangeText(format, minC, maxC) {
    if (!isNum(minC) && !isNum(maxC)) return null;
    const low = isNum(minC) ? minC : maxC;
    const high = isNum(maxC) ? maxC : minC;
    if (Math.abs(high - low) < 0.5) return tempText(format, low);
    const lowText = format.temp(low);
    const highText = format.temp(high);
    if (String(lowText) === String(highText)) return tempText(format, low);
    return `${lowText}-${highText}${format.tempSymbol}`;
  }

  /** "11 km/h" in the active unit. */
  function windText(format, kmh) {
    if (!isNum(kmh)) return null;
    return `${format.wind(kmh)} ${format.windSymbol}`;
  }

  /** "1.2 mm" in the active unit. */
  function precipText(format, mm) {
    if (!isNum(mm)) return null;
    return `${format.precip(mm)} ${format.precipSymbol}`;
  }

  function windDescriptor(kmh) {
    if (!isNum(kmh)) return null;
    if (kmh <= 12) return 'light wind';
    if (kmh <= THRESHOLDS.wind.breezyKmh) return 'a breeze';
    if (kmh <= THRESHOLDS.wind.galeKmh) return 'strong wind';
    return 'very strong wind';
  }

  // ==========================================================================
  // Hourly normalisation
  // ==========================================================================
  /**
   * The remaining hours of the city's current local day.
   *
   * "Today" is scoped to the current date, so a 23:00 reading is judged on the
   * evening rather than on the whole 24-hour payload, and a hostile or missing
   * hourly block simply yields fewer (never invented) rows.
   */
  function todaysHours(hourly, currentTime) {
    const times = hourly && Array.isArray(hourly.time) ? hourly.time : [];
    if (times.length === 0) return [];

    const now = typeof currentTime === 'string' ? currentTime : '';
    const currentPrefix = now.slice(0, 13);
    const today = now.slice(0, 10) || null;

    const rows = [];
    for (let i = 0; i < times.length && rows.length < THRESHOLDS.scope.maxHours; i++) {
      const time = typeof times[i] === 'string' ? times[i] : '';
      if (!time) continue;
      if (currentPrefix && time < currentPrefix) continue;
      if (today && time.slice(0, 10) !== today) break;

      const hour = parseInt(time.slice(11, 13), 10);
      rows.push({
        time,
        hour: Number.isNaN(hour) ? null : hour,
        apparentC: pick(hourly.apparent_temperature, i),
        tempC: pick(hourly.temperature_2m, i),
        chance: pick(hourly.precipitation_probability, i),
        mm: pick(hourly.precipitation, i),
        windKmh: pick(hourly.wind_speed_10m, i),
        code: pick(hourly.weather_code, i),
      });
    }
    return rows;
  }

  /**
   * Everything the verdict ladder reasons about, read once and isolated from
   * the payload shape. A getter that throws is treated as a missing reading.
   */
  function readConditions(ctx, format) {
    const current = ctx && ctx.current && typeof ctx.current === 'object' ? ctx.current : null;
    const daily = ctx && ctx.daily && typeof ctx.daily === 'object' ? ctx.daily : null;
    const hours = todaysHours(ctx ? ctx.hourly : null, ctx ? ctx.currentTime : null);

    const tempC = current ? orNull(current.temperature_2m) : null;
    const apparentC = current ? orNull(current.apparent_temperature) : null;
    const code = current ? orNull(current.weather_code) : null;

    // Rain: the peak probability for the rest of the day. The daily maximum is
    // a fallback for payloads that carry no usable hourly rows.
    const hourlyChance = maxOf(hours.map((hour) => hour.chance));
    const dailyChance = daily && Array.isArray(daily.precipitation_probability_max)
      ? orNull(daily.precipitation_probability_max[0])
      : null;
    const rainChance = isNum(hourlyChance) ? hourlyChance : dailyChance;
    const peakRainHour = isNum(rainChance)
      ? hours.find((hour) => hour.chance === rainChance) || null
      : null;

    const nowMm = current ? orNull(current.precipitation) : null;
    const peakMm = maxOf(hours.map((hour) => hour.mm));
    const rainMm = maxOf([nowMm, peakMm]);

    const hourlyWind = maxOf(hours.map((hour) => hour.windKmh));
    const dailyWind = daily && Array.isArray(daily.wind_speed_10m_max)
      ? orNull(daily.wind_speed_10m_max[0])
      : null;
    const windNow = current ? orNull(current.wind_speed_10m) : null;
    const windPeak = maxOf([windNow, hourlyWind, dailyWind]);
    const windDeg = current ? orNull(current.wind_direction_10m) : null;

    const apparentList = hours.map((hour) => (isNum(hour.apparentC) ? hour.apparentC : hour.tempC));
    let coldest = minOf(apparentList);
    let warmest = maxOf(apparentList);
    let coldestHour = isNum(coldest)
      ? hours.find((hour) => (isNum(hour.apparentC) ? hour.apparentC : hour.tempC) === coldest) || null
      : null;
    let warmestHour = isNum(warmest)
      ? hours.find((hour) => (isNum(hour.apparentC) ? hour.apparentC : hour.tempC) === warmest) || null
      : null;

    // With no usable hourly rows the only temperature left is "now", so the day
    // is judged on that rather than silently losing its cold/hot verdicts.
    if (!isNum(coldest) && isNum(apparentC)) {
      coldest = apparentC;
      warmest = apparentC;
    }

    const codes = hours.map((hour) => hour.code).filter(isNum);
    if (isNum(code)) codes.push(code);

    return {
      ok: isNum(tempC) || isNum(code),
      format,
      tempC,
      apparentC: isNum(apparentC) ? apparentC : tempC,
      code,
      hours,
      rainChance,
      peakRainHour,
      rainMm,
      nowMm,
      rainAvailable: isNum(rainChance) || isNum(rainMm),
      windNow,
      windPeak,
      windDeg,
      coldest,
      coldestHour,
      warmest,
      warmestHour,
      hasSnow: codes.some((c) => SNOW_CODES.has(c)),
      hasStorm: codes.some((c) => STORM_CODES.has(c)),
      hasRainCode: codes.some((c) => RAIN_CODES.has(c)),
    };
  }

  // ==========================================================================
  // Verdict
  // ==========================================================================

  /** " around 15:00", but only when the hour is actually ahead of us. */
  function whenText(hour, currentHour) {
    if (!hour || !isNum(hour.hour)) return '';
    if (isNum(currentHour) && hour.hour <= currentHour) return '';
    return ` around ${hourLabel(hour.hour)}`;
  }

  function currentHourOf(ctx) {
    const now = ctx && typeof ctx.currentTime === 'string' ? ctx.currentTime : '';
    const hour = parseInt(now.slice(11, 13), 10);
    return Number.isNaN(hour) ? null : hour;
  }

  /** Detail lines. Short on purpose: this is read at a glance, not studied. */
  function verdictDetail(key, cond, nowHour) {
    const format = cond.format;

    if (key === 'storm') {
      const stormHour = (cond.hours.find((hour) => STORM_CODES.has(hour.code)) || null);
      return `Thunderstorms are forecast${whenText(stormHour, nowHour)} \u2014 outdoor plans may be cut short.`;
    }

    if (key === 'snow') {
      const snowHour = cond.hours.find((hour) => SNOW_CODES.has(hour.code)) || null;
      return `Snow is forecast${whenText(snowHour, nowHour)} \u2014 allow extra travel time.`;
    }

    if (key === 'freezing') {
      const when = cond.coldestHour && isNum(cond.coldestHour.hour) ? ` at ${hourLabel(cond.coldestHour.hour)}` : '';
      return `Feels like ${tempText(format, cond.coldest)}${when} \u2014 heavy layers needed.`;
    }

    if (key === 'hot') {
      const when = cond.warmestHour && isNum(cond.warmestHour.hour) ? ` at ${hourLabel(cond.warmestHour.hour)}` : '';
      return `Feels like ${tempText(format, cond.warmest)}${when} \u2014 seek shade and hydrate.`;
    }

    if (key === 'umbrella') {
      if (isNum(cond.nowMm) && cond.nowMm > 0) {
        const amount = precipText(format, cond.nowMm);
        return amount
          ? `Rain is falling right now (${amount} in the last hour).`
          : 'Rain is falling right now.';
      }
      if (isNum(cond.rainChance)) {
        return `Rain peaks at ${Math.round(cond.rainChance)}%${whenText(cond.peakRainHour, nowHour)}.`;
      }
      return 'Light precipitation is expected today.';
    }

    if (key === 'gale') {
      const peak = windText(format, cond.windPeak);
      return peak ? `Winds reach ${peak} today \u2014 a blustery day out.` : 'Very windy today.';
    }

    // The "good weather" detail states *why* the day reads as good.
    const range = tempRangeText(format, cond.coldest, cond.warmest);
    const wind = windDescriptor(cond.windPeak);
    const damp = isNum(cond.rainChance) && cond.rainChance >= THRESHOLDS.rain.dryChance;
    const parts = [damp ? 'Mostly dry' : 'Dry'];
    if (range) parts.push(`and comfortable around ${range}`);
    if (wind) parts.push(`with ${wind}`);
    return `${parts.join(' ')}.`;
  }

  /**
   * Pick the verdict. The ladder is evaluated in order, so the most urgent
   * condition that is actually present wins - and each branch is a plain
   * reading comparison, never a guess.
   */
  function pickVerdict(cond) {
    // Rain counts as rain because a probability or an amount says so. A rain
    // weather code is only consulted when there is neither, so a stray "rain"
    // code next to a 5% / 0.0 mm forecast cannot talk the visitor into carrying
    // an umbrella.
    const rainByReading =
      (isNum(cond.rainChance) && cond.rainChance >= THRESHOLDS.rain.peakChance) ||
      (isNum(cond.rainMm) && cond.rainMm >= THRESHOLDS.rain.wetMm);
    const rainByCode = !cond.rainAvailable && cond.hasRainCode;

    if (cond.hasStorm) return VERDICTS.storm;
    if (cond.hasSnow) return VERDICTS.snow;
    if (isNum(cond.coldest) && cond.coldest <= THRESHOLDS.temp.freezingC) return VERDICTS.freezing;
    if (isNum(cond.warmest) && cond.warmest >= THRESHOLDS.temp.hotC) return VERDICTS.hot;
    if (rainByReading || rainByCode) return VERDICTS.umbrella;
    if (isNum(cond.windPeak) && cond.windPeak >= THRESHOLDS.wind.galeKmh) return VERDICTS.gale;
    return VERDICTS.good;
  }

  // ==========================================================================
  // Metrics
  // ==========================================================================
  /**
   * The three numbers worth reading before anything else. Each carries a
   * screen-reader `hint` spelling out what the number means, because "Rain 20%"
   * alone is ambiguous: 20% chance *now*, or 20% chance *today*?
   */
  function buildMetrics(cond, current) {
    const format = cond.format;
    const rainValue = isNum(cond.rainChance) ? format.percent(cond.rainChance) : UNKNOWN;
    const windNow = windText(format, cond.windNow);
    const cardinal = isNum(cond.windDeg) ? format.cardinal(cond.windDeg) : null;

    return [
      {
        key: 'rain',
        label: 'Rain',
        value: rainValue,
        note: null,
        hint: isNum(cond.rainChance) ? 'peak chance today' : 'not reported',
      },
      {
        key: 'wind',
        label: 'Wind',
        value: windNow || UNKNOWN,
        // The cardinal sits next to the number and reads on its own, so no
        // screen-reader hint is needed here.
        note: cardinal || null,
        hint: null,
      },
      {
        key: 'humidity',
        label: 'Humidity',
        value: current && isNum(current.relative_humidity_2m)
          ? format.percent(current.relative_humidity_2m)
          : UNKNOWN,
        note: null,
        hint: 'relative humidity',
      },
    ];
  }

  // ==========================================================================
  // Public entry point
  // ==========================================================================

/**
   * Build the whole glance from one context object:
   *
   *   {
   *     current,     // Open-Meteo current block for the city
   *     hourly,      // the hourly block already in memory (may be missing)
   *     daily,       // optional daily block, used as a fallback
   *     currentTime, // local "now" for the city, e.g. "2026-10-02T14:30"
   *     city,        // { name, admin1, country } - plain strings only
   *     format       // app.js formatters: { temp, tempSymbol, wind, ... }
   *   }
   *
   * Returns `ok: false` when there is nothing to show - including when the
   * payload is malformed enough to throw while being read - so the caller can
   * hide the card instead of painting a confident-sounding blank.
   */
  function build(ctx) {
    const source = ctx && typeof ctx === 'object' ? ctx : {};

    try {
      const format = resolveFormat(source.format);
      const cond = readConditions(source, format);
      if (!cond.ok) return notEnoughData();

      const city = source.city && typeof source.city === 'object' ? source.city : {};
      const meta = [city.admin1, city.country].filter((part) => typeof part === 'string' && part.trim());
      const verdict = pickVerdict(cond);

      return {
        ok: true,
        location: {
          name: typeof city.name === 'string' && city.name.trim() ? city.name : UNKNOWN,
          meta: meta.join(', '),
        },
        // The number and its unit stay separate so the card can style the unit
        // exactly like the hero does.
        temperature: isNum(cond.tempC) ? format.temp(cond.tempC) : UNKNOWN,
        tempSymbol: format.tempSymbol,
        feelsLike: isNum(cond.apparentC) ? tempText(format, cond.apparentC) : UNKNOWN,
        condition: format.conditionLabel(cond.code),
        metrics: buildMetrics(cond, source.current),
        verdict: {
          id: verdict.id,
          tone: verdict.tone,
          icon: verdict.icon,
          text: verdict.text,
          detail: verdictDetail(verdict.id, cond, currentHourOf(source)),
        },
      };
    } catch (err) {
      return notEnoughData();
    }
  }

  function notEnoughData() {
    return { ok: false, location: null, verdict: null, metrics: [] };
  }

  return {
    THRESHOLDS,
    VERDICTS,
    VERDICT_ORDER,
    build,
  };
});