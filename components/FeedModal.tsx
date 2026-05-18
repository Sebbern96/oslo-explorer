import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface FeedEvent {
  id: string;
  username: string | null;
  type: string;
  poi_id: number | null;
  poi_name: string | null;
  created_at: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  fetchFriendsFeed: () => Promise<FeedEvent[]>;
}

const TYPE_META: Record<string, { icon: string; verb: string; color: string }> = {
  discovered: { icon: '🔍', verb: 'oppdaget',        color: '#06b6d4' },
  visited:    { icon: '📍', verb: 'besøkte',          color: '#22c55e' },
  comment:    { icon: '💬', verb: 'kommenterte på',   color: '#a855f7' },
  photo:      { icon: '📷', verb: 'la til bilde av',  color: '#f97316' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Nå nettopp';
  if (m < 60) return `${m}m siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}t siden`;
  return `${Math.floor(h / 24)}d siden`;
}

export function FeedModal({ visible, onClose, fetchFriendsFeed }: Props) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const data = await fetchFriendsFeed();
    setEvents(data);
    setLoading(false);
  }

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>AKTIVITETSFEED</Text>

          {loading ? (
            <ActivityIndicator color="#4a9eff" style={{ marginTop: 40 }} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl refreshing={false} onRefresh={load} tintColor="#4a9eff" />
              }
            >
              {events.length === 0 ? (
                <Text style={styles.empty}>
                  Ingen aktivitet ennå.{'\n'}Legg til venner for å se hva de gjør!
                </Text>
              ) : (
                events.map(e => {
                  const meta = TYPE_META[e.type] ?? { icon: '⭐', verb: e.type, color: '#4a9eff' };
                  return (
                    <View key={e.id} style={styles.eventRow}>
                      <Text style={styles.eventIcon}>{meta.icon}</Text>
                      <View style={styles.eventBody}>
                        <Text style={styles.eventText}>
                          <Text style={[styles.eventUsername, { color: meta.color }]}>
                            {e.username ?? 'Anonym'}{' '}
                          </Text>
                          <Text style={styles.eventVerb}>{meta.verb} </Text>
                          {e.poi_name ? <Text style={styles.eventPoi}>{e.poi_name}</Text> : null}
                        </Text>
                        <Text style={styles.eventTime}>{timeAgo(e.created_at)}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Lukk</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#0d0d1f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(74,158,255,0.3)',
    paddingTop: 28,
    paddingHorizontal: 24,
    maxHeight: '80%',
    shadowColor: '#4a9eff',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
  },
  title: {
    color: '#9090c0',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 20,
    alignSelf: 'center',
  },
  scrollContent: { paddingBottom: 8 },
  empty: {
    color: '#555877',
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 22,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(74,158,255,0.08)',
  },
  eventIcon: { fontSize: 20, marginTop: 1 },
  eventBody: { flex: 1, gap: 3 },
  eventText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#ccccee', lineHeight: 20 },
  eventUsername: { fontFamily: 'SpaceGrotesk_700Bold' },
  eventVerb: { color: '#9090c0' },
  eventPoi: { color: '#ffffff', fontFamily: 'SpaceGrotesk_600SemiBold' },
  eventTime: { color: '#555877', fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11 },
  closeBtn: {
    marginTop: 12,
    marginBottom: 48,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  closeBtnText: { color: '#aaaacc', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14 },
});
