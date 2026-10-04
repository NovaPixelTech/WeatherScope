'use strict';
/**
 * Live probe against the real camera directory. Not part of `node --test` -
 * run it by hand when the directory's shape changes:
 *
 *   node tools/probe-cameras.js
 */
const C = require('../cameras.js');

async function main() {
  const cities = [
    { id: 'london', latitude: 51.5074, longitude: -0.1278 },
    { id: 'new-york', latitude: 40.7128, longitude: -74.006 },
    { id: 'sydney', latitude: -33.8688, longitude: 151.2093 },
    { id: 'rural-namibia', latitude: -22.9576, longitude: 18.4902 },
  ];

  let headers = null;
  const fetchJson = async (url) => {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    headers = res.headers;
    console.log(`  ${res.status} ${url}`);
    console.log(`  rate-limit-remaining: ${res.headers.get('x-ratelimit-remaining')}`);
    return res.json();
  };

  for (const city of cities) {
    console.log(`\n=== ${city.id} ===`);
    const cameras = await C.findCameras(city, { fetchJson, responseHeaders: headers });
    console.log(`  ${cameras.length} camera(s)`);
    cameras.slice(0, 3).forEach((c) => {
      console.log(`  - ${c.name} (${c.source}) ${c.distanceKm} km, poll ${c.pollSeconds}s, trust ${c.trustScore}`);
      console.log(`    feed: ${c.imageUrl}`);
      console.log(`    attribution: ${c.attribution} ${c.attributionUrl || ''}`);
    });
    const picked = C.pickCamera(cameras);
    if (picked) {
      const url = C.frameUrl(picked, Date.now(), { frameBase: 0 });
      const res = await fetch(url);
      console.log(`  frame: ${res.status} ${res.headers.get('content-type')} ${res.headers.get('content-length')} bytes`);
    }
  }

  const reg = await fetchJson(C.DIRECTORY_ENDPOINT.replace('/cameras', '/registries'));
  const list = Array.isArray(reg) ? reg : (reg.registries || []);
  console.log(`\n=== registries: ${list.length} ===`);
  list.slice(0, 5).forEach((r) => console.log(`  ${r.slug}: minPollIntervalS=${r.minPollIntervalS}`));
}

main().catch((err) => { console.error('probe failed:', err.message); process.exit(1); });
