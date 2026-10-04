'use strict';

/**
 * Cameras engine tests.
 *
 * The engine is pure, so these tests never touch the network: `findCameras` is
 * handed a stub `fetchJson`, and the clock is passed in explicitly. What is
 * being protected here is the set of promises the feature makes - "free public
 * cameras only", "the nearest one", "never show a feed the registry itself
 * flags as broken", "don't out-polite the source", and "no camera is a normal
 * answer, not an error".
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'cameras.js'), 'utf8');
const C = require(path.join(ROOT, 'cameras.js'));

/** A registry entry, as the directory attaches one to each camera. */
function registry(overrides) {
  return Object.assign({
    slug: 'example-transport',
    name: 'Example Transport Authority',
    attribution: 'Example Transport Authority',
    licenseUrl: 'https://example.org/licence',
    minPollIntervalS: 60,
  }, overrides);
}

/** A camera, as the directory returns one. */
function rawCamera(overrides) {
  return Object.assign({
    id: 'cam-1',
    name: 'Bridge Street',
    lat: 51.51,
    lon: -0.13,
    feedUrl: 'https://example.org/frame.jpg',
    registry: registry(),
    stats: { trustScore: 88 },
  }, overrides);
}

test('cameras.js registers itself as a browser global', () => {
  assert.match(SOURCE, /window\.WeatherScopeCameras/);
  assert.match(SOURCE, /module\.exports/);
});

test('cameras.js is loaded before app.js so the global exists at init', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const engine = html.indexOf('src="cameras.js"');
  const app = html.indexOf('src="app.js"');
  assert.ok(engine !== -1, 'cameras.js is not loaded by index.html');
  assert.ok(app !== -1, 'app.js is not loaded by index.html');
  assert.ok(engine < app, 'cameras.js must be loaded before app.js');
});

test('the engine needs no API key, because no key is what makes it free to ship', () => {
  assert.match(C.DIRECTORY_ENDPOINT, /^https:\/\/datumfeed\.com\/api\/cameras$/);
  assert.doesNotMatch(SOURCE, /apikey|api_key|API_KEY|token=/i);
});

test('a bounding box around a city contains the city and stays a neighbourhood', () => {
  const [minLon, minLat, maxLon, maxLat] = C.bboxFor(51.5074, -0.1278)
    .split(',')
    .map(Number);

  assert.ok(minLat < 51.5074 && maxLat > 51.5074, 'latitude must contain the city');
  assert.ok(minLon < -0.1278 && maxLon > -0.1278, 'longitude must contain the city');
  assert.ok(minLat >= -90 && maxLat <= 90, 'latitudes stay in range');
  assert.ok(minLon >= -180 && maxLon <= 180, 'longitudes stay in range');
  assert.ok(maxLat - minLat <= 1, 'the box must stay a neighbourhood, not a region');
});

test('a box at the poles and the date line does not wrap around the globe', () => {
  const [, minLat, , maxLat] = C.bboxFor(89.9, 179.9).split(',').map(Number);
  assert.ok(maxLat <= 90, 'the northern edge is clamped to the pole');
  const [minLon, , maxLon] = C.bboxFor(0, 179.9).split(',').map(Number);
  assert.ok(maxLon <= 180 && minLon >= -180, 'the eastern edge is clamped to the date line');
});

test('distance is measured in kilometres, not degrees', () => {
  const london = { latitude: 51.5074, longitude: -0.1278 };
  const paris = { latitude: 48.8566, longitude: 2.3522 };
  const km = C.haversineKm(london, paris);
  assert.ok(km > 300 && km < 380, `expected roughly 340 km, got ${km}`);
  assert.equal(C.haversineKm(london, london), 0);
});

test('a camera the directory reports no position for is not placed at Null Island', () => {
  // `Number(null)` is 0, so a naive parse would sit this camera in the Gulf of
  // Guinea and rank it as the nearest thing to every city on earth.
  assert.equal(C.normalizeCamera(rawCamera({ lat: null, lon: null })), null);
  assert.equal(C.normalizeCamera(rawCamera({ lat: '', lon: '' })), null);
  assert.equal(C.normalizeCamera(rawCamera({ lat: '51.51', lon: '-0.13' })).latitude, 51.51);
});

