import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import locationsData from "./data/locations.json";

const TILE_SIZE = 0.005;
const TILES_URI = FileSystem.documentDirectory + "visitedTiles.json";
const POIS_URI = FileSystem.documentDirectory + "discoveredPOIs.json";

async function fsRead<T>(uri: string, fallback: T): Promise<T> {
  try {
    const content = await FileSystem.readAsStringAsync(uri);
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function fsSave(uri: string, data: unknown): void {
  FileSystem.writeAsStringAsync(uri, JSON.stringify(data));
}

const MAP_STYLE = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "all",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "all",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

function generateGrid() {
  const tiles = [];
  for (let lat = 59.84; lat < 59.98; lat += TILE_SIZE) {
    for (let lng = 10.62; lng < 10.94; lng += TILE_SIZE) {
      tiles.push([
        { latitude: lat, longitude: lng },
        { latitude: lat + TILE_SIZE, longitude: lng },
        { latitude: lat + TILE_SIZE, longitude: lng + TILE_SIZE },
        { latitude: lat, longitude: lng + TILE_SIZE },
      ]);
    }
  }
  return tiles;
}

function tileKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)}_${lng.toFixed(4)}`;
}

function positionTileKey(lat: number, lng: number): string {
  const originLat = Math.floor(lat / TILE_SIZE) * TILE_SIZE;
  const originLng = Math.floor(lng / TILE_SIZE) * TILE_SIZE;
  return tileKey(originLat, originLng);
}

function isVisited(
  tile: { latitude: number; longitude: number }[],
  visitedKeys: Set<string>,
): boolean {
  return visitedKeys.has(tileKey(tile[0].latitude, tile[0].longitude));
}

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [visitedKeys, setVisitedKeys] = useState<Set<string>>(new Set());
  const [grid, setGrid] = useState<{ latitude: number; longitude: number }[][]>([]);
  const [discoveredPOIs, setDiscoveredPOIs] = useState<number[]>([]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    async function init() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const [initialKeys, initialPOIs] = await Promise.all([
        fsRead<string[]>(TILES_URI, []).then((arr) => new Set(arr)),
        fsRead<number[]>(POIS_URI, []),
      ]);

      setGrid(generateGrid());
      setVisitedKeys(initialKeys);
      setDiscoveredPOIs(initialPOIs);

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation },
        (newPosition) => {
          const { latitude, longitude } = newPosition.coords;
          setLocation(newPosition);

          const key = positionTileKey(latitude, longitude);
          setVisitedKeys((prev) => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            fsSave(TILES_URI, [...next]);
            return next;
          });

          setDiscoveredPOIs((prev) => {
            const newlyDiscovered = locationsData
              .filter(
                (poi) =>
                  !prev.includes(poi.id) &&
                  Math.abs(latitude - poi.latitude) < 0.0025 &&
                  Math.abs(longitude - poi.longitude) < 0.0025,
              )
              .map((poi) => poi.id);
            if (newlyDiscovered.length === 0) return prev;
            const next = [...prev, ...newlyDiscovered];
            fsSave(POIS_URI, next);
            return next;
          });
        },
      );
    }

    init();

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
<MapView
        style={styles.map}
        customMapStyle={MAP_STYLE}
        initialRegion={{
          latitude: 59.9139,
          longitude: 10.7522,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Du er her"
          />
        )}
        {grid.map(
          (rute, index) =>
            !isVisited(rute, visitedKeys) && (
              <Polygon
                key={index}
                coordinates={rute}
                fillColor="rgba(0,0,0,0.8)"
                strokeWidth={0}
              />
            ),
        )}
        {locationsData.map((poi) =>
          discoveredPOIs.includes(poi.id) ? (
            <Marker
              key={`poi-${poi.id}`}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              title={poi.name}
              description={poi.category}
            />
          ) : (
            <Marker
              key={`poi-${poi.id}`}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              title="?"
              pinColor="gray"
            />
          ),
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
