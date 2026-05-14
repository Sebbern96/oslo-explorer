const DARK_STYLE = JSON.stringify([
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7070a0" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a42" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#14142a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#5a5a80" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a5e" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#8080b0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1b2a" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3a4a5a" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2a2a42" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#3a3a5e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#9090c0" }] },
]);

export function buildMapHtml(apiKey: string, poisJson: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #0a0a14; }
  #debug { position: absolute; top: 0; left: 0; z-index: 9999; background: red; color: white; font-size: 12px; padding: 4px; }
  </style>
</head>
<body>
<div id="debug">KEY: ${apiKey ? apiKey.substring(0, 8) + "..." : "EMPTY"}</div>
<div id="map"></div>
<script>
const TILE_SIZE = 0.005;
const POI_DATA = ${poisJson};
const DARK_STYLE = ${DARK_STYLE};

let map, fogPolygon, playerMarker;
const poiMarkers = {};
let playerPos = null;
let visitedKeys = new Set();
let discoveredPOIs = [];
const queue = [];
let mapReady = false;

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 59.9139, lng: 10.7522 },
    zoom: 15,
    styles: DARK_STYLE,
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    clickableIcons: false,
  });

  google.maps.event.addListener(map, 'drag', () => {
    if (playerPos) map.setCenter(playerPos);
  });

  buildFog();
  buildPOIMarkers();

  mapReady = true;
  queue.forEach(handle);
  queue.length = 0;

  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  }
}

function buildFog() {
  if (fogPolygon) fogPolygon.setMap(null);
  const paths = [
    [{ lat: 85, lng: -180 }, { lat: 85, lng: 180 }, { lat: -85, lng: 180 }, { lat: -85, lng: -180 }],
    ...[...visitedKeys].map(key => {
      const [iLat, iLng] = key.split('_').map(Number);
      const lat = iLat * TILE_SIZE;
      const lng = iLng * TILE_SIZE;
      return [
        { lat, lng },
        { lat, lng: lng + TILE_SIZE },
        { lat: lat + TILE_SIZE, lng: lng + TILE_SIZE },
        { lat: lat + TILE_SIZE, lng },
      ];
    }),
  ];
  fogPolygon = new google.maps.Polygon({
    paths,
    fillColor: '#0a0a14',
    fillOpacity: 0.93,
    strokeWeight: 0,
    clickable: false,
    map,
  });
}

function buildPOIMarkers() {
  POI_DATA.forEach(poi => {
    const marker = new google.maps.Marker({
      position: { lat: poi.latitude, lng: poi.longitude },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#1a1a30',
        fillOpacity: 0.95,
        strokeColor: '#5050a0',
        strokeWeight: 1.5,
      },
      label: { text: '?', color: '#7070c0', fontWeight: 'bold', fontSize: '13px' },
      zIndex: 10,
    });
    poiMarkers[poi.id] = { marker, poi, discovered: false };
  });
}

function revealPOI(poiId) {
  const entry = poiMarkers[poiId];
  if (!entry || entry.discovered) return;
  entry.discovered = true;
  entry.marker.setIcon({
    path: google.maps.SymbolPath.CIRCLE,
    scale: 11,
    fillColor: '#4285f4',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  });
  entry.marker.setLabel({
    text: entry.poi.name.charAt(0).toUpperCase(),
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '12px',
  });
  entry.marker.setZIndex(20);
}

function updatePlayer(lat, lng) {
  playerPos = { lat, lng };
  map.setCenter(playerPos);
  if (!playerMarker) {
    playerMarker = new google.maps.Marker({
      position: playerPos,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#4285f4',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2.5,
      },
      zIndex: 1000,
    });
  } else {
    playerMarker.setPosition(playerPos);
  }
}

function handle(msg) {
  if (msg.type === 'state') {
    visitedKeys = new Set(msg.visitedKeys);
    discoveredPOIs = msg.discoveredPOIs;
    buildFog();
    discoveredPOIs.forEach(revealPOI);
    if (msg.latitude) updatePlayer(msg.latitude, msg.longitude);
  } else if (msg.type === 'position') {
    updatePlayer(msg.latitude, msg.longitude);
  } else if (msg.type === 'tile') {
    visitedKeys.add(msg.key);
    buildFog();
  } else if (msg.type === 'poi') {
    revealPOI(msg.poiId);
  }
}

window.handleMessage = function(data) {
  if (mapReady) handle(data);
  else queue.push(data);
};
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap" async defer></script>
</body>
</html>`;
}
