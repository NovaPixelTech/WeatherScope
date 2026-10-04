/**
 * WeatherScope - Internationalisation
 * =========================================================================
 * One dictionary, six languages (English, Greek, German, Italian, Spanish, French), and no build step.
 *
 * How a string gets to the screen
 * -------------------------------
 *  * **Static markup** carries `data-i18n` (and the `data-i18n-placeholder`,
 *    `data-i18n-aria-label`, `data-i18n-title`, `data-i18n-html`,
 *    `data-i18n-content` variants).
 *    `applyTranslations()` walks those attributes and rewrites the node, so the
 *    markup ships readable English as the no-JS / pre-detection default and the
 *    dictionary only ever *overrides* it.
 *  * **Anything built at runtime** goes through `t('key', vars)`. Every pure
 *    engine (advice.js, glance.js, compare.js) receives `t` from the caller, so
 *    the engines stay deterministic and unit-testable with their English
 *    defaults while the browser renders the active language.
 *
 * How the language is chosen
 * --------------------------
 *    1. `?lang=` in the URL            - explicit, shareable, wins over storage
 *    2. `weatherscope_lang` in storage - the visitor's saved dropdown choice
 *    3. the visitor's IP country        - selects its embedded language, or
 *                                          English if the country is unmapped
 *    4. English                         - fallback when IP detection fails
 *
 * The page waits for IP detection before showing text. A query or saved choice
 * takes precedence over IP; later dropdown selections are persisted.
 *
 * Loading contract: plain classic script (no build step). It publishes
 * `window.I18n`, and also supports `module.exports` for the tests.
 */

