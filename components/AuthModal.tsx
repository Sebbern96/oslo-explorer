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

interface Props {
  visible: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  mandatory?: boolean;
}

export function AuthModal({ visible, onClose, onSignIn, onSignUp, mandatory }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    if (!email || !password) { setError('Fyll inn e-post og passord.'); return; }
    setLoading(true);
    try {
      if (mode === 'signin') {
        await onSignIn(email, password);
        onClose();
      } else {
        await onSignUp(email, password);
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {!mandatory && (
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.title}>
            {mode === 'signin' ? 'LOGG INN' : 'OPPRETT KONTO'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'signin'
              ? 'Logg inn for å synkronisere fremgang og konkurrere på rangeringslisten.'
              : 'Opprett en konto for å lagre fremgangen din i skyen.'}
          </Text>

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

          <TouchableOpacity
            onPress={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(null); }}
          >
            <Text style={styles.toggle}>
              {mode === 'signin' ? 'Ingen konto? Opprett en' : 'Har du allerede en konto? Logg inn'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  closeBtnText: { color: '#555877', fontSize: 18, fontWeight: '600' },
  title: {
    color: '#4466bb',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#555877',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 15,
    marginBottom: 12,
  },
  error: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  successText: {
    color: '#22c55e',
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
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  toggle: {
    color: '#4466bb',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
});
