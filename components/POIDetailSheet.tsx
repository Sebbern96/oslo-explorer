import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const CATEGORY_META: Record<string, { label: string; emoji: string; color: string }> = {
  landemerke: { label: "Landemerke", emoji: "🏛",  color: "#f97316" },
  museum:     { label: "Museum",     emoji: "🏺",  color: "#06b6d4" },
  park:       { label: "Park",       emoji: "🌳",  color: "#22c55e" },
  kultur:     { label: "Kultur",     emoji: "🎭",  color: "#a855f7" },
  mat_drikke: { label: "Mat & Drikke", emoji: "🍽", color: "#f4b942" },
  restaurant: { label: "Restaurant", emoji: "🍴",  color: "#ef4444" },
  bar:        { label: "Bar",        emoji: "🍺",  color: "#ec4899" },
};

interface POI {
  id: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
}

interface Props {
  poi: POI | null;
  discovered: boolean;
  onClose: () => void;
}

export function POIDetailSheet({ poi, discovered, onClose }: Props) {
  if (!poi) return null;
  const meta = CATEGORY_META[poi.category] ?? { label: poi.category, emoji: "📍", color: "#5050a0" };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={[styles.categoryPill, { borderColor: meta.color }]}>
            <Text style={styles.categoryEmoji}>{meta.emoji}</Text>
            <Text style={[styles.categoryLabel, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
          </View>

          {discovered ? (
            <Text style={styles.name}>{poi.name}</Text>
          ) : (
            <>
              <Text style={styles.name}>???</Text>
              <Text style={styles.hint}>Gå nærmere for å oppdage dette stedet</Text>
            </>
          )}

          {discovered && (
            <View style={[styles.discoveredBadge, { borderColor: meta.color }]}>
              <Text style={[styles.discoveredText, { color: meta.color }]}>✓ Oppdaget</Text>
            </View>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Lukk</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
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
    paddingTop: 28,
    paddingBottom: 48,
    alignItems: "center",
    shadowColor: "#4a9eff",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
  },
  categoryEmoji: { fontSize: 14 },
  categoryLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  name: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  hint: {
    color: "#555877",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
  },
  discoveredBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 24,
  },
  discoveredText: { fontSize: 12, fontWeight: "700" },
  closeBtn: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 48,
  },
  closeBtnText: { color: "#aaaacc", fontSize: 14, fontWeight: "600" },
});
