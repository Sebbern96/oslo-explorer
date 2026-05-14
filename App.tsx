import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon, UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import locationsData from "./data/locations.json";

const TILE_SIZE = 0.005;
const RENDER_RADIUS = 0.05;
const CAMERA_DELTA = 0.015;
const TILES_URI = FileSystem.documentDirectory + "visitedTiles.json";
const POIS_URI = FileSystem.documentDirectory + "discoveredPOIs.json";

async function fsRead<T>(uri: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await FileSystem.readAsStringAsync(uri));
  } catch {
    return fallback;
  }
}

function fsSave(uri: string, data: unknown): void {
  FileSystem.writeAsStringAsync(uri, JSON.stringify(data));
}

function tileKey(iLat: number, iLng: number): string {
  return `${iLat}_${iLng}`;
}

function getUnvisitedTiles(
  playerLat: number,
  playerLng: number,
  visitedKeys: Set<string>,
) {
  const latStart = Math.floor((playerLat - RENDER_RADIUS) / TILE_SIZE);
  const latEnd = Math.ceil((playerLat + RENDER_RADIUS) / TILE_SIZE);
  const lngStart = Math.floor((playerLng - RENDER_RADIUS) / TILE_SIZE);
  const lngEnd = Math.ceil((playerLng + RENDER_RADIUS) / TILE_SIZE);

  const tiles: { key: string; coords: { latitude: number; longitude: number }[] }[] = [];

  for (let iLat = latStart; iLat < latEnd; iLat++) {
    for (let iLng = lngStart; iLng < lngEnd; iLng++) {
      const key = tileKey(iLat, iLng);
      if (!visitedKeys.has(key)) {
        const lat = iLat * TILE_SIZE;
        const lng = iLng * TILE_SIZE;
        tiles.push({
          key,
          coords: [
            { latitude: lat, longitude: lng },
            { latitude: lat + TILE_SIZE, longitude: lng },
            { latitude: lat + TILE_SIZE, longitude: lng + TILE_SIZE },
            { latitude: lat, longitude: lng + TILE_SIZE },
          ],
        });
      }
    }
  }
  return tiles;
}

export default function App() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [visitedKeys, setVisitedKeys] = useState<Set<string>>(new Set());
  const [discoveredPOIs, setDiscoveredPOIs] = useState<number[]>([]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    async function init() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const [savedKeys, savedPOIs] = await Promise.all([
        fsRead<string[]>(TILES_URI, []),
        fsRead<number[]>(POIS_URI, []),
      ]);

      setVisitedKeys(new Set(savedKeys));
      setDiscoveredPOIs(savedPOIs);

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation },
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocation({ latitude, longitude });

          const iLat = Math.floor(latitude / TILE_SIZE);
          const iLng = Math.floor(longitude / TILE_SIZE);
          const key = tileKey(iLat, iLng);

          setVisitedKeys((prev) => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            fsSave(TILES_URI, [...next]);
            return next;
          });

          setDiscoveredPOIs((prev) => {
            const found = locationsData
              .filter(
                (poi) =>
                  !prev.includes(poi.id) &&
                  Math.abs(latitude - poi.latitude) < 0.0025 &&
                  Math.abs(longitude - poi.longitude) < 0.0025,
              )
              .map((poi) => poi.id);
            if (!found.length) return prev;
            const next = [...prev, ...found];
            fsSave(POIS_URI, next);
            return next;
          });
        },
      );
    }

    init();
    return () => { subscription?.remove(); };
  }, []);

  if (!location) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Henter posisjon...</Text>
      </View>
    );
  }

  const fogTiles = getUnvisitedTiles(location.latitude, location.longitude, visitedKeys);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        mapType="none"
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: CAMERA_DELTA,
          longitudeDelta: CAMERA_DELTA,
        }}
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        zoomEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />

        <Marker
          coordinate={location}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.playerRing}>
            <View style={styles.playerDot} />
          </View>
        </Marker>

        {fogTiles.map((tile) => (
          <Polygon
            key={tile.key}
            coordinates={tile.coords}
            fillColor="rgba(10,10,20,0.95)"
            strokeColor="rgba(10,10,20,0.95)"
            strokeWidth={1}
          />
        ))}

        {locationsData.map((poi) =>
          discoveredPOIs.includes(poi.id) ? (
            <Marker
              key={`poi-${poi.id}`}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              title={poi.name}
              description={poi.category}
              tracksViewChanges={false}
            />
          ) : (
            <Marker
              key={`poi-${poi.id}`}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.unknownMarker}>
                <Text style={styles.unknownText}>?</Text>
              </View>
            </Marker>
          ),
        )}
      </MapView>

      <View style={styles.hud}>
        <View style={styles.hudItem}>
          <Text style={styles.hudValue}>{visitedKeys.size}</Text>
          <Text style={styles.hudLabel}>Ruter</Text>
        </View>
        <View style={styles.hudDivider} />
        <View style={styles.hudItem}>
          <Text style={styles.hudValue}>{discoveredPOIs.length}</Text>
          <Text style={styles.hudLabel}>Oppdaget</Text>
        </View>
        <View style={styles.hudDivider} />
        <View style={styles.hudItem}>
          <Text style={styles.hudValue}>{locationsData.length - discoveredPOIs.length}</Text>
          <Text style={styles.hudLabel}>Gjenstår</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loading: {
    flex: 1,
    backgroundColor: "#0a0a14",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#666",
    fontSize: 16,
    letterSpacing: 1,
  },
  playerRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(66,133,244,0.18)",
    borderWidth: 2,
    borderColor: "rgba(66,133,244,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  playerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4285f4",
  },
  hud: {
    position: "absolute",
    bottom: 44,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(10,10,20,0.82)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  hudItem: {
    alignItems: "center",
    flex: 1,
  },
  hudValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  hudLabel: {
    color: "#888",
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hudDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  unknownMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(20,20,40,0.9)",
    borderWidth: 1.5,
    borderColor: "rgba(140,140,200,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  unknownText: {
    color: "#9090c0",
    fontSize: 14,
    fontWeight: "700",
  },
});
