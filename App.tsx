import { useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from "react-native-webview";
import { buildMapHtml } from "./utils/mapHtml";
import { useGameLoop } from "./hooks/useGameLoop";
import { useAuth } from "./hooks/useAuth";
import { ProfileModal } from "./components/ProfileModal";
import { AuthModal } from "./components/AuthModal";
import locationsData from "./data/locations.json";

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

export default function App() {
  return <SafeAreaProvider><AppInner /></SafeAreaProvider>;
}

function AppInner() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [notification, setNotification] = useState<{ name: string; xpGain: number } | null>(null);
  const notifOpacity = useRef(new Animated.Value(0)).current;
  const [profileVisible, setProfileVisible] = useState(false);
  const { session, loading, signIn, signUp, signOut, fetchCloudProgress, uploadProgress } = useAuth();
  // loading prevents flashing the auth gate before Supabase resolves the stored session

  function showNotification(name: string, xpGain: number) {
    setNotification({ name, xpGain });
    notifOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(notifOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(notifOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setNotification(null));
  }

  const { xp, tilesCount, discoveredPOIIds, currentBydel, onMapReady, onMapUnload, getProgress, loadProgress } = useGameLoop({
    webViewRef,
    showNotification,
    onProgressChange: (progress) => { uploadProgress(progress); },
  });

  async function handleSignIn(email: string, password: string) {
    await signIn(email, password);
    const cloud = await fetchCloudProgress();
    if (cloud) {
      const local = getProgress();
      const merged = {
        visitedKeys: [...new Set([...local.visitedKeys, ...cloud.visitedKeys])],
        discoveredPOIIds: [...new Set([...local.discoveredPOIIds, ...cloud.discoveredPOIIds])],
        xp: Math.max(local.xp, cloud.xp),
      };
      await loadProgress(merged);
      await uploadProgress(merged);
    }
  }

  async function handleSignOut() {
    await signOut();
  }

  const level = computeLevel(xp);
  const { percent, label: xpLabel } = xpProgress(xp);

  const bydelPOIs = currentBydel
    ? locationsData.filter((p: any) => p.bydelId === currentBydel.id)
    : locationsData;
  const localDiscovered = bydelPOIs.filter(p => discoveredPOIIds.includes(p.id)).length;
  const localRemaining = bydelPOIs.length - localDiscovered;
  const bydelName = currentBydel?.name ?? "Oslo";

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: MAP_HTML }}
        style={styles.map}
        onLoadStart={onMapUnload}
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
        <Animated.View style={[styles.notification, { opacity: notifOpacity, top: insets.top + 10 }]}>
          <Text style={styles.notifEyebrow}>NYTT STED OPPDAGET</Text>
          <Text style={styles.notifName}>{notification.name}</Text>
          <Text style={styles.notifXp}>+{notification.xpGain} XP</Text>
        </Animated.View>
      )}

      <View style={[styles.topButtons, { top: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setProfileVisible(true)}>
          <Text style={styles.iconBtnText}>👤</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.hud, { bottom: insets.bottom + 10 }]}>
        <View style={styles.hudHeader}>
          <Text style={styles.hudLvlLabel}>NIVÅ</Text>
          <Text style={styles.hudLvl}>{level}</Text>
          <Text style={styles.hudXpLabel}>{xpLabel}</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${percent}%` as any }]} />
        </View>
        <Text style={styles.hudBydel}>{bydelName.toUpperCase()}</Text>
        <View style={styles.hudStats}>
          <View style={styles.hudStat}>
            <Text style={styles.hudStatValue}>{localDiscovered}</Text>
            <Text style={styles.hudStatLabel}>Oppdaget</Text>
          </View>
          <View style={styles.hudStatDivider} />
          <View style={styles.hudStat}>
            <Text style={styles.hudStatValue}>{localRemaining}</Text>
            <Text style={styles.hudStatLabel}>Gjenstår</Text>
          </View>
        </View>
      </View>

      <ProfileModal
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        xp={xp}
        tilesCount={tilesCount}
        discoveredPOIIds={discoveredPOIIds}
        userEmail={session?.user.email ?? null}
        onSignOut={handleSignOut}
      />

      <AuthModal
        visible={!session && !loading}
        onClose={() => {}}
        onSignIn={handleSignIn}
        onSignUp={signUp}
        mandatory
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a14" },
  map: { flex: 1 },

  notification: {
    position: "absolute",
    top: 0,
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
    bottom: 0,
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
  hudBydel: {
    color: "#4466bb",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 10,
  },

  topButtons: {
    position: "absolute",
    top: 0,
    right: 24,
    flexDirection: "row",
    gap: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(8,8,20,0.92)",
    borderWidth: 1,
    borderColor: "rgba(74,158,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4a9eff",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  iconBtnText: { fontSize: 20 },
});
