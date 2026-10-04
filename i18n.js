/**
 * WeatherScope - Internationalisation
 * =========================================================================
 * One dictionary, three languages (English, Greek, German), and no build step.
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
 *    2. `weatherscope_lang` in storage - the visitor's own click on EN / EL / DE
 *    3. the visitor's IP country        - a short HTTPS geo lookup
 *    4. `navigator.languages`           - the browser's own preference
 *    5. the device timezone             - a last hint, e.g. Europe/Athens
 *    6. English                         - the fallback
 *
 * Steps 3-5 are all best-effort and never block first paint: the page renders in
 * step 1/2's language immediately and is repainted if detection disagrees.
 * Once the visitor clicks a language the choice is persisted and detection is
 * never run again.
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
  const SUPPORTED = ['en', 'el', 'de'];
  const DEFAULT_LANG = 'en';

  /** BCP-47 locale used for Intl formatting (dates, name sorting). */
  const INTL_LOCALES = { en: 'en-GB', el: 'el-GR', de: 'de-DE' };

  const HTML_LANGS = { en: 'en', el: 'el', de: 'de' };

  const STORAGE_KEY = 'weatherscope_lang';

  /**
   * Country (ISO 3166-1 alpha-2) -> supported language.
   *
   * Only the countries whose language this app actually speaks are listed; every
   * other country resolves to English through `langForCountry`.
   */
  const COUNTRY_LANGS = {
    // Greek
    GR: 'el', CY: 'el',
    // German
    DE: 'de', AT: 'de', CH: 'de', LI: 'de', LU: 'de',
    // German is a recognised minority language in a few more countries
    BE: 'de', DK: 'de', NA: 'de',
  };

  /** Timezone -> language, used only when both IP and browser locale fail. */
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

  /** The supported language a country belongs to (English everywhere else). */
  function langForCountry(countryCode) {
    if (typeof countryCode !== 'string') return null;
    const code = countryCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return null;
    return COUNTRY_LANGS[code] || DEFAULT_LANG;
  }

  /** The supported language an IANA timezone suggests, or null. */
  function langForTimeZone(timeZone) {
    if (typeof timeZone !== 'string' || !timeZone) return null;
    const lower = timeZone.toLowerCase();
    if (lower === 'europe/athens' || lower === 'europe/nicosia') return 'el';
    if (/^(europe\/(berlin|vienna|zurich|vaduz|liechtenstein))/.test(lower)) return 'de';
    return null;
  }

  function readStorage() {
    if (!win || !win.localStorage) return null;
    try {
      return normalize(win.localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      // Private mode / disabled storage: detection still works, the choice just
      // will not survive a reload.
      return null;
    }
  }

  function writeStorage(lang) {
    if (!win || !win.localStorage) return;
    try {
      win.localStorage.setItem(STORAGE_KEY, lang);
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
          const translated = translations[current][key];
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
      setLanguage(query);
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
  // lookup is bounded by GEO_TIMEOUT and a failure simply falls through to the
  // browser's own language preference.
  // ==========================================================================
  const GEO_TIMEOUT = 5000;

  const GEO_ENDPOINTS = [
    {
      url: 'https://www.cloudflare.com/cdn-cgi/trace',
      parse: (body) => {
        const match = /(?:^|\n)loc=([A-Za-z]{2})(?:\n|$)/.exec(body);
        return match ? match[1].toUpperCase() : null;
      },
    },
    {
      url: 'https://ipwho.is/',
      parse: (body) => {
        const data = JSON.parse(body);
        return data && data.success !== false ? data.country_code : null;
      },
    },
    {
      url: 'https://api.country.is/',
      parse: (body) => {
        const data = JSON.parse(body);
        return data ? data.country : null;
      },
    },
    {
      url: 'https://ipapi.co/json/',
      parse: (body) => {
        const data = JSON.parse(body);
        return data ? data.country_code : null;
      },
    },
  ];

  function fetchCountry(endpoint) {
    const fetchImpl = win && typeof win.fetch === 'function'
      ? win.fetch.bind(win)
      : (typeof fetch === 'function' ? fetch : null);
    if (!fetchImpl) return Promise.reject(new Error('fetch unavailable'));
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), GEO_TIMEOUT) : null;

    return fetchImpl(endpoint.url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    })
      .then((response) => {
        if (!response || !response.ok) throw new Error('geo request failed');
        return response.text();
      })
      .then((body) => {
        const code = endpoint.parse(body);
        if (!code) throw new Error('geo response unparseable');
        return langForCountry(code);
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
      });
  }

  /**
   * Resolve the language for a first-time visitor.
   *
   * Order: `?lang=` -> stored choice -> IP country -> browser languages ->
   * device timezone -> English. The IP step races the key-free HTTPS endpoints
   * and takes the first one that actually answers; a failed, blocked, or
   * slow lookup simply falls through to the browser's own preference.
   * Returns the language *and* how it was found, so callers can explain a
   * choice instead of silently overriding it.
   */
  function detectLanguage() {
    const query = langFromQuery();
    if (query) return Promise.resolve({ lang: query, source: 'query' });

    const stored = readStorage();
    if (stored) return Promise.resolve({ lang: stored, source: 'stored' });

    const attempts = GEO_ENDPOINTS.map(fetchCountry);
    // Reject malformed/unusable responses before racing the endpoints. A valid
    // country outside the Greek/German map intentionally resolves to English.
    const supportedAttempts = attempts.map((attempt) => attempt.then((lang) => {
      if (!lang) throw new Error('geo language unavailable');
      return lang;
    }));
    const fromNetwork = typeof Promise.any === 'function'
      ? Promise.any(supportedAttempts)
      : Promise.allSettled(attempts).then(
        (results) => results.find((r) => r.status === 'fulfilled' && !!r.value) || Promise.reject(new Error('geo unavailable'))
      );

    return fromNetwork
      .then((lang) => {
        if (lang) return { lang, source: 'ip' };
        return fallbackLang();
      })
      .catch(() => fallbackLang());
  }

  /** When no IP answer arrives: browser language, then timezone, then English. */
  function fallbackLang() {
    const browser = detectBrowserLang();
    if (browser) return { lang: browser, source: 'browser' };
    const zone = detectTimeZoneLang();
    if (zone) return { lang: zone, source: 'timezone' };
    return { lang: DEFAULT_LANG, source: 'default' };
  }

  // ==========================================================================
  // Translation tables exposed for the engines
  // --------------------------------------------------------------------------
  // The pure engines must stay deterministic and testable in plain Node, so they
  // never reach for `window`. app.js hands them these flat tables instead.
  // ==========================================================================

  /** Condition label for a WMO code, in the active language. */
  function conditionLabel(code) {
    const key = translations[current][`wmo.${code}`];
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
