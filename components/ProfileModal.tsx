import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import locationsData from "../data/locations.json";
import bydelerData from "../data/bydeler_runtime.json";
import { ACHIEVEMENTS } from "../data/achievements";

const LEVEL_THRESHOLDS = [100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];

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

type Tab = 'oversikt' | 'lokasjoner' | 'prestasjoner';

interface Props {
  visible: boolean;
  onClose: () => void;
  xp: number;
  tilesCount: number;
  discoveredPOIIds: number[];
  visitedPOIIds: number[];
  unlockedAchievementIds: string[];
  userEmail: string | null;
  onSignOut: () => void;
}

export function ProfileModal({ visible, onClose, xp, tilesCount, discoveredPOIIds, visitedPOIIds, unlockedAchievementIds, userEmail, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>('oversikt');
  const level = computeLevel(xp);
  const { percent, label: xpLabel } = xpProgress(xp);

  const bydelStats = (bydelerData as any[])
    .map(bydel => {
      const bydelPOIs = locationsData.filter((p: any) => p.bydelId === bydel.id);
      if (bydelPOIs.length === 0) return null;
      const discovered = bydelPOIs.filter(p => discoveredPOIIds.includes(p.id)).length;
      const visited = bydelPOIs.filter(p => visitedPOIIds.includes(p.id)).length;
      return { id: bydel.id, name: bydel.name, total: bydelPOIs.length, discovered, visited };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.discovered - a.discovered) as { id: number; name: string; total: number; discovered: number; visited: number }[];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.screenTitle}>PROFIL</Text>

          <View style={styles.tabBar}>
            {(['oversikt', 'lokasjoner', 'prestasjoner'] as Tab[]).map(t => (
              <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'oversikt' ? 'OVERSIKT' : t === 'lokasjoner' ? 'LOKASJONER' : 'PRESTASJONER'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'oversikt' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {userEmail ? (
                <View style={styles.accountRow}>
                  <Text style={styles.accountEmail}>☁️ {userEmail}</Text>
                  <TouchableOpacity onPress={onSignOut}>
                    <Text style={styles.signOutText}>Logg ut</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.notSignedIn}>🔑 Ikke logget inn — fremgang lagres lokalt</Text>
              )}

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
                <StatBox value={discoveredPOIIds.length} label="Oppdaget" />
                <StatBox value={visitedPOIIds.length} label="Besøkt" />
                <StatBox value={unlockedAchievementIds.length} label={`Prestasjoner av ${ACHIEVEMENTS.length}`} />
              </View>
            </ScrollView>
          )}

          {tab === 'lokasjoner' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.bydelSummary}>
                <Text style={styles.bydelSummaryValue}>{tilesCount}</Text>
                <Text style={styles.bydelSummaryLabel}>fliser utforsket totalt</Text>
              </View>
              {bydelStats.map(b => (
                <View key={b.id} style={styles.bydelCard}>
                  <View style={styles.bydelHeader}>
                    <Text style={styles.bydelName}>{b.name}</Text>
                    <Text style={styles.bydelCount}>{b.discovered}/{b.total}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: b.total > 0 ? `${Math.round((b.discovered / b.total) * 100)}%` as any : '0%' }]} />
                  </View>
                  <View style={styles.bydelFooter}>
                    <Text style={styles.bydelVisited}>✓ {b.visited} besøkt</Text>
                    <Text style={styles.bydelRemaining}>{b.total - b.discovered} gjenstår</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {tab === 'prestasjoner' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.achievementMeta}>
                {unlockedAchievementIds.length} av {ACHIEVEMENTS.length} låst opp
              </Text>
              <View style={styles.achievementGrid}>
                {ACHIEVEMENTS.map(a => {
                  const unlocked = unlockedAchievementIds.includes(a.id);
                  return (
                    <View key={a.id} style={[styles.achievementCard, !unlocked && styles.achievementLocked]}>
                      <Text style={styles.achievementEmoji}>{unlocked ? a.emoji : '🔒'}</Text>
                      <Text style={[styles.achievementName, !unlocked && styles.achievementLockedText]}>{a.name}</Text>
                      <Text style={styles.achievementDesc}>{a.description}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
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
    maxHeight: "90%",
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
    marginBottom: 16,
  },

  // Tabs
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingBottom: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#4a9eff",
  },
  tabText: {
    color: "#444466",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  tabTextActive: { color: "#4a9eff" },

  // Oversikt
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  accountEmail: { color: "#aaaacc", fontSize: 12 },
  signOutText: { color: "#ef4444", fontSize: 12, fontWeight: "600" },
  notSignedIn: { color: "#444466", fontSize: 12, textAlign: "center", marginBottom: 16 },

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
    marginBottom: 16,
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

  // Lokasjoner
  bydelSummary: {
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  bydelSummaryValue: { color: "#4a9eff", fontSize: 32, fontWeight: "800" },
  bydelSummaryLabel: { color: "#444466", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },

  bydelCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
    marginBottom: 10,
  },
  bydelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bydelName: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  bydelCount: { color: "#4a9eff", fontSize: 12, fontWeight: "700" },
  barTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  barFill: { height: 5, backgroundColor: "#4a9eff", borderRadius: 3 },
  bydelFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bydelVisited: { color: "#22c55e", fontSize: 10, fontWeight: "600" },
  bydelRemaining: { color: "#444466", fontSize: 10, fontWeight: "600" },

  // Prestasjoner
  achievementMeta: {
    color: "#555877",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "600",
  },
  achievementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  achievementCard: {
    width: "47%",
    backgroundColor: "rgba(74,158,255,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(74,158,255,0.25)",
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  achievementLocked: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.06)",
  },
  achievementEmoji: { fontSize: 24 },
  achievementName: { color: "#ffffff", fontSize: 11, fontWeight: "700", textAlign: "center" },
  achievementLockedText: { color: "#444466" },
  achievementDesc: { color: "#444466", fontSize: 10, textAlign: "center", lineHeight: 14 },
});
