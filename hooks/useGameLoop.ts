import { useEffect, useRef, useState } from "react";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import locationsData from "../data/locations.json";

const TILE_SIZE = 0.005;
const TILES_URI = FileSystem.documentDirectory + "visitedTiles.json";
const POIS_URI = FileSystem.documentDirectory + "discoveredPOIs.json";
const XP_URI = FileSystem.documentDirectory + "xp.json";
const XP_PER_TILE = 10;
const XP_PER_POI = 50;

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

interface Props {
  webViewRef: React.RefObject<WebView | null>;
  showNotification: (name: string, xpGain: number) => void;
}

export function useGameLoop({ webViewRef, showNotification }: Props) {
  const stateRef = useRef({
    visitedKeys: new Set<string>(),
    discoveredPOIs: [] as number[],
    xp: 0,
  });
  const mapReadyRef = useRef(false);
  const lastPosRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [xp, setXp] = useState(0);
  const [tilesCount, setTilesCount] = useState(0);
  const [discoveredPOIIds, setDiscoveredPOIIds] = useState<number[]>([]);

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

  function onMapUnload() {
    mapReadyRef.current = false;
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
      setTilesCount(savedKeys.length);
      setDiscoveredPOIIds(savedPOIs);
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
            setTilesCount(stateRef.current.visitedKeys.size);
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
            setDiscoveredPOIIds([...stateRef.current.discoveredPOIs]);
            setXp(stateRef.current.xp);
          }
        }
      );
    }

    init();
    return () => { subscription?.remove(); };
  }, []);

  return { xp, tilesCount, discoveredPOIIds, onMapReady, onMapUnload };
}
