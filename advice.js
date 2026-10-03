/**
 * WeatherScope Weather Assistant - Recommendation Engine
 * =========================================================================
 * Turns the hourly Open-Meteo forecast the dashboard *already* has into short,
 * human-readable guidance ("Will I need an umbrella?", "Best time for a walk?").
 *
 * Design rules this module deliberately follows:
 *
 *  * **Pure and deterministic.** No DOM, no network, no clock, no randomness.
 *    The same forecast always yields the same advice, so the logic is testable
 *    in plain Node (see `tests/advice.test.js`) and cannot drift from the UI.
 *  * **No unit logic of its own.** Every temperature, wind and precipitation
 *    value is emitted through caller-injected formatters (app.js passes its own
 *    `formatTemp` / `formatWindSpeed` / `formatPrecip`), so the whole assistant
 *    follows the active °C / °F toggle exactly like the rest of WeatherScope. All
 *    thresholds below are stored in the Open-Meteo units - Celsius, km/h, mm.
 *  * **Never guesses.** Every getter degrades to a `notEnoughData()` result
 *    when the readings it needs are missing, and `getAdviceBundle()` isolates
 *    each recommendation in its own try/catch so one failure can never blank
 *    the dashboard or hide the other recommendations.
 *
 * Loading contract: plain classic script (no build step). It publishes
 * `window.WeatherScopeAdvice`, and also supports `module.exports` for the tests.
 */