(function (root, factory) {
  'use strict';

  const api = factory(typeof window !== 'undefined' ? window : null);

  if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
    module.exports = api;
  }
  if (root) root.I18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (win) {
  'use strict';

  // ==========================================================================
  // Supported languages
  // ==========================================================================
  const SUPPORTED = ['en', 'el', 'de', 'it', 'es', 'fr'];
  const DEFAULT_LANG = 'en';

  /** BCP-47 locale used for Intl formatting (dates, name sorting). */
  const INTL_LOCALES = { en: 'en-GB', el: 'el-GR', de: 'de-DE', it: 'it-IT', es: 'es-ES', fr: 'fr-FR' };

  const HTML_LANGS = { en: 'en', el: 'el', de: 'de', it: 'it', es: 'es', fr: 'fr' };

  const STORAGE_KEY = 'weatherscope_lang';

  /**
   * Country (ISO 3166-1 alpha-2) -> supported language.
   *
   * Countries and regions mapped to the embedded native-language dictionaries.
   * An unmapped country resolves to the English default.
   */
  const COUNTRY_LANGS = {
    // English-speaking countries (and the English default elsewhere)
    US: 'en', GB: 'en', UK: 'en', IE: 'en', CA: 'en', AU: 'en', NZ: 'en',
    // Greek
    GR: 'el', CY: 'el',
    // German-speaking countries and regions
    DE: 'de', AT: 'de', CH: 'de', LI: 'de', LU: 'de',
    // Italian-speaking countries and regions
    IT: 'it', SM: 'it', VA: 'it',
    // Spanish-speaking countries and regions
    ES: 'es', MX: 'es', AR: 'es', BO: 'es', CL: 'es', CO: 'es', CR: 'es',
    CU: 'es', DO: 'es', EC: 'es', SV: 'es', GQ: 'es', GT: 'es', HN: 'es',
    NI: 'es', PA: 'es', PY: 'es', PE: 'es', PR: 'es', UY: 'es', VE: 'es',
    // French-speaking countries and regions
    FR: 'fr', MC: 'fr', BE: 'fr', CI: 'fr', SN: 'fr', CD: 'fr', CG: 'fr',
    CM: 'fr', MG: 'fr', HT: 'fr', BJ: 'fr', BF: 'fr', BI: 'fr', DJ: 'fr',
    GA: 'fr', GN: 'fr', ML: 'fr', NE: 'fr', RW: 'fr', TG: 'fr', TD: 'fr',
    CF: 'fr',
  };

  // Map full country names to language codes (case-insensitive)
  const COUNTRY_NAME_LANGS = {
    // German
    'GERMANY': 'de', 'DEUTSCHLAND': 'de',
    'AUSTRIA': 'de', 'ÖSTERREICH': 'de', 'OESTERREICH': 'de',
    'SWITZERLAND': 'de', 'SCHWEIZ': 'de',
    'LIECHTENSTEIN': 'de',
    'LUXEMBOURG': 'de',
    // Greek. `ΕΛΛΑΣ` is the modern Greek name and is absent
    // from CLDR, so it is the one Greek form that has to be written out.
    'GREECE': 'el', 'ΕΛΛΑΔΑ': 'el', 'ΕΛΛΑΣ': 'el', 'ELLADA': 'el',
    'CYPRUS': 'el', 'ΚΥΠΡΟΣ': 'el', 'KYPROS': 'el',
    // Italian
    'ITALY': 'it', 'ITALIA': 'it',
    'SAN MARINO': 'it',
    'VATICAN CITY': 'it', 'VATICAN': 'it', 'HOLY SEE': 'it',
    // Spanish
    'SPAIN': 'es', 'ESPAÑA': 'es', 'ESPANA': 'es',
    'MEXICO': 'es', 'MÉXICO': 'es', 'MEXICO': 'es',
    'ARGENTINA': 'es',
    'BOLIVIA': 'es',
    'CHILE': 'es',
    'COLOMBIA': 'es',
    'COSTA RICA': 'es',
    'CUBA': 'es',
    'DOMINICAN REPUBLIC': 'es',
    'ECUADOR': 'es',
    'EL SALVADOR': 'es',
    'EQUATORIAL GUINEA': 'es',
    'GUATEMALA': 'es',
    'HONDURAS': 'es',
    'NICARAGUA': 'es',
    'PANAMA': 'es',
    'PARAGUAY': 'es',
    'PERU': 'es', 'PERÚ': 'es',
    'PUERTO RICO': 'es',
    'URUGUAY': 'es',
    'VENEZUELA': 'es',
    // French
    'FRANCE': 'fr',
    'MONACO': 'fr',
    'BELGIUM': 'fr', 'BELGIQUE': 'fr',
    'CÔTE D\'IVOIRE': 'fr', 'COTE D\'IVOIRE': 'fr', 'IVORY COAST': 'fr',
    'SENEGAL': 'fr',
    'DR CONGO': 'fr', 'DEMOCRATIC REPUBLIC OF THE CONGO': 'fr', 'CONGO DR': 'fr',
    'CONGO': 'fr', 'REPUBLIC OF THE CONGO': 'fr',
    'CAMEROON': 'fr', 'CAMEROUN': 'fr',
    'MADAGASCAR': 'fr',
    'HAITI': 'fr', 'HAÏTI': 'fr',
    'BENIN': 'fr', 'BÉNIN': 'fr',
    'BURKINA FASO': 'fr',
    'BURUNDI': 'fr',
    'DJIBOUTI': 'fr',
    'GABON': 'fr',
    'GUINEA': 'fr', 'GUINÉE': 'fr',
    'MALI': 'fr',
    'NIGER': 'fr',
    'RWANDA': 'fr',
    'TOGO': 'fr',
    'CHAD': 'fr', 'TCHAD': 'fr',
    'CENTRAL AFRICAN REPUBLIC': 'fr', 'CAR': 'fr',
    'CENTRAL AFRICAN REP': 'fr',
    // Localized names are NOT listed here. A name written in one language can
    // name a country whose visitors read another ("Frankreich" is German for
    // France, so it has to resolve to French), and a hand-written row per
    // language per country is exactly the kind of table that goes quietly
    // wrong. `countryNameIndex` below derives them from COUNTRY_LANGS instead,
    // so a name can never disagree with the code it stands for.
    'UNITED STATES': 'en', 'USA': 'en', 'UNITED STATES OF AMERICA': 'en',
    'UNITED KINGDOM': 'en', 'UK': 'en', 'GREAT BRITAIN': 'en', 'BRITAIN': 'en',
    'CANADA': 'en', 'AUSTRALIA': 'en', 'NEW ZEALAND': 'en', 'IRELAND': 'en',
  };

  /** Retained timezone hints for consumers; IP-based startup does not use them. */
  const ZONE_LANGS = [
    { match: /^(Europe|Athens|_)/, test: /Athens/i, lang: 'el' },
  ];


  // ==========================================================================
  // Dictionary
  // --------------------------------------------------------------------------
  // Keys are grouped by the surface that owns them. English is the reference:
  // any key missing from `el` or `de` falls back to it rather than leaking a raw
  // key onto the page, and `tests/i18n.test.js` enforces the parity.
  // ==========================================================================
  const translations = {
    en: {
      // --- Document ---------------------------------------------------------
      'app.name': 'WeatherScope',
      'app.title': 'WeatherScope - Climate & City Forecasts',
      'app.description': 'Search real-time weather conditions by city name or discover cities worldwide meeting your preferred climate conditions.',
      'app.noscript': 'WeatherScope needs JavaScript enabled to fetch and display live meteorological data.',
      'app.noscriptHint': 'Please enable JavaScript in your browser and reload the page.',

      // --- Header -----------------------------------------------------------
      'nav.modeAria': 'Search mode selection',
      'nav.citySearch': 'City Search',
      'nav.compare': 'Compare',
      'nav.climateFilter': 'Climate Filter',
      'nav.unitAria': 'Temperature unit selection',
      'nav.languageAria': 'Language selection',
      'nav.yourTime': 'Your time',
      'nav.searchModeCity': 'City Search',
      'nav.searchModeCompare': 'Compare',
      'nav.searchModeClimate': 'Climate Filter',

      // --- Search box -------------------------------------------------------
      'search.placeholderCity': 'Search for a city (e.g. Paris, Tokyo, New York)...',
      'search.placeholderCompare': 'Add a location to compare (e.g. Athens, Oslo, Cairo)...',
      'search.placeholderClimate': 'Search climate: e.g. Sunny, Warm, Rain, Snow, > 25°C, Cold < 10°C...',
      'search.submit': 'Search',
      'search.inputAria': 'Search for a city or climate condition',
      'search.clearAria': 'Clear input',
      'search.suggestionsAria': 'Search suggestions',
      'search.useLocation': 'Use current location',
      'search.searchingFor': 'Searching for "{city}"...',
      'search.matchingLocations': '{count} matching locations - select one',

      // --- Climate preset chips ---------------------------------------------
      'climate.presetClimates': 'Preset Climates:',
      'climate.sunny': 'Sunny',
      'climate.cloudy': 'Cloudy',
      'climate.rainy': 'Rainy',
      'climate.snowy': 'Snowy',
      'climate.storm': 'Storm',
      'climate.freezing': 'Freezing',
      'climate.cold': 'Cold',
      'climate.cool': 'Cool',
      'climate.mild': 'Mild',
      'climate.warm': 'Warm',
      'climate.hot': 'Hot',
      'climate.humid': 'Humid',
      'climate.dry': 'Dry',
      'climate.windy': 'Windy',
      'climate.gale': 'Gale',
      'climate.beachDay': 'Beach Day',
      'climate.skiTrip': 'Ski Trip',
      'climate.tropical': 'Tropical',
      'climate.mildBreezy': 'Mild & Breezy',
      'climate.rainyMild': 'Rainy & Mild',

      // --- Climate results --------------------------------------------------
      'climate.resultsTitle': 'Cities matching climate conditions',
      'climate.resultsAria': 'Matching cities',
      'climate.foundOne': '{count} city found',
      'climate.foundMany': '{count} cities found',
      'climate.resultsSubtitle': 'Searched {count} benchmark cities worldwide. Click any city to explore its detailed real-time weather and 7-day outlook.',
      'climate.clickToExplore': 'Click on any city card to explore its detailed real-time weather and 7-day outlook.',
      'climate.sortLabel': 'Sort:',
      'climate.sortNameAsc': 'City name (A-Z)',
      'climate.sortNameDesc': 'City name (Z-A)',
      'climate.sortTemperature': 'Temperature',
      'climate.sortHumidity': 'Humidity',
      'climate.sortWind': 'Wind speed',
      'climate.sortHighToLow': '{label} (higher to lower)',
      'climate.sortLowToHigh': '{label} (lower to higher)',
      'climate.emptyTitle': 'No cities in the {count}-city benchmark dataset currently match this exact climate criteria.',
      'camera.toggleOn': 'Live cameras on',
      'camera.toggleOff': 'Live cameras off',
      'camera.none': 'No free public camera for this city',
      'camera.live': 'Live',
      'camera.still': 'Live still',
      'camera.next': 'Next camera ({index}/{total})',
      'camera.pause': 'Pause',
      'camera.play': 'Play',
      'camera.off': 'Live cameras are off',
      'camera.throttled': 'Camera lookup unavailable right now',
      'camera.alt': 'Live camera view: {place}',
      'camera.altGeneric': 'Live camera view',
      'camera.distanceOne': '{distance} km away',
      'camera.distanceMany': '{distance} km away',
      'camera.attribution': 'Camera: {source}',
      'camera.offline': 'Camera unavailable',
      'camera.compareAria': 'Live cameras for the compared locations',
      'climate.emptyHint': 'Try a broader condition like "Sunny", "Warm", or "Cloudy".',
      'climate.viewDetails': 'View Weather Details',
      'climate.cardHumidityTitle': 'Relative Humidity',
      'climate.cardWindTitle': 'Wind Speed',
      'climate.backToMatching': 'Back to matching cities ({count} found)',
      'climate.searchWorldwide': 'Search worldwide cities matching "{query}" →',
      'climate.discovery': 'Climate Discovery',
      'climate.searching': 'Searching worldwide cities matching preferred climate...',
      'climate.errorTitle': 'Climate Search Error',
      'climate.errorBody': 'Failed to retrieve global meteorological data. Please try again.',

      // --- Loading / error states -------------------------------------------
      'state.fetching': 'Fetching live meteorological data...',
      'state.fetchingCity': 'Fetching live weather for {city}...',
      'state.errorTitle': 'No Matching Results',
      'state.errorBody': "We couldn't retrieve results for your query. Please adjust your criteria and try again.",
      'state.retry': 'Try Another Search',
      'state.backToResults': 'Back to Climate Results',
      'state.weatherUnavailableTitle': 'Weather Data Unavailable',
      'state.weatherUnavailableBody': 'Could not fetch weather for "{city}". The request may have timed out - please check your internet connection and try again.',
      'state.cityNotFoundTitle': 'City Not Found',
      'state.cityNotFoundBody': 'No results found for "{city}". Try searching with a different spelling or adding a country.',
      'state.searchFailedTitle': 'Search Failed',
      'state.searchTimedOut': 'The search request timed out. Please check your internet connection and try again.',
      'state.searchFailed': 'An error occurred while searching for the city. Please try again.',

      // --- Geolocation ------------------------------------------------------
      'geo.button': 'Use current location',
      'geo.detecting': 'Detecting your geographical location...',
      'geo.unsupportedTitle': 'Geolocation Unsupported',
      'geo.unsupported': 'Your browser does not support automatic location detection.',
      'geo.deniedTitle': 'Location Access Denied',
      'geo.denied': 'Could not retrieve your location. Please check browser permissions or search for your city directly.',
      'geo.myLocation': 'My Location',

      // --- Compare Locations ------------------------------------------------
      'compare.heading': 'Compare Locations',
      'compare.count': '{selected} of {max} selected',
      'compare.subtitle': 'Search above or tap a popular city to build a list, then compare 2 to 4 places.',
      'compare.addLocation': 'Add location',
      'compare.run': 'Compare',
      'compare.clearAll': 'Clear all',
      'compare.loading': 'Comparing weather...',
      'compare.glanceHeading': 'Weather at a glance',
      'compare.legendHigh': 'Highest in the row',
      'compare.legendLow': 'Lowest in the row',
      'compare.currentHeading': 'Current conditions',
      'compare.forecastHeading': "Today's forecast comparison",
      'compare.forecastSubtitle': 'Highest, lowest, rain chance & peak values',
      'compare.metricHead': 'Metric',
      'compare.locationSlot': 'Location {slot}',
      'compare.locationSlotEmpty': 'Location {slot} — use the search above or a popular city',
      'compare.add': 'Add',
      'compare.moveEarlier': 'Move earlier',
      'compare.moveLater': 'Move later',
      'compare.removeCity': 'Remove {city} from the comparison',
      'compare.clearSlot': 'Clear this location',
      'compare.unknownLocation': 'Unknown location',
      'compare.selectedLocation': 'Selected location',
      'compare.changeLocation': '{city}, {meta}. Change this location.',
      'compare.locationFallback': 'Location',
      'compare.weatherUnavailable': 'Weather unavailable',
      'compare.tryAgain': 'Try again',
      'compare.retryAria': 'Retry loading the weather for {city}',
      'compare.thisLocation': 'this location',
      'compare.highest': 'highest',
      'compare.lowest': 'lowest',
      'compare.ariaExtreme': '{value}, {word} of the compared locations',
      'compare.ariaExtremeTitle': '{word} for {row}',
      'compare.freshness': 'Latest reading: {label}',
      'compare.needTwoLocations': 'At least two locations with live data are needed for a comparison.',
      'compare.verySimilar': 'These locations are currently very similar - no difference stands out.',
      'compare.duplicate': '{city} is already in your comparison.',
      'compare.listFull': 'You can compare up to {max} locations. Remove one to add another.',
      'compare.couldNotAdd': 'That location could not be added to the comparison.',
      'compare.replacing': 'Choosing a new location for Location {slot} (currently {city}). Press Escape to cancel.',
      'compare.noResults': 'No results found for "{query}". Try a different spelling or add a country.',
      'compare.searchTimedOut': 'The location search timed out. Check your connection and try again.',
      'compare.searchFailed': 'The location search failed. Please try again.',
      'compare.locationZone': 'Local time zone {zone}, {diff}',

      // --- Today at a glance (markup) ---------------------------------------
      'glance.heading': 'Today at a glance',
      'glance.feelsLike': 'Feels like',
      'glance.verdictLabel': "Today's verdict:",
      'glance.whatToWear': 'What to wear:',

      // --- Hero -------------------------------------------------------------
      'hero.feelsLike': 'Feels like',
      'hero.shareAria': 'Share weather',
      'hero.refreshAria': 'Refresh weather data',

      // --- Current conditions metrics ---------------------------------------
      'metrics.aria': 'Key Weather Metrics',
      'metrics.heading': 'Current Conditions',
      'metrics.humidity': 'Humidity',
      'metrics.wind': 'Wind',
      'metrics.uvIndex': 'UV Index',
      'metrics.pressure': 'Pressure',
      'metrics.precipitation': 'Precipitation',
      'metrics.localTime': 'Local Time',
      'metrics.sunriseSunset': 'Sunrise & Sunset',
      'metrics.sunrise': 'Sunrise',
      'metrics.sunset': 'Sunset',
      'metrics.cloudCover': 'Cloud cover: {value}%',
      'metrics.humidityDry': 'Dry environment',
      'metrics.humidityComfortable': 'Comfortable humidity',
      'metrics.humidityHigh': 'High humidity',
      'metrics.pressureNormal': 'Normal pressure',
      'metrics.pressureHigh': 'High pressure system',
      'metrics.pressureLow': 'Low pressure system',
      'metrics.uvLow': 'Low',
      'metrics.uvModerate': 'Moderate',
      'metrics.uvHigh': 'High',
      'metrics.uvVeryHigh': 'Very High',
      'metrics.uvExtreme': 'Extreme',
      'metrics.uvAdviceLow': 'Low risk of sun damage',
      'metrics.uvAdviceModerate': 'Sun protection advised',
      'metrics.uvAdviceHigh': 'Wear hat and sunscreen',
      'metrics.uvAdviceVeryHigh': 'Avoid sun during midday',
      'metrics.uvAdviceExtreme': 'Take full sun precautions',

      // --- Forecast cards ---------------------------------------------------
      'forecast.hourlyHeading': '24-Hour Forecast',
      'forecast.hourlySubtitle': 'Local hourly projection ·',
      'forecast.dailyHeading': '7-Day Forecast',
      'forecast.dailySubtitle': 'Upcoming outlook ·',
      'forecast.cityTime': 'city time',
      'forecast.hourlyAria': 'Hourly weather forecast',
      'forecast.now': 'Now',
      'forecast.today': 'Today',
      'forecast.maxUvTitle': 'Max UV index',
      'forecast.precipChanceTitle': 'Chance of precipitation',

      // --- Popular cities + footer ------------------------------------------
      'popular.label': 'Popular:',
      'footer.providedBy': 'Data provided by {link}',
      'footer.tagline': 'Real-time global meteorological intelligence',
      'footer.timezoneNote': "Local times use each city's IANA timezone and tick in real time · Your reference time is detected from your device timezone ({zone})",

      // --- Clocks / time difference -----------------------------------------
      'time.sameAsYou': 'Same time as you',
      'time.sameAsYouShort': 'Same time',
      'time.aheadOf': '{value} ahead of you',
      'time.behind': '{value} behind you',
      'time.detectedZone': 'Detected timezone: {zone}',
      'time.localTimeAria': 'Your local time, detected from your timezone {zone}',
      'time.youClock': 'You {time}',
      'time.yourZoneTitle': 'Your timezone: {zone}',
      'time.allTimesIn': 'All times in {zone}',

      // --- Visitor IP location ------------------------------------------------
      'nav.detectedLocation': 'Detected location',
      'nav.yourIP': 'Your IP',
      'nav.countryCity': '{country}, {city}',
      'time.offsetVsYou': 'Offset vs you ({zone}): {value}',
      'time.freshnessNow': 'Updated just now',
      'time.freshnessMinutes': 'Updated {count} min ago',
      'time.freshnessHours': 'Updated {count} hour ago',
      'time.freshnessHoursPlural': 'Updated {count} hours ago',
      'time.freshnessDays': 'Updated {count} day ago',
      'time.freshnessDaysPlural': 'Updated {count} days ago',

      // --- Sharing ----------------------------------------------------------
      'share.forecast': 'Shared forecast',
      'share.showAllCards': 'Show all cards',
      'share.button': 'Share weather',
      'share.weatherIn': 'Weather in {place}',
      'share.rain': '{value}% rain',
      'share.high': 'High {value}',
      'share.low': 'Low {value}',
      'share.copied': 'Link copied. Opening it shows {place} with the shared cards.',
      'share.copyFailedInBar': 'Could not copy automatically. The link for {place} is now in the address bar.',
      'share.copyFailed': 'Could not copy automatically. Copy the link from the address bar to share this forecast.',

      // --- Weather condition labels (WMO) ------------------------------------
      'wmo.0': 'Clear sky',
      'wmo.1': 'Mainly clear',
      'wmo.2': 'Partly cloudy',
      'wmo.3': 'Overcast',
      'wmo.45': 'Foggy',
      'wmo.48': 'Rime fog',
      'wmo.51': 'Light drizzle',
      'wmo.53': 'Moderate drizzle',
      'wmo.55': 'Dense drizzle',
      'wmo.56': 'Freezing drizzle',
      'wmo.57': 'Dense freezing drizzle',
      'wmo.61': 'Slight rain',
      'wmo.63': 'Moderate rain',
      'wmo.65': 'Heavy rain',
      'wmo.66': 'Freezing rain',
      'wmo.67': 'Heavy freezing rain',
      'wmo.71': 'Slight snow',
      'wmo.73': 'Moderate snow',
      'wmo.75': 'Heavy snow fall',
      'wmo.77': 'Snow grains',
      'wmo.80': 'Slight rain showers',
      'wmo.81': 'Moderate rain showers',
      'wmo.82': 'Violent rain showers',
      'wmo.85': 'Snow showers',
      'wmo.86': 'Heavy snow showers',
      'wmo.95': 'Thunderstorm',
      'wmo.96': 'Thunderstorm with hail',
      'wmo.99': 'Heavy thunderstorm with hail',
      'wmo.unknown': 'Clear',

      // --- Glance engine (glance.js) ----------------------------------------
      'glanceEngine.storm': 'Thunderstorms expected',
      'glanceEngine.snow': 'Snowy today',
      'glanceEngine.freezing': 'Freezing cold',
      'glanceEngine.hot': 'Very hot',
      'glanceEngine.umbrella': 'Umbrella recommended',
      'glanceEngine.gale': 'Very windy',
      'glanceEngine.good': 'Good weather',
      'glanceEngine.around': ' around {time}',
      'glanceEngine.at': ' at {time}',
      'glanceEngine.detailStorm': 'Thunderstorms are forecast{when} — outdoor plans may be cut short.',
      'glanceEngine.detailSnow': 'Snow is forecast{when} — allow extra travel time.',
      'glanceEngine.detailFreezing': 'Feels like {temp}{when} — heavy layers needed.',
      'glanceEngine.detailHot': 'Feels like {temp}{when} — seek shade and hydrate.',
      'glanceEngine.detailRainNow': 'Rain is falling right now ({amount} in the last hour).',
      'glanceEngine.detailRainNowShort': 'Rain is falling right now.',
      'glanceEngine.detailRainPeak': 'Rain peaks at {value}{when}.',
      'glanceEngine.detailLightPrecip': 'Light precipitation is expected today.',
      'glanceEngine.detailWinds': 'Winds reach {value} today — a blustery day out.',
      'glanceEngine.detailVeryWindy': 'Very windy today.',
      'glanceEngine.detailMostlyDry': 'Mostly dry',
      'glanceEngine.detailDry': 'Dry',
      'glanceEngine.detailComfortable': 'and comfortable around {value}',
      'glanceEngine.detailWithWind': 'with {value}',
      'glanceEngine.windLight': 'light wind',
      'glanceEngine.windBreeze': 'a breeze',
      'glanceEngine.windStrong': 'strong wind',
      'glanceEngine.windVeryStrong': 'very strong wind',
      'glanceEngine.metricRain': 'Rain',
      'glanceEngine.metricWind': 'Wind',
      'glanceEngine.metricHumidity': 'Humidity',
      'glanceEngine.hintPeakToday': 'peak chance today',
      'glanceEngine.hintNotReported': 'not reported',
      'glanceEngine.hintRelativeHumidity': 'relative humidity',

      // --- Compare engine (compare.js) ---------------------------------------
      'compareEngine.metricCondition': 'Weather',
      'compareEngine.metricTemperature': 'Temperature',
      'compareEngine.metricApparent': 'Feels like',
      'compareEngine.metricRainChance': 'Rain chance',
      'compareEngine.metricWind': 'Wind',
      'compareEngine.metricPressure': 'Pressure',
      'compareEngine.metricCloudCover': 'Cloud cover',
      'compareEngine.metricSun': 'Sunrise / sunset',
      'compareEngine.metricPrecipitation': 'Precipitation',
      'compareEngine.metricUv': 'UV index',
      'compareEngine.metricMaxUv': 'Max UV',
      'compareEngine.metricMaxWind': 'Max wind',
      'compareEngine.warmer': 'warmer',
      'compareEngine.cooler': 'cooler',
      'compareEngine.insightTemperature': '{city} is {gap} {word} than {other}.',
      'compareEngine.insightApparent': 'It feels {gap} {word} in {city} than in {other}.',
      'compareEngine.insightRain': '{city} has the lower chance of rain ({low} vs {high}).',
      'compareEngine.insightWind': 'The wind is {gap} stronger in {city} than in {other}.',
      'compareEngine.insightPressure': 'The air pressure is {gap} higher in {city} than in {other}.',
      'compareEngine.insightCloud': '{city} is {gap} cloudier than {other}.',
      'compareEngine.insightSun': 'The sun rises {gap} earlier in {city} than in {other}.',
      'compareEngine.insightPrecip': '{city} has {gap} more precipitation than {other}.',
      'compareEngine.insightUv': 'The UV index is {gap} higher in {city} than in {other}.',
      'compareEngine.insightMaxUv': "Today's peak UV index is {gap} higher in {city} than in {other}.",
      'compareEngine.insightMaxWind': "Today's strongest wind is {gap} faster in {city} than in {other}.",
      'compareEngine.gapWarmer': ' warmer',
      'compareEngine.gapCooler': ' cooler',
      'compareEngine.gapStronger': ' stronger',
      'compareEngine.gapHigher': ' higher',
      'compareEngine.gapCloudier': ' cloudier',
      'compareEngine.gapEarlier': ' earlier',
      'compareEngine.gapMore': ' more',
      'compareEngine.gapFaster': ' faster',

      // --- Assistant engine (advice.js) --------------------------------------
      'adviceEngine.windowMorning': 'Morning',
      'adviceEngine.windowMidday': 'Midday',
      'adviceEngine.windowAfternoon': 'Afternoon',
      'adviceEngine.windowEvening': 'Evening',
      'adviceEngine.phraseMorning': 'your morning',
      'adviceEngine.phraseMidday': 'the midday hours',
      'adviceEngine.phraseAfternoon': 'your afternoon',
      'adviceEngine.phraseEvening': 'the evening',
      'adviceEngine.tileUmbrella': 'Umbrella',
      'adviceEngine.tileWalk': 'Walk',
      'adviceEngine.tileCarWash': 'Wash car',
      'adviceEngine.tileCycling': 'Cycling',
      'adviceEngine.tileSwimming': 'Swimming',
      'adviceEngine.tileClothing': 'What to wear',
      'adviceEngine.summaryLabel': "Today's advice",
      'adviceEngine.scopeToday': 'the rest of today',
      'adviceEngine.scopeNext24': 'the next 24 hours',
      'adviceEngine.notEnoughTitle': 'Not enough forecast data',
      'adviceEngine.notEnoughDetail': 'This recommendation needs hourly forecast data that is not available right now.',
      'adviceEngine.noHourly': 'No usable hourly forecast is available.',
      'adviceEngine.noPrecip': 'This city has no precipitation probability or amount in the forecast.',
      'adviceEngine.noTemperatures': 'No usable hourly temperatures are available.',
      'adviceEngine.noStretch': 'Not enough hourly temperatures to compare a stretch of the day.',
      'adviceEngine.noDaylight': 'No hourly air temperature is available for the daylight hours.',
      'adviceEngine.noPeriodTemp': 'No hourly temperature is available for this period.',
      'adviceEngine.notCalculated': 'This recommendation could not be calculated from the current forecast.',
      'adviceEngine.summaryNotCalculated': 'This summary could not be calculated from the current forecast.',
      'adviceEngine.umbrellaDefinitely': 'Definitely bring an umbrella',
      'adviceEngine.umbrellaLikely': 'Bring an umbrella',
      'adviceEngine.umbrellaUnlikely': 'Probably not',
      'adviceEngine.walkNone': 'No ideal period today',
      'adviceEngine.walkLimited': 'Limited detail for this period',
      'adviceEngine.walkReasonWind': 'it is windy',
      'adviceEngine.walkBest': 'The driest window is {window}. {reasons}',
      'adviceEngine.walkBestPlain': 'The driest window is {window}.',
      'adviceEngine.walkBut': '{detail}, but {reasons}.',
      'adviceEngine.carWashGood': 'Good day to wash the car',
      'adviceEngine.carWashBad': 'Not ideal today',
      'adviceEngine.carWashRainLater': 'Rain is expected{when}{amount}.',
      'adviceEngine.carWashUnsettled': ' Wet or unsettled conditions are expected throughout.',
      'adviceEngine.carWashDrySpells': 'Dry spells are too short to be worth it.{hint}',
      'adviceEngine.cyclingBad': 'Not ideal for cycling',
      'adviceEngine.cyclingWind': 'Strong winds of about {wind}{when} are expected.',
      'adviceEngine.cyclingRain': '{amount}',
      'adviceEngine.cyclingCold': 'Very cold for riding - around {temp}.',
      'adviceEngine.cyclingHot': 'Very warm for riding - up to {temp}.',
      'adviceEngine.cyclingGood': 'Good for cycling',
      'adviceEngine.cyclingGoodDetail': '{temps}dry and relatively light winds.',
      'adviceEngine.swimBad': 'Not ideal today',
      'adviceEngine.swimRain': '{amount} Best to stay out of the water.',
      'adviceEngine.swimCold': 'Cool for outdoor swimming - air around {temp} at best.',
      'adviceEngine.swimHot': 'Very warm air, up to {temp}. Stay in the shade between sessions.',
      'adviceEngine.swimGood': 'Good outdoor swimming weather',
      'adviceEngine.swimOvercast': 'mostly overcast',
      'adviceEngine.clothingLight': 'Light clothing',
      'adviceEngine.clothingWarm': 'Warm - around {temp} in the warmest part of the day.',
      'adviceEngine.clothingJacketUmbrella': 'Warm jacket + umbrella',
      'adviceEngine.clothingJacketUmbrellaDetail': 'Cold and wet - around {temp} with rain expected.',
      'adviceEngine.clothingTShirtUmbrella': 'T-shirt weather + umbrella',
      'adviceEngine.clothingTShirt': 'T-shirt weather',
      'adviceEngine.clothingTShirtDetail': 'Warm and dry{wind}.',
      'adviceEngine.clothingTShirtWind': ' with light winds',
      'adviceEngine.clothingLightJacket': 'Light jacket recommended',
      'adviceEngine.clothingLightJacketDetail': 'Mild - around {temp}.',
      'adviceEngine.clothingWarmJacket': 'Warm jacket recommended',
      'adviceEngine.clothingWarmJacketDetail': 'Cool - around {temp}.',
      'adviceEngine.clothingCoat': 'Winter coat recommended',
      'adviceEngine.clothingCoatDetail': 'Cold, around {temp}.',
      'adviceEngine.clothingLayers': 'Very warm layers needed',
      'adviceEngine.clothingLayersDetail': 'Sub-zero, around {temp}.',
      'adviceEngine.uvNote': ' Sun protection is advisable.',
      'adviceEngine.swingNote': ' Expect a {swing}°C swing today.',
      'adviceEngine.windNote': ' It is windy.',
      'adviceEngine.darkNote': ' Most of the remaining forecast window is after dark.',
      'adviceEngine.breezeNote': ' A light breeze is expected.',
      'adviceEngine.tempsNote': 'Temperatures around {temp}. ',
      'adviceEngine.rainWindowPeriod': 'Rain is forecast during this period.',
      'adviceEngine.rainWindowLight': 'Light precipitation is possible during this period.',
      'adviceEngine.summarySnow': 'Snowy today',
      'adviceEngine.summarySnowDetail': 'Snow is forecast today. Allow extra travel time.',
      'adviceEngine.summaryStorm': 'Thunderstorms expected',
      'adviceEngine.summaryStormDetail': 'Thunderstorms are forecast today - outdoor plans may be interrupted.',
      'adviceEngine.summaryUmbrella': 'Take an umbrella today',
      'adviceEngine.summaryCold': 'Cold today',
      'adviceEngine.summaryHot': 'Hot today',
      'adviceEngine.summaryGreat': 'Great day to be outside',
      'adviceEngine.summaryMixed': 'Mixed conditions today',
      'adviceEngine.summaryMixedDetail': 'Unsettled spells are likely{when} during {scope}.',
      'adviceEngine.summaryCloudyDry': 'Cloudy but dry today',
      'adviceEngine.summaryCloudyDryDetail': 'No rain is forecast; around {temp} with {wind}.',
      'adviceEngine.summaryVariableWinds': 'variable winds',
      'assistant.scopeNext24': 'Based on the next 24 hours',
      'assistant.scopeToday': 'Based on the rest of today',
      'assistant.heading': "Today's advice",
      'assistant.preparing': 'Preparing your forecast…',
      'assistant.windowTitle': 'Rain during your…?',
      'assistant.windowTitlePlain': 'Rain during your...',
    },

    el: {
      // --- Document ---------------------------------------------------------
      'app.name': 'WeatherScope',
      'app.title': 'WeatherScope - Προγνώσεις Κλίματος & Πόλεων',
      'app.description': 'Αναζητήστε καιρό σε πραγματικό χρόνο ανά πόλη ή ανακαλύψτε πόλεις παγκοσμίως που ανταποκρίνονται στις κλιματικές συνθήκες που προτιμάτε.',
      'app.noscript': 'Το WeatherScope απαιτεί ενεργοποιημένη JavaScript για την ανάκτηση και την εμφάνιση ζωντανών μετεωρολογικών δεδομένων.',
      'app.noscriptHint': 'Ενεργοποιήστε την JavaScript στον browser σας και φορτώστε ξανά τη σελίδα.',

      // --- Header -----------------------------------------------------------
      'nav.modeAria': 'Επιλογή λειτουργίας αναζήτησης',
      'nav.citySearch': 'Αναζήτηση Πόλης',
      'nav.compare': 'Σύγκριση',
      'nav.climateFilter': 'Φίλτρο Κλίματος',
      'nav.unitAria': 'Επιλογή μονάδας θερμοκρασίας',
      'nav.languageAria': 'Επιλογή γλώσσας',
      'nav.yourTime': 'Η ώρα σας',
      'nav.searchModeCity': 'Αναζήτηση Πόλης',
      'nav.searchModeCompare': 'Σύγκριση',
      'nav.searchModeClimate': 'Φίλτρο Κλίματος',

      // --- Search box -------------------------------------------------------
      'search.placeholderCity': 'Αναζήτηση πόλης (π.χ. Αθήνα, Τόκιο, Νέα Υόρκη)...',
      'search.placeholderCompare': 'Προσθέστε τοποθεσία για σύγκριση (π.χ. Αθήνα, Όσλο, Κάιρο)...',
      'search.placeholderClimate': 'Αναζήτηση κλίματος: π.χ. Ηλιόλουστο, Ζεστό, Βροχή, Χιόνι, > 25°C, Κρύο < 10°C...',
      'search.submit': 'Αναζήτηση',
      'search.inputAria': 'Αναζήτηση πόλης ή κλιματικής συνθήκης',
      'search.clearAria': 'Καθαρισμός πεδίου',
      'search.suggestionsAria': 'Προτάσεις αναζήτησης',
      'search.useLocation': 'Χρήση τρέχουσας θέσης',
      'search.searchingFor': 'Αναζήτηση για "{city}"...',
      'search.matchingLocations': '{count} αντίστοιχες τοποθεσίες - επιλέξτε μία',

      // --- Climate preset chips ---------------------------------------------
      'climate.presetClimates': 'Προκαθορισμένα Κλίματα:',
      'climate.sunny': 'Ηλιόλουστο',
      'climate.cloudy': 'Συννεφιά',
      'climate.rainy': 'Βροχερό',
      'climate.snowy': 'Χιονισμένο',
      'climate.storm': 'Καταιγίδα',
      'climate.freezing': 'Παγωμένο',
      'climate.cold': 'Κρύο',
      'climate.cool': 'Δροσερό',
      'climate.mild': 'Ήπιο',
      'climate.warm': 'Ζεστό',
      'climate.hot': 'Καυτό',
      'climate.humid': 'Υγρό',
      'climate.dry': 'Ξηρό',
      'climate.windy': 'Ανεμώδες',
      'climate.gale': 'Θυελλώδες',
      'climate.beachDay': 'Ημέρα στην Παραλία',
      'climate.skiTrip': 'Σκι στα βουνά',
      'climate.tropical': 'Τροπικό',
      'climate.mildBreezy': 'Ήπιο με Αεράκι',
      'climate.rainyMild': 'Βροχερό και Ήπιο',

      // --- Climate results --------------------------------------------------
      'climate.resultsTitle': 'Πόλεις που ταιριάζουν με τις κλιματικές συνθήκες',
      'climate.resultsAria': 'Πόλεις που ταιριάζουν',
      'climate.foundOne': '{count} πόλη βρέθηκε',
      'climate.foundMany': '{count} πόλεις βρέθηκαν',
      'climate.resultsSubtitle': 'Αναζητήθηκαν {count} πόλεις αναφοράς παγκοσμίως. Κάντε κλικ σε οποιαδήποτε πόλη για να δείτε τον λεπτομερή καιρό σε πραγματικό χρόνο και την πρόγνωση 7 ημερών.',
      'climate.clickToExplore': 'Κάντε κλικ σε οποιαδήποτε κάρτα πόλης για να δείτε τον λεπτομερή καιρό σε πραγματικό χρόνο και την πρόγνωση 7 ημερών.',
      'climate.sortLabel': 'Ταξινόμηση:',
      'climate.sortNameAsc': 'Όνομα πόλης (Α-Ω)',
      'climate.sortNameDesc': 'Όνομα πόλης (Ω-Α)',
      'climate.sortTemperature': 'Θερμοκρασία',
      'climate.sortHumidity': 'Υγρασία',
      'climate.sortWind': 'Ταχύτητα ανέμου',
      'climate.sortHighToLow': '{label} (υψηλότερη προς χαμηλότερη)',
      'climate.sortLowToHigh': '{label} (χαμηλότερη προς υψηλότερη)',
      'climate.emptyTitle': 'Καμία από τις {count} πόλεις αναφοράς δεν ταιριάζει αυτή τη στιγμή με αυτά τα ακριβή κλιματικά κριτήρια.',
      'camera.toggleOn': 'Ζωντανές κάμερες ενεργές',
      'camera.toggleOff': 'Ζωντανές κάμερες εκτός',
      'camera.none': 'Δεν υπάρχει δωρεάν δημόσια κάμερα για αυτή την πόλη',
      'camera.live': 'Ζωντανά',
      'camera.pause': 'Παύση',
      'camera.play': 'Αναπαραγωγή',
      'camera.alt': 'Ζωντανή εικόνα από κάμερα: {place}',
      'camera.altGeneric': 'Ζωντανή εικόνα από κάμερα',
      'camera.distanceOne': '{distance} χλμ. μακριά',
      'camera.distanceMany': '{distance} χλμ. μακριά',
      'camera.attribution': 'Κάμερα: {source}',
      'camera.offline': 'Η κάμερα δεν είναι διαθέσιμη',
      'camera.still': 'Ζωντανή στιγμιότυπο',
      'camera.next': 'Επόμενη κάμερα ({index}/{total})',
      'camera.off': 'Οι ζωντανές κάμερες είναι απενεργοποιημένες',
      'camera.throttled': 'Η αναζήτηση κάμερας δεν είναι διαθέσιμη αυτή τη στιγμή',
      'camera.compareAria': 'Ζωντανές κάμερες για τις συγκρινόμενες τοποθεσίες',
      'climate.emptyHint': 'Δοκιμάστε μια ευρύτερη συνθήκη, όπως "Ηλιόλουστο", "Ζεστό" ή "Συννεφιά".',
      'climate.viewDetails': 'Δείτε αναλυτικά τον καιρό',
      'climate.cardHumidityTitle': 'Σχετική υγρασία',
      'climate.cardWindTitle': 'Ταχύτητα ανέμου',
      'climate.backToMatching': 'Πίσω στις πόλεις που ταιριάζουν ({count})',
      'climate.searchWorldwide': 'Αναζήτηση πόλεων παγκοσμίως που ταιριάζουν με "{query}" →',
      'climate.discovery': 'Ανακάλυψη Κλίματος',
      'climate.searching': 'Αναζήτηση πόλεων παγκοσμίως που ταιριάζουν με το επιλεγμένο κλίμα...',
      'climate.errorTitle': 'Σφάλμα Αναζήτησης Κλίματος',
      'climate.errorBody': 'Αποτυχία ανάκτησης παγκόσμιων μετεωρολογικών δεδομένων. Δοκιμάστε ξανά.',

      // --- Loading / error states -------------------------------------------
      'state.fetching': 'Λήψη ζωντανών μετεωρολογικών δεδομένων...',
      'state.fetchingCity': 'Λήψη ζωντανού καιρού για {city}...',
      'state.errorTitle': 'Δεν βρέθηκαν αποτελέσματα',
      'state.errorBody': 'Δεν μπορέσαμε να λάβουμε αποτελέσματα για το ερώτημά σας. Παρακαλώ προσαρμόστε τα κριτήρια και δοκιμάστε ξανά.',
      'state.retry': 'Δοκιμάστε άλλη αναζήτηση',
      'state.backToResults': 'Πίσω στα αποτελέσματα κλίματος',
      'state.weatherUnavailableTitle': 'Τα δεδομένα καιρού δεν είναι διαθέσιμα',
      'state.weatherUnavailableBody': 'Δεν ήταν δυνατή η λήψη καιρού για "{city}". Ίσως λήξε το χρονικό όριο του αιτήματος - ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',
      'state.cityNotFoundTitle': 'Η πόλη δεν βρέθηκε',
      'state.cityNotFoundBody': 'Δεν βρέθηκαν αποτελέσματα για "{city}". Δοκιμάστε διαφορετική ορθογραφία ή προσθέστε χώρα.',
      'state.searchFailedTitle': 'Η αναζήτηση απέτυχε',
      'state.searchTimedOut': 'Το αίτημα αναζήτησης έληξε το χρονικό όριο. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',
      'state.searchFailed': 'Παρουσιάστηκε σφάλμα κατά την αναζήτηση της πόλης. Δοκιμάστε ξανά.',

      // --- Geolocation ------------------------------------------------------
      'geo.button': 'Χρήση τρέχουσας θέσης',
      'geo.detecting': 'Ανίχνευση της γεωγραφικής σας θέσης...',
      'geo.unsupportedTitle': 'Η γεωτοπισδοσία δεν υποστηρίζεται',
      'geo.unsupported': 'Ο browser σας δεν υποστηρίζει αυτόματη ανίχνευση θέσης.',
      'geo.deniedTitle': 'Δεν επιτράπηκε η πρόσβαση στη θέση',
      'geo.denied': 'Δεν ήταν δυνατή η λήψη της θέσης σας. Ελέγξτε τις άδειες του browser ή αναζητήστε την πόλη σας.',
      'geo.myLocation': 'Η θέση μου',

      // --- Compare Locations ------------------------------------------------
      'compare.heading': 'Σύγκριση Τοποθεσιών',
      'compare.count': '{selected} από {max} επιλεγμένες',
      'compare.subtitle': 'Αναζητήστε παραπάνω ή πατήστε μια δημοφιλή πόλη για να δημιουργήσετε μια λίστα, και έπειτα συγκρίνετε 2 έως 4 τοποθεσίες.',
      'compare.addLocation': 'Προσθήκη τοποθεσίας',
      'compare.run': 'Σύγκριση',
      'compare.clearAll': 'Καθαρισμός όλων',
      'compare.loading': 'Σύγκριση καιρού...',
      'compare.glanceHeading': 'Ο καιρός με μια ματιά',
      'compare.legendHigh': 'Υψηλότερο στη σειρά',
      'compare.legendLow': 'Χαμηλότερο στη σειρά',
      'compare.currentHeading': 'Τρέχουσες συνθήκες',
      'compare.forecastHeading': 'Σύγκριση πρόγνωσης σήμερα',
      'compare.forecastSubtitle': 'Υψηλότερες, χαμηλότερες τιμές, πιθανότητα βροχής & μέγιστες τιμές',
      'compare.metricHead': 'Μετρική',
      'compare.locationSlot': 'Τοποθεσία {slot}',
      'compare.locationSlotEmpty': 'Τοποθεσία {slot} — χρησιμοποιήστε την αναζήτηση ή μια δημοφιλή πόλη',
      'compare.add': 'Προσθήκη',
      'compare.moveEarlier': 'Μετακίνηση νωρίτερα',
      'compare.moveLater': 'Μετακίνηση αργότερα',
      'compare.removeCity': 'Αφαίρεση {city} από τη σύγκριση',
      'compare.clearSlot': 'Καθαρισμός αυτής της τοποθεσίας',
      'compare.unknownLocation': 'Άγνωστη τοποθεσία',
      'compare.selectedLocation': 'Επιλεγμένη τοποθεσία',
      'compare.changeLocation': '{city}, {meta}. Αλλάξτε αυτή την τοποθεσία.',
      'compare.locationFallback': 'Τοποθεσία',
      'compare.weatherUnavailable': 'Ο καιρός δεν είναι διαθέσιμος',
      'compare.tryAgain': 'Δοκιμάστε ξανά',
      'compare.retryAria': 'Επανάληψη φόρτωσης του καιρού για {city}',
      'compare.thisLocation': 'αυτή η τοποθεσία',
      'compare.highest': 'υψηλότερο',
      'compare.lowest': 'χαμηλότερο',
      'compare.ariaExtreme': '{value}, {word} από τις συγκρινόμενες τοποθεσίες',
      'compare.ariaExtremeTitle': '{word} για {row}',
      'compare.freshness': 'Η πιο πρόσφατη μέτρηση: {label}',
      'compare.needTwoLocations': 'Χρειάζονται τουλάχιστον δύο τοποθεσίες με ζωντανά δεδομένα για μια σύγκριση.',
      'compare.verySimilar': 'Αυτές οι τοποθεσίες είναι προς το παρόν πολύ παρόμοιες - καμία διαφορά δεν ξεχωρίζει.',
      'compare.duplicate': '{city} υπάρχει ήδη στη σύγκρισή σας.',
      'compare.listFull': 'Μπορείτε να συγκρίνετε έως {max} τοποθεσίες. Αφαιρέστε μία για να προσθέσετε άλλη.',
      'compare.couldNotAdd': 'Αυτή η τοποθεσία δεν μπόρεσε να προστεθεί στη σύγκριση.',
      'compare.replacing': 'Επιλογή νέας τοποθεσίας για την Τοποθεσία {slot} (αυτή τη στιγμή {city}). Πατήστε Escape για ακύρωση.',
      'compare.noResults': 'Δεν βρέθηκαν αποτελέσματα για "{query}". Δοκιμάστε διαφορετική ορθογραφία ή προσθέστε χώρα.',
      'compare.searchTimedOut': 'Η αναζήτηση τοποθεσίας έληξε το χρονικό όριο. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.',
      'compare.searchFailed': 'Η αναζήτηση τοποθεσίας απέτυχε. Δοκιμάστε ξανά.',
      'compare.locationZone': 'Ζώνη ώρας {zone}, {diff}',

      // --- Today at a glance (markup) ---------------------------------------
      'glance.heading': 'Σήμερα με μια ματιά',
      'glance.feelsLike': 'Αίσθηση ως',
      'glance.verdictLabel': 'Η γνώμη για σήμερα:',
      'glance.whatToWear': 'Τι να φορέσετε:',

      // --- Hero -------------------------------------------------------------
      'hero.feelsLike': 'Αίσθηση ως',
      'hero.shareAria': 'Κοινή χρήση καιρού',
      'hero.refreshAria': 'Ανανέωση δεδομένων καιρού',

      // --- Current conditions metrics ---------------------------------------
      'metrics.aria': 'Βασικές μετεωρολογικές παράμετροι',
      'metrics.heading': 'Τρέχουσες Συνθήκες',
      'metrics.humidity': 'Υγρασία',
      'metrics.wind': 'Άνεμος',
      'metrics.uvIndex': 'Δείκτης UV',
      'metrics.pressure': 'Ατμοσφαιρική πίεση',
      'metrics.precipitation': 'Υετός',
      'metrics.localTime': 'Τοπική ώρα',
      'metrics.sunriseSunset': 'Ανατολή και Δύση ηλίου',
      'metrics.sunrise': 'Ανατολή',
      'metrics.sunset': 'Δύση',
      'metrics.cloudCover': 'Νεφοκάλυψη: {value}%',
      'metrics.humidityDry': 'Ξηρό περιβάλλον',
      'metrics.humidityComfortable': 'Άνετη υγρασία',
      'metrics.humidityHigh': 'Υψηλή υγρασία',
      'metrics.pressureNormal': 'Κανονική πίεση',
      'metrics.pressureHigh': 'Αντικυκλωνικό σύστημα',
      'metrics.pressureLow': 'Θυελλώδες σύστημα',
      'metrics.uvLow': 'Χαμηλός',
      'metrics.uvModerate': 'Μέτριος',
      'metrics.uvHigh': 'Υψηλός',
      'metrics.uvVeryHigh': 'Πολύ υψηλός',
      'metrics.uvExtreme': 'Ακραίος',
      'metrics.uvAdviceLow': 'Χαμηλός κίνδυνος βλάβης από τον ήλιο',
      'metrics.uvAdviceModerate': 'Συνιστάται προστασία από τον ήλιο',
      'metrics.uvAdviceHigh': 'Φορέστε καπέλο και αλειφαλίδα',
      'metrics.uvAdviceVeryHigh': 'Αποφύγετε τον ήλιο το μεσημέρι',
      'metrics.uvAdviceExtreme': 'Λάβετε πλήρη προστασία από τον ήλιο',

      // --- Forecast cards ---------------------------------------------------
      'forecast.hourlyHeading': 'Πρόγνωση 24 ωρών',
      'forecast.hourlySubtitle': 'Τοπική ωριαία πρόγνωση ·',
      'forecast.dailyHeading': 'Πρόγνωση 7 ημερών',
      'forecast.dailySubtitle': 'Πρόγνωση για τις επόμενες μέρες ·',
      'forecast.cityTime': 'ώρα πόλης',
      'forecast.hourlyAria': 'Ωριαία πρόγνωση καιρού',
      'forecast.now': 'Τώρα',
      'forecast.today': 'Σήμερα',
      'forecast.maxUvTitle': 'Μέγιστος δείκτης UV',
      'forecast.precipChanceTitle': 'Πιθανότητα βροχής',

      // --- Popular cities + footer ------------------------------------------
      'popular.label': 'Δημοφιλείς:',
      'footer.providedBy': 'Δεδομένα από {link}',
      'footer.tagline': 'Παγκόσμια μετεωρολογικά δεδομένα σε πραγματικό χρόνο',
      'footer.timezoneNote': 'Οι τοπικές ώρες χρησιμοποιούν τη ζώνη ώρας IANA κάθε πόλης και ενημερώνονται σε πραγματικό χρόνο · Η ώρα αναφοράς σας ανιχνεύεται από τη ζώνη ώρας της συσκευής σας ({zone})',

      // --- Clocks / time difference -----------------------------------------
      'time.sameAsYou': 'Η ίδια ώρα με εσάς',
      'time.sameAsYouShort': 'Η ίδια ώρα',
      'time.aheadOf': '{value} μπροστά σας',
      'time.behind': '{value} πίσω σας',
      'time.detectedZone': 'Ζώνη ώρας που ανιχνεύτηκε: {zone}',
      'time.localTimeAria': 'Η τοπική σας ώρα, ανιχνεύτηκε από τη ζώνη ώρας {zone}',
      'time.youClock': 'Εσείς {time}',
      'time.yourZoneTitle': 'Η ζώνη ώρας σας: {zone}',
      'time.allTimesIn': 'Όλες οι ώρες στη ζώνη {zone}',

      // --- Visitor IP location ------------------------------------------------
      'nav.detectedLocation': 'Εντοπισμένη θέση',
      'nav.yourIP': 'Το IP σας',
      'nav.countryCity': '{country}, {city}',
      'time.offsetVsYou': 'Διαφορά από εσάς ({zone}): {value}',
      'time.freshnessNow': 'Ενημερώθηκε μόλις τώρα',
      'time.freshnessMinutes': 'Ενημερώθηκε πριν {count} λεπτά',
      'time.freshnessHours': 'Ενημερώθηκε πριν {count} ώρα',
      'time.freshnessHoursPlural': 'Ενημερώθηκε πριν {count} ώρες',
      'time.freshnessDays': 'Ενημερώθηκε πριν {count} μέρα',
      'time.freshnessDaysPlural': 'Ενημερώθηκε πριν {count} μέρες',

      // --- Sharing ----------------------------------------------------------
      'share.forecast': 'Κοινόχρηστη πρόγνωση',
      'share.showAllCards': 'Εμφάνιση όλων των καρτών',
      'share.button': 'Κοινή χρήση καιρού',
      'share.weatherIn': 'Καιρός στο {place}',
      'share.rain': '{value}% βροχή',
      'share.high': 'Υψηλή {value}',
      'share.low': 'Χαμηλή {value}',
      'share.copied': 'Ο σύνδεσμος αντιγράφηκε. Το άνοιγμά του εμφανίζει {place} με τις κοινόχρηστες κάρτες.',
      'share.copyFailedInBar': 'Δεν ήταν δυνατή η αυτόματη αντιγραφή. Ο σύνδεσμος για {place} βρίσκεται πλέον στη γραμμή διεύθυνσης.',
      'share.copyFailed': 'Δεν ήταν δυνατή η αυτόματη αντιγραφή. Αντιγράψτε τον σύνδεσμο από τη γραμμή διεύθυνσης για να μοιραστείτε την πρόγνωση.',

      // --- Weather condition labels (WMO) ------------------------------------
      'wmo.0': 'Αίριος ουρανός',
      'wmo.1': 'Κυρίως αίριος',
      'wmo.2': 'Μερική συννέφελα',
      'wmo.3': 'Συννεφιά',
      'wmo.45': 'Ομίχλα',
      'wmo.48': 'Παγωμένη ομίχλα',
      'wmo.51': 'Ελαφρά ψιλοβρέχια',
      'wmo.53': 'Μέτρια ψιλοβρέχια',
      'wmo.55': 'Έντονα ψιλοβρέχια',
      'wmo.56': 'Παγωμένα ψιλοβρέχια',
      'wmo.57': 'Έντονα παγωμένα ψιλοβρέχια',
      'wmo.61': 'Ελαφρή βροχή',
      'wmo.63': 'Μέτρια βροχή',
      'wmo.65': 'Έντονη βροχή',
      'wmo.66': 'Παγωμένη βροχή',
      'wmo.67': 'Έντονη παγωμένη βροχή',
      'wmo.71': 'Ελαφρό χιόνι',
      'wmo.73': 'Μέτριο χιόνι',
      'wmo.75': 'Έντονη χιονόπτωση',
      'wmo.77': 'Χιονόνεφρα',
      'wmo.80': 'Ελαφρές βροχοπτώσεις',
      'wmo.81': 'Μέτριες βροχοπτώσεις',
      'wmo.82': 'Ισχυρές βροχοπτώσεις',
      'wmo.85': 'Χιονοβροχοπτώσεις',
      'wmo.86': 'Έντονες χιονοβροχοπτώσεις',
      'wmo.95': 'Καταιγίδα',
      'wmo.96': 'Καταιγίδα με χαλάζι',
      'wmo.99': 'Έντονη καταιγίδα με χαλάζι',
      'wmo.unknown': 'Αίθριος',

      // --- Glance engine (glance.js) ----------------------------------------
      'glanceEngine.storm': 'Αναμένονται καταιγίδες',
      'glanceEngine.snow': 'Χιόνι σήμερα',
      'glanceEngine.freezing': 'Παγωμένο κρύο',
      'glanceEngine.hot': 'Πολύ ζεστό',
      'glanceEngine.umbrella': 'Συνιστάται ομπρέλα',
      'glanceEngine.gale': 'Πολύ άνεμος',
      'glanceEngine.good': 'Καλός καιρός',
      'glanceEngine.around': ' γύρω στις {time}',
      'glanceEngine.at': ' στις {time}',
      'glanceEngine.detailStorm': 'Προβλέπονται καταιγίδες{when} - τα σχέδια έξω μπορεί να διακοπούν.',
      'glanceEngine.detailSnow': 'Προβλέπεται χιόνι{when} - αφήστε επιπλέον χρόνο για τις μετακινήσεις.',
      'glanceEngine.detailFreezing': 'Αίσθηση ως {temp}{when} - χρειάζονται πολλά ζεστά ρούχα.',
      'glanceEngine.detailHot': 'Αίσθηση ως {temp}{when} - αναζητήστε σκιά και νερό.',
      'glanceEngine.detailRainNow': 'Βρέχει τώρα ({amount} την τελευταία ώρα).',
      'glanceEngine.detailRainNowShort': 'Βρέχει τώρα.',
      'glanceEngine.detailRainPeak': 'Η βροχή φτάνει {value}{when}.',
      'glanceEngine.detailLightPrecip': 'Αναμένονται ελαφρές βροχοπτώσεις σήμερα.',
      'glanceEngine.detailWinds': 'Οι άνεμοι φτάνουν {value} σήμερα - μια ξέφρενη μέρα έξω.',
      'glanceEngine.detailVeryWindy': 'Πολύ άνεμος καιρός σήμερα.',
      'glanceEngine.detailMostlyDry': 'Σχεδόν ανέπαφο καιρό',
      'glanceEngine.detailDry': 'Ανέπαφος καιρός',
      'glanceEngine.detailComfortable': 'και άνετος καιρός γύρω στους {value}',
      'glanceEngine.detailWithWind': 'με {value}',
      'glanceEngine.windLight': 'ελαφρύ άνεμο',
      'glanceEngine.windBreeze': 'ελαφρύ αεράκι',
      'glanceEngine.windStrong': 'ισχυρό άνεμο',
      'glanceEngine.windVeryStrong': 'πολύ ισχυρό άνεμο',
      'glanceEngine.metricRain': 'Βροχή',
      'glanceEngine.metricWind': 'Άνεμος',
      'glanceEngine.metricHumidity': 'Υγρασία',
      'glanceEngine.hintPeakToday': 'μέγιστη πιθανότητα σήμερα',
      'glanceEngine.hintNotReported': 'δεν αναφέρεται',
      'glanceEngine.hintRelativeHumidity': 'σχετική υγρασία',

      // --- Compare engine (compare.js) ---------------------------------------
      'compareEngine.metricCondition': 'Καιρός',
      'compareEngine.metricTemperature': 'Θερμοκρασία',
      'compareEngine.metricApparent': 'Αίσθηση ως',
      'compareEngine.metricRainChance': 'Πιθανότητα βροχής',
      'compareEngine.metricWind': 'Άνεμος',
      'compareEngine.metricPressure': 'Πίεση',
      'compareEngine.metricCloudCover': 'Νεφοκάλυψη',
      'compareEngine.metricSun': 'Ανατολή / Δύση',
      'compareEngine.metricPrecipitation': 'Υετός',
      'compareEngine.metricUv': 'Δείκτης UV',
      'compareEngine.metricMaxUv': 'Μέγιστος UV',
      'compareEngine.metricMaxWind': 'Μέγιστος άνεμος',
      'compareEngine.warmer': 'ζεστότερος',
      'compareEngine.cooler': 'δροσιέρος',
      'compareEngine.insightTemperature': 'Στην {city} είναι {gap} {word} από ό,τι στην {other}.',
      'compareEngine.insightApparent': 'Στην {city} γίνεται {gap} {word} από ό,τι στην {other}.',
      'compareEngine.insightRain': 'Στην {city} η πιθανότητα βροχής είναι μικρότερη ({low} έναντι {high}).',
      'compareEngine.insightWind': 'Ο άνεμος στην {city} είναι {gap} ισχυρότερος από ό,τι στην {other}.',
      'compareEngine.insightPressure': 'Η ατμοσφαιρική πίεση στην {city} είναι {gap} υψηλότερη από ό,τι στην {other}.',
      'compareEngine.insightCloud': 'Στην {city} έχει {gap} περισσότερη συννέφελα από ό,τι στην {other}.',
      'compareEngine.insightSun': 'Ο ήλιος ανατέλλει {gap} νωρίτερα στην {city} από ό,τι στην {other}.',
      'compareEngine.insightPrecip': 'Στην {city} έχει {gap} περισσότερο υετό από ό,τι στην {other}.',
      'compareEngine.insightUv': 'Ο δείκτης UV στην {city} είναι {gap} υψηλότερος από ό,τι στην {other}.',
      'compareEngine.insightMaxUv': "Η μέγιστη τιμή UV σήμερα στην {city} είναι {gap} υψηλότερη από ό,τι στην {other}.",
      'compareEngine.insightMaxWind': "Η μέγιστη ένταση ανέμου σήμερα στην {city} είναι {gap} ισχυρότερη από ό,τι στην {other}.",
      'compareEngine.gapWarmer': ' ζεστότερη',
      'compareEngine.gapCooler': ' δροσιέρα',
      'compareEngine.gapStronger': ' ισχυρότερος',
      'compareEngine.gapHigher': ' υψηλότερη',
      'compareEngine.gapCloudier': ' περισσότερη συννέφελα',
      'compareEngine.gapEarlier': ' νωρίτερα',
      'compareEngine.gapMore': ' περισσότερος',
      'compareEngine.gapFaster': ' ισχυρότερος',

      // --- Assistant engine (advice.js) --------------------------------------
      'adviceEngine.windowMorning': 'Πρωί',
      'adviceEngine.windowMidday': 'Μεσημέρι',
      'adviceEngine.windowAfternoon': 'Απόγευμα',
      'adviceEngine.windowEvening': 'Βράδυ',
      'adviceEngine.phraseMorning': 'το πρωί σας',
      'adviceEngine.phraseMidday': 'τις μεσημεριανές ώρες',
      'adviceEngine.phraseAfternoon': 'το απόγευμά σας',
      'adviceEngine.phraseEvening': 'το βράδυ',
      'adviceEngine.tileUmbrella': 'Ομπρέλα',
      'adviceEngine.tileWalk': 'Περπάτημα',
      'adviceEngine.tileCarWash': 'Πλύσιμο αυτοκινήτου',
      'adviceEngine.tileCycling': 'Ποδηλασία',
      'adviceEngine.tileSwimming': 'Κολύμβηση',
      'adviceEngine.tileClothing': 'Τι να φορέσετε',
      'adviceEngine.summaryLabel': 'Συμβουλή για σήμερα',
      'adviceEngine.scopeToday': 'την υπόλοιπη σήμερα',
      'adviceEngine.scopeNext24': 'τις επόμενες 24 ώρες',
      'adviceEngine.notEnoughTitle': 'Ανεπαρκή δεδομένα πρόγνωσης',
      'adviceEngine.notEnoughDetail': 'Αυτή η σύσταση χρειάζεται ωριαία δεδομένα πρόγνωσης που δεν είναι διαθέσιμα αυτή τη στιγμή.',
      'adviceEngine.noHourly': 'Δεν υπάρχουν διαθέσιμα χρήσιμα ωριαία δεδομένα πρόγνωσης.',
      'adviceEngine.noPrecip': 'Αυτή η πόλη δεν έχει πιθανότητα ή ποσότητα βροχής στην πρόγνωση.',
      'adviceEngine.noTemperatures': 'Δεν υπάρχουν διαθέσιμες χρήσιμες ωριαίες θερμοκρασίες.',
      'adviceEngine.noStretch': 'Δεν υπάρχουν αρκετές ωριαίες θερμοκρασίες για να συγκριθεί ένα τμήμα της ημέρας.',
      'adviceEngine.noDaylight': 'Δεν υπάρχει διαθέσιμη ωριαία θερμοκρασία αέρα για τις φωτεινές ώρες.',
      'adviceEngine.noPeriodTemp': 'Δεν υπάρχει διαθέσιμη ωριαία θερμοκρασία για αυτή την περίοδο.',
      'adviceEngine.notCalculated': 'Αυτή η σύσταση δεν μπόρεσε να υπολογιστεί από την τρέχουσα πρόγνωση.',
      'adviceEngine.summaryNotCalculated': 'Αυτή η περίληψη δεν μπόρεσε να υπολογιστεί από την τρέχουσα πρόγνωση.',
      'adviceEngine.umbrellaDefinitely': 'Πάρτε οπωσδήποτε ομπρέλα',
      'adviceEngine.umbrellaLikely': 'Πάρτε ομπρέλα',
      'adviceEngine.umbrellaUnlikely': 'Μάλλον όχι',
      'adviceEngine.walkNone': 'Δεν υπάρχει ιδανική περίοδος σήμερα',
      'adviceEngine.walkLimited': 'Περιορισμένες λεπτομέρειες για αυτή την περίοδο',
      'adviceEngine.walkReasonWind': 'άνεμος',
      'adviceEngine.walkBest': 'Η πιο στεγνή περίοδος είναι {window}. {reasons}',
      'adviceEngine.walkBestPlain': 'Η πιο στεγνή περίοδος είναι {window}.',
      'adviceEngine.walkBut': '{detail}, αλλά {reasons}.',
      'adviceEngine.carWashGood': 'Καλή μέρα για πλύσιμο αυτοκινήτου',
      'adviceEngine.carWashBad': 'Δεν είναι ιδανικό σήμερα',
      'adviceEngine.carWashRainLater': 'Αναμένεται βροχή{when}{amount}.',
      'adviceEngine.carWashUnsettled': ' Αναμένονται βροχερές ή ασταθείς συνθήκες καθόλη τη διάρκεια.',
      'adviceEngine.carWashDrySpells': 'Τα στεγνά διαστήματα είναι πολύ σύντομα για να αξίζουν.{hint}',
      'adviceEngine.cyclingBad': 'Δεν είναι ιδανικό για ποδηλασία',
      'adviceEngine.cyclingWind': 'Αναμένονται ισχυροί άνεμοι περίπου {wind}{when}.',
      'adviceEngine.cyclingRain': '{amount}',
      'adviceEngine.cyclingCold': 'Πολύ κρύο για ποδηλασία - γύρω στους {temp}.',
      'adviceEngine.cyclingHot': 'Πολύ ζεστό για ποδηλασία - έως {temp}.',
      'adviceEngine.cyclingGood': 'Κατάλληλο για ποδηλασία',
      'adviceEngine.cyclingGoodDetail': '{temps}στεγνό και σχετικά ήπιοι άνεμοι.',
      'adviceEngine.swimBad': 'Δεν είναι ιδανικό σήμερα',
      'adviceEngine.swimRain': '{amount} Καλύτερα να μην μπείτε στο νερό.',
      'adviceEngine.swimCold': 'Δροσιέρα για κολύμβηση σε εξωτερικό χώρο - αέρας γύρω στους {temp} στην καλύτερη περίπτωση.',
      'adviceEngine.swimHot': 'Πολύ ζεστός αέρας, έως {temp}. Μείνετε στη σκιά ανάμεσα στις βουτιές.',
      'adviceEngine.swimGood': 'Καλός καιρός για κολύμβηση σε εξωτερικό χώρο',
      'adviceEngine.swimOvercast': 'κυρίως συννεφιά',
      'adviceEngine.clothingLight': 'Ελαφρύς ρουχισμός',
      'adviceEngine.clothingWarm': 'Ζεστό - γύρω στους {temp} στη ζεστότερη στιγμή της ημέρας.',
      'adviceEngine.clothingJacketUmbrella': 'Ελαφρύ τζακέτι + ομπρέλα',
      'adviceEngine.clothingJacketUmbrellaDetail': 'Κρύο και βροχή - γύρω στους {temp} με πιθανή βροχή.',
      'adviceEngine.clothingTShirtUmbrella': 'Εποχή μπλουζάκι + ομπρέλα',
      'adviceEngine.clothingTShirt': 'Εποχή μπλουζάκι',
      'adviceEngine.clothingTShirtDetail': 'Ζεστό και στεγνό{wind}.',
      'adviceEngine.clothingTShirtWind': ' με ελαφρούς ανέμους',
      'adviceEngine.clothingLightJacket': 'Συνιστάται ελαφρύ τζακέτι',
      'adviceEngine.clothingLightJacketDetail': 'Ήπιο - γύρω στους {temp}.',
      'adviceEngine.clothingWarmJacket': 'Συνιστάται ζεστό τζακέτι',
      'adviceEngine.clothingWarmJacketDetail': 'Δροσιερό - γύρω στους {temp}.',
      'adviceEngine.clothingCoat': 'Συνιστάται χειμερινό παλτού',
      'adviceEngine.clothingCoatDetail': 'Κρύο, γύρω στους {temp}.',
      'adviceEngine.clothingLayers': 'Χρειάζεστε πολύ ζεστά ρούχα',
      'adviceEngine.clothingLayersDetail': 'Υπό το μηδέν, γύρω στους {temp}.',
      'adviceEngine.uvNote': ' Συνιστάται προστασία από τον ήλιο.',
      'adviceEngine.swingNote': ' Αναμένετε διακύμανση {swing}°C σήμερα.',
      'adviceEngine.windNote': ' Φυσάει.',
      'adviceEngine.darkNote': ' Το μεγαλύτερο μέρος του υπόλοιπου προγνωστικού παραθύρου είναι μετά το σούρουπο.',
      'adviceEngine.breezeNote': ' Αναμένεται ελαφρύ αεράκι.',
      'adviceEngine.tempsNote': 'Θερμοκρασίες γύρω στους {temp}. ',
      'adviceEngine.rainWindowPeriod': 'Προβλέπεται βροχή σε αυτή την περίοδο.',
      'adviceEngine.rainWindowLight': 'Είναι πιθανές ελαφρές βροχοπτώσεις σε αυτή την περίοδο.',
      'adviceEngine.summarySnow': 'Χιόνι σήμερα',
      'adviceEngine.summarySnowDetail': 'Προβλέπεται χιόνι σήμερα. Αφήστε επιπλέον χρόνο για τις μετακινήσεις.',
      'adviceEngine.summaryStorm': 'Αναμένονται καταιγίδες',
      'adviceEngine.summaryStormDetail': 'Προβλέπονται καταιγίδες σήμερα - τα σχέδια έξω μπορεί να διακοπούν.',
      'adviceEngine.summaryUmbrella': 'Πάρτε ομπρέλα σήμερα',
      'adviceEngine.summaryCold': 'Κρύο σήμερα',
      'adviceEngine.summaryHot': 'Ζεστό σήμερα',
      'adviceEngine.summaryGreat': 'Τέλεια μέρα για έξω',
      'adviceEngine.summaryMixed': 'Μικτές συνθήκες σήμερα',
      'adviceEngine.summaryMixedDetail': 'Πιθανόν να υπάρξουν ασταθείς περίοδοι{when} κατά {scope}.',
      'adviceEngine.summaryCloudyDry': 'Συννεφιά αλλά στεγνό σήμερα',
      'adviceEngine.summaryCloudyDryDetail': 'Δεν προβλέπεται βροχή· γύρω στους {temp} με {wind}.',
      'adviceEngine.summaryVariableWinds': 'μεταβλητούς ανέμους',
      'assistant.scopeNext24': 'Με βάση τις επόμενες 24 ώρες',
      'assistant.scopeToday': 'Με βάση την υπόλοιπη σήμερα',
      'assistant.heading': "Συμβουλή για σήμερα",
      'assistant.preparing': 'Ετοιμάζουμε την πρόγνωσή σας…',
      'assistant.windowTitle': 'Βροχή κατά τη διάρκεια…;',
      'assistant.windowTitlePlain': 'Βροχή κατά τη διάρκεια...',
    },

    de: {
      // --- Document ---------------------------------------------------------
      'app.name': 'WeatherScope',
      'app.title': 'WeatherScope - Klima- & Stadtvorhersagen',
      'app.description': 'Suchen Sie Echtzeit-Wetter nach Stadtnamen oder entdecken Sie weltweit Städte, die Ihren bevorzugten Klimabedingungen entsprechen.',
      'app.noscript': 'WeatherScope benötigt aktiviertes JavaScript, um Live-Wetterdaten abzurufen und anzuzeigen.',
      'app.noscriptHint': 'Bitte aktivieren Sie JavaScript in Ihrem Browser und laden Sie die Seite neu.',

      // --- Header -----------------------------------------------------------
      'nav.modeAria': 'Auswahl des Suchmodus',
      'nav.citySearch': 'Stadtsuche',
      'nav.compare': 'Vergleichen',
      'nav.climateFilter': 'Klimafilter',
      'nav.unitAria': 'Auswahl der Temperatureinheit',
      'nav.languageAria': 'Sprachauswahl',
      'nav.yourTime': 'Ihre Zeit',
      'nav.searchModeCity': 'Stadtsuche',
      'nav.searchModeCompare': 'Vergleichen',
      'nav.searchModeClimate': 'Klimafilter',

      // --- Search box -------------------------------------------------------
      'search.placeholderCity': 'Stadt suchen (z.B. Paris, Tokio, New York)...',
      'search.placeholderCompare': 'Standort zum Vergleichen hinzufügen (z.B. Athen, Oslo, Kairo)...',
      'search.placeholderClimate': 'Klima suchen: z.B. Sonnig, Warm, Regen, Schnee, > 25°C, Kalt < 10°C...',
      'search.submit': 'Suchen',
      'search.inputAria': 'Nach einer Stadt oder Klimabedingung suchen',
      'search.clearAria': 'Eingabe löschen',
      'search.suggestionsAria': 'Suchvorschläge',
      'search.useLocation': 'Aktuellen Standort verwenden',
      'search.searchingFor': 'Suche nach "{city}"...',
      'search.matchingLocations': '{count} passende Standorte - bitte auswählen',

      // --- Climate preset chips ---------------------------------------------
      'climate.presetClimates': 'Voreingestellte Klimas:',
      'climate.sunny': 'Sonnig',
      'climate.cloudy': 'Bewölkt',
      'climate.rainy': 'Regnerisch',
      'climate.snowy': 'Verschneit',
      'climate.storm': 'Sturm',
      'climate.freezing': 'Eiskalt',
      'climate.cold': 'Kalt',
      'climate.cool': 'Kühl',
      'climate.mild': 'Mild',
      'climate.warm': 'Warm',
      'climate.hot': 'Heiß',
      'climate.humid': 'Feucht',
      'climate.dry': 'Trocken',
      'climate.windy': 'Windig',
      'climate.gale': 'Orkan',
      'climate.beachDay': 'Strandtag',
      'climate.skiTrip': 'Skiausflug',
      'climate.tropical': 'Tropisch',
      'climate.mildBreezy': 'Mild und Windig',
      'climate.rainyMild': 'Regnerisch und Mild',

      // --- Climate results --------------------------------------------------
      'climate.resultsTitle': 'Städte mit passenden Klimabedingungen',
      'climate.resultsAria': 'Passende Städte',
      'climate.foundOne': '{count} Stadt gefunden',
      'climate.foundMany': '{count} Städte gefunden',
      'climate.resultsSubtitle': '{count} Referenzstädte weltweit durchsucht. Klicken Sie auf eine Stadt, um das Detailwetter in Echtzeit und die 7-Tage-Vorhersage zu sehen.',
      'climate.clickToExplore': 'Klicken Sie auf eine Stadtkarte, um das Detailwetter in Echtzeit und die 7-Tage-Vorhersage zu erkunden.',
      'climate.sortLabel': 'Sortieren:',
      'climate.sortNameAsc': 'Stadtname (A-Z)',
      'climate.sortNameDesc': 'Stadtname (Z-A)',
      'climate.sortTemperature': 'Temperatur',
      'climate.sortHumidity': 'Luftfeuchtigkeit',
      'climate.sortWind': 'Windgeschwindigkeit',
      'climate.sortHighToLow': '{label} (höher nach niedriger)',
      'climate.sortLowToHigh': '{label} (niedriger nach höher)',
      'climate.emptyTitle': 'Keine der {count} Referenzstädte entspricht derzeit genau diesen Klimabedingungen.',
      'camera.toggleOn': 'Live-Kameras an',
      'camera.toggleOff': 'Live-Kameras aus',
      'camera.none': 'Für diese Stadt gibt es keine kostenlose öffentliche Kamera',
      'camera.live': 'Live',
      'camera.pause': 'Pause',
      'camera.play': 'Abspielen',
      'camera.alt': 'Live-Kamerabild: {place}',
      'camera.altGeneric': 'Live-Kamerabild',
      'camera.distanceOne': '{distance} km entfernt',
      'camera.distanceMany': '{distance} km entfernt',
      'camera.attribution': 'Kamera: {source}',
      'camera.offline': 'Kamera nicht verfügbar',
      'camera.still': 'Live-Standbild',
      'camera.next': 'Nächste Kamera ({index}/{total})',
      'camera.off': 'Live-Kameras sind ausgeschaltet',
      'camera.throttled': 'Kamerasuche derzeit nicht verfügbar',
      'camera.compareAria': 'Live-Kameras für die verglichenen Orte',
      'climate.emptyHint': 'Versuchen Sie eine breitere Bedingung wie "Sonnig", "Warm" oder "Bewölkt".',
      'climate.viewDetails': 'Wetterdetails ansehen',
      'climate.cardHumidityTitle': 'Relative Luftfeuchtigkeit',
      'climate.cardWindTitle': 'Windgeschwindigkeit',
      'climate.backToMatching': 'Zurück zu passenden Städten ({count})',
      'climate.searchWorldwide': 'Weltweit nach Städten suchen, die zu "{query}" passen →',
      'climate.discovery': 'Klima-Entdeckung',
      'climate.searching': 'Suche nach Städten weltweit mit passendem Klima...',
      'climate.errorTitle': 'Fehler bei der Klimasuche',
      'climate.errorBody': 'Globale Wetterdaten konnten nicht abgerufen werden. Bitte erneut versuchen.',

      // --- Loading / error states -------------------------------------------
      'state.fetching': 'Live-Wetterdaten werden abgerufen...',
      'state.fetchingCity': 'Live-Wetter für {city} wird abgerufen...',
      'state.errorTitle': 'Keine passenden Ergebnisse',
      'state.errorBody': 'Wir konnten keine Ergebnisse für Ihre Anfrage abrufen. Bitte passen Sie Ihre Kriterien an und versuchen Sie es erneut.',
      'state.retry': 'Erneut suchen',
      'state.backToResults': 'Zurück zu Klimat-Ergebnissen',
      'state.weatherUnavailableTitle': 'Wetterdaten nicht verfügbar',
      'state.weatherUnavailableBody': 'Das Wetter für "{city}" konnte nicht abgerufen werden. Die Anfrage hat möglicherweise das Zeitlimit überschritten - bitte prüfen Sie Ihre Internetverbindung.',
      'state.cityNotFoundTitle': 'Stadt nicht gefunden',
      'state.cityNotFoundBody': 'Keine Ergebnisse für "{city}". Versuchen Sie eine andere Schreibweise oder geben Sie ein Land an.',
      'state.searchFailedTitle': 'Suche fehlgeschlagen',
      'state.searchTimedOut': 'Die Suchanfrage hat das Zeitlimit überschritten. Bitte prüfen Sie Ihre Internetverbindung.',
      'state.searchFailed': 'Bei der Suche nach der Stadt ist ein Fehler aufgetreten. Bitte erneut versuchen.',

      // --- Geolocation ------------------------------------------------------
      'geo.button': 'Aktuellen Standort verwenden',
      'geo.detecting': 'Ihr geografischer Standort wird ermittelt...',
      'geo.unsupportedTitle': 'Standort nicht unterstützt',
      'geo.unsupported': 'Ihr Browser unterstützt keine automatische Standortbestimmung.',
      'geo.deniedTitle': 'Zugriff auf den Standort verweigert',
      'geo.denied': 'Ihr Standort konnte nicht ermittelt werden. Bitte prüfen Sie die Browser-Berechtigungen oder suchen Sie Ihre Stadt direkt.',
      'geo.myLocation': 'Mein Standort',

      // --- Compare Locations ------------------------------------------------
      'compare.heading': 'Standorte vergleichen',
      'compare.count': '{selected} von {max} ausgewählt',
      'compare.subtitle': 'Suchen Sie oben oder tippen Sie auf eine beliebige Stadt, um eine Liste zu erstellen, dann vergleichen Sie 2 bis 4 Standorte.',
      'compare.addLocation': 'Standort hinzufügen',
      'compare.run': 'Vergleichen',
      'compare.clearAll': 'Alle löschen',
      'compare.loading': 'Wetter wird verglichen...',
      'compare.glanceHeading': 'Wetter auf einen Blick',
      'compare.legendHigh': 'Höchster Wert in der Zeile',
      'compare.legendLow': 'Niedrigster Wert in der Zeile',
      'compare.currentHeading': 'Aktuelle Bedingungen',
      'compare.forecastHeading': 'Heutige Vorhersage im Vergleich',
      'compare.forecastSubtitle': 'Höchst-, Tiefstwerte, Regenwahrscheinlichkeit & Spitzenwerte',
      'compare.metricHead': 'Messwert',
      'compare.locationSlot': 'Standort {slot}',
      'compare.locationSlotEmpty': 'Standort {slot} - nutzen Sie die Suche oder eine beliebige Stadt',
      'compare.add': 'Hinzufügen',
      'compare.moveEarlier': 'Nach vorne verschieben',
      'compare.moveLater': 'Nach hinten verschieben',
      'compare.removeCity': '{city} aus dem Vergleich entfernen',
      'compare.clearSlot': 'Diesen Standort leeren',
      'compare.unknownLocation': 'Unbekannter Standort',
      'compare.selectedLocation': 'Ausgewählter Standort',
      'compare.changeLocation': '{city}, {meta}. Diesen Standort ändern.',
      'compare.locationFallback': 'Standort',
      'compare.weatherUnavailable': 'Wetter nicht verfügbar',
      'compare.tryAgain': 'Erneut versuchen',
      'compare.retryAria': 'Wetter für {city} erneut laden',
      'compare.thisLocation': 'diesen Standort',
      'compare.highest': 'höchster',
      'compare.lowest': 'niedrigster',
      'compare.ariaExtreme': '{value}, {word} der verglichenen Standorte',
      'compare.ariaExtremeTitle': '{word} für {row}',
      'compare.freshness': 'Neueste Messung: {label}',
      'compare.needTwoLocations': 'Für einen Vergleich werden mindestens zwei Standorte mit Live-Daten benötigt.',
      'compare.verySimilar': 'Diese Standorte sind derzeit sehr ähnlich - es sticht kein Unterschied hervor.',
      'compare.duplicate': '{city} ist bereits in Ihrem Vergleich.',
      'compare.listFull': 'Sie können bis zu {max} Standorte vergleichen. Entfernen Sie einen, um einen weiteren hinzuzufügen.',
      'compare.couldNotAdd': 'Dieser Standort konnte nicht zum Vergleich hinzugefügt werden.',
      'compare.replacing': 'Neuen Standort für Standort {slot} auswählen (aktuell {city}). Zum Abbrechen Escape drücken.',
      'compare.noResults': 'Keine Ergebnisse für "{query}". Versuchen Sie eine andere Schreibweise oder geben Sie ein Land an.',
      'compare.searchTimedOut': 'Die Standortsuche hat das Zeitlimit überschritten. Prüfen Sie Ihre Verbindung.',
      'compare.searchFailed': 'Die Standortsuche ist fehlgeschlagen. Bitte erneut versuchen.',
      'compare.locationZone': 'Zeitzone {zone}, {diff}',

      // --- Today at a glance (markup) ---------------------------------------
      'glance.heading': 'Heute auf einen Blick',
      'glance.feelsLike': 'Gefühlte Temperatur',
      'glance.verdictLabel': 'Heutiges Urteil:',
      'glance.whatToWear': 'Was anziehen:',

      // --- Hero -------------------------------------------------------------
      'hero.feelsLike': 'Gefühlte Temperatur',
      'hero.shareAria': 'Wetter teilen',
      'hero.refreshAria': 'Wetterdaten aktualisieren',

      // --- Current conditions metrics ---------------------------------------
      'metrics.aria': 'Wichtige Wetterwerte',
      'metrics.heading': 'Aktuelle Bedingungen',
      'metrics.humidity': 'Luftfeuchtigkeit',
      'metrics.wind': 'Wind',
      'metrics.uvIndex': 'UV-Index',
      'metrics.pressure': 'Luftdruck',
      'metrics.precipitation': 'Niederschlag',
      'metrics.localTime': 'Ortszeit',
      'metrics.sunriseSunset': 'Sonnenaufgang & -untergang',
      'metrics.sunrise': 'Sonnenaufgang',
      'metrics.sunset': 'Sonnenuntergang',
      'metrics.cloudCover': 'Bewölkung: {value}%',
      'metrics.humidityDry': 'Trockene Umgebung',
      'metrics.humidityComfortable': 'Angenehme Luftfeuchtigkeit',
      'metrics.humidityHigh': 'Hohe Luftfeuchtigkeit',
      'metrics.pressureNormal': 'Normaler Luftdruck',
      'metrics.pressureHigh': 'Hochdruckgebiet',
      'metrics.pressureLow': 'Tiefdruckgebiet',
      'metrics.uvLow': 'Niedrig',
      'metrics.uvModerate': 'Mäßig',
      'metrics.uvHigh': 'Hoch',
      'metrics.uvVeryHigh': 'Sehr hoch',
      'metrics.uvExtreme': 'Extrem',
      'metrics.uvAdviceLow': 'Geringes Risiko für Sonnenschäden',
      'metrics.uvAdviceModerate': 'Sonnenschutz empfohlen',
      'metrics.uvAdviceHigh': 'Hut und Sonnenschutz tragen',
      'metrics.uvAdviceVeryHigh': 'Mittagssonne meiden',
      'metrics.uvAdviceExtreme': 'Vollständigen Sonnenschutz verwenden',

      // --- Forecast cards ---------------------------------------------------
      'forecast.hourlyHeading': '24-Stunden-Vorhersage',
      'forecast.hourlySubtitle': 'Lokale stündliche Vorhersage ·',
      'forecast.dailyHeading': '7-Tage-Vorhersage',
      'forecast.dailySubtitle': 'Vorhersage für die nächsten Tage ·',
      'forecast.cityTime': 'Ortszeit',
      'forecast.hourlyAria': 'Stündliche Wettervorhersage',
      'forecast.now': 'Jetzt',
      'forecast.today': 'Heute',
      'forecast.maxUvTitle': 'Maximaler UV-Index',
      'forecast.precipChanceTitle': 'Niederschlagswahrscheinlichkeit',

      // --- Popular cities + footer ------------------------------------------
      'popular.label': 'Beliebt:',
      'footer.providedBy': 'Daten bereitgestellt von {link}',
      'footer.tagline': 'Globale Echtzeit-Wetterdaten',
      'footer.timezoneNote': 'Ortszeiten verwenden die IANA-Zeitzone jeder Stadt und aktualisieren sich in Echtzeit · Ihre Referenzzeit wird aus der Zeitzone Ihres Geräts erkannt ({zone})',

      // --- Clocks / time difference -----------------------------------------
      'time.sameAsYou': 'Gleiche Uhrzeit wie bei Ihnen',
      'time.sameAsYouShort': 'Gleiche Zeit',
      'time.aheadOf': '{value} vor Ihnen',
      'time.behind': '{value} hinter Ihnen',
      'time.detectedZone': 'Erkannte Zeitzone: {zone}',
      'time.localTimeAria': 'Ihre lokale Zeit, erkannt aus der Zeitzone {zone}',
      'time.youClock': 'Sie {time}',
      'time.yourZoneTitle': 'Ihre Zeitzone: {zone}',
      'time.allTimesIn': 'Alle Zeiten in {zone}',

      // --- Visitor IP location ------------------------------------------------
      'nav.detectedLocation': 'Erkannter Standort',
      'nav.yourIP': 'Ihre IP',
      'nav.countryCity': '{country}, {city}',
      'time.offsetVsYou': 'Unterschied zu Ihnen ({zone}): {value}',
      'time.freshnessNow': 'Gerade eben aktualisiert',
      'time.freshnessMinutes': 'Vor {count} Min. aktualisiert',
      'time.freshnessHours': 'Vor {count} Stunde aktualisiert',
      'time.freshnessHoursPlural': 'Vor {count} Stunden aktualisiert',
      'time.freshnessDays': 'Vor {count} Tag aktualisiert',
      'time.freshnessDaysPlural': 'Vor {count} Tagen aktualisiert',

      // --- Sharing ----------------------------------------------------------
      'share.forecast': 'Geteilte Vorhersage',
      'share.showAllCards': 'Alle Karten anzeigen',
      'share.button': 'Wetter teilen',
      'share.weatherIn': 'Wetter in {place}',
      'share.rain': '{value}% Regen',
      'share.high': 'Höchst {value}',
      'share.low': 'Tiefst {value}',
      'share.copied': 'Link kopiert. Beim Öffnen wird {place} mit den geteilten Karten angezeigt.',
      'share.copyFailedInBar': 'Automatisches Kopieren nicht möglich. Der Link für {place} steht nun in der Adressleiste.',
      'share.copyFailed': 'Automatisches Kopieren nicht möglich. Kopieren Sie den Link aus der Adressleiste, um diese Vorhersage zu teilen.',

      // --- Weather condition labels (WMO) ------------------------------------
      'wmo.0': 'Klarer Himmel',
      'wmo.1': 'Überwiegend klar',
      'wmo.2': 'Teilweise bewölkt',
      'wmo.3': 'Bedeckt',
      'wmo.45': 'Neblig',
      'wmo.48': 'Gefrierender Nebel',
      'wmo.51': 'Leichter Nieselregen',
      'wmo.53': 'Mäßiger Nieselregen',
      'wmo.55': 'Starker Nieselregen',
      'wmo.56': 'Gefrierender Nieselregen',
      'wmo.57': 'Starker gefrierender Nieselregen',
      'wmo.61': 'Leichter Regen',
      'wmo.63': 'Mäßiger Regen',
      'wmo.65': 'Starker Regen',
      'wmo.66': 'Gefrierender Regen',
      'wmo.67': 'Starker gefrierender Regen',
      'wmo.71': 'Leichter Schneefall',
      'wmo.73': 'Mäßiger Schneefall',
      'wmo.75': 'Starker Schneefall',
      'wmo.77': 'Schneegriesel',
      'wmo.80': 'Leichte Regenschauer',
      'wmo.81': 'Mäßige Regenschauer',
      'wmo.82': 'Heftige Regenschauer',
      'wmo.85': 'Schneeschauer',
      'wmo.86': 'Starke Schneeschauer',
      'wmo.95': 'Gewitter',
      'wmo.96': 'Gewitter mit Hagel',
      'wmo.99': 'Starkes Gewitter mit Hagel',
      'wmo.unknown': 'Klar',

      // --- Glance engine (glance.js) ----------------------------------------
      'glanceEngine.storm': 'Gewitter erwartet',
      'glanceEngine.snow': 'Heute Schnee',
      'glanceEngine.freezing': 'Frostkälte',
      'glanceEngine.hot': 'Sehr heiß',
      'glanceEngine.umbrella': 'Regenschirm empfohlen',
      'glanceEngine.gale': 'Sehr windig',
      'glanceEngine.good': 'Gutes Wetter',
      'glanceEngine.around': ' gegen {time}',
      'glanceEngine.at': ' um {time}',
      'glanceEngine.detailStorm': 'Gewitter sind erwartet{when} - Outdoor-Pläne könnten kurzfristig ausfallen.',
      'glanceEngine.detailSnow': 'Schnee ist erwartet{when} - planen Sie zusätzliche Fahrzeit ein.',
      'glanceEngine.detailFreezing': 'Gefühlt {temp}{when} - warme Kleidung nötig.',
      'glanceEngine.detailHot': 'Gefühlt {temp}{when} - suchen Sie Schatten und trinken Sie viel.',
      'glanceEngine.detailRainNow': 'Es regnet gerade ({amount} in der letzten Stunde).',
      'glanceEngine.detailRainNowShort': 'Es regnet gerade.',
      'glanceEngine.detailRainPeak': 'Regen steigt auf {value}{when}.',
      'glanceEngine.detailLightPrecip': 'Heute wird leichter Niederschlag erwartet.',
      'glanceEngine.detailWinds': 'Wind erreicht heute {value} - ein windiger Tag draußen.',
      'glanceEngine.detailVeryWindy': 'Heute sehr windig.',
      'glanceEngine.detailMostlyDry': 'Überwiegend trocken',
      'glanceEngine.detailDry': 'Trocken',
      'glanceEngine.detailComfortable': 'und angenehm bei etwa {value}',
      'glanceEngine.detailWithWind': 'bei {value}',
      'glanceEngine.windLight': 'leichtem Wind',
      'glanceEngine.windBreeze': 'einer leichten Brise',
      'glanceEngine.windStrong': 'starkem Wind',
      'glanceEngine.windVeryStrong': 'sehr starkem Wind',
      'glanceEngine.metricRain': 'Regen',
      'glanceEngine.metricWind': 'Wind',
      'glanceEngine.metricHumidity': 'Luftfeuchtigkeit',
      'glanceEngine.hintPeakToday': 'höchste Wahrscheinlichkeit heute',
      'glanceEngine.hintNotReported': 'nicht gemeldet',
      'glanceEngine.hintRelativeHumidity': 'relative Luftfeuchtigkeit',

      // --- Compare engine (compare.js) ---------------------------------------
      'compareEngine.metricCondition': 'Wetter',
      'compareEngine.metricTemperature': 'Temperatur',
      'compareEngine.metricApparent': 'Gefühlt',
      'compareEngine.metricRainChance': 'Regenwahrscheinlichkeit',
      'compareEngine.metricWind': 'Wind',
      'compareEngine.metricPressure': 'Luftdruck',
      'compareEngine.metricCloudCover': 'Bewölkung',
      'compareEngine.metricSun': 'Sonnenaufgang / -untergang',
      'compareEngine.metricPrecipitation': 'Niederschlag',
      'compareEngine.metricUv': 'UV-Index',
      'compareEngine.metricMaxUv': 'Max. UV',
      'compareEngine.metricMaxWind': 'Max. Wind',
      'compareEngine.warmer': 'wärmer',
      'compareEngine.cooler': 'kühler',
      'compareEngine.insightTemperature': '{city} ist {gap} {word} als {other}.',
      'compareEngine.insightApparent': 'In {city} ist es {gap} {word} als in {other}.',
      'compareEngine.insightRain': '{city} hat die geringere Regenwahrscheinlichkeit ({low} gegenüber {high}).',
      'compareEngine.insightWind': 'Der Wind ist in {city} {gap} stärker als in {other}.',
      'compareEngine.insightPressure': 'Der Luftdruck ist in {city} {gap} höher als in {other}.',
      'compareEngine.insightCloud': '{city} ist {gap} bewölkter als {other}.',
      'compareEngine.insightSun': 'Die Sonne geht in {city} {gap} auf als in {other}.',
      'compareEngine.insightPrecip': '{city} hat {gap} Niederschlag als {other}.',
      'compareEngine.insightUv': 'Der UV-Index ist in {city} {gap} höher als in {other}.',
      'compareEngine.insightMaxUv': 'Der höchste UV-Index ist heute in {city} {gap} höher als in {other}.',
      'compareEngine.insightMaxWind': 'Der stärkste Wind ist heute in {city} {gap} stärker als in {other}.',
      'compareEngine.gapWarmer': ' wärmer',
      'compareEngine.gapCooler': ' kühler',
      'compareEngine.gapStronger': ' stärker',
      'compareEngine.gapHigher': ' höher',
      'compareEngine.gapCloudier': ' bewölkter',
      'compareEngine.gapEarlier': ' früher',
      'compareEngine.gapMore': ' mehr',
      'compareEngine.gapFaster': ' stärker',

      // --- Assistant engine (advice.js) --------------------------------------
      'adviceEngine.windowMorning': 'Morgen',
      'adviceEngine.windowMidday': 'Mittag',
      'adviceEngine.windowAfternoon': 'Nachmittag',
      'adviceEngine.windowEvening': 'Abend',
      'adviceEngine.phraseMorning': 'Ihren Morgen',
      'adviceEngine.phraseMidday': 'die Mittagsstunden',
      'adviceEngine.phraseAfternoon': 'Ihren Nachmittag',
      'adviceEngine.phraseEvening': 'den Abend',
      'adviceEngine.tileUmbrella': 'Regenschirm',
      'adviceEngine.tileWalk': 'Spaziergang',
      'adviceEngine.tileCarWash': 'Auto waschen',
      'adviceEngine.tileCycling': 'Radfahren',
      'adviceEngine.tileSwimming': 'Schwimmen',
      'adviceEngine.tileClothing': 'Was anziehen',
      'adviceEngine.summaryLabel': 'Tipp für heute',
      'adviceEngine.scopeToday': 'den Rest des Tages',
      'adviceEngine.scopeNext24': 'die nächsten 24 Stunden',
      'adviceEngine.notEnoughTitle': 'Nicht genügend Vorhersagedaten',
      'adviceEngine.notEnoughDetail': 'Diese Empfehlung benötigt stündliche Vorhersagedaten, die derzeit nicht verfügbar sind.',
      'adviceEngine.noHourly': 'Es sind keine nutzbaren stündlichen Vorhersagedaten verfügbar.',
      'adviceEngine.noPrecip': 'Für diese Stadt nennt die Vorhersage weder Niederschlagswahrscheinlichkeit noch -menge.',
      'adviceEngine.noTemperatures': 'Es sind keine nutzbaren stündlichen Temperaturen verfügbar.',
      'adviceEngine.noStretch': 'Zu wenige stündliche Temperaturen, um einen Abschnitt des Tages zu vergleichen.',
      'adviceEngine.noDaylight': 'Für die Tageslichtstunden ist keine stündliche Lufttemperatur verfügbar.',
      'adviceEngine.noPeriodTemp': 'Für diesen Zeitraum ist keine stündliche Temperatur verfügbar.',
      'adviceEngine.notCalculated': 'Diese Empfehlung konnte aus der aktuellen Vorhersage nicht berechnet werden.',
      'adviceEngine.summaryNotCalculated': 'Diese Zusammenfassung konnte aus der aktuellen Vorhersage nicht berechnet werden.',
      'adviceEngine.umbrellaDefinitely': 'Unbedingt einen Regenschirm mitnehmen',
      'adviceEngine.umbrellaLikely': 'Regenschirm mitnehmen',
      'adviceEngine.umbrellaUnlikely': 'Wahrscheinlich nicht nötig',
      'adviceEngine.walkNone': 'Heute kein idealer Zeitraum',
      'adviceEngine.walkLimited': 'Wenig Details für diesen Zeitraum',
      'adviceEngine.walkReasonWind': 'es ist windig',
      'adviceEngine.walkBest': 'Das trockenste Zeitfenster ist {window}. {reasons}',
      'adviceEngine.walkBestPlain': 'Das trockenste Zeitfenster ist {window}.',
      'adviceEngine.walkBut': '{detail}, aber {reasons}.',
      'adviceEngine.carWashGood': 'Guter Tag zum Autowaschen',
      'adviceEngine.carWashBad': 'Heute nicht ideal',
      'adviceEngine.carWashRainLater': 'Regen ist erwartet{when}{amount}.',
      'adviceEngine.carWashUnsettled': ' Den ganzen Tag über sind nasse oder unbeständige Bedingungen zu erwarten.',
      'adviceEngine.carWashDrySpells': 'Die trockenen Abschnitte sind zu kurz.{hint}',
      'adviceEngine.cyclingBad': 'Nicht ideal zum Radfahren',
      'adviceEngine.cyclingWind': 'Starke Winde um {wind}{when} werden erwartet.',
      'adviceEngine.cyclingRain': '{amount}',
      'adviceEngine.cyclingCold': 'Für Radfahren sehr kalt - etwa {temp}.',
      'adviceEngine.cyclingHot': 'Für Radfahren sehr warm - bis {temp}.',
      'adviceEngine.cyclingGood': 'Gut zum Radfahren',
      'adviceEngine.cyclingGoodDetail': '{temps}trocken und mit relativ schwachem Wind.',
      'adviceEngine.swimBad': 'Heute nicht ideal',
      'adviceEngine.swimRain': '{amount} Lieber nicht ins Wasser gehen.',
      'adviceEngine.swimCold': 'Kühl zum Schwimmen im Freien - Lufttemperatur bestenfalls um {temp}.',
      'adviceEngine.swimHot': 'Sehr warme Luft, bis {temp}. Zwischen den Bahnen im Schatten bleiben.',
      'adviceEngine.swimGood': 'Gutes Wetter zum Schwimmen im Freien',
      'adviceEngine.swimOvercast': 'überwiegend bedeckt',
      'adviceEngine.clothingLight': 'Leichte Kleidung',
      'adviceEngine.clothingWarm': 'Warm - um {temp} am wärmsten Teil des Tages.',
      'adviceEngine.clothingJacketUmbrella': 'Warme Jacke + Regenschirm',
      'adviceEngine.clothingJacketUmbrellaDetail': 'Kalt und nass - um {temp}, Regen ist erwartet.',
      'adviceEngine.clothingTShirtUmbrella': 'T-Shirt-Wetter + Regenschirm',
      'adviceEngine.clothingTShirt': 'T-Shirt-Wetter',
      'adviceEngine.clothingTShirtDetail': 'Warm und trocken{wind}.',
      'adviceEngine.clothingTShirtWind': ' mit leichtem Wind',
      'adviceEngine.clothingLightJacket': 'Leichte Jacke empfohlen',
      'adviceEngine.clothingLightJacketDetail': 'Mild - um {temp}.',
      'adviceEngine.clothingWarmJacket': 'Warme Jacke empfohlen',
      'adviceEngine.clothingWarmJacketDetail': 'Kühl - um {temp}.',
      'adviceEngine.clothingCoat': 'Wintermantel empfohlen',
      'adviceEngine.clothingCoatDetail': 'Kalt, um {temp}.',
      'adviceEngine.clothingLayers': 'Sehr warme Kleidung nötig',
      'adviceEngine.clothingLayersDetail': 'Unter null, um {temp}.',
      'adviceEngine.uvNote': ' Sonnenschutz ist ratsam.',
      'adviceEngine.swingNote': 'Rechnen Sie heute mit {swing}°C Temperaturschwankung.',
      'adviceEngine.windNote': 'Es ist windig.',
      'adviceEngine.darkNote': 'Der größte Teil des verbleibenden Vorhersagefensters liegt nach Einbruch der Dunkelheit.',
      'adviceEngine.breezeNote': 'Eine leichte Brise wird erwartet.',
      'adviceEngine.tempsNote': 'Temperaturen um {temp}. ',
      'adviceEngine.rainWindowPeriod': 'In diesem Zeitraum ist Regen vorhergesagt.',
      'adviceEngine.rainWindowLight': 'In diesem Zeitraum ist leichter Niederschlag möglich.',
      'adviceEngine.summarySnow': 'Heute Schnee',
      'adviceEngine.summarySnowDetail': 'Heute wird Schnee erwartet. Planen Sie zusätzliche Fahrzeit ein.',
      'adviceEngine.summaryStorm': 'Gewitter erwartet',
      'adviceEngine.summaryStormDetail': 'Heute werden Gewitter erwartet - Outdoor-Pläne könnten unterbrochen werden.',
      'adviceEngine.summaryUmbrella': 'Nehmen Sie heute einen Regenschirm mit',
      'adviceEngine.summaryCold': 'Heute kalt',
      'adviceEngine.summaryHot': 'Heute heiß',
      'adviceEngine.summaryGreat': 'Großartiger Tag für draußen',
      'adviceEngine.summaryMixed': 'Gemischte Bedingungen heute',
      'adviceEngine.summaryMixedDetail': 'Unbeständige Phasen sind{when} während {scope} zu erwarten.',
      'adviceEngine.summaryCloudyDry': 'Bewölkt, aber trocken heute',
      'adviceEngine.summaryCloudyDryDetail': 'Kein Regen vorhergesagt; um {temp} bei {wind}.',
      'adviceEngine.summaryVariableWinds': 'wechselndem Wind',
      'assistant.scopeNext24': 'Basierend auf den nächsten 24 Stunden',
      'assistant.scopeToday': 'Basierend auf dem Rest des Tages',
      'assistant.heading': 'Tipp für heute',
      'assistant.preparing': 'Ihre Vorhersage wird vorbereitet…',
      'assistant.windowTitle': 'Regen während Ihrer…?',
      'assistant.windowTitlePlain': 'Regen während...',
    },

    it: {
      'app.name': 'WeatherScope',
      'app.title': 'WeatherScope - Clima e previsioni delle città',
      'app.description': 'Cerca le condizioni meteo in tempo reale per città o scopri località in tutto il mondo con il clima che preferisci.',
      'app.noscript': 'WeatherScope richiede JavaScript per recuperare e mostrare i dati meteorologici in tempo reale.',
      'app.noscriptHint': 'Attiva JavaScript nel browser e ricarica la pagina.',
      'search.searchingFor': 'Ricerca di "{city}"...',
      'search.matchingLocations': '{count} località corrispondenti: selezionane una',
      'nav.modeAria': 'Selezione modalità di ricerca', 'nav.citySearch': 'Cerca città',
      'nav.compare': 'Confronta', 'nav.climateFilter': 'Filtro climatico',
      'nav.unitAria': 'Selezione unità di temperatura', 'nav.languageAria': 'Selezione lingua',
      'nav.yourTime': 'La tua ora', 'nav.searchModeCity': 'Cerca città',
      'nav.searchModeCompare': 'Confronta', 'nav.searchModeClimate': 'Filtro climatico',
      'search.placeholderCity': 'Cerca una città (es. Roma, Tokyo, New York)...',
      'search.placeholderCompare': 'Aggiungi una località da confrontare (es. Roma, Oslo, Il Cairo)...',
      'search.placeholderClimate': 'Cerca clima: Soleggiato, Caldo, Pioggia, Neve, > 25°C...',
      'search.submit': 'Cerca', 'search.inputAria': 'Cerca una città o una condizione climatica',
      'search.clearAria': 'Cancella campo', 'search.suggestionsAria': 'Suggerimenti di ricerca',
      'search.useLocation': 'Usa la posizione attuale',
      'climate.presetClimates': 'Climi predefiniti:', 'climate.sunny': 'Soleggiato',
      'climate.cloudy': 'Nuvoloso', 'climate.rainy': 'Piovoso', 'climate.snowy': 'Nevoso',
      'climate.storm': 'Temporale', 'climate.freezing': 'Gelo', 'climate.cold': 'Freddo',
      'climate.cool': 'Fresco', 'climate.mild': 'Mite', 'climate.warm': 'Caldo',
      'climate.hot': 'Molto caldo', 'climate.humid': 'Umido', 'climate.dry': 'Secco',
      'climate.windy': 'Ventoso', 'climate.gale': 'Burrasca', 'climate.beachDay': 'Giornata al mare',
      'climate.skiTrip': 'Gita sugli sci', 'climate.tropical': 'Tropicale',
      'climate.mildBreezy': 'Mite e ventilato', 'climate.rainyMild': 'Piovoso e mite',
      'climate.resultsTitle': 'Città con condizioni climatiche corrispondenti',
      'climate.resultsAria': 'Città corrispondenti', 'climate.foundOne': 'Trovata {count} città',
      'climate.foundMany': 'Trovate {count} città',
      'climate.clickToExplore': 'Seleziona una città per esplorare il meteo in tempo reale e le previsioni a 7 giorni.',
      'climate.sortLabel': 'Ordina:', 'climate.sortNameAsc': 'Nome città (A-Z)',
      'climate.sortNameDesc': 'Nome città (Z-A)', 'climate.sortTemperature': 'Temperatura',
      'climate.sortHumidity': 'Umidità', 'climate.sortWind': 'Velocità del vento',
      'climate.sortHighToLow': '{label} (dal più alto al più basso)',
      'climate.sortLowToHigh': '{label} (dal più basso al più alto)',
      'climate.resultsSubtitle': 'Cercate {count} città di riferimento in tutto il mondo. Seleziona una città per esplorare il meteo in tempo reale e le previsioni a 7 giorni.',
      'camera.toggleOn': 'Telecamere live attive',
      'camera.toggleOff': 'Telecamere live spente',
      'camera.none': 'Non esiste una webcam pubblica gratuita per questa città',
      'camera.live': 'Live',
      'camera.pause': 'Pausa',
      'camera.play': 'Riproduci',
      'camera.alt': 'Immagine dalla telecamera live: {place}',
      'camera.altGeneric': 'Immagine dalla telecamera live',
      'camera.distanceOne': 'A {distance} km di distanza',
      'camera.distanceMany': 'A {distance} km di distanza',
      'camera.attribution': 'Telecamera: {source}',
      'camera.offline': 'Telecamera non disponibile',
      'camera.still': 'Fotogramma live',
      'camera.next': 'Telecamera successiva ({index}/{total})',
      'camera.off': 'Le telecamere live sono spente',
      'camera.throttled': 'Ricerca della telecamera non disponibile al momento',
      'camera.compareAria': 'Telecamere live per le località confrontate',
      'climate.emptyTitle': 'Nessuna delle {count} città di riferimento corrisponde esattamente a questi criteri climatici.',
      'climate.emptyHint': 'Prova una condizione più ampia come "Soleggiato", "Caldo" o "Nuvoloso".',
      'climate.viewDetails': 'Vedi dettagli meteo', 'climate.cardHumidityTitle': 'Umidità relativa',
      'climate.cardWindTitle': 'Velocità del vento', 'climate.discovery': 'Esplora il clima',
      'climate.backToMatching': 'Torna alle città corrispondenti ({count})',
      'climate.searchWorldwide': 'Cerca in tutto il mondo città che corrispondono a "{query}" →',
      'climate.searching': 'Ricerca di città con il clima selezionato...',
      'climate.errorTitle': 'Errore nella ricerca climatica',
      'climate.errorBody': 'Impossibile recuperare i dati meteorologici globali. Riprova.',
      'state.fetching': 'Recupero dei dati meteorologici in tempo reale...',
      'state.fetchingCity': 'Recupero del meteo in tempo reale per {city}...',
      'state.errorTitle': 'Nessun risultato corrispondente',
      'state.errorBody': 'Non è stato possibile recuperare i risultati. Modifica i criteri e riprova.',
      'state.retry': 'Prova un’altra ricerca', 'state.backToResults': 'Torna ai risultati climatici',
      'state.weatherUnavailableTitle': 'Dati meteo non disponibili',
      'state.weatherUnavailableBody': 'Impossibile recuperare il meteo per "{city}". Controlla la connessione e riprova.',
      'state.cityNotFoundTitle': 'Città non trovata',
      'state.cityNotFoundBody': 'Nessun risultato per "{city}". Prova una grafia diversa o aggiungi il Paese.',
      'state.searchFailedTitle': 'Ricerca non riuscita',
      'state.searchTimedOut': 'La ricerca è scaduta. Controlla la connessione e riprova.',
      'state.searchFailed': 'Errore durante la ricerca della città. Riprova.',
      'geo.button': 'Usa la posizione attuale', 'geo.detecting': 'Rilevamento della posizione...',
      'geo.unsupportedTitle': 'Geolocalizzazione non supportata',
      'geo.unsupported': 'Il browser non supporta il rilevamento automatico della posizione.',
      'geo.deniedTitle': 'Accesso alla posizione negato',
      'geo.denied': 'Impossibile ottenere la posizione. Controlla i permessi o cerca direttamente la città.',
      'geo.myLocation': 'La mia posizione',
      'compare.heading': 'Confronta località', 'compare.count': '{selected} di {max} selezionate',
      'compare.subtitle': 'Cerca qui sopra o scegli una città popolare, poi confronta da 2 a 4 località.',
      'compare.addLocation': 'Aggiungi località', 'compare.run': 'Confronta',
      'compare.clearAll': 'Cancella tutto', 'compare.loading': 'Confronto del meteo...',
      'compare.glanceHeading': 'Il meteo a colpo d’occhio',
      'compare.legendHigh': 'Valore più alto nella riga', 'compare.legendLow': 'Valore più basso nella riga',
      'compare.currentHeading': 'Condizioni attuali',
      'compare.forecastHeading': 'Confronto delle previsioni di oggi',
      'compare.forecastSubtitle': 'Massime, minime, probabilità di pioggia e valori di picco',
      'compare.metricHead': 'Metrica', 'compare.locationSlot': 'Località {slot}',
      'compare.locationSlotEmpty': 'Località {slot} — usa la ricerca o una città popolare',
      'compare.add': 'Aggiungi', 'compare.moveEarlier': 'Sposta prima',
      'compare.moveLater': 'Sposta dopo', 'compare.removeCity': 'Rimuovi {city} dal confronto',
      'compare.clearSlot': 'Rimuovi questa località', 'compare.unknownLocation': 'Località sconosciuta',
      'compare.selectedLocation': 'Località selezionata', 'compare.locationFallback': 'Località',
      'compare.weatherUnavailable': 'Meteo non disponibile', 'compare.tryAgain': 'Riprova',
      'compare.highest': 'più alto', 'compare.lowest': 'più basso',
      'compare.freshness': 'Ultima lettura: {label}',
      'compare.needTwoLocations': 'Servono almeno due località con dati meteo per il confronto.',
      'compare.verySimilar': 'Le località sono molto simili al momento; non emergono differenze.',
      'compare.duplicate': '{city} è già presente nel confronto.',
      'compare.listFull': 'Puoi confrontare fino a {max} località. Rimuovine una per aggiungerne un’altra.',
      'compare.couldNotAdd': 'Impossibile aggiungere la località al confronto.',
      'compare.changeLocation': '{city}, {meta}. Cambia questa località.',
      'compare.retryAria': 'Riprova a caricare il meteo per {city}',
      'compare.thisLocation': 'questa località',
      'compare.ariaExtreme': '{value}, {word} tra le località confrontate',
      'compare.ariaExtremeTitle': '{word} per {row}',
      'compare.replacing': 'Scegli una nuova località per la posizione {slot} (attualmente {city}). Premi Esc per annullare.',
      'compare.noResults': 'Nessun risultato per "{query}". Prova una grafia diversa o aggiungi il Paese.',
      'compare.searchTimedOut': 'La ricerca della località è scaduta. Controlla la connessione e riprova.',
      'compare.searchFailed': 'Ricerca della località non riuscita. Riprova.',
      'compare.locationZone': 'Fuso orario locale {zone}, {diff}',
      'glance.heading': 'Oggi a colpo d’occhio', 'glance.feelsLike': 'Percepita',
      'glance.verdictLabel': 'Il verdetto di oggi:', 'glance.whatToWear': 'Come vestirsi:',
      'hero.feelsLike': 'Percepita', 'hero.shareAria': 'Condividi il meteo',
      'hero.refreshAria': 'Aggiorna i dati meteo', 'metrics.aria': 'Metriche meteo principali',
      'metrics.heading': 'Condizioni attuali', 'metrics.humidity': 'Umidità',
      'metrics.wind': 'Vento', 'metrics.uvIndex': 'Indice UV', 'metrics.pressure': 'Pressione',
      'metrics.precipitation': 'Precipitazioni', 'metrics.localTime': 'Ora locale',
      'metrics.sunriseSunset': 'Alba e tramonto', 'metrics.sunrise': 'Alba',
      'metrics.sunset': 'Tramonto', 'metrics.cloudCover': 'Copertura nuvolosa: {value}%',
      'metrics.humidityDry': 'Ambiente secco', 'metrics.humidityComfortable': 'Umidità confortevole',
      'metrics.humidityHigh': 'Umidità elevata', 'metrics.pressureNormal': 'Pressione normale',
      'metrics.pressureHigh': 'Alta pressione', 'metrics.pressureLow': 'Bassa pressione',
      'metrics.uvLow': 'Basso', 'metrics.uvModerate': 'Moderato', 'metrics.uvHigh': 'Alto',
      'metrics.uvVeryHigh': 'Molto alto', 'metrics.uvExtreme': 'Estremo',
      'metrics.uvAdviceLow': 'Basso rischio di danni solari',
      'metrics.uvAdviceModerate': 'Si consiglia protezione solare',
      'metrics.uvAdviceHigh': 'Indossa cappello e crema solare',
      'metrics.uvAdviceVeryHigh': 'Evita il sole nelle ore centrali',
      'metrics.uvAdviceExtreme': 'Adotta tutte le precauzioni contro il sole',
      'forecast.hourlyHeading': 'Previsioni a 24 ore', 'forecast.hourlySubtitle': 'Previsioni orarie locali ·',
      'forecast.dailyHeading': 'Previsioni a 7 giorni', 'forecast.dailySubtitle': 'Previsioni dei prossimi giorni ·',
      'forecast.cityTime': 'ora locale', 'forecast.hourlyAria': 'Previsioni meteo orarie',
      'forecast.now': 'Adesso', 'forecast.today': 'Oggi', 'forecast.maxUvTitle': 'Indice UV massimo',
      'forecast.precipChanceTitle': 'Probabilità di precipitazioni',
      'popular.label': 'Popolari:', 'footer.providedBy': 'Dati forniti da {link}',
      'footer.tagline': 'Dati meteorologici globali in tempo reale',
      'footer.timezoneNote': 'Gli orari locali usano il fuso IANA di ogni città e si aggiornano in tempo reale · Il tuo fuso orario di riferimento è {zone}',
      'time.sameAsYou': 'Stessa ora tua', 'time.sameAsYouShort': 'Stessa ora',
      'time.aheadOf': '{value} avanti a te', 'time.behind': '{value} indietro rispetto a te',
      'time.detectedZone': 'Fuso orario rilevato: {zone}',
      'time.localTimeAria': 'Ora locale rilevata dal fuso orario {zone}',
      'time.youClock': 'Tu {time}', 'time.yourZoneTitle': 'Il tuo fuso orario: {zone}',
      'time.allTimesIn': 'Tutti gli orari in {zone}', 'nav.detectedLocation': 'Posizione rilevata',
      'nav.yourIP': 'Il tuo IP', 'nav.countryCity': '{country}, {city}',
      'time.offsetVsYou': 'Differenza rispetto a te ({zone}): {value}',
      'time.freshnessNow': 'Aggiornato adesso', 'time.freshnessMinutes': 'Aggiornato {count} min fa',
      'time.freshnessHours': 'Aggiornato {count} ora fa', 'time.freshnessHoursPlural': 'Aggiornato {count} ore fa',
      'time.freshnessDays': 'Aggiornato {count} giorno fa', 'time.freshnessDaysPlural': 'Aggiornato {count} giorni fa',
      'share.forecast': 'Previsioni condivise', 'share.showAllCards': 'Mostra tutte le schede',
      'share.button': 'Condividi il meteo', 'share.weatherIn': 'Meteo a {place}',
      'share.rain': '{value}% di pioggia', 'share.high': 'Massima {value}', 'share.low': 'Minima {value}',
      'share.copied': 'Link copiato. Aprendolo vedrai {place} con le schede condivise.',
      'share.copyFailedInBar': 'Copia automatica non riuscita. Il link per {place} è ora nella barra degli indirizzi.',
      'share.copyFailed': 'Copia automatica non riuscita. Copia il link dalla barra degli indirizzi per condividere le previsioni.',
      'wmo.0': 'Cielo sereno', 'wmo.1': 'Prevalentemente sereno', 'wmo.2': 'Parzialmente nuvoloso',
      'wmo.3': 'Coperto', 'wmo.45': 'Nebbia', 'wmo.48': 'Nebbia congelante',
      'wmo.51': 'Pioviggine debole', 'wmo.53': 'Pioviggine moderata', 'wmo.55': 'Pioviggine intensa',
      'wmo.56': 'Pioviggine congelante', 'wmo.57': 'Pioviggine congelante intensa',
      'wmo.61': 'Pioggia debole', 'wmo.63': 'Pioggia moderata', 'wmo.65': 'Pioggia intensa',
      'wmo.66': 'Pioggia congelante', 'wmo.67': 'Pioggia congelante intensa',
      'wmo.71': 'Neve debole', 'wmo.73': 'Neve moderata', 'wmo.75': 'Neve intensa',
      'wmo.77': 'Granuli di neve', 'wmo.80': 'Rovesci deboli', 'wmo.81': 'Rovesci moderati',
      'wmo.82': 'Rovesci violenti', 'wmo.85': 'Rovesci di neve', 'wmo.86': 'Rovesci di neve intensi',
      'wmo.95': 'Temporale', 'wmo.96': 'Temporale con grandine', 'wmo.99': 'Forte temporale con grandine',
      'wmo.unknown': 'Sereno',
      'glanceEngine.storm': 'Temporali previsti', 'glanceEngine.snow': 'Neve oggi',
      'glanceEngine.freezing': 'Freddo gelido', 'glanceEngine.hot': 'Molto caldo',
      'glanceEngine.umbrella': 'Ombrello consigliato', 'glanceEngine.gale': 'Molto ventoso',
      'glanceEngine.good': 'Bel tempo', 'glanceEngine.around': ' intorno alle {time}',
      'glanceEngine.at': ' alle {time}',
      'glanceEngine.detailStorm': 'Sono previsti temporali{when}: i programmi all’aperto potrebbero interrompersi.',
      'glanceEngine.detailSnow': 'È prevista neve{when}: calcola più tempo per gli spostamenti.',
      'glanceEngine.detailFreezing': 'Temperatura percepita {temp}{when}: servono strati pesanti.',
      'glanceEngine.detailHot': 'Temperatura percepita {temp}{when}: cerca l’ombra e idratati.',
      'glanceEngine.detailRainNow': 'Sta piovendo ({amount} nell’ultima ora).',
      'glanceEngine.detailRainNowShort': 'Sta piovendo.',
      'glanceEngine.detailRainPeak': 'La pioggia raggiungerà il picco di {value}{when}.',
      'glanceEngine.detailLightPrecip': 'Oggi sono previste precipitazioni leggere.',
      'glanceEngine.detailWinds': 'Oggi il vento raggiungerà {value}: una giornata ventosa.',
      'glanceEngine.detailVeryWindy': 'Oggi sarà molto ventoso.',
      'glanceEngine.detailMostlyDry': 'Prevalentemente asciutto', 'glanceEngine.detailDry': 'Asciutto',
      'glanceEngine.detailComfortable': 'e piacevole, intorno a {value}',
      'glanceEngine.detailWithWind': 'con {value}', 'glanceEngine.windLight': 'vento leggero',
      'glanceEngine.windBreeze': 'una brezza', 'glanceEngine.windStrong': 'vento forte',
      'glanceEngine.windVeryStrong': 'vento molto forte', 'glanceEngine.metricRain': 'Pioggia',
      'glanceEngine.metricWind': 'Vento', 'glanceEngine.metricHumidity': 'Umidità',
      'glanceEngine.hintPeakToday': 'probabilità massima oggi', 'glanceEngine.hintNotReported': 'non segnalato',
      'glanceEngine.hintRelativeHumidity': 'umidità relativa',
      'compareEngine.metricCondition': 'Meteo', 'compareEngine.metricTemperature': 'Temperatura',
      'compareEngine.metricApparent': 'Percepita', 'compareEngine.metricRainChance': 'Probabilità di pioggia',
      'compareEngine.metricWind': 'Vento', 'compareEngine.metricPressure': 'Pressione',
      'compareEngine.metricCloudCover': 'Copertura nuvolosa', 'compareEngine.metricSun': 'Alba / tramonto',
      'compareEngine.metricPrecipitation': 'Precipitazioni', 'compareEngine.metricUv': 'Indice UV',
      'compareEngine.metricMaxUv': 'UV massimo', 'compareEngine.metricMaxWind': 'Vento massimo',
      'compareEngine.warmer': 'più caldo', 'compareEngine.cooler': 'più fresco',
      'compareEngine.insightTemperature': '{city} è {gap} {word} di {other}.',
      'compareEngine.insightApparent': 'A {city} la temperatura percepita è {gap} {word} rispetto a {other}.',
      'compareEngine.insightRain': '{city} ha una probabilità di pioggia minore ({low} contro {high}).',
      'compareEngine.insightWind': 'Il vento a {city} è più forte di {gap} rispetto a {other}.',
      'compareEngine.insightPressure': 'La pressione a {city} è maggiore di {gap} rispetto a {other}.',
      'compareEngine.insightCloud': '{city} è più nuvolosa di {gap} rispetto a {other}.',
      'compareEngine.insightSun': 'Il sole sorge prima di {gap} a {city} rispetto a {other}.',
      'compareEngine.insightPrecip': '{city} ha {gap} precipitazioni in più rispetto a {other}.',
      'compareEngine.insightUv': 'L’indice UV a {city} è maggiore di {gap} rispetto a {other}.',
      'compareEngine.insightMaxUv': 'Oggi l’indice UV massimo a {city} è maggiore di {gap} rispetto a {other}.',
      'compareEngine.insightMaxWind': 'Oggi il vento più forte a {city} è più veloce di {gap} rispetto a {other}.',
      'compareEngine.gapWarmer': ' più caldo', 'compareEngine.gapCooler': ' più fresco',
      'compareEngine.gapStronger': ' più forte', 'compareEngine.gapHigher': ' più alto',
      'compareEngine.gapCloudier': ' più nuvoloso', 'compareEngine.gapEarlier': ' prima',
      'compareEngine.gapMore': ' in più', 'compareEngine.gapFaster': ' più veloce',
      'assistant.heading': 'Consigli per oggi', 'assistant.scopeToday': 'In base al resto della giornata',
      'assistant.scopeNext24': 'In base alle prossime 24 ore', 'assistant.preparing': 'Preparazione delle previsioni…',
      'assistant.windowTitle': 'Pioggia durante…?', 'assistant.windowTitlePlain': 'Pioggia durante...?',
      'adviceEngine.windowMorning': 'Mattina', 'adviceEngine.windowMidday': 'Mezzogiorno',
      'adviceEngine.windowAfternoon': 'Pomeriggio', 'adviceEngine.windowEvening': 'Sera',
      'adviceEngine.phraseMorning': 'la mattina', 'adviceEngine.phraseMidday': 'le ore centrali',
      'adviceEngine.phraseAfternoon': 'il pomeriggio', 'adviceEngine.phraseEvening': 'la sera',
      'adviceEngine.tileUmbrella': 'Ombrello', 'adviceEngine.tileWalk': 'Passeggiata',
      'adviceEngine.tileCarWash': 'Lavare l’auto', 'adviceEngine.tileCycling': 'Bicicletta',
      'adviceEngine.tileSwimming': 'Nuoto', 'adviceEngine.tileClothing': 'Come vestirsi',
      'adviceEngine.summaryLabel': 'Consigli per oggi', 'adviceEngine.scopeToday': 'il resto di oggi',
      'adviceEngine.scopeNext24': 'le prossime 24 ore',
      'adviceEngine.notEnoughTitle': 'Dati previsionali insufficienti',
      'adviceEngine.notEnoughDetail': 'Questo consiglio richiede dati orari non disponibili al momento.',
      'adviceEngine.noHourly': 'Non sono disponibili previsioni orarie utilizzabili.',
      'adviceEngine.noPrecip': 'Le previsioni non includono probabilità o quantità di precipitazioni per questa città.',
      'adviceEngine.noTemperatures': 'Non sono disponibili temperature orarie utilizzabili.',
      'adviceEngine.noStretch': 'Dati orari insufficienti per confrontare una parte della giornata.',
      'adviceEngine.noDaylight': 'Temperatura oraria non disponibile nelle ore diurne.',
      'adviceEngine.noPeriodTemp': 'Temperatura oraria non disponibile per questo periodo.',
      'adviceEngine.notCalculated': 'Impossibile calcolare questo consiglio dalle previsioni attuali.',
      'adviceEngine.summaryNotCalculated': 'Impossibile calcolare il riepilogo dalle previsioni attuali.',
      'adviceEngine.umbrellaDefinitely': 'Porta sicuramente un ombrello',
      'adviceEngine.umbrellaLikely': 'Porta un ombrello', 'adviceEngine.umbrellaUnlikely': 'Probabilmente no',
      'adviceEngine.walkNone': 'Oggi non c’è un momento ideale',
      'adviceEngine.walkLimited': 'Pochi dettagli per questo periodo',
      'adviceEngine.walkReasonWind': 'c’è vento',
      'adviceEngine.walkBest': 'Il periodo più asciutto è {window}. {reasons}',
      'adviceEngine.walkBestPlain': 'Il periodo più asciutto è {window}.',
      'adviceEngine.walkBut': '{detail}, ma {reasons}.',
      'adviceEngine.carWashGood': 'Giornata ideale per lavare l’auto',
      'adviceEngine.carWashBad': 'Oggi non è l’ideale',
      'adviceEngine.carWashRainLater': 'È prevista pioggia{when}{amount}.',
      'adviceEngine.carWashUnsettled': 'Sono previste condizioni umide o instabili per tutta la giornata.',
      'adviceEngine.carWashDrySpells': 'I periodi asciutti sono troppo brevi.{hint}',
      'adviceEngine.cyclingBad': 'Giornata poco adatta alla bici',
      'adviceEngine.cyclingWind': 'Sono previsti venti forti di circa {wind}{when}.',
      'adviceEngine.cyclingRain': '{amount}', 'adviceEngine.cyclingCold': 'Troppo freddo per pedalare: circa {temp}.',
      'adviceEngine.cyclingHot': 'Molto caldo per pedalare: fino a {temp}.',
      'adviceEngine.cyclingGood': 'Giornata adatta alla bici',
      'adviceEngine.cyclingGoodDetail': '{temps}asciutto e con vento moderato.',
      'adviceEngine.swimBad': 'Oggi non è l’ideale',
      'adviceEngine.swimRain': '{amount} Meglio evitare di entrare in acqua.',
      'adviceEngine.swimCold': 'Fresco per nuotare all’aperto: aria intorno a {temp} al massimo.',
      'adviceEngine.swimHot': 'Aria molto calda, fino a {temp}. Cerca l’ombra tra una nuotata e l’altra.',
      'adviceEngine.swimGood': 'Giornata ideale per nuotare all’aperto',
      'adviceEngine.swimOvercast': 'prevalentemente nuvoloso',
      'adviceEngine.clothingLight': 'Abiti leggeri',
      'adviceEngine.clothingWarm': 'Caldo: circa {temp} nelle ore più calde.',
      'adviceEngine.clothingJacketUmbrella': 'Giacca pesante e ombrello',
      'adviceEngine.clothingJacketUmbrellaDetail': 'Freddo e piovoso: circa {temp} con pioggia prevista.',
      'adviceEngine.clothingTShirtUmbrella': 'Tempo da maglietta, ma porta l’ombrello',
      'adviceEngine.clothingTShirt': 'Tempo da maglietta',
      'adviceEngine.clothingTShirtDetail': 'Caldo e asciutto{wind}.',
      'adviceEngine.clothingTShirtWind': ' con poco vento',
      'adviceEngine.clothingLightJacket': 'Consigliata una giacca leggera',
      'adviceEngine.clothingLightJacketDetail': 'Mite: circa {temp}.',
      'adviceEngine.clothingWarmJacket': 'Consigliata una giacca pesante',
      'adviceEngine.clothingWarmJacketDetail': 'Fresco: circa {temp}.',
      'adviceEngine.clothingCoat': 'Consigliato un cappotto invernale',
      'adviceEngine.clothingCoatDetail': 'Freddo: circa {temp}.',
      'adviceEngine.clothingLayers': 'Servono molti strati caldi',
      'adviceEngine.clothingLayersDetail': 'Sotto zero: circa {temp}.',
      'adviceEngine.uvNote': ' È consigliata la protezione solare.',
      'adviceEngine.swingNote': ' Oggi l’escursione termica sarà di {swing}°C.',
      'adviceEngine.windNote': ' C’è vento.', 'adviceEngine.darkNote': ' Gran parte delle ore previste sarà dopo il tramonto.',
      'adviceEngine.breezeNote': ' È prevista una brezza leggera.',
      'adviceEngine.tempsNote': 'Temperature intorno a {temp}. ',
      'adviceEngine.rainWindowPeriod': 'È prevista pioggia in questo periodo.',
      'adviceEngine.rainWindowLight': 'Possibili precipitazioni leggere in questo periodo.',
      'adviceEngine.summarySnow': 'Neve oggi',
      'adviceEngine.summarySnowDetail': 'È prevista neve oggi. Calcola più tempo per gli spostamenti.',
      'adviceEngine.summaryStorm': 'Temporali previsti',
      'adviceEngine.summaryStormDetail': 'Sono previsti temporali oggi: i programmi all’aperto potrebbero interrompersi.',
      'adviceEngine.summaryUmbrella': 'Oggi porta un ombrello',
      'adviceEngine.summaryCold': 'Oggi fa freddo', 'adviceEngine.summaryHot': 'Oggi fa caldo',
      'adviceEngine.summaryGreat': 'Una splendida giornata all’aperto',
      'adviceEngine.summaryMixed': 'Condizioni variabili oggi',
      'adviceEngine.summaryMixedDetail': 'Sono probabili fasi di maltempo{when} durante {scope}.',
      'adviceEngine.summaryCloudyDry': 'Nuvoloso ma asciutto oggi',
      'adviceEngine.summaryCloudyDryDetail': 'Non è prevista pioggia; circa {temp} con {wind}.',
      'adviceEngine.summaryVariableWinds': 'vento variabile',
    },

    es: {
      'app.name': 'WeatherScope',
      'app.title': 'WeatherScope - Clima y previsiones por ciudad',
      'app.description': 'Busca el tiempo en tiempo real por ciudad o descubre lugares de todo el mundo con el clima que prefieres.',
      'app.noscript': 'WeatherScope necesita JavaScript para consultar y mostrar datos meteorológicos en directo.',
      'app.noscriptHint': 'Activa JavaScript en el navegador y vuelve a cargar la página.',
      'search.searchingFor': 'Buscando "{city}"...',
      'search.matchingLocations': '{count} ubicaciones coincidentes: selecciona una',
      'nav.modeAria': 'Selección del modo de búsqueda', 'nav.citySearch': 'Buscar ciudad',
      'nav.compare': 'Comparar', 'nav.climateFilter': 'Filtro climático',
      'nav.unitAria': 'Selección de unidad de temperatura', 'nav.languageAria': 'Selección de idioma',
      'nav.yourTime': 'Tu hora', 'nav.searchModeCity': 'Buscar ciudad',
      'nav.searchModeCompare': 'Comparar', 'nav.searchModeClimate': 'Filtro climático',
      'search.placeholderCity': 'Busca una ciudad (p. ej., Madrid, Tokio, Nueva York)...',
      'search.placeholderCompare': 'Añade una ubicación para comparar (p. ej., Madrid, Oslo, El Cairo)...',
      'search.placeholderClimate': 'Buscar clima: Soleado, Cálido, Lluvia, Nieve, > 25°C...',
      'search.submit': 'Buscar', 'search.inputAria': 'Buscar una ciudad o una condición climática',
      'search.clearAria': 'Borrar texto', 'search.suggestionsAria': 'Sugerencias de búsqueda',
      'search.useLocation': 'Usar ubicación actual',
      'climate.presetClimates': 'Climas predefinidos:', 'climate.sunny': 'Soleado',
      'climate.cloudy': 'Nublado', 'climate.rainy': 'Lluvioso', 'climate.snowy': 'Nevado',
      'climate.storm': 'Tormenta', 'climate.freezing': 'Helado', 'climate.cold': 'Frío',
      'climate.cool': 'Fresco', 'climate.mild': 'Templado', 'climate.warm': 'Cálido',
      'climate.hot': 'Caluroso', 'climate.humid': 'Húmedo', 'climate.dry': 'Seco',
      'climate.windy': 'Ventoso', 'climate.gale': 'Temporal', 'climate.beachDay': 'Día de playa',
      'climate.skiTrip': 'Excursión de esquí', 'climate.tropical': 'Tropical',
      'climate.mildBreezy': 'Templado y con brisa', 'climate.rainyMild': 'Lluvioso y templado',
      'climate.resultsTitle': 'Ciudades con condiciones climáticas adecuadas',
      'climate.resultsAria': 'Ciudades coincidentes', 'climate.foundOne': '{count} ciudad encontrada',
      'climate.foundMany': '{count} ciudades encontradas',
      'climate.clickToExplore': 'Selecciona una ciudad para explorar el tiempo en directo y la previsión de 7 días.',
      'climate.sortLabel': 'Ordenar:', 'climate.sortNameAsc': 'Nombre de ciudad (A-Z)',
      'climate.sortNameDesc': 'Nombre de ciudad (Z-A)', 'climate.sortTemperature': 'Temperatura',
      'climate.sortHumidity': 'Humedad', 'climate.sortWind': 'Velocidad del viento',
      'climate.sortHighToLow': '{label} (de mayor a menor)',
      'climate.sortLowToHigh': '{label} (de menor a mayor)',
      'climate.resultsSubtitle': 'Se han buscado {count} ciudades de referencia en todo el mundo. Selecciona una para explorar el tiempo en directo y la previsión de 7 días.',
      'camera.toggleOn': 'Cámaras en directo activadas',
      'camera.toggleOff': 'Cámaras en directo desactivadas',
      'camera.none': 'No hay una cámara pública gratuita para esta ciudad',
      'camera.live': 'En directo',
      'camera.still': 'Imagen en directo',
      'camera.next': 'Siguiente cámara ({index}/{total})',
      'camera.off': 'Las cámaras en directo están desactivadas',
      'camera.throttled': 'Búsqueda de cámara no disponible ahora mismo',
      'camera.pause': 'Pausar',
      'camera.play': 'Reproducir',
      'camera.alt': 'Imagen de cámara en directo: {place}',
      'camera.altGeneric': 'Imagen de cámara en directo',
      'camera.distanceOne': 'A {distance} km de distancia',
      'camera.distanceMany': 'A {distance} km de distancia',
      'camera.attribution': 'Cámara: {source}',
      'camera.offline': 'Cámara no disponible',
      'camera.compareAria': 'Cámaras en directo para las ubicaciones comparadas',
      'climate.emptyTitle': 'Ninguna de las {count} ciudades de referencia coincide exactamente con estos criterios climáticos.',
      'climate.emptyHint': 'Prueba una condición más general, como "Soleado", "Cálido" o "Nublado".',
      'climate.viewDetails': 'Ver detalles del tiempo', 'climate.cardHumidityTitle': 'Humedad relativa',
      'climate.cardWindTitle': 'Velocidad del viento', 'climate.discovery': 'Explorar el clima',
      'climate.backToMatching': 'Volver a las ciudades coincidentes ({count})',
      'climate.searchWorldwide': 'Buscar ciudades de todo el mundo que coincidan con "{query}" →',
      'climate.searching': 'Buscando ciudades con el clima seleccionado...',
      'climate.errorTitle': 'Error en la búsqueda climática',
      'climate.errorBody': 'No se pudieron obtener los datos meteorológicos globales. Inténtalo de nuevo.',
      'state.fetching': 'Obteniendo datos meteorológicos en directo...',
      'state.fetchingCity': 'Obteniendo el tiempo en directo para {city}...',
      'state.errorTitle': 'No hay resultados coincidentes',
      'state.errorBody': 'No se pudieron obtener resultados. Ajusta los criterios e inténtalo de nuevo.',
      'state.retry': 'Probar otra búsqueda', 'state.backToResults': 'Volver a los resultados climáticos',
      'state.weatherUnavailableTitle': 'Datos meteorológicos no disponibles',
      'state.weatherUnavailableBody': 'No se pudo obtener el tiempo de "{city}". Comprueba la conexión e inténtalo de nuevo.',
      'state.cityNotFoundTitle': 'Ciudad no encontrada',
      'state.cityNotFoundBody': 'No hay resultados para "{city}". Prueba otra forma de escribirlo o añade el país.',
      'state.searchFailedTitle': 'Error en la búsqueda',
      'state.searchTimedOut': 'La búsqueda ha agotado el tiempo. Comprueba la conexión e inténtalo de nuevo.',
      'state.searchFailed': 'Se produjo un error al buscar la ciudad. Inténtalo de nuevo.',
      'geo.button': 'Usar ubicación actual', 'geo.detecting': 'Detectando tu ubicación...',
      'geo.unsupportedTitle': 'Geolocalización no compatible',
      'geo.unsupported': 'Tu navegador no permite detectar la ubicación automáticamente.',
      'geo.deniedTitle': 'Acceso a la ubicación denegado',
      'geo.denied': 'No se pudo obtener tu ubicación. Revisa los permisos o busca la ciudad directamente.',
      'geo.myLocation': 'Mi ubicación',
      'compare.heading': 'Comparar ubicaciones', 'compare.count': '{selected} de {max} seleccionadas',
      'compare.subtitle': 'Busca arriba o elige una ciudad popular y compara entre 2 y 4 lugares.',
      'compare.addLocation': 'Añadir ubicación', 'compare.run': 'Comparar',
      'compare.clearAll': 'Borrar todo', 'compare.loading': 'Comparando el tiempo...',
      'compare.glanceHeading': 'El tiempo de un vistazo',
      'compare.legendHigh': 'Valor más alto de la fila', 'compare.legendLow': 'Valor más bajo de la fila',
      'compare.currentHeading': 'Condiciones actuales',
      'compare.forecastHeading': 'Comparación de la previsión de hoy',
      'compare.forecastSubtitle': 'Máximas, mínimas, probabilidad de lluvia y valores máximos',
      'compare.metricHead': 'Métrica', 'compare.locationSlot': 'Ubicación {slot}',
      'compare.locationSlotEmpty': 'Ubicación {slot} — usa la búsqueda o una ciudad popular',
      'compare.add': 'Añadir', 'compare.moveEarlier': 'Mover antes',
      'compare.moveLater': 'Mover después', 'compare.removeCity': 'Quitar {city} de la comparación',
      'compare.clearSlot': 'Borrar esta ubicación', 'compare.unknownLocation': 'Ubicación desconocida',
      'compare.selectedLocation': 'Ubicación seleccionada', 'compare.locationFallback': 'Ubicación',
      'compare.weatherUnavailable': 'Tiempo no disponible', 'compare.tryAgain': 'Intentar de nuevo',
      'compare.highest': 'más alto', 'compare.lowest': 'más bajo',
      'compare.freshness': 'Última lectura: {label}',
      'compare.needTwoLocations': 'Se necesitan al menos dos ubicaciones con datos en directo para comparar.',
      'compare.verySimilar': 'Estas ubicaciones son muy parecidas; no destaca ninguna diferencia.',
      'compare.duplicate': '{city} ya está en la comparación.',
      'compare.listFull': 'Puedes comparar hasta {max} ubicaciones. Quita una para añadir otra.',
      'compare.couldNotAdd': 'No se pudo añadir esa ubicación a la comparación.',
      'compare.changeLocation': '{city}, {meta}. Cambiar esta ubicación.',
      'compare.retryAria': 'Volver a cargar el tiempo de {city}',
      'compare.thisLocation': 'esta ubicación',
      'compare.ariaExtreme': '{value}, {word} de las ubicaciones comparadas',
      'compare.ariaExtremeTitle': '{word} para {row}',
      'compare.replacing': 'Elige una ubicación nueva para la posición {slot} (ahora {city}). Pulsa Escape para cancelar.',
      'compare.noResults': 'No hay resultados para "{query}". Prueba otra escritura o añade el país.',
      'compare.searchTimedOut': 'La búsqueda de ubicaciones ha agotado el tiempo. Comprueba la conexión e inténtalo de nuevo.',
      'compare.searchFailed': 'No se pudo buscar la ubicación. Inténtalo de nuevo.',
      'compare.locationZone': 'Zona horaria local {zone}, {diff}',
      'glance.heading': 'Hoy de un vistazo', 'glance.feelsLike': 'Sensación térmica',
      'glance.verdictLabel': 'El pronóstico de hoy:', 'glance.whatToWear': 'Qué ponerse:',
      'hero.feelsLike': 'Sensación térmica', 'hero.shareAria': 'Compartir el tiempo',
      'hero.refreshAria': 'Actualizar datos meteorológicos', 'metrics.aria': 'Métricas meteorológicas clave',
      'metrics.heading': 'Condiciones actuales', 'metrics.humidity': 'Humedad',
      'metrics.wind': 'Viento', 'metrics.uvIndex': 'Índice UV', 'metrics.pressure': 'Presión',
      'metrics.precipitation': 'Precipitaciones', 'metrics.localTime': 'Hora local',
      'metrics.sunriseSunset': 'Amanecer y atardecer', 'metrics.sunrise': 'Amanecer',
      'metrics.sunset': 'Atardecer', 'metrics.cloudCover': 'Nubosidad: {value}%',
      'metrics.humidityDry': 'Ambiente seco', 'metrics.humidityComfortable': 'Humedad agradable',
      'metrics.humidityHigh': 'Humedad alta', 'metrics.pressureNormal': 'Presión normal',
      'metrics.pressureHigh': 'Alta presión', 'metrics.pressureLow': 'Baja presión',
      'metrics.uvLow': 'Bajo', 'metrics.uvModerate': 'Moderado', 'metrics.uvHigh': 'Alto',
      'metrics.uvVeryHigh': 'Muy alto', 'metrics.uvExtreme': 'Extremo',
      'metrics.uvAdviceLow': 'Riesgo bajo de daño solar',
      'metrics.uvAdviceModerate': 'Se recomienda protección solar',
      'metrics.uvAdviceHigh': 'Usa sombrero y protector solar',
      'metrics.uvAdviceVeryHigh': 'Evita el sol al mediodía',
      'metrics.uvAdviceExtreme': 'Toma todas las precauciones frente al sol',
      'forecast.hourlyHeading': 'Previsión de 24 horas', 'forecast.hourlySubtitle': 'Previsión horaria local ·',
      'forecast.dailyHeading': 'Previsión de 7 días', 'forecast.dailySubtitle': 'Próximos días ·',
      'forecast.cityTime': 'hora local', 'forecast.hourlyAria': 'Previsión meteorológica por horas',
      'forecast.now': 'Ahora', 'forecast.today': 'Hoy', 'forecast.maxUvTitle': 'Índice UV máximo',
      'forecast.precipChanceTitle': 'Probabilidad de precipitaciones',
      'popular.label': 'Populares:', 'footer.providedBy': 'Datos proporcionados por {link}',
      'footer.tagline': 'Información meteorológica global en tiempo real',
      'footer.timezoneNote': 'Las horas locales usan la zona IANA de cada ciudad y se actualizan en tiempo real · Tu zona de referencia es {zone}',
      'time.sameAsYou': 'La misma hora que tú', 'time.sameAsYouShort': 'Misma hora',
      'time.aheadOf': '{value} por delante de ti', 'time.behind': '{value} por detrás de ti',
      'time.detectedZone': 'Zona horaria detectada: {zone}',
      'time.localTimeAria': 'Tu hora local, detectada mediante la zona horaria {zone}',
      'time.youClock': 'Tú {time}', 'time.yourZoneTitle': 'Tu zona horaria: {zone}',
      'time.allTimesIn': 'Todas las horas en {zone}', 'nav.detectedLocation': 'Ubicación detectada',
      'nav.yourIP': 'Tu IP', 'nav.countryCity': '{country}, {city}',
      'time.offsetVsYou': 'Diferencia respecto a ti ({zone}): {value}',
      'time.freshnessNow': 'Actualizado ahora', 'time.freshnessMinutes': 'Actualizado hace {count} min',
      'time.freshnessHours': 'Actualizado hace {count} hora', 'time.freshnessHoursPlural': 'Actualizado hace {count} horas',
      'time.freshnessDays': 'Actualizado hace {count} día', 'time.freshnessDaysPlural': 'Actualizado hace {count} días',
      'share.forecast': 'Previsión compartida', 'share.showAllCards': 'Mostrar todas las tarjetas',
      'share.button': 'Compartir el tiempo', 'share.weatherIn': 'El tiempo en {place}',
      'share.rain': '{value}% de lluvia', 'share.high': 'Máxima {value}', 'share.low': 'Mínima {value}',
      'share.copied': 'Enlace copiado. Al abrirlo se mostrará {place} con las tarjetas compartidas.',
      'share.copyFailedInBar': 'No se pudo copiar automáticamente. El enlace de {place} está en la barra de direcciones.',
      'share.copyFailed': 'No se pudo copiar automáticamente. Copia el enlace de la barra de direcciones para compartir esta previsión.',
      'wmo.0': 'Cielo despejado', 'wmo.1': 'Mayormente despejado', 'wmo.2': 'Parcialmente nuboso',
      'wmo.3': 'Cubierto', 'wmo.45': 'Niebla', 'wmo.48': 'Niebla engelante',
      'wmo.51': 'Llovizna ligera', 'wmo.53': 'Llovizna moderada', 'wmo.55': 'Llovizna intensa',
      'wmo.56': 'Llovizna engelante', 'wmo.57': 'Llovizna engelante intensa',
      'wmo.61': 'Lluvia ligera', 'wmo.63': 'Lluvia moderada', 'wmo.65': 'Lluvia intensa',
      'wmo.66': 'Lluvia engelante', 'wmo.67': 'Lluvia engelante intensa',
      'wmo.71': 'Nevada ligera', 'wmo.73': 'Nevada moderada', 'wmo.75': 'Nevada intensa',
      'wmo.77': 'Granos de nieve', 'wmo.80': 'Chubascos ligeros', 'wmo.81': 'Chubascos moderados',
      'wmo.82': 'Chubascos violentos', 'wmo.85': 'Chubascos de nieve', 'wmo.86': 'Fuertes chubascos de nieve',
      'wmo.95': 'Tormenta', 'wmo.96': 'Tormenta con granizo', 'wmo.99': 'Tormenta fuerte con granizo',
      'wmo.unknown': 'Despejado',
      'glanceEngine.storm': 'Se esperan tormentas', 'glanceEngine.snow': 'Hoy nevará',
      'glanceEngine.freezing': 'Frío glacial', 'glanceEngine.hot': 'Mucho calor',
      'glanceEngine.umbrella': 'Se recomienda llevar paraguas', 'glanceEngine.gale': 'Mucho viento',
      'glanceEngine.good': 'Buen tiempo', 'glanceEngine.around': ' alrededor de las {time}',
      'glanceEngine.at': ' a las {time}',
      'glanceEngine.detailStorm': 'Se prevén tormentas{when}; podrían interrumpir los planes al aire libre.',
      'glanceEngine.detailSnow': 'Se espera nieve{when}; reserva más tiempo para desplazarte.',
      'glanceEngine.detailFreezing': 'Sensación térmica de {temp}{when}; necesitarás ropa de abrigo.',
      'glanceEngine.detailHot': 'Sensación térmica de {temp}{when}; busca la sombra y bebe agua.',
      'glanceEngine.detailRainNow': 'Está lloviendo ahora ({amount} en la última hora).',
      'glanceEngine.detailRainNowShort': 'Está lloviendo ahora.',
      'glanceEngine.detailRainPeak': 'La lluvia alcanzará su punto máximo en {value}{when}.',
      'glanceEngine.detailLightPrecip': 'Hoy se esperan precipitaciones ligeras.',
      'glanceEngine.detailWinds': 'Hoy el viento alcanzará {value}; hará bastante viento.',
      'glanceEngine.detailVeryWindy': 'Hoy hará mucho viento.',
      'glanceEngine.detailMostlyDry': 'Mayormente seco', 'glanceEngine.detailDry': 'Seco',
      'glanceEngine.detailComfortable': 'y agradable, alrededor de {value}',
      'glanceEngine.detailWithWind': 'con {value}', 'glanceEngine.windLight': 'viento ligero',
      'glanceEngine.windBreeze': 'una brisa', 'glanceEngine.windStrong': 'viento fuerte',
      'glanceEngine.windVeryStrong': 'viento muy fuerte', 'glanceEngine.metricRain': 'Lluvia',
      'glanceEngine.metricWind': 'Viento', 'glanceEngine.metricHumidity': 'Humedad',
      'glanceEngine.hintPeakToday': 'probabilidad máxima de hoy', 'glanceEngine.hintNotReported': 'sin datos',
      'glanceEngine.hintRelativeHumidity': 'humedad relativa',
      'compareEngine.metricCondition': 'Tiempo', 'compareEngine.metricTemperature': 'Temperatura',
      'compareEngine.metricApparent': 'Sensación térmica', 'compareEngine.metricRainChance': 'Probabilidad de lluvia',
      'compareEngine.metricWind': 'Viento', 'compareEngine.metricPressure': 'Presión',
      'compareEngine.metricCloudCover': 'Nubosidad', 'compareEngine.metricSun': 'Amanecer / atardecer',
      'compareEngine.metricPrecipitation': 'Precipitaciones', 'compareEngine.metricUv': 'Índice UV',
      'compareEngine.metricMaxUv': 'UV máximo', 'compareEngine.metricMaxWind': 'Viento máximo',
      'compareEngine.warmer': 'más cálido', 'compareEngine.cooler': 'más fresco',
      'compareEngine.insightTemperature': 'En {city} hace {gap} {word} que en {other}.',
      'compareEngine.insightApparent': 'La sensación térmica en {city} es {gap} {word} que en {other}.',
      'compareEngine.insightRain': '{city} tiene menos probabilidad de lluvia ({low} frente a {high}).',
      'compareEngine.insightWind': 'El viento en {city} es {gap} más fuerte que en {other}.',
      'compareEngine.insightPressure': 'La presión en {city} es {gap} más alta que en {other}.',
      'compareEngine.insightCloud': 'En {city} hay {gap} más nubosidad que en {other}.',
      'compareEngine.insightSun': 'El sol sale {gap} antes en {city} que en {other}.',
      'compareEngine.insightPrecip': 'En {city} hay {gap} precipitaciones más que en {other}.',
      'compareEngine.insightUv': 'El índice UV en {city} es {gap} más alto que en {other}.',
      'compareEngine.insightMaxUv': 'El índice UV máximo de hoy en {city} es {gap} más alto que en {other}.',
      'compareEngine.insightMaxWind': 'El viento más fuerte de hoy en {city} es {gap} más rápido que en {other}.',
      'compareEngine.gapWarmer': ' más cálido', 'compareEngine.gapCooler': ' más fresco',
      'compareEngine.gapStronger': ' más fuerte', 'compareEngine.gapHigher': ' más alto',
      'compareEngine.gapCloudier': ' más nuboso', 'compareEngine.gapEarlier': ' antes',
      'compareEngine.gapMore': ' más', 'compareEngine.gapFaster': ' más rápido',
      'assistant.heading': 'Consejos para hoy', 'assistant.scopeToday': 'Según lo que queda del día',
      'assistant.scopeNext24': 'Según las próximas 24 horas', 'assistant.preparing': 'Preparando tu previsión…',
      'assistant.windowTitle': '¿Lloverá durante…?', 'assistant.windowTitlePlain': '¿Lloverá durante...?',
      'adviceEngine.windowMorning': 'Mañana', 'adviceEngine.windowMidday': 'Mediodía',
      'adviceEngine.windowAfternoon': 'Tarde', 'adviceEngine.windowEvening': 'Noche',
      'adviceEngine.phraseMorning': 'la mañana', 'adviceEngine.phraseMidday': 'las horas del mediodía',
      'adviceEngine.phraseAfternoon': 'la tarde', 'adviceEngine.phraseEvening': 'la noche',
      'adviceEngine.tileUmbrella': 'Paraguas', 'adviceEngine.tileWalk': 'Paseo',
      'adviceEngine.tileCarWash': 'Lavar el coche', 'adviceEngine.tileCycling': 'Ciclismo',
      'adviceEngine.tileSwimming': 'Natación', 'adviceEngine.tileClothing': 'Qué ponerse',
      'adviceEngine.summaryLabel': 'Consejos para hoy', 'adviceEngine.scopeToday': 'lo que queda de hoy',
      'adviceEngine.scopeNext24': 'las próximas 24 horas',
      'adviceEngine.notEnoughTitle': 'No hay suficientes datos de previsión',
      'adviceEngine.notEnoughDetail': 'Este consejo necesita datos horarios que no están disponibles ahora.',
      'adviceEngine.noHourly': 'No hay datos horarios utilizables.',
      'adviceEngine.noPrecip': 'La previsión de esta ciudad no incluye probabilidad ni cantidad de precipitación.',
      'adviceEngine.noTemperatures': 'No hay temperaturas horarias utilizables.',
      'adviceEngine.noStretch': 'No hay suficientes temperaturas horarias para comparar un tramo del día.',
      'adviceEngine.noDaylight': 'No hay temperatura horaria disponible durante las horas de luz.',
      'adviceEngine.noPeriodTemp': 'No hay temperatura horaria disponible para este periodo.',
      'adviceEngine.notCalculated': 'No se pudo calcular este consejo con la previsión actual.',
      'adviceEngine.summaryNotCalculated': 'No se pudo calcular este resumen con la previsión actual.',
      'adviceEngine.umbrellaDefinitely': 'Lleva un paraguas sin falta',
      'adviceEngine.umbrellaLikely': 'Lleva un paraguas', 'adviceEngine.umbrellaUnlikely': 'Probablemente no',
      'adviceEngine.walkNone': 'Hoy no hay un periodo ideal',
      'adviceEngine.walkLimited': 'Hay pocos detalles para este periodo',
      'adviceEngine.walkReasonWind': 'hace viento',
      'adviceEngine.walkBest': 'El intervalo más seco es {window}. {reasons}',
      'adviceEngine.walkBestPlain': 'El intervalo más seco es {window}.',
      'adviceEngine.walkBut': '{detail}, pero {reasons}.',
      'adviceEngine.carWashGood': 'Buen día para lavar el coche',
      'adviceEngine.carWashBad': 'Hoy no es buen día',
      'adviceEngine.carWashRainLater': 'Se espera lluvia{when}{amount}.',
      'adviceEngine.carWashUnsettled': 'Se esperan condiciones húmedas o inestables durante todo el día.',
      'adviceEngine.carWashDrySpells': 'Los periodos secos son demasiado cortos.{hint}',
      'adviceEngine.cyclingBad': 'Hoy no es ideal para ir en bici',
      'adviceEngine.cyclingWind': 'Se esperan vientos fuertes de unos {wind}{when}.',
      'adviceEngine.cyclingRain': '{amount}', 'adviceEngine.cyclingCold': 'Hace demasiado frío para pedalear: unos {temp}.',
      'adviceEngine.cyclingHot': 'Hace mucho calor para pedalear: hasta {temp}.',
      'adviceEngine.cyclingGood': 'Buen día para ir en bici',
      'adviceEngine.cyclingGoodDetail': '{temps}seco y con vientos relativamente suaves.',
      'adviceEngine.swimBad': 'Hoy no es ideal',
      'adviceEngine.swimRain': '{amount} Mejor no meterse en el agua.',
      'adviceEngine.swimCold': 'Fresco para nadar al aire libre: como mucho, unos {temp}.',
      'adviceEngine.swimHot': 'Aire muy cálido, hasta {temp}. Busca la sombra entre baños.',
      'adviceEngine.swimGood': 'Buen tiempo para nadar al aire libre',
      'adviceEngine.swimOvercast': 'mayormente cubierto',
      'adviceEngine.clothingLight': 'Ropa ligera',
      'adviceEngine.clothingWarm': 'Cálido: unos {temp} en las horas más calurosas.',
      'adviceEngine.clothingJacketUmbrella': 'Chaqueta de abrigo y paraguas',
      'adviceEngine.clothingJacketUmbrellaDetail': 'Frío y lluvioso: unos {temp} y se espera lluvia.',
      'adviceEngine.clothingTShirtUmbrella': 'Tiempo de camiseta, pero lleva paraguas',
      'adviceEngine.clothingTShirt': 'Tiempo de camiseta',
      'adviceEngine.clothingTShirtDetail': 'Cálido y seco{wind}.',
      'adviceEngine.clothingTShirtWind': ' con poco viento',
      'adviceEngine.clothingLightJacket': 'Se recomienda una chaqueta ligera',
      'adviceEngine.clothingLightJacketDetail': 'Templado: unos {temp}.',
      'adviceEngine.clothingWarmJacket': 'Se recomienda una chaqueta de abrigo',
      'adviceEngine.clothingWarmJacketDetail': 'Fresco: unos {temp}.',
      'adviceEngine.clothingCoat': 'Se recomienda un abrigo de invierno',
      'adviceEngine.clothingCoatDetail': 'Frío: unos {temp}.',
      'adviceEngine.clothingLayers': 'Necesitarás varias capas de abrigo',
      'adviceEngine.clothingLayersDetail': 'Bajo cero: unos {temp}.',
      'adviceEngine.uvNote': ' Se recomienda protección solar.',
      'adviceEngine.swingNote': ' Hoy habrá una variación de {swing}°C.',
      'adviceEngine.windNote': ' Hace viento.', 'adviceEngine.darkNote': ' La mayor parte del periodo previsto será de noche.',
      'adviceEngine.breezeNote': ' Se espera una brisa ligera.',
      'adviceEngine.tempsNote': 'Temperaturas de unos {temp}. ',
      'adviceEngine.rainWindowPeriod': 'Se espera lluvia durante este periodo.',
      'adviceEngine.rainWindowLight': 'Es posible que haya precipitaciones ligeras durante este periodo.',
      'adviceEngine.summarySnow': 'Hoy nevará',
      'adviceEngine.summarySnowDetail': 'Se espera nieve hoy. Reserva más tiempo para desplazarte.',
      'adviceEngine.summaryStorm': 'Se esperan tormentas',
      'adviceEngine.summaryStormDetail': 'Se esperan tormentas hoy; podrían interrumpir los planes al aire libre.',
      'adviceEngine.summaryUmbrella': 'Lleva paraguas hoy',
      'adviceEngine.summaryCold': 'Hoy hace frío', 'adviceEngine.summaryHot': 'Hoy hace calor',
      'adviceEngine.summaryGreat': 'Un día estupendo para estar al aire libre',
      'adviceEngine.summaryMixed': 'Tiempo variable hoy',
      'adviceEngine.summaryMixedDetail': 'Es probable que haya intervalos inestables{when} durante {scope}.',
      'adviceEngine.summaryCloudyDry': 'Hoy estará nublado pero seco',
      'adviceEngine.summaryCloudyDryDetail': 'No se espera lluvia; unos {temp} y {wind}.',
      'adviceEngine.summaryVariableWinds': 'vientos variables',
    },
  };

  // ==========================================================================
  // Language state
  // ==========================================================================
  let current = DEFAULT_LANG;
  let persisted = null;
  const listeners = [];

  function normalize(lang) {
    if (typeof lang !== 'string') return null;
    const lower = lang.trim().toLowerCase();
    if (SUPPORTED.indexOf(lower) !== -1) return lower;
    const base = lower.split(/[-_]/)[0];
    return SUPPORTED.indexOf(base) !== -1 ? base : null;
  }

  /**
   * The language an IP country speaks, or null when it has no opinion - the
   * caller then falls through to the browser's preference rather than assuming
   * English.
   *
   * The IP services in use disagree about what a "country" looks like: some
   * answer `{"country_code":"DE"}`, some `{"country":"Germany"}`, some a
   * description already written in the visitor's own language. So all three
   * shapes are accepted, in order of how much they can be trusted:
   *
   *   1. an ISO 3166-1 alpha-2 code, which is unambiguous;
   *   2. an exact name from the table above;
   *   3. the same country named in any of the six embedded languages, resolved
   *      through `countryNameIndex`;
   *   4. a loose spelling of either - accents dropped, punctuation ignored -
   *      for the answers that arrive as "ESPANA" or "Cote d'Ivoire".
   */
  function langForCountry(countryCode) {
    if (typeof countryCode !== 'string') return null;
    const raw = countryCode.trim();
    if (!raw) return null;

    const code = raw.toUpperCase();
    // 1. ISO 3166-1 alpha-2. Not a plain early return: "UK" is two letters but
    // is not an ISO code, and it does appear in the wild, so it falls through to
    // the name lookups rather than being rejected here.
    if (/^[A-Z]{2}$/.test(code) && COUNTRY_LANGS[code]) {
      return COUNTRY_LANGS[code];
    }

    // 2. An exact name, with a trailing qualifier dropped first - services
    // return "Bolivia (Plurinational State of)" as readily as "Bolivia".
    const withoutQualifier = code.replace(/\s*\(.*\)\s*$/, '').trim();
    if (COUNTRY_NAME_LANGS[withoutQualifier]) {
      return COUNTRY_NAME_LANGS[withoutQualifier];
    }

    // 3. The country named in any embedded language.
    const localized = countryNameIndex();
    if (localized && localized[withoutQualifier]) {
      return localized[withoutQualifier];
    }

    // 4. Accents and punctuation cannot be the thing that decides a language.
    const loose = looseKey(withoutQualifier);
    if (loose) {
      if (COUNTRY_NAME_LANGS[loose]) return COUNTRY_NAME_LANGS[loose];
      if (localized && localized[loose]) return localized[loose];
    }
    return null;
  }

  /**
   * Every country in `COUNTRY_LANGS`, named in each embedded language, mapped
   * back to that country's language.
   *
   * Built from the same codes the ISO lookup uses and resolved through the same
   * table, so a localized name can never resolve to a different language than
   * the code for the same country - which is the whole failure mode of writing
   * these by hand ("Frankreich" is German for France, so it must answer `fr`,
   * not `de`).
   *
   * `Intl.DisplayNames` is present in every browser this app supports and in
   * Node's full-icu builds; where it is missing the lookup simply falls back to
   * the hand-written names.
   */
  let _countryNameIndex = null;
  function countryNameIndex() {
    if (_countryNameIndex) return _countryNameIndex;
    const index = Object.create(null);
    if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
      _countryNameIndex = index;
      return index;
    }
    SUPPORTED.forEach((lang) => {
      let display;
      try {
        display = new Intl.DisplayNames([INTL_LOCALES[lang] || lang], { type: 'region' });
      } catch (err) {
        return;
      }
      Object.keys(COUNTRY_LANGS).forEach((iso) => {
        let name;
        try {
          name = display.of(iso);
        } catch (err) {
          return;
        }
        if (typeof name !== 'string' || !name) return;
        const key = name.toUpperCase();
        // First language wins, so the two-language entries (Canada, Haiti) keep
        // a stable answer rather than depending on iteration order.
        if (!index[key]) index[key] = COUNTRY_LANGS[iso];
        const loose = looseKey(key);
        if (loose && !index[loose]) index[loose] = COUNTRY_LANGS[iso];
      });
    });
    _countryNameIndex = index;
    return index;
  }

  /**
   * A spelling-insensitive key: "ESPAÑA", "Espana" and "España." all collapse to
   * `ESPANA`, and "Côte d'Ivoire" to `COTE D IVOIRE`.
   */
  function looseKey(value) {
    if (typeof value !== 'string') return '';
    const folded = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
    return folded;
  }

  /** The supported language an IANA timezone suggests, or null. */
  function langForTimeZone(timeZone) {
    if (typeof timeZone !== 'string' || !timeZone) return null;
    const lower = timeZone.toLowerCase();
    if (lower === 'europe/athens' || lower === 'europe/nicosia') return 'el';
    if (/^(europe\/(berlin|vienna|zurich|vaduz|liechtenstein))/.test(lower)) return 'de';
    return null;
  }

  /**
   * The visitor's own choice, or null.
   *
   * Entries are a small JSON object (`{"lang":"el","v":1}`) so an auto-stamped
   * value can never be mistaken for a deliberate one: an earlier release wrote
   * the *detected* language on every single visit, which silently disabled IP
   * detection forever. Those bare codes are dropped once, on first read.
   */
  function readStorage() {
    if (!win || !win.localStorage) return null;
    let raw;
    try {
      raw = win.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      // Private mode / disabled storage: detection still works, the choice just
      // will not survive a reload.
      return null;
    }
    if (!raw) return null;

    const trimmed = String(raw).trim();
    if (trimmed.charAt(0) !== '{') {
      try {
        win.localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        /* nothing to clean up */
      }
      return null;
    }
    try {
      return normalize(JSON.parse(trimmed).lang);
    } catch (err) {
      return null;
    }
  }

  function writeStorage(lang) {
    if (!win || !win.localStorage) return;
    try {
      win.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang, v: 1 }));
    } catch (err) {
      /* storage unavailable - the choice simply is not remembered */
    }
  }

  /** `?lang=el` - an explicit, shareable override that beats stored state. */
  function langFromQuery() {
    if (!win || !win.location || !win.location.search) return null;
    try {
      const params = new URLSearchParams(win.location.search);
      return normalize(params.get('lang'));
    } catch (err) {
      return null;
    }
  }

  function detectBrowserLang() {
    if (!win || !win.navigator) return null;
    const list = Array.isArray(win.navigator.languages) ? win.navigator.languages : [];
    const candidates = list.concat([win.navigator.language]);
    for (let i = 0; i < candidates.length; i += 1) {
      const found = normalize(candidates[i]);
      if (found) return found;
    }
    return null;
  }

  function detectTimeZoneLang() {
    if (!win || !win.Intl) return null;
    try {
      return langForTimeZone(win.Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (err) {
      return null;
    }
  }

  // ==========================================================================
  // Translation lookup
  // ==========================================================================
  const INTERPOLATION = /\{(\w+)\}/g;

  function interpolate(template, vars) {
    if (!vars) return template;
    return template.replace(INTERPOLATION, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
    );
  }

  /**
   * Translate `key` into the active language, substituting `{placeholders}`.
   * Missing keys fall back to English and then to the key itself, so a gap in
   * the dictionary shows the key rather than an empty card.
   */
  function t(key, vars) {
    if (typeof key !== 'string' || !key) return '';
    const dict = translations[current] || translations[DEFAULT_LANG];
    const value = dict[key];
    if (typeof value === 'string') return interpolate(value, vars);
    const fallback = translations[DEFAULT_LANG][key];
    if (typeof fallback === 'string') return interpolate(fallback, vars);
    return key;
  }

  /** BCP-47 locale for the active language (dates, name sorting). */
  function locale() {
    return INTL_LOCALES[current] || INTL_LOCALES[DEFAULT_LANG];
  }

  // ==========================================================================
  // Markup translation
  // --------------------------------------------------------------------------
  // Attribute -> property. `data-i18n-html` is the only one that injects markup,
  // and it is reserved for strings this file itself owns (the footer's link).
  // ==========================================================================
  const ATTRIBUTES = [
    ['data-i18n', 'textContent'],
    ['data-i18n-html', 'innerHTML'],
    ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-title', 'title'],
    ['data-i18n-value', 'value'],
    ['data-i18n-content', 'content'],
  ];

  /**
   * Rewrite every annotated node under `scope` (the whole document by default).
   * Safe to call repeatedly - it is a pure function of the dictionary, which is
   * what makes it usable both on boot and after a language switch.
   */
  function applyTranslations(scope) {
    const doc = (scope && scope.querySelectorAll)
      ? scope
      : (win && win.document) || null;
    if (!doc) return;

    ATTRIBUTES.forEach(([attribute, property]) => {
      const nodes = doc.querySelectorAll(`[${attribute}]`);
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        const key = node.getAttribute(attribute);
        if (!key) continue;
        // English is resolved first so a markup default can never drift away
        // from the dictionary: if the key is missing there, the element keeps
        // exactly the text/attribute it was authored with. Only an active
        // non-English language is allowed to overwrite it.
        const english = translations[DEFAULT_LANG][key];
        if (typeof english !== 'string') continue;
        if (current !== DEFAULT_LANG) {
          const translated = translations[current] && translations[current][key];
          if (typeof translated === 'string') {
            node[property] = interpolate(translated, readVars(node));
            continue;
          }
        }
        node[property] = interpolate(english, readVars(node));
      }
    });

    if (doc.documentElement) {
      doc.documentElement.setAttribute('lang', HTML_LANGS[current] || DEFAULT_LANG);
    }
    if (doc.title) doc.title = t('app.title');
  }

  /** `data-i18n-vars='{"count":3}'` for attribute values built at runtime. */
  function readVars(node) {
    const raw = node.getAttribute && node.getAttribute('data-i18n-vars');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  // ==========================================================================
  // Change notification
  // ==========================================================================
  function onChange(handler) {
    if (typeof handler === 'function') listeners.push(handler);
    return () => {
      const index = listeners.indexOf(handler);
      if (index !== -1) listeners.splice(index, 1);
    };
  }

  function emit() {
    listeners.slice().forEach((handler) => {
      try {
        handler(current);
      } catch (err) {
        console.warn('I18n: a language-change listener failed', err);
      }
    });
  }

  // ==========================================================================
  // Public API
  // ==========================================================================
  /**
   * Switch language.
   *
   * `persist: false` is what boot-time detection uses: it repaints in the
   * detected language without overwriting a choice the visitor already made.
   */
  function setLanguage(lang, options) {
    const next = normalize(lang);
    if (!next) return current;
    const opts = options || {};
    const changed = next !== current;

    current = next;
    if (opts.persist !== false) writeStorage(next);
    else persisted = readStorage();

    applyTranslations(opts.scope || null);
    if (changed) emit();
    return current;
  }

  function getLanguage() {
    return current;
  }

  /** Restore the query-string override or the stored choice. */
  function init() {
    const query = langFromQuery();
    if (query) {
      // A shareable `?lang=` link is a one-off override, not a click: it must
      // not be persisted, otherwise opening such a link once would disable IP
      // detection for every later visit.
      setLanguage(query, { persist: false });
      return current;
    }
    persisted = readStorage();
    current = persisted || DEFAULT_LANG;
    applyTranslations();
    return current;
  }

  // ==========================================================================
  // IP geolocation
  // --------------------------------------------------------------------------
  // Race several independent, key-free HTTPS endpoints and take the first
  // answer. All of them are CORS-enabled and none may block the page: the whole
  // lookup is bounded by GEO_TIMEOUT. An unsupported country or failed lookup
  // uses English; browser locale and timezone do not override the IP result.
  // ==========================================================================
  const GEO_TIMEOUT = 5000;

  const GEO_ENDPOINTS = [
    {
      url: 'https://ipwho.is/',
      parse: (body) => {
        const data = JSON.parse(body);
        if (data && data.success !== false) {
          return { country: data.country_code, ip: data.ip, city: data.city };
        }
        return { country: null, ip: null, city: null };
      },
    },
    {
      url: 'https://api.country.is/',
      parse: (body) => {
        const data = JSON.parse(body);
        return { country: data ? data.country : null, ip: null, city: null };
      },
    },
    {
      url: 'https://get.geojs.io/v1/ip/country.json',
      parse: (body) => {
        const data = JSON.parse(body);
        return { country: data ? data.country : null, ip: null, city: null };
      },
    },
    {
      url: 'https://ipinfo.io/json',
      parse: (body) => {
        const data = JSON.parse(body);
        return { country: data && data.country ? data.country : null, ip: data.ip, city: data.city };
      },
    },
    {
      url: 'https://ipapi.co/json/',
      parse: (body) => {
        const data = JSON.parse(body);
        return { country: data && data.country_code, ip: data && data.ip, city: data && data.city };
      },
    },
  ];

  function validIp(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const ip = value.trim();
    // Validate with the platform URL parser, which accepts both IPv4 and IPv6.
    try {
      const hostname = new URL(`http://${ip}/`).hostname;
      const normalizedHost = hostname.replace(/^\[|\]$/g, '').toLowerCase();
      if (!normalizedHost || normalizedHost !== ip.toLowerCase()) return null;
      return ip;
    } catch (err) {
      return null;
    }
  }

  function fetchGeoInfo(endpoint) {
    const fetchImpl = win && typeof win.fetch === 'function'
      ? win.fetch.bind(win)
      : (typeof fetch === 'function' ? fetch : null);
    if (!fetchImpl) return Promise.reject(new Error('fetch unavailable'));

    const hasAbortController = typeof AbortController === 'function';
    const controller = hasAbortController ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), GEO_TIMEOUT) : null;

    const opts = {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
    };
    if (controller) opts.signal = controller.signal;

    const fetchPromise = fetchImpl(endpoint.url, opts)
      .then((response) => {
        if (!response || !response.ok) throw new Error('geo request failed');
        return response.text();
      })
      .then((body) => {
        const result = endpoint.parse(body);
        if (!result || !result.country) throw new Error('geo response unparseable');
        const country = String(result.country).trim();
        const countryUpper = country.toUpperCase();
        // Accept either 2-letter code or full country name
        const isValidCode = /^[A-Z]{2}$/i.test(country);
        const isValidName = country.length > 2; // Heuristic for full names
        if (!isValidCode && !isValidName) throw new Error('invalid country code');
        return { ...result, country: countryUpper, ip: validIp(result.ip), city: typeof result.city === 'string' ? result.city.trim() || null : null };
      });

    if (!hasAbortController) {
      return Promise.race([
        fetchPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('geo timeout')), GEO_TIMEOUT)),
      ]).finally(() => {
        if (timer) clearTimeout(timer);
      });
    }

    return fetchPromise.finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  /**
   * Resolve the language for a first-time visitor.
   *
   * Order: `?lang=` -> stored choice -> IP country dictionary -> English.
   * The IP step races the key-free HTTPS endpoints and takes the first country
   * result (preferring one that also includes IP and city). A country without
   * a matching dictionary and a failed lookup both fall back to English.
   * Returns the language *and* how it was found, so callers can explain a
   * choice instead of silently overriding it.
   */
  function detectLanguage() {
    const query = langFromQuery();
    const stored = readStorage();
    const preferred = query || stored;
    const preferredSource = query ? 'query' : 'stored';
    return raceIpLanguage()
      .then((info) => preferred
        ? { ...info, lang: preferred, source: preferredSource }
        : { ...info, lang: info.lang || DEFAULT_LANG, source: info.lang ? 'ip' : 'default' })
      .catch(() => preferred
        ? { lang: preferred, source: preferredSource, ip: null, city: null, country: null }
        : fallbackLang());
  }

  /**
   * Prefer a complete IP/city response, then fall back to any valid country response.
   *
   * Every attempt is consumed by exactly one branch, so a slow or blocked
   * endpoint can never leave an unhandled rejection behind - which would have
   * logged a scary error on every page load for anyone whose fourth provider
   * is rate-limiting.
   * Returns { lang, ip, city, country } or throws when all providers fail.
   */
  function raceIpLanguage() {
    const attempts = GEO_ENDPOINTS.map((endpoint) => fetchGeoInfo(endpoint).then((info) => {
      const lang = langForCountry(info.country);
      return { lang, ip: info.ip, city: info.city, country: info.country };
    }));

    // Prefer a complete location (IP + country + city). In particular, do not
    // let a fast country-only provider win while a richer provider is running.
    const complete = attempts.map((attempt) => attempt.then((info) => {
      if (!info.ip || !info.city || !info.country) throw new Error('incomplete geo result');
      return info;
    }));
    return firstFulfilled(complete).catch(() => firstFulfilled(attempts));
  }

  function firstFulfilled(promises) {
    if (typeof Promise.any === 'function') return Promise.any(promises);
    if (typeof Promise.allSettled === 'function') {
      return Promise.allSettled(promises).then((results) => {
        const hit = results.find((result) => result.status === 'fulfilled');
        if (!hit) throw new Error('geo unavailable');
        return hit.value;
      });
    }
    return Promise.reject(new Error('geo unavailable'));
  }

  /** An unavailable IP lookup always uses the English default. */
  function fallbackLang() {
    return { lang: DEFAULT_LANG, source: 'default', ip: null, city: null, country: null };
  }

  // ==========================================================================
  // Translation tables exposed for the engines
  // --------------------------------------------------------------------------
  // The pure engines must stay deterministic and testable in plain Node, so they
  // never reach for `window`. app.js hands them these flat tables instead.
  // ==========================================================================

  /** Condition label for a WMO code, in the active language. */
  function conditionLabel(code) {
    const active = translations[current] || translations[DEFAULT_LANG];
    const key = active[`wmo.${code}`];
    return typeof key === 'string' ? key : t('wmo.unknown');
  }

  /** The translator function an engine receives as `options.t`. */
  function translator() {
    return t;
  }

  /** A structured clone of the active dictionary, for engines that want it. */
  function dictionary(lang) {
    return translations[normalize(lang) || current] || translations[DEFAULT_LANG];
  }

  return {
    SUPPORTED,
    DEFAULT_LANG,
    STORAGE_KEY,
    translations,
    t,
    locale,
    getLanguage,
    setLanguage,
    init,
    applyTranslations,
    detectLanguage,
    onChange,
    normalize,
    langForCountry,
    langForTimeZone,
    conditionLabel,
    translator,
    dictionary,
  };
});
