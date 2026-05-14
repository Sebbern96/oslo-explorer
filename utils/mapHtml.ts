const DARK_STYLE = JSON.stringify([
  { elementType: "geometry", stylers: [{ color: "#1e2038" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1e2038" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9090c0" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#383862" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e1e40" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7070a0" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a4a80" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#a0a0d0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#1a3d6e" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a7aaa" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1e2038" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#383862" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#404070" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#a0a0d0" }] },
]);

export function buildMapHtml(apiKey: string, poisJson: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #0a0a14; }
    .player-overlay {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: none;
      width: 44px;
      height: 44px;
    }
    .pulse-ring {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid rgba(74,158,255,0.75);
      animation: pulse-anim 2s ease-out infinite;
    }
    .player-dot {
      position: absolute;
      width: 16px;
      height: 16px;
      background: #4a9eff;
      border: 2.5px solid #ffffff;
      border-radius: 50%;
      top: 14px;
      left: 14px;
      box-shadow: 0 0 10px rgba(74,158,255,0.9);
    }
    @keyframes pulse-anim {
      0%   { transform: scale(0.3); opacity: 0.9; }
      60%  { opacity: 0.3; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
const TILE_SIZE = 0.005;
const POI_DATA = ${poisJson};
const DARK_STYLE = ${DARK_STYLE};
const CATEGORY_COLORS = {
  kultur:     '#a855f7',
  park:       '#22c55e',
  landemerke: '#f97316',
  museum:     '#06b6d4',
  mat_drikke: '#f4b942',
  restaurant: '#ef4444',
  bar:        '#ec4899',
};

let map, fogPolygon, PlayerOverlayClass, playerOverlay;
const poiMarkers = {};
let playerPos = null;
let visitedKeys = new Set();
let discoveredPOIs = [];
const queue = [];
let mapReady = false;

function initMap() {
  PlayerOverlayClass = class extends google.maps.OverlayView {
    constructor() { super(); this._pos = null; this._el = null; }
    onAdd() {
      const el = document.createElement('div');
      el.className = 'player-overlay';
      el.innerHTML = '<div class="pulse-ring"></div><div class="player-dot"></div>';
      this._el = el;
      this.getPanes().floatPane.appendChild(el);
    }
    draw() {
      if (!this._pos || !this._el) return;
      const p = this.getProjection().fromLatLngToDivPixel(this._pos);
      if (p) { this._el.style.left = p.x + 'px'; this._el.style.top = p.y + 'px'; }
    }
    onRemove() {
      if (this._el && this._el.parentNode) { this._el.parentNode.removeChild(this._el); this._el = null; }
    }
    setPosition(lat, lng) {
      this._pos = new google.maps.LatLng(lat, lng);
      this.draw();
    }
  };

  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 59.9139, lng: 10.7522 },
    zoom: 16,
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

function tileCircle(iLat, iLng) {
  const centerLat = (iLat + 0.5) * TILE_SIZE;
  const centerLng = (iLng + 0.5) * TILE_SIZE;
  const rLat = TILE_SIZE * 0.35;
  const lngScale = 1 / Math.cos(centerLat * Math.PI / 180);
  const N = 32;
  return Array.from({ length: N }, (_, i) => {
    const a = (i / N) * 2 * Math.PI;
    return { lat: centerLat + rLat * Math.sin(a), lng: centerLng + rLat * lngScale * Math.cos(a) };
  });
}

function buildFog() {
  if (fogPolygon) fogPolygon.setMap(null);
  const paths = [
    [{ lat: 73, lng: 2 }, { lat: 73, lng: 33 }, { lat: 55, lng: 33 }, { lat: 55, lng: 2 }],
    ...[...visitedKeys].map(key => {
      const [iLat, iLng] = key.split('_').map(Number);
      return tileCircle(iLat, iLng);
    }),
  ];
  fogPolygon = new google.maps.Polygon({
    paths,
    fillColor: '#000000',
    fillOpacity: 0.88,
    strokeWeight: 0,
    clickable: false,
    map,
  });
}

function poiTileKey(poi) {
  return Math.floor(poi.latitude / TILE_SIZE) + '_' + Math.floor(poi.longitude / TILE_SIZE);
}

function updateMarkerVisibility() {
  Object.values(poiMarkers).forEach(({ marker, poi, discovered }) => {
    if (discovered) return;
    marker.setVisible(visitedKeys.has(poiTileKey(poi)));
  });
}

function buildPOIMarkers() {
  POI_DATA.forEach(poi => {
    const catColor = CATEGORY_COLORS[poi.category] || '#5050a0';
    const marker = new google.maps.Marker({
      position: { lat: poi.latitude, lng: poi.longitude },
      map,
      visible: false,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#0e0e1e',
        fillOpacity: 1,
        strokeColor: catColor,
        strokeWeight: 2,
      },
      label: { text: '?', color: catColor, fontWeight: 'bold', fontSize: '13px' },
      zIndex: 10,
    });
    marker.addListener('click', () => {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'poi_tap', poiId: poi.id }));
      }
    });
    poiMarkers[poi.id] = { marker, poi, discovered: false };
  });
}

function revealPOI(poiId) {
  const entry = poiMarkers[poiId];
  if (!entry || entry.discovered) return;
  entry.discovered = true;
  const catColor = CATEGORY_COLORS[entry.poi.category] || '#f4b942';
  entry.marker.setIcon({
    path: google.maps.SymbolPath.CIRCLE,
    scale: 11,
    fillColor: catColor,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  });
  entry.marker.setLabel({
    text: entry.poi.name.charAt(0).toUpperCase(),
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '12px',
  });
  entry.marker.setZIndex(20);
  entry.marker.setVisible(true);
}

function updatePlayer(lat, lng) {
  playerPos = { lat, lng };
  map.setCenter(playerPos);
  if (!playerOverlay) {
    playerOverlay = new PlayerOverlayClass();
    playerOverlay.setMap(map);
  }
  playerOverlay.setPosition(lat, lng);
}

function handle(msg) {
  if (msg.type === 'state') {
    visitedKeys = new Set(msg.visitedKeys);
    discoveredPOIs = msg.discoveredPOIs;
    buildFog();
    discoveredPOIs.forEach(revealPOI);
    updateMarkerVisibility();
    if (msg.latitude) updatePlayer(msg.latitude, msg.longitude);
  } else if (msg.type === 'position') {
    updatePlayer(msg.latitude, msg.longitude);
  } else if (msg.type === 'tile') {
    visitedKeys.add(msg.key);
    buildFog();
    updateMarkerVisibility();
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