test('a camera with no coordinates is rejected rather than shown', () => {
  assert.equal(C.normalizeCamera(rawCamera({ lat: 'north-ish', lon: 'there-ish' })), null);
  assert.equal(C.normalizeCamera(rawCamera({ lat: undefined, lon: undefined })), null);
  assert.equal(C.normalizeCamera(rawCamera({ lat: NaN, lon: NaN })), null);
});

test('a feed URL is only accepted when it is really http(s)', () => {
  const script = C.normalizeCamera(rawCamera({ feedUrl: 'javascript:alert(1)' }));
  assert.equal(script, null, 'a javascript: URL is not a camera feed');

  const data = C.normalizeCamera(rawCamera({ feedUrl: 'data:text/html,<script>alert(1)</script>' }));
  assert.equal(data, null, 'a data: URL is not a camera feed');

  const good = C.normalizeCamera(rawCamera());
  assert.equal(good.imageUrl, 'https://example.org/frame.jpg');
});

test('fields the directory adds that we do not understand are dropped, not forwarded', () => {
  const camera = C.normalizeCamera(rawCamera({ somethingUnexpected: '<img onerror=alert(1)>' }));
  assert.equal(camera.somethingUnexpected, undefined);
  assert.deepEqual(
    Object.keys(camera).sort(),
    ['attribution', 'attributionUrl', 'distanceKm', 'id', 'imageUrl', 'kind', 'latitude', 'longitude', 'name', 'pollSeconds', 'proxyOk', 'source', 'streamUrl', 'trustScore'].filter((k) => k in camera).sort(),
    'the normalised shape is closed to whatever the directory sends'
  );
});

test('a camera the directory flags as contradicted is never shown', () => {
  const cameras = C.parseCameraResponse({
    cameras: [
      rawCamera({ id: 'broken', verificationStatus: 'contradicted' }),
      rawCamera({ id: 'fine' }),
    ],
  }, { latitude: 51.5074, longitude: -0.1278 });

  assert.equal(cameras.length, 1);
  assert.equal(cameras[0].id, 'fine');
});

test('cameras are ranked nearest first, and each one carries the distance it was chosen for', () => {
  const cameras = C.parseCameraResponse({
    cameras: [
      rawCamera({ id: 'far', lat: 52.2, lon: -0.2 }),
      rawCamera({ id: 'near', lat: 51.51, lon: -0.13 }),
      rawCamera({ id: 'middling', lat: 51.8, lon: -0.15 }),
    ],
  }, { latitude: 51.5074, longitude: -0.1278 });

  assert.deepEqual(cameras.map((c) => c.id), ['near', 'middling', 'far']);
  assert.ok(cameras[0].distanceKm < 1, 'the near camera is within a kilometre');
  assert.ok(cameras[1].distanceKm > cameras[0].distanceKm, 'distances increase down the list');

  assert.equal(C.pickCamera(cameras).id, 'near');
});

test('no free camera is an empty list and a null pick, not an error', () => {
  const cameras = C.parseCameraResponse({ cameras: [] }, { latitude: 51.5, longitude: -0.12 });
  assert.deepEqual(cameras, []);
  assert.equal(C.pickCamera(cameras), null);
  assert.equal(C.pickCamera(null), null);
});

test('the attribution the licence requires survives onto the camera', () => {
  const camera = C.normalizeCamera(rawCamera());
  assert.equal(camera.source, 'Example Transport Authority');
  assert.equal(camera.attribution, 'Example Transport Authority');
  assert.equal(camera.attributionUrl, 'https://example.org/licence');
});

test('the registry cadence sets the polling interval, with a conservative default', () => {
  const withRegistry = C.normalizeCamera(rawCamera({ registry: registry({ minPollIntervalS: 120 }) }));
  assert.equal(withRegistry.pollSeconds, 120);

  const registryWithNoAdvice = C.normalizeCamera(rawCamera({ registry: registry({ minPollIntervalS: null }) }));
  assert.equal(
    registryWithNoAdvice.pollSeconds,
    C.DEFAULT_POLL_SECONDS,
    'a registry that does not say is given the unhurried default'
  );
});

