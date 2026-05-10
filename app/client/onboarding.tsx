import { router } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { auth, db } from '@/firebaseConfig';

const COLORS = {
  bg: '#0D1B2A',
  card: '#1A2B3C',
  gold: '#C9A227',
  white: '#FFFFFF',
  gray: '#B7C1CC',
  error: '#E57373',
};

export default function ClientOnboardingScreen() {
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onContinue = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError('You must be signed in.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await setDoc(
        doc(db, 'users', uid),
        {
          onboardingComplete: true,
        },
        { merge: true }
      );
      await refreshProfile();
      router.replace('/client/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not continue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.brand}>
          <Text style={styles.brandWhite}>RE</Text>
          <Text style={styles.brandGold}>VV</Text>
        </Text>
        <View style={styles.card}>
          <Text style={styles.title}>WELCOME TO REVV</Text>
          <Text style={styles.body}>
            You&apos;re signed in. Finish this short step to unlock your home screen, save vehicles, and book
            verified detailers in Sacramento.
          </Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.btn} onPress={onContinue} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.bg} />
            ) : (
              <Text style={styles.btnText}>CONTINUE TO HOME</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, paddingHorizontal: 22, justifyContent: 'center' },
  brand: { fontSize: 36, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 24 },
  brandWhite: { color: COLORS.white },
  brandGold: { color: COLORS.gold },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2C3F52',
  },
  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  body: { color: COLORS.gray, fontSize: 15, lineHeight: 22, marginBottom: 20 },
  error: { color: COLORS.error, marginBottom: 12, fontSize: 13 },
  btn: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { color: COLORS.bg, fontWeight: '900', letterSpacing: 1.2 },
});
