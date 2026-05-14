import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import locationsData from "../data/locations.json";

const LEVEL_THRESHOLDS = [100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  landemerke: { label: "Landemerke", emoji: "🏛" },
  museum:     { label: "Museum",     emoji: "🏺" },
  park:       { label: "Park",       emoji: "🌳" },
  kultur:     { label: "Kultur",     emoji: "🎭" },
  mat_drikke: { label: "Mat & Drikke", emoji: "🍽" },
  restaurant: { label: "Restaurant", emoji: "🍴" },
  bar:        { label: "Bar",        emoji: "🍺" },
};

function computeLevel(xp: number) {
  return 1 + LEVEL_THRESHOLDS.filter(t => xp >= t).length;
}

function xpProgress(xp: number) {
  const level = computeLevel(xp);
  const prev = level > 1 ? LEVEL_THRESHOLDS[level - 2] : 0;
  const next = LEVEL_THRESHOLDS[level - 1];
  if (!next) return { percent: 100, label: `${xp} XP` };
  const percent = Math.min(100, Math.round(((xp - prev) / (next - prev)) * 100));
  return { percent, label: `${xp} / ${next} XP` };
}

interface Props {
  visible: boolean;
  onClose: () => void;
  xp: number;
  tilesCount: number;
  discoveredPOIIds: number[];
}

export function ProfileModal({ visible, onClose, xp, tilesCount, discoveredPOIIds }: Props) {
  const level = computeLevel(xp);
  const { percent, label: xpLabel } = xpProgress(xp);
  const totalPOIs = locationsData.length;

  const categoryStats = Object.entries(CATEGORY_META).map(([key, meta]) => {
    const total = locationsData.filter(p => p.category === key).length;
    const found = locationsData.filter(p => p.category === key && discoveredPOIIds.includes(p.id)).length;
    return { key, ...meta, total, found };
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.screenTitle}>PROFIL</Text>

          <View style={styles.levelBadge}>
            <Text style={styles.levelNumber}>{level}</Text>
            <Text style={styles.levelLabel}>NIVÅ</Text>
          </View>

          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${percent}%` as any }]} />
          </View>
          <Text style={styles.xpLabel}>{xpLabel}</Text>

          <View style={styles.statsGrid}>
            <StatBox value={xp} label="Total XP" />
            <StatBox value={tilesCount} label="Fliser utforsket" />
            <StatBox value={discoveredPOIIds.length} label="Steder funnet" />
            <StatBox value={totalPOIs - discoveredPOIIds.length} label="Gjenstår" />
          </View>

          <Text style={styles.sectionTitle}>KATEGORIER</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {categoryStats.map(cat => (
              <View key={cat.key} style={styles.catRow}>
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text style={styles.catLabel}>{cat.label}</Text>
                <View style={styles.catBarTrack}>
                  <View
                    style={[
                      styles.catBarFill,
                      { width: cat.total > 0 ? `${Math.round((cat.found / cat.total) * 100)}%` as any : "0%" },
                    ]}
                  />
                </View>
                <Text style={styles.catCount}>{cat.found}/{cat.total}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: "#0d0d1f",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(74,158,255,0.3)",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    maxHeight: "85%",
    shadowColor: "#4a9eff",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
  },
  closeBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#555877", fontSize: 18, fontWeight: "600" },
  screenTitle: {
    color: "#4466bb",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 20,
  },

  levelBadge: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "rgba(74,158,255,0.5)",
    backgroundColor: "rgba(74,158,255,0.08)",
    marginBottom: 20,
    shadowColor: "#4a9eff",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  levelNumber: { color: "#4a9eff", fontSize: 36, fontWeight: "800", lineHeight: 40 },
  levelLabel: { color: "#4466bb", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },

  xpTrack: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  xpFill: { height: 8, backgroundColor: "#4a9eff", borderRadius: 4 },
  xpLabel: {
    color: "#555877",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
    marginBottom: 24,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28,
  },
  statBox: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  statValue: { color: "#ffffff", fontSize: 24, fontWeight: "700" },
  statLabel: { color: "#4466aa", fontSize: 10, fontWeight: "600", marginTop: 4, textAlign: "center", letterSpacing: 0.3 },

  sectionTitle: {
    color: "#4466bb",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 14,
  },

  catRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  catEmoji: { fontSize: 16, width: 24 },
  catLabel: { color: "#aaaacc", fontSize: 12, fontWeight: "600", width: 100 },
  catBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 3,
    overflow: "hidden",
  },
  catBarFill: { height: 6, backgroundColor: "#4a9eff", borderRadius: 3 },
  catCount: { color: "#555877", fontSize: 11, fontWeight: "600", width: 30, textAlign: "right" },
});
