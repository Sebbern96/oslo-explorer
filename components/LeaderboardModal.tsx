import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

const LEVEL_THRESHOLDS = [100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];

function computeLevel(xp: number) {
  return 1 + LEVEL_THRESHOLDS.filter(t => xp >= t).length;
}

interface Entry {
  username: string | null;
  xp: number;
}

interface FriendEntry {
  username: string | null;
  xp: number;
  userId: string;
}

type Tab = 'alle' | 'venner';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentUsername: string | null;
  currentUserId?: string | null;
  fetchLeaderboard: () => Promise<Entry[]>;
  fetchFriendsLeaderboard: () => Promise<FriendEntry[]>;
  addFriend: (username: string) => Promise<{ error: string | null }>;
  removeFriend: (userId: string) => Promise<void>;
}

export function LeaderboardModal({ visible, onClose, currentUsername, currentUserId, fetchLeaderboard, fetchFriendsLeaderboard, addFriend, removeFriend }: Props) {
  const [tab, setTab] = useState<Tab>('alle');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [friendEntries, setFriendEntries] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendInput, setFriendInput] = useState('');
  const [addStatus, setAddStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [addingFriend, setAddingFriend] = useState(false);
  const addStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    loadAll();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (tab === 'alle') {
      setLoading(true);
      fetchLeaderboard().then(data => { setEntries(data); setLoading(false); });
    } else {
      setLoading(true);
      fetchFriendsLeaderboard().then(data => { setFriendEntries(data); setLoading(false); });
    }
  }, [tab]);

  function loadAll() {
    setLoading(true);
    if (tab === 'alle') {
      fetchLeaderboard().then(data => { setEntries(data); setLoading(false); });
    } else {
      fetchFriendsLeaderboard().then(data => { setFriendEntries(data); setLoading(false); });
    }
  }

  async function handleAddFriend() {
    const name = friendInput.trim();
    if (!name) return;
    setAddingFriend(true);
    const { error } = await addFriend(name);
    setAddingFriend(false);
    setFriendInput('');
    if (addStatusTimer.current) clearTimeout(addStatusTimer.current);
    setAddStatus({ msg: error ?? `${name} lagt til!`, ok: !error });
    addStatusTimer.current = setTimeout(() => setAddStatus(null), 3000);
    if (!error) {
      fetchFriendsLeaderboard().then(data => setFriendEntries(data));
    }
  }

  async function handleRemoveFriend(userId: string) {
    await removeFriend(userId);
    setFriendEntries(prev => prev.filter(e => e.userId !== userId));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.screenTitle}>LEDERTAVLE</Text>

          <View style={styles.tabBar}>
            {(['alle', 'venner'] as Tab[]).map(t => (
              <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'alle' ? 'ALLE' : 'VENNER'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'venner' && (
            <View style={styles.addFriendRow}>
              <TextInput
                style={styles.addFriendInput}
                placeholder="Brukernavn..."
                placeholderTextColor="#444466"
                value={friendInput}
                onChangeText={setFriendInput}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleAddFriend}
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddFriend} disabled={addingFriend}>
                <Text style={styles.addBtnText}>{addingFriend ? '...' : 'Legg til'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {addStatus && (
            <Text style={[styles.addStatus, addStatus.ok ? styles.addStatusOk : styles.addStatusErr]}>
              {addStatus.msg}
            </Text>
          )}

          {loading ? (
            <ActivityIndicator color="#4a9eff" style={{ marginTop: 40 }} />
          ) : tab === 'alle' ? (
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
                        {entry.username ?? 'Ukjent'}{isMe ? ' (deg)' : ''}
                      </Text>
                      <Text style={styles.level}>Nivå {level}</Text>
                    </View>
                    <Text style={styles.xp}>{entry.xp.toLocaleString()} XP</Text>
                  </View>
                );
              })}
              {entries.length === 0 && <Text style={styles.empty}>Ingen spillere ennå</Text>}
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {friendEntries.length === 0 && (
                <Text style={styles.empty}>Ingen venner ennå{'\n'}Legg til venner ovenfor</Text>
              )}
              {friendEntries.map((entry, i) => {
                const isMe = entry.userId === currentUserId;
                const level = computeLevel(entry.xp);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                return (
                  <View key={entry.userId} style={[styles.row, isMe && styles.rowMe]}>
                    <Text style={styles.rank}>{medal ?? `#${i + 1}`}</Text>
                    <View style={styles.info}>
                      <Text style={[styles.name, isMe && styles.nameMe]}>
                        {entry.username ?? 'Ukjent'}{isMe ? ' (deg)' : ''}
                      </Text>
                      <Text style={styles.level}>Nivå {level}</Text>
                    </View>
                    <Text style={styles.xp}>{entry.xp.toLocaleString()} XP</Text>
                    {!isMe && (
                      <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveFriend(entry.userId)}>
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
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
  closeBtnText: { color: "#555877", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 18 },
  screenTitle: {
    color: "#4466bb",
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 10,
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingBottom: 12,
    alignItems: "center",
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#4a9eff",
  },
  tabText: {
    color: "#444466",
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 9,
    letterSpacing: 1.2,
  },
  tabTextActive: { color: "#4a9eff" },
  addFriendRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  addFriendInput: {
    flex: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(74,158,255,0.2)",
    paddingHorizontal: 12,
    color: "#ffffff",
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 13,
  },
  addBtn: {
    height: 40,
    paddingHorizontal: 14,
    backgroundColor: "rgba(74,158,255,0.15)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(74,158,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#4a9eff", fontFamily: "SpaceGrotesk_700Bold", fontSize: 13 },
  addStatus: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 12, textAlign: "center", marginBottom: 8 },
  addStatusOk: { color: "#22c55e" },
  addStatusErr: { color: "#ef4444" },
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
  name: { color: "#ffffff", fontFamily: "SpaceGrotesk_700Bold", fontSize: 14 },
  nameMe: { color: "#4a9eff" },
  level: { color: "#555877", fontFamily: "SpaceGrotesk_400Regular", fontSize: 11, marginTop: 2 },
  xp: { color: "#f4b942", fontFamily: "SpaceGrotesk_700Bold", fontSize: 13 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  removeBtnText: { color: "#ef4444", fontFamily: "SpaceGrotesk_700Bold", fontSize: 12 },
  empty: { color: "#555877", fontFamily: "SpaceGrotesk_400Regular", textAlign: "center", marginTop: 40, fontSize: 14, lineHeight: 22 },
});
