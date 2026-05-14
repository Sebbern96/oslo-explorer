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
const XP_URI = FileSystem.documentDirectory + "xp.json";
const XP_PER_TILE = 10;
const XP_PER_POI = 50;
const LEVEL_THRESHOLDS = [100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const MAP_HTML = buildMapHtml(API_KEY, JSON.stringify(locationsData));

function computeLevel(xp: number): number {
  return 1 + LEVEL_THRESHOLDS.filter(t => xp >= t).length;
}

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
  const stateRef = useRef({ visitedKeys: new Set<string>(), discoveredPOIs: [] as number[], xp: 0 });
  const mapReadyRef = useRef(false);
  const lastPosRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [xp, setXp] = useState(0);

  function send(msg: object) {
    if (!mapReadyRef.current) return;
    webViewRef.current?.injectJavaScript(
      `window.handleMessage(${JSON.stringify(msg)}); true;`
    );
  }

  function onMapReady() {
    mapReadyRef.current = true;
    const pos = lastPosRef.current;
    webViewRef.current?.injectJavaScript(
      `window.handleMessage(${JSON.stringify({
        type: "state",
        visitedKeys: [...stateRef.current.visitedKeys],
        discoveredPOIs: stateRef.current.discoveredPOIs,
        ...(pos ?? {}),
      })}); true;`
    );
  }

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    async function init() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const [savedKeys, savedPOIs, savedXp] = await Promise.all([
        fsRead<string[]>(TILES_URI, []),
        fsRead<number[]>(POIS_URI, []),
        fsRead<number>(XP_URI, 0),
      ]);

      stateRef.current.visitedKeys = new Set(savedKeys);
      stateRef.current.discoveredPOIs = savedPOIs;
      stateRef.current.xp = savedXp;
      setDiscoveredCount(savedPOIs.length);
      setXp(savedXp);

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation },
        (pos) => {
          const { latitude, longitude } = pos.coords;

          lastPosRef.current = { latitude, longitude };
          send({ type: "position", latitude, longitude });

          const iLat = Math.floor(latitude / TILE_SIZE);
          const iLng = Math.floor(longitude / TILE_SIZE);
          const key = `${iLat}_${iLng}`;

          if (!stateRef.current.visitedKeys.has(key)) {
            stateRef.current.visitedKeys.add(key);
            stateRef.current.xp += XP_PER_TILE;
            fsSave(TILES_URI, [...stateRef.current.visitedKeys]);
            fsSave(XP_URI, stateRef.current.xp);
            send({ type: "tile", key });
            setXp(stateRef.current.xp);
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
              stateRef.current.xp += XP_PER_POI;
              send({ type: "poi", poiId: poi.id });
            });
            fsSave(POIS_URI, stateRef.current.discoveredPOIs);
            fsSave(XP_URI, stateRef.current.xp);
            setDiscoveredCount(stateRef.current.discoveredPOIs.length);
            setXp(stateRef.current.xp);
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
        onLoadStart={() => { mapReadyRef.current = false; }}
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
          <Text style={styles.hudValue}>{computeLevel(xp)}</Text>
          <Text style={styles.hudLabel}>Nivå</Text>
        </View>
        <View style={styles.hudDivider} />
        <View style={styles.hudItem}>
          <Text style={styles.hudValue}>{xp}</Text>
          <Text style={styles.hudLabel}>XP</Text>
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
  hudValue: { color: "#fff", fontSize: 20, fontWeight: "700" },
  hudLabel: {
    color: "#666",
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hudDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.1)" },
});
