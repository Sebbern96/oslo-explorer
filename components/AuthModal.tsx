import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, username: string) => Promise<void>;
  mandatory?: boolean;
  standalone?: boolean;
}

export function AuthModal({ visible, onClose, onSignIn, onSignUp, mandatory, standalone }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    if (!email || !password) { setError('Fyll inn e-post og passord.'); return; }
    if (mode === 'signup' && !username.trim()) { setError('Velg et brukernavn.'); return; }
    setLoading(true);
    try {
      if (mode === 'signin') {
        await onSignIn(email, password);
        onClose();
      } else {
        await onSignUp(email, password, username.trim());
        setSuccess('Konto opprettet! Sjekk e-posten din for bekreftelse.');
      }
    } catch (e: any) {
      setError(e.message ?? 'Noe gikk galt.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (mandatory) return;
    setEmail('');
    setPassword('');
    setError(null);
    setSuccess(null);
    onClose();
  }

  function toggleMode() {
    setMode(m => m === 'signin' ? 'signup' : 'signin');
    setError(null);
    setSuccess(null);
  }

  const form = (
    <>
      <Text style={styles.formTitle}>
        {mode === 'signin' ? 'LOGG INN' : 'OPPRETT KONTO'}
      </Text>

      {mode === 'signup' && (
        <TextInput
          style={styles.input}
          placeholder="Brukernavn"
          placeholderTextColor="#444466"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="E-post"
        placeholderTextColor="#444466"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        placeholder="Passord"
        placeholderTextColor="#444466"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {success && <Text style={styles.successText}>{success}</Text>}

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitBtnText}>
              {mode === 'signin' ? 'Logg inn' : 'Opprett konto'}
            </Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={toggleMode}>
        <Text style={styles.toggle}>
          {mode === 'signin' ? 'Ingen konto? Opprett en' : 'Har du allerede en konto? Logg inn'}
        </Text>
      </TouchableOpacity>
    </>
  );

  if (standalone) {
    return (
      <LinearGradient
        colors={['#070714', '#0a0a1a', '#0d0d22']}
        style={styles.screen}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={styles.screenInner}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.hero}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>OSLO EXPLORER</Text>
              </View>
              <Text style={styles.heroTitle}>{'Utforsk Oslo.\nAvdekk kartet.'}</Text>
              <Text style={styles.heroSub}>Logg inn for å lagre fremgangen din og konkurrere på rangeringslisten.</Text>
            </View>

            <View style={styles.formCard}>
              {form}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const sheetContent = (
    <View style={styles.sheet}>
      {!mandatory && (
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.sheetTitle}>
        {mode === 'signin' ? 'LOGG INN' : 'OPPRETT KONTO'}
      </Text>
      <Text style={styles.sheetSubtitle}>
        {mode === 'signin'
          ? 'Logg inn for å synkronisere fremgang og konkurrere på rangeringslisten.'
          : 'Opprett en konto for å lagre fremgangen din i skyen.'}
      </Text>
      {form}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {sheetContent}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // --- Standalone full-screen ---
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  screenInner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  hero: {
    paddingTop: 56,
    paddingBottom: 24,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 24,
    backgroundColor: 'rgba(74,158,255,0.08)',
  },
  heroBadgeText: {
    color: '#4a9eff',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    letterSpacing: 3,
  },
  heroTitle: {
    color: '#ffffff',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 38,
    letterSpacing: -0.5,
    lineHeight: 44,
    marginBottom: 16,
  },
  heroSub: {
    color: '#6678aa',
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: 'rgba(13,13,31,0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 20,
    shadowColor: '#4a9eff',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  formTitle: {
    color: '#4466bb',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 16,
  },

  // --- Modal sheet ---
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#0d0d1f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(74,158,255,0.3)',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    shadowColor: '#4a9eff',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#555877', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18 },
  sheetTitle: {
    color: '#4466bb',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  sheetSubtitle: {
    color: '#555877',
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },

  // --- Shared form elements ---
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 15,
    marginBottom: 12,
  },
  error: {
    color: '#ef4444',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  successText: {
    color: '#22c55e',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#4a9eff',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15 },
  toggle: {
    color: '#4466bb',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 12,
    textAlign: 'center',
  },
});
