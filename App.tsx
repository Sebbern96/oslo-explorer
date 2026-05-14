import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import { buildMapHtml } from "./utils/mapHtml";
import locationsData from "./data/locations.json";

const TILE_SIZE = 0.005;
const TILES_URI = FileSystem.documentDirectory + "visitedTiles.json";
const POIS_URI = FileSystem.documentDirectory + "discoveredPOIs.json";
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const MAP_HTML = buildMapHtml(API_KEY, JSON.stringify(locationsData));

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

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const stateRef = useRef({ visitedKeys: new Set<string>(), discoveredPOIs: [] as number[] });
  const [visitedCount, setVisitedCount] = useState(0);
  const [discoveredCount, setDiscoveredCount] = useState(0);

  function send(msg: object) {
    webViewRef.current?.injectJavaScript(
      `window.handleMessage(${JSON.stringify(msg)}); true;`
    );
  }

  function onMapReady() {
    send({
      type: "state",
      visitedKeys: [...stateRef.current.visitedKeys],
      discoveredPOIs: stateRef.current.discoveredPOIs,
    });
  }

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    async function init() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const [savedKeys, savedPOIs] = await Promise.all([
        fsRead<string[]>(TILES_URI, []),
        fsRead<number[]>(POIS_URI, []),
      ]);

      stateRef.current.visitedKeys = new Set(savedKeys);
      stateRef.current.discoveredPOIs = savedPOIs;
      setVisitedCount(savedKeys.length);
      setDiscoveredCount(savedPOIs.length);

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation },
        (pos) => {
          const { latitude, longitude } = pos.coords;

          send({ type: "position", latitude, longitude });

          const iLat = Math.floor(latitude / TILE_SIZE);
          const iLng = Math.floor(longitude / TILE_SIZE);
          const key = `${iLat}_${iLng}`;

          if (!stateRef.current.visitedKeys.has(key)) {
            stateRef.current.visitedKeys.add(key);
            fsSave(TILES_URI, [...stateRef.current.visitedKeys]);
            send({ type: "tile", key });
            setVisitedCount(stateRef.current.visitedKeys.size);
          }

          const newPOIs = locationsData.filter(
            (poi) =>
              !stateRef.current.discoveredPOIs.includes(poi.id) &&
              Math.abs(latitude - poi.latitude) < 0.0025 &&
              Math.abs(longitude - poi.longitude) < 0.0025
          );

          if (newPOIs.length > 0) {
            newPOIs.forEach((poi) => {
              stateRef.current.discoveredPOIs.push(poi.id);
              send({ type: "poi", poiId: poi.id });
            });
            fsSave(POIS_URI, stateRef.current.discoveredPOIs);
            setDiscoveredCount(stateRef.current.discoveredPOIs.length);
          }
        }
      );
    }

    init();
    return () => { subscription?.remove(); };
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: MAP_HTML }}
        style={styles.map}
        onMessage={(e) => {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === "ready") onMapReady();
        }}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
      />
      <View style={styles.hud}>
        <View style={styles.hudItem}>
          <Text style={styles.hudValue}>{visitedCount}</Text>
          <Text style={styles.hudLabel}>Ruter</Text>
        </View>
        <View style={styles.hudDivider} />
        <View style={styles.hudItem}>
          <Text style={styles.hudValue}>{discoveredCount}</Text>
          <Text style={styles.hudLabel}>Oppdaget</Text>
        </View>
        <View style={styles.hudDivider} />
        <View style={styles.hudItem}>
          <Text style={styles.hudValue}>{locationsData.length - discoveredCount}</Text>
          <Text style={styles.hudLabel}>Gjenstår</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a14" },
  map: { flex: 1 },
  hud: {
    position: "absolute",
    bottom: 44,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(10,10,20,0.85)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  hudItem: { alignItems: "center", flex: 1 },
  hudValue: { color: "#fff", fontSize: 24, fontWeight: "700" },
  hudLabel: {
    color: "#666",
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hudDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.1)" },
});