test('a snapshot is only re-fetched once the source\'s own cadence has elapsed', () => {
  const camera = C.normalizeCamera(rawCamera());
  const base = 1000000;

  // Same instant: no cache-buster, so a repaint reuses the frame already shown.
  assert.equal(C.frameUrl(camera, base, { frameBase: base }), 'https://example.org/frame.jpg');
  assert.equal(C.frameUrl(camera, base + 30000, { frameBase: base }), 'https://example.org/frame.jpg');

  // Past the cadence a new frame is genuinely wanted, so one is asked for.
  const later = C.frameUrl(camera, base + 61000, { frameBase: base });
  assert.match(later, /^https:\/\/example\.org\/frame\.jpg\?ws=\d+$/);
});

test('the very first paint asks for the frame as it stands', () => {
  const camera = C.normalizeCamera(rawCamera());
  // Nothing has been shown yet, so there is no earlier frame to be kept and no
  // cache-buster to add - a plain src is the fetch.
  assert.equal(C.frameUrl(camera, 1000000, { frameBase: 0 }), 'https://example.org/frame.jpg');
  assert.equal(C.frameUrl(camera, 1000000, {}), 'https://example.org/frame.jpg');
});

test('the anonymous budget is read from the exposed header and spent politely', () => {
  assert.equal(C.remainingBudget(null), null, 'no headers is unknown, not zero');

  const headers = { get: (name) => (name.toLowerCase() === 'x-ratelimit-remaining' ? '4' : null) };
  assert.equal(C.remainingBudget(headers), 4);

  assert.equal(C.isBudgetExhausted(null), false, 'an unreadable budget is not an exhausted one');
  assert.equal(C.isBudgetExhausted(60), false);
  assert.equal(C.isBudgetExhausted(C.MIN_REMAINING_BUDGET + 1), false);
  assert.equal(C.isBudgetExhausted(C.MIN_REMAINING_BUDGET), true, 'stop before the directory has to throttle us');
  assert.equal(C.isBudgetExhausted(0), true);
});

test('findCameras asks the directory once, for a box around the city', async () => {
  const calls = [];
  const cameras = await C.findCameras(
    { id: 'london', latitude: 51.5074, longitude: -0.1278 },
    {
      fetchJson: async (url) => {
        calls.push(url);
        return { cameras: [rawCamera({ id: 'near', lat: 51.51, lon: -0.13 })] };
      },
    }
  );

  assert.equal(calls.length, 1, 'exactly one directory request per city');
  assert.match(calls[0], /^https:\/\/datumfeed\.com\/api\/cameras\?/);
  assert.match(calls[0], /bbox=/);
  assert.match(calls[0], /limit=/);
  assert.equal(cameras.length, 1);
  assert.equal(cameras[0].id, 'near');
  assert.ok(cameras[0].distanceKm < 1);
});

test('a directory that fails is treated as "no camera here", not surfaced as an error', async () => {
  const cameras = await C.findCameras(
    { id: 'london', latitude: 51.5074, longitude: -0.1278 },
    { fetchJson: async () => { throw new Error('network down'); } }
  );
  assert.deepEqual(cameras, []);
});

test('a city with no coordinates is never looked up at all', async () => {
  let called = false;
  const cameras = await C.findCameras(
    { id: 'nowhere' },
    {
      fetchJson: async () => {
        called = true;
        return { cameras: [] };
      },
    }
  );
  assert.equal(called, false, 'a city without a position cannot be matched to a camera');
  assert.deepEqual(cameras, []);
});

test('the controller is told the remaining budget so it can stop asking', async () => {
  let budget = 'unset';
  await C.findCameras(
    { id: 'london', latitude: 51.5074, longitude: -0.1278 },
    {
      fetchJson: async () => ({ cameras: [] }),
      responseHeaders: { get: () => '55' },
      onBudget: (remaining) => { budget = remaining; },
    }
  );
  assert.equal(budget, 55);
});

