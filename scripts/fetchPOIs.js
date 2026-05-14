#!/usr/bin/env node
// Usage: node scripts/fetchPOIs.js
// Fetches Oslo POIs + bydel boundaries from OpenStreetMap.
// Writes data/locations.json (with bydelId) and data/bydeler.json.

const https = require('https');
const fs = require('fs');
const path = require('path');

const BBOX = '59.80,10.40,60.10,10.95';
const BYDEL_BBOX = '59.80,10.40,60.10,10.95';

const OSLO_BYDELER = new Set([
  'Gamle Oslo', 'Grünerløkka', 'Sagene', 'St. Hanshaugen', 'Frogner',
  'Ullern', 'Vestre Aker', 'Nordre Aker', 'Bjerke', 'Grorud',
  'Stovner', 'Alna', 'Østensjø', 'Nordstrand', 'Søndre Nordstrand',
  'Sentrum', 'Marka',
]);
const LOCATIONS_FILE = path.join(__dirname, '..', 'data', 'locations.json');
const BYDELER_FILE = path.join(__dirname, '..', 'data', 'bydeler.json');
const BYDELER_RUNTIME_FILE = path.join(__dirname, '..', 'data', 'bydeler_runtime.json');

const CATEGORY_CAP = { restaurant: 40, bar: 40, mat_drikke: 20 };

const POI_QUERY = `
[out:json][timeout:60];
(
  node["tourism"="museum"](${BBOX});
  way["tourism"="museum"](${BBOX});
  node["tourism"="gallery"](${BBOX});
  way["tourism"="gallery"](${BBOX});
  node["tourism"="attraction"](${BBOX});
  way["tourism"="attraction"](${BBOX});
  node["tourism"="monument"](${BBOX});
  node["historic"="monument"](${BBOX});
  node["historic"="memorial"](${BBOX});
  node["historic"="castle"](${BBOX});
  way["historic"="castle"](${BBOX});
  node["historic"="ruins"](${BBOX});
  node["leisure"="park"](${BBOX});
  way["leisure"="park"](${BBOX});
  way["leisure"="garden"](${BBOX});
  node["amenity"="theatre"](${BBOX});
  way["amenity"="theatre"](${BBOX});
  node["amenity"="cinema"](${BBOX});
  node["amenity"="arts_centre"](${BBOX});
  node["amenity"="library"](${BBOX});
  node["amenity"="restaurant"](${BBOX});
  node["amenity"="bar"](${BBOX});
  node["amenity"="pub"](${BBOX});
  node["amenity"="nightclub"](${BBOX});
  node["amenity"="cafe"]["cuisine"](${BBOX});
  node["amenity"="marketplace"](${BBOX});
);
out center;
`.trim();

const BYDEL_QUERY = `
[out:json][timeout:60];
(
  relation["admin_level"="9"]["boundary"="administrative"](${BYDEL_BBOX});
);
out geom;
`.trim();

function getCategory(tags) {
  const { tourism, amenity, leisure, historic } = tags;
  if (tourism === 'museum' || tourism === 'gallery') return 'museum';
  if (tourism === 'attraction' || tourism === 'monument') return 'landemerke';
  if (historic) return 'landemerke';
  if (leisure === 'park' || leisure === 'garden') return 'park';
  if (amenity === 'theatre' || amenity === 'cinema' || amenity === 'arts_centre') return 'kultur';
  if (amenity === 'library') return 'kultur';
  if (amenity === 'restaurant') return 'restaurant';
  if (amenity === 'bar' || amenity === 'pub' || amenity === 'nightclub') return 'bar';
  if (amenity === 'cafe' || amenity === 'marketplace') return 'mat_drikke';
  return null;
}

