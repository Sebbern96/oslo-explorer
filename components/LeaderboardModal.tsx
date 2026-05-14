import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const LEVEL_THRESHOLDS = [100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];

function computeLevel(xp: number) {
  return 1 + LEVEL_THRESHOLDS.filter(t => xp >= t).length;
}

interface Entry {
  username: string | null;
  xp: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  currentUsername: string | null;
  fetchLeaderboard: () => Promise<Entry[]>;
}

export function LeaderboardModal({ visible, onClose, currentUsername, fetchLeaderboard }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchLeaderboard().then(data => {
      setEntries(data);
      setLoading(false);
    });
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.screenTitle}>LEDERTAVLE</Text>

          {loading ? (
            <ActivityIndicator color="#4a9eff" style={{ marginTop: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {entries.map((entry, i) => {
                const isMe = entry.username === currentUsername;
                const level = computeLevel(entry.xp);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                return (
                  <View key={i} style={[styles.row, isMe && styles.rowMe]}>
                    <Text style={styles.rank}>{medal ?? `#${i + 1}`}</Text>
                    <View style={styles.info}>
                      <Text style={[styles.name, isMe && styles.nameMe]}>
                        {entry.username ?? 'Ukjent'}
                        {isMe ? ' (deg)' : ''}
                      </Text>
                      <Text style={styles.level}>Nivå {level}</Text>
                    </View>
                    <Text style={styles.xp}>{entry.xp.toLocaleString()} XP</Text>
                  </View>
                );
              })}
              {entries.length === 0 && (
                <Text style={styles.empty}>Ingen spillere ennå</Text>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
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
    maxHeight: "80%",
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rowMe: {
    backgroundColor: "rgba(74,158,255,0.08)",
    borderColor: "rgba(74,158,255,0.3)",
  },
  rank: { fontSize: 18, width: 36, textAlign: "center" },
  info: { flex: 1, marginLeft: 8 },
  name: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  nameMe: { color: "#4a9eff" },
  level: { color: "#555877", fontSize: 11, marginTop: 2 },
  xp: { color: "#f4b942", fontSize: 13, fontWeight: "700" },
  empty: { color: "#555877", textAlign: "center", marginTop: 40, fontSize: 14 },
});