test('the registry cadence map is applied to the cameras it covers', async () => {
  const cameras = await C.findCameras(
    { id: 'london', latitude: 51.5074, longitude: -0.1278 },
    {
      fetchJson: async () => ({ cameras: [rawCamera()] }),
      pollSecondsByRegistry: { 'example-transport': 300 },
    }
  );
  assert.equal(cameras[0].pollSeconds, 300);
});

test('the session cache key is per city and safe to use as a storage key', () => {
  const key = C.cacheKey('san-francisco');
  assert.match(key, /san-francisco$/);
  assert.doesNotMatch(key, /[^a-z0-9_-]/i, 'no characters that would need escaping in a storage key');
  assert.notEqual(C.cacheKey('paris'), C.cacheKey('london'));
});

// ==========================================================================
// Streams: what the browser can actually play
// ==========================================================================

test('a camera that publishes a stream is recognised as one, whatever it calls the field', () => {
  const mjpeg = C.normalizeCamera(rawCamera({ feedUrl: null, streamUrl: 'https://example.org/live' }));
  assert.equal(mjpeg.kind, 'mjpeg');
  assert.equal(mjpeg.streamUrl, 'https://example.org/live');
  // For MJPEG the stream *is* the image source - that is how MJPEG is played.
  assert.equal(mjpeg.imageUrl, 'https://example.org/live');
  assert.equal(C.isStream(mjpeg), true);

  const hls = C.normalizeCamera(rawCamera({ feedUrl: null, hlsUrl: 'https://example.org/live/index.m3u8' }));
  assert.equal(hls.kind, 'hls');
  assert.equal(hls.streamUrl, 'https://example.org/live/index.m3u8');
  // An HLS camera needs no still: the poster is optional, so `imageUrl` is null
  // and the app plays it in a <video> rather than pretending to have a frame.
  assert.equal(hls.imageUrl, null);
  assert.equal(C.isStream(hls), true);

  const file = C.normalizeCamera(rawCamera({ streamUrl: 'https://example.org/live.mp4' }));
  assert.equal(file.kind, 'file');

  const snapshot = C.normalizeCamera(rawCamera());
  assert.equal(snapshot.kind, 'snapshot');
  assert.equal(C.isStream(snapshot), false);
});

test('the content type decides what a stream is, not the extension alone', () => {
  const typed = C.normalizeCamera(rawCamera({
    feedUrl: null,
    streamUrl: 'https://example.org/channel',
    streamContentType: 'application/vnd.apple.mpegurl',
  }));
  assert.equal(typed.kind, 'hls');
});

test('a camera with neither a stream nor a still is not a camera we can render', () => {
  assert.equal(C.normalizeCamera(rawCamera({ feedUrl: null })), null);
  assert.equal(C.normalizeCamera(rawCamera({ feedUrl: null, streamUrl: 'javascript:alert(1)' })), null);
});

test('a stream is never cache-busted, because that would restart it every tick', () => {
  const camera = C.normalizeCamera(rawCamera({ feedUrl: null, streamUrl: 'https://example.org/live' }));
  // Even long past any cadence, the poller must hand the browser the same URL:
  // the stream keeps pushing frames on its own.
  assert.equal(C.frameUrl(camera, 5000000, { frameBase: 0 }), 'https://example.org/live');
  assert.equal(C.frameUrl(camera, 5000000, { frameBase: 1000 }), 'https://example.org/live');
});

test('the poller asks for a new still unconditionally, because its clock already answered', () => {
  // This is the frozen-frame regression at the engine level: `frameUrl` given a
  // base of "now" always says "not yet", so a poller that trusted it never asked
  // for anything new. `nextFrameUrl` is the unconditional answer.
  const camera = C.normalizeCamera(rawCamera());
  assert.equal(C.frameUrl(camera, 2000000, { frameBase: 2000000 }), 'https://example.org/frame.jpg');

  const fresh = C.nextFrameUrl(camera, 2000000);
  assert.notEqual(fresh, 'https://example.org/frame.jpg');
  assert.match(fresh, /^https:\/\/example\.org\/frame\.jpg\?ws=2000000$/);

  // A URL that already carries a query gets a second parameter, not a second `?`.
  const withQuery = C.normalizeCamera(rawCamera({ feedUrl: 'https://example.org/frame.jpg?v=2' }));
  assert.match(C.nextFrameUrl(withQuery, 5), /\?v=2&ws=5$/);
});

