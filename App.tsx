import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
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

function xpProgress(xp: number): { percent: number; label: string } {
  const level = computeLevel(xp);
  const prev = level > 1 ? LEVEL_THRESHOLDS[level - 2] : 0;
  const next = LEVEL_THRESHOLDS[level - 1];
  if (!next) return { percent: 100, label: `${xp} XP` };
  const percent = Math.min(100, Math.round(((xp - prev) / (next - prev)) * 100));
  return { percent, label: `${xp} / ${next} XP` };
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
  const [notification, setNotification] = useState<{ name: string; xpGain: number } | null>(null);
  const notifOpacity = useRef(new Animated.Value(0)).current;

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

  function showNotification(name: string, xpGain: number) {
    setNotification({ name, xpGain });
    notifOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(notifOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(notifOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setNotification(null));
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
            newPOIs.forEach((poi, i) => {
              stateRef.current.discoveredPOIs.push(poi.id);
              stateRef.current.xp += XP_PER_POI;
              send({ type: "poi", poiId: poi.id });
              if (i === 0) showNotification(poi.name, XP_PER_POI);
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

  const level = computeLevel(xp);
  const { percent, label: xpLabel } = xpProgress(xp);

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

      {notification && (
        <Animated.View style={[styles.notification, { opacity: notifOpacity }]}>
          <Text style={styles.notifEyebrow}>NYTT STED OPPDAGET</Text>
          <Text style={styles.notifName}>{notification.name}</Text>
          <Text style={styles.notifXp}>+{notification.xpGain} XP</Text>
        </Animated.View>
      )}

      <View style={styles.hud}>
        <View style={styles.hudHeader}>
          <Text style={styles.hudLvlLabel}>NIVÅ</Text>
          <Text style={styles.hudLvl}>{level}</Text>
          <Text style={styles.hudXpLabel}>{xpLabel}</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${percent}%` as any }]} />
        </View>
        <View style={styles.hudStats}>
          <View style={styles.hudStat}>
            <Text style={styles.hudStatValue}>{discoveredCount}</Text>
            <Text style={styles.hudStatLabel}>Oppdaget</Text>
          </View>
          <View style={styles.hudStatDivider} />
          <View style={styles.hudStat}>
            <Text style={styles.hudStatValue}>{locationsData.length - discoveredCount}</Text>
            <Text style={styles.hudStatLabel}>Gjenstår</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a14" },
  map: { flex: 1 },

  notification: {
    position: "absolute",
    top: 60,
    left: 24,
    right: 24,
    backgroundColor: "rgba(8,8,20,0.96)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f4b942",
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    shadowColor: "#f4b942",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  notifEyebrow: {
    color: "#f4b942",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  notifName: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  notifXp: { color: "#4a9eff", fontSize: 13, fontWeight: "600", marginTop: 4 },

  hud: {
    position: "absolute",
    bottom: 44,
    left: 24,
    right: 24,
    backgroundColor: "rgba(8,8,20,0.92)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(74,158,255,0.3)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#4a9eff",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  hudHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  hudLvlLabel: {
    color: "#4466bb",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginRight: 6,
  },
  hudLvl: {
    color: "#4a9eff",
    fontSize: 24,
    fontWeight: "800",
    marginRight: "auto" as any,
  },
  hudXpLabel: {
    color: "#555877",
    fontSize: 11,
    fontWeight: "600",
  },
  xpTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  xpFill: {
    height: 6,
    backgroundColor: "#4a9eff",
    borderRadius: 3,
  },
  hudStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  hudStat: { alignItems: "center", flex: 1 },
  hudStatValue: { color: "#ffffff", fontSize: 20, fontWeight: "700" },
  hudStatLabel: {
    color: "#4466aa",
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hudStatDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.08)" },
});
