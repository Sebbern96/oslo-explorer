import { useEffect, useRef, useState } from "react";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import locationsData from "../data/locations.json";
import bydelerData from "../data/bydeler_runtime.json";
import { findBydel, Bydel } from "../utils/geo";

const TILE_SIZE = 0.005;
const TILES_URI = FileSystem.documentDirectory + "visitedTiles.json";
const POIS_URI = FileSystem.documentDirectory + "discoveredPOIs.json";
const VISITED_URI = FileSystem.documentDirectory + "visitedPOIs.json";
const XP_URI = FileSystem.documentDirectory + "xp.json";
const XP_PER_TILE = 10;
const XP_PER_POI = 50;
const XP_PER_VISIT = 25;

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
  onProgressChange?: (progress: { visitedKeys: string[]; discoveredPOIIds: number[]; visitedPOIIds: number[]; xp: number }) => void;
  fetchCloudProgress?: () => Promise<{ visitedKeys: string[]; discoveredPOIIds: number[]; visitedPOIIds: number[]; xp: number } | null>;
}

export function useGameLoop({ webViewRef, showNotification, onProgressChange, fetchCloudProgress }: Props) {
  const stateRef = useRef({
    visitedKeys: new Set<string>(),
    discoveredPOIs: [] as number[],
    visitedPOIs: [] as number[],
    xp: 0,
  });
  const mapReadyRef = useRef(false);
  const lastPosRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [xp, setXp] = useState(0);
  const [tilesCount, setTilesCount] = useState(0);
  const [discoveredPOIIds, setDiscoveredPOIIds] = useState<number[]>([]);
  const [visitedPOIIds, setVisitedPOIIds] = useState<number[]>([]);
  const [currentBydel, setCurrentBydel] = useState<Bydel | null>(null);

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

      const [savedKeys, savedPOIs, savedVisited, savedXp] = await Promise.all([
        fsRead<string[]>(TILES_URI, []),
        fsRead<number[]>(POIS_URI, []),
        fsRead<number[]>(VISITED_URI, []),
        fsRead<number>(XP_URI, 0),
      ]);

      let mergedKeys = savedKeys;
      let mergedPOIs = savedPOIs;
      let mergedVisited = savedVisited;
      let mergedXp = savedXp;

      const cloud = await fetchCloudProgress?.();
      if (cloud) {
        mergedKeys = [...new Set([...savedKeys, ...cloud.visitedKeys])];
        mergedPOIs = [...new Set([...savedPOIs, ...cloud.discoveredPOIIds])];
        mergedVisited = [...new Set([...savedVisited, ...cloud.visitedPOIIds])];
        mergedXp = Math.max(savedXp, cloud.xp);
        fsSave(TILES_URI, mergedKeys);
        fsSave(POIS_URI, mergedPOIs);
        fsSave(VISITED_URI, mergedVisited);
        fsSave(XP_URI, mergedXp);
      }

      stateRef.current.visitedKeys = new Set(mergedKeys);
      stateRef.current.discoveredPOIs = mergedPOIs;
      stateRef.current.visitedPOIs = mergedVisited;
      stateRef.current.xp = mergedXp;
      setTilesCount(mergedKeys.length);
      setDiscoveredPOIIds(mergedPOIs);
      setVisitedPOIIds(mergedVisited);
      setXp(mergedXp);

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation },
        (pos) => {
          const { latitude, longitude } = pos.coords;

          lastPosRef.current = { latitude, longitude };
          send({ type: "position", latitude, longitude });
          setCurrentBydel(findBydel(latitude, longitude, bydelerData));

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
            onProgressChange?.({
              visitedKeys: [...stateRef.current.visitedKeys],
              discoveredPOIIds: stateRef.current.discoveredPOIs,
              visitedPOIIds: stateRef.current.visitedPOIs,
              xp: stateRef.current.xp,
            });
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
            onProgressChange?.({
              visitedKeys: [...stateRef.current.visitedKeys],
              discoveredPOIIds: stateRef.current.discoveredPOIs,
              visitedPOIIds: stateRef.current.visitedPOIs,
              xp: stateRef.current.xp,
            });
          }
        }
      );
    }

    init();
    return () => { subscription?.remove(); };
  }, []);

  function markVisited(poiId: number) {
    if (stateRef.current.visitedPOIs.includes(poiId)) return;
    stateRef.current.visitedPOIs.push(poiId);
    stateRef.current.xp += XP_PER_VISIT;
    fsSave(VISITED_URI, stateRef.current.visitedPOIs);
    fsSave(XP_URI, stateRef.current.xp);
    setVisitedPOIIds([...stateRef.current.visitedPOIs]);
    setXp(stateRef.current.xp);
    send({ type: 'poi_visited', poiId });
    onProgressChange?.({
      visitedKeys: [...stateRef.current.visitedKeys],
      discoveredPOIIds: stateRef.current.discoveredPOIs,
      visitedPOIIds: stateRef.current.visitedPOIs,
      xp: stateRef.current.xp,
    });
  }

  function getProgress() {
    return {
      visitedKeys: [...stateRef.current.visitedKeys],
      discoveredPOIIds: [...stateRef.current.discoveredPOIs],
      visitedPOIIds: [...stateRef.current.visitedPOIs],
      xp: stateRef.current.xp,
    };
  }

  async function loadProgress(p: { visitedKeys: string[]; discoveredPOIIds: number[]; visitedPOIIds: number[]; xp: number }) {
    stateRef.current.visitedKeys = new Set(p.visitedKeys);
    stateRef.current.discoveredPOIs = p.discoveredPOIIds;
    stateRef.current.visitedPOIs = p.visitedPOIIds;
    stateRef.current.xp = p.xp;
    fsSave(TILES_URI, p.visitedKeys);
    fsSave(POIS_URI, p.discoveredPOIIds);
    fsSave(VISITED_URI, p.visitedPOIIds);
    fsSave(XP_URI, p.xp);
    setTilesCount(p.visitedKeys.length);
    setDiscoveredPOIIds(p.discoveredPOIIds);
    setVisitedPOIIds(p.visitedPOIIds);
    setXp(p.xp);
    const pos = lastPosRef.current;
    webViewRef.current?.injectJavaScript(
      `window.handleMessage(${JSON.stringify({
        type: 'state',
        visitedKeys: p.visitedKeys,
        discoveredPOIs: p.discoveredPOIIds,
        visitedPOIs: p.visitedPOIIds,
        ...(pos ?? {}),
      })}); true;`
    );
  }

  return { xp, tilesCount, discoveredPOIIds, visitedPOIIds, currentBydel, onMapReady, onMapUnload, getProgress, loadProgress, markVisited };
}