test('two polls inside the same millisecond still produce two different URLs', () => {
  // Millisecond stamps are not enough on their own: a throttled tab can catch up
  // with two ticks before the clock has moved, and the browser would answer the
  // second one from the cache the first one filled.
  const camera = C.normalizeCamera(rawCamera());
  const first = C.nextFrameUrl(camera, 4242);
  const second = C.nextFrameUrl(camera, 4242);

  assert.notEqual(second, first, 'the same frame URL was handed out twice');
  assert.match(second, /\?ws=\d+$/);
  const stamp = (url) => Number(String(url).split('ws=')[1]);
  assert.ok(stamp(second) > stamp(first), 'the cache-buster did not move forward');
});

test('frameIsCurrent answers "may this frame be reused?" and defaults to no', () => {
  const camera = C.normalizeCamera(rawCamera());  // the fixture's registry asks for 60s
  const base = 1000000;

  assert.equal(C.frameIsCurrent(camera, base + 59000, { frameBase: base }), true,
    'a frame inside the cadence is not being re-fetched');
  assert.equal(C.frameIsCurrent(camera, base + 60000, { frameBase: base }), false,
    'a frame past the cadence is stale');

  // Nothing known on screen: nothing may be reused, or the browser answers with
  // the copy it cached before the panel was released.
  assert.equal(C.frameIsCurrent(camera, base, { frameBase: 0 }), false);
  assert.equal(C.frameIsCurrent(camera, base, {}), false);
  assert.equal(C.frameIsCurrent(camera, base, { frameBase: 'nonsense' }), false);
  assert.equal(C.frameIsCurrent(null, base, { frameBase: base }), false);

  // A stream is never stale: the browser is holding it open already.
  const stream = C.normalizeCamera(rawCamera({ feedUrl: null, streamUrl: 'https://example.org/live' }));
  assert.equal(C.frameIsCurrent(stream, base + 10 * 60 * 1000, { frameBase: base }), true);
});

test('a source asking to be polled absurdly often is floored, not obeyed', () => {
  const camera = C.normalizeCamera(rawCamera({ registry: { slug: 'eager', name: 'Eager', minPollIntervalS: 1 } }));
  assert.equal(camera.pollSeconds, 1);
  // 1s is what the registry asked for and 15s is what the app will do.
  assert.equal(C.frameIsCurrent(camera, 1000000 + 14000, { frameBase: 1000000 }), true);
  assert.equal(C.frameIsCurrent(camera, 1000000 + 16000, { frameBase: 1000000 }), false);
});

test('a camera that can play is chosen over an equally close still, but not over a near one', () => {
  const still = Object.assign(C.normalizeCamera(rawCamera({ id: 'still', lat: 51.5, lon: -0.12 })), { distanceKm: 1 });
  const stream = Object.assign(
    C.normalizeCamera(rawCamera({ id: 'stream', lat: 51.51, lon: -0.13, feedUrl: null, streamUrl: 'https://example.org/live' })),
    { distanceKm: 2 }
  );
  const distantStream = Object.assign(
    C.normalizeCamera(rawCamera({ id: 'far', lat: 52.0, lon: -0.1, feedUrl: null, streamUrl: 'https://example.org/live2' })),
    { distanceKm: 60 }
  );

  assert.equal(C.pickCamera([still, stream]).id, 'still', 'nearest first, always');
  assert.equal(C.bestCamera([still, stream]).id, 'stream', 'a moving view beats a still at the same distance');
  assert.equal(C.bestCamera([still, distantStream]).id, 'still',
    'past the preference radius, "nearest" has to mean nearest again');
  assert.equal(C.bestCamera([stream, still]).id, 'stream', 'a stream that is nearest is simply kept');
  assert.equal(C.bestCamera([]), null);
});

