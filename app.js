/**
 * SkyCast Weather Application
 * Real-time meteorological dashboard & Global Climate Discovery Engine
 * Powered by Open-Meteo API
 */

(function () {
  'use strict';

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
  // State Management
  // ==========================================================================
  const state = {
    unit: localStorage.getItem('skycast_unit') || 'celsius', // 'celsius' or 'fahrenheit'
    searchMode: 'city', // 'city' or 'climate'
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
  };

  const THEME_CLASSES = [
    'theme-day-clear',
    'theme-night-clear',
    'theme-cloudy',
    'theme-rainy',
    'theme-thunderstorm',
    'theme-snowy',
  ];

  const GLOBAL_CACHE_KEY = 'skycast_global_cache';
  const GLOBAL_CACHE_TTL = 5 * 60 * 1000;
  const REQUEST_TIMEOUT = 12000;

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
    refreshBtn: document.getElementById('refresh-btn'),
  };

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
    if (uv <= 2) return { text: 'Low', badgeClass: 'low', advice: 'Low risk of sun damage' };
    if (uv <= 5) return { text: 'Moderate', badgeClass: 'moderate', advice: 'Sun protection advised' };
    if (uv <= 7) return { text: 'High', badgeClass: 'high', advice: 'Wear hat and sunscreen' };
    if (uv <= 10) return { text: 'Very High', badgeClass: 'very-high', advice: 'Avoid sun during midday' };
    return { text: 'Extreme', badgeClass: 'extreme', advice: 'Take full sun precautions' };
  }

  function getHumidityStatus(val) {
    if (val < 30) return 'Dry environment';
    if (val <= 60) return 'Comfortable humidity';
    return 'High humidity';
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

    if (diffMin < 1) return 'Updated just now';
    if (diffMin < 60) return `Updated ${diffMin} min ago`;
    const hours = Math.floor(diffMin / 60);
    if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
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
      hourly: ['temperature_2m', 'weather_code', 'precipitation_probability', 'is_day'].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'uv_index_max',
        'precipitation_probability_max',
      ].join(','),
      timezone: timezone,
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
      const raw = sessionStorage.getItem(GLOBAL_CACHE_KEY);
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
      sessionStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify({ timestamp, entries }));
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

  function renderWeather() {
    if (!state.weatherData || !state.currentCity) return;

    const data = state.weatherData;
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;
    const city = state.currentCity;

    // Apply Dynamic Theme
    applyTheme(current.weather_code, current.is_day);

    // City and Meta
    elements.cityName.textContent = city.name;
    const metaParts = [];
    if (city.admin1) metaParts.push(city.admin1);
    if (city.country) metaParts.push(city.country);
    elements.locationMeta.textContent = metaParts.join(', ');

    // Local Time format based on city's timezone
    try {
      const nowOptions = {
        timeZone: data.timezone || 'UTC',
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      };
      const formattedDate = new Intl.DateTimeFormat('en-US', nowOptions).format(new Date());
      elements.localTime.textContent = formattedDate;
    } catch {
      elements.localTime.textContent = current.time ? current.time.replace('T', ' ') : 'Live';
    }

    // Weather Condition
    const condition = WMO_MAP[current.weather_code] || { label: 'Clear', icon: 'clear' };
    elements.conditionText.textContent = condition.label;

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
    elements.pressureStatus.textContent = current.pressure_msl > 1015 ? 'High pressure system' : (current.pressure_msl < 1005 ? 'Low pressure system' : 'Normal pressure');

    // Cloud & Precip
    elements.precipVal.textContent = formatPrecip(current.precipitation);
    elements.precipUnitDisplay.textContent = getPrecipUnitSymbol();
    elements.cloudCoverStatus.textContent = `Cloud cover: ${Math.round(current.cloud_cover ?? 0)}%`;

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

    // Render 7-Day Forecast
    renderDailyForecast(daily);

    // Switch view to dashboard
    elements.loadingState.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.climateResultsSection.classList.add('hidden');
    elements.dashboard.classList.remove('hidden');

    // Show Back Button if user came from climate search
    if (state.matchingCities.length > 0) {
      elements.backToResultsBar.classList.remove('hidden');
      elements.backToResultsText.textContent = `Back to matching cities (${state.matchingCities.length} found)`;
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
// Climate Search Results Rendering
// ==========================================================================
  const CARD_TEMPLATE = `
    <div class="city-result-top">
      <div>
        <h3 class="city-result-name" data-ref="name"></h3>
        <p class="city-result-country" data-ref="country"></p>
      </div>
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
      };

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

    refs.card.setAttribute(
      'aria-label',
      `View weather for ${city.name}, ${city.country}. ${condition.label}, ${formatTemp(current.temperature_2m)}${getTempUnitSymbol()}.`
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
        { value: `${dimension.key}-desc`, label: `${dimension.label} (higher to lower)` },
        { value: `${dimension.key}-asc`, label: `${dimension.label} (lower to higher)` },
      ]
    );

    // Name sorting needs no filter to justify it and no reading to resolve it,
    // so it stays available for purely categorical filters (Sunny, Storm, ...)
    options.push({ value: 'name-asc', label: 'City name (A-Z)' });
    options.push({ value: 'name-desc', label: 'City name (Z-A)' });

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
    return a.city.name.localeCompare(b.city.name, 'en');
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
    elements.climateResultsTitle.textContent = 'Cities matching climate conditions';
    elements.climateResultsCount.textContent = `${matchingEntries.length} ${matchingEntries.length === 1 ? 'city' : 'cities'} found`;

    // Be explicit that results are scoped to the curated benchmark dataset
    elements.climateResultsSubtitle.textContent =
      `Searched ${WORLD_CITIES.length} benchmark cities worldwide. ` +
      'Click any city to explore its detailed real-time weather and 7-day outlook.';

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
          state.resultCards.delete(id);
        }
      });
    }

    elements.climateResultsSection.classList.remove('hidden');
  }

  // ==========================================================================
  // Core Controller Actions
  // ==========================================================================
  async function loadCityWeather(city) {
    if (!city || city.latitude === undefined || city.latitude === null || city.longitude === undefined || city.longitude === null) return;

    // Supersede any in-flight city request so a slow earlier response
    // cannot overwrite the city the user actually selected (#5)
    if (state.weatherController) state.weatherController.abort();
    const controller = new AbortController();
    state.weatherController = controller;

    elements.dashboard.classList.add('hidden');
    elements.climateResultsSection.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.loadingText.textContent = `Fetching live weather for ${city.name}...`;
    elements.loadingState.classList.remove('hidden');

    closeAutocomplete();

    try {
      const weatherData = await fetchWeatherData(city.latitude, city.longitude, city.timezone, controller.signal);
      if (controller.signal.aborted) return;

      state.currentCity = city;
      state.weatherData = weatherData;

      localStorage.setItem('skycast_last_city', JSON.stringify(city));

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
    elements.loadingText.textContent = 'Searching worldwide cities matching preferred climate...';
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
    elements.loadingText.textContent = `Searching for "${cityName}"...`;
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

      loadCityWeather(cities[0]);
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
    elements.errorState.classList.remove('hidden');
  }

  // ==========================================================================
  // Autocomplete UI Handlers
  // ==========================================================================
  function closeAutocomplete() {
    elements.autocompleteList.classList.add('hidden');
    elements.autocompleteList.innerHTML = '';
    elements.autocompleteOptions = [];
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

      item.addEventListener('click', () => {
        closeAutocomplete();
        loadCityWeather(city);
      });
      item.addEventListener('mouseenter', () => setActiveOption(idx));

      elements.autocompleteList.appendChild(item);
      elements.autocompleteOptions.push({ el: item, city });
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
    loadCityWeather(chosen.city);
    return true;
  }

  // ==========================================================================
  // Geolocation Handler
  // ==========================================================================
  async function handleGeolocation() {
    if (!navigator.geolocation) {
      showError('Geolocation Unsupported', 'Your browser does not support automatic location detection.');
      return;
    }

    elements.dashboard.classList.add('hidden');
    elements.climateResultsSection.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.loadingText.textContent = 'Detecting your geographical location...';
    elements.loadingState.classList.remove('hidden');

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

        loadCityWeather(detectedCity);
      },
      (err) => {
        console.warn('Geolocation denied or failed:', err);
        showError(
          'Location Access Denied',
          'Could not retrieve your location. Please check browser permissions or search for your city directly.'
        );
      },
      { timeout: 10000 }
    );
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  function setupEvents() {
    // Mode Switcher Tabs
    function setMode(mode) {
      state.searchMode = mode;
      if (mode === 'city') {
        elements.tabModeCity.classList.add('active');
        elements.tabModeCity.setAttribute('aria-selected', 'true');
        elements.tabModeClimate.classList.remove('active');
        elements.tabModeClimate.setAttribute('aria-selected', 'false');

        elements.searchInput.placeholder = 'Search for a city (e.g. Paris, Tokyo, New York)...';
        elements.quickCitiesContainer.classList.remove('hidden');
        elements.climateChipsContainer.classList.add('hidden');
      } else {
        elements.tabModeClimate.classList.add('active');
        elements.tabModeClimate.setAttribute('aria-selected', 'true');
        elements.tabModeCity.classList.remove('active');
        elements.tabModeCity.setAttribute('aria-selected', 'false');

        elements.searchInput.placeholder = 'Search climate: e.g. Sunny, Warm, Rain, Snow, > 25°C, Cold < 10°C...';
        elements.quickCitiesContainer.classList.add('hidden');
        elements.climateChipsContainer.classList.remove('hidden');
        elements.searchInput.focus();

        // Warm the global batch cache only when climate mode is actually used (#9)
        fetchGlobalCitiesWeather().catch((err) => console.warn('Global prefetch:', err));
      }
      closeAutocomplete();
    }

    elements.tabModeCity.addEventListener('click', () => setMode('city'));
    elements.tabModeClimate.addEventListener('click', () => setMode('climate'));

    // Form submit
    elements.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // If a suggestion is highlighted, Enter commits that suggestion
      if (state.searchMode === 'city' && commitActiveOption()) return;

      closeAutocomplete();
      const query = elements.searchInput.value.trim();
      if (!query) return;

      if (state.searchMode === 'climate') {
        handleClimateSearch(query);
      } else {
        handleCitySearch(query);
      }
    });

    // Keyboard navigation for the autocomplete listbox
    elements.searchInput.addEventListener('keydown', (e) => {
      const hasOptions = (elements.autocompleteOptions || []).length > 0;
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

      setMode('city');

      // Resolve against the local benchmark database first. Names like "Paris",
      // "Sydney" or "Rome" match several places worldwide, and going through
      // geocoding would drop the user into a disambiguation list instead of the
      // city the chip actually advertises. The bundled entry is already
      // unambiguous, so a popular chip stays genuinely one-click.
      const known = WORLD_CITIES.find(
        (city) => city.name.toLowerCase() === chip.dataset.city.trim().toLowerCase()
      );

      if (known) {
        loadCityWeather(known);
        return;
      }

      handleCitySearch(chip.dataset.city);
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

    // Temperature Unit Toggle
    function setUnit(newUnit) {
      if (state.unit === newUnit) return;
      state.unit = newUnit;
      localStorage.setItem('skycast_unit', newUnit);

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
  function init() {
    setupEvents();

    // Render the unit-aware thresholds on the preset chips before first paint
    refreshChipThresholds();

    if (state.unit === 'fahrenheit') {
      elements.unitF.classList.add('active');
      elements.unitC.classList.remove('active');
    } else {
      elements.unitC.classList.add('active');
      elements.unitF.classList.remove('active');
    }
    elements.unitC.setAttribute('aria-checked', state.unit === 'celsius' ? 'true' : 'false');
    elements.unitF.setAttribute('aria-checked', state.unit === 'fahrenheit' ? 'true' : 'false');

    // Note: the 72-city global batch is no longer prefetched on every page load.
    // It is fetched lazily the first time climate mode is used (#9).

    // Check for saved last city in localStorage
    const saved = localStorage.getItem('skycast_last_city');
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