(function (root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root) root.WeatherScopeAdvice = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ==========================================================================
  // Thresholds - the single place to tune every recommendation
  // --------------------------------------------------------------------------
  // Values are deliberately conservative and reuse the conventions the climate
  // filter parser already established in app.js:
  //   freezing <= 2 °C | cold < 12 °C | cool 8-14 °C | mild 14-20 °C
  //   warm 20-28 °C   | hot > 28 °C  | windy > 20 km/h | gale > 40 km/h
  // Anything that needs a different cut-off is edited here, never inline.
  // ==========================================================================
  const THRESHOLDS = {
    /** How much of a day must remain before advice describes "today". */
    scope: {
      minHoursForToday: 3,
      maxHoursAnalysed: 24,
      /** Fewer usable hourly readings than this => not enough forecast data. */
      minUsableHours: 3,
    },

    rain: {
      /** At or above this chance an hour counts as "wet". */
      wetChance: 40,
      /** ...or this hourly accumulation (mm) counts as "wet" on its own. */
      wetMm: 0.2,
      /** Peak chance below which the umbrella answer is "probably not". */
      dryChance: 20,
      /** Peak chance at which we start advising an umbrella. */
      umbrellaChance: 30,
      /** Peak chance at which it becomes "definitely bring one". */
      umbrellaCertainChance: 70,
      /** Hourly amount that counts as genuinely wet (mm/h). */
      meaningfulMm: 0.5,
      /** Hourly amount that wets you through (mm/h). */
      heavyMm: 2,
      /** Day total (mm) that rules out a wash regardless of timing. */
      washBlockingMm: 5,
      /** Chance at which an outdoor activity is called off. */
      activityRainChance: 40,
      /** Accumulation at which an outdoor activity is called off (mm/h). */
      activityRainMm: 0.2,
    },

    walk: {
      /** Comfortable band, aligned with the app's cool..warm presets. */
      tempMinC: 8,
      tempMaxC: 26,
      /** Above this a walk needs a windbreaker rather than being enjoyable. */
      maxWindKmh: 28,
      /** Hourly score penalty weights (see scoreWalkHour). */
      rainPenalty: 6,
      mmPenalty: 2.5,
      tempPenaltyPerDeg: 0.18,
      windPenaltyPerKmh: 0.12,
      nightPenalty: 0.6,
      /** A "best window" must be a usable stretch, not a single lucky hour. */
      minWindowHours: 2,
      maxWindowHours: 4,
      /** Every hour must satisfy this for the window to be called "ideal". */
      idealRainChance: 30,
      idealRainMm: 0.2,
      idealWindKmh: 28,
    },

    carWash: {
      /** Consecutive dry hours needed before we recommend washing. */
      minDryHours: 3,
      /** Wind above this dries a car slowly - flagged, not disqualifying. */
      dryingWindKmh: 35,
    },

    cycling: {
      /** Above this riding is uncomfortable for most cyclists. */
      strongWindKmh: 38,
      /** Above this it is merely noticeable. */
      noticeableWindKmh: 25,
      /** Comfortable riding band (chill at the low end, heat at the high end). */
      tempMinC: 2,
      tempMaxC: 32,
    },

    swimming: {
      /** Outdoor swimming is interpreted as general outdoor conditions only. */
      /** Open-Meteo's weather forecast carries no water temperature. */
      minAirC: 20,
      comfortableAirC: 24,
      maxRainChance: 20,
      maxRainMm: 0.1,
      maxWindKmh: 24,
      /** Cloud cover above which the day is described as overcast. */
      overcastCloud: 80,
      /** Air temperature at which heat, not weather, becomes the headline. */
      hotAirC: 32,
    },

    clothing: {
      /** Bands applied to the *apparent* ("feels like") temperature. */
      tShirtC: 22,
      lightJacketC: 15,
      warmJacketC: 5,
      /** Below this the tile says "winter coat". */
      coatC: -3,
      /** Daytime swing that is worth calling out as morning/afternoon. */
      notableSwingC: 5,
      /** UV index at which sun protection is mentioned. */
      uvCaution: 6,
      /** Wind above which windproofing is worth a mention. */
      breezyKmh: 25,
    },

    /** Shared with the headline "Today's advice". */
    summary: {
      coldC: 2,
      hotC: 30,
      /** Nice-day window: dry, mild and not breezy. */
      pleasantMinC: 10,
      pleasantMaxC: 26,
      pleasantMaxWindKmh: 25,
      pleasantRainChance: 30,
    },
  };

  /**
   * Time windows offered by the "Rain during your day?" control. These are
   * ordinary clock windows - WeatherScope stores no commute, home or work address,
   * so nothing here is personal data. The selection lives in memory only and is
   * never written to localStorage or sessionStorage.
   */
  const RAIN_WINDOWS = [
    { key: 'morning', label: 'Morning', phrase: 'your morning', start: 6, end: 9 },
    { key: 'midday', label: 'Midday', phrase: 'the midday hours', start: 11, end: 14 },
    { key: 'afternoon', label: 'Afternoon', phrase: 'your afternoon', start: 15, end: 18 },
    { key: 'evening', label: 'Evening', phrase: 'the evening', start: 18, end: 21 },
  ];

  /** Static presentation metadata: the six "everyday decisions" tiles. */
  const ADVICE_META = {
    umbrella: { id: 'umbrella', icon: '☔', label: 'Umbrella' },
    walk: { id: 'walk', icon: '🚶', label: 'Walk' },
    carWash: { id: 'carWash', icon: '🚗', label: 'Wash car' },
    cycling: { id: 'cycling', icon: '🚴', label: 'Cycling' },
    swimming: { id: 'swimming', icon: '🏊', label: 'Swimming' },
    clothing: { id: 'clothing', icon: '👕', label: 'What to wear' },
  };

  /** Render order of the decision tiles. */
  const ADVICE_ORDER = ['umbrella', 'walk', 'carWash', 'cycling', 'swimming', 'clothing'];

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

  function hourLabel(hour) {
    return `${pad2(hour)}:00`;
  }

  /** "14:00-17:00" - a window covering hours 14, 15 and 16. */
  function rangeLabel(startHour, endHour) {
    return `${hourLabel(startHour)}-${hourLabel(endHour)}`;
  }

  function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
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

  function sumOf(values) {
    let total = 0;
    let seen = false;
    values.forEach((value) => {
      if (isNum(value)) {
        seen = true;
        total += value;
      }
    });
    return seen ? total : null;
  }

  // ==========================================================================
  // WMO weather-code groups (kept local: app.js owns the display map)
  // ==========================================================================
  const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82]);
  const SNOW_CODES = new Set([56, 57, 66, 67, 71, 73, 75, 77, 85, 86]);
  const STORM_CODES = new Set([95, 96, 99]);
  const FOG_CODES = new Set([45, 48]);

  function codeGroup(code) {
    if (!isNum(code)) return 'unknown';
    if (STORM_CODES.has(code)) return 'storm';
    if (SNOW_CODES.has(code)) return 'snow';
    if (RAIN_CODES.has(code)) return 'rain';
    if (FOG_CODES.has(code)) return 'fog';
    return 'other';
  }

  // ==========================================================================
  // Formatting (caller-injected; defaults keep the module standalone)
  // ==========================================================================
  const DEFAULT_FORMAT = {
    temp: (celsius) => String(Math.round(celsius)),
    tempSymbol: '°C',
    wind: (kmh) => Number(kmh).toFixed(1),
    windSymbol: 'km/h',
    precip: (mm) => Number(mm).toFixed(1),
    precipSymbol: 'mm',
  };

  function resolveFormat(format) {
    const source = format && typeof format === 'object' ? format : {};
    return {
      temp: typeof source.temp === 'function' ? source.temp : DEFAULT_FORMAT.temp,
      tempSymbol: typeof source.tempSymbol === 'string' ? source.tempSymbol : DEFAULT_FORMAT.tempSymbol,
      wind: typeof source.wind === 'function' ? source.wind : DEFAULT_FORMAT.wind,
      windSymbol: typeof source.windSymbol === 'string' ? source.windSymbol : DEFAULT_FORMAT.windSymbol,
      precip: typeof source.precip === 'function' ? source.precip : DEFAULT_FORMAT.precip,
      precipSymbol:
        typeof source.precipSymbol === 'string' ? source.precipSymbol : DEFAULT_FORMAT.precipSymbol,
    };
  }

  /** "18°C" in the active unit. */
  function tempText(format, celsius) {
    if (!isNum(celsius)) return '--';
    return `${format.temp(celsius)}${format.tempSymbol}`;
  }

  /** "17-20°C", collapsing to a single value when the range is degenerate. */
  function tempRangeText(format, minC, maxC) {
    if (!isNum(minC) && !isNum(maxC)) return null;
    const low = isNum(minC) ? minC : maxC;
    const high = isNum(maxC) ? maxC : minC;
    if (Math.abs(high - low) < 0.5) return tempText(format, low);
    // A half-degree spread can still round to the same whole degree: never
    // print "20-20°C".
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
    if (kmh <= THRESHOLDS.walk.maxWindKmh) return 'a breeze';
    if (kmh <= THRESHOLDS.cycling.strongWindKmh) return 'strong wind';
    return 'very strong wind';
  }

  // ==========================================================================
  // Hourly normalisation
  // ==========================================================================

  /**
   * Turn one Open-Meteo hourly row into the flat record every getter works on.
   * Missing readings stay `null` rather than becoming 0, so "no data" can
   * never masquerade as "dry and windless".
   */
  function normalizeHour(timeStr, index, hourly) {
    const time = typeof timeStr === 'string' ? timeStr : '';
    const date = time.slice(0, 10);
    const hour = parseInt(time.slice(11, 13), 10);
    const tempC = pick(hourly.temperature_2m, index);
    const apparentC = pick(hourly.apparent_temperature, index);
    const chance = pick(hourly.precipitation_probability, index);
    const mm = pick(hourly.precipitation, index);
    const windKmh = pick(hourly.wind_speed_10m, index);
    const cloud = pick(hourly.cloud_cover, index);
    const code = pick(hourly.weather_code, index);

    return {
      index,
      time,
      date,
      hour: Number.isNaN(hour) ? null : hour,
      tempC,
      apparentC,
      // "Feels like" when Open-Meteo provides it, plain temperature otherwise.
      comfortTempC: isNum(apparentC) ? apparentC : tempC,
      chance,
      mm,
      windKmh,
      cloud,
      code,
      isDay: Array.isArray(hourly.is_day) ? (hourly.is_day[index] === 1) : null,
      group: codeGroup(code),
    };
  }

  /**
   * Split the hourly payload into "the rest of the local day" and "the next 24
   * hours". Late at night the local day is nearly over, so the engine analyses
   * the coming 24 hours instead of a two-hour fragment.
   */
  function buildHourSets(hourly, currentTime) {
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) return null;

    const times = hourly.time;
    let startIndex = 0;
    if (typeof currentTime === 'string' && currentTime.length >= 13) {
      const prefix = currentTime.slice(0, 13);
      const found = times.findIndex((t) => typeof t === 'string' && t.slice(0, 13) === prefix);
      if (found !== -1) startIndex = found;
    }

    const startDate = String(times[startIndex] || '').slice(0, 10);
    const today = [];
    const next24 = [];

    for (let i = startIndex; i < times.length; i++) {
      const record = normalizeHour(times[i], i, hourly);
      // A row without a parsable hour cannot be placed on a clock, so it is
      // dropped rather than silently mislabelled.
      if (!isNum(record.hour)) continue;
      if (next24.length < THRESHOLDS.scope.maxHoursAnalysed) next24.push(record);
      if (today.length < THRESHOLDS.scope.maxHoursAnalysed && record.date === startDate) {
        today.push(record);
      }
      if (next24.length >= THRESHOLDS.scope.maxHoursAnalysed && record.date !== startDate) break;
    }

    return { today, next24 };
  }

  /**
   * First and last hour of the longest uninterrupted wet / dry stretch.
   * `endHour` is exclusive so "14:00-17:00" covers the hours 14, 15 and 16.
   */
  function longestRun(hours, isWet) {
    let best = null;
    let runStart = null;
    let runLast = null;

    const close = () => {
      if (runStart === null) return;
      const candidate = {
        length: runLast - runStart + 1,
        startHour: runStart,
        endHour: runLast + 1,
      };
      if (!best || candidate.length > best.length || (candidate.length === best.length && candidate.startHour < best.startHour)) {
        best = candidate;
      }
      runStart = null;
      runLast = null;
    };

    hours.forEach((hour) => {
      if (isWet(hour)) {
        if (runStart === null) runStart = hour.hour;
        runLast = hour.hour;
      } else {
        close();
      }
    });
    close();

    return best;
  }

  // ==========================================================================
  // Shared day profile
  // ==========================================================================
  /**
   * One pass over the forecast that every getter reads from. Keeping the
   * aggregation here is what makes the assistant cheap: the hourly array is
   * walked once per render instead of once per recommendation.
   */
  function analyze(ctx) {
    const context = ctx && typeof ctx === 'object' ? ctx : {};
    const format = resolveFormat(context.format);

    const sets = buildHourSets(context.hourly, context.currentTime);
    if (!sets) {
      return { ok: false, reason: 'no-hourly', format, list: [], scope: null };
    }

    const scope = sets.today.length >= THRESHOLDS.scope.minHoursForToday ? 'today' : 'next24';
    const list = scope === 'today' ? sets.today : sets.next24;
    const usable = list.filter((hour) => isNum(hour.comfortTempC));

    if (usable.length < THRESHOLDS.scope.minUsableHours) {
      return { ok: false, reason: 'insufficient-hours', format, list, scope };
    }

    const T = THRESHOLDS.rain;
    const isWet = (hour) =>
      (isNum(hour.chance) && hour.chance >= T.wetChance) ||
      (isNum(hour.mm) && hour.mm >= T.wetMm) ||
      hour.group === 'rain' ||
      hour.group === 'storm' ||
      hour.group === 'snow';

    const chances = list.map((hour) => hour.chance).filter(isNum);
    const amounts = list.map((hour) => hour.mm).filter(isNum);
    const winds = list.map((hour) => hour.windKmh).filter(isNum);
    const clouds = list.map((hour) => hour.cloud).filter(isNum);
    const plainTemps = list.map((hour) => hour.tempC).filter(isNum);
    const apparentTemps = list.map((hour) => hour.apparentC).filter(isNum);

    const peakChance = maxOf(chances);
    const peakChanceHour = peakChance === null
      ? null
      : list.find((hour) => hour.chance === peakChance) || null;
    const peakMm = maxOf(amounts);
    const peakMmHour = peakMm === null ? null : list.find((hour) => hour.mm === peakMm) || null;

    const wetRun = longestRun(list, isWet);
    const dryRun = longestRun(list, (hour) => !isWet(hour));
    const firstWet = wetRun ? list.find((hour) => hour.hour === wetRun.startHour) || null : null;
    const firstDry = dryRun ? list.find((hour) => hour.hour === dryRun.startHour) || null : null;

    const daylight = list.filter((hour) => hour.isDay === true);
    const temperatureHours = daylight.length ? daylight : list;

    // Hour of the day's warmest / coldest reading, for time-of-day wording.
    const comfortValues = list.map((hour) => hour.comfortTempC).filter(isNum);
    const comfortMaxC = maxOf(comfortValues);
    const comfortMinC = minOf(comfortValues);
    const comfortMaxHour = comfortMaxC === null ? null : list.find((hour) => hour.comfortTempC === comfortMaxC) || null;
    const comfortMinHour = comfortMinC === null ? null : list.find((hour) => hour.comfortTempC === comfortMinC) || null;

    return {
      ok: true,
      reason: null,
      format,
      scope,
      list,
      dayCount: list.length,
      scopePhrase: scope === 'today' ? 'the rest of today' : 'the next 24 hours',

      // Rain
      chanceAvailable: chances.length > 0,
      mmAvailable: amounts.length > 0,
      rainAvailable: chances.length > 0 || amounts.length > 0,
      peakChance,
      peakChanceHour,
      peakMm,
      peakMmHour,
      totalMm: sumOf(amounts),
      wetHours: list.filter(isWet).length,
      wetRun,
      firstWetHour: firstWet ? firstWet.hour : null,
      dryRun,
      firstDryHour: firstDry ? firstDry.hour : null,
      groups: list.map((hour) => hour.group),

      // Temperature
      apparentAvailable: apparentTemps.length > 0,
      tempMinC: minOf(plainTemps),
      tempMaxC: maxOf(plainTemps),
      comfortMinC,
      comfortMaxC,
      comfortMinHour,
      comfortMaxHour,
      daylightTempMaxC: maxOf(temperatureHours.map((hour) => hour.comfortTempC)),

      // Wind / cloud / daylight
      windAvailable: winds.length > 0,
      maxWindKmh: maxOf(winds),
      avgWindKmh: winds.length ? sumOf(winds) / winds.length : null,
      maxCloud: maxOf(clouds),
      daylightHours: daylight.length,
      isNight: list.every((hour) => hour.isDay === false),

      // Optional daily UV max, used only for a sun-protection mention.
      uvMax: orNull(context.uvMax),
    };
  }

  // ==========================================================================
  // Result helpers
  // ==========================================================================

  function result(meta, verdict, tone, headline, detail, extra) {
    return Object.assign({ ok: true, id: meta.id, icon: meta.icon, label: meta.label, verdict, tone, headline, detail, window: null }, extra || {});
  }

  /** The graceful state required when the readings a getter needs are absent. */
  function notEnoughData(meta, reason) {
    return {
      ok: false,
      id: meta.id,
      icon: meta.icon,
      label: meta.label,
      verdict: 'unknown',
      tone: 'unknown',
      headline: 'Not enough forecast data',
      detail: reason || 'This recommendation needs hourly forecast data that is not available right now.',
      window: null,
    };
  }

  // ==========================================================================
  // 1. "Will I need an umbrella?"
  // ==========================================================================
  function getUmbrellaAdvice(profile) {
    const meta = ADVICE_META.umbrella;
    if (!profile || !profile.ok) return notEnoughData(meta, 'No usable hourly forecast is available.');
    if (!profile.rainAvailable) {
      return notEnoughData(meta, 'This city has no precipitation probability or amount in the forecast.');
    }

    const T = THRESHOLDS.rain;
    const format = profile.format;
    const peakChance = profile.peakChance;
    const peakMm = profile.peakMm;
    const totalMm = profile.totalMm;
    const wetRun = profile.wetRun;

    // Why: prefer the wettest *window*, because "when" is what a person
    // actually needs to know - otherwise fall back to the peak percentage.
    let why;
    if (wetRun) {
      why = `Rain is likely between ${rangeLabel(wetRun.startHour, wetRun.endHour)}.`;
    } else if (peakChance !== null) {
      why = `Rain probability reaches ${Math.round(peakChance)}% around ${hourLabel(profile.peakChanceHour.hour)}.`;
    } else if (isNum(totalMm) && totalMm > 0) {
      why = `Around ${precipText(format, totalMm)} of rain is expected.`;
    } else {
      why = `No measurable precipitation is forecast for ${profile.scopePhrase}.`;
    }

    // A forecast of real rain volume justifies an umbrella even when the
    // percentage stays modest (e.g. slow, steady drizzle).
    const measurableRain = isNum(peakMm) && peakMm >= T.meaningfulMm;
    const soakingRain = isNum(peakMm) && peakMm >= T.heavyMm;
    const soakedAllDay = isNum(totalMm) && totalMm >= T.washBlockingMm;

    if ((peakChance !== null && peakChance >= T.umbrellaCertainChance) || soakedAllDay || soakingRain) {
      return result(meta, 'definitely', 'bad', 'Definitely bring an umbrella', why, {
        window: wetRun ? rangeLabel(wetRun.startHour, wetRun.endHour) : null,
      });
    }

    if ((peakChance !== null && peakChance >= T.umbrellaChance) || measurableRain) {
      return result(meta, 'likely', 'warn', 'Bring an umbrella', why, {
        window: wetRun ? rangeLabel(wetRun.startHour, wetRun.endHour) : null,
      });
    }

    const peakText = peakChance === null
      ? `No measurable precipitation is forecast for ${profile.scopePhrase}.`
      : `Rain probability stays low (peaks at ${Math.round(peakChance)}%).`;

    return result(meta, 'unlikely', 'good', 'Probably not', peakText);
  }

  // ==========================================================================
  // 2. "Best time for a walk"
  // ==========================================================================
  /**
   * Penalty score for a single hour - lower is better. Weighted so that rain
   * dominates, temperature and wind refine, and darkness is a gentle nudge
   * towards daylight hours.
   */
  function scoreWalkHour(hour, profile) {
    const W = THRESHOLDS.walk;
    let penalty = 0;

    if (isNum(hour.chance)) {
      penalty += Math.pow(hour.chance / 100, 1.5) * W.rainPenalty;
    }
    if (isNum(hour.mm)) {
      penalty += Math.min(hour.mm, 3) * W.mmPenalty;
    }
    if (isNum(hour.comfortTempC)) {
      const temp = hour.comfortTempC;
      const distance = temp < W.tempMinC ? W.tempMinC - temp : temp > W.tempMaxC ? temp - W.tempMaxC : 0;
      penalty += distance * W.tempPenaltyPerDeg;
    }
    if (isNum(hour.windKmh) && hour.windKmh > W.maxWindKmh) {
      penalty += (hour.windKmh - W.maxWindKmh) * W.windPenaltyPerKmh;
    }
    if (hour.isDay === false) penalty += W.nightPenalty;
    if (hour.group === 'storm' || hour.group === 'snow') penalty += 1.5;
    if (hour.group === 'fog') penalty += 0.4;

    return penalty;
  }

  function findBestWindow(hours, scoreFn) {
    let best = null;

    for (let length = THRESHOLDS.walk.minWindowHours; length <= THRESHOLDS.walk.maxWindowHours; length++) {
      for (let start = 0; start + length <= hours.length; start++) {
        const slice = hours.slice(start, start + length);
        const total = slice.reduce((sum, hour) => sum + scoreFn(hour), 0);
        const average = total / slice.length;
        const startHour = slice[0].hour;
        const endHour = slice[slice.length - 1].hour + 1;

        if (
          !best ||
          average < best.average - 1e-9 ||
          // Tie-break: prefer the longer usable stretch, then the earlier start.
          (Math.abs(average - best.average) <= 1e-9 &&
            (slice.length > best.window.length ||
              (slice.length === best.window.length && startHour < best.startHour)))
        ) {
          best = { average, window: slice, startHour, endHour };
        }
      }
    }

    return best;
  }

  /** Does every hour of the window sit inside the "ideal walk" envelope? */
  function isIdealWalkWindow(window) {
    const W = THRESHOLDS.walk;
    return window.every((hour) => {
      if (isNum(hour.chance) && hour.chance > W.idealRainChance) return false;
      if (isNum(hour.mm) && hour.mm > W.idealRainMm) return false;
      if (hour.group === 'rain' || hour.group === 'storm' || hour.group === 'snow') return false;
      if (isNum(hour.comfortTempC) && (hour.comfortTempC < W.tempMinC || hour.comfortTempC > W.tempMaxC)) return false;
      if (isNum(hour.windKmh) && hour.windKmh > W.idealWindKmh) return false;
      return true;
    });
  }

  function getBestWalkWindow(profile) {
    const meta = ADVICE_META.walk;
    if (!profile || !profile.ok) return notEnoughData(meta, 'No usable hourly temperatures are available.');

    const candidates = profile.list.filter((hour) => isNum(hour.comfortTempC));
    if (candidates.length < THRESHOLDS.walk.minWindowHours) {
      return notEnoughData(meta, 'Not enough hourly temperatures to compare a stretch of the day.');
    }

    const format = profile.format;
    const best = findBestWindow(candidates, (hour) => scoreWalkHour(hour, profile));
    const label = rangeLabel(best.startHour, best.endHour);

    const temps = best.window.map((hour) => hour.comfortTempC).filter(isNum);
    const winds = best.window.map((hour) => hour.windKmh).filter(isNum);
    const maxWind = maxOf(winds);
    const peakChance = maxOf(best.window.map((hour) => hour.chance));
    const peakMm = maxOf(best.window.map((hour) => hour.mm));

    // Detail: what the window actually offers, in the active unit.
    const parts = [];
    const range = tempRangeText(format, minOf(temps), maxOf(temps));
    if (range) parts.push(range);
    if (isNum(maxWind)) {
      const windValue = windText(format, maxWind);
      parts.push(`${windDescriptor(maxWind)}${windValue ? ` (up to ${windValue})` : ''}`);
    }
    if (!parts.length) parts.push('Limited detail for this period');

    const ideal = isIdealWalkWindow(best.window);

    if (!ideal) {
      const reasons = [];
      if (peakChance !== null && peakChance > THRESHOLDS.walk.idealRainChance) {
        reasons.push(`rain risk reaches ${Math.round(peakChance)}%`);
      } else if (isNum(peakMm) && peakMm > THRESHOLDS.walk.idealRainMm) {
        reasons.push(`rain is forecast (${precipText(format, peakMm)}/h)`);
      }
      if (isNum(maxWind) && maxWind > THRESHOLDS.walk.idealWindKmh) reasons.push('it is windy');

      return result(meta, 'none', 'warn', 'No ideal period today', `The driest window is ${label}. ${capitalize(parts.join(', '))}${reasons.length ? `, but ${reasons.join(' and ')}.` : '.'}`, {
        window: label,
      });
    }

    return result(meta, 'good', 'good', label, `Dry and comfortable: ${parts.join(', ')}.`, { window: label });
  }

  // ==========================================================================
  // 3. "Can I wash my car today?"
  // ==========================================================================
  function getCarWashAdvice(profile) {
    const meta = ADVICE_META.carWash;
    if (!profile || !profile.ok) return notEnoughData(meta, 'No usable hourly forecast is available.');
    if (!profile.rainAvailable) {
      return notEnoughData(meta, 'This city has no precipitation probability or amount in the forecast.');
    }

    const format = profile.format;
    const dryRun = profile.dryRun;
    const wetRun = profile.wetRun;
    const dryLabel = dryRun ? rangeLabel(dryRun.startHour, dryRun.endHour) : null;
    const wetLabel = wetRun ? rangeLabel(wetRun.startHour, wetRun.endHour) : null;

    // Wind only matters for drying, so it is flagged rather than disqualifying.
    const windNote = isNum(profile.maxWindKmh) && profile.maxWindKmh >= THRESHOLDS.carWash.dryingWindKmh
      ? ` It is windy (${windText(format, profile.maxWindKmh)}), so drying may be slower.`
      : '';

    // Why: a long dry spell only helps if it is not cut short by rain later.
    const lastHour = isNum(profile.list[profile.list.length - 1] && profile.list[profile.list.length - 1].hour)
      ? profile.list[profile.list.length - 1].hour
      : null;
    const dryRunLast = dryRun && isNum(lastHour) && dryRun.endHour >= lastHour;

    if (dryRun && !wetRun && dryRun.length >= THRESHOLDS.carWash.minDryHours) {
      return result(
        meta,
        'good',
        'good',
        'Good day to wash the car',
        `Dry conditions are forecast for about ${dryRun.length} hours, ${dryLabel}.${windNote}`,
        { window: dryLabel }
      );
    }

    if (wetRun || !dryRunLast) {
      const when = isNum(profile.firstWetHour) ? ` from ${hourLabel(profile.firstWetHour)}` : ' later today';
      return result(meta, 'bad', 'bad', 'Not ideal today', `Rain is expected${when}${wetLabel ? ` (${wetLabel})` : ''}.${windNote}`, {
        window: dryLabel,
      });
    }

    const dryHint = dryRun && dryRun.length > 0
      ? ` The shortest dry stretch is ${dryLabel}.`
      : ' Wet or unsettled conditions are expected throughout.';

    return result(meta, 'none', 'warn', 'Not ideal today', `Dry spells are too short to be worth it.${dryHint}`, {
      window: dryLabel,
    });
  }

  // ==========================================================================
  // 4. "Good weather for cycling?"
  // ==========================================================================
  function getCyclingAdvice(profile) {
    const meta = ADVICE_META.cycling;
    if (!profile || !profile.ok) return notEnoughData(meta, 'No usable hourly forecast is available.');

    const format = profile.format;
    const C = THRESHOLDS.cycling;
    const R = THRESHOLDS.rain;

    // Daylight hours describe the hours a ride would actually happen in.
    const daylight = profile.list.filter((hour) => hour.isDay === true);
    const hours = daylight.length ? daylight : profile.list;

    const maxWind = maxOf(hours.map((hour) => hour.windKmh));
    const peakChance = maxOf(hours.map((hour) => hour.chance));
    const peakMm = maxOf(hours.map((hour) => hour.mm));
    const peakTemp = maxOf(hours.map((hour) => hour.comfortTempC));
    const minTemp = minOf(hours.map((hour) => hour.comfortTempC));
    const windHour = isNum(maxWind)
      ? hours.find((hour) => hour.windKmh === maxWind) || null
      : null;
    const rainHour = isNum(peakChance)
      ? hours.find((hour) => hour.chance === peakChance) || null
      : null;

    const darkNote = daylight.length === 0 && profile.list.some((hour) => hour.isDay === false)
      ? ' Most of the remaining forecast window is after dark.'
      : '';

    if (isNum(maxWind) && maxWind >= C.strongWindKmh) {
      const when = windHour && isNum(windHour.hour) ? ` around ${hourLabel(windHour.hour)}` : '';
      return result(meta, 'wind', 'bad', 'Not ideal for cycling', `Strong winds of about ${windText(format, maxWind)}${when} are expected.${darkNote}`);
    }

    if ((isNum(peakChance) && peakChance >= R.activityRainChance) || (isNum(peakMm) && peakMm >= R.activityRainMm)) {
      const when = rainHour && isNum(rainHour.hour) ? ` around ${hourLabel(rainHour.hour)}` : '';
      const amount = isNum(peakChance)
        ? `Rain probability reaches ${Math.round(peakChance)}%${when}.`
        : `Rain is forecast${when} (${precipText(format, peakMm)}/h).`;
      return result(meta, 'rain', 'bad', 'Not ideal for cycling', `${amount}${darkNote}`);
    }

    if (isNum(minTemp) && minTemp < C.tempMinC) {
      return result(meta, 'cold', 'warn', 'Not ideal for cycling', `Very cold for riding - around ${tempText(format, minTemp)}.${darkNote}`);
    }
    if (isNum(peakTemp) && peakTemp > C.tempMaxC) {
      return result(meta, 'hot', 'warn', 'Not ideal for cycling', `Very warm for riding - up to ${tempText(format, peakTemp)}.${darkNote}`);
    }

    const breezeNote = isNum(maxWind) && maxWind >= C.noticeableWindKmh
      ? ` Moderately breezy, up to ${windText(format, maxWind)}.`
      : '';
    const temps = tempRangeText(format, minTemp, peakTemp);

    return result(meta, 'good', 'good', 'Good for cycling', `${temps ? `${temps}, ` : ''}dry and relatively light winds.${breezeNote}${darkNote}`);
  }

  // ==========================================================================
  // 5. "Good weather for swimming?" (general outdoor swimming)
  // --------------------------------------------------------------------------
  // Open-Meteo's weather forecast carries no water temperature, so nothing here
  // comments on the water - only air temperature, rain, cloud, wind and light.
  // ==========================================================================
  function getSwimmingAdvice(profile) {
    const meta = ADVICE_META.swimming;
    if (!profile || !profile.ok) return notEnoughData(meta, 'No usable hourly temperatures are available.');

    const format = profile.format;
    const S = THRESHOLDS.swimming;

    const daylight = profile.list.filter((hour) => hour.isDay === true);
    const hours = daylight.length ? daylight : profile.list;

    const peakTemp = maxOf(hours.map((hour) => hour.comfortTempC));
    const minTemp = minOf(hours.map((hour) => hour.comfortTempC));
    const peakChance = maxOf(hours.map((hour) => hour.chance));
    const peakMm = maxOf(hours.map((hour) => hour.mm));
    const maxWind = maxOf(hours.map((hour) => hour.windKmh));
    const rainHour = isNum(peakChance)
      ? hours.find((hour) => hour.chance === peakChance) || null
      : null;

    if ((isNum(peakChance) && peakChance >= S.maxRainChance) || (isNum(peakMm) && peakMm >= S.maxRainMm)) {
      const when = rainHour && isNum(rainHour.hour) ? ` around ${hourLabel(rainHour.hour)}` : '';
      const amount = isNum(peakChance)
        ? `Rain probability reaches ${Math.round(peakChance)}%${when}.`
        : `Rain is forecast${when}.`;
      return result(meta, 'rain', 'bad', 'Not ideal today', `${amount} Best to stay out of the water.`);
    }

    if (!isNum(peakTemp)) {
      return notEnoughData(meta, 'No hourly air temperature is available for the daylight hours.');
    }

    if (peakTemp < S.minAirC) {
      return result(meta, 'cold', 'warn', 'Not ideal today', `Cool for outdoor swimming - air around ${tempText(format, peakTemp)} at best.`);
    }
    if (peakTemp >= S.hotAirC) {
      return result(meta, 'hot', 'warn', 'Not ideal today', `Very warm air, up to ${tempText(format, peakTemp)}. Stay in the shade between sessions.`);
    }

    const notes = [];
    if (isNum(maxWind) && maxWind >= S.maxWindKmh) notes.push(`breezy (${windText(format, maxWind)})`);
    if (isNum(profile.maxCloud) && profile.maxCloud >= S.overcastCloud) notes.push('mostly overcast');
    if (isNum(minTemp) && minTemp < S.minAirC - 6) notes.push(`cooler early (${tempText(format, minTemp)})`);
    const suffix = notes.length ? ` Expect ${notes.join(', ')}.` : '';

    return result(
      meta,
      'good',
      'good',
      'Good outdoor swimming weather',
      `Warm and mostly dry, around ${tempText(format, peakTemp)}${isNum(maxWind) ? ` with ${windDescriptor(maxWind)}` : ''}.${suffix}`
    );
  }

  // ==========================================================================
  // 6. "What should I wear?"
  // ==========================================================================
  function getClothingAdvice(profile) {
    const meta = ADVICE_META.clothing;
    if (!profile || !profile.ok) return notEnoughData(meta, 'No usable hourly temperatures are available.');

    const format = profile.format;
    const K = THRESHOLDS.clothing;

    // "Feels like" drives clothing decisions; fall back to plain temperature.
    const values = profile.apparentAvailable
      ? profile.list.map((hour) => hour.apparentC).filter(isNum)
      : profile.list.map((hour) => hour.tempC).filter(isNum);
    const peak = maxOf(values);
    const lowest = minOf(values);
    const rainExpected = profile.rainAvailable &&
      ((profile.peakChance !== null && profile.peakChance >= THRESHOLDS.rain.umbrellaChance) ||
        (isNum(profile.peakMm) && profile.peakMm >= THRESHOLDS.rain.meaningfulMm));
    const peakHour = isNum(peak)
      ? profile.list.find((hour) => (profile.apparentAvailable ? hour.apparentC : hour.tempC) === peak) || null
      : null;
    const lowHour = isNum(lowest)
      ? profile.list.find((hour) => (profile.apparentAvailable ? hour.apparentC : hour.tempC) === lowest) || null
      : null;

    // Time-of-day nuance: only worth a sentence on a real swing.
    const swingNote = isNum(peak) && isNum(lowest) && peak - lowest >= K.notableSwingC &&
      peakHour && lowHour && isNum(peakHour.hour) && isNum(lowHour.hour)
      ? ` Coolest near ${hourLabel(lowHour.hour)}, warmest near ${hourLabel(peakHour.hour)}.`
      : '';

    const windNote = isNum(profile.maxWindKmh) && profile.maxWindKmh >= K.breezyKmh
      ? ` Windy at times (${windText(format, profile.maxWindKmh)}).`
      : '';
    const uvNote = isNum(profile.uvMax) && profile.uvMax >= K.uvCaution
      ? ' Sun protection is advisable.'
      : '';

    if (!isNum(peak)) {
      return notEnoughData(meta, 'No hourly temperature is available for this period.');
    }

    if (peak >= 30) {
      return result(meta, 'hot', 'warn', 'Light clothing', `Warm - around ${tempText(format, peak)} in the warmest part of the day.${swingNote}${uvNote}`);
    }

    if (rainExpected && peak < K.lightJacketC) {
      return result(meta, 'cold-rain', 'bad', 'Warm jacket + umbrella', `Cold and wet - around ${tempRangeText(format, lowest, peak)} with rain expected.${windNote}`);
    }

    if (peak >= K.tShirtC) {
      return result(
        meta,
        rainExpected ? 'warm-rain' : 't-shirt',
        rainExpected ? 'warn' : 'good',
        rainExpected ? 'T-shirt weather + umbrella' : 'T-shirt weather',
        rainExpected
          ? `Warm but showers are possible - around ${tempText(format, peak)}.${windNote}`
          : `Warm and dry${isNum(profile.maxWindKmh) && profile.maxWindKmh <= 12 ? ' with light winds' : ''}.${swingNote}${uvNote}`
      );
    }

    if (peak >= K.lightJacketC) {
      return result(meta, 'jacket', 'warn', 'Light jacket recommended', `Mild - around ${tempRangeText(format, lowest, peak)}.${swingNote}${windNote}`);
    }

    if (peak >= K.warmJacketC) {
      return result(meta, 'warm-jacket', 'warn', 'Warm jacket recommended', `Cool - around ${tempRangeText(format, lowest, peak)}.${windNote}`);
    }

    if (peak >= K.coatC) {
      return result(meta, 'coat', 'bad', 'Winter coat recommended', `Cold, around ${tempRangeText(format, lowest, peak)}.${windNote}`);
    }

    return result(meta, 'freezing', 'bad', 'Very warm layers needed', `Sub-zero, around ${tempRangeText(format, lowest, peak)}.${windNote}`);
  }

  // ==========================================================================
  // 7. "Rain during your ...?"
  // ==========================================================================
  function getRainWindowAdvice(profile, windowKey) {
    const windowDef = RAIN_WINDOWS.find((entry) => entry.key === windowKey) || RAIN_WINDOWS[0];

    if (!profile || !profile.ok) {
      return {
        ok: false,
        window: windowDef.key,
        verdict: 'unknown',
        tone: 'unknown',
        icon: '🌧️',
        headline: 'Not enough forecast data',
        detail: 'This answer needs hourly precipitation data that is not available right now.',
      };
    }
    if (!profile.rainAvailable) {
      return {
        ok: false,
        window: windowDef.key,
        verdict: 'unknown',
        tone: 'unknown',
        icon: '🌧️',
        headline: 'Not enough forecast data',
        detail: 'This city has no precipitation probability or amount in the forecast.',
      };
    }

    const range = `${rangeLabel(windowDef.start, windowDef.end)}`;
    const inWindow = profile.list.filter(
      (hour) => isNum(hour.hour) && hour.hour >= windowDef.start && hour.hour <= windowDef.end
    );

    if (inWindow.length === 0) {
      return {
        ok: true,
        window: windowDef.key,
        verdict: 'unavailable',
        tone: 'unknown',
        icon: '🌧️',
        headline: `${capitalize(windowDef.phrase)} is not in today's forecast`,
        detail: `There are no remaining hours for ${range}.`,
      };
    }

    const peakChance = maxOf(inWindow.map((hour) => hour.chance));
    const peakMm = maxOf(inWindow.map((hour) => hour.mm));
    const peakHour = isNum(peakChance)
      ? inWindow.find((hour) => hour.chance === peakChance) || null
      : null;
    const wetHour = inWindow.find((hour) => hour.group === 'rain' || hour.group === 'storm' || hour.group === 'snow');

    if ((isNum(peakChance) && peakChance >= THRESHOLDS.rain.wetChance) || wetHour) {
      const when = peakHour && isNum(peakHour.hour) ? ` around ${hourLabel(peakHour.hour)}` : '';
      const amount = isNum(peakChance)
        ? `Rain probability reaches ${Math.round(peakChance)}%${when}.`
        : 'Rain is forecast during this period.';
      return {
        ok: true,
        window: windowDef.key,
        verdict: 'likely',
        tone: 'bad',
        icon: '🌧️',
        headline: `Rain possible during ${windowDef.phrase}`,
        detail: amount,
      };
    }

    if ((isNum(peakChance) && peakChance >= THRESHOLDS.rain.dryChance) ||
        (isNum(peakMm) && peakMm >= THRESHOLDS.rain.wetMm)) {
      const when = peakHour && isNum(peakHour.hour) ? ` around ${hourLabel(peakHour.hour)}` : '';
      const amount = isNum(peakChance)
        ? `Rain probability peaks at ${Math.round(peakChance)}%${when}.`
        : 'Light precipitation is possible during this period.';
      return {
        ok: true,
        window: windowDef.key,
        verdict: 'possible',
        tone: 'warn',
        icon: '🌦️',
        headline: `A shower is possible during ${windowDef.phrase}`,
        detail: amount,
      };
    }

    const peakText = peakChance === null ? '' : ` (peaks at ${Math.round(peakChance)}%)`;
    return {
      ok: true,
      window: windowDef.key,
      verdict: 'dry',
      tone: 'good',
      icon: '☀️',
      headline: `${capitalize(windowDef.phrase)} looks dry`,
      detail: `Low precipitation probability throughout ${range}${peakText}.`,
    };
  }

  // ==========================================================================
  // 8. Headline "Today's advice"
  // --------------------------------------------------------------------------
  // Derived from the recommendations already computed, so the headline can
  // never contradict the tiles below it.
  // ==========================================================================
  function partOfDay(hour) {
    if (!isNum(hour)) return 'day';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  function getDaySummary(profile, decisions) {
    const meta = { id: 'summary', icon: '⛅', label: "Today's advice" };

    if (!profile || !profile.ok) return notEnoughData(meta, 'No usable hourly forecast is available.');

    const format = profile.format;
    const S = THRESHOLDS.summary;
    const umbrella = decisions && decisions.umbrella;
    const firstWet = profile.firstWetHour;
    const firstHour = isNum(profile.list[0] && profile.list[0].hour) ? profile.list[0].hour : null;
    const drySoFar = !!(profile.dryRun && firstHour !== null && profile.dryRun.startHour === firstHour);

    if (profile.groups.includes('snow')) {
      const snowRun = profile.wetRun;
      return result(
        meta,
        'snow',
        'warn',
        'Snowy today',
        snowRun
          ? `Snow is forecast between ${rangeLabel(snowRun.startHour, snowRun.endHour)}. Allow extra travel time.`
          : 'Snow is forecast today. Allow extra travel time.'
      );
    }

    if (profile.groups.includes('storm')) {
      return result(meta, 'storm', 'warn', 'Thunderstorms expected', 'Thunderstorms are forecast today - outdoor plans may be interrupted.');
    }

    if (umbrella && umbrella.verdict === 'definitely') {
      return result(meta, umbrella.verdict, umbrella.tone, 'Take an umbrella today', umbrella.detail);
    }

    if (umbrella && umbrella.verdict === 'likely') {
      // Dry right now but wet later is the most actionable phrasing there is.
      if (drySoFar && isNum(firstWet) && firstWet > firstHour + 1) {
        return result(
          meta,
          'wet-later',
          'warn',
          `Wet ${partOfDay(firstWet)} ahead`,
          `Rain is expected later today - consider outdoor activities before ${hourLabel(firstWet)}.`
        );
      }
      return result(meta, umbrella.verdict, umbrella.tone, 'Take an umbrella today', umbrella.detail);
    }

    if (isNum(profile.comfortMaxC) && profile.comfortMaxC <= S.coldC) {
      return result(
        meta,
        'cold',
        'warn',
        'Cold today',
        `Temperatures stay around ${tempText(format, profile.comfortMaxC)} through ${profile.scopePhrase}. A warm jacket is recommended.`
      );
    }

    if (isNum(profile.comfortMaxC) && profile.comfortMaxC >= S.hotC) {
      return result(
        meta,
        'hot',
        'warn',
        'Hot today',
        `Temperatures reach ${tempText(format, profile.comfortMaxC)} in ${profile.scopePhrase}. Light clothing and sun protection help.`
      );
    }

    // Dry and comfortable all through => the "go outside" headline.
    const pleasant =
      isNum(profile.comfortMaxC) &&
      isNum(profile.comfortMinC) &&
      profile.comfortMinC >= S.pleasantMinC &&
      profile.comfortMaxC <= S.pleasantMaxC &&
      (!profile.chanceAvailable || profile.peakChance < S.pleasantRainChance) &&
      (!profile.windAvailable || profile.maxWindKmh <= S.pleasantMaxWindKmh);

    if (pleasant) {
      const range = tempRangeText(format, profile.comfortMinC, profile.comfortMaxC);
      return result(
        meta,
        'nice',
        'good',
        'Great day to be outside',
        `Mostly dry with comfortable temperatures${range ? ` (${range})` : ''}.`
      );
    }

    if (profile.wetHours > 0) {
      const when = isNum(firstWet) ? ` from ${hourLabel(firstWet)}` : '';
      return result(meta, 'mixed', 'warn', 'Mixed conditions today', `Unsettled spells are likely${when} during ${profile.scopePhrase}.`);
    }

    return result(
      meta,
      'cloudy',
      'neutral',
      'Cloudy but dry today',
      `No rain is forecast; around ${tempRangeText(format, profile.comfortMinC, profile.comfortMaxC)} with ${windDescriptor(profile.maxWindKmh) || 'variable winds'}.`
    );
  }

  // ==========================================================================
  // Public entry point
  // ==========================================================================

  /** Which getter produces which decision tile. */
  const BUILDERS = {
    umbrella: getUmbrellaAdvice,
    walk: getBestWalkWindow,
    carWash: getCarWashAdvice,
    cycling: getCyclingAdvice,
    swimming: getSwimmingAdvice,
    clothing: getClothingAdvice,
  };

  /**
   * Compute everything the assistant shows from one context object:
   *
   *   {
   *     hourly,        // the Open-Meteo hourly payload already in memory
   *     currentTime,   // local "now" for the city, e.g. "2026-10-02T14:30"
   *     uvMax,         // optional daily uv_index_max for sun-protection wording
   *     rainWindowKey, // optional RAIN_WINDOWS key for the time-window answer
   *     format         // app.js formatters: { temp, tempSymbol, wind, ... }
   *   }
   *
   * Each recommendation is isolated, so a failure degrades to its own
   * "Not enough forecast data" tile instead of taking the section down.
   */
  function getAdviceBundle(ctx) {
    const bundle = {
      ok: false,
      scope: null,
      summary: null,
      decisions: {},
      order: ADVICE_ORDER.slice(),
      rainWindow: null,
    };

    let profile = null;
    try {
      profile = analyze(ctx);
    } catch (err) {
      // A malformed or hostile payload must degrade the whole section, not
      // break the dashboard: every tile falls back to its empty state.
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('WeatherScope advice: the forecast could not be analysed', err);
      }
      profile = null;
    }

    const built = getRecommendations(profile, ctx && ctx.rainWindowKey);
    bundle.decisions = built.decisions;
    bundle.rainWindow = built.rainWindow;
    bundle.summary = built.summary;
    bundle.ok = !!(profile && profile.ok);
    bundle.scope = profile ? profile.scope : null;
    return bundle;
  }

  /**
   * Build every recommendation from an already-analysed profile.
   *
   * Split out from `getAdviceBundle` so a UI that caches the profile (the
   * dashboard does, keyed on the hourly payload) can rebuild the tiles and the
   * time-window answer without paying for the analysis twice.
   *
   * @param {object} profile    result of `analyze()` - may be null
   * @param {string} [windowKey] "morning" | "midday" | "afternoon" | "evening"
   * @returns {{decisions: object, summary: object, rainWindow: object, order: string[]}}
   */
  function getRecommendations(profile, windowKey) {
    const decisions = {};
    const order = ADVICE_ORDER.slice();

    ADVICE_ORDER.forEach((key) => {
      const builder = BUILDERS[key];
      try {
        decisions[key] = builder ? builder(profile) : notEnoughData(ADVICE_META[key]);
      } catch (err) {
        // Never let one recommendation break the rest of the dashboard.
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`WeatherScope advice: "${key}" could not be calculated`, err);
        }
        decisions[key] = notEnoughData(ADVICE_META[key], 'This recommendation could not be calculated from the current forecast.');
      }
    });

    let rainWindow;
    try {
      rainWindow = getRainWindowAdvice(profile, windowKey || RAIN_WINDOWS[0].key);
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('WeatherScope advice: the time-window answer could not be calculated', err);
      }
      rainWindow = getRainWindowAdvice(null, windowKey || RAIN_WINDOWS[0].key);
    }

    let summary;
    try {
      summary = getDaySummary(profile, decisions);
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('WeatherScope advice: the daily summary could not be calculated', err);
      }
      summary = notEnoughData(
        { id: 'summary', icon: '⛅', label: "Today's advice" },
        'This summary could not be calculated from the current forecast.'
      );
    }

    return { decisions, summary, rainWindow, order };
  }

  return {
    THRESHOLDS,
    RAIN_WINDOWS,
    ADVICE_META,
    ADVICE_ORDER,
    getAdviceBundle,
    getRecommendations,
    analyze,
    getUmbrellaAdvice,
    getBestWalkWindow,
    getCarWashAdvice,
    getCyclingAdvice,
    getSwimmingAdvice,
    getClothingAdvice,
    getRainWindowAdvice,
    getDaySummary,
    // Exposed for tests / reuse of the small text helpers.
    utils: { tempText, tempRangeText, windText, precipText, rangeLabel, hourLabel },
  };
});
