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
    sortOrder: 'temp-desc',
  };

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

  // ==========================================================================
  // API Calls
  // ==========================================================================
  async function searchCities(query) {
    if (!query || query.trim().length < 2) return [];
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding search failed');
    const data = await res.json();
    return data.results || [];
  }

  async function fetchWeatherData(lat, lon, timezone = 'auto') {
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

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!res.ok) throw new Error('Weather forecast request failed');
    return await res.json();
  }

  /**
   * Batch fetch current weather for all worldwide benchmark cities
   * Cached for 5 minutes in memory to ensure sub-millisecond responses
   */
  async function fetchGlobalCitiesWeather() {
    const now = Date.now();
    if (state.globalWeatherData && now - state.globalCacheTimestamp < 5 * 60 * 1000) {
      return state.globalWeatherData;
    }

    const lats = WORLD_CITIES.map((c) => c.latitude).join(',');
    const lons = WORLD_CITIES.map((c) => c.longitude).join(',');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Global cities forecast batch query failed');
    const rawList = await res.json();

    const dataList = Array.isArray(rawList) ? rawList : [rawList];

    state.globalWeatherData = WORLD_CITIES.map((city, idx) => {
      const forecast = dataList[idx] || {};
      return {
        city: city,
        current: forecast.current || {},
      };
    });

    state.globalCacheTimestamp = now;
    return state.globalWeatherData;
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
      tokens: [],
    };

    const combined = `${queryStr || ''} ${presetTags.join(' ')}`.toLowerCase();

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
    if (/windy|breeze/i.test(combined)) {
      criteria.minWind = 20;
      criteria.tokens.push('💨 Windy (>20 km/h)');
    }

    // Check Temperature Descriptors
    if (/hot/i.test(combined)) {
      criteria.tempMin = Math.max(criteria.tempMin || -100, 28);
      criteria.tokens.push('🌴 Hot (>28°C)');
    } else if (/warm/i.test(combined)) {
      criteria.tempMin = Math.max(criteria.tempMin || -100, 20);
      criteria.tempMax = Math.min(criteria.tempMax || 100, 28);
      criteria.tokens.push('🏖️ Warm (20-28°C)');
    } else if (/mild|pleasant/i.test(combined)) {
      criteria.tempMin = Math.max(criteria.tempMin || -100, 14);
      criteria.tempMax = Math.min(criteria.tempMax || 100, 20);
      criteria.tokens.push('🧣 Mild (14-20°C)');
    } else if (/cool/i.test(combined)) {
      criteria.tempMin = Math.max(criteria.tempMin || -100, 8);
      criteria.tempMax = Math.min(criteria.tempMax || 100, 14);
      criteria.tokens.push('🧥 Cool (8-14°C)');
    } else if (/cold/i.test(combined)) {
      criteria.tempMax = Math.min(criteria.tempMax || 100, 12);
      criteria.tokens.push('🥶 Cold (<12°C)');
    } else if (/freezing/i.test(combined)) {
      criteria.tempMax = Math.min(criteria.tempMax || 100, 2);
      criteria.tokens.push('🧊 Freezing (≤2°C)');
    }

    // Explicit Numerical Expressions
    // e.g. "> 25", ">= 20", "< 15", "20-25"
    const rangeMatch = combined.match(/(\d+)\s*(?:-|to)\s*(\d+)/i);
    if (rangeMatch) {
      const minNum = parseFloat(rangeMatch[1]);
      const maxNum = parseFloat(rangeMatch[2]);
      criteria.tempMin = Math.min(minNum, maxNum);
      criteria.tempMax = Math.max(minNum, maxNum);
      criteria.tokens.push(`${criteria.tempMin}° - ${criteria.tempMax}°`);
    } else {
      const greaterMatch = combined.match(/(?:>|>=|above|warmer than)\s*(-?\d+)/i);
      if (greaterMatch) {
        criteria.tempMin = parseFloat(greaterMatch[1]);
        criteria.tokens.push(`> ${criteria.tempMin}°`);
      }
      const lesserMatch = combined.match(/(?:<|<=|below|colder than)\s*(-?\d+)/i);
      if (lesserMatch) {
        criteria.tempMax = parseFloat(lesserMatch[1]);
        criteria.tokens.push(`< ${criteria.tempMax}°`);
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

    // 5. Raw Query Fallback Check
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

    document.body.className = themeClass;
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

      const row = document.createElement('div');
      row.className = 'daily-row';
      row.innerHTML = `
        <div class="daily-day-col">
          <span class="daily-day-name">${dayName}</span>
          <span class="daily-date">${monthDay}</span>
        </div>
        <div class="daily-icon-col">
          ${getWeatherSvg(condition.icon, 1)}
        </div>
        <div class="daily-condition-label">${condition.label}</div>
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

    // Active tags
    elements.climateActiveTags.innerHTML = '';
    criteria.tokens.forEach((token) => {
      const tag = document.createElement('span');
      tag.className = 'active-tag';
      tag.textContent = token;
      elements.climateActiveTags.appendChild(tag);
    });

    // Sort entries according to current selection
    const sorted = [...matchingEntries].sort((a, b) => {
      const tempA = a.current.temperature_2m ?? -999;
      const tempB = b.current.temperature_2m ?? -999;
      if (state.sortOrder === 'temp-desc') return tempB - tempA;
      if (state.sortOrder === 'temp-asc') return tempA - tempB;
      if (state.sortOrder === 'name-asc') return a.city.name.localeCompare(b.city.name);
      return 0;
    });

    elements.climateResultsGrid.innerHTML = '';

    if (sorted.length === 0) {
      elements.climateResultsGrid.innerHTML = `
        <div class="climate-empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto; color: var(--text-muted);">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 15h8M9 9h.01M15 9h.01"/>
          </svg>
          <p>No world cities currently match this exact climate criteria.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Try searching for a broader condition like "Sunny", "Warm", or "Cloudy".</p>
        </div>
      `;
    } else {
      sorted.forEach((entry) => {
        const city = entry.city;
        const current = entry.current;
        const condition = WMO_MAP[current.weather_code] || { label: 'Clear', icon: 'clear' };

        const card = document.createElement('div');
        card.className = 'city-result-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `View weather for ${city.name}, ${city.country}`);

        card.innerHTML = `
          <div class="city-result-top">
            <div>
              <h3 class="city-result-name">${city.name}</h3>
              <p class="city-result-country">${city.admin1 ? city.admin1 + ', ' : ''}${city.country}</p>
            </div>
          </div>

          <div class="city-result-middle">
            <div class="city-result-temp-group">
              <span class="city-result-temp">${formatTemp(current.temperature_2m)}</span>
              <span class="city-result-temp-unit">${getTempUnitSymbol()}</span>
            </div>
            <div class="city-result-icon">
              ${getWeatherSvg(condition.icon, current.is_day)}
            </div>
          </div>

          <div class="city-result-condition">
            <span>${condition.label}</span>
          </div>

          <div class="city-result-stats">
            <div class="city-result-stat-item" title="Relative Humidity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
              <span>${current.relative_humidity_2m ?? '--'}%</span>
            </div>
            <div class="city-result-stat-item" title="Wind Speed">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2"/>
              </svg>
              <span>${formatWindSpeed(current.wind_speed_10m)} ${getWindUnitSymbol()}</span>
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

        // Click handler to view full city weather
        const handleCitySelect = () => {
          loadCityWeather(city);
        };

        card.addEventListener('click', handleCitySelect);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCitySelect();
          }
        });

        elements.climateResultsGrid.appendChild(card);
      });
    }

    elements.climateResultsSection.classList.remove('hidden');
  }

  // ==========================================================================
  // Core Controller Actions
  // ==========================================================================
  async function loadCityWeather(city) {
    if (!city || !city.latitude || !city.longitude) return;

    elements.dashboard.classList.add('hidden');
    elements.climateResultsSection.classList.add('hidden');
    elements.errorState.classList.add('hidden');
    elements.loadingText.textContent = `Fetching live weather for ${city.name}...`;
    elements.loadingState.classList.remove('hidden');

    closeAutocomplete();

    try {
      const weatherData = await fetchWeatherData(city.latitude, city.longitude, city.timezone);
      state.currentCity = city;
      state.weatherData = weatherData;

      localStorage.setItem('skycast_last_city', JSON.stringify(city));

      elements.searchInput.value = city.name;
      elements.clearBtn.classList.remove('hidden');

      renderWeather();
    } catch (err) {
      console.error('Weather load error:', err);
      showError('Weather Data Unavailable', `Could not fetch weather for "${city.name}". Please check your internet connection and try again.`);
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
      state.activeClimateQuery = queryStr || '';

      const matching = allCityForecasts.filter((entry) => matchesClimateCriteria(entry, criteria));

      renderClimateResults(matching, criteria);
    } catch (err) {
      console.error('Climate search error:', err);
      showError('Climate Search Error', 'Failed to retrieve global meteorological data. Please try again.');
    }
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
        showError('City Not Found', `No results found for "${cityName}". Try searching with a different spelling or adding a country.`);
        return;
      }
      loadCityWeather(cities[0]);
    } catch (err) {
      console.error('Search error:', err);
      showError('Search Failed', 'An error occurred while searching for the city. Please try again.');
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
  }

  function showAutocomplete(results) {
    if (!results || results.length === 0) {
      closeAutocomplete();
      return;
    }

    elements.autocompleteList.innerHTML = '';
    results.forEach((city) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.setAttribute('role', 'option');

      const metaParts = [];
      if (city.admin1) metaParts.push(city.admin1);
      if (city.country) metaParts.push(city.country);

      item.innerHTML = `
        <span class="autocomplete-item-name">${city.name}</span>
        <span class="autocomplete-item-meta">${metaParts.join(', ')}</span>
      `;

      item.addEventListener('click', () => {
        loadCityWeather(city);
      });

      elements.autocompleteList.appendChild(item);
    });

    elements.autocompleteList.classList.remove('hidden');
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
      }
      closeAutocomplete();
    }

    elements.tabModeCity.addEventListener('click', () => setMode('city'));
    elements.tabModeClimate.addEventListener('click', () => setMode('climate'));

    // Form submit
    elements.searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      closeAutocomplete();
      const query = elements.searchInput.value.trim();
      if (!query) return;

      if (state.searchMode === 'climate') {
        handleClimateSearch(query);
      } else {
        handleCitySearch(query);
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

      if (state.searchMode === 'climate') {
        // In climate mode, autocomplete can show quick climate options
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => {
          const suggestions = [
            { name: `☀️ Cities with "${val}" weather`, isClimate: true },
            { name: `🌴 Warm/Hot cities matching "${val}"`, isClimate: true },
          ];
          elements.autocompleteList.innerHTML = `
            <div class="autocomplete-item" id="climate-suggest-item">
              <span class="autocomplete-item-name">Search worldwide cities matching "${val}" →</span>
              <span class="autocomplete-item-meta">Climate Discovery</span>
            </div>
          `;
          document.getElementById('climate-suggest-item').addEventListener('click', () => {
            handleClimateSearch(val);
          });
          elements.autocompleteList.classList.remove('hidden');
        }, 250);
        return;
      }

      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(async () => {
        try {
          const results = await searchCities(val);
          showAutocomplete(results);
        } catch (err) {
          console.error(err);
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
      if (chip && chip.dataset.city) {
        setMode('city');
        handleCitySearch(chip.dataset.city);
      }
    });

    // Climate Preset Chips
    elements.climateChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.climate-filter-chip');
      if (chip && chip.dataset.condition) {
        const condition = chip.dataset.condition;
        elements.searchInput.value = chip.textContent.trim();
        elements.clearBtn.classList.remove('hidden');

        // Highlight selected chip
        document.querySelectorAll('.climate-filter-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');

        handleClimateSearch('', condition);
      }
    });

    // Climate Sort dropdown
    elements.climateSortSelect.addEventListener('change', (e) => {
      state.sortOrder = e.target.value;
      if (state.matchingCities.length > 0) {
        const criteria = parseClimateCriteria(state.activeClimateQuery);
        renderClimateResults(state.matchingCities, criteria);
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

    // Temperature Unit Toggle
    function setUnit(newUnit) {
      if (state.unit === newUnit) return;
      state.unit = newUnit;
      localStorage.setItem('skycast_unit', newUnit);

      if (newUnit === 'celsius') {
        elements.unitC.classList.add('active');
        elements.unitF.classList.remove('active');
      } else {
        elements.unitF.classList.add('active');
        elements.unitC.classList.remove('active');
      }

      // Re-render dashboard or climate results immediately without refetch
      if (state.weatherData && !elements.dashboard.classList.contains('hidden')) {
        renderWeather();
      } else if (state.matchingCities.length > 0 && !elements.climateResultsSection.classList.contains('hidden')) {
        const criteria = parseClimateCriteria(state.activeClimateQuery);
        renderClimateResults(state.matchingCities, criteria);
      }
    }

    elements.unitC.addEventListener('click', () => setUnit('celsius'));
    elements.unitF.addEventListener('click', () => setUnit('fahrenheit'));
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================
  function init() {
    setupEvents();

    if (state.unit === 'fahrenheit') {
      elements.unitF.classList.add('active');
      elements.unitC.classList.remove('active');
    } else {
      elements.unitC.classList.add('active');
      elements.unitF.classList.remove('active');
    }

    // Prefetch global benchmark data in background so climate queries are instantaneous
    fetchGlobalCitiesWeather().catch((err) => console.warn('Global prefetch:', err));

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
