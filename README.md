# WeatherScope 🌦️

A modern, fast, and responsive weather web application that allows you to search real-time weather conditions by **City Name** or discover worldwide cities that meet your **Preferred Climate & Weather Conditions** (e.g., Sunny, Warm, Rain, Snow, Hot > 28°C, Cold < 12°C).

Powered by the [Open-Meteo API](https://open-meteo.com/), WeatherScope operates with zero API key configuration or setup friction.

---

## 🎯 The mark

The app is named **WeatherScope**, and its icon is a **radar scope showing the weather** — a name and a picture that mean the same thing.

![The WeatherScope mark](favicon.svg)

| Layer | What it is | Why |
| --- | --- | --- |
| **Scope ring** | A cyan-to-blue rim around a dark navy disc | A radar scope, and the "scope" half of the name. The dark disc is what makes the mark legible on both light and dark browser chrome. |
| **Sweeping beam** | A soft gradient wedge that rotates once every 4.5s | Weather radar is instantly recognisable. It is the one moving part of the logo, and the global `prefers-reduced-motion` rule stops it for anyone who has asked for less motion. |
| **Range rings & ticks** | One inner ring plus four crosshair ticks | The instrument-panel detail that sells "scope" at large sizes. |
| **Cloud + two drops** | A white cloud with rain, dead centre | The weather, held inside the instrument. White-on-navy gives it a **10.3:1** contrast ratio, so it survives a 16px favicon. |

The mark lives in one 32×32 `viewBox` and scales without loss to any size. It is written twice on purpose — inline in the header, and as `favicon.svg` for the tab — because an external `<use>` reference would be blocked by CORS when `index.html` is opened straight off the disk with `file://`.

| File | Role |
| --- | --- |
| `favicon.svg` | Tab / shortcut icon, and the scalable master of the mark. |
| `apple-touch-icon.png` | 180×180 rendered from the same SVG for iOS home screens and bookmarks. |

---

## ✨ Features

### 🔍 Three Search Modes

1. **City Search Mode**:
   - Real-time debounced autocomplete suggestions showing matching cities, regions, and countries.
   - Enter key or quick search for any city on Earth.
   - One-click chips for 20 popular global cities, kept in strict **A-Z order** (Athens → Tokyo) and rendered as a uniformly sized grid, so every button lines up horizontally and vertically. The bar sits at the **foot of the page**, below every card, so it reads as the "somewhere else?" shortcut instead of competing with the header.
   - One-click GPS location detection with reverse geocoding.

2. **Compare Locations Mode (New! 🎉)**: pick 2–4 places and read them side by side — see [Compare Locations](#-compare-locations).

3. **Climate & Weather Filter Mode**:
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
- **Today at a Glance**: the first card on the dashboard — city, temperature, feels-like, condition, today's rain chance, wind and humidity in three tiles, closed by a one-word verdict — see [Today at a glance](#-today-at-a-glance).
- **Personal Weather Assistant**: one headline sentence plus six recommendation tiles — see [Weather Assistant](#-personal-weather-assistant).
- **24-Hour Forecast**: Scrollable horizontal strip with hourly temperatures and precipitation probabilities.
- **7-Day Extended Forecast**: Daily outlook with normalized min/max temperature range bars, plus per-day max UV index and chance of precipitation.
- **Instant Unit Switching**: Toggle between Celsius (**°C**) and Fahrenheit (**°F**) with instantaneous client-side recalculation. Temperature, wind (km/h ↔ mph), and precipitation (mm ↔ in) all follow the toggle, and the choice is remembered in `localStorage`.
- **Data Freshness**: A "Updated N min ago" stamp (corrected for the city's UTC offset) plus a manual refresh button. Live conditions also auto-refresh every 10 minutes while the dashboard is visible.
- **Dynamic Theming**: Background palette and glowing ambient orbs automatically adapt to the weather (Clear Day, Night, Rain, Thunderstorm, Snow, or Overcast). Animations respect `prefers-reduced-motion`.
- **Zero Dependencies**: Pure HTML5, CSS3, and modern Vanilla JavaScript — runs in any web browser without Node.js or build steps.

---

## 👀 Today at a glance

The first card on the dashboard answers the only question that matters before the forecast: *what is it like outside right now?* — city, temperature, how it feels, the sky, the three numbers that decide whether to go out, and one plain-language verdict. It spans the full width of the grid above the hero card and stays hidden until a city has actually loaded.

| Surface | What it shows |
| --- | --- |
| **Location** | City name plus the region and country line beneath it. |
| **Temperature** | The current reading with its unit, the "Feels like" value underneath, the condition label and its day/night vector icon. |
| **Rain** | The **peak** chance for the rest of today — the number that decides the verdict, not a meaningless "chance right now". |
| **Wind** | Current speed with its cardinal direction. |
| **Humidity** | Relative humidity. |
| **Verdict** | An icon, a headline and one sentence: 👍 *Good weather* — "Mostly dry and comfortable around 16°C with a breeze." / ☔ *Umbrella recommended* — "Rain peaks at 75% around 15:00." |
| 👕 **What to wear** | The assistant's clothing answer in one line, directly under the verdict: *Warm jacket + umbrella* — "Cold and wet - around 4-8°C with rain expected." |

### The verdict ladder

Verdicts are checked in a fixed order and the **first match wins**, so the most dangerous reading always outranks the mildest. `THRESHOLDS` at the top of `glance.js` holds every cut-off:

| Verdict | Wins when | Tone |
| --- | --- | --- |
| ⛈️ Thunderstorms expected | any thunderstorm code today | bad |
| ❄️ Snowy today | any snow code today | warn |
| 🧊 Freezing cold | the day's coldest "feels like" ≤ 0 °C | bad |
| 🥵 Very hot | the day's warmest "feels like" ≥ 33 °C | bad |
| ☔ Umbrella recommended | peak rain chance ≥ 30 %, ≥ 0.2 mm/h, or — when no probability or amount is reported at all — a rain code | caution |
| 💨 Very windy | peak wind of the day ≥ 40 km/h | warn |
| 👍 Good weather | none of the above | good |

A rain *code* alone can never talk you into carrying an umbrella: with a reported 5 % chance and 0.0 mm the verdict stays *Good weather*, so the card can never contradict the assistant below it.

### How it is built

- **No second API call.** Everything comes from the `current`, `hourly` and `daily` blocks the dashboard already holds; `glance.js` adds no request, no cache and no state.
- **Pure and deterministic.** No DOM, no clock, no randomness, no storage, and a `try`/`catch` around the whole read — the same payload always produces the same card, and even a payload that throws on property access ends as "nothing to show" rather than a blank screen. See [Personal Weather Assistant](#-personal-weather-assistant) for the same pattern applied to the assistant.
- **No unit logic and no weather wording of its own.** The app injects `formatTemp` / `formatWindSpeed` / `getWeatherSvg` and its own `WMO_MAP`, so the °C ↔ °F toggle repaints the whole card — including the numbers inside the verdict sentence — with no refetch, and the condition wording has exactly one source.
- **"Today" really means today.** The hourly rows are filtered to the city's *current local day* from `current.time` onwards, so a reading at 23:00 is judged on the evening rather than on the whole 24-hour payload; the daily block is only a fallback for payloads with no usable hourly rows.
- **Missing is not zero.** An absent reading renders as `--`, is left out of the verdict, and never becomes a confident guess; if neither temperature nor a weather code is usable the card hides itself instead of painting an empty shell.
- **Accessible by construction.** The card is a `role="status"` live region, the metric tiles are a `role="list"` with screen-reader hints that spell out what each number means ("peak chance today"), and the verdict icon is `aria-hidden` because the headline already says the same thing.
- **The "what to wear" line is a mirror, not a move.** It sits under the verdict because that is the question it answers, and it is painted from the assistant's memoised `clothing` decision — so the two cards cost one analysis and can never disagree. The assistant card keeps its own tile: the glance copy is a summary, nothing was moved out of it. Clothing does not depend on the selected rain window, so switching windows in the assistant leaves the glance line correct without a repaint.

### Running the tests

`tests/glance.test.js` covers the logic (metric fallbacks, today's rain peak and its hour, the verdict ladder and its precedence, unit delegation, hostile payloads) and `tests/glance-wiring.test.js` covers the glue (browser global, script order, element bindings, card and sub-card placement, `textContent` escaping, styling and the accessibility wiring):

```powershell
node --test
```

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

### Always two across, at every width

The six tiles are laid out as **two subcards per row on every device**, down to the narrowest phone. The pair is the unit of meaning — *"take an umbrella **and** wear layers"* — so collapsing to a single column on a small screen would change what the row says, not just how much room it takes.

What shrinks instead is the padding and the type inside each tile (`0.78rem → 0.72rem → 0.68rem` for the label, and so on down the scale), and long words are allowed to break rather than widen a column that is half the viewport wide. The `max-width` overrides are declared **after** the base `.assistant-tile` rule so they actually win the cascade — an override placed before the rule it overrides is silently dead CSS, and the tiles would keep their desktop padding on a phone.

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

The comparison has three files of its own:

| File | What it protects |
| --- | --- |
| `tests/compare.test.js` | The engine: duplicate refusal, the 2–4 limit, replace/reorder edge cases, per-column failure, missing-as-`null` readings, ties, thresholds, the statement budget, neutral wording. |
| `tests/compare-wiring.test.js` | The glue: script order, element ids, tab semantics, section placement, escaping, the two extremes being visually distinct *and* non-colour-only, every applied class being styled. |
| `tests/compare-runtime.test.js` | The app **booted against a small hand-written DOM stub** — no jsdom, no dependencies. It switches mode, picks 3 and 4 places (and holds the 4 cap), re-picks a slot to replace it, resolves an ambiguous name, runs a comparison, fails one column, retries it, toggles °C ↔ °F and clears out, asserting nothing throws at runtime. |

---

## 📊 Compare Locations

The third mode answers one question: *what is the weather like in these places, and how different are they?*

### Using it

Pick **Compare** in the mode tabs. The search box and the popular-city chips are reused as-is — a picked place fills the next slot instead of replacing the dashboard. **2–4** locations can be compared; each slot can be moved up/down or removed.

To **replace** a location, click its chip. The picker reopens with a prompt naming the slot ("Choosing a new location for Location A (currently Athens)…") and the next pick swaps that slot in place rather than appending a fourth one. **Escape** abandons it and keeps the original. A swap that would duplicate a place you already hold is refused with the reason, and re-picking the same place is a no-op rather than an error.

| Surface | What it shows |
| --- | --- |
| **Weather at a glance** | Up to five neutral sentences derived from the real numbers — the largest differences first, and only where the gap exceeds its own threshold. |
| **Current conditions** | Condition, temperature, feels-like, rain chance, wind, UV, humidity, precipitation, cloud cover and sunrise/sunset, one column per location. |
| **Today's forecast** | High, low, rain chance, peak UV and strongest wind — so two cities can be compared on the day, not just the moment. |
| **Latest reading** | One "Updated N min ago" stamp, taken from the **stalest** column, corrected for each city's UTC offset. |

Every column header carries that city's own local time, UTC offset from *your* clock and zone abbreviation, driven by the same shared clock registry as the rest of the app.

### Design decisions

- **One failure never takes down the comparison.** Columns are fetched in parallel with `Promise.allSettled`; a timeout or network error degrades just that column to an explicit *"Weather data unavailable"* with a **Try again** button that refetches only itself.
- **Missing is not zero.** A reading that is absent renders as `--` and is excluded from both the extremes and the sentences, so a difference is never invented between two equals.
- **The extremes are unmistakable, and still never "good" or "bad".** The highest and lowest reading of a row become filled pills — white on deep green ▲ for the high end, white on deep red ▼ for the low end (both past WCAG AAA against white text), explained once by the legend in the glance card. Colour is never the only cue: the ▲/▼ glyph, the legend wording and the cell's accessible name all repeat it, and the sentences below still talk only about "highest" and "lowest", because neither end of a temperature range is preferable.
- **No unit logic of its own.** `compare.js` receives the app's existing formatters, so the °C ↔ °F toggle repaints the comparison instantly with no refetch, and `WMO_MAP` stays the single source of weather wording.
- **Independence of columns.** A location you are already viewing on the dashboard reuses that payload verbatim instead of issuing a second request for data the page already holds.
- **The comparison cannot swallow the dashboard.** The default city starts loading on page load; if it arrives after you have switched to Compare, the dashboard and its full-screen error stay hidden rather than covering the surface you are on.

---

## 🔗 Shared forecast links

The share button next to the city name no longer hands out the app's address. The link it sends **is** the forecast: whoever opens it lands on that city, with that city's cards on screen.

```text
index.html?city=Tokyo&region=Tokyo&country=Japan&lat=35.6762&lon=139.6503
            &tz=Asia%2FTokyo&cards=glance,hourly&unit=f&window=evening
```

| Parameter | What it restores |
| --- | --- |
| `city`, `region`, `country` | The city, spelled out the way the dashboard spells it |
| `lat`, `lon` | The exact point, so the right *Paris* opens without re-geocoding |
| `tz` | The city's own timezone, so the live clocks are right too |
| `cards` | Which cards to ring: `glance`, `hero`, `assistant`, `metrics`, `hourly`, `daily` |
| `unit` | `c` or `f`, so the numbers match the message that came with the link |
| `window` | The assistant's selected rain window (morning / midday / afternoon / evening) |

### What the recipient sees

- **The shared city, not their last city.** A shared link is resolved before the saved city and before the default one — opening it always shows what was shared.
- **The shared cards, ringed and scrolled into view.** The first shared card is scrolled to, each shared card carries a cyan ring, and a banner names the city and the cards in words (*"Shared forecast — Tokyo, Japan · Today at a glance, 24-hour forecast"*). Everything else stays readable, so they can keep exploring; **Show all cards** drops the ring.
- **The same numbers as the message.** The unit and the rain window travel in the link, and the arrival is announced in a live region, so the outcome is never colour-only or silent.

### Design decisions

- **What you see is what you share.** `cards` is measured from the viewport: someone who scrolled down to the hourly strip shares the hourly strip, not six cards they never looked at. If the page cannot be measured at all, the whole dashboard is shared rather than an empty card list.
- **The coordinates are the identity.** Every share link carries `lat`/`lon`, so no re-geocoding happens and a city name can never resolve to a different place.
- **Readable, not encoded.** Plain query parameters instead of a base64 blob: the link survives being pasted through a chat app that mangles it, and a human can see which city it opens.
- **Nothing off the wire is trusted.** `share.js` validates every field on the way in — unknown card keys, a lone coordinate, a latitude past the pole, a nonsense unit and a control character in a city name are all dropped, and a URL that does not name a city is not treated as a share link at all.
- **The ring cannot outlive its claim.** Picking a different city clears the ring and the banner immediately, and the ring is only applied once the shared city's data has actually arrived — a superseded or failed load leaves nothing behind.
- **A share is confirmed, never silent.** With a native share sheet the link goes as its own field; without one, the link *and* the message are copied (with a clipboard fallback), and the button confirms visually while a live region says it out loud. If even that fails, the deep link is placed in the address bar so it can still be copied by hand.

### Running the tests

`tests/share.test.js` covers the link format (round-trip, re-sharing, card vocabulary, hostile input) and the wiring (script order, card ids and bindings, deep-link-on-share, arrival-before-saved-city, stale-ring clearing, styling and the live region):

```powershell
node --test
```

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

## 📷 Free live city cameras

Anywhere the app shows a city, it can also show you what that city's sky is doing right now. One panel definition is mounted in **all three views** — the climate grid card, the selected city on the dashboard, and each city in the comparison — so a forecast and a live view of the same place sit next to each other instead of in a separate screen. A single switch in the header turns every one of them off.

### What it shows

| | |
| --- | --- |
| **The frame** | Whatever the nearest free public camera actually publishes: a stream where it has one, a snapshot where it does not. |
| **The badge is honest** | `Live` only where there is motion — an MJPEG or HLS stream playing. A polled snapshot is labelled **Live still**, because a still that refreshes every minute is not a live video and saying so would be a claim the app cannot support. |
| **Streams vs stills** | An MJPEG stream plays in the `<img>` (that is how the format is delivered, and the browser keeps refreshing it by itself). HLS and file streams play in a `<video>`; if the browser refuses to autoplay one and the source publishes no still, the panel says **Camera unavailable** rather than leaving a black rectangle. |
| **Next camera** | When the directory knows of more than one camera in range, the panel cycles through them without asking again. |
| **Attribution** | The source's required wording, linked to its licence. Never omitted when the source supplies it. |
| **Pause / Play** | A real toggle per panel, so a frame refreshing every few minutes is motion you can turn off. Pausing stops the timer *and* hands back the connection. |
| **"No free public camera for this city"** | Shown when the directory says there is none. Most of the world has none, and the app says so rather than showing a placeholder. |
| **"Camera lookup unavailable right now"** | Shown when the app was *not allowed to ask* — a throttle or a failure. It never pretends that "we could not check" means "there is nothing here". |

### Why it can be free

The directory ([datumfeed.com](https://datumfeed.com)) is queried directly over plain CORS-enabled HTTPS — **no API key, no proxy, no build step** — exactly like the Open-Meteo calls. It only lists cameras whose registry licence permits redistribution, and it answers a `bbox` query, so one request covers any city in the app whether or not it is covered.

### Where cameras actually exist

Coverage is real but regional, and the app treats absence as a normal answer rather than a gap:

| Registry | Cities |
| --- | --- |
| TfL JamCams | London (and the rest of Greater London) |
| Caltrans CCTV, WSDOT | California, Washington |
| Austin Traffic, Ontario 511, Ottawa/Toronto | Texas, Ontario |

A city outside these gets one short line of text. Probing the directory for any of the 72 benchmark cities is what produced that list — `node tools/probe-cameras.js` will re-run the check.

### Finding cities that do have cameras

The **Live Cameras** mode turns the directory's coverage index into a browsable city catalogue. It lists every camera-covered city by publishing registry, then opens a live frame wall beside that city's current climate and links directly to the full seven-day forecast. Coverage comes from the same `/api/registries` response the app already fetches for source refresh cadences, so discovering 27 covered cities adds no per-city lookup requests. Each chosen city's camera list costs one request; the frame endpoint handles CORS and its own cache cadence, and the browser wall revalidates only at that source cadence. The catalogue does not invent per-city camera counts from registry-wide totals.

### How it stays cheap and polite

- **Lazy.** The directory is rate-limited, so a panel is only asked about once it is actually scrolled into view (`IntersectionObserver`, 200 px margin), with lookups spaced 900 ms apart. A 72-card filter does not become 72 simultaneous requests.
- **Cached for the session, including "nothing here".** Re-sorting or re-filtering never re-asks. Results live in `sessionStorage`, never `localStorage` — a camera's answer is true for about a minute.
- **A throttle is never cached as an answer.** This is the important one: caching "we were not allowed to ask" as "this city has no free public camera" is how a momentary 429 turns into a false claim about a city for the rest of the visit. Only `found` and `none` are cached; `unknown` is a statement about the network, and it lifts itself.
- **The cooldown is five minutes and self-healing.** After a 429 or a failure the app stops asking, says the lookup is unavailable, and retries when the cooldown expires — rather than giving up for the whole session the way it used to.
- **The source sets the cadence.** Each registry publishes how often it wants to be refreshed (fetched once per session from `/api/registries` and applied per camera, floored at 15 s whatever a source asks for). The app never polls faster than the source asks.
- **A re-render is not a refresh.** Sorting the grid, switching language or re-running the panels leaves the frame already on screen alone until the cadence elapses; only the poller asks for a new one. Releasing a panel forgets when its frame was shown, so a returning panel can never be handed a cached picture.
- **The cache-buster only moves forward.** Two polls inside the same millisecond — a throttled tab catching up — would otherwise produce the identical URL and the browser would answer the second from the cache the first filled.
- **A stream is never cache-busted.** Adding a parameter to a live connection tears it down and asks the source to open another, which is the opposite of what a stream does by itself.
- **Polling only runs while a panel is on screen, unpaused, and the switch is on.** Off-screen or paused panels hold no timer and release their media; so does the master switch.
- **The budget is respected before it is spent.** `x-ratelimit-remaining` is read from the response headers and the app stops asking with two requests left, rather than getting throttled.
- **Nothing happens until you search.** No camera request is made at page load; the observer is only attached when a grid is rendered.

### Accessibility

The frame is `loading="lazy"` and `decoding="async"`, with an `alt` that names the place. The `Live` badge's pulse is disabled under `prefers-reduced-motion`. The pause control is a real `<button>` with `aria-pressed`, and both it and the header switch have visible focus rings — and because the card itself is a `role="button"`, the panel's clicks and key presses stop there instead of opening the city. The comparison's camera strip is labelled for screen readers.

### Design decisions

- **`cameras.js` is pure**, like `advice.js` / `glance.js` / `compare.js`: no DOM, no network, no clock of its own. `findCameras` is handed a `fetchJson`, and the current time is passed in. That is what keeps it testable in plain Node.
- **One panel definition, mounted wherever a city is shown.** `CAMERA_PANEL_HTML` is written once and `mountCameraPanel` adopts it into any host, so the grid, the glance card and the comparison cannot drift apart.
- **One registry of panels.** Every mounted panel is registered by id, so one observer, one switch and one `refreshCityCameras` drive all of them — and dropping a comparison releases the panels it was holding.
- **The feed URL is only ever assigned as an attribute**, never parsed as markup, and only `http(s)` survives normalisation. Fields the directory adds that we do not understand are dropped rather than forwarded, because every normalised field ends up in the DOM.
- **A camera the directory flags `contradicted` is never shown** — a dead feed or misplaced pin in a weather card is worse than no frame.
- **Coordinates that are absent are rejected, not coerced.** `Number(null)` is `0`, so a naive parse would place a camera with `"lat": null` in the Gulf of Guinea and rank it as the nearest thing on earth.

### Running the tests

```bash
node --test tests/cameras.test.js         # the engine
node --test tests/camera-runtime.test.js  # the controller, in a small DOM
node --test tests/camera-wiring.test.js   # the glue to the page
node tools/probe-cameras.js              # the real directory, by hand
```

`camera-runtime.test.js` runs the real controller source in a sandbox with a
stub DOM, a fake directory and a controllable clock, so the parts that are easy
to get wrong — lazy lookup, playback by feed type, the polled-still cadence,
throttling, and releasing a panel — are asserted as behaviour rather than as a
pattern in the source.

---

## 🌐 Language chosen from your country

Six dictionaries ship embedded — **English, Greek, German, Italian, Spanish, French** — with no CDN, no fetch and no flash of the wrong language.

### How the language is chosen

Precedence, highest first:

1. **An explicit choice** — `?lang=`, or the language picker. A deliberate choice always wins.
2. **A previously stored choice**, and only a deliberate one: the stored value is a small JSON object (`{"lang":"el","v":1}`) so an auto-stamped value can never be mistaken for a manual one.
3. **Your IP country**, looked up just before the first translated text is rendered.
4. **Your browser's own preference**, and finally English.

The page is held at `visibility: hidden` while step 3 is in flight (`data-language-pending` on the root), so the first thing painted is already the right language.

### Recognising the country, whichever shape it arrives in

The five IP services raced against each other don't agree on what a "country" is: one answers `{"country_code":"DE"}`, another `{"country":"Germany"}`, and another returns a description already written in the visitor's own language. `langForCountry` accepts all three, in order of how much each can be trusted:

| Shape | Example | Resolves to |
| --- | --- | --- |
| ISO 3166-1 alpha-2 | `DE` | the code table |
| An exact name | `Germany`, `Deutschland`, `Ελλάδα` | the name table |
| The same country named in any embedded language | `Frankreich`, `Grèce`, `Grecia` | **that country's** language — `fr`, `el`, `el` |
| A loose spelling | `ESPANA`, `Cote d'Ivoire`, `Germany (Federal Republic of)` | accents, casing and trailing qualifiers ignored |

Two details that are easy to get wrong:

- **A name written in one language names a country whose visitors read another.** `Frankreich` is German for France, so it must answer **French**, not German. The localized names are therefore *derived* from `COUNTRY_LANGS` through `Intl.DisplayNames` rather than written out by hand — a hand-written row per language per country is exactly the kind of table that goes quietly wrong.
- **`UK` is not an ISO code** but is two letters, so a strict alpha-2 branch would reject it outright. It falls through to the name lookups instead.

A country with no embedded dictionary (**Japan, Portugal, Brazil, South Africa…**) resolves to *nothing* rather than to English — declining is better than guessing, because the browser's own preference is a better answer than a language nobody chose.

### Design decisions

- **Five providers, raced.** Any one can be down or rate-limited; the first usable answer wins, and a total failure falls through to the browser rather than blocking startup.
- **`Intl.DisplayNames`, not a bundled table.** The localized names come from the platform's own CLDR data, so they are correct in all six languages without shipping or maintaining country-name lists.
- **French is a separate file** (`fr.js`) purely to keep `i18n.js` a readable size; it is loaded between `i18n.js` and `app.js`, and the tests assert that order.

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

Both the *Popular Cities* (at the foot of the page, below `main`) and *Preset Climates* bars are rendered by one shared CSS contract rather than free-flowing flex pills:

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
├── index.html        # Semantic HTML5 app markup, ARIA wiring, City / Compare / Climate mode switchers
├── styles.css        # Glassmorphic CSS styling, dynamic themes, climate results grid, comparison tables, reduced-motion support
├── favicon.svg       # The radar-scope mark, and the scalable master of the logo
├── apple-touch-icon.png # 180x180 render of the same mark for iOS
├── app.js            # Batch climate queries, unit-aware filter parser, weather controller, comparison UI
├── glance.js         # "Today at a glance" engine (pure: current conditions, today's rain peak, verdict)
├── advice.js         # Personal Weather Assistant engine (pure, unit-agnostic, no DOM access)
├── compare.js        # Compare Locations engine (pure: selection, metrics, thresholds, insights)
├── share.js          # Shared forecast links engine (pure: city + card deep links, validation)
├── tests/
│   ├── advice.test.js         # Recommendation logic: thresholds, units, scope, missing data, determinism
│   ├── wiring.test.js         # Dashboard glue: global, script order, element bindings, escaping, styling
│   ├── glance.test.js         # Glance logic: metric fallbacks, today's rain peak, verdict ladder, hostile payloads
│   ├── glance-wiring.test.js  # Glance glue: script order, element ids, card placement, escaping, styling, a11y
│   ├── compare.test.js        # Comparison engine: selection limits, per-column failure, thresholds, wording
│   ├── compare-wiring.test.js # Comparison glue: script order, element ids, tab semantics, escaping, styling
│   ├── compare-runtime.test.js# App booted against a DOM stub: modes, fetch, retry, units, clearing
│   ├── share.test.js          # Share links: deep-link format, card vocabulary, hostile params, arrival wiring
│   └── storage-keys.test.js   # The SkyCast rename: legacy unit/city/cache migration, and that it never clobbers
├── start-server.ps1  # Lightweight zero-dependency PowerShell static web server
└── README.md         # Documentation and project overview
```

---

## 🔁 Renamed from SkyCast

The app used to be called **SkyCast**. The rename touched three separate layers, because each one is easy to miss:

| Layer | Before | After |
| --- | --- | --- |
| **What you see** | Page title, `<noscript>` notice, header wordmark, README, server banner | `WeatherScope` |
| **What the code exposes** | `window.SkyCastAdvice` / `SkyCastGlance` / `SkyCastCompare` / `SkyCastShare` | `window.WeatherScopeAdvice` / `WeatherScopeGlance` / `WeatherScopeCompare` / `WeatherScopeShare` |
| **What it remembers** | `skycast_unit`, `skycast_last_city`, `skycast_global_cache` | `weatherscope_*` |

The storage keys are the only part that could actually hurt someone, so they are migrated rather than renamed in place. `readStored()` / `writeStored()` at the top of `app.js` adopt a pre-rename value the first time the new key is read, write everything new under the new name, and delete the old key on the way through. A value already stored under the new name always wins, so a half-migrated profile can never regress. `tests/storage-keys.test.js` holds all of that in place — it boots the real `app.js` against a seeded storage map.

Nothing about you is stored beyond the unit toggle and the last city you looked at, and the selected rain window remains session-only.

### Running the tests

```powershell
node --test
```