test('the registry index becomes one honest, de-duplicated entry per covered city', () => {
  const catalogue = C.catalogRegions([
    {
      slug: 'ontario-511', name: 'Ontario 511', city: 'ontario', country: 'CA',
      cities: ['hamilton', 'toronto', 'niagara falls'], activeCameras: 1200,
      attribution: 'Ontario 511', licenseUrl: 'https://example.org/licence', minPollIntervalS: 60,
    },
    {
      slug: 'toronto-city', name: 'City of Toronto', city: 'toronto', country: 'CA',
      cities: ['toronto'], activeCameras: 300,
      attribution: 'City of Toronto', licenseUrl: 'https://example.org/toronto', minPollIntervalS: 300,
    },
  ]);

  assert.deepEqual(catalogue.map((entry) => entry.query), ['hamilton', 'toronto', 'niagara-falls']);
  assert.equal(catalogue[0].name, 'Hamilton');
  assert.equal(catalogue[0].flag, '🇨🇦');
  assert.equal(catalogue[0].pollSeconds, 60);
  assert.equal(catalogue[1].registry, 'ontario-511', 'the first publishing registry owns the deduplicated city');
  assert.equal(Object.hasOwn(catalogue[0], 'count'), false, 'registry-wide totals are never misrepresented as city totals');
});

test('the camera city catalogue groups by registry and filters names without regard to case', () => {
  const catalogue = [
    { query: 'san-francisco', name: 'San Francisco', registry: 'cal', registryName: 'Caltrans', country: 'US' },
    { query: 'san-diego', name: 'San Diego', registry: 'cal', registryName: 'Caltrans', country: 'US' },
    { query: 'london', name: 'London', registry: 'tfl', registryName: 'Transport for London', country: 'GB' },
  ];
  const groups = C.groupRegionsByRegistry(catalogue);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].cities.map((entry) => entry.name), ['San Francisco', 'San Diego']);
  assert.deepEqual(C.filterRegions(catalogue, 'SAN').map((entry) => entry.name), ['San Francisco', 'San Diego']);
  assert.deepEqual(C.filterRegions(catalogue, '').map((entry) => entry.name), ['San Francisco', 'San Diego', 'London']);
});

test('catalogue slugs are safe directory queries and frame URLs encode camera ids', () => {
  assert.equal(C.regionQuery('San Francisco'), 'san-francisco');
  assert.equal(C.regionTitle('san-francisco'), 'San Francisco');
  assert.equal(C.frameProxyUrl({ id: 'tfl-00001.01251' }), 'https://datumfeed.com/api/cameras/tfl-00001.01251/frame');
  assert.equal(C.frameProxyUrl('a/b'), 'https://datumfeed.com/api/cameras/a%2Fb/frame');
  assert.equal(C.imageSource({ id: 'cam 1', imageUrl: 'https://source.example/image.jpg' }),
    'https://datumfeed.com/api/cameras/cam%201/frame');
  const nonProxyable = C.normalizeCamera(rawCamera({ registry: registry({ proxyOk: false }) }));
  assert.equal(C.imageSource(nonProxyable), 'https://example.org/frame.jpg',
    'a registry that does not permit proxying is rendered directly');
});

test('findRegionCameras asks the directory to resolve its catalogued city and caps the wall', async () => {
  let requested;
  let resolved;
  const raw = Array.from({ length: 13 }, (_, index) => rawCamera({ id: `camera-${index}` }));
  const cameras = await C.findRegionCameras('San Francisco', {
    fetchJson: async (url) => {
      requested = url;
      return { cameras: raw, resolved: { city: 'san francisco' } };
    },
    onResolved: (value) => { resolved = value; },
  });

  assert.match(requested, /\?city=san-francisco&limit=30&minTrust=10/);
  assert.equal(cameras.length, C.REGION_CANDIDATE_LIMIT);
  assert.equal(resolved.city, 'san francisco');
});
