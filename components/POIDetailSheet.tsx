import { useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

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

interface Comment {
  id: string;
  username: string;
  text: string;
  created_at: string;
}

interface Props {
  poi: POI | null;
  discovered: boolean;
  visited: boolean;
  onMarkVisited: () => void;
  onClose: () => void;
  fetchPhotos: (poiId: number) => Promise<string[]>;
  uploadPhoto: (poiId: number, uri: string, poiName?: string) => Promise<void>;
  fetchComments: (poiId: number) => Promise<Comment[]>;
  postComment: (poiId: number, text: string, poiName?: string) => Promise<void>;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }) +
    " " + d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

export function POIDetailSheet({ poi, discovered, visited, onMarkVisited, onClose, fetchPhotos, uploadPhoto, fetchComments, postComment }: Props) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!poi || !discovered) return;
    setPhotos([]);
    setComments([]);
    fetchPhotos(poi.id).then(setPhotos);
    fetchComments(poi.id).then(setComments);
  }, [poi?.id]);

  function handleAddPhoto() {
    if (!poi) return;
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Avbryt', 'Ta bilde', 'Velg fra galleri'], cancelButtonIndex: 0 },
      async (idx) => {
        if (idx === 0) return;
        let result: ImagePicker.ImagePickerResult;
        if (idx === 1) {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
          result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
          result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
        }
        if (result.canceled || !result.assets[0]) return;
        setUploading(true);
        try {
          await uploadPhoto(poi.id, result.assets[0].uri, poi.name);
          const updated = await fetchPhotos(poi.id);
          setPhotos(updated);
        } finally {
          setUploading(false);
        }
      }
    );
  }

  async function handleSubmit() {
    if (!commentText.trim() || submitting || !poi) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await postComment(poi.id, commentText, poi.name);
      setCommentText("");
      const updated = await fetchComments(poi.id);
      setComments(updated);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setSubmitError("Kunne ikke sende kommentar");
    } finally {
      setSubmitting(false);
    }
  }

  if (!poi) return null;
  const meta = CATEGORY_META[poi.category] ?? { label: poi.category, emoji: "📍", color: "#5050a0" };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
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

              {visited ? (
                <View style={[styles.statusBadge, { borderColor: '#22c55e' }]}>
                  <Text style={[styles.statusText, { color: '#22c55e' }]}>✓ Besøkt</Text>
                </View>
              ) : discovered ? (
                <>
                  <View style={[styles.statusBadge, { borderColor: meta.color }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>◎ Oppdaget</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.visitBtn, { borderColor: meta.color }]}
                    onPress={onMarkVisited}
                  >
                    <Text style={[styles.visitBtnText, { color: meta.color }]}>Jeg var her  +25 XP</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {discovered && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.photoHeader}>
                    <Text style={styles.sectionTitle}>Bilder</Text>
                    <TouchableOpacity style={[styles.addPhotoBtn, { borderColor: meta.color }]} onPress={handleAddPhoto} disabled={uploading}>
                      {uploading
                        ? <ActivityIndicator size="small" color={meta.color} />
                        : <Text style={[styles.addPhotoBtnText, { color: meta.color }]}>📷 Legg til</Text>
                      }
                    </TouchableOpacity>
                  </View>

                  {photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll} contentContainerStyle={styles.photoScrollContent}>
                      {photos.map((url, i) => (
                        <Image key={i} source={{ uri: url }} style={styles.photoThumb} />
                      ))}
                    </ScrollView>
                  )}

                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Kommentarer</Text>

                  {comments.length === 0 ? (
                    <Text style={styles.emptyComments}>Ingen kommentarer ennå</Text>
                  ) : (
                    comments.map(c => (
                      <View key={c.id} style={styles.commentRow}>
                        <View style={styles.commentHeader}>
                          <Text style={[styles.commentUsername, { color: meta.color }]}>{c.username}</Text>
                          <Text style={styles.commentTime}>{formatTime(c.created_at)}</Text>
                        </View>
                        <Text style={styles.commentText}>{c.text}</Text>
                      </View>
                    ))
                  )}

                  {submitError && (
                    <Text style={styles.errorText}>{submitError}</Text>
                  )}
                  <View style={[styles.inputRow, { borderColor: meta.color + "66" }]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Skriv en kommentar…"
                      placeholderTextColor="#555877"
                      value={commentText}
                      onChangeText={setCommentText}
                      maxLength={200}
                      returnKeyType="send"
                      onSubmitEditing={handleSubmit}
                      submitBehavior="submit"
                    />
                    <TouchableOpacity
                      style={[styles.sendBtn, { backgroundColor: meta.color }]}
                      onPress={handleSubmit}
                      disabled={submitting || !commentText.trim()}
                    >
                      <Text style={styles.sendBtnText}>↑</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Lukk</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    paddingTop: 28,
    maxHeight: "85%",
    shadowColor: "#4a9eff",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    alignItems: "center",
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
  categoryLabel: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 10, letterSpacing: 1.5 },
  name: {
    color: "#ffffff",
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 26,
    textAlign: "center",
    marginBottom: 12,
  },
  hint: {
    color: "#555877",
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  statusText: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 12 },
  visitBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 16,
  },
  visitBtnText: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 14 },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(74,158,255,0.15)",
    marginVertical: 16,
  },
  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginBottom: 12,
  },
  addPhotoBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 32,
    alignItems: "center",
  },
  addPhotoBtnText: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 12 },
  photoScroll: { alignSelf: "stretch", marginBottom: 12 },
  photoScrollContent: { gap: 8 },
  photoThumb: { width: 100, height: 75, borderRadius: 8, backgroundColor: "#1a1a2e" },
  sectionTitle: {
    color: "#9090c0",
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 11,
    letterSpacing: 1.5,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  emptyComments: {
    color: "#555877",
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 13,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  commentRow: {
    alignSelf: "stretch",
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  commentUsername: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 12,
  },
  commentTime: {
    color: "#555877",
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 11,
  },
  commentText: {
    color: "#ccccee",
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    alignItems: "flex-end",
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: {
    color: "#ffffff",
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 16,
  },
  errorText: {
    color: "#ef4444",
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 12,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  closeBtn: {
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 48,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  closeBtnText: { color: "#aaaacc", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 14 },
});
