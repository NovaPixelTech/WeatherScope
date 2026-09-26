# SkyCast Weather 🌦️

A modern, fast, and responsive weather web application that allows you to search real-time weather conditions by **City Name** or discover worldwide cities that meet your **Preferred Climate & Weather Conditions** (e.g., Sunny, Warm, Rain, Snow, Hot > 28°C, Cold < 12°C).

Powered by the [Open-Meteo API](https://open-meteo.com/), SkyCast operates with zero API key configuration or setup friction.

---

## ✨ Features

### 🔍 Dual Search Modes
1. **City Search Mode**:
   - Real-time debounced autocomplete suggestions showing matching cities, regions, and countries.
   - Enter key or quick search for any city on Earth.
   - Quick one-click chips for popular global cities (London, New York, Tokyo, Paris, Sydney, etc.).
   - One-click GPS location detection with reverse geocoding.

2. **Climate & Weather Filter Mode (New! 🎉)**:
   - **Search by preferred climate**: Type conditions such as `"Sunny"`, `"Rain"`, `"Snow"`, `"Warm"`, `"Hot > 25°C"`, or `"Cold < 10°C"`.
   - **Quick climate presets**: One-click filter chips for *☀️ Sunny*, *⛅ Cloudy*, *🌧️ Rainy*, *❄️ Snowy*, *⚡ Storm*, *🌴 Hot (>28°C)*, *🏖️ Warm (20-28°C)*, *🧣 Mild (14-20°C)*, *🥶 Cold (<12°C)*, and *💨 Windy*.
   - **Interactive Results Grid**: Displays all matching cities around the globe with current live temperatures, weather icons, humidity, and wind speeds.
   - **Sorting options**: Sort matching cities by warmest first, coldest first, or alphabetical order.
   - **Seamless Drill-Down**: Click on any city card to instantly view its detailed real-time weather conditions, 24-hour hourly forecast, and 7-day outlook.
   - **Back Navigation**: A dedicated "Back to matching cities" bar lets you return to your filtered results anytime without losing state.

### 📊 Comprehensive Meteorological Dashboard
- **Current Conditions**:
  - Live temperature & "Feels like" reading.
  - Crisp day/night vector SVG icons.
  - Humidity level with comfort indication (*Comfortable*, *Humid*, *Dry*).
  - Wind speed & direction with rotating compass needle and cardinal direction.
  - UV Index with categorized risk badges (*Low*, *Moderate*, *High*, *Extreme*).
  - Atmospheric pressure in hPa with high/low pressure indications.
  - Real-time rainfall accumulation and cloud cover %.
  - Local sunrise and sunset times.
- **24-Hour Forecast**: Scrollable horizontal strip with hourly temperatures and precipitation probabilities.
- **7-Day Extended Forecast**: Daily outlook with normalized min/max temperature range bars.
- **Instant Unit Switching**: Toggle between Celsius (**°C**) and Fahrenheit (**°F**) with instantaneous client-side recalculation.
- **Dynamic Theming**: Background palette and glowing ambient orbs automatically adapt to the weather (Clear Day, Night, Rain, Thunderstorm, Snow, or Overcast).
- **Zero Dependencies**: Pure HTML5, CSS3, and modern Vanilla JavaScript — runs in any web browser without Node.js or build steps.

---

## 🚀 How to Run

### Method 1: Direct File Open (Easiest)
Simply double-click [`index.html`](file:///c:/Users/giong/Antigravity%20Projects/Test_001/index.html) or open it in any web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari, Brave).

### Method 2: Local HTTP Server with PowerShell
Run the included PowerShell script in your terminal:
```powershell
powershell -ExecutionPolicy Bypass -File .\start-server.ps1
```
This will start a local server at `http://127.0.0.1:3000/` and automatically launch your default browser.

---

## 📁 File Structure

```text
Test_001/
├── index.html        # Semantic HTML5 app markup with City & Climate mode switchers
├── styles.css        # Glassmorphic CSS styling, dynamic themes, climate results grid
├── app.js            # Batch climate queries, natural-language filter parser, weather controller
├── start-server.ps1  # Lightweight zero-dependency PowerShell static web server
└── README.md         # Documentation and project overview
```
