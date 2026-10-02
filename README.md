# SkyCast Weather 🌦️

A modern, fast, and responsive weather web application that allows you to search real-time weather conditions by **City Name** or discover worldwide cities that meet your **Preferred Climate & Weather Conditions** (e.g., Sunny, Warm, Rain, Snow, Hot > 28°C, Cold < 12°C).

Powered by the [Open-Meteo API](https://open-meteo.com/), SkyCast operates with zero API key configuration or setup friction.

---

## ✨ Features

### 🔍 Dual Search Modes
1. **City Search Mode**:
   - Real-time debounced autocomplete suggestions showing matching cities, regions, and countries.
   - Enter key or quick search for any city on Earth.
   - One-click chips for 20 popular global cities, kept in strict **A-Z order** (Athens → Tokyo) and rendered as a uniformly sized grid, so every button lines up horizontally and vertically.
   - One-click GPS location detection with reverse geocoding.

2. **Climate & Weather Filter Mode (New! 🎉)**:
   - **Search by preferred climate**: Type conditions such as `"Sunny"`, `"Rain"`, `"Snow"`, `"Warm"`, `"Hot > 25°C"`, or `"Cold < 10°C"`.
   - **20 one-click presets** (row 1 *sky conditions* → row 2 *temperature bands ascending* → row 3 *heat, humidity & wind* → row 4 *curated combinations*):
     | Row | Presets |
     | --- | --- |
     | Sky | *☀️ Sunny*, *⛅ Cloudy*, *🌧️ Rainy*, *❄️ Snowy*, *⚡ Storm* |
     | Temperature | *🧊 Freezing* ≤2°C, *🥶 Cold* <12°C, *🧥 Cool* 8-14°C, *🧣 Mild* 14-20°C, *🏖️ Warm* 20-28°C, *🌴 Hot* >28°C |
     | Comfort | *💧 Humid* >70%, *🏜️ Dry* <30%, *💨 Windy* >20 km/h, *🌪️ Gale* >40 km/h |
     | Curated | *🏝️ Beach Day*, *🎿 Ski Trip*, *🌴 Tropical*, *🍃 Mild & Breezy*, *🌈 Rainy & Mild* |
   - **Curated combinations**: the five "vibe" presets expand into multiple base keywords via `CLIMATE_PRESET_EXPANSIONS` (e.g. *Beach Day* = clear skies **and** 20-28°C), so one chip expresses a whole vibe. The same keywords are echoed into the search box, so re-running the query reproduces the filter exactly.
   - **Interactive Results Grid**: Displays all matching cities around the globe with current live temperatures, weather icons, humidity, and wind speeds.
   - **Filter-aware sorting**: the sort dropdown is rebuilt from the *active* filter, so it only ever offers axes that actually matter — see [Sorting](#-sorting-mirrors-the-filter).
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
  - **Local Time** card: the city's live clock, its UTC offset, how far it sits from *your* clock, and your own time for direct comparison.
- **Personal Weather Assistant**: one headline sentence plus six recommendation tiles — see [Weather Assistant](#-personal-weather-assistant).
- **24-Hour Forecast**: Scrollable horizontal strip with hourly temperatures and precipitation probabilities.
- **7-Day Extended Forecast**: Daily outlook with normalized min/max temperature range bars, plus per-day max UV index and chance of precipitation.
- **Instant Unit Switching**: Toggle between Celsius (**°C**) and Fahrenheit (**°F**) with instantaneous client-side recalculation. Temperature, wind (km/h ↔ mph), and precipitation (mm ↔ in) all follow the toggle, and the choice is remembered in `localStorage`.
- **Data Freshness**: A "Updated N min ago" stamp (corrected for the city's UTC offset) plus a manual refresh button. Live conditions also auto-refresh every 10 minutes while the dashboard is visible.
- **Dynamic Theming**: Background palette and glowing ambient orbs automatically adapt to the weather (Clear Day, Night, Rain, Thunderstorm, Snow, or Overcast). Animations respect `prefers-reduced-motion`.
- **Zero Dependencies**: Pure HTML5, CSS3, and modern Vanilla JavaScript — runs in any web browser without Node.js or build steps.

---

## 🧠 Personal Weather Assistant

A forecast tells you *what the weather is*. The assistant card — the first thing under the current-weather hero — tells you **what to do about it**, in one headline sentence and six short tiles.

| Surface | Question it answers |
| --- | --- |
| **Headline** | *"Wet afternoon ahead — consider outdoor plans before 14:00."* / *"Snowy today."* / *"Pleasant and dry — good day to be outside."* |
| ☔ **Umbrella** | *Should I take one, and when is the wettest stretch?* |
| 🚶 **Walk** | *When is the driest, most comfortable window for a walk?* (up to 4 hours) |
| 🚗 **Wash car** | *Is there a long enough dry stretch — and is it cut short by rain?* |
| 🚴 **Cycling** | *Safe and pleasant to ride?* |
| 🏊 **Swimming** | *Is the air temperature good for a swim?* (air only — never water temperature) |
| 👕 **What to wear** | *Layers, jacket or t-shirt, umbrella, sun protection — plus the warmest/coolest hour.* |
| 🌧️ **Rain during your…** | *Morning / Midday / Afternoon / Evening* — a one-line answer per window. |

### How it is built

- **No second API call.** The hourly block the dashboard already requests gained `apparent_temperature`, `precipitation`, `wind_speed_10m` and `cloud_cover` — four extra fields on the *same* request. Everything else is computed client-side.
- **`advice.js` is pure.** It never touches the DOM, never fetches, and stores nothing. The app injects its own unit formatters (`formatTemp`, `formatWindSpeed`, `formatPrecip`), so thresholds stay in **Celsius / km-h / mm** internally while the text follows the °C ↔ °F toggle exactly like the rest of the page.
- **Memoised, not recomputed.** The analysed forecast is cached against the hourly payload's identity, so a unit toggle or a window switch does no redundant work; switching windows only recomputes the window answer, never the six tiles.
- **One thresholds object.** Every boundary lives in `THRESHOLDS` at the top of `advice.js` — the single place to tune behaviour.
- **Degrades, never breaks.** Missing precipitation, partial arrays, `null` entries, an unusable payload, or even a payload that throws on property access each fall back to a *Not enough forecast data* state. One failing recommendation can never take the dashboard down with it, and the card hides itself if there is nothing to say.
- **Nothing about you is stored.** The selected window lives in memory for the session only — no commute, no routine, no personal data in `localStorage`, `sessionStorage` or cookies.
- **Accessible by construction.** The window selector is a real `role="radiogroup"` with roving tabindex and arrow-key navigation; the headline and the window answer are polite live regions; every tile is a `role="listitem"`.

### Running the tests

The engine and its dashboard wiring have a zero-dependency suite built on the Node test runner:

```powershell
node --test
```

`tests/advice.test.js` covers the recommendation logic (thresholds, units, late-night scope, missing data, hostile payloads, determinism) and `tests/wiring.test.js` covers the glue (browser global, script order, element bindings, card placement, escaping, styling).

---

## 🕐 Live local time & time-zone difference

Every surface that shows a city's climate information also shows that city's **live local clock**, ticking in real time down to the second, plus **how far that city is from the time zone you are in**.

| Surface | What it shows |
| --- | --- |
| **Header** (always visible) | *Your* clock and detected zone — the reference point for every difference below. |
| **Hero card** | Large city clock `HH:MM` + dimmed pulsing `:SS`, zone abbreviation (`CEST`, `PDT`, `GMT+5:30`), full date, and *"7h ahead of you"*. |
| **Current Conditions → Local Time** | City clock `HH:MM:SS`, date, offset pill (`+5h30m · UTC+05:30`) and your own clock side by side. |
| **Climate results grid** | Every matching city card carries its own live clock, zone abbreviation and offset — e.g. 36 cities across 17 time zones ticking at once. |
| **Search suggestions** | Each suggestion shows the candidate city's local time and compact offset, which also disambiguates same-named cities (*Paris, France* vs *Paris, Texas*). |
| **Forecast headers** | The 24-hour and 7-day cards label which zone their hour labels are in. |
| **Footer** | Discloses which timezone was detected for your reference clock. |

### How "your" time zone is determined

Your timezone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone`, i.e. the timezone your device/OS reports. That is the same zone an IP-geolocation lookup would resolve for your connection, but it needs **no third-party API key, no extra network request, and cannot rate-limit or fail** — so the feature works offline from the API's perspective and adds zero dependencies.

### Why the clocks stay correct

- **Offsets come from `Intl`, not from hand-rolled arithmetic.** DST transitions, half-hour zones (`Asia/Kolkata`, +05:30) and quarter-hour zones (`Australia/Eucla`, +08:45) are all handled by the platform's own timezone database, with no bundled tz data.
- **One shared timer drives every clock.** N clocks cost one timer, not N.
- **The timer re-arms on the next second boundary** (`1000 - Date.now() % 1000`) rather than every 1000 ms, so the display cannot drift, skip, or repeat a second over a long session.
- **Formatters are cached per zone**, because constructing an `Intl.DateTimeFormat` is far more expensive than calling one. Each zone costs exactly one `formatToParts` call per tick; the `HH:MM:SS` digits are then plain arithmetic.
- **Hidden views are gated off** by their existing `.hidden` class rather than by probing layout — `offsetParent` / `getClientRects()` force synchronous reflows, which would mean hundreds of reflows per second with a full 72-card grid on screen.
- **Work is skipped entirely while the tab is hidden**, so returning to the tab never triggers a burst of stale frames.
- **Registrations are released** when a card leaves the result set, when the grid empties, and when the suggestion dropdown closes or rebuilds — so repeated searching cannot accumulate clocks.

### Accessibility of the ticking digits

The dashboard, climate grid and suggestion dropdown all live inside `<main aria-live="polite">`. A per-second text change in a polite live region becomes a screen-reader announcement, so every node that rewrites itself each second carries `aria-hidden="true"`; a screen reader would otherwise try to speak the clock sixty times a minute. The meaningful, non-volatile facts stay exposed: the date, the zone abbreviation, and the offset versus you — including in each city card's `aria-label`. The seconds pulse animation is also disabled under `prefers-reduced-motion`.

---

## ♿ Accessibility

- Search field is a proper `role="combobox"` with `aria-expanded`, `aria-controls`, and `aria-activedescendant` wired to a `role="listbox"`.
- Full keyboard support in the suggestion list: **↑ / ↓** to move (wrapping), **Enter** to select, **Esc** to dismiss, **Tab** to move on. Hovering an option also highlights it.
- Ambiguous city names (e.g. *Paris*) open a disambiguation list instead of silently loading the top-ranked match.
- Live regions: loading uses `role="status"`, errors use `role="alert"`, and the main content area is an `aria-live` tab panel.
- **Ticking clocks are `aria-hidden`** so their per-second updates are not announced as live-region changes; each city card and suggestion instead exposes its zone and its offset versus you through a stable `aria-label`. See [Live local time](#%EF%B8%8F-live-local-time--time-zone-difference).
- Mode tabs, the °C/°F radiogroup, and 7-day rows all carry the ARIA roles and states their patterns require.
- The Weather Assistant's *Rain during your…?* selector is a `role="radiogroup"` with roving `tabindex`, arrow-key navigation, and `aria-checked` on the selected window; its headline and answer are polite live regions.
- A `<noscript>` notice explains that JavaScript is required.

---

## 🧪 Robustness notes

- Every network call is wrapped with a **12-second timeout**, and in-flight requests are **aborted** when superseded — so racing city clicks or fast typing can never leave stale data or a stuck spinner on screen.
- The 72-city climate dataset is fetched **lazily** (only when climate mode is opened) and cached in `sessionStorage` for 5 minutes, so reloads within a session are instant and plain city searches never pay for it.
- All text originating from the Open-Meteo API is written with `textContent`, so city names are never interpreted as markup.
- The Weather Assistant's copy is rendered the same way: engine strings are written node-by-node with `textContent` (the only `innerHTML` in its render path is `grid.innerHTML = ''`), so a malformed forecast string cannot inject markup.

---

## 🌡️ Climate filter parsing

The natural-language parser is **unit-aware**. A numeric threshold is interpreted as Fahrenheit while the °F toggle is active and as Celsius while °C is active, unless you type an explicit `°C` / `°F` marker:

| Input | °C mode | °F mode |
| --- | --- | --- |
| `Hot` | `> 28°C` | `> 82°F` |
| `> 75` | `> 75°C` | `> 75°F` (≈ 23.9 °C) |
| `20-28°C` | `20°C to 28°C` | `20°C to 28°C` (explicit marker wins) |
| `-5 to 5` | `-5°C to 5°C` | `29°F to 41°F` |
| `Windy` | `> 20 km/h` | `> 12 mph` |
| `Gale` | `> 40 km/h` | `> 25 mph` |
| `Humid` | `> 70%` | `> 70%` (humidity is unit-free) |
| `Dry` | `< 30%` | `< 30%` |
| `Cool` | `8°C to 14°C` | `46°F to 57°F` |

The **preset chips follow the same toggle** — their numeric suffixes are rendered from `data-temp-*` / `data-wind` attributes, so switching °C ↔ °F rewrites `🏖️ Warm (20-28°C)` into `🏖️ Warm (68-82°F)` live.

Clicking the active preset chip again clears that filter.

---

## 🔀 Sorting mirrors the filter

The sort dropdown is **not a fixed list** — it is derived from the criteria the current filter actually constrains, so it never offers an ordering that cannot discriminate the results. Every measurement the filter touches becomes a sortable axis in **both** directions:

| Active filter | Sort options offered |
| --- | --- |
| *☀️ Sunny*, *⛅ Cloudy*, *🌧️ Rainy*, *❄️ Snowy*, *⚡ Storm* (sky only, no numeric axis) | *City name (A-Z)*, *City name (Z-A)* |
| *🧊 Freezing*, *🥶 Cold*, *🧥 Cool*, *🧣 Mild*, *🏖️ Warm*, *🌴 Hot*, `> 25`, `< 15`, `20-25` | + *Temperature (higher to lower)*, *Temperature (lower to higher)* |
| *💧 Humid*, *🏜️ Dry* | + *Humidity (higher to lower)*, *Humidity (lower to higher)* |
| *💨 Windy*, *🌪️ Gale* | + *Wind speed (higher to lower)*, *Wind speed (lower to higher)* |
| *🏝️ Beach Day*, *🎿 Ski Trip*, *🌈 Rainy & Mild* | Temperature + name |
| *🌴 Tropical* (heat **and** humidity) | Temperature **and** humidity + name |
| *🍃 Mild & Breezy* (temperature **and** wind) | Temperature **and** wind + name |

Key properties:

- **City name is unconditional.** Every city has a name, so `City name (A-Z)` / `(Z-A)` are always available — including for purely categorical filters like *Sunny*.
- **The default follows the filter's own bounds.** A ceiling-only filter leads with its lowest values (*Freezing* → *Temperature (lower to higher)*, *Dry* → *Humidity (lower to higher)*); every other filter leads with its highest (*Hot* → *Temperature (higher to lower)*, *Gale* → *Wind speed (higher to higher)*).
- **An explicit choice survives.** Re-renders triggered by a °C/°F toggle or a repeat search keep the selected axis whenever it still exists; only a genuinely unavailable axis falls back to the default.
- **Missing readings sink to the bottom** in *both* directions, so a city with no reported value can never masquerade as the coldest, hottest, wettest, or windiest entry.
- **Ties break by name**, so re-sorting and re-rendering never reshuffle equally-valued cards.

> Sorting compares the raw Open-Meteo values, which are always Celsius / km-h / percent, so the ordering is identical in °C and °F mode.

> **Scope note:** climate searches evaluate a curated set of **72 benchmark cities**, not every populated place on Earth. The results header states this explicitly, and the empty state repeats it — an empty result means "none of these 72 cities", not "nowhere on the planet".

---

## 🔲 Preset button grid

Both the *Popular Cities* and *Preset Climates* bars are rendered by one shared CSS contract rather than free-flowing flex pills:

- **Horizontal alignment** comes from CSS Grid tracks (`1fr`), not intrinsic button widths — a short label like `Tokyo` can never leave a ragged gap that pushes a button out of line with the row above it.
- **Vertical alignment** comes from a fixed chip box (`height: 38px`), so every row is pixel-identical.
- Both bars hold **20 items**, which resolves to a clean **5 × 4** matrix on desktop and **4 × 5** below 1180px.
- Below 1180px the column count is `auto-fit`-driven with a `minmax(min(180px, 100%), 1fr)` floor, so the widest label (`Gale (>40 km/h)`) can never truncate. Below 640px the caption stacks above the matrix and the floor drops to 150px.
- Verified with headless Chrome from **320px to 1440px**, in both °C and °F: every chip sits on a shared column track, even spacing throughout, zero truncated labels, zero horizontal overflow.

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
├── index.html        # Semantic HTML5 app markup, ARIA wiring, City & Climate mode switchers
├── styles.css        # Glassmorphic CSS styling, dynamic themes, climate results grid, reduced-motion support
├── app.js            # Batch climate queries, unit-aware filter parser, weather controller
├── advice.js         # Personal Weather Assistant engine (pure, unit-agnostic, no DOM access)
├── tests/
│   ├── advice.test.js    # Recommendation logic: thresholds, units, scope, missing data, determinism
│   └── wiring.test.js    # Dashboard glue: global, script order, element bindings, escaping, styling
├── start-server.ps1  # Lightweight zero-dependency PowerShell static web server
└── README.md         # Documentation and project overview
```