function getCoords(el) {
  if (el.type === 'node') return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function deduplicate(pois) {
  const kept = [];
  for (const poi of pois) {
    const clash = kept.some(
      k =>
        Math.abs(k.latitude - poi.latitude) < 0.001 &&
        Math.abs(k.longitude - poi.longitude) < 0.001 &&
        k.category === poi.category
    );
    if (!clash) kept.push(poi);
  }
  return kept;
}

// Stitch outer-role way members into a single coordinate array, then simplify.
function extractPolygon(relation, step = 2) {
  const outerWays = relation.members.filter(m => m.type === 'way' && m.role === 'outer');
  const all = outerWays.flatMap(w => (w.geometry || []).map(p => [p.lat, p.lon]));
  return all.filter((_, i) => i % step === 0);
}

// Ray-casting point-in-polygon. polygon = [[lat, lng], ...]
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    if (
      (latI > lat) !== (latJ > lat) &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function bydelCentroid(b) {
  const latSum = b.polygon.reduce((s, p) => s + p[0], 0);
  const lngSum = b.polygon.reduce((s, p) => s + p[1], 0);
  return { lat: latSum / b.polygon.length, lng: lngSum / b.polygon.length };
}

// Fallback: nearest bydel centroid within 0.05° (~4km). Handles mis-stitched OSM rings.
function nearestBydel(lat, lng, bydeler) {
  let best = null, bestDist = 0.05;
  for (const b of bydeler) {
    const c = bydelCentroid(b);
    const d = Math.hypot(lat - c.lat, lng - c.lng);
    if (d < bestDist) { bestDist = d; best = b; }
  }
  return best;
}

const MIRRORS = [
  'overpass.kumi.systems',
  'overpass-api.de',
  'lz4.overpass-api.de',
];

function fetchOverpass(query, hostname = MIRRORS[0]) {
  return new Promise((resolve, reject) => {
    const body = 'data=' + encodeURIComponent(query);
    const req = https.request(
      {
        hostname,
        path: '/api/interpreter',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'oslo-explorer-poi-fetcher/1.0',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error(`[${hostname}] Bad response: ` + data.slice(0, 200))); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchWithFallback(query) {
  for (const mirror of MIRRORS) {
    try {
      process.stdout.write(`  trying ${mirror}... `);
      const result = await fetchOverpass(query, mirror);
      console.log('ok');
      return result;
    } catch (e) {
      console.log('failed: ' + e.message.slice(0, 80));
    }
  }
  throw new Error('All mirrors failed');
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  // --- Bydeler ---
  console.log('Fetching bydel boundaries...');
  const bydelResult = await fetchWithFallback(BYDEL_QUERY).catch(e => {
    console.error('Bydel fetch failed:', e.message); process.exit(1);
  });

  const bydeler = bydelResult.elements
    .filter(el => el.type === 'relation' && el.tags?.name && OSLO_BYDELER.has(el.tags.name))
    .map((el, i) => ({
      id: i + 1,
      name: el.tags.name,
      polygon: extractPolygon(el),
    }))
    .filter(b => b.polygon.length > 10);

  console.log(`${bydeler.length} bydeler found: ${bydeler.map(b => b.name).join(', ')}`);
  fs.writeFileSync(BYDELER_FILE, JSON.stringify(bydeler, null, 2));
  console.log(`Written to ${BYDELER_FILE}`);

  // Rounded to 4 dp (~11m) for the app bundle — reduces file size significantly
  const bydelRuntime = bydeler.map(b => ({
    ...b,
    polygon: b.polygon.map(([lat, lng]) => [
      Math.round(lat * 10000) / 10000,
      Math.round(lng * 10000) / 10000,
    ]),
  }));
  fs.writeFileSync(BYDELER_RUNTIME_FILE, JSON.stringify(bydelRuntime));
  console.log(`Written to ${BYDELER_RUNTIME_FILE}`);

  // --- POIs ---
  await sleep(2000);
  console.log('\nFetching POIs...');
  const poiResult = await fetchWithFallback(POI_QUERY).catch(e => {
    console.error('POI fetch failed:', e.message); process.exit(1);
  });

  console.log(`${poiResult.elements.length} raw elements received`);

  const raw = [];
  for (const el of poiResult.elements) {
    const tags = el.tags ?? {};
    const name = (tags.name ?? tags['name:no'] ?? '').trim();
    if (!name) continue;
    const category = getCategory(tags);
    if (!category) continue;
    const coords = getCoords(el);
    if (!coords) continue;
    raw.push({ name, category, latitude: coords.lat, longitude: coords.lng });
  }

  const deduped = deduplicate(raw);

  const catCount = {};
  const capped = [];
  for (const poi of deduped) {
    catCount[poi.category] = (catCount[poi.category] ?? 0) + 1;
    const cap = CATEGORY_CAP[poi.category];
    if (cap && catCount[poi.category] > cap) continue;
    capped.push(poi);
  }

  // Assign bydelId — PIP first, nearest-centroid fallback for mis-stitched OSM rings
  const withBydel = capped.map(poi => {
    const bydel =
      bydeler.find(b => pointInPolygon(poi.latitude, poi.longitude, b.polygon)) ??
      nearestBydel(poi.latitude, poi.longitude, bydeler);
    return { ...poi, bydelId: bydel?.id ?? null };
  });

  const output = withBydel.map((poi, i) => ({ id: i + 1, ...poi }));

  const summary = {};
  output.forEach(p => (summary[p.category] = (summary[p.category] ?? 0) + 1));
  console.log('\nCategory breakdown:');
  Object.entries(summary).sort().forEach(([cat, n]) => console.log(`  ${cat}: ${n}`));

  const unassigned = output.filter(p => p.bydelId === null).length;
  if (unassigned > 0) console.log(`\nNote: ${unassigned} POIs outside bydel boundaries (bydelId: null)`);
  console.log(`\nTotal: ${output.length} POIs`);

  fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(output, null, 2));
  console.log(`Written to ${LOCATIONS_FILE}`);
}

main();
