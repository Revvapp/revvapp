import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { deleteAccount } from '@/lib/deleteAccount';

const C = {
  card:   '#FFFFFF',
  navy:   '#1A3A5C',
  muted:  '#6B7A8D',
  gray:   '#8A9BB0',
  border: '#E8EDF4',
  red:    '#D93025',
  redDim: 'rgba(217,48,37,0.06)',
  redBorder: 'rgba(217,48,37,0.25)',
  white:  '#FFFFFF',
};

export function DeleteAccountSection({ userType }: { userType: 'client' | 'detailer' }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirmDelete() {
    setError(null);
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void runDelete() },
      ]
    );
  }

  async function runDelete() {
    setBusy(true);
    setError(null);
    try {
      // On success the auth state listener signs the user out and redirects.
      await deleteAccount(password, userType);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Password is incorrect.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again later.');
      } else {
        setError('Could not delete your account. Please try again.');
      }
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="warning-outline" size={16} color={C.red} />
        <Text style={styles.title}>Delete account</Text>
      </View>
      <Text style={styles.body}>
        Permanently delete your account and all associated data. This cannot be undone.
        Enter your password to confirm.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Current password"
        placeholderTextColor={C.muted}
        value={password}
        onChangeText={(t) => { setPassword(t); setError(null); }}
        secureTextEntry
        autoCapitalize="none"
        editable={!busy}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.btn, (busy || !password) && styles.btnOff]}
        onPress={confirmDelete}
        disabled={busy || !password}
      >
        {busy
          ? <ActivityIndicator color={C.white} size="small" />
          : <Text style={styles.btnText}>Delete my account</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.redDim,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.redBorder,
    gap: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: C.red, fontSize: 15, fontWeight: '800' },
  body: { color: C.muted, fontSize: 13, lineHeight: 19 },
  input: {
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.navy,
    borderWidth: 1,
    borderColor: C.border,
  },
  error: { color: C.red, fontSize: 12, fontWeight: '600' },
  btn: {
    backgroundColor: C.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnOff: { opacity: 0.4 },
  btnText: { color: C.white, fontSize: 15, fontWeight: '800' },
});
