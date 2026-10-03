/**
 * WeatherScope
 * Real-time meteorological dashboard & Global Climate Discovery Engine
 * Powered by Open-Meteo API
 */

(function () {
  'use strict';

  // ==========================================================================
  // Translation helper
  // --------------------------------------------------------------------------
  // The browser always has i18n.js loaded before this file, but the pure-engine
  // unit tests boot app.js on its own, so `window.I18n` may legitimately be
  // absent. Every call therefore carries its own English literal: the active
  // language wins when it is available, and the authored English string is the
  // fallback otherwise. That keeps the engines and their tests deterministic
  // while the browser renders whatever the visitor picked.
  // ==========================================================================
  const INTERPOLATION = /\{(\w+)\}/g;

  function interpolate(template, vars) {
    if (typeof template !== 'string' || !vars) return template;
    return template.replace(INTERPOLATION, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
    );
  }

  function t(key, vars, englishFallback) {
    if (window.I18n && typeof window.I18n.t === 'function') {
      const translated = window.I18n.t(key, vars);
      // i18n.t returns the key itself when it has no entry, which is the signal
      // to fall back to the English literal this call site already carries.
      if (translated && translated !== key) return translated;
    }
    const source = englishFallback === undefined ? key : englishFallback;
    return interpolate(source, vars);
  }

  /** Pick between a singular/plural pair of dictionary keys. */
  function tp(oneKey, manyKey, count, vars, englishOne, englishMany) {
    const key = count === 1 ? oneKey : manyKey;
    const fallback = count === 1 ? englishOne : englishMany;
    return t(key, Object.assign({ count }, vars), fallback);
  }

  /** A condition label for a WMO code in the active language. */
  function conditionText(code) {
    if (window.I18n && typeof window.I18n.conditionLabel === 'function') {
      const label = window.I18n.conditionLabel(code);
      if (label) return label;
    }
    const info = WMO_MAP[code];
    return (info && info.label) || t('wmo.unknown', null, 'Clear');
  }

  // ==========================================================================
  // Curated Global Cities Database for Climate Searches (Diverse Climates)
  // ==========================================================================
  const WORLD_CITIES = [
    // Europe
    { id: 'london', name: 'London', admin1: 'England', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
    { id: 'paris', name: 'Paris', admin1: 'Île-de-France', country: 'France', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
    { id: 'rome', name: 'Rome', admin1: 'Lazio', country: 'Italy', latitude: 41.9028, longitude: 12.4964, timezone: 'Europe/Rome' },
    { id: 'madrid', name: 'Madrid', admin1: 'Community of Madrid', country: 'Spain', latitude: 40.4168, longitude: -3.7038, timezone: 'Europe/Madrid' },
    { id: 'barcelona', name: 'Barcelona', admin1: 'Catalonia', country: 'Spain', latitude: 41.3879, longitude: 2.1699, timezone: 'Europe/Madrid' },
    { id: 'berlin', name: 'Berlin', admin1: 'Berlin', country: 'Germany', latitude: 52.5200, longitude: 13.4050, timezone: 'Europe/Berlin' },
    { id: 'amsterdam', name: 'Amsterdam', admin1: 'North Holland', country: 'Netherlands', latitude: 52.3676, longitude: 4.9041, timezone: 'Europe/Amsterdam' },
    { id: 'vienna', name: 'Vienna', admin1: 'Vienna', country: 'Austria', latitude: 48.2082, longitude: 16.3738, timezone: 'Europe/Vienna' },
    { id: 'athens', name: 'Athens', admin1: 'Attica', country: 'Greece', latitude: 37.9838, longitude: 23.7275, timezone: 'Europe/Athens' },
    { id: 'lisbon', name: 'Lisbon', admin1: 'Lisbon', country: 'Portugal', latitude: 38.7223, longitude: -9.1393, timezone: 'Europe/Lisbon' },
    { id: 'dublin', name: 'Dublin', admin1: 'Leinster', country: 'Ireland', latitude: 53.3498, longitude: -6.2603, timezone: 'Europe/Dublin' },
    { id: 'stockholm', name: 'Stockholm', admin1: 'Stockholm', country: 'Sweden', latitude: 59.3293, longitude: 18.0686, timezone: 'Europe/Stockholm' },
    { id: 'oslo', name: 'Oslo', admin1: 'Oslo', country: 'Norway', latitude: 59.9139, longitude: 10.7522, timezone: 'Europe/Oslo' },
    { id: 'copenhagen', name: 'Copenhagen', admin1: 'Capital Region', country: 'Denmark', latitude: 55.6761, longitude: 12.5683, timezone: 'Europe/Copenhagen' },
    { id: 'helsinki', name: 'Helsinki', admin1: 'Uusimaa', country: 'Finland', latitude: 60.1699, longitude: 24.9384, timezone: 'Europe/Helsinki' },
    { id: 'zurich', name: 'Zurich', admin1: 'Zurich', country: 'Switzerland', latitude: 47.3769, longitude: 8.5417, timezone: 'Europe/Zurich' },
    { id: 'prague', name: 'Prague', admin1: 'Prague', country: 'Czechia', latitude: 50.0755, longitude: 14.4378, timezone: 'Europe/Prague' },
    { id: 'budapest', name: 'Budapest', admin1: 'Budapest', country: 'Hungary', latitude: 47.4979, longitude: 19.0402, timezone: 'Europe/Budapest' },
    { id: 'warsaw', name: 'Warsaw', admin1: 'Mazovia', country: 'Poland', latitude: 52.2297, longitude: 21.0122, timezone: 'Europe/Warsaw' },
    { id: 'reykjavik', name: 'Reykjavik', admin1: 'Capital Region', country: 'Iceland', latitude: 64.1466, longitude: -21.9426, timezone: 'Atlantic/Reykjavik' },
    { id: 'istanbul', name: 'Istanbul', admin1: 'Istanbul', country: 'Turkey', latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul' },

    // North America
    { id: 'new-york', name: 'New York', admin1: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York' },
    { id: 'los-angeles', name: 'Los Angeles', admin1: 'California', country: 'United States', latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles' },
    { id: 'chicago', name: 'Chicago', admin1: 'Illinois', country: 'United States', latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago' },
    { id: 'miami', name: 'Miami', admin1: 'Florida', country: 'United States', latitude: 25.7617, longitude: -80.1918, timezone: 'America/New_York' },
    { id: 'san-francisco', name: 'San Francisco', admin1: 'California', country: 'United States', latitude: 37.7749, longitude: -122.4194, timezone: 'America/Los_Angeles' },
    { id: 'seattle', name: 'Seattle', admin1: 'Washington', country: 'United States', latitude: 47.6062, longitude: -122.3321, timezone: 'America/Los_Angeles' },
    { id: 'las-vegas', name: 'Las Vegas', admin1: 'Nevada', country: 'United States', latitude: 36.1699, longitude: -115.1398, timezone: 'America/Los_Angeles' },
    { id: 'denver', name: 'Denver', admin1: 'Colorado', country: 'United States', latitude: 39.7392, longitude: -104.9903, timezone: 'America/Denver' },
    { id: 'boston', name: 'Boston', admin1: 'Massachusetts', country: 'United States', latitude: 42.3601, longitude: -71.0589, timezone: 'America/New_York' },
    { id: 'honolulu', name: 'Honolulu', admin1: 'Hawaii', country: 'United States', latitude: 21.3069, longitude: -157.8583, timezone: 'Pacific/Honolulu' },
    { id: 'anchorage', name: 'Anchorage', admin1: 'Alaska', country: 'United States', latitude: 61.2181, longitude: -149.9003, timezone: 'America/Anchorage' },
    { id: 'toronto', name: 'Toronto', admin1: 'Ontario', country: 'Canada', latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto' },
    { id: 'vancouver', name: 'Vancouver', admin1: 'British Columbia', country: 'Canada', latitude: 49.2827, longitude: -123.1207, timezone: 'America/Vancouver' },
    { id: 'montreal', name: 'Montreal', admin1: 'Quebec', country: 'Canada', latitude: 45.5017, longitude: -73.5673, timezone: 'America/Toronto' },
    { id: 'mexico-city', name: 'Mexico City', admin1: 'Federal District', country: 'Mexico', latitude: 19.4326, longitude: -99.1332, timezone: 'America/Mexico_City' },
    { id: 'cancun', name: 'Cancún', admin1: 'Quintana Roo', country: 'Mexico', latitude: 21.1619, longitude: -86.8515, timezone: 'America/Cancun' },

    // South America
    { id: 'rio-de-janeiro', name: 'Rio de Janeiro', admin1: 'Rio de Janeiro', country: 'Brazil', latitude: -22.9068, longitude: -43.1729, timezone: 'America/Sao_Paulo' },
    { id: 'sao-paulo', name: 'São Paulo', admin1: 'São Paulo', country: 'Brazil', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo' },
    { id: 'buenos-aires', name: 'Buenos Aires', admin1: 'Buenos Aires', country: 'Argentina', latitude: -34.6037, longitude: -58.3816, timezone: 'America/Argentina/Buenos_Aires' },
    { id: 'santiago', name: 'Santiago', admin1: 'Santiago Metropolitan', country: 'Chile', latitude: -33.4489, longitude: -70.6693, timezone: 'America/Santiago' },
    { id: 'lima', name: 'Lima', admin1: 'Lima', country: 'Peru', latitude: -12.0464, longitude: -77.0428, timezone: 'America/Lima' },
    { id: 'bogota', name: 'Bogotá', admin1: 'Bogotá D.C.', country: 'Colombia', latitude: 4.7110, longitude: -74.0721, timezone: 'America/Bogota' },
    { id: 'cusco', name: 'Cusco', admin1: 'Cusco', country: 'Peru', latitude: -13.5319, longitude: -71.9675, timezone: 'America/Lima' },

    // Asia
    { id: 'tokyo', name: 'Tokyo', admin1: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo' },
    { id: 'kyoto', name: 'Kyoto', admin1: 'Kyoto', country: 'Japan', latitude: 35.0116, longitude: 135.7681, timezone: 'Asia/Tokyo' },
    { id: 'seoul', name: 'Seoul', admin1: 'Seoul', country: 'South Korea', latitude: 37.5665, longitude: 126.9780, timezone: 'Asia/Seoul' },
    { id: 'beijing', name: 'Beijing', admin1: 'Beijing', country: 'China', latitude: 39.9042, longitude: 116.4074, timezone: 'Asia/Shanghai' },
    { id: 'shanghai', name: 'Shanghai', admin1: 'Shanghai', country: 'China', latitude: 31.2304, longitude: 121.4737, timezone: 'Asia/Shanghai' },
    { id: 'hong-kong', name: 'Hong Kong', admin1: 'Hong Kong', country: 'Hong Kong', latitude: 22.3193, longitude: 114.1694, timezone: 'Asia/Hong_Kong' },
    { id: 'taipei', name: 'Taipei', admin1: 'Taipei', country: 'Taiwan', latitude: 25.0330, longitude: 121.5654, timezone: 'Asia/Taipei' },
    { id: 'singapore', name: 'Singapore', admin1: 'Central Singapore', country: 'Singapore', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore' },
    { id: 'bangkok', name: 'Bangkok', admin1: 'Bangkok', country: 'Thailand', latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok' },
    { id: 'bali', name: 'Bali (Denpasar)', admin1: 'Bali', country: 'Indonesia', latitude: -8.6705, longitude: 115.2126, timezone: 'Asia/Makassar' },
    { id: 'kuala-lumpur', name: 'Kuala Lumpur', admin1: 'Federal Territory', country: 'Malaysia', latitude: 3.1390, longitude: 101.6869, timezone: 'Asia/Kuala_Lumpur' },
    { id: 'mumbai', name: 'Mumbai', admin1: 'Maharashtra', country: 'India', latitude: 19.0760, longitude: 72.8777, timezone: 'Asia/Kolkata' },
    { id: 'new-delhi', name: 'New Delhi', admin1: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.2090, timezone: 'Asia/Kolkata' },
    { id: 'dubai', name: 'Dubai', admin1: 'Dubai', country: 'United Arab Emirates', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
    { id: 'riyadh', name: 'Riyadh', admin1: 'Riyadh', country: 'Saudi Arabia', latitude: 24.7136, longitude: 46.6753, timezone: 'Asia/Riyadh' },

    // Africa
    { id: 'cairo', name: 'Cairo', admin1: 'Cairo', country: 'Egypt', latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo' },
    { id: 'cape-town', name: 'Cape Town', admin1: 'Western Cape', country: 'South Africa', latitude: -33.9249, longitude: 18.4241, timezone: 'Africa/Johannesburg' },
    { id: 'johannesburg', name: 'Johannesburg', admin1: 'Gauteng', country: 'South Africa', latitude: -26.2041, longitude: 28.0473, timezone: 'Africa/Johannesburg' },
    { id: 'nairobi', name: 'Nairobi', admin1: 'Nairobi', country: 'Kenya', latitude: -1.2921, longitude: 36.8219, timezone: 'Africa/Nairobi' },
    { id: 'marrakech', name: 'Marrakech', admin1: 'Marrakesh-Safi', country: 'Morocco', latitude: 31.6295, longitude: -7.9811, timezone: 'Africa/Casablanca' },
    { id: 'casablanca', name: 'Casablanca', admin1: 'Casablanca-Settat', country: 'Morocco', latitude: 33.5731, longitude: -7.5898, timezone: 'Africa/Casablanca' },

    // Oceania
    { id: 'sydney', name: 'Sydney', admin1: 'New South Wales', country: 'Australia', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
    { id: 'melbourne', name: 'Melbourne', admin1: 'Victoria', country: 'Australia', latitude: -37.8136, longitude: 144.9631, timezone: 'Australia/Melbourne' },
    { id: 'brisbane', name: 'Brisbane', admin1: 'Queensland', country: 'Australia', latitude: -27.4698, longitude: 153.0251, timezone: 'Australia/Brisbane' },
    { id: 'perth', name: 'Perth', admin1: 'Western Australia', country: 'Australia', latitude: -31.9505, longitude: 115.8605, timezone: 'Australia/Perth' },
    { id: 'auckland', name: 'Auckland', admin1: 'Auckland', country: 'New Zealand', latitude: -36.8485, longitude: 174.7633, timezone: 'Pacific/Auckland' },
    { id: 'queenstown', name: 'Queenstown', admin1: 'Otago', country: 'New Zealand', latitude: -45.0312, longitude: 168.6626, timezone: 'Pacific/Auckland' },
    { id: 'suva', name: 'Suva', admin1: 'Central Division', country: 'Fiji', latitude: -18.1416, longitude: 178.4419, timezone: 'Pacific/Fiji' },
  ];

  // ==========================================================================
  // Curated Climate Presets
  // --------------------------------------------------------------------------
  // A preset is a single `data-condition` value on its chip. Most map straight
  // to a keyword the parser already understands (`sunny`, `hot`, `windy`, ...).
  // The entries below are *combinations* that expand into several keywords so
  // one chip can express a whole "vibe" (e.g. Beach Day = clear skies AND warm).
  // Keeping the expansion declarative means the composite presets can never
  // drift out of sync with the individual ones.
  // ==========================================================================
  const CLIMATE_PRESET_EXPANSIONS = {
    beach: 'sunny warm',
    ski: 'snowy freezing',
    tropical: 'hot humid',
    breeze: 'mild windy',
    showers: 'rain mild',
  };

  // ==========================================================================
  // Persisted keys
  // --------------------------------------------------------------------------
  // The app used to be called SkyCast, and its keys carried that name. They are
  // now prefixed `weatherscope_`, but a visitor who already had a preferred unit
  // or a last city must not silently lose it to a rename - so the old keys are
  // moved across once, on first read, and only when the new key is still absent.
  // ==========================================================================
  const STORAGE_KEYS = {
    unit: 'weatherscope_unit',
    lastCity: 'weatherscope_last_city',
    globalCache: 'weatherscope_global_cache',
  };

  const LEGACY_STORAGE_KEYS = {
    unit: 'skycast_unit',
    lastCity: 'skycast_last_city',
    globalCache: 'skycast_global_cache',
  };

  /** Reads a key, adopting the pre-rename value on first sight of it. */
  function readStored(key, legacyKey) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      // Already on the new key, so the new value wins - but the legacy key is
      // still dropped, otherwise a stale copy would sit in storage forever.
      localStorage.removeItem(legacyKey);
      return value;
    }
    const legacy = localStorage.getItem(legacyKey);
    if (legacy === null) return null;
    localStorage.setItem(key, legacy);
    localStorage.removeItem(legacyKey);
    return legacy;
  }

  /** Writes a key, clearing the pre-rename one so it cannot come back to life. */
  function writeStored(key, legacyKey, value) {
    localStorage.setItem(key, value);
    localStorage.removeItem(legacyKey);
  }

  // ==========================================================================
  // State Management
  // ==========================================================================
  const state = {
    unit: readStored(STORAGE_KEYS.unit, LEGACY_STORAGE_KEYS.unit) || 'celsius', // 'celsius' or 'fahrenheit'
    searchMode: 'city', // 'city', 'compare' or 'climate'
    currentCity: null,
    weatherData: null,
    debounceTimer: null,
    globalWeatherData: null, // Array of { city, current }
    globalCacheTimestamp: 0,
    activeClimateQuery: '',
    activeFilterTags: [],
    matchingCities: [],
    resultCards: new Map(), // cityId -> { card, ...refs } for node reuse
    sortOrder: 'name-asc',
    // Race-condition guards
    autocompleteSeq: 0,
    autocompleteController: null,
    weatherController: null,
    // Active autocomplete options for keyboard navigation
    activeOptionIndex: -1,
    // Weather Assistant: the selected "Rain during your ...?" window and a
    // memo of the last bundle. The selection is deliberately session-only -
    // no personal routine is persisted to storage.
    adviceWindowKey: 'morning',
    adviceCache: null,
    // Compare Locations: the picked places (each `{ city, weather, error }`),
    // plus the guard that supersedes a stale comparison request.
    compareLocations: [],
    // Slot currently being re-picked, or null. Re-picking reuses the existing
    // search box rather than adding a second, parallel picker UI.
    compareReplaceIndex: null,
    compareSeq: 0,
    compareController: null,
    // The shared forecast this page was opened from, or null on an ordinary
    // visit. It is kept only while it still describes what is on screen: picking
    // another city drops it (see `loadCityWeather`).
    sharedPayload: null,
  };

  const THEME_CLASSES = [
    'theme-day-clear',
    'theme-night-clear',
    'theme-cloudy',
    'theme-rainy',
    'theme-thunderstorm',
    'theme-snowy',
  ];

  const GLOBAL_CACHE_TTL = 5 * 60 * 1000;
  const REQUEST_TIMEOUT = 12000;

  // ==========================================================================
  // Time Engine
  // --------------------------------------------------------------------------
  // One shared ticker drives every clock on the page so N city clocks cost one
  // timer, not N. Design notes:
  //
  //  * Offsets come from Intl, not from arithmetic on the raw UTC clock, so DST
  //    transitions (including half-hour zones like Asia/Kolkata and zones that
  //    skip an hour) are always correct without a tz database of our own.
  //  * Each zone needs exactly one `formatToParts` call per tick; the wall-clock
  //    H:M:S is then plain arithmetic on the returned UTC offset. With 72 city
  //    cards ticking that is ~72 Intl calls/second, and Intl instances are
  //    cached per zone because constructing one is far more expensive than
  //    calling one.
  //  * The ticker re-arms on the next second boundary rather than every 1000ms,
  //    so the display cannot drift away from the real second.
  //  * Seconds are only rewritten when they actually change, which keeps the
  //    pulse animation from re-triggering on cards that are off-screen.
  // ==========================================================================
  const TICK_MS = 1000;

  /**
   * The visitor's own timezone. The browser derives this from the operating
   * system's locale data, which is the same timezone an IP geolocation lookup
   * would return for the connection - but it costs no network round-trip, needs
   * no third-party API key, and cannot rate-limit us.
   */
  const USER_TIME_ZONE = (() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Validate before trusting it: an unknown zone throws in formatToParts.
      if (detected) {
        new Intl.DateTimeFormat('en-US', { timeZone: detected }).format(new Date());
        return detected;
      }
    } catch (err) {
      console.warn('Timezone detection failed, falling back to UTC', err);
    }
    return 'UTC';
  })();

  /** Intl instances are expensive to build, so keep one per (zone, option set). */
  const formatterCache = new Map();

  function getFormatter(timeZone, options) {
    const key = `${timeZone}|${JSON.stringify(options)}`;
    let formatter = formatterCache.get(key);
    if (!formatter) {
      try {
        formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone });
      } catch (err) {
        // Unknown zone id: degrade to UTC rather than breaking the whole clock.
        formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
      }
      formatterCache.set(key, formatter);
    }
    return formatter;
  }

  /**
   * Minutes to add to UTC for `timeZone` at `date` (e.g. 330 for Asia/Kolkata,
   * -300 for America/New_York in summer).
   */
  function getZoneOffsetMinutes(timeZone, date) {
    const parts = getFormatter(timeZone, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    let year = 0;
    let month = 1;
    let day = 1;
    let hour = 0;
    let minute = 0;
    let second = 0;

    parts.forEach((part) => {
      if (part.type === 'year') year = +part.value;
      else if (part.type === 'month') month = +part.value;
      else if (part.type === 'day') day = +part.value;
      else if (part.type === 'hour') hour = +part.value;
      else if (part.type === 'minute') minute = +part.value;
      else if (part.type === 'second') second = +part.value;
    });

    // Some engines render midnight as hour "24" in hourCycle h23 formats.
    const wall = Date.UTC(year, month - 1, day, hour % 24, minute, second);
    return Math.round((wall - date.getTime()) / 60000);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  /** Wall-clock fields for a zone, derived arithmetically from its offset. */
  function getZonedParts(timeZone, date) {
    const offsetMinutes = getZoneOffsetMinutes(timeZone, date);
    const shifted = new Date(date.getTime() + offsetMinutes * 60000);
    return {
      offsetMinutes,
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
    };
  }

  /** "14:05:09" */
  function formatClock(timeZone, date) {
    const parts = getZonedParts(timeZone, date);
    return `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
  }

  /** "Saturday, Sep 26" */
  function formatZonedDate(timeZone, date) {
    return getFormatter(timeZone, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  /** Short zone label such as "GMT+2" or "PDT". */
  function getZoneAbbreviation(timeZone, date) {
    const parts = getFormatter(timeZone, {
      timeZoneName: 'short',
      hour: 'numeric',
    }).formatToParts(date);

    const zonePart = parts.find((part) => part.type === 'timeZoneName');
    return zonePart ? zonePart.value : timeZone;
  }

  /** "UTC offset" like "UTC+02:00" / "UTC-05:30" - always sign-explicit. */
  function formatOffsetLabel(timeZone, date) {
    const offsetMinutes = getZoneOffsetMinutes(timeZone, date);
    const sign = offsetMinutes < 0 ? '-' : '+';
    const abs = Math.abs(offsetMinutes);
    return `UTC${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
  }

  /**
   * How far ahead/behind a city is relative to the visitor, in minutes.
   * Negative = city is behind the visitor.
   */
  function getOffsetDiffMinutes(timeZone, date) {
    return getZoneOffsetMinutes(timeZone, date) - getZoneOffsetMinutes(USER_TIME_ZONE, date);
  }

  /**
   * Human phrasing for the visitor-facing difference, e.g.
   * "Same time as you" / "5h 30m ahead of you" / "3h behind you".
   */
  function describeTimeDifference(timeZone, date) {
    const diff = getOffsetDiffMinutes(timeZone, date);
    if (diff === 0) return t('time.sameAsYou', null, 'Same time as you');

    const ahead = diff > 0;
    const abs = Math.abs(diff);
    const hours = Math.floor(abs / 60);
    const minutes = abs % 60;

    let magnitude;
    if (hours === 0) {
      magnitude = `${minutes}m`;
    } else if (minutes === 0) {
      magnitude = `${hours}h`;
    } else {
      magnitude = `${hours}h ${minutes}m`;
    }

    return ahead
      ? t('time.aheadOf', { value: magnitude }, `${magnitude} ahead of you`)
      : t('time.behind', { value: magnitude }, `${magnitude} behind you`);
  }

  /** Compact form for tight spaces, e.g. "+5h30m" / "Same". */
  function formatOffsetDiffCompact(timeZone, date) {
    const diff = getOffsetDiffMinutes(timeZone, date);
    if (diff === 0) return t('time.sameAsYouShort', null, 'Same time');

    const sign = diff > 0 ? '+' : '-';
    const abs = Math.abs(diff);
    const hours = Math.floor(abs / 60);
    const minutes = abs % 60;

    if (hours === 0) return `${sign}${minutes}m`;
    if (minutes === 0) return `${sign}${hours}h`;
    return `${sign}${hours}h${minutes}m`;
  }

  /**
   * Registry of ticking clock elements. Each entry owns a timezone plus the
   * nodes it needs to refresh, so adding a clock surface anywhere in the app
   * means registering it here and nothing else.
   *
   * `isVisible` is a cheap, layout-free predicate evaluated once per clock per
   * tick. Layout probes (offsetParent / getClientRects) are deliberately avoided
   * here: they force a synchronous reflow, and with 72 city cards ticking that
   * would mean hundreds of reflows every second. The app already tracks which
   * view is on screen via its `.hidden` toggles, so those make the gate exact.
   */
  const clockRegistry = new Map();
  let clockRegistrySeq = 0;

  /**
   * Hide a node that rewrites itself every second from assistive technology.
   *
   * The dashboard, the climate grid and the search dropdown all sit inside
   * `<main aria-live="polite">`. Without this, each clock tick would be queued
   * as a live-region announcement - a screen reader would try to speak the city
   * clock sixty times a minute. So the per-second digits are hidden and the
   * meaningful, non-volatile facts (date, zone, offset from the visitor) are
   * carried by sibling text that changes at most once a day.
   */
  function hideVolatileNode(node) {
    if (node) node.setAttribute('aria-hidden', 'true');
    return node;
  }

  /**
   * Register a clock surface. `targets` maps node -> render(timeZone, now) so
   * each surface decides its own markup (hero, metric card, grid card, ...).
   */
  function registerClock(timeZone, targets, isVisible) {
    const id = ++clockRegistrySeq;
    clockRegistry.set(id, { timeZone, targets, isVisible });
    return id;
  }

  function unregisterClock(id) {
    clockRegistry.delete(id);
  }

  /** Re-run every registered clock against a single shared "now". */
  function tickClocks(now) {
    clockRegistry.forEach((clock) => {
      if (clock.isVisible && !clock.isVisible()) return;

      clock.targets.forEach((render, node) => {
        // A cached node can outlive its container (the climate grid keeps
        // evicted cards in a Map); a detached node has nothing to paint.
        if (!node.isConnected) return;
        render(clock.timeZone, now);
      });
    });
  }

  let clockTimer = null;

  function startClockTicker() {
    if (clockTimer !== null) return;

    const run = () => {
      // A backgrounded tab gets no rAF and its timers are throttled; skip the
      // work rather than batch up a burst of stale frames on return.
      if (document.hidden) {
        clockTimer = setTimeout(run, TICK_MS);
        return;
      }

      tickClocks(new Date());

      // Re-arm on the next second boundary: 1000ms intervals accumulate drift
      // and would eventually skip or repeat a second.
      const delay = TICK_MS - (Date.now() % TICK_MS);
      clockTimer = setTimeout(run, delay);
    };

    run();
  }

  /** Force an immediate repaint, e.g. right after a theme or unit switch. */
  function refreshClocks() {
    tickClocks(new Date());
  }

  /**
   * Register the persistent "your local time" clock in the header. It always
   * reads USER_TIME_ZONE, so it is registered exactly once at boot.
   */
  function registerUserClock() {
    if (userClockId !== null) return;

    if (elements.userClockZone) {
      elements.userClockZone.textContent = getZoneAbbreviation(USER_TIME_ZONE, new Date());
      elements.userClockZone.title = t('time.detectedZone', { zone: USER_TIME_ZONE }, `Detected timezone: ${USER_TIME_ZONE}`);
      elements.userClockZone.setAttribute('aria-label', t(
        'time.localTimeAria',
        { zone: USER_TIME_ZONE },
        `Your local time, detected from your timezone ${USER_TIME_ZONE}`
      ));
    }
    if (elements.footerUserZone) {
      elements.footerUserZone.textContent = USER_TIME_ZONE;
    }
    if (elements.footerTimezoneNote) {
      elements.footerTimezoneNote.textContent = t(
        'footer.timezoneNote',
        { zone: USER_TIME_ZONE },
        `Local times use each city's IANA timezone and tick in real time · Your reference time is detected from your device timezone (${USER_TIME_ZONE})`
      );
    }

    // The digits are hidden from AT (see hideVolatileNode), so name the control
    // with a stable label instead - it changes at most when the zone changes.
    if (elements.userClock) {
      const label = `Your local time, detected from your timezone ${USER_TIME_ZONE}`;
      elements.userClock.setAttribute('role', 'img');
      elements.userClock.setAttribute('aria-label', label);
      elements.userClock.setAttribute('title', label);
    }

    // The header clock is always on screen.
    userClockId = registerClock(USER_TIME_ZONE, new Map([
      [elements.userClockTime, (timeZone, now) => {
        elements.userClockTime.textContent = formatClock(timeZone, now);
      }],
    ]));
  }

  /**
   * Point every hero / metric / forecast-zone surface at a city's timezone.
   * Re-registering on each city load is what makes switching cities switch the
   * clocks, and unregistering first prevents stale renderers piling up.
   */
  function registerCityClocks(timeZone) {
    if (heroClockId !== null) unregisterClock(heroClockId);

    const targets = new Map();
    const add = (node, render) => {
      if (node) targets.set(node, render);
    };
    // Every node below that rewrites itself each second must be hidden from
    // assistive tech; the date / zone / offset siblings stay exposed because
    // they only change when the city or the calendar day changes.
    const addVolatile = (node, render) => {
      add(hideVolatileNode(node), render);
    };

    // --- Hero: big ticking clock, pulsing seconds, zone label, date, offset ---
    addVolatile(elements.cityClock, (zone, now) => {
      const parts = getZonedParts(zone, now);
      elements.cityClock.textContent = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
    });

    addVolatile(elements.cityClockSeconds, (zone, now) => {
      const parts = getZonedParts(zone, now);
      const seconds = pad2(parts.second);
      if (elements.cityClockSeconds.textContent === seconds) return;
      elements.cityClockSeconds.textContent = seconds;
      // Restart the pulse so the digit visibly ticks.
      elements.cityClockSeconds.classList.remove('tick');
      void elements.cityClockSeconds.offsetWidth;
      elements.cityClockSeconds.classList.add('tick');
    });

    add(elements.cityClockZone, (zone, now) => {
      const label = getZoneAbbreviation(zone, now);
      if (elements.cityClockZone.textContent === label) return;
      elements.cityClockZone.textContent = label;
      elements.cityClockZone.title = `${zone} - ${formatOffsetLabel(zone, now)}`;
    });

    add(elements.localTimeDate, (zone, now) => {
      const label = formatZonedDate(zone, now);
      if (elements.localTimeDate.textContent === label) return;
      elements.localTimeDate.textContent = label;
    });

    add(elements.cityTimeDiff, (zone, now) => {
      const label = describeTimeDifference(zone, now);
      if (elements.cityTimeDiff.textContent === label) return;
      elements.cityTimeDiff.textContent = label;
      // Compare the offset itself rather than the rendered label, which is
      // now written in the active language.
      elements.cityTimeDiff.classList.toggle('is-same', getOffsetDiffMinutes(zone, now) === 0);
    });

    // --- Current Conditions metric card: clock, date, offset, your clock ---
    addVolatile(elements.metricCityClock, (zone, now) => {
      elements.metricCityClock.textContent = formatClock(zone, now);
    });

    add(elements.metricCityDate, (zone, now) => {
      elements.metricCityDate.textContent = formatZonedDate(zone, now);
    });

    add(elements.metricCityOffset, (zone, now) => {
      const label = `${formatOffsetDiffCompact(zone, now)} · ${formatOffsetLabel(zone, now)}`;
      if (elements.metricCityOffset.textContent === label) return;
      elements.metricCityOffset.textContent = label;
      elements.metricCityOffset.title = describeTimeDifference(zone, now);
      elements.metricCityOffset.classList.toggle('is-same', getOffsetDiffMinutes(zone, now) === 0);
    });

    addVolatile(elements.metricUserTime, (zone, now) => {
      const clock = formatClock(USER_TIME_ZONE, now);
      elements.metricUserTime.textContent = t('time.youClock', { time: clock }, `You ${clock}`);
      elements.metricUserTime.title = t('time.yourZoneTitle', { zone: USER_TIME_ZONE }, `Your timezone: ${USER_TIME_ZONE}`);
    });

    // --- Forecast headers: remind the reader which clock the hours refer to ---
    add(elements.hourlyTzLabel, (zone, now) => {
      elements.hourlyTzLabel.textContent = getZoneAbbreviation(zone, now);
      elements.hourlyTzLabel.title = t('time.allTimesIn', { zone }, `All times in ${zone}`);
    });

    add(elements.dailyTzLabel, (zone, now) => {
      elements.dailyTzLabel.textContent = getZoneAbbreviation(zone, now);
      elements.dailyTzLabel.title = t('time.allTimesIn', { zone }, `All times in ${zone}`);
    });

    heroClockId = registerClock(timeZone, targets, () =>
      !elements.dashboard.classList.contains('hidden'));
  }

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const elements = {
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    clearBtn: document.getElementById('clear-btn'),
    geoBtn: document.getElementById('geo-btn'),
    searchSubmitBtn: document.getElementById('search-submit-btn'),
    autocompleteList: document.getElementById('autocomplete-list'),
    autocompleteOptions: [],

    // Search Mode Tabs
    tabModeCity: document.getElementById('tab-mode-city'),
    tabModeClimate: document.getElementById('tab-mode-climate'),
    tabModeCompare: document.getElementById('tab-mode-compare'),

    // Quick Select Bars
    quickCitiesContainer: document.getElementById('quick-cities-container'),
    quickChips: document.getElementById('quick-chips'),
    climateChipsContainer: document.getElementById('climate-chips-container'),
    climateChips: document.getElementById('climate-chips'),

    // Unit toggle
    unitC: document.getElementById('unit-c'),
    unitF: document.getElementById('unit-f'),

    // States
    loadingState: document.getElementById('loading-state'),
    loadingText: document.getElementById('loading-text'),
    errorState: document.getElementById('error-state'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),

    // Climate Results Section
    climateResultsSection: document.getElementById('climate-results-section'),
    climateResultsTitle: document.getElementById('climate-results-title'),
    climateResultsCount: document.getElementById('climate-results-count'),
    climateResultsSubtitle: document.getElementById('climate-results-subtitle'),
    climateActiveTags: document.getElementById('climate-active-tags'),
    climateSortSelect: document.getElementById('climate-sort-select'),
    climateResultsGrid: document.getElementById('climate-results-grid'),

    // Back to Results Bar
    backToResultsBar: document.getElementById('back-to-results-bar'),
    backToResultsBtn: document.getElementById('back-to-results-btn'),
    backToResultsText: document.getElementById('back-to-results-text'),

    // Full Weather Dashboard
    dashboard: document.getElementById('weather-dashboard'),

    // Today at a Glance
    glanceCard: document.getElementById('glance-card'),
    glanceLocation: document.getElementById('glance-location'),
    glanceLocationMeta: document.getElementById('glance-location-meta'),
    glanceTemp: document.getElementById('glance-temp'),
    glanceTempSymbol: document.getElementById('glance-temp-symbol'),
    glanceFeelsLike: document.getElementById('glance-feels-like'),
    glanceCondition: document.getElementById('glance-condition'),
    glanceWeatherIcon: document.getElementById('glance-weather-icon'),
    glanceMetrics: document.getElementById('glance-metrics'),
    glanceVerdict: document.getElementById('glance-verdict'),
    glanceVerdictIcon: document.getElementById('glance-verdict-icon'),
    glanceVerdictHeadline: document.getElementById('glance-verdict-headline'),
    glanceVerdictDetail: document.getElementById('glance-verdict-detail'),
    glanceWear: document.getElementById('glance-wear'),
    glanceWearIcon: document.getElementById('glance-wear-icon'),
    glanceWearHeadline: document.getElementById('glance-wear-headline'),
    glanceWearDetail: document.getElementById('glance-wear-detail'),

    // The shareable cards. A shared link names these keys, and each key maps to
    // exactly one section id, so the recipient lands on the card the sender was
    // looking at rather than on a generic page. ("glance" is bound above, with
    // the rest of the glance card.)
    heroCard: document.getElementById('hero-card'),
    assistantCard: document.getElementById('assistant-card'),
    metricsCard: document.getElementById('metrics-card'),
    hourlyCard: document.getElementById('hourly-card'),
    dailyCard: document.getElementById('daily-card'),

    // Shared-link arrival
    sharedBanner: document.getElementById('shared-banner'),
    sharedBannerCity: document.getElementById('shared-banner-city'),
    sharedBannerCards: document.getElementById('shared-banner-cards'),
    sharedClearBtn: document.getElementById('shared-clear-btn'),
    shareStatus: document.getElementById('share-status'),

    cityName: document.getElementById('city-name'),
    locationMeta: document.getElementById('location-meta'),
    localTime: document.getElementById('local-time'),
    conditionBadge: document.getElementById('condition-badge'),
    conditionText: document.getElementById('condition-text'),
    currentTemp: document.getElementById('current-temp'),
    tempUnitDisplay: document.getElementById('temp-unit-display'),
    feelsLikeTemp: document.getElementById('feels-like-temp'),
    maxTemp: document.getElementById('max-temp'),
    minTemp: document.getElementById('min-temp'),
    heroWeatherIcon: document.getElementById('hero-weather-icon'),

    // Metrics
    humidityVal: document.getElementById('humidity-val'),
    humidityStatus: document.getElementById('humidity-status'),
    windSpeedVal: document.getElementById('wind-speed-val'),
    windUnitDisplay: document.getElementById('wind-unit-display'),
    windCardinal: document.getElementById('wind-cardinal'),
    windCompassArrow: document.getElementById('wind-compass-arrow'),
    uvVal: document.getElementById('uv-val'),
    uvBadge: document.getElementById('uv-badge'),
    uvAdvice: document.getElementById('uv-advice'),
    pressureVal: document.getElementById('pressure-val'),
    pressureStatus: document.getElementById('pressure-status'),
    precipVal: document.getElementById('precip-val'),
    precipUnitDisplay: document.getElementById('precip-unit-display'),
    cloudCoverStatus: document.getElementById('cloud-cover-status'),
    sunriseVal: document.getElementById('sunrise-val'),
    sunsetVal: document.getElementById('sunset-val'),

    // Forecasts
    hourlyStrip: document.getElementById('hourly-strip'),
    dailyList: document.getElementById('daily-list'),

    // Freshness + refresh
    dataFreshness: document.getElementById('data-freshness'),
    shareBtn: document.getElementById('share-btn'),
    refreshBtn: document.getElementById('refresh-btn'),

    // Live clocks
    cityClock: document.getElementById('city-clock'),
    cityClockSeconds: document.getElementById('city-clock-seconds'),
    cityClockZone: document.getElementById('city-clock-zone'),
    localTimeDate: document.getElementById('local-time-date'),
    cityTimeDiff: document.getElementById('city-time-diff'),
    metricCityClock: document.getElementById('metric-city-clock'),
    metricCityDate: document.getElementById('metric-city-date'),
    metricCityOffset: document.getElementById('metric-city-offset'),
    metricUserTime: document.getElementById('metric-user-time'),
    userClockTime: document.getElementById('user-clock-time'),
    userClockZone: document.getElementById('user-clock-zone'),
    userClock: document.getElementById('user-clock'),
    footerUserZone: document.getElementById('footer-user-zone'),
    footerTimezoneNote: document.getElementById('footer-timezone-note'),
    hourlyTzLabel: document.getElementById('hourly-tz-label'),
    dailyTzLabel: document.getElementById('daily-tz-label'),

    // Personal Weather Assistant
    assistantCard: document.getElementById('assistant-card'),
    assistantScope: document.getElementById('assistant-scope'),
    assistantSummary: document.getElementById('assistant-summary'),
    assistantSummaryIcon: document.getElementById('assistant-summary-icon'),
    assistantSummaryHeadline: document.getElementById('assistant-summary-headline'),
    assistantSummaryDetail: document.getElementById('assistant-summary-detail'),
    assistantGrid: document.getElementById('assistant-grid'),
    assistantWindowTabs: document.getElementById('assistant-window-tabs'),
    assistantWindowAnswer: document.getElementById('assistant-window-answer'),

    // Compare Locations
    compareSection: document.getElementById('compare-section'),
    mainContent: document.getElementById('main-content'),
    compareCount: document.getElementById('compare-count'),
    compareSlots: document.getElementById('compare-slots'),
    compareAddBtn: document.getElementById('compare-add-btn'),
    compareRunBtn: document.getElementById('compare-run-btn'),
    compareClearBtn: document.getElementById('compare-clear-btn'),
    compareNotice: document.getElementById('compare-notice'),
    compareLoading: document.getElementById('compare-loading'),
    compareLoadingText: document.getElementById('compare-loading-text'),
    compareGlanceCard: document.getElementById('compare-glance-card'),
    compareInsights: document.getElementById('compare-insights'),
    compareCurrentCard: document.getElementById('compare-current-card'),
    compareCurrentTable: document.getElementById('compare-current-table'),
    compareForecastCard: document.getElementById('compare-forecast-card'),
    compareForecastTable: document.getElementById('compare-forecast-table'),
    compareFreshness: document.getElementById('compare-freshness'),
  };

  // The hero's clock surfaces all read the selected city's timezone, so they are
  // registered once per city load instead of being re-registered on every tick.
  let heroClockId = null;
  let userClockId = null;

  // Holds the "link copied" state on the share button for a couple of seconds,
  // so repeated shares cannot stack timers on the same node.
  let shareConfirmTimer = null;

  // ==========================================================================
  // WMO Weather Codes Mapping
  // ==========================================================================
  const WMO_MAP = {
    0: { label: 'Clear sky', icon: 'clear', theme: 'clear' },
    1: { label: 'Mainly clear', icon: 'clear', theme: 'clear' },
    2: { label: 'Partly cloudy', icon: 'partly-cloudy', theme: 'cloudy' },
    3: { label: 'Overcast', icon: 'cloudy', theme: 'cloudy' },
    45: { label: 'Foggy', icon: 'fog', theme: 'cloudy' },
    48: { label: 'Rime fog', icon: 'fog', theme: 'cloudy' },
    51: { label: 'Light drizzle', icon: 'drizzle', theme: 'rainy' },
    53: { label: 'Moderate drizzle', icon: 'drizzle', theme: 'rainy' },
    55: { label: 'Dense drizzle', icon: 'drizzle', theme: 'rainy' },
    56: { label: 'Freezing drizzle', icon: 'snow', theme: 'snowy' },
    57: { label: 'Dense freezing drizzle', icon: 'snow', theme: 'snowy' },
    61: { label: 'Slight rain', icon: 'rain', theme: 'rainy' },
    63: { label: 'Moderate rain', icon: 'rain', theme: 'rainy' },
    65: { label: 'Heavy rain', icon: 'heavy-rain', theme: 'rainy' },
    66: { label: 'Freezing rain', icon: 'snow', theme: 'snowy' },
    67: { label: 'Heavy freezing rain', icon: 'snow', theme: 'snowy' },
    71: { label: 'Slight snow', icon: 'snow', theme: 'snowy' },
    73: { label: 'Moderate snow', icon: 'snow', theme: 'snowy' },
    75: { label: 'Heavy snow fall', icon: 'snow', theme: 'snowy' },
    77: { label: 'Snow grains', icon: 'snow', theme: 'snowy' },
    80: { label: 'Slight rain showers', icon: 'rain', theme: 'rainy' },
    81: { label: 'Moderate rain showers', icon: 'rain', theme: 'rainy' },
    82: { label: 'Violent rain showers', icon: 'heavy-rain', theme: 'rainy' },
    85: { label: 'Snow showers', icon: 'snow', theme: 'snowy' },
    86: { label: 'Heavy snow showers', icon: 'snow', theme: 'snowy' },
    95: { label: 'Thunderstorm', icon: 'thunderstorm', theme: 'thunderstorm' },
    96: { label: 'Thunderstorm with hail', icon: 'thunderstorm', theme: 'thunderstorm' },
    99: { label: 'Heavy thunderstorm with hail', icon: 'thunderstorm', theme: 'thunderstorm' },
  };

  // ==========================================================================
  // Inline SVG Weather Icons Generator
  // ==========================================================================
  function getWeatherSvg(iconType, isDay = 1) {
    const isNight = !isDay;

    switch (iconType) {
      case 'clear':
        if (isNight) {
          return `
            <svg viewBox="0 0 64 64" fill="none">
              <path d="M44.5 38.5C44.5 49.27 35.77 58 25 58C17.65 58 11.23 53.94 7.9 48C9.56 48.33 11.26 48.5 13 48.5C27.08 48.5 38.5 37.08 38.5 23C38.5 17.62 36.83 12.63 34 8.5C40.35 11.75 44.5 24.5 44.5 38.5Z" fill="url(#moon-grad)"/>
              <circle cx="48" cy="14" r="1.5" fill="#E2E8F0"/>
              <circle cx="56" cy="22" r="2" fill="#F8FAFC"/>
              <circle cx="52" cy="32" r="1" fill="#CBD5E1"/>
              <defs>
                <linearGradient id="moon-grad" x1="10" y1="10" x2="48" y2="58" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#E2E8F0"/>
                  <stop offset="1" stop-color="#94A3B8"/>
                </linearGradient>
              </defs>
            </svg>`;
        }
        return `
          <svg viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="14" fill="url(#sun-ball)"/>
            <g stroke="url(#sun-rays)" stroke-width="3" stroke-linecap="round">
              <line x1="32" y1="6" x2="32" y2="12" />
              <line x1="32" y1="52" x2="32" y2="58" />
              <line x1="6" y1="32" x2="12" y2="32" />
              <line x1="52" y1="32" x2="58" y2="32" />
              <line x1="13.62" y1="13.62" x2="17.86" y2="17.86" />
              <line x1="46.14" y1="46.14" x2="50.38" y2="50.38" />
              <line x1="13.62" y1="50.38" x2="17.86" y2="46.14" />
              <line x1="46.14" y1="17.86" x2="50.38" y2="13.62" />
            </g>
            <defs>
              <linearGradient id="sun-ball" x1="18" y1="18" x2="46" y2="46" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FDE047"/>
                <stop offset="1" stop-color="#F59E0B"/>
              </linearGradient>
              <linearGradient id="sun-rays" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FCD34D"/>
                <stop offset="1" stop-color="#F97316"/>
              </linearGradient>
            </defs>
          </svg>`;

      case 'partly-cloudy':
        if (isNight) {
          return `
            <svg viewBox="0 0 64 64" fill="none">
              <path d="M38 10C42 12 45 19 45 25C45 32 40 37 32 37C27 37 23 34 21 30C22 30.5 24 31 26 31C33.73 31 40 24.73 40 17C40 14.3 39.2 11.9 38 10Z" fill="url(#moon-grad-pc)"/>
              <path d="M46 44C46 38.48 41.52 34 36 34C35.08 34 34.2 34.12 33.36 34.36C31.54 29.5 26.91 26 21.5 26C14.6 26 9 31.6 9 38.5C9 39.46 9.11 40.4 9.31 41.3C6.23 42.6 4 45.54 4 49C4 53.42 7.58 57 12 57H45C49.42 57 53 53.42 53 49C53 46.2 51.56 43.74 49.38 42.45C49.77 41.36 50 40.2 50 39" fill="url(#cloud-grad-pc)"/>
              <defs>
                <linearGradient id="moon-grad-pc" x1="21" y1="10" x2="45" y2="37" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#F1F5F9"/>
                  <stop offset="1" stop-color="#94A3B8"/>
                </linearGradient>
                <linearGradient id="cloud-grad-pc" x1="4" y1="26" x2="53" y2="57" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#FFFFFF"/>
                  <stop offset="1" stop-color="#94A3B8"/>
                </linearGradient>
              </defs>
            </svg>`;
        }
        return `
          <svg viewBox="0 0 64 64" fill="none">
            <circle cx="24" cy="22" r="11" fill="url(#sun-pc)"/>
            <path d="M48 45C48 39.48 43.52 35 38 35C37.08 35 36.2 35.12 35.36 35.36C33.54 30.5 28.91 27 23.5 27C16.6 27 11 32.6 11 39.5C11 40.46 11.11 41.4 11.31 42.3C8.23 43.6 6 46.54 6 50C6 54.42 9.58 58 14 58H47C51.42 58 55 54.42 55 50C55 47.33 53.7 44.97 51.7 43.5" fill="url(#cloud-pc)"/>
            <defs>
              <linearGradient id="sun-pc" x1="13" y1="11" x2="35" y2="33" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FDE047"/>
                <stop offset="1" stop-color="#F59E0B"/>
              </linearGradient>
              <linearGradient id="cloud-pc" x1="6" y1="27" x2="55" y2="58" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FFFFFF"/>
                <stop offset="1" stop-color="#94A3B8"/>
              </linearGradient>
            </defs>
          </svg>`;

      case 'cloudy':
        return `
          <svg viewBox="0 0 64 64" fill="none">
            <path opacity="0.6" d="M38 22C38 17.58 34.42 14 30 14C29.26 14 28.56 14.1 27.89 14.29C26.43 10.4 22.73 7.6 18.4 7.6C12.88 7.6 8.4 12.08 8.4 17.6C8.4 18.37 8.49 19.12 8.65 19.84C6.19 20.88 4.4 23.23 4.4 26C4.4 29.53 7.27 32.4 10.8 32.4H37.2C40.73 32.4 43.6 29.53 43.6 26C43.6 23.86 42.56 21.97 40.96 20.8" fill="#94A3B8"/>
            <path d="M52 44C52 38.48 47.52 34 42 34C41.08 34 40.2 34.12 39.36 34.36C37.54 29.5 32.91 26 27.5 26C20.6 26 15 31.6 15 38.5C15 39.46 15.11 40.4 15.31 41.3C12.23 42.6 10 45.54 10 49C10 53.42 13.58 57 18 57H51C55.42 57 59 53.42 59 49C59 46.2 57.56 43.74 55.38 42.45C55.77 41.36 56 40.2 56 39" fill="url(#cloud-full)"/>
            <defs>
              <linearGradient id="cloud-full" x1="10" y1="26" x2="59" y2="57" gradientUnits="userSpaceOnUse">
                <stop stop-color="#E2E8F0"/>
                <stop offset="1" stop-color="#64748B"/>
              </linearGradient>
            </defs>
          </svg>`;

      case 'fog':
        return `
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M48 30C48 24.48 43.52 20 38 20C37.08 20 36.2 20.12 35.36 20.36C33.54 15.5 28.91 12 23.5 12C16.6 12 11 17.6 11 24.5C11 25.46 11.11 26.4 11.31 27.3C8.23 28.6 6 31.54 6 35C6 39.42 9.58 43 14 43H47C51.42 43 55 39.42 55 35C55 32.2 53.56 29.74 51.38 28.45" fill="url(#cloud-fog)"/>
            <line x1="12" y1="48" x2="52" y2="48" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>
            <line x1="18" y1="54" x2="46" y2="54" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/>
            <defs>
              <linearGradient id="cloud-fog" x1="6" y1="12" x2="55" y2="43" gradientUnits="userSpaceOnUse">
                <stop stop-color="#F1F5F9"/>
                <stop offset="1" stop-color="#94A3B8"/>
              </linearGradient>
            </defs>
          </svg>`;

      case 'drizzle':
      case 'rain':
        return `
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M48 33C48 27.48 43.52 23 38 23C37.08 23 36.2 23.12 35.36 23.36C33.54 18.5 28.91 15 23.5 15C16.6 15 11 20.6 11 27.5C11 28.46 11.11 29.4 11.31 30.3C8.23 31.6 6 34.54 6 38C6 42.42 9.58 46 14 46H47C51.42 46 55 42.42 55 38C55 35.2 53.56 32.74 51.38 31.45" fill="url(#cloud-rain)"/>
            <g stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round">
              <line x1="20" y1="50" x2="16" y2="58"/>
              <line x1="32" y1="50" x2="28" y2="58"/>
              <line x1="44" y1="50" x2="40" y2="58"/>
            </g>
            <defs>
              <linearGradient id="cloud-rain" x1="6" y1="15" x2="55" y2="46" gradientUnits="userSpaceOnUse">
                <stop stop-color="#E2E8F0"/>
                <stop offset="1" stop-color="#64748B"/>
              </linearGradient>
            </defs>
          </svg>`;

      case 'heavy-rain':
        return `
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M48 31C48 25.48 43.52 21 38 21C37.08 21 36.2 21.12 35.36 21.36C33.54 16.5 28.91 13 23.5 13C16.6 13 11 18.6 11 25.5C11 26.46 11.11 27.4 11.31 28.3C8.23 29.6 6 32.54 6 36C6 40.42 9.58 44 14 44H47C51.42 44 55 40.42 55 36C55 33.2 53.56 30.74 51.38 29.45" fill="url(#cloud-heavy)"/>
            <g stroke="#0284C7" stroke-width="2.5" stroke-linecap="round">
              <line x1="16" y1="48" x2="11" y2="58"/>
              <line x1="26" y1="48" x2="21" y2="58"/>
              <line x1="36" y1="48" x2="31" y2="58"/>
              <line x1="46" y1="48" x2="41" y2="58"/>
            </g>
            <defs>
              <linearGradient id="cloud-heavy" x1="6" y1="13" x2="55" y2="44" gradientUnits="userSpaceOnUse">
                <stop stop-color="#CBD5E1"/>
                <stop offset="1" stop-color="#475569"/>
              </linearGradient>
            </defs>
          </svg>`;

      case 'snow':
        return `
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M48 32C48 26.48 43.52 22 38 22C37.08 22 36.2 22.12 35.36 22.36C33.54 17.5 28.91 14 23.5 14C16.6 14 11 19.6 11 26.5C11 27.46 11.11 28.4 11.31 29.3C8.23 30.6 6 33.54 6 37C6 41.42 9.58 45 14 45H47C51.42 45 55 41.42 55 37C55 34.2 53.56 31.74 51.38 30.45" fill="url(#cloud-snow)"/>
            <g fill="#BAE6FD">
              <circle cx="20" cy="52" r="2.5"/>
              <circle cx="32" cy="55" r="2"/>
              <circle cx="44" cy="51" r="2.5"/>
              <circle cx="26" cy="58" r="1.5"/>
              <circle cx="38" cy="59" r="1.5"/>
            </g>
            <defs>
              <linearGradient id="cloud-snow" x1="6" y1="14" x2="55" y2="45" gradientUnits="userSpaceOnUse">
                <stop stop-color="#F8FAFC"/>
                <stop offset="1" stop-color="#94A3B8"/>
              </linearGradient>
            </defs>
          </svg>`;

      case 'thunderstorm':
        return `
          <svg viewBox="0 0 64 64" fill="none">
            <path d="M48 30C48 24.48 43.52 20 38 20C37.08 20 36.2 20.12 35.36 20.36C33.54 15.5 28.91 12 23.5 12C16.6 12 11 17.6 11 24.5C11 25.46 11.11 26.4 11.31 27.3C8.23 28.6 6 31.54 6 35C6 39.42 9.58 43 14 43H47C51.42 43 55 39.42 55 35C55 32.2 53.56 29.74 51.38 28.45" fill="url(#cloud-storm)"/>
            <polygon points="30,42 22,53 29,53 26,62 38,49 31,49" fill="url(#lightning)"/>
            <defs>
              <linearGradient id="cloud-storm" x1="6" y1="12" x2="55" y2="43" gradientUnits="userSpaceOnUse">
                <stop stop-color="#64748B"/>
                <stop offset="1" stop-color="#1E293B"/>
              </linearGradient>
              <linearGradient id="lightning" x1="22" y1="42" x2="38" y2="62" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FDE047"/>
                <stop offset="1" stop-color="#F59E0B"/>
              </linearGradient>
            </defs>
          </svg>`;

      default:
        return getWeatherSvg('clear', isDay);
    }
  }

  // ==========================================================================
  // Unit Conversion Helpers
  // ==========================================================================
  function formatTemp(celsius) {
    if (celsius === null || celsius === undefined || isNaN(celsius)) return '--';
    if (state.unit === 'fahrenheit') {
      return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
  }

  function getTempUnitSymbol() {
    return state.unit === 'fahrenheit' ? '°F' : '°C';
  }

  function formatWindSpeed(kmh) {
    if (kmh === null || kmh === undefined || isNaN(kmh)) return '--';
    if (state.unit === 'fahrenheit') {
      return (kmh * 0.621371).toFixed(1);
    }
    return Number(kmh).toFixed(1);
  }

  function getWindUnitSymbol() {
    return state.unit === 'fahrenheit' ? 'mph' : 'km/h';
  }

  /** Format a wind threshold that is always stored internally in km/h. */
  function formatWindThreshold(kmh) {
    return state.unit === 'fahrenheit' ? Math.round(kmhToMph(kmh)) : Math.round(kmh);
  }

  function formatPrecip(mm) {
    if (mm === null || mm === undefined || isNaN(mm)) return '0.0';
    if (state.unit === 'fahrenheit') {
      return (mm * 0.0393701).toFixed(2);
    }
    return Number(mm).toFixed(1);
  }

  function getPrecipUnitSymbol() {
    return state.unit === 'fahrenheit' ? 'in' : 'mm';
  }

  // ==========================================================================
  // Raw Unit Conversions (for normalising user-entered thresholds)
  // ==========================================================================
  function celsiusToFahrenheit(c) {
    return (c * 9) / 5 + 32;
  }

  function fahrenheitToCelsius(f) {
    return ((f - 32) * 5) / 9;
  }

  function kmhToMph(kmh) {
    return kmh * 0.621371;
  }

  /**
   * Interpret a temperature threshold typed by the user, returning Celsius.
   * An explicit °C/°F marker always wins; otherwise the active display unit is
   * assumed, so "> 75" means 75°F in Fahrenheit mode and 75°C in Celsius mode.
   */
  function normalizeEnteredTemp(value, text) {
    const t = text || '';
    if (/\d\s*°?\s*c\b/i.test(t)) return value;
    if (/\d\s*°?\s*f\b/i.test(t)) return fahrenheitToCelsius(value);
    if (state.unit === 'fahrenheit') return fahrenheitToCelsius(value);
    return value;
  }

  function getWindCardinal(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((degrees %= 360) < 0 ? degrees + 360 : degrees) / 22.5) % 16;
    return directions[index];
  }

  function getUvInfo(uv) {
    if (uv <= 2) return { text: t('metrics.uvLow', null, 'Low'), badgeClass: 'low', advice: t('metrics.uvAdviceLow', null, 'Low risk of sun damage') };
    if (uv <= 5) return { text: t('metrics.uvModerate', null, 'Moderate'), badgeClass: 'moderate', advice: t('metrics.uvAdviceModerate', null, 'Sun protection advised') };
    if (uv <= 7) return { text: t('metrics.uvHigh', null, 'High'), badgeClass: 'high', advice: t('metrics.uvAdviceHigh', null, 'Wear hat and sunscreen') };
    if (uv <= 10) return { text: t('metrics.uvVeryHigh', null, 'Very High'), badgeClass: 'very-high', advice: t('metrics.uvAdviceVeryHigh', null, 'Avoid sun during midday') };
    return { text: t('metrics.uvExtreme', null, 'Extreme'), badgeClass: 'extreme', advice: t('metrics.uvAdviceExtreme', null, 'Take full sun precautions') };
  }

  function getHumidityStatus(val) {
    if (val < 30) return t('metrics.humidityDry', null, 'Dry environment');
    if (val <= 60) return t('metrics.humidityComfortable', null, 'Comfortable humidity');
    return t('metrics.humidityHigh', null, 'High humidity');
  }

  /**
   * Build a human-readable "updated N min ago" label.
   * `current.time` is local to the requested location, so we treat it as UTC and
   * subtract the location's offset to recover the true observation instant.
   */
  function formatFreshness(timeStr, utcOffsetSeconds) {
    if (!timeStr) return null;
    const parsed = Date.parse(`${timeStr}Z`);
    if (Number.isNaN(parsed)) return null;

    const instant = parsed - (utcOffsetSeconds || 0) * 1000;
    const diffMin = Math.floor((Date.now() - instant) / 60000);

    if (diffMin < 1) return t('time.freshnessNow', null, 'Updated just now');
    if (diffMin < 60) return t('time.freshnessMinutes', { count: diffMin }, `Updated ${diffMin} min ago`);
    const hours = Math.floor(diffMin / 60);
    if (hours < 24) {
      return tp('time.freshnessHours', 'time.freshnessHoursPlural', hours,
        { count: hours }, `Updated ${hours} hour ago`, `Updated ${hours} hours ago`);
    }
    const days = Math.floor(hours / 24);
    return tp('time.freshnessDays', 'time.freshnessDaysPlural', days,
      { count: days }, `Updated ${days} day ago`, `Updated ${days} days ago`);
  }

// ==========================================================================
// API Calls
// ==========================================================================
  /**
   * fetch + JSON with an enforced timeout.
   * Throws an AbortError-compatible name so callers can ignore stale requests.
   */
  async function fetchJson(url, externalSignal) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const relayAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', relayAbort, { once: true });
    }

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      return await res.json();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        const timeoutError = new Error('Request timed out or was superseded');
        timeoutError.name = 'AbortError';
        throw timeoutError;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', relayAbort);
    }
  }

  async function searchCities(query, signal) {
    if (!query || query.trim().length < 2) return [];
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=en&format=json`;
    try {
      const data = await fetchJson(url, signal);
      return data.results || [];
    } catch (err) {
      if (err.name !== 'AbortError') throw new Error('Geocoding search failed');
      throw err;
    }
  }

  async function fetchWeatherData(lat, lon, timezone = 'auto', signal) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'wind_speed_10m',
        'wind_direction_10m',
        'uv_index',
      ].join(','),
      // The Weather Assistant reads the same hourly block, so apparent
      // temperature, precipitation amount, wind and cloud cover are added
      // here rather than costing a second API request.
      hourly: [
        'temperature_2m',
        'apparent_temperature',
        'precipitation',
        'precipitation_probability',
        'weather_code',
        'wind_speed_10m',
        'cloud_cover',
        'is_day',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'uv_index_max',
        'precipitation_probability_max',
        // Compare Locations renders today's peak wind from this one extra
        // field, which also lets it reuse a dashboard payload verbatim instead
        // of refetching a city the visitor is already looking at.
        'wind_speed_10m_max',
      ].join(','),
      timezone: timezone,
    });

    return await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, signal);
  }

  /**
   * Weather payload for one location in a comparison.
   *
   * Same endpoint, same `fetchJson` timeout/abort plumbing and the same field
   * names as `fetchWeatherData`, trimmed to what the comparison actually shows
   * and limited to a single day - so the shared `toEntry()` shape in
   * `compare.js` reads identically whichever payload a column came from.
   */
  async function fetchComparisonWeather(city, signal) {
    const params = new URLSearchParams({
      latitude: city.latitude,
      longitude: city.longitude,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'wind_speed_10m',
        'wind_direction_10m',
        'uv_index',
      ].join(','),
      // Rain probability is an hourly product; the comparison reads the entry
      // stamped with `current.time` instead of costing another request.
      hourly: 'precipitation_probability',
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'uv_index_max',
        'precipitation_probability_max',
        'wind_speed_10m_max',
      ].join(','),
      forecast_days: 1,
      timezone: city.timezone || 'auto',
    });

    return await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, signal);
  }

  /**
   * Batch fetch current weather for all worldwide benchmark cities.
   * Cached in memory + sessionStorage for GLOBAL_CACHE_TTL so repeated climate
   * queries and page reloads within a session are instant.
   */
  async function fetchGlobalCitiesWeather() {
    const now = Date.now();
    if (state.globalWeatherData && now - state.globalCacheTimestamp < GLOBAL_CACHE_TTL) {
      return state.globalWeatherData;
    }

    // Try the cross-reload session cache before hitting the network
    const cached = readGlobalCache();
    if (cached) {
      state.globalWeatherData = cached;
      state.globalCacheTimestamp = now;
      return cached;
    }

    const lats = WORLD_CITIES.map((c) => c.latitude).join(',');
    const lons = WORLD_CITIES.map((c) => c.longitude).join(',');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m`;
    const rawList = await fetchJson(url);
    const dataList = Array.isArray(rawList) ? rawList : [rawList];

    const entries = WORLD_CITIES.map((city, idx) => {
      const forecast = dataList[idx] || {};
      return {
        city: city,
        current: forecast.current || {},
      };
    });

    state.globalWeatherData = entries;
    state.globalCacheTimestamp = now;
    writeGlobalCache(entries, now);
    return entries;
  }

  function readGlobalCache() {
    try {
      // The 72-city batch is a per-session cache, so its rename migration reads
      // the legacy session key too rather than going through localStorage.
      let raw = sessionStorage.getItem(STORAGE_KEYS.globalCache);
      if (raw === null) {
        const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEYS.globalCache);
        if (legacy !== null) {
          sessionStorage.setItem(STORAGE_KEYS.globalCache, legacy);
          sessionStorage.removeItem(LEGACY_STORAGE_KEYS.globalCache);
          raw = legacy;
        }
      }
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.entries) || !parsed.timestamp) return null;
      if (Date.now() - parsed.timestamp >= GLOBAL_CACHE_TTL) return null;
      // Re-attach the canonical city objects so identity checks stay stable
      return parsed.entries.map((entry, idx) => ({
        city: WORLD_CITIES[idx] || entry.city,
        current: entry.current || {},
      }));
    } catch {
      return null;
    }
  }

  function writeGlobalCache(entries, timestamp) {
    try {
      sessionStorage.setItem(STORAGE_KEYS.globalCache, JSON.stringify({ timestamp, entries }));
      sessionStorage.removeItem(LEGACY_STORAGE_KEYS.globalCache);
    } catch {
      // sessionStorage may be unavailable (private mode / quota) - caching is optional
    }
  }

  // ==========================================================================
  // Climate Condition Query Parsing & Filtering
  // ==========================================================================
  /**
   * Parse user search query and active preset chips into structured conditions
   */
  function parseClimateCriteria(queryStr, presetTags = []) {
    const criteria = {
      weatherCategories: new Set(),
      tempMin: null,
      tempMax: null,
      minWind: null,
      minHumidity: null,
      maxHumidity: null,
      tokens: [],
    };

    // Expand curated combination presets (e.g. `beach` -> "sunny warm") so the
    // rest of the parser only ever deals with single base keywords.
    const expandedTags = presetTags.flatMap((tag) =>
      String(tag || '')
        .toLowerCase()
        .split(/\s+/)
        .flatMap((part) => (CLIMATE_PRESET_EXPANSIONS[part] || part).split(/\s+/))
        .filter(Boolean)
    );

    const combined = `${queryStr || ''} ${expandedTags.join(' ')}`.toLowerCase();
    const unitSuffix = getTempUnitSymbol();

    // Check Weather Categories
    if (/sunny|clear|sun/i.test(combined)) {
      criteria.weatherCategories.add('clear');
      criteria.tokens.push('☀️ Clear / Sunny');
    }
    if (/cloudy|clouds|overcast/i.test(combined)) {
      criteria.weatherCategories.add('cloudy');
      criteria.tokens.push('⛅ Cloudy');
    }
    if (/rain|rainy|drizzle|showers?/i.test(combined)) {
      criteria.weatherCategories.add('rainy');
      criteria.tokens.push('🌧️ Rainy');
    }
    if (/snow|snowy|blizzard/i.test(combined)) {
      criteria.weatherCategories.add('snowy');
      criteria.tokens.push('❄️ Snowy');
    }
    if (/thunderstorm|storm|lightning/i.test(combined)) {
      criteria.weatherCategories.add('thunderstorm');
      criteria.tokens.push('⚡ Storm');
    }

    // Check Wind Speed
    // NOTE: thresholds are always stored in km/h (the API unit); the active
    // display unit only affects how they are rendered.
    if (/windy|breeze/i.test(combined)) {
      // 20 km/h ~= breezy
      criteria.minWind = criteria.minWind === null ? 20 : Math.max(criteria.minWind, 20);
      criteria.tokens.push(`💨 Windy (>${formatWindThreshold(20)} ${getWindUnitSymbol()})`);
    }
    if (/gale|very windy|strong wind|high wind/i.test(combined)) {
      criteria.minWind = criteria.minWind === null ? 40 : Math.max(criteria.minWind, 40);
      criteria.tokens.push(`🌪️ Gale (>${formatWindThreshold(40)} ${getWindUnitSymbol()})`);
    }

    // Check Temperature Descriptors.
    // NOTE: use ?? / explicit null checks so a legitimate threshold of 0 is
    // never treated as "unset" (the previous `||` fallback broke e.g. "< 0 freezing").
    const raiseMin = (value) => {
      criteria.tempMin = criteria.tempMin === null ? value : Math.max(criteria.tempMin, value);
    };
    const lowerMax = (value) => {
      criteria.tempMax = criteria.tempMax === null ? value : Math.min(criteria.tempMax, value);
    };

    if (/hot/i.test(combined)) {
      raiseMin(28);
      criteria.tokens.push(`🌴 Hot (>${formatTemp(28)}${unitSuffix})`);
    } else if (/warm/i.test(combined)) {
      raiseMin(20);
      lowerMax(28);
      criteria.tokens.push(`🏖️ Warm (${formatTemp(20)}-${formatTemp(28)}${unitSuffix})`);
    } else if (/mild|pleasant/i.test(combined)) {
      raiseMin(14);
      lowerMax(20);
      criteria.tokens.push(`🧣 Mild (${formatTemp(14)}-${formatTemp(20)}${unitSuffix})`);
    } else if (/cool/i.test(combined)) {
      raiseMin(8);
      lowerMax(14);
      criteria.tokens.push(`🧥 Cool (${formatTemp(8)}-${formatTemp(14)}${unitSuffix})`);
    } else if (/cold/i.test(combined)) {
      lowerMax(12);
      criteria.tokens.push(`🥶 Cold (<${formatTemp(12)}${unitSuffix})`);
    } else if (/freezing/i.test(combined)) {
      lowerMax(2);
      criteria.tokens.push(`🧊 Freezing (≤${formatTemp(2)}${unitSuffix})`);
    }

    // Check Humidity Comfort
    // `relative_humidity_2m` is part of the global batch payload, so humidity
    // filters cost nothing extra to evaluate.
    const raiseMinHumidity = (value) => {
      criteria.minHumidity = criteria.minHumidity === null ? value : Math.max(criteria.minHumidity, value);
    };
    const lowerMaxHumidity = (value) => {
      criteria.maxHumidity = criteria.maxHumidity === null ? value : Math.min(criteria.maxHumidity, value);
    };

    if (/humid|humidity|muggy|sticky|clammy|oppressive/i.test(combined)) {
      raiseMinHumidity(70);
      criteria.tokens.push('💧 Humid (>70%)');
    } else if (/\bdry\b|arid/i.test(combined)) {
      lowerMaxHumidity(30);
      criteria.tokens.push('🏜️ Dry (<30%)');
    }

    // Explicit Numerical Expressions
    // e.g. "> 25", ">= 20", "< 15", "20-25", "-5 to 5"
    // Thresholds are normalised to Celsius so they can be compared against the
    // API's temperature_2m values regardless of the active display unit.
    const rangeMatch = combined.match(/(-?\d+(?:\.\d+)?)\s*(?:-|to)\s*(-?\d+(?:\.\d+)?)/i);
    if (rangeMatch) {
      const a = normalizeEnteredTemp(parseFloat(rangeMatch[1]), combined);
      const b = normalizeEnteredTemp(parseFloat(rangeMatch[2]), combined);
      criteria.tempMin = Math.min(a, b);
      criteria.tempMax = Math.max(a, b);
      criteria.tokens.push(
        `${formatTemp(criteria.tempMin)}${unitSuffix} to ${formatTemp(criteria.tempMax)}${unitSuffix}`
      );
    } else {
      const greaterMatch = combined.match(
        /(?:>=|>|\babove\b|\bover\b|\bwarmer than\b)\s*(-?\d+(?:\.\d+)?)/i
      );
      if (greaterMatch) {
        raiseMin(normalizeEnteredTemp(parseFloat(greaterMatch[1]), combined));
        criteria.tokens.push(`> ${formatTemp(criteria.tempMin)}${unitSuffix}`);
      }
      const lesserMatch = combined.match(
        /(?:<=|<|\bbelow\b|\bunder\b|\bcolder than\b)\s*(-?\d+(?:\.\d+)?)/i
      );
      if (lesserMatch) {
        lowerMax(normalizeEnteredTemp(parseFloat(lesserMatch[1]), combined));
        criteria.tokens.push(`< ${formatTemp(criteria.tempMax)}${unitSuffix}`);
      }
    }

    // If query was plain text and matched nothing specific, treat as general keyword match against condition names
    if (criteria.tokens.length === 0 && queryStr && queryStr.trim().length > 0) {
      criteria.rawQuery = queryStr.trim().toLowerCase();
      criteria.tokens.push(`"${queryStr.trim()}"`);
    }

    return criteria;
  }

  function matchesClimateCriteria(entry, criteria) {
    const current = entry.current;
    if (!current || current.weather_code === undefined) return false;

    const weatherInfo = WMO_MAP[current.weather_code] || { theme: 'clear', label: 'Clear' };
    const tempC = current.temperature_2m;
    const windSpeed = current.wind_speed_10m || 0;

    // 1. Weather Category Check
    if (criteria.weatherCategories.size > 0) {
      const cat = weatherInfo.theme;
      if (!criteria.weatherCategories.has(cat)) {
        return false;
      }
    }

    // 2. Minimum Temperature Check
    if (criteria.tempMin !== null && tempC < criteria.tempMin) {
      return false;
    }

    // 3. Maximum Temperature Check
    if (criteria.tempMax !== null && tempC > criteria.tempMax) {
      return false;
    }

    // 4. Wind Speed Check
    if (criteria.minWind !== null && windSpeed < criteria.minWind) {
      return false;
    }

    // 5. Humidity Check
    if (criteria.minHumidity !== null || criteria.maxHumidity !== null) {
      const humidity = current.relative_humidity_2m;
      // A missing reading must never silently pass a humidity filter.
      if (humidity === undefined || humidity === null) return false;
      if (criteria.minHumidity !== null && humidity < criteria.minHumidity) {
        return false;
      }
      if (criteria.maxHumidity !== null && humidity > criteria.maxHumidity) {
        return false;
      }
    }

    // 6. Raw Query Fallback Check
    if (criteria.rawQuery) {
      const labelMatch = weatherInfo.label.toLowerCase().includes(criteria.rawQuery);
      const cityMatch = entry.city.name.toLowerCase().includes(criteria.rawQuery);
      const countryMatch = entry.city.country.toLowerCase().includes(criteria.rawQuery);
      if (!labelMatch && !cityMatch && !countryMatch) {
        return false;
      }
    }

    return true;
  }

  // ==========================================================================
  // Preset Chip Labels
  // --------------------------------------------------------------------------
  // Chips are authored in plain HTML with their *bounds* as data attributes
  // (always Celsius / km-h), and the human-readable suffix is rendered here so
  // the labels follow the degC/degF toggle exactly like the rest of the app.
  // ==========================================================================
  function chipThresholdText(chip) {
    const parts = [];
    const min = chip.dataset.tempMin;
    const max = chip.dataset.tempMax;
    const wind = chip.dataset.wind;
    const humMin = chip.dataset.humidityMin;
    const humMax = chip.dataset.humidityMax;
    const unit = getTempUnitSymbol();

    if (min !== undefined && max !== undefined) {
      parts.push(`${formatTemp(Number(min))}-${formatTemp(Number(max))}${unit}`);
    } else if (min !== undefined) {
      parts.push(`>${formatTemp(Number(min))}${unit}`);
    } else if (max !== undefined) {
      parts.push(`<${formatTemp(Number(max))}${unit}`);
    }

    if (humMin !== undefined) {
      parts.push(`>${Number(humMin)}%`);
    } else if (humMax !== undefined) {
      parts.push(`<${Number(humMax)}%`);
    }

    if (wind !== undefined) {
      parts.push(`>${formatWindThreshold(Number(wind))} ${getWindUnitSymbol()}`);
    }

    return parts.length ? ` (${parts.join(' · ')})` : '';
  }

  function refreshChipThresholds() {
    document.querySelectorAll('#climate-chips .climate-filter-chip').forEach((chip) => {
      let span = chip.querySelector('.chip-threshold');
      if (!span) {
        span = document.createElement('span');
        span.className = 'chip-threshold';
        chip.appendChild(span);
      }
      span.textContent = chipThresholdText(chip);
    });
  }

  /**
   * Value written into the search box when a preset chip is activated.
   * Combination presets resolve to their expanded keywords (e.g. "Sunny & Warm")
   * so that re-running the query from the text box reproduces the same filter.
   */
  function presetInputValue(chip) {
    const expansion = CLIMATE_PRESET_EXPANSIONS[chip.dataset.condition];
    if (!expansion) return chip.textContent.trim();
    return expansion
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' & ');
  }

  // ==========================================================================
  // UI Rendering & Theme Updates
  // ==========================================================================
  function applyTheme(weatherCode, isDay) {
    const info = WMO_MAP[weatherCode] || { theme: 'clear' };
    let themeClass = 'theme-day-clear';

    if (info.theme === 'thunderstorm') {
      themeClass = 'theme-thunderstorm';
    } else if (info.theme === 'snowy') {
      themeClass = 'theme-snowy';
    } else if (info.theme === 'rainy') {
      themeClass = 'theme-rainy';
    } else if (info.theme === 'cloudy') {
      themeClass = 'theme-cloudy';
    } else {
      themeClass = isDay ? 'theme-day-clear' : 'theme-night-clear';
    }

    // Swap only theme classes so any other body-level class survives
    document.body.classList.remove(...THEME_CLASSES);
    document.body.classList.add(themeClass);
  }

  // ==========================================================================
  // Today at a Glance
  // --------------------------------------------------------------------------
  // The first card on the page, and the only one most visitors read. The engine
  // (`glance.js`) is pure and unit-agnostic, so this layer only hands it the
  // payload the dashboard already has plus the app's own unit formatters, then
  // paints what comes back. Every engine string is written with `textContent`,
  // because the city name originates in Open-Meteo's geocoder.
  // ==========================================================================
  function glanceFormat() {
    return {
      temp: formatTemp,
      tempSymbol: getTempUnitSymbol(),
      wind: formatWindSpeed,
      windSymbol: getWindUnitSymbol(),
      precip: formatPrecip,
      precipSymbol: getPrecipUnitSymbol(),
      percent: (value) => `${Math.round(value)}%`,
      cardinal: getWindCardinal,
      conditionLabel: conditionText,
    };
  }

  function renderGlance(data) {
    const card = elements.glanceCard;
    if (!card || !window.WeatherScopeGlance) return;

    let glance = null;
    try {
      glance = window.WeatherScopeGlance.build({
        current: data.current,
        hourly: data.hourly,
        daily: data.daily,
        currentTime: data.current ? data.current.time : null,
        city: state.currentCity,
        format: glanceFormat(),
        t: window.I18n && typeof window.I18n.t === 'function' ? window.I18n.t : null,
      });
    } catch (err) {
      // The engine is defensive by design, but a bug here must never take the
      // forecast down with it: the card simply stays hidden.
      console.warn('WeatherScope: the glance summary could not be built', err);
      return;
    }

    // Nothing usable in the payload - hide the card rather than show a
    // confident-sounding blank.
    if (!glance || !glance.ok) {
      card.hidden = true;
      return;
    }

    card.hidden = false;

    // --- Where ---------------------------------------------------------------
    elements.glanceLocation.textContent = glance.location.name;
    elements.glanceLocationMeta.textContent = glance.location.meta;

    // --- Temperature & sky ----------------------------------------------------
    elements.glanceTemp.textContent = glance.temperature;
    elements.glanceTempSymbol.textContent = glance.tempSymbol;
    elements.glanceFeelsLike.textContent = glance.feelsLike;
    elements.glanceCondition.textContent = glance.condition;

    // Same generated icon set as the hero: a fixed SVG per WMO code, with no
    // API text interpolated into it.
    const condition = WMO_MAP[data.current.weather_code] || { icon: 'clear' };
    elements.glanceWeatherIcon.innerHTML = getWeatherSvg(condition.icon, data.current.is_day);

    // --- Rain / wind / humidity -----------------------------------------------
    renderGlanceMetrics(glance.metrics);

    // --- The verdict ----------------------------------------------------------
    const verdict = glance.verdict;
    elements.glanceVerdict.dataset.tone = verdict.tone || 'unknown';
    elements.glanceVerdictIcon.textContent = verdict.icon || '';
    elements.glanceVerdictHeadline.textContent = verdict.text;
    elements.glanceVerdictDetail.textContent = verdict.detail || '';

    // --- What to wear --------------------------------------------------------
    renderGlanceWear(data);
  }

  /**
   * "What to wear" - the Personal Weather Assistant's clothing tile, mirrored
   * into one line under the verdict.
   *
   * Both cards read the same decision: `getAdviceProfile` is memoised on the
   * hourly payload, so this costs nothing and the two can never disagree. The
   * assistant card keeps its own tile - this is a summary, not a move - and
   * because clothing does not depend on the selected time window, switching
   * windows in the assistant leaves this line correct as it stands.
   *
   * A city with no usable hourly data hides the strip instead of showing a
   * placeholder.
   */
  function renderGlanceWear(data) {
    const strip = elements.glanceWear;
    if (!strip || !window.WeatherScopeAdvice) return;

    const profile = getAdviceProfile(data);
    const recommendations = getAdviceRecommendations(profile, state.adviceWindowKey);
    const clothing = recommendations && recommendations.decisions
      ? recommendations.decisions.clothing
      : null;

    if (!clothing || !clothing.headline) {
      strip.hidden = true;
      return;
    }

    strip.hidden = false;
    strip.dataset.tone = clothing.tone || 'unknown';
    elements.glanceWearIcon.textContent = clothing.icon || '👕';
    elements.glanceWearHeadline.textContent = clothing.headline;
    elements.glanceWearDetail.textContent = clothing.detail || '';
  }

  /**
   * The message body that travels with the link. It names the city (not just
   * the country), the sky, and today's range in the *sender's* unit - and the
   * link itself carries that same unit, so the recipient sees the same numbers
   * the message promised.
   */
  function generateShareText(data, city) {
    if (!data || !city) return '';
    const current = data.current;
    const daily = data.daily;
    const temp = formatTemp(current.temperature_2m);
    const unit = getTempUnitSymbol();
    const rain = current.precipitation_probability ?? (data.hourly && data.hourly.precipitation_probability && data.hourly.precipitation_probability[0]) ?? 0;
    const maxTemp = daily && daily.temperature_2m_max && daily.temperature_2m_max.length > 0 ? formatTemp(daily.temperature_2m_max[0]) : temp;
    const minTemp = daily && daily.temperature_2m_min && daily.temperature_2m_min.length > 0 ? formatTemp(daily.temperature_2m_min[0]) : temp;
    const rainChance = Math.round(rain);
    const condition = WMO_MAP[current.weather_code] || { label: 'Clear' };
    const place = shareEngine() ? shareEngine().describePlace({ city: city.name, admin1: city.admin1, country: city.country }) : city.name;
    return "Weather in " + place + "\n" + temp + unit + " · " + condition.label + "\n" + rainChance + "% rain\nHigh " + maxTemp + unit + "\nLow " + minTemp + unit;
  }

  /**
   * Hands over a link that *is* this city's forecast rather than the app's
   * address bar: the deep link built by `share.js` carries the city, the cards
   * that were on screen and the unit, so opening it re-opens that city with
   * those cards ringed and scrolled into view (see `applySharedLink`).
   *
   * Native share sheets take the link as its own field, so the recipient gets a
   * tap-through to the forecast itself. Without one, the link is copied
   * alongside the message - copying the message alone would be the old, useless
   * behaviour.
   */
  function shareWeather() {
    if (!state.weatherData || !state.currentCity) return;

    const share = shareEngine();
    const city = state.currentCity;
    const url = share ? share.buildShareUrl(window.location.href, currentSharePayload()) : '';
    if (!url) return;

    const text = generateShareText(state.weatherData, city);
    const place = share ? share.describePlace({ city: city.name, admin1: city.admin1, country: city.country }) : city.name;

    if (navigator.share) {
      navigator.share({ title: "Weather in " + place, text: text, url: url }).catch(function () {});
      return;
    }

    copyShareText(text + '\n' + url).then(function (copied) {
      if (copied) {
        announceShare('Link copied. Opening it shows ' + place + ' with the shared cards.');
        return;
      }
      // Nothing was copied, so the link is put where the visitor can still
      // reach it by hand - and they are told, rather than left guessing.
      const shown = showShareUrlInAddressBar(url);
      announceShare(shown
        ? 'Could not copy automatically. The link for ' + place + ' is now in the address bar.'
        : 'Could not copy automatically. Copy the link from the address bar to share this forecast.');
    });
  }

  /**
   * The three metrics are built from the engine's list rather than hard-coded
   * in the markup, so a metric can never be added in one place and forgotten in
   * the other. Each row is label + value (+ dimmed note) with a spoken-only
   * hint, so "Rain 65%" is read as "Rain 65% peak chance today".
   */
  function renderGlanceMetrics(metrics) {
    const container = elements.glanceMetrics;
    if (!container) return;

    container.innerHTML = '';
    metrics.forEach((metric) => {
      const item = document.createElement('div');
      item.className = 'glance-metric';
      item.dataset.metric = metric.key;
      item.setAttribute('role', 'listitem');

      const label = document.createElement('span');
      label.className = 'glance-metric-label';
      label.textContent = metric.label;

      const value = document.createElement('span');
      value.className = 'glance-metric-value';
      value.textContent = metric.value;

      item.append(label, value);

      if (metric.note) {
        const note = document.createElement('span');
        note.className = 'glance-metric-note';
        note.textContent = metric.note;
        item.appendChild(note);
      }

      if (metric.hint) {
        const hint = document.createElement('span');
        hint.className = 'glance-metric-hint';
        hint.textContent = metric.hint;
        item.appendChild(hint);
      }

      container.appendChild(item);
    });
  }

  function renderWeather() {
    if (!state.weatherData || !state.currentCity) return;

    const data = state.weatherData;
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;
    const city = state.currentCity;

    // Apply Dynamic Theme
    applyTheme(current.weather_code, current.is_day);

    // The "Today at a glance" summary is rendered first: it is the first card
    // in the DOM, so it paints before anything else and reads in the same order.
    renderGlance(data);

    // City and Meta
    elements.cityName.textContent = city.name;
    const metaParts = [];
    if (city.admin1) metaParts.push(city.admin1);
    if (city.country) metaParts.push(city.country);
    elements.locationMeta.textContent = metaParts.join(', ');

    // Local time: hand the city's timezone to the Time Engine, which keeps the
    // clock (and the offset against the visitor) live from here on.
    const cityZone = data.timezone || city.timezone || 'UTC';
    registerCityClocks(cityZone);

    // Weather Condition
    const condition = WMO_MAP[current.weather_code] || { label: 'Clear', icon: 'clear' };
    elements.conditionText.textContent = conditionText(current.weather_code);

    // Large Hero Icon
    elements.heroWeatherIcon.innerHTML = getWeatherSvg(condition.icon, current.is_day);

    // Temperature Values
    elements.currentTemp.textContent = formatTemp(current.temperature_2m);
    elements.tempUnitDisplay.textContent = getTempUnitSymbol();
    elements.feelsLikeTemp.textContent = `${formatTemp(current.apparent_temperature)}${getTempUnitSymbol()}`;

    // Today's min/max from daily
    if (daily && daily.temperature_2m_max && daily.temperature_2m_max.length > 0) {
      elements.maxTemp.textContent = `${formatTemp(daily.temperature_2m_max[0])}°`;
      elements.minTemp.textContent = `${formatTemp(daily.temperature_2m_min[0])}°`;
    }

    // Key Metrics
    elements.humidityVal.textContent = current.relative_humidity_2m ?? '--';
    elements.humidityStatus.textContent = getHumidityStatus(current.relative_humidity_2m ?? 50);

    // Wind
    elements.windSpeedVal.textContent = formatWindSpeed(current.wind_speed_10m);
    elements.windUnitDisplay.textContent = getWindUnitSymbol();
    const windDeg = current.wind_direction_10m ?? 0;
    elements.windCardinal.textContent = `${getWindCardinal(windDeg)} (${Math.round(windDeg)}°)`;
    elements.windCompassArrow.style.transform = `rotate(${windDeg}deg)`;

    // UV Index
    const uv = current.uv_index ?? 0;
    elements.uvVal.textContent = Number(uv).toFixed(1);
    const uvInfo = getUvInfo(uv);
    elements.uvBadge.textContent = uvInfo.text;
    elements.uvBadge.className = `uv-badge ${uvInfo.badgeClass}`;
    elements.uvAdvice.textContent = uvInfo.advice;

    // Air Pressure
    elements.pressureVal.textContent = Math.round(current.pressure_msl ?? 1013);
    elements.pressureStatus.textContent = current.pressure_msl > 1015
      ? t('metrics.pressureHigh', null, 'High pressure system')
      : (current.pressure_msl < 1005
        ? t('metrics.pressureLow', null, 'Low pressure system')
        : t('metrics.pressureNormal', null, 'Normal pressure'));

    // Cloud & Precip
    elements.precipVal.textContent = formatPrecip(current.precipitation);
    elements.precipUnitDisplay.textContent = getPrecipUnitSymbol();
    elements.cloudCoverStatus.textContent = t(
      'metrics.cloudCover',
      { value: Math.round(current.cloud_cover ?? 0) },
      `Cloud cover: ${Math.round(current.cloud_cover ?? 0)}%`
    );

    // Sun Times
    if (daily && daily.sunrise && daily.sunset && daily.sunrise.length > 0) {
      const sunriseTime = daily.sunrise[0].split('T')[1] || '--:--';
      const sunsetTime = daily.sunset[0].split('T')[1] || '--:--';
      elements.sunriseVal.textContent = sunriseTime;
      elements.sunsetVal.textContent = sunsetTime;
    }

    // Data freshness indicator
    const freshness = formatFreshness(current.time, data.utc_offset_seconds);
    if (freshness && elements.dataFreshness) {
      elements.dataFreshness.textContent = freshness;
      elements.dataFreshness.hidden = false;
    } else if (elements.dataFreshness) {
      elements.dataFreshness.hidden = true;
    }

    // Render Hourly Forecast (Next 24 Hours)
    renderHourlyForecast(hourly, current.time);

    // Render the Personal Weather Assistant from the same hourly payload
    renderAssistant(data);

    // Render 7-Day Forecast
    renderDailyForecast(daily);

    // Switch view to dashboard
    elements.loadingState.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.climateResultsSection.classList.add('hidden');
    // A city load can finish after the visitor has already switched to another
    // mode - the default city starts loading on page load. Rendering the data
    // is still right, but the dashboard must not be pushed over whichever
    // surface is currently on screen.
    if (state.searchMode !== 'compare') elements.dashboard.classList.remove('hidden');

    // Paint the clocks now that the dashboard is actually visible, so the city
    // never flashes placeholder digits for a second while the ticker waits.
    refreshClocks();

    // Show Back Button if user came from climate search
    if (state.matchingCities.length > 0) {
      elements.backToResultsBar.classList.remove('hidden');
      elements.backToResultsText.textContent = t(
        'climate.backToMatching',
        { count: state.matchingCities.length },
        `Back to matching cities (${state.matchingCities.length} found)`
      );
    } else {
      elements.backToResultsBar.classList.add('hidden');
    }
  }

  function renderHourlyForecast(hourly, currentTimeStr) {
    elements.hourlyStrip.innerHTML = '';
    if (!hourly || !hourly.time) return;

    let startIndex = 0;
    if (currentTimeStr) {
      const currentPrefix = currentTimeStr.slice(0, 13);
      const foundIdx = hourly.time.findIndex((t) => t.startsWith(currentPrefix));
      if (foundIdx !== -1) startIndex = foundIdx;
    }

    const next24 = hourly.time.slice(startIndex, startIndex + 24);

    next24.forEach((timeStr, idx) => {
      const actualIdx = startIndex + idx;
      const isNow = idx === 0;
      const hourPart = timeStr.split('T')[1].slice(0, 5);
      const tempVal = formatTemp(hourly.temperature_2m[actualIdx]);
      const wmoCode = hourly.weather_code[actualIdx];
      const isDayHour = hourly.is_day ? hourly.is_day[actualIdx] : 1;
      const precipProb = hourly.precipitation_probability ? hourly.precipitation_probability[actualIdx] : 0;
      const condition = WMO_MAP[wmoCode] || { icon: 'clear' };

      const card = document.createElement('div');
      card.className = `hourly-item ${isNow ? 'now' : ''}`;
      card.innerHTML = `
        <span class="hourly-time">${isNow ? 'Now' : hourPart}</span>
        <div class="hourly-icon">${getWeatherSvg(condition.icon, isDayHour)}</div>
        <span class="hourly-temp">${tempVal}°</span>
        <div class="hourly-rain">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
          <span>${precipProb}%</span>
        </div>
      `;
      elements.hourlyStrip.appendChild(card);
    });
  }

  // ==========================================================================
  // Personal Weather Assistant
  // --------------------------------------------------------------------------
  // Everything below reads data the dashboard already fetched. The engine
  // (`advice.js`) is pure and unit-agnostic, so this layer only:
  //   1. hands it the hourly payload + the app's unit formatters,
  //   2. memoises the analysis against the hourly payload's identity, and
  //   3. paints the result into the card.
  // Every string the engine returns is written with `textContent` rather than
  // interpolated into markup, because it is derived from external API data.
  // ==========================================================================
  function adviceFormat() {
    return {
      temp: formatTemp,
      tempSymbol: getTempUnitSymbol(),
      wind: formatWindSpeed,
      windSymbol: getWindUnitSymbol(),
      precip: formatPrecip,
      precipSymbol: getPrecipUnitSymbol(),
    };
  }

  /**
   * Analyse the hourly payload once per forecast.
   *
   * The cache is keyed on the hourly object itself: a fresh fetch produces a
   * new object (and therefore a new profile), while unit toggles are the only
   * other invalidation - the thresholds stay in Celsius internally and the
   * formatters passed in decide what the visitor actually sees.
   */
  function getAdviceProfile(data) {
    if (!window.WeatherScopeAdvice) return null;

    const hourly = data.hourly;
    const current = data.current;
    const uvMax = data.daily && data.daily.uv_index_max ? data.daily.uv_index_max[0] : null;
    if (!hourly || !Array.isArray(hourly.time)) return null;

    const cache = state.adviceCache;
    if (cache && cache.hourly === hourly && cache.unit === state.unit && cache.uvMax === uvMax) {
      return cache.profile;
    }

    let profile = null;
    try {
      profile = window.WeatherScopeAdvice.analyze({
        hourly,
        currentTime: current ? current.time : null,
        format: adviceFormat(),
      });
    } catch (err) {
      // The engine is defensive by design, but a bug here must never take the
      // forecast down with it: the card simply stays hidden.
      console.warn('WeatherScope: the Weather Assistant could not be analysed', err);
      return null;
    }

    state.adviceCache = { hourly, unit: state.unit, uvMax, profile, windowKey: null, recommendations: null };
    return profile;
  }

  /**
   * Recommendations for the selected window, memoised on the profile.
   *
   * Switching windows reuses the cached profile, so only the window lookup is
   * recomputed - the six tiles above it cannot change and are not re-painted.
   */
  function getAdviceRecommendations(profile, windowKey) {
    if (!window.WeatherScopeAdvice || !profile) return null;

    const cache = state.adviceCache;
    if (cache && cache.windowKey === windowKey && cache.recommendations) {
      return cache.recommendations;
    }

    let built = null;
    try {
      built = window.WeatherScopeAdvice.getRecommendations(profile, windowKey);
    } catch (err) {
      console.warn('WeatherScope: the Weather Assistant could not be calculated', err);
      return null;
    }

    if (cache) {
      cache.windowKey = windowKey;
      cache.recommendations = built;
    }
    return built;
  }

  function renderAssistant(data) {
    const card = elements.assistantCard;
    if (!card) return;

    const profile = getAdviceProfile(data);
    const recommendations = getAdviceRecommendations(profile, state.adviceWindowKey);
    if (!profile || !profile.ok || !recommendations || !recommendations.rainWindow) {
      card.hidden = true;
      return;
    }

    card.hidden = false;

    if (elements.assistantScope) {
      elements.assistantScope.textContent = profile.scope === 'next24'
        ? t('assistant.scopeNext24', null, 'Based on the next 24 hours')
        : t('assistant.scopeToday', null, 'Based on the rest of today');
    }

    // --- Headline -----------------------------------------------------------
    const summary = recommendations.summary;
    elements.assistantSummary.dataset.tone = summary.tone || 'unknown';
    elements.assistantSummaryIcon.textContent = summary.icon || '⛅';
    elements.assistantSummaryHeadline.textContent = summary.headline;
    elements.assistantSummaryDetail.textContent = summary.detail || '';

    // --- Tiles --------------------------------------------------------------
    const grid = elements.assistantGrid;
    grid.innerHTML = '';
    window.WeatherScopeAdvice.ADVICE_ORDER.forEach((key) => {
      const tile = recommendations.decisions[key];
      if (!tile) return;

      const el = document.createElement('div');
      el.className = 'assistant-tile';
      el.dataset.tone = tile.tone || 'unknown';
      el.setAttribute('role', 'listitem');

      const icon = document.createElement('span');
      icon.className = 'assistant-tile-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = tile.icon || '';

      const label = document.createElement('span');
      label.className = 'assistant-tile-label';
      label.textContent = tile.label || '';

      const head = document.createElement('div');
      head.className = 'assistant-tile-head';
      head.append(icon, label);

      const headline = document.createElement('p');
      headline.className = 'assistant-tile-headline';
      headline.textContent = tile.headline;

      el.append(head, headline);

      if (tile.detail) {
        const detail = document.createElement('p');
        detail.className = 'assistant-tile-detail';
        detail.textContent = tile.detail;
        el.append(detail);
      }

      grid.appendChild(el);
    });

    renderAssistantWindowTabs();
    renderAssistantWindowAnswer(recommendations);
  }

  function renderAssistantWindowTabs() {
    const container = elements.assistantWindowTabs;
    if (!container || !window.WeatherScopeAdvice) return;

    container.innerHTML = '';
    window.WeatherScopeAdvice.RAIN_WINDOWS.forEach((w) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'assistant-window-tab';
      tab.setAttribute('role', 'radio');
      tab.dataset.windowKey = w.key;
      tab.textContent = w.label;
      tab.setAttribute('aria-checked', w.key === state.adviceWindowKey ? 'true' : 'false');
      tab.tabIndex = w.key === state.adviceWindowKey ? 0 : -1;
      container.appendChild(tab);
    });
  }

  function renderAssistantWindowAnswer(recommendations) {
    const answer = elements.assistantWindowAnswer;
    if (!answer || !recommendations || !recommendations.rainWindow) return;

    const win = recommendations.rainWindow;
    answer.textContent = `${win.headline}. ${win.detail}`.replace(/\s+\./g, '.').trim();
  }

  /**
   * Window switch. Only the answer line is repainted: the six tiles and the
   * headline do not depend on which window is selected.
   */
  function onAssistantWindowChange(key) {
    if (state.adviceWindowKey === key) return;

    const tabs = elements.assistantWindowTabs;
    if (tabs) {
      tabs.querySelectorAll('.assistant-window-tab').forEach((tab) => {
        const isActive = tab.dataset.windowKey === key;
        tab.setAttribute('aria-checked', isActive ? 'true' : 'false');
        tab.tabIndex = isActive ? 0 : -1;
        if (isActive) tab.focus();
      });
    }

    const profile = state.adviceCache ? state.adviceCache.profile : null;
    const recommendations = getAdviceRecommendations(profile, key);
    if (!recommendations) return;

    state.adviceWindowKey = key;
    renderAssistantWindowAnswer(recommendations);
  }

  function renderDailyForecast(daily) {
    elements.dailyList.innerHTML = '';
    if (!daily || !daily.time) return;

    const allMins = daily.temperature_2m_min;
    const allMaxs = daily.temperature_2m_max;
    const globalMin = Math.min(...allMins);
    const globalMax = Math.max(...allMaxs);
    const totalRange = Math.max(globalMax - globalMin, 1);

    daily.time.forEach((dayStr, idx) => {
      const dateObj = new Date(dayStr + 'T12:00:00');
      const isToday = idx === 0;
      const dayName = isToday ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const wmoCode = daily.weather_code[idx];
      const condition = WMO_MAP[wmoCode] || { label: 'Clear', icon: 'clear' };

      const minVal = daily.temperature_2m_min[idx];
      const maxVal = daily.temperature_2m_max[idx];

      const leftPct = Math.max(0, Math.min(100, ((minVal - globalMin) / totalRange) * 100));
      const widthPct = Math.max(8, Math.min(100 - leftPct, ((maxVal - minVal) / totalRange) * 100));

      // Daily UV max + max precipitation probability
      const uvMax = daily.uv_index_max ? daily.uv_index_max[idx] : null;
      const rainProb = daily.precipitation_probability_max
        ? daily.precipitation_probability_max[idx]
        : null;
      const uvInfo = uvMax !== null && uvMax !== undefined ? getUvInfo(uvMax) : null;

      const row = document.createElement('div');
      row.className = 'daily-row';
      row.setAttribute('role', 'listitem');
      row.innerHTML = `
        <div class="daily-day-col">
          <span class="daily-day-name">${dayName}</span>
          <span class="daily-date">${monthDay}</span>
        </div>
        <div class="daily-icon-col">
          ${getWeatherSvg(condition.icon, 1)}
        </div>
        <div class="daily-condition-label">${condition.label}</div>
        <div class="daily-extra-col">
          ${
            uvInfo
              ? `<span class="daily-extra-item daily-uv-item" data-uv-level="${uvInfo.badgeClass}" title="Max UV index">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
                  </svg>
                  <span>UV ${Number(uvMax).toFixed(1)}</span>
                </span>`
              : ''
          }
          ${
            rainProb !== null && rainProb !== undefined
              ? `<span class="daily-extra-item" title="Chance of precipitation">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                  </svg>
                  <span>${Math.round(rainProb)}%</span>
                </span>`
              : ''
          }
        </div>
        <div class="daily-temp-bar-col">
          <span class="daily-min-temp">${formatTemp(minVal)}°</span>
          <div class="daily-bar-track">
            <div class="daily-bar-fill" style="left: ${leftPct}%; width: ${widthPct}%;"></div>
          </div>
          <span class="daily-max-temp">${formatTemp(maxVal)}°</span>
        </div>
      `;
      elements.dailyList.appendChild(row);
    });
  }

// ==========================================================================
  // Shared Forecast Links
  // --------------------------------------------------------------------------
  // A share link is a deep link: the city, the cards that were on screen and the
  // unit travel in the query string, so the recipient opens *this* forecast and
  // not the app's front page. `share.js` owns the format (it is pure and unit
  // tested on its own); everything here is the browser half:
  //
  //   share   -> measure the visible cards, build the link, hand it over
  //   arrival -> parse the link, load that city, ring those cards, scroll to them
  //
  // The ring is deliberately not a filter: the other cards stay readable, so the
  // recipient can see what was shared first and keep exploring afterwards.
  // ==========================================================================
  function shareEngine() {
    return window.WeatherScopeShare || null;
  }

  /** Card key -> its section element. One key, one element, both directions. */
  function shareCardNode(key) {
    const map = {
      glance: elements.glanceCard,
      hero: elements.heroCard,
      assistant: elements.assistantCard,
      metrics: elements.metricsCard,
      hourly: elements.hourlyCard,
      daily: elements.dailyCard,
    };
    return map[key] || null;
  }

  /**
   * Which cards is the sender actually looking at? Sharing what is on screen is
   * the honest reading of "share this forecast": someone who scrolled down to
   * the hourly strip shares the hourly strip, not six cards they never saw.
   *
   * Falls back to the whole dashboard whenever the page cannot be measured
   * (the dashboard is hidden, or there is no layout engine yet), so the link
   * never ends up pointing at nothing.
   */
  function visibleShareCards() {
    const share = shareEngine();
    const allCards = share ? share.CARD_KEYS.slice() : ['glance'];
    const viewportHeight = window.innerHeight || 0;
    const visible = [];
    let measured = 0;

    allCards.forEach((key) => {
      const node = shareCardNode(key);
      if (!node || node.hidden) return;
      if (typeof node.getBoundingClientRect !== 'function') return;

      const rect = node.getBoundingClientRect();
      if (!rect || (rect.height === 0 && rect.width === 0)) return;
      measured++;
      if (rect.bottom > 0 && rect.top < viewportHeight) visible.push(key);
    });

    if (measured === 0) return allCards;
    // Scrolled past the dashboard entirely: share the card the page opens on.
    return visible.length ? visible : [allCards[0]];
  }

  /** The current city and view, as one deep-link payload. */
  function currentSharePayload() {
    const city = state.currentCity || {};
    const data = state.weatherData || {};
    return {
      city: city.name,
      region: city.admin1,
      country: city.country,
      latitude: city.latitude,
      longitude: city.longitude,
      timezone: data.timezone || city.timezone || '',
      cards: visibleShareCards(),
      unit: state.unit === 'fahrenheit' ? 'f' : 'c',
      windowKey: state.adviceWindowKey,
    };
  }

  /**
   * Clipboard write with a fallback for browsers (and insecure origins) where
   * the async Clipboard API is unavailable. Resolves to whether the text made
   * it, because the caller tells the visitor either way.
   */
  function copyShareText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    let area = null;
    try {
      area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '0';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(area);
      return !!copied;
    } catch (e) {
      if (area && area.parentNode) area.parentNode.removeChild(area);
      return false;
    }
  }

  /**
   * Confirms a share in the one place every visitor can perceive: a live region
   * for screen readers and a visible state on the icon button for everyone else.
   */
  function announceShare(message) {
    if (elements.shareStatus) elements.shareStatus.textContent = message;

    const btn = elements.shareBtn;
    if (!btn) return;

    btn.classList.add('is-confirmed');
    window.clearTimeout(shareConfirmTimer);
    shareConfirmTimer = window.setTimeout(function () {
      btn.classList.remove('is-confirmed');
    }, 2000);
  }

  /**
   * Last resort when the clipboard is unavailable: put the deep link in the
   * address bar so it can still be copied by hand. Reported back to the caller
   * because `replaceState` is refused on some `file://` pages.
   */
  function showShareUrlInAddressBar(url) {
    try {
      window.history.replaceState(null, '', url);
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Does a payload still describe the city that is on screen? */
  function isSameSharedCity(payload, city) {
    if (!payload || !city) return false;
    const lat = Number(city.latitude);
    const lon = Number(city.longitude);
    if (payload.latitude !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
      return Math.abs(lat - payload.latitude) < 0.01 && Math.abs(lon - payload.longitude) < 0.01;
    }
    return String(payload.city).toLowerCase() === String(city.name || '').toLowerCase();
  }

  /**
   * Drops the shared view. Called when the recipient decides the shared cards
   * are not the point - either by picking another city or by pressing "Show all
   * cards" - so a ring and a banner can never outlive what they describe.
   */
  function clearSharedView() {
    if (!state.sharedPayload) return;
    state.sharedPayload = null;

    shareEngineKeys().forEach(function (key) {
      const node = shareCardNode(key);
      if (node) node.classList.remove('is-shared');
    });

    if (elements.sharedBanner) elements.sharedBanner.hidden = true;
  }

  function shareEngineKeys() {
    const share = shareEngine();
    return share ? share.CARD_KEYS.slice() : ['glance'];
  }

  /** Rings the shared cards, scrolls the first one into view, fills the banner. */
  function revealSharedCards(payload) {
    const share = shareEngine();
    const cards = share ? share.sanitizeCards(payload.cards) : ['glance'];

    cards.forEach(function (key) {
      const node = shareCardNode(key);
      if (node) node.classList.add('is-shared');
    });

    if (elements.sharedBannerCity) {
      elements.sharedBannerCity.textContent = share
        ? share.describePlace(payload)
        : payload.city;
    }
    if (elements.sharedBannerCards) {
      elements.sharedBannerCards.textContent = share
        ? share.describeCards(cards)
        : '';
    }
    if (elements.sharedBanner) elements.sharedBanner.hidden = false;

    const first = shareCardNode(cards[0]);
    if (first && typeof first.scrollIntoView === 'function') {
      // 'auto' under reduced motion: the ring and the banner already say what
      // arrived, so the scroll does not need to be an animation.
      const reduceMotion = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      first.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }

    announceShare('Shared forecast for ' + (share ? share.describePlace(payload) : payload.city) +
      '. Showing ' + (share ? share.describeCards(cards) : '') + '.');
  }

  /**
   * Opening a shared link. Unit first, because every number in the message that
   * came with the link is in the sender's unit; then the city; and only once the
   * cards exist do they get ringed.
   *
   * The saved city and the default city are deliberately *not* consulted first:
   * the whole point of the link is that it decides which city is on screen.
   */
  function applySharedLink(payload) {
    const share = shareEngine();
    if (!share || !payload) return false;

    // Driven through the same buttons the visitor uses, so there is still only
    // one code path that can change the unit.
    if (payload.unit === 'f' && elements.unitF) elements.unitF.click();
    if (payload.unit === 'c' && elements.unitC) elements.unitC.click();

    const windows = window.WeatherScopeAdvice && window.WeatherScopeAdvice.RAIN_WINDOWS;
    const knownWindow = windows && windows.some(function (w) { return w.key === payload.windowKey; });
    if (knownWindow) state.adviceWindowKey = payload.windowKey;

    const city = {
      name: payload.city,
      admin1: payload.region || '',
      country: payload.country || '',
      latitude: payload.latitude,
      longitude: payload.longitude,
      timezone: payload.timezone || 'auto',
    };

    state.sharedPayload = payload;

    // Coordinates travel with the link, so the shared city is the shared city -
    // no re-geocoding, and no risk of the name matching somewhere else. A
    // hand-edited link without coordinates falls back to the search box.
    const hasCoords = payload.latitude !== null && payload.longitude !== null;
    const pending = hasCoords ? loadCityWeather(city) : handleCitySearch(payload.city);

    return Promise.resolve(pending).then(function () {
      // The load can be superseded, or can fail; either way the ring must only
      // land on the forecast the link asked for.
      if (state.sharedPayload !== payload || !state.currentCity) return false;
      revealSharedCards(payload);
      return true;
    });
  }

// ==========================================================================
// Climate Search Results Rendering
// ==========================================================================
  const CARD_TEMPLATE = `
    <div class="city-result-top">
      <div>
        <h3 class="city-result-name" data-ref="name"></h3>
        <p class="city-result-country" data-ref="country"></p>
      </div>
      <div class="city-result-time">
        <span class="city-result-clock" data-ref="clock"></span>
        <span class="city-result-clock-seconds" data-ref="clockSeconds"></span>
      </div>
    </div>

    <div class="city-result-timezone">
      <span class="city-result-timezone-abbr" data-ref="zoneAbbr"></span>
      <span class="city-result-timezone-diff" data-ref="offsetDiff"></span>
    </div>

    <div class="city-result-middle">
      <div class="city-result-temp-group">
        <span class="city-result-temp" data-ref="temp"></span>
        <span class="city-result-temp-unit" data-ref="tempUnit"></span>
      </div>
      <div class="city-result-icon" data-ref="icon"></div>
    </div>

    <div class="city-result-condition">
      <span data-ref="condition"></span>
    </div>

    <div class="city-result-stats">
      <div class="city-result-stat-item" title="Relative Humidity">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
        <span data-ref="humidity"></span>
      </div>
      <div class="city-result-stat-item" title="Wind Speed">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2" />
        </svg>
        <span data-ref="wind"></span>
      </div>
    </div>

    <div class="city-result-footer">
      <span class="action-link">
        View Weather Details
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
          <path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd" />
        </svg>
      </span>
    </div>
  `;

  /**
   * Build (or reuse) a result card for a city entry.
   * Cards are cached by city id so re-sorting and unit switching only reorder
   * existing DOM nodes instead of rebuilding ~72 cards of inline SVG.
   */
  function createResultCard(entry, cache) {
    const city = entry.city;
    let refs = cache.get(city.id);

    if (!refs) {
      const card = document.createElement('div');
      card.className = 'city-result-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML = CARD_TEMPLATE;

      refs = {
        card,
        name: card.querySelector('[data-ref="name"]'),
        country: card.querySelector('[data-ref="country"]'),
        temp: card.querySelector('[data-ref="temp"]'),
        tempUnit: card.querySelector('[data-ref="tempUnit"]'),
        icon: card.querySelector('[data-ref="icon"]'),
        condition: card.querySelector('[data-ref="condition"]'),
        humidity: card.querySelector('[data-ref="humidity"]'),
        wind: card.querySelector('[data-ref="wind"]'),
        clock: card.querySelector('[data-ref="clock"]'),
        clockSeconds: card.querySelector('[data-ref="clockSeconds"]'),
        zoneAbbr: card.querySelector('[data-ref="zoneAbbr"]'),
        offsetDiff: card.querySelector('[data-ref="offsetDiff"]'),
      };

      // Register this card's clock with the shared ticker. The zone is filled in
      // by updateResultCard below; clockId lets us re-register (never duplicate)
      // if the cached card is re-rendered for a different zone.
      refs.clockId = null;

      const select = () => loadCityWeather(city);
      card.addEventListener('click', select);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      });

      cache.set(city.id, refs);
    }

    return refs;
  }

  /** Push the live values into a card. All API strings go through textContent. */
  function updateResultCard(refs, entry) {
    const city = entry.city;
    const current = entry.current;
    const condition = WMO_MAP[current.weather_code] || { label: 'Clear', icon: 'clear' };

    refs.name.textContent = city.name;
    refs.country.textContent = city.admin1 ? `${city.admin1}, ${city.country}` : city.country;
    refs.condition.textContent = condition.label;

    refs.icon.innerHTML = getWeatherSvg(condition.icon, current.is_day);
    refs.icon.setAttribute('aria-hidden', 'true');

    const humidity = current.relative_humidity_2m;
    refs.humidity.textContent = humidity === null || humidity === undefined ? '--' : `${humidity}%`;

    refs.wind.textContent = `${formatWindSpeed(current.wind_speed_10m)} ${getWindUnitSymbol()}`;
    refs.temp.textContent = formatTemp(current.temperature_2m);
    refs.tempUnit.textContent = getTempUnitSymbol();

    // --- Live local time for this city ---
    const zone = city.timezone || 'UTC';
    const now = new Date();

    refs.zoneAbbr.textContent = getZoneAbbreviation(zone, now);
    refs.zoneAbbr.title = `${zone} - ${formatOffsetLabel(zone, now)}`;

    const isSameTime = getOffsetDiffMinutes(zone, now) === 0;
    refs.offsetDiff.textContent = describeTimeDifference(zone, now);
    refs.offsetDiff.title = `Offset vs you (${USER_TIME_ZONE}): ${formatOffsetDiffCompact(zone, now)}`;
    refs.offsetDiff.classList.toggle('is-same', isSameTime);

    // Seed the first frame synchronously so the card never shows a placeholder,
    // then hand the card to the shared ticker for the per-second updates.
    refs.clock.textContent = '00:00';
    refs.clockSeconds.textContent = '00';

    if (refs.clockId !== null) unregisterClock(refs.clockId);
    refs.clockId = registerClock(zone, new Map([
      [hideVolatileNode(refs.clock), (tz, tick) => {
        const parts = getZonedParts(tz, tick);
        refs.clock.textContent = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
      }],
      [hideVolatileNode(refs.clockSeconds), (tz, tick) => {
        const parts = getZonedParts(tz, tick);
        const seconds = pad2(parts.second);
        if (refs.clockSeconds.textContent === seconds) return;
        refs.clockSeconds.textContent = seconds;
        refs.clockSeconds.classList.remove('tick');
        void refs.clockSeconds.offsetWidth;
        refs.clockSeconds.classList.add('tick');
      }],
    ]), () => !elements.climateResultsSection.classList.contains('hidden'));

    // Zone and offset siblings stay exposed to assistive tech - they only change
    // on a city switch, not every second.
    refs.card.setAttribute(
      'aria-label',
      `View weather for ${city.name}, ${city.country}. ${condition.label}, ` +
      `${formatTemp(current.temperature_2m)}${getTempUnitSymbol()}. ` +
      `Local time zone ${zone}, ${describeTimeDifference(zone, now)}.`
    );
  }

  // ==========================================================================
  // Adaptive Result Sorting
  // --------------------------------------------------------------------------
  // The sort dropdown mirrors the active climate filter instead of offering a
  // fixed list. Every measurement the filter actually constrains becomes a
  // sortable axis in both directions, so a "Gale" search offers wind ordering
  // and nothing else, while "Beach Day" (clear skies + warm) offers temperature
  // ordering. City name is unconditional - every city has one.
  // ==========================================================================
  const SORT_DIMENSIONS = [
    {
      key: 'temp',
      label: 'Temperature',
      applies: (criteria) => criteria.tempMin !== null || criteria.tempMax !== null,
      value: (entry) => entry.current.temperature_2m,
    },
    {
      key: 'humidity',
      label: 'Humidity',
      applies: (criteria) => criteria.minHumidity !== null || criteria.maxHumidity !== null,
      value: (entry) => entry.current.relative_humidity_2m,
    },
    {
      key: 'wind',
      label: 'Wind speed',
      applies: (criteria) => criteria.minWind !== null,
      value: (entry) => entry.current.wind_speed_10m,
    },
  ];

  /** Build the option list for a given filter: relevant axes first, names last. */
  function buildSortOptions(criteria) {
    const options = SORT_DIMENSIONS.filter((dimension) => dimension.applies(criteria)).flatMap(
      (dimension) => [
        { value: `${dimension.key}-desc`, label: t('climate.sortHighToLow', { label: t(`climate.sort${dimension.key === 'temp' ? 'Temperature' : dimension.key === 'humidity' ? 'Humidity' : 'Wind'}`, null, dimension.label) }, `${dimension.label} (higher to lower)`) },
        { value: `${dimension.key}-asc`, label: t('climate.sortLowToHigh', { label: t(`climate.sort${dimension.key === 'temp' ? 'Temperature' : dimension.key === 'humidity' ? 'Humidity' : 'Wind'}`, null, dimension.label) }, `${dimension.label} (lower to higher)`) },
      ]
    );

    // Name sorting needs no filter to justify it and no reading to resolve it,
    // so it stays available for purely categorical filters (Sunny, Storm, ...)
    options.push({ value: 'name-asc', label: t('climate.sortNameAsc', null, 'City name (A-Z)') });
    options.push({ value: 'name-desc', label: t('climate.sortNameDesc', null, 'City name (Z-A)') });

    return options;
  }

  /** True when a filter caps a value but never raises a floor (e.g. "< 2°C"). */
  function hasCeilingOnly(min, max) {
    return min === null && max !== null;
  }

  /**
   * Default selection for a freshly built option list: the leading measurement,
   * oriented so the filter's own bounds read naturally. A ceiling-only filter
   * (Freezing, Cold, Dry) leads with its lowest values; everything else leads
   * with its highest, which also preserves the historical "warmest first"
   * default for the temperature bands.
   */
  function preferredSortValue(criteria) {
    if (criteria.tempMin !== null || criteria.tempMax !== null) {
      return hasCeilingOnly(criteria.tempMin, criteria.tempMax) ? 'temp-asc' : 'temp-desc';
    }
    if (criteria.minHumidity !== null || criteria.maxHumidity !== null) {
      return hasCeilingOnly(criteria.minHumidity, criteria.maxHumidity) ? 'humidity-asc' : 'humidity-desc';
    }
    if (criteria.minWind !== null) return 'wind-desc';
    return 'name-asc';
  }

  /**
   * Rebuild the dropdown for the current filter. An explicit user choice is
   * preserved whenever its axis is still offered, so re-renders triggered by a
   * unit toggle or a fresh search do not silently discard the selection.
   */
  function syncSortOptions(criteria) {
    const select = elements.climateSortSelect;
    if (!select) return;

    const options = buildSortOptions(criteria);
    if (!options.some((option) => option.value === state.sortOrder)) {
      state.sortOrder = preferredSortValue(criteria);
    }

    select.innerHTML = '';
    options.forEach(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = state.sortOrder;
  }

  /** Deterministic tie-breaker, also the comparator for name-only sorts. */
  function compareCityNames(a, b) {
    const locale = window.I18n && typeof window.I18n.locale === 'function'
      ? window.I18n.locale()
      : 'en';
    return a.city.name.localeCompare(b.city.name, locale);
  }

  function sortClimateEntries(entries, sortValue) {
    const [metricKey, direction] = String(sortValue || 'name-asc').split('-');
    const metric = SORT_DIMENSIONS.find((dimension) => dimension.key === metricKey);
    const sign = direction === 'desc' ? -1 : 1;

    return [...entries].sort((a, b) => {
      // With no metric to look up, the name *is* the value being ordered, so the
      // direction has to apply to the name comparison itself.
      if (!metric) return compareCityNames(a, b) * sign;

      const valueA = metric.value(a);
      const valueB = metric.value(b);
      const missingA = valueA === null || valueA === undefined || Number.isNaN(valueA);
      const missingB = valueB === null || valueB === undefined || Number.isNaN(valueB);

      // A missing reading always sinks to the bottom, in either direction. The
      // previous `?? -999` sentinel made an absent temperature look like the
      // coldest reading on earth and floated such cities to the top of
      // "coldest first".
      if (missingA || missingB) {
        if (missingA && missingB) return compareCityNames(a, b);
        return missingA ? 1 : -1;
      }

      // Equal readings would otherwise reorder between renders.
      return valueA === valueB ? compareCityNames(a, b) : (valueA - valueB) * sign;
    });
  }

  function renderClimateResults(matchingEntries, criteria) {
    state.matchingCities = matchingEntries;

    // Hide dashboard and errors
    elements.dashboard.classList.add('hidden');
    elements.backToResultsBar.classList.add('hidden');
    elements.loadingState.classList.add('hidden');
    elements.errorState.classList.add('hidden');

    // Title and Count
    elements.climateResultsTitle.textContent = t('climate.resultsTitle', null, 'Cities matching climate conditions');
    elements.climateResultsCount.textContent = tp(
      'climate.foundOne', 'climate.foundMany', matchingEntries.length, null,
      `${matchingEntries.length} city found`, `${matchingEntries.length} cities found`
    );

    // Be explicit that results are scoped to the curated benchmark dataset
    elements.climateResultsSubtitle.textContent = t(
      'climate.resultsSubtitle',
      { count: WORLD_CITIES.length },
      `Searched ${WORLD_CITIES.length} benchmark cities worldwide. ` +
      'Click any city to explore its detailed real-time weather and 7-day outlook.'
    );

    // Active tags - criteria.tokens is preserved across sort/unit re-renders
    // because callers re-parse with state.activeFilterTags (#1)
    elements.climateActiveTags.innerHTML = '';
    criteria.tokens.forEach((token) => {
      const tag = document.createElement('span');
      tag.className = 'active-tag';
      tag.textContent = token;
      elements.climateActiveTags.appendChild(tag);
    });

    // The dropdown mirrors the active filter, so it is rebuilt here - before the
    // ordering - and re-validates state.sortOrder against the new option list.
    syncSortOptions(criteria);

    const sorted = sortClimateEntries(matchingEntries, state.sortOrder);

    // Remove any previous empty-state node before rebuilding
    const staleEmpty = elements.climateResultsGrid.querySelector('.climate-empty-state');
    if (staleEmpty) staleEmpty.remove();

    if (sorted.length === 0) {
      // Drop cached cards so a later match set rebuilds cleanly
      elements.climateResultsGrid.innerHTML = '';
      state.resultCards.forEach((refs) => {
        if (refs.clockId !== null) unregisterClock(refs.clockId);
      });
      state.resultCards.clear();

      const empty = document.createElement('div');
      empty.className = 'climate-empty-state';
      empty.innerHTML = `
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto; color: var(--text-muted);">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 15h8M9 9h.01M15 9h.01"/>
        </svg>
      `;
      const msg1 = document.createElement('p');
      msg1.textContent = `No cities in the ${WORLD_CITIES.length}-city benchmark dataset currently match this exact climate criteria.`;
      const msg2 = document.createElement('p');
      msg2.style.fontSize = '0.85rem';
      msg2.style.color = 'var(--text-muted)';
      msg2.style.marginTop = '4px';
      msg2.textContent = 'Try a broader condition like "Sunny", "Warm", or "Cloudy".';
      empty.appendChild(msg1);
      empty.appendChild(msg2);
      elements.climateResultsGrid.appendChild(empty);
    } else {
      const liveIds = new Set();

      sorted.forEach((entry) => {
        const refs = createResultCard(entry, state.resultCards);
        updateResultCard(refs, entry);
        // appendChild moves an existing node, so this is the "reorder" path
        elements.climateResultsGrid.appendChild(refs.card);
        liveIds.add(entry.city.id);
      });

      // Evict cards for cities that are no longer in the result set
      state.resultCards.forEach((refs, id) => {
        if (!liveIds.has(id)) {
          refs.card.remove();
          if (refs.clockId !== null) unregisterClock(refs.clockId);
          state.resultCards.delete(id);
        }
      });
    }

    // Respect the mode actually on screen: a climate search that lands after
    // the visitor moved to Compare must not push its results over it.
    if (state.searchMode !== 'compare') {
      elements.climateResultsSection.classList.remove('hidden');
    }
  }

  // ==========================================================================
  // Compare Locations
  // --------------------------------------------------------------------------
  // A third mode alongside City Search and Climate Filter. It answers one
  // question - "what's the weather like in these places, and how different are
  // they?" - and deliberately stops there:
  //
  //   * the picker reuses the existing geocoding autocomplete and the existing
  //     popular-city chips, so no new input control is introduced;
  //   * the numbers come from the same Open-Meteo endpoint through the same
  //     `fetchJson` timeout/abort plumbing, and a city already on the dashboard
  //     reuses its payload instead of refetching;
  //   * every value is rendered through the app's own unit formatters and its
  //     single WMO_MAP, so the degC/degF toggle and the existing icons apply
  //     here with no separate setting and no second condition mapping;
  //   * `compare.js` owns the location list, the metric definitions, the
  //     thresholds and the insight sentences - this layer only fetches and
  //     paints.
  // ==========================================================================

  /** The engine, or null if the script failed to load. */
  function compareEngine() {
    return window.WeatherScopeCompare || null;
  }

  /** Slot captions: "Location A" ... "Location D". */
  const COMPARE_SLOT_LABELS = ['A', 'B', 'C', 'D'];

  /**
   * How a row extreme is announced and drawn.
   *
   * `glyph` is the redundant, non-colour cue (WCAG 1.4.1): the pill is already
   * white-on-green / white-on-red, and the arrow keeps the two apart in
   * greyscale, for colour-blind readers and on a washed-out screen.
   */
  const COMPARE_EMPHASIS = {
    high: { word: 'highest', glyph: '▲' },
    low: { word: 'lowest', glyph: '▼' },
  };

  // Picker row icons. Static markup, matching the inline 24px stroke style used
  // elsewhere in the app; `compareIconButton` sets an accessible name on the
  // button itself, so these stay aria-hidden by inheriting the button's label.
  const ICON_ARROW_UP = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const ICON_ARROW_DOWN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  /**
   * Formatters handed to `compare.js`. Every one of them already follows the
   * global degC/degF toggle, which is how the comparison stays unit-consistent
   * with the dashboard without owning any unit logic of its own.
   */
  function compareFormat() {
    const tempSymbol = getTempUnitSymbol();
    const windSymbol = getWindUnitSymbol();

    return {
      temp: (value) => (value === null || value === undefined || isNaN(value) ? '--' : `${formatTemp(value)}${tempSymbol}`),
      // A gap is shown in the active unit, so degF mode reports the Fahrenheit
      // equivalent of the Celsius difference.
      tempGap: (degC) => (degC === null || degC === undefined || isNaN(degC) ? '--' : `${formatTemp(degC)}${tempSymbol}`),
      wind: (value) => (value === null || value === undefined || isNaN(value) ? '--' : `${formatWindSpeed(value)} ${windSymbol}`),
      windGap: (kmh) => (kmh === null || kmh === undefined || isNaN(kmh) ? '--' : formatWindSpeed(kmh)),
      precip: (value) => (value === null || value === undefined || isNaN(value) ? '--' : `${formatPrecip(value)} ${getPrecipUnitSymbol()}`),
      percent: (value) => (value === null || value === undefined || isNaN(value) ? '--' : `${Math.round(value)}%`),
      uv: (value) => (value === null || value === undefined || isNaN(value) ? '--' : Number(value).toFixed(1)),
      windSymbol,
      // The one place a WMO code becomes text: the app's existing mapping.
      conditionLabel: (code) => {
        if (code === null || code === undefined) return '--';
        return conditionText(code);
      },
    };
  }

  /** "Athens, Greece" via the existing WMO/icon helpers, or a neutral glyph. */
  function compareConditionIcon(entry) {
    const code = entry && entry.current ? entry.current.weather_code : null;
    const isDay = entry && entry.current && entry.current.is_day !== undefined ? entry.current.is_day : 1;
    const info = WMO_MAP[code] || { icon: 'clear' };
    return getWeatherSvg(info.icon, isDay);
  }

  // --- Selection ------------------------------------------------------------

  function setCompareLocations(locations) {
    state.compareLocations = locations;
    renderCompareSection();
  }

  /**
   * Add a place to the comparison, reporting the engine's refusal (duplicate /
   * list full) in the polite notice region rather than failing silently.
   *
   * When a slot is mid-re-pick this replaces it in place instead of appending,
   * which is what makes "replace a location" work through the one shared
   * search box.
   */
  function addCompareLocation(city) {
    const engine = compareEngine();
    if (!engine || !city) return false;

    const replacing = state.compareReplaceIndex;

    if (replacing !== null) {
      // The slot can vanish under us (removed while re-picking).
      if (replacing < 0 || replacing >= state.compareLocations.length) {
        state.compareReplaceIndex = null;
        setCompareNotice('');
        return false;
      }

      const current = state.compareLocations[replacing];
      // Re-picking the place already in this slot is a no-op, not an error.
      if (current && engine.isSameCity(current.city, city)) {
        cancelCompareReplace();
        return false;
      }

      // The new place must not collide with one of the *other* slots.
      const collides = state.compareLocations.some(
        (slot, index) => index !== replacing && engine.isSameCity(slot.city, city)
      );
      if (collides) {
        setCompareNotice(`${city.name} is already in your comparison.`);
        return false;
      }

      const replaced = engine.replaceLocation(state.compareLocations, replacing, city);
      state.compareReplaceIndex = null;
      setCompareNotice('');
      setCompareLocations(replaced);
      return true;
    }

    const result = engine.addLocation(state.compareLocations, city);
    if (!result.added) {
      setCompareNotice(
        result.reason === 'duplicate'
          ? `${city.name} is already in your comparison.`
          : result.reason === 'full'
            ? `You can compare up to ${engine.THRESHOLDS.maxLocations} locations. Remove one to add another.`
            : 'That location could not be added to the comparison.'
      );
      return false;
    }

    setCompareNotice('');
    setCompareLocations(result.locations);
    return true;
  }

  /** Start re-picking the place in a slot. */
  function beginCompareReplace(index) {
    const slot = state.compareLocations[index];
    if (!slot || !slot.city) return;

    state.compareReplaceIndex = index;
    setCompareNotice(
      `Choosing a new location for Location ${COMPARE_SLOT_LABELS[index] || index + 1} (currently ${slot.city.name}). Press Escape to cancel.`
    );
    closeAutocomplete();
    elements.searchInput.focus();
    elements.searchInput.select();
  }

  /** Abandon a re-pick; the slot keeps whatever it already held. */
  function cancelCompareReplace() {
    if (state.compareReplaceIndex === null) return;
    state.compareReplaceIndex = null;
    setCompareNotice('');
  }

  function removeCompareLocation(index) {
    const engine = compareEngine();
    if (!engine) return;

    setCompareNotice('');
    state.compareReplaceIndex = null;
    setCompareLocations(engine.removeLocation(state.compareLocations, index));
  }

  function moveCompareLocation(index, delta) {
    const engine = compareEngine();
    if (!engine) return;

    setCompareLocations(engine.moveLocation(state.compareLocations, index, delta));
  }

  function clearCompareLocations() {
    const engine = compareEngine();
    if (!engine) return;

    setCompareNotice('');
    state.compareReplaceIndex = null;
    abortComparison();
    setCompareLocations(engine.clearLocations());
  }

  function setCompareNotice(message) {
    if (elements.compareNotice) elements.compareNotice.textContent = message || '';
  }

  /**
   * Resolve a typed query in compare mode.
   *
   * Mirrors `handleCitySearch`, including its disambiguation list, but adds the
   * place instead of replacing the dashboard.
   */
  async function handleCompareSearch(query) {
    try {
      const cities = await searchCities(query);
      if (!cities || cities.length === 0) {
        setCompareNotice(`No results found for "${query}". Try a different spelling or add a country.`);
        return;
      }

      if (cities.length > 1) {
        showAutocomplete(cities, { disambiguate: true });
        elements.autocompleteList.classList.remove('hidden');
        elements.searchInput.focus();
        return;
      }

      addCompareLocation(cities[0]);
      resetCompareSearchInput();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Comparison search error:', err);
      setCompareNotice(
        /timed out/i.test(err.message || '')
          ? 'The location search timed out. Check your connection and try again.'
          : 'The location search failed. Please try again.'
      );
    }
  }

  /** Clear the search box after a place has been committed to a slot. */
  function resetCompareSearchInput() {
    elements.searchInput.value = '';
    elements.clearBtn.classList.add('hidden');
  }

  // --- Data fetching --------------------------------------------------------

  /**
   * Weather for one comparison column.
   *
   * A city the visitor is already looking at on the dashboard reuses that
   * payload verbatim - no second request for data we already hold.
   */
  async function fetchCompareColumn(city, signal) {
    if (
      state.currentCity &&
      state.weatherData &&
      compareEngine() &&
      compareEngine().isSameCity(state.currentCity, city)
    ) {
      return state.weatherData;
    }
    return fetchComparisonWeather(city, signal);
  }

  function abortComparison() {
    if (state.compareController) state.compareController.abort();
    state.compareController = null;
  }

  /**
   * Fetch every selected location in parallel and paint the result.
   *
   * `Promise.allSettled` is deliberate: one timeout or one network error must
   * degrade that single column to a retry affordance, never blank the whole
   * comparison. `retryIndex` re-fetches exactly one column.
   */
  async function loadComparisonWeather(options = {}) {
    const engine = compareEngine();
    const locations = state.compareLocations;
    if (!engine || !engine.canCompare(locations)) {
      renderCompareSection();
      return;
    }

    const targets = options.retryIndex === undefined
      ? locations.map((_, index) => index)
      : [options.retryIndex];
    const isRetry = options.retryIndex !== undefined;

    if (!isRetry) abortComparison();
    const controller = new AbortController();
    if (!isRetry) state.compareController = controller;
    const seq = ++state.compareSeq;

    // Clear the previously fetched data for the columns being refetched, so a
    // retry shows the loading state instead of stale numbers.
    const pending = state.compareLocations.map((slot, index) =>
      targets.includes(index) ? { ...slot, weather: null, error: null } : slot
    );
    setCompareLocations(pending);

    elements.compareLoadingText.textContent = isRetry
      ? `Retrying ${locations[options.retryIndex].city.name}...`
      : `Comparing weather in ${locations.length} locations...`;
    elements.compareLoading.classList.remove('hidden');
    elements.mainContent.setAttribute('aria-busy', 'true');

    const results = await Promise.allSettled(
      targets.map((index) => fetchCompareColumn(locations[index].city, controller.signal))
    );

    // A newer comparison superseded this one while the requests were in flight.
    if (seq !== state.compareSeq) return;

    const settled = state.compareLocations.map((slot, index) => {
      const position = targets.indexOf(index);
      if (position === -1) return slot;
      const result = results[position];
      if (result.status === 'fulfilled') {
        return { ...slot, weather: result.value, error: null };
      }
      if (result.reason && result.reason.name === 'AbortError') return slot;
      return {
        ...slot,
        weather: null,
        error: /timed out/i.test((result.reason && result.reason.message) || '')
          ? 'Request timed out after 12 seconds'
          : 'Weather data unavailable',
      };
    });

    elements.compareLoading.classList.add('hidden');
    elements.mainContent.setAttribute('aria-busy', 'false');
    if (!isRetry) state.compareController = null;

    setCompareLocations(settled);
  }

  // --- Rendering ------------------------------------------------------------

  /** Is the comparison surface the one currently on screen? */
  function isCompareVisible() {
    return !!elements.compareSection && !elements.compareSection.classList.contains('hidden');
  }

  /**
   * Paint the whole compare surface from `state.compareLocations`.
   *
   * Everything below reuses the engine's already-shaped output, so there is no
   * comparison logic left in the DOM layer beyond "put this text in that cell".
   */
  function renderCompareSection() {
    const engine = compareEngine();
    if (!engine) return;

    renderCompareSlots();

    const comparable = engine.canCompare(state.compareLocations);
    elements.compareRunBtn.disabled = !comparable;
    elements.compareAddBtn.disabled = !engine.canAddMore(state.compareLocations);
    elements.compareClearBtn.disabled = state.compareLocations.length === 0;
    elements.compareCount.textContent = `${state.compareLocations.length} of ${engine.THRESHOLDS.maxLocations} selected`;

    const hasData = state.compareLocations.some((slot) => slot && slot.weather);
    const hasError = state.compareLocations.some((slot) => slot && slot.error);

    elements.compareGlanceCard.classList.toggle('hidden', !hasData && !hasError);
    elements.compareCurrentCard.classList.toggle('hidden', !hasData && !hasError);
    elements.compareForecastCard.classList.toggle('hidden', !hasData);

    if (!hasData && !hasError) return;

    const format = compareFormat();
    const current = engine.buildTable(state.compareLocations, format);
    const forecast = engine.buildForecastTable(state.compareLocations, format);

    renderCompareTable(elements.compareCurrentTable, current);
    renderCompareTable(elements.compareForecastTable, forecast);
    renderCompareInsights(engine.buildInsights(state.compareLocations, format), current);
    renderCompareFreshness(state.compareLocations);
  }

  /**
   * The location picker.
   *
   * Rows are rebuilt only when the list actually changes shape (added, removed,
   * replaced, reordered); the per-second clock inside each header is registered
   * with the app's existing ticker rather than given a timer of its own.
   */
  function renderCompareSlots() {
    const container = elements.compareSlots;
    const locations = state.compareLocations;

    const signature = locations
      .map((slot) => (slot && slot.city ? `${slot.city.name}|${slot.city.latitude}|${slot.city.longitude}` : '-'))
      .join('~');
    if (container.dataset.signature === signature) return;

    container.dataset.signature = signature;
    unregisterCompareClocks();
    container.innerHTML = '';

    const engine = compareEngine();
    const max = engine ? engine.THRESHOLDS.maxLocations : 4;

    locations.forEach((slot, index) => {
      const row = document.createElement('div');
      row.className = 'compare-slot';

      const label = document.createElement('span');
      label.className = 'compare-slot-label';
      label.id = `compare-slot-${index}`;
      label.textContent = `Location ${COMPARE_SLOT_LABELS[index] || index + 1}`;
      row.appendChild(label);

      if (slot && slot.city) {
        row.appendChild(createComparePlaceButton(slot.city, index));
      }

      const actions = document.createElement('div');
      actions.className = 'compare-slot-actions';
      actions.append(
        compareIconButton('Move earlier', ICON_ARROW_UP, () => moveCompareLocation(index, -1), index === 0),
        compareIconButton('Move later', ICON_ARROW_DOWN, () => moveCompareLocation(index, 1), index === locations.length - 1),
        slot && slot.city
          ? compareIconButton(`Remove ${slot.city.name} from the comparison`, ICON_TRASH, () => removeCompareLocation(index), false)
          : compareIconButton('Clear this location', ICON_CLOSE, () => removeCompareLocation(index), false)
      );
      row.appendChild(actions);

      container.appendChild(row);
    });

    // Show the remaining capacity as empty placeholders, so the 2-4 range and
    // the "add" affordance are visible before the list is full.
    for (let index = locations.length; index < max; index += 1) {
      const empty = document.createElement('div');
      empty.className = 'compare-slot-empty';

      const text = document.createElement('span');
      text.textContent = `Location ${COMPARE_SLOT_LABELS[index] || index + 1} — use the search above or a popular city`;

      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'compare-retry-btn';
      add.textContent = 'Add';
      add.addEventListener('click', focusCompareSearch);

      empty.append(text, add);
      container.appendChild(empty);
    }
  }

  /** Clock registrations owned by the comparison table headers. */
  let compareClockIds = [];

  function unregisterCompareClocks() {
    compareClockIds.forEach((id) => unregisterClock(id));
    compareClockIds = [];
  }

  /**
   * The place chip inside a picker row. Clicking it focuses the search box so
   * the existing autocomplete can replace the location - no separate picker UI.
   */
  function createComparePlaceButton(city, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'compare-slot-place';
    button.setAttribute('aria-describedby', `compare-slot-${index}`);

    const badge = document.createElement('span');
    badge.className = 'compare-slot-place-icon';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = String(index + 1);

    const text = document.createElement('span');
    text.className = 'compare-slot-place-text';

    const name = document.createElement('span');
    name.className = 'compare-slot-place-name';
    name.textContent = city.name || 'Unknown location';

    const meta = document.createElement('span');
    meta.className = 'compare-slot-place-meta';
    meta.textContent = [city.admin1, city.country].filter(Boolean).join(', ') || 'Selected location';

    text.append(name, meta);
    button.append(badge, text);
    button.setAttribute('aria-label', `${city.name}, ${meta.textContent}. Change this location.`);
    button.addEventListener('click', () => beginCompareReplace(index));

    return button;
  }

  /** Small reusable circular icon button for the picker rows. */
  function compareIconButton(label, iconPath, onClick, disabled) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'compare-slot-btn';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.disabled = !!disabled;
    button.innerHTML = iconPath;
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Render a comparison table.
   *
   * Node reuse keeps a degC/degF toggle or a 10-minute auto-refresh from
   * rebuilding 10 rows x 4 columns of DOM: when the set of locations is
   * unchanged only the value text nodes are rewritten.
   */
  function renderCompareTable(tableEl, table) {
    if (!tableEl) return;

    const signature = table.columns.map((column) => compareEngine().cityKey(column.city)).join('~');
    const cached = tableEl.__compareRefs;

    let refs = cached;
    if (!refs || refs.signature !== signature) {
      refs = buildCompareTable(tableEl, table, signature);
      tableEl.__compareRefs = refs;
    }

    paintCompareTable(refs, table);
  }

  /** Build the whole table once; the returned refs drive every later update. */
  function buildCompareTable(tableEl, table, signature) {
    tableEl.innerHTML = '';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    const corner = document.createElement('th');
    corner.className = 'compare-metric-head';
    corner.scope = 'col';
    corner.textContent = 'Metric';
    headRow.appendChild(corner);

    const columnRefs = table.columns.map((column) => {
      const th = document.createElement('th');
      th.scope = 'col';

      const wrap = document.createElement('div');
      wrap.className = 'compare-col-head';

const icon = document.createElement('span');
      icon.className = 'compare-col-icon';
      icon.setAttribute('aria-hidden', 'true');

      const text = document.createElement('span');
      text.className = 'compare-col-text';

      const name = document.createElement('span');
      name.className = 'compare-col-name';

      const meta = document.createElement('span');
      meta.className = 'compare-col-meta';

      // Every column carries its city's live clock, like every other surface in
      // the app. The offset pill is the per-second target registered with the
      // shared ticker; the zone abbreviation is its stable, non-volatile
      // sibling, so screen readers are not re-read a string every second.
      const clock = document.createElement('span');
      clock.className = 'compare-col-clock';

      const offset = document.createElement('span');
      offset.className = 'compare-col-clock-offset';
      // Per-second digits: hidden from assistive tech, exactly like every other
      // clock surface. The header's aria-label carries the non-volatile facts.
      hideVolatileNode(offset);

      const zone = document.createElement('span');
      zone.className = 'compare-col-clock-zone';

      clock.append(offset, zone);
      text.append(name, meta, clock);
      wrap.append(icon, text);
      th.appendChild(wrap);
      headRow.append(th);

      return { th, icon, name, meta, offset, zone, column };
    });

    thead.appendChild(headRow);
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    const cells = table.rows.map((row) => {
      const tr = document.createElement('tr');

      // A row header keeps every value tied to its metric for screen readers,
      // and the sticky first column keeps that tie visible on a narrow screen.
      const th = document.createElement('th');
      th.className = 'compare-metric-cell';
      th.scope = 'row';

      const label = document.createElement('span');
      label.className = 'compare-metric-label';

      const icon = document.createElement('span');
      icon.className = 'compare-metric-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = row.icon || '';

      const text = document.createElement('span');
      text.textContent = row.label;
      label.append(icon, text);
      th.appendChild(label);
      tr.appendChild(th);

      const rowCells = row.cells.map(() => {
        const td = document.createElement('td');
        tr.appendChild(td);
        return { td, mode: null, value: null, valueText: null, flag: null, errorText: null };
      });

      tbody.appendChild(tr);
      return rowCells;
    });

    tableEl.appendChild(tbody);
    // One custom property lets the CSS size every city column.
    tableEl.style.setProperty('--compare-cols', String(table.columns.length));

    return { signature, columnRefs, cells };
  }

  /** Push the current values into an existing set of table nodes. */
  function paintCompareTable(refs, table) {
    refs.columnRefs.forEach((columnRef, index) => {
      const column = table.columns[index];
      const zone = (column.city && column.city.timezone) || 'UTC';
      const now = new Date();

      columnRef.name.textContent = column.city ? column.city.name : 'Location';
      columnRef.meta.textContent = [column.city && column.city.admin1, column.city && column.city.country]
        .filter(Boolean)
        .join(', ') || '—';

      // Reuse the app's condition icon + timezone vocabulary verbatim.
      if (column.entry) {
        columnRef.icon.innerHTML = compareConditionIcon(column.entry);
      } else {
        columnRef.icon.textContent = '—';
      }

      columnRef.offset.textContent = formatOffsetDiffCompact(zone, now);
      columnRef.zone.textContent = getZoneAbbreviation(zone, now);
      columnRef.zone.title = `${zone} - ${formatOffsetLabel(zone, now)}`;

      // Non-volatile accessible summary, so the per-second tick is not announced.
      const summary = [
        column.city ? column.city.name : 'Location',
        column.city && column.country ? column.country : '',
        `Local time zone ${zone}, ${describeTimeDifference(zone, now)}`,
      ].filter(Boolean).join('. ');
      columnRef.th.setAttribute('aria-label', summary);
    });

    table.rows.forEach((row, rowIndex) => {
      const rowCells = refs.cells[rowIndex];
      if (!rowCells) return;
      row.cells.forEach((cell, colIndex) => {
        paintCompareCell(rowCells[colIndex], cell, table.columns[colIndex], row.label);
      });
    });

    refreshCompareClocks(refs);
  }

  /**
   * One table cell: either the formatted value, or - when that location failed
   * - an explicit "unavailable" line with a retry that refetches just this
   * column.
   */
  function paintCompareCell(ref, cell, column, rowLabel) {
    if (!ref) return;

    if (column.status !== 'ok') {
      if (ref.mode !== 'error') {
        ref.td.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'compare-col-error';

        const text = document.createElement('span');
        text.className = 'compare-col-error-text';

        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'compare-retry-btn';
        retry.textContent = 'Try again';
        retry.setAttribute('aria-label', `Retry loading the weather for ${column.city ? column.city.name : 'this location'}`);
        retry.addEventListener('click', () => loadComparisonWeather({ retryIndex: column.index }));

        wrap.append(text, retry);
        ref.td.appendChild(wrap);
        ref.errorText = text;
        ref.mode = 'error';
      }
      const reason = (column.error && column.error.message) || 'Weather unavailable';
      if (ref.errorText.textContent !== reason) ref.errorText.textContent = reason;
      return;
    }

    if (ref.mode !== 'value') {
      ref.td.innerHTML = '';
      const value = document.createElement('span');
      value.className = 'compare-value';
      // API-derived text is written with textContent, never interpolated. It
      // goes in its own node so the extreme marker beside it can be added and
      // removed on later repaints without touching the text.
      const text = document.createElement('span');
      text.className = 'compare-value-text';
      text.textContent = cell.text;

      // Decorative duplicate of the pill's meaning: hidden from assistive tech,
      // which gets the same fact once, in words, from the label below.
      const flag = document.createElement('span');
      flag.className = 'compare-extreme-flag';
      flag.setAttribute('aria-hidden', 'true');

      value.append(text, flag);
      ref.td.appendChild(value);
      ref.value = value;
      ref.valueText = text;
      ref.flag = flag;
      ref.mode = 'value';
    } else if (ref.valueText.textContent !== cell.text) {
      ref.valueText.textContent = cell.text;
    }

    const emphasis = cell.emphasis && COMPARE_EMPHASIS[cell.emphasis] ? cell.emphasis : null;
    if (!emphasis) {
      ref.value.removeAttribute('data-emphasis');
      ref.value.removeAttribute('title');
      ref.td.removeAttribute('aria-label');
      if (ref.flag.textContent) ref.flag.textContent = '';
      return;
    }

    const { word, glyph } = COMPARE_EMPHASIS[emphasis];
    ref.value.setAttribute('data-emphasis', emphasis);
    if (ref.flag.textContent !== glyph) ref.flag.textContent = glyph;
    // Colour and arrow are both silent to a screen reader, so the cell says in
    // words what it looks like it says. The name goes on the <td>, whose role
    // accepts one, rather than on the inner span.
    const name = `${cell.text}, ${word} of the compared locations`;
    if (ref.td.getAttribute('aria-label') !== name) ref.td.setAttribute('aria-label', name);
    ref.value.setAttribute('title', rowLabel ? `${word} for ${rowLabel}` : word);
  }

  /**
   * Register the header clocks with the shared ticker. One registration per
   * column, replaced (never duplicated) whenever the column set changes.
   */
  function refreshCompareClocks(refs) {
    unregisterCompareClocks();
    if (!isCompareVisible()) return;

    refs.columnRefs.forEach((columnRef) => {
      const zone = (columnRef.column.city && columnRef.column.city.timezone) || 'UTC';

      // One registration per column drives both the offset pill and the zone
      // abbreviation, so a column never registers two independent timers.
      compareClockIds.push(
        registerClock(zone, new Map([
          [columnRef.offset, (tz, now) => {
            columnRef.offset.textContent = formatOffsetDiffCompact(tz, now);
          }],
          [columnRef.zone, (tz, now) => {
            const label = getZoneAbbreviation(tz, now);
            if (columnRef.zone.textContent !== label) columnRef.zone.textContent = label;
          }],
        ]), () => isCompareVisible())
      );
    });
  }

  /** "Weather at a glance" - the sentences come straight from the engine. */
  function renderCompareInsights(insights, table) {
    const list = elements.compareInsights;
    list.innerHTML = '';

    if (!insights || insights.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'compare-insight-empty';
      empty.setAttribute('role', 'listitem');
      empty.textContent =
        table.okCount < 2
          ? 'At least two locations with live data are needed for a comparison.'
          : 'These locations are currently very similar - no difference stands out.';
      list.appendChild(empty);
      return;
    }

    insights.forEach((text) => {
      const item = document.createElement('li');
      item.className = 'compare-insight';
      item.setAttribute('role', 'listitem');
      item.textContent = text;
      list.appendChild(item);
    });
  }

  /** "Latest reading: Updated 4 min ago" - the stalest column decides. */
  function renderCompareFreshness(locations) {
    if (!elements.compareFreshness) return;

    let oldest = null;
    locations.forEach((slot) => {
      if (!slot || !slot.weather) return;
      const label = formatFreshness(slot.weather.current.time, slot.weather.utc_offset_seconds);
      if (!label) return;
      const minutes = Number((label.match(/(\d+)\s*min/) || [])[1] || 0);
      if (oldest === null || minutes > oldest.minutes) oldest = { label, minutes };
    });

    elements.compareFreshness.textContent = oldest ? `Latest reading: ${oldest.label.toLowerCase()}` : '';
  }

  /**
   * Move focus to the shared search box.
   *
   * Both the "Add" placeholders and a filled location chip route through here,
   * so picking a location for a slot is the same autocomplete the rest of the
   * app already uses rather than a second, parallel picker.
   */
  function focusCompareSearch() {
    closeAutocomplete();
    elements.searchInput.focus();
    elements.searchInput.select();
  }

  // ==========================================================================
  // Core Controller Actions
  // ==========================================================================
  async function loadCityWeather(city) {
    if (!city || city.latitude === undefined || city.latitude === null || city.longitude === undefined || city.longitude === null) return;

    // A shared link is a claim about one specific city. Once the visitor moves
    // to another one the claim is stale, so the ring and the banner are dropped
    // here rather than left pointing at a forecast that is no longer on screen.
    if (state.sharedPayload && !isSameSharedCity(state.sharedPayload, city)) clearSharedView();

    // Supersede any in-flight city request so a slow earlier response
    // cannot overwrite the city the user actually selected (#5)
    if (state.weatherController) state.weatherController.abort();
    const controller = new AbortController();
    state.weatherController = controller;

    elements.dashboard.classList.add('hidden');
    elements.climateResultsSection.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.loadingText.textContent = t('state.fetchingCity', { city: city.name }, `Fetching live weather for ${city.name}...`);
    elements.loadingState.classList.remove('hidden');

    closeAutocomplete();

    try {
      const weatherData = await fetchWeatherData(city.latitude, city.longitude, city.timezone, controller.signal);
      if (controller.signal.aborted) return;

      state.currentCity = city;
      state.weatherData = weatherData;

      writeStored(STORAGE_KEYS.lastCity, LEGACY_STORAGE_KEYS.lastCity, JSON.stringify(city));

      elements.searchInput.value = city.name;
      elements.clearBtn.classList.remove('hidden');

      renderWeather();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Weather load error:', err);
      showError(
        'Weather Data Unavailable',
        `Could not fetch weather for "${city.name}". The request may have timed out - please check your internet connection and try again.`
      );
    }
  }

  async function handleClimateSearch(queryStr, presetCondition = null) {
    closeAutocomplete();
    elements.dashboard.classList.add('hidden');
    elements.climateResultsSection.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.loadingText.textContent = t('climate.searching', null, 'Searching worldwide cities matching preferred climate...');
    elements.loadingState.classList.remove('hidden');

    try {
      const allCityForecasts = await fetchGlobalCitiesWeather();

      const presets = [];
      if (presetCondition) {
        presets.push(presetCondition);
      }

      const criteria = parseClimateCriteria(queryStr, presets);

      // Persist both halves of the query so re-renders triggered by sort or
      // unit changes reproduce identical criteria - including the tag chips (#1)
      state.activeClimateQuery = queryStr || '';
      state.activeFilterTags = presets;

      const matching = allCityForecasts.filter((entry) => matchesClimateCriteria(entry, criteria));

      renderClimateResults(matching, criteria);
    } catch (err) {
      console.error('Climate search error:', err);
      showError('Climate Search Error', 'Failed to retrieve global meteorological data. Please try again.');
    }
  }

  /**
   * Re-derive the criteria for the currently displayed climate result set,
   * including any preset chip that was active.
   */
  function currentClimateCriteria() {
    return parseClimateCriteria(state.activeClimateQuery, state.activeFilterTags);
  }

  async function handleCitySearch(cityName) {
    if (!cityName || !cityName.trim()) return;

    elements.dashboard.classList.add('hidden');
    elements.climateResultsSection.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.loadingText.textContent = t('search.searchingFor', { city: cityName }, `Searching for "${cityName}"...`);
    elements.loadingState.classList.remove('hidden');

    try {
      const cities = await searchCities(cityName);
      if (!cities || cities.length === 0) {
        showError(
          'City Not Found',
          `No results found for "${cityName}". Try searching with a different spelling or adding a country.`
        );
        return;
      }

      // Ambiguous names ("Paris") get a disambiguation list instead of silently
      // loading whichever result the API happened to rank first (#8)
      if (cities.length > 1) {
        showAutocomplete(cities, { disambiguate: true });
        elements.autocompleteList.classList.remove('hidden');
        elements.searchInput.focus();
        return;
      }

      // Awaited, not fired: a shared link resolves once this city's cards are on
      // screen (see `applySharedLink`), so the caller has to be able to wait for
      // exactly that.
      await loadCityWeather(cities[0]);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Search error:', err);
      const timedOut = /timed out/i.test(err.message || '');
      showError(
        'Search Failed',
        timedOut
          ? 'The search request timed out. Please check your internet connection and try again.'
          : 'An error occurred while searching for the city. Please try again.'
      );
    }
  }

  function showError(title, message) {
    elements.loadingState.classList.add('hidden');
    elements.dashboard.classList.add('hidden');
    elements.climateResultsSection.classList.add('hidden');
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    // The full-screen error belongs to the dashboard and the climate filter.
    // In compare mode a failed city load reports itself inside its own column,
    // so the comparison surface must stay untouched.
    if (state.searchMode !== 'compare') elements.errorState.classList.remove('hidden');
  }

  // ==========================================================================
  // Autocomplete UI Handlers
  // ==========================================================================
  /** Clock registrations owned by the current dropdown, cleared on every rebuild. */
  let autocompleteClocks = [];

  function clearAutocompleteClocks() {
    autocompleteClocks.forEach((id) => unregisterClock(id));
    autocompleteClocks = [];
  }

  function closeAutocomplete() {
    elements.autocompleteList.classList.add('hidden');
    elements.autocompleteList.innerHTML = '';
    elements.autocompleteOptions = [];
    clearAutocompleteClocks();
    state.activeOptionIndex = -1;
    elements.searchInput.setAttribute('aria-expanded', 'false');
    elements.searchInput.removeAttribute('aria-activedescendant');
  }

  /**
   * Render autocomplete suggestions.
   * City names come from an external API, so every value is written with
   * textContent rather than interpolated into innerHTML (#7).
   */
  function showAutocomplete(results, options = {}) {
    if (!results || results.length === 0) {
      closeAutocomplete();
      return;
    }

    elements.autocompleteList.innerHTML = '';
    elements.autocompleteOptions = [];

    // The dropdown is rebuilt on every keystroke, so drop the previous batch of
    // clocks instead of letting orphaned registrations pile up in the registry.
    clearAutocompleteClocks();

    results.forEach((city, idx) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.setAttribute('role', 'option');
      item.id = `autocomplete-option-${idx}`;
      item.setAttribute('aria-selected', 'false');

      const metaParts = [];
      if (city.admin1) metaParts.push(city.admin1);
      if (city.country) metaParts.push(city.country);

      const name = document.createElement('span');
      name.className = 'autocomplete-item-name';
      name.textContent = city.name;

      const meta = document.createElement('span');
      meta.className = 'autocomplete-item-meta';
      meta.textContent = metaParts.join(', ');

      item.appendChild(name);
      item.appendChild(meta);

      // Local time helps disambiguate same-named cities (Paris, France vs
      // Paris, Texas) and answers "what time is it there?" before committing.
      const zone = city.timezone || 'UTC';
      const now = new Date();
      const localTime = document.createElement('span');
      localTime.className = 'autocomplete-item-time';
      localTime.title = `${zone} - ${describeTimeDifference(zone, now)}`;

      const clock = document.createElement('span');
      clock.className = 'autocomplete-item-clock';
      clock.textContent = formatClock(zone, now);
      // Per-second volatile: hidden so the polite live region around the
      // dropdown is not spammed once a second.
      hideVolatileNode(clock);
      localTime.appendChild(clock);

      const offset = document.createElement('span');
      offset.className = 'autocomplete-item-offset';
      offset.textContent = formatOffsetDiffCompact(zone, now);
      if (getOffsetDiffMinutes(zone, now) === 0) offset.classList.add('is-same');
      localTime.appendChild(offset);

      item.appendChild(localTime);

      item.addEventListener('click', () => {
        closeAutocomplete();
        // Compare mode shares this dropdown with City Search, so the picked
        // place is routed by whichever mode is active.
        if (state.searchMode === 'compare') {
          addCompareLocation(city);
          resetCompareSearchInput();
          return;
        }
        loadCityWeather(city);
      });
      item.addEventListener('mouseenter', () => setActiveOption(idx));

      elements.autocompleteList.appendChild(item);
      elements.autocompleteOptions.push({ el: item, city });

      autocompleteClocks.push(registerClock(zone, new Map([
        [clock, (tz, tick) => {
          clock.textContent = formatClock(tz, tick);
        }],
      ]), () => !elements.autocompleteList.classList.contains('hidden')));
    });

    // Each option carries a non-volatile accessible summary of its local time.
    elements.autocompleteOptions.forEach(({ el, city }) => {
      const zone = city.timezone || 'UTC';
      el.setAttribute(
        'aria-label',
        `${city.name}, ${[city.admin1, city.country].filter(Boolean).join(', ')}. ` +
        `Local time zone ${zone}, ${describeTimeDifference(zone, new Date())}.`
      );
    });

    if (options.disambiguate) {
      const hint = document.createElement('div');
      hint.className = 'autocomplete-hint';
      hint.textContent = `${results.length} matching locations - select one`;
      elements.autocompleteList.insertBefore(hint, elements.autocompleteList.firstChild);
    }

    elements.autocompleteList.classList.remove('hidden');
    elements.searchInput.setAttribute('aria-expanded', 'true');

    if (options.disambiguate) {
      // Pre-select the top hit so Enter works immediately
      setActiveOption(0);
    }
  }

  /** Highlight one option and mirror it onto the input for screen readers. */
  function setActiveOption(index) {
    const options = elements.autocompleteOptions || [];
    if (options.length === 0) return;

    const bounded = (index + options.length) % options.length;
    state.activeOptionIndex = bounded;

    options.forEach((opt, i) => {
      const isActive = i === bounded;
      opt.el.classList.toggle('active', isActive);
      opt.el.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const activeEl = options[bounded].el;
    elements.searchInput.setAttribute('aria-activedescendant', activeEl.id);
    if (typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function moveActiveOption(delta) {
    const options = elements.autocompleteOptions || [];
    if (options.length === 0) return;

    // From "nothing highlighted", ArrowDown starts at the first option and
    // ArrowUp starts at the last, rather than skipping an entry.
    if (state.activeOptionIndex === -1) {
      setActiveOption(delta > 0 ? 0 : options.length - 1);
      return;
    }

    setActiveOption(state.activeOptionIndex + delta);
  }

  function commitActiveOption() {
    const options = elements.autocompleteOptions || [];
    if (options.length === 0 || state.activeOptionIndex < 0) return false;
    const chosen = options[state.activeOptionIndex];
    if (!chosen) return false;
    closeAutocomplete();
    if (state.searchMode === 'compare') {
      addCompareLocation(chosen.city);
      resetCompareSearchInput();
    } else {
      loadCityWeather(chosen.city);
    }
    return true;
  }

  // ==========================================================================
  // Geolocation Handler
  // ==========================================================================
  async function handleGeolocation() {
    if (!navigator.geolocation) {
      if (state.searchMode === 'compare') {
        setCompareNotice('Your browser does not support automatic location detection.');
        return;
      }
      showError('Geolocation Unsupported', 'Your browser does not support automatic location detection.');
      return;
    }

    const toCompare = state.searchMode === 'compare';

    // The compare surface has its own inline feedback, so it must not have the
    // dashboard's full-screen loading state dropped over it.
    if (toCompare) {
      setCompareNotice(t('geo.detecting', null, 'Detecting your geographical location...'));
    } else {
      elements.dashboard.classList.add('hidden');
      elements.climateResultsSection.classList.add('hidden');
      elements.errorState.classList.add('hidden');
      elements.loadingText.textContent = t('geo.detecting', null, 'Detecting your geographical location...');
      elements.loadingState.classList.remove('hidden');
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let detectedCity = {
          name: 'My Location',
          admin1: '',
          country: '',
          latitude,
          longitude,
          timezone: 'auto',
        };

        try {
          const revRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          if (revRes.ok) {
            const revData = await revRes.json();
            if (revData.city || revData.locality) {
              detectedCity.name = revData.city || revData.locality;
              detectedCity.admin1 = revData.principalSubdivision || '';
              detectedCity.country = revData.countryName || '';
            }
          }
        } catch (e) {
          console.warn('Reverse geocoding fallback to coordinates', e);
        }

        // The mode can change while the browser prompt is open, so re-read it.
        if (state.searchMode === 'compare') {
          addCompareLocation(detectedCity);
          setCompareNotice('');
          return;
        }
        loadCityWeather(detectedCity);
      },
      (err) => {
        console.warn('Geolocation denied or failed:', err);
        if (state.searchMode === 'compare') {
          setCompareNotice('Could not retrieve your location. Check browser permissions, or search for a city directly.');
          return;
        }
        showError(
          'Location Access Denied',
          'Could not retrieve your location. Please check browser permissions or search for your city directly.'
        );
      },
      { timeout: 10000 }
    );
  }

  // ==========================================================================
  // Mode Switching
  // ==========================================================================
  /** The three modes, in tab order, with the search placeholder each owns. */
  const MODES = [
    { mode: 'city', placeholderKey: 'search.placeholderCity', placeholder: 'Search for a city (e.g. Paris, Tokyo, New York)...' },
    { mode: 'compare', placeholderKey: 'search.placeholderCompare', placeholder: 'Add a location to compare (e.g. Athens, Oslo, Cairo)...' },
    { mode: 'climate', placeholderKey: 'search.placeholderClimate', placeholder: 'Search climate: e.g. Sunny, Warm, Rain, Snow, > 25°C, Cold < 10°C...' },
  ];

  function modeTab(mode) {
    if (mode === 'city') return elements.tabModeCity;
    if (mode === 'compare') return elements.tabModeCompare;
    return elements.tabModeClimate;
  }

  /**
   * Reflect the active mode across the three tabs and the surfaces they own.
   *
   * Compare mode reuses the city search box and the popular-city chips, so it
   * differs from City Search only in what a picked city does with it.
   *
   * This lives at module scope rather than inside `setupEvents` because `init`
   * has to establish the initial tab state through the same code path the tabs
   * use, so only the active tab ever holds a tab stop.
   */
  function setMode(mode) {
    state.searchMode = mode;

    MODES.forEach(({ mode: id }) => {
      const tab = modeTab(id);
      if (!tab) return;
      const active = id === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      // Roving tabindex: one tab stop for the tablist. The arrow-key handler in
      // `setupEvents` is what makes the other two reachable.
      tab.tabIndex = active ? 0 : -1;
    });

    const activeMode = MODES.find((entry) => entry.mode === mode) || MODES[0];
    elements.searchInput.placeholder = t(activeMode.placeholderKey, null, activeMode.placeholder);
    elements.quickCitiesContainer.classList.toggle('hidden', mode === 'climate');
    elements.climateChipsContainer.classList.toggle('hidden', mode !== 'climate');

    // Compare mode has its own surface; City/Climate own the dashboard.
    elements.dashboard.classList.toggle('hidden', mode === 'compare');
    elements.errorState.classList.add('hidden');
    if (elements.compareSection) {
      elements.compareSection.classList.toggle('hidden', mode !== 'compare');
    }

    if (mode === 'climate') {
      // Warm the global batch cache only when climate mode is actually used (#9)
      fetchGlobalCitiesWeather().catch((err) => console.warn('Global prefetch:', err));
    }

    if (mode === 'compare') renderCompareSection();

    // A pending re-pick is meaningless once the picker is off screen.
    if (mode !== 'compare') state.compareReplaceIndex = null;

    // A switch away from compare stops its in-flight fetch from painting into
    // a surface the visitor can no longer see.
    if (mode !== 'compare' && elements.compareLoading && !elements.compareLoading.classList.contains('hidden')) {
      abortComparison();
      elements.compareLoading.classList.add('hidden');
      elements.mainContent.setAttribute('aria-busy', 'false');
    }

    if (mode !== 'city') elements.searchInput.focus();
    closeAutocomplete();
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  function setupEvents() {
    elements.tabModeCity.addEventListener('click', () => setMode('city'));
    elements.tabModeClimate.addEventListener('click', () => setMode('climate'));
    if (elements.tabModeCompare) {
      elements.tabModeCompare.addEventListener('click', () => setMode('compare'));
    }

    // `setMode` gives only the active tab a tab stop, so the tablist needs its
    // own arrow-key navigation - otherwise the inactive tabs become unreachable
    // by keyboard. Home/End jump to the ends, matching the app's other widgets.
    const modeTabs = () => MODES.map((entry) => modeTab(entry.mode)).filter(Boolean);
    const tablist = elements.tabModeCity.closest('.search-mode-tabs');

    if (tablist) {
      tablist.addEventListener('keydown', (e) => {
        const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
        if (!keys.includes(e.key)) return;

        const tab = e.target.closest('.mode-tab');
        if (!tab) return;
        e.preventDefault();

        const tabs = modeTabs();
        const index = tabs.indexOf(tab);
        if (index === -1) return;

        let next;
        if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else next = (index + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length;

        setMode(MODES[next].mode);
        tabs[next].focus();
      });
    }

    // Form submit
    elements.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // If a suggestion is highlighted, Enter commits that suggestion
      if (state.searchMode !== 'climate' && commitActiveOption()) return;

      closeAutocomplete();
      const query = elements.searchInput.value.trim();
      if (!query) return;

      if (state.searchMode === 'climate') {
        handleClimateSearch(query);
      } else if (state.searchMode === 'compare') {
        handleCompareSearch(query);
      } else {
        handleCitySearch(query);
      }
    });

    // Keyboard navigation for the autocomplete listbox
    elements.searchInput.addEventListener('keydown', (e) => {
      const hasOptions = (elements.autocompleteOptions || []).length > 0;

      // Escape backs out of a pending re-pick. While the listbox is open it
      // only dismisses that first, leaving the swap pending, so a single Escape
      // never silently turns "replace" back into "append".
      if (e.key === 'Escape' && !hasOptions && state.compareReplaceIndex !== null) {
        e.preventDefault();
        cancelCompareReplace();
        return;
      }

      if (!hasOptions) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          moveActiveOption(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveActiveOption(-1);
          break;
        case 'Escape':
          e.preventDefault();
          closeAutocomplete();
          break;
        case 'Tab':
          closeAutocomplete();
          break;
        default:
          break;
      }
    });

    // Input debounce for autocomplete in city mode
    elements.searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val.length > 0) {
        elements.clearBtn.classList.remove('hidden');
      } else {
        elements.clearBtn.classList.add('hidden');
        closeAutocomplete();
        return;
      }

      // A new keystroke invalidates any highlighted option
      state.activeOptionIndex = -1;
      elements.searchInput.removeAttribute('aria-activedescendant');

      clearTimeout(state.debounceTimer);

      if (state.searchMode === 'climate') {
        // In climate mode, offer a single "run this query" affordance
        state.debounceTimer = setTimeout(() => {
          closeAutocomplete();

          const item = document.createElement('div');
          item.className = 'autocomplete-item';
          item.setAttribute('role', 'option');
          item.id = 'climate-suggest-option';

          const name = document.createElement('span');
          name.className = 'autocomplete-item-name';
          name.textContent = `Search worldwide cities matching "${val}" →`;

          const meta = document.createElement('span');
          meta.className = 'autocomplete-item-meta';
          meta.textContent = 'Climate Discovery';

          item.appendChild(name);
          item.appendChild(meta);
          item.addEventListener('click', () => handleClimateSearch(val));

          elements.autocompleteList.innerHTML = '';
          elements.autocompleteList.appendChild(item);
          elements.autocompleteOptions = [];
          elements.autocompleteList.classList.remove('hidden');
          elements.searchInput.setAttribute('aria-expanded', 'true');
        }, 250);
        return;
      }

      state.debounceTimer = setTimeout(async () => {
        // Abort any in-flight suggestion request and tag this one so a slow
        // earlier response cannot overwrite newer suggestions (#5)
        if (state.autocompleteController) state.autocompleteController.abort();
        const controller = new AbortController();
        state.autocompleteController = controller;
        const seq = ++state.autocompleteSeq;

        try {
          const results = await searchCities(val, controller.signal);
          if (seq !== state.autocompleteSeq) return;
          if (elements.searchInput.value.trim() !== val) return;
          showAutocomplete(results);
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.error('Autocomplete error:', err);
        }
      }, 280);
    });

    // Clear button
    elements.clearBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.clearBtn.classList.add('hidden');
      closeAutocomplete();
      elements.searchInput.focus();
    });

    // Close autocomplete on outside click
    document.addEventListener('click', (e) => {
      if (!elements.searchForm.contains(e.target) && !elements.autocompleteList.contains(e.target)) {
        closeAutocomplete();
      }
    });

    // Geolocation button
    elements.geoBtn.addEventListener('click', handleGeolocation);

    // Quick popular city chips
    elements.quickChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip || !chip.dataset.city) return;

      // Compare mode keeps the same chips visible, and picking one there fills
      // a slot instead of replacing the dashboard - so the mode is read, not
      // forced back to City Search.
      const toCompare = state.searchMode === 'compare';

      // Resolve against the local benchmark database first. Names like "Paris",
      // "Sydney" or "Rome" match several places worldwide, and going through
      // geocoding would drop the user into a disambiguation list instead of the
      // city the chip actually advertises. The bundled entry is already
      // unambiguous, so a popular chip stays genuinely one-click.
      const known = WORLD_CITIES.find(
        (city) => city.name.toLowerCase() === chip.dataset.city.trim().toLowerCase()
      );

      if (known) {
        if (toCompare) {
          addCompareLocation(known);
          setCompareNotice('');
        } else {
          setMode('city');
          loadCityWeather(known);
        }
        return;
      }

      if (toCompare) handleCompareSearch(chip.dataset.city);
      else handleCitySearch(chip.dataset.city);
    });

    // Climate Preset Chips
    elements.climateChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.climate-filter-chip');
      if (!chip || !chip.dataset.condition) return;

      const condition = chip.dataset.condition;
      const wasActive = chip.classList.contains('active');

      // Clicking the active chip again clears the preset filter
      document.querySelectorAll('.climate-filter-chip').forEach((c) => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });

      if (wasActive) {
        elements.searchInput.value = '';
        handleClimateSearch('');
        return;
      }

      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
      elements.searchInput.value = presetInputValue(chip);
      elements.clearBtn.classList.remove('hidden');

      handleClimateSearch('', condition);
    });

    // Climate Sort dropdown
    elements.climateSortSelect.addEventListener('change', (e) => {
      state.sortOrder = e.target.value;
      if (state.matchingCities.length > 0) {
        // Re-derive with the stored preset tags so the filter chips survive (#1)
        renderClimateResults(state.matchingCities, currentClimateCriteria());
      }
    });

    // Back to Climate Results button
    elements.backToResultsBtn.addEventListener('click', () => {
      elements.dashboard.classList.add('hidden');
      elements.climateResultsSection.classList.remove('hidden');
    });

    // Retry button on error
    elements.retryBtn.addEventListener('click', () => {
      elements.errorState.classList.add('hidden');
      elements.searchInput.focus();
    });

    // Manual refresh of the current city
    if (elements.refreshBtn) {
      elements.refreshBtn.addEventListener('click', () => {
        if (!state.currentCity) return;
        elements.refreshBtn.classList.add('is-loading');
        elements.refreshBtn.disabled = true;
        // Invalidate the global batch cache so climate data is not served stale
        state.globalCacheTimestamp = 0;
        loadCityWeather(state.currentCity).finally(() => {
          elements.refreshBtn.classList.remove('is-loading');
          elements.refreshBtn.disabled = false;
        });
      });
    }
    // Language toggle buttons
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        langBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        const lang = btn.dataset.lang;
        if (window.I18n) {
          window.I18n.setLanguage(lang);
        }
      });
    });

    if (elements.shareBtn) {
      elements.shareBtn.addEventListener('click', function() {
        shareWeather();
      });
    }

    // "Show all cards" on a shared forecast: the recipient keeps the city, drops
    // the ring and the banner.
    if (elements.sharedClearBtn) {
      elements.sharedClearBtn.addEventListener('click', function () {
        clearSharedView();
        if (elements.dashboard) elements.dashboard.scrollIntoView({ block: 'start' });
      });
    }

    // "Rain during your ...?" window selector (delegated: the tabs are
    // re-created on every render, so the listener lives on the container)
    if (elements.assistantWindowTabs) {
      elements.assistantWindowTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.assistant-window-tab');
        if (!tab || !tab.dataset.windowKey) return;
        onAssistantWindowChange(tab.dataset.windowKey);
      });

      // Arrow-key navigation, matching the °C/°F radiogroup behaviour.
      elements.assistantWindowTabs.addEventListener('keydown', (e) => {
        const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', ' ', 'Enter'];
        if (!keys.includes(e.key)) return;
        const tab = e.target.closest('.assistant-window-tab');
        if (!tab) return;
        e.preventDefault();

        const tabs = Array.from(
          elements.assistantWindowTabs.querySelectorAll('.assistant-window-tab')
        );
        const index = tabs.indexOf(tab);
        if (index === -1) return;

        // Right/Down move forward, Left/Up move back, and both wrap around.
        const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const next = tabs[(index + step + tabs.length) % tabs.length];
        if (e.key === 'Enter' || e.key === ' ') {
          onAssistantWindowChange(next.dataset.windowKey);
          return;
        }
        onAssistantWindowChange(next.dataset.windowKey);
      });
    }

    // Temperature Unit Toggle
    function setUnit(newUnit) {
      if (state.unit === newUnit) return;
      state.unit = newUnit;
      writeStored(STORAGE_KEYS.unit, LEGACY_STORAGE_KEYS.unit, newUnit);

      const useF = newUnit === 'fahrenheit';
      elements.unitF.classList.toggle('active', useF);
      elements.unitC.classList.toggle('active', !useF);
      elements.unitF.setAttribute('aria-checked', useF ? 'true' : 'false');
      elements.unitC.setAttribute('aria-checked', useF ? 'false' : 'true');

      // Keep the preset chip thresholds in the same unit as everything else
      refreshChipThresholds();

      // Re-render dashboard or climate results immediately without refetch
      if (state.weatherData && !elements.dashboard.classList.contains('hidden')) {
        renderWeather();
      } else if (state.matchingCities.length > 0 && !elements.climateResultsSection.classList.contains('hidden')) {
        renderClimateResults(state.matchingCities, currentClimateCriteria());
      }

      // The comparison borrows the same unit-aware formatters, so a repaint is
      // all it needs - no refetch.
      if (isCompareVisible()) renderCompareSection();
    }

    elements.unitC.addEventListener('click', () => setUnit('celsius'));
    elements.unitF.addEventListener('click', () => setUnit('fahrenheit'));

    // Keep the °C/°F radiogroup keyboard-operable
    elements.unitC.addEventListener('keydown', (e) => onUnitKeydown(e, elements.unitC, elements.unitF));
    elements.unitF.addEventListener('keydown', (e) => onUnitKeydown(e, elements.unitF, elements.unitC));

    // Auto-refresh live conditions while the dashboard is visible
    setInterval(() => {
      if (document.hidden) return;
      if (elements.dashboard.classList.contains('hidden')) return;
      if (!state.currentCity) return;
      loadCityWeather(state.currentCity);
    }, 10 * 60 * 1000);

    // Compare Locations actions
    if (elements.compareRunBtn) {
      elements.compareRunBtn.addEventListener('click', () => loadComparisonWeather());
    }

    if (elements.compareAddBtn) {
      elements.compareAddBtn.addEventListener('click', focusCompareSearch);
    }

    if (elements.compareClearBtn) {
      elements.compareClearBtn.addEventListener('click', clearCompareLocations);
    }

    // Auto-refresh the comparison on the same cadence as the dashboard, but
    // only while it is actually on screen.
    setInterval(() => {
      if (document.hidden) return;
      if (!isCompareVisible()) return;
      if (!state.compareLocations.some((slot) => slot && slot.weather)) return;
      loadComparisonWeather();
    }, 10 * 60 * 1000);
  }

  function onUnitKeydown(e, current, other) {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', ' '];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    other.click();
    other.focus();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================
  async function detectAndSetLanguage() {
    if (!window.I18n || typeof window.I18n.detectLanguage !== 'function') return;
    const detected = await window.I18n.detectLanguage();
    if (!detected || !detected.lang) return;

    // `init()` has already honoured an explicit query or stored preference.
    // Detection is only allowed to paint a first-time visitor and never writes
    // over a deliberate choice.
    if (detected.source === 'query' || detected.source === 'stored') return;
    window.I18n.setLanguage(detected.lang, { persist: false });
  }

  function init() {
    // Initialize i18n if available
    if (window.I18n && window.I18n.init) {
      window.I18n.init();
    }

    if (window.I18n && typeof window.I18n.onChange === 'function') {
      window.I18n.onChange(() => {
        setMode(state.searchMode);
        refreshChipThresholds();
        if (elements.footerTimezoneNote) {
          elements.footerTimezoneNote.textContent = t(
            'footer.timezoneNote',
            { zone: USER_TIME_ZONE },
            `Local times use each city's IANA timezone and tick in real time · Your reference time is detected from your device timezone (${USER_TIME_ZONE})`
          );
        }
        if (state.weatherData && !elements.dashboard.classList.contains('hidden')) renderWeather();
        if (state.matchingCities.length && !elements.climateResultsSection.classList.contains('hidden')) {
          renderClimateResults(state.matchingCities, currentClimateCriteria());
        }
        if (isCompareVisible()) renderCompareSection();
      });
    }

    // Detect and set language for a first-time visitor (IP/browser/timezone).
    detectAndSetLanguage().then(() => {
      const lang = window.I18n ? window.I18n.getLanguage() : 'en';
      const langBtns = document.querySelectorAll('.lang-btn');
      langBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
        btn.setAttribute('aria-checked', btn.dataset.lang === lang ? 'true' : 'false');
      });
    });

    setupEvents();

    // Establish the initial tab state through the same code path the tabs use,
    // so the active tab carries the single tab stop from the first paint.
    setMode('city');

    // Boot the shared ticker and the visitor's reference clock before any data
    // arrives, so there is a clock on screen from the first paint.
    registerUserClock();
    startClockTicker();

    // Render the unit-aware thresholds on the preset chips before first paint
    refreshChipThresholds();

    // Paint the comparison surface once at startup so the picker rows and the
    // disabled/enabled state of its buttons are correct before first use, even
    // though the section starts hidden.
    renderCompareSection();

    if (state.unit === 'fahrenheit') {
      elements.unitF.classList.add('active');
      elements.unitC.classList.remove('active');
    } else {
      elements.unitC.classList.add('active');
      elements.unitF.classList.remove('active');
    }
    elements.unitC.setAttribute('aria-checked', state.unit === 'celsius' ? 'true' : 'false');
    elements.unitF.setAttribute('aria-checked', state.unit === 'fahrenheit' ? 'true' : 'false');

    // A shared link decides the city. It is checked before the saved city and
    // before the default one, so opening a link always shows the forecast that
    // was shared instead of whatever this browser last looked at.
    const sharedPayload = shareEngine() ? shareEngine().parseShareLink(window.location.href) : null;
    if (sharedPayload) {
      applySharedLink(sharedPayload);
      return;
    }

    // Note: the 72-city global batch is no longer prefetched on every page load.
    // It is fetched lazily the first time climate mode is used (#9).

    // Check for saved last city in localStorage
    const saved = readStored(STORAGE_KEYS.lastCity, LEGACY_STORAGE_KEYS.lastCity);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        loadCityWeather(parsed);
        return;
      } catch (e) {
        console.warn('Failed parsing saved city', e);
      }
    }

    // Default city: Paris
    loadCityWeather({
      name: 'Paris',
      admin1: 'Île-de-France',
      country: 'France',
      latitude: 48.8534,
      longitude: 2.3488,
      timezone: 'Europe/Paris',
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
