import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { mapFirestoreError } from '@/lib/firestoreErrors';

const C = {
  bg:      '#0A1628',
  surface: '#F5F7FA',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  gray:    '#8A9BB0',
  muted:   '#6B7A8D',
  border:  '#E8EDF4',
  white:   '#FFFFFF',
  danger:  '#C0392B',
};

/**
 * Email and SMS opt-outs. Both default to on — an existing user has no
 * `notificationPrefs` field, and defaulting to off would silently mute
 * everyone. Push is intentionally absent: it is governed by the OS permission
 * prompt, and a second switch here could only ever disagree with it.
 */
type Prefs = { email: boolean; sms: boolean };

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The guard sits inside the try so `finally` always clears the spinner —
      // returning early above it left the screen loading forever.
      try {
        if (!user?.uid) return;
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        const prefs = snap.data()?.notificationPrefs ?? {};
        setEmail(prefs.email !== false);
        setSms(prefs.sms !== false);
      } catch (e) {
        if (!cancelled) setError(mapFirestoreError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Write through on toggle rather than behind a Save button: there is nothing
  // to validate, and a settings screen the user backs out of should not
  // silently discard what they just chose.
  const save = useCallback(
    async (next: Prefs, prev: Prefs) => {
      if (!user?.uid) return;
      setError('');
      try {
        await updateDoc(doc(db, 'users', user.uid), { notificationPrefs: next });
      } catch (e) {
        setError(mapFirestoreError(e));
        // Restore the exact prior state, so the switches never show a setting
        // the server rejected.
        setEmail(prev.email);
        setSms(prev.sms);
      }
    },
    [user?.uid]
  );

  const onToggleEmail = (value: boolean) => {
    setEmail(value);
    void save({ email: value, sms }, { email, sms });
  };

  const onToggleSms = (value: boolean) => {
    setSms(value);
    void save({ email, sms: value }, { email, sms });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.back} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 32 }} />
        ) : (
          <>
            <Text style={styles.intro}>
              Push notifications are always on while you allow them in your device settings.
              Choose how else you&rsquo;d like to hear from us.
            </Text>

            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Email</Text>
                  <Text style={styles.rowSub}>
                    Booking updates, invoices, dispute and Revv Care decisions.
                  </Text>
                </View>
                <Switch
                  value={email}
                  onValueChange={onToggleEmail}
                  trackColor={{ false: C.border, true: C.gold }}
                  thumbColor={C.white}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Text messages</Text>
                  <Text style={styles.rowSub}>
                    Only time-sensitive alerts: new booking requests, a cancellation,
                    an inspection waiting on your signature, or a failed subscription payment.
                  </Text>
                </View>
                <Switch
                  value={sms}
                  onValueChange={onToggleSms}
                  trackColor={{ false: C.border, true: C.gold }}
                  thumbColor={C.white}
                />
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.footnote}>
              We&rsquo;ll still email you about account security and anything we&rsquo;re
              legally required to send. Standard message and data rates may apply to
              texts; reply STOP to any message to opt out.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  back: { width: 28 },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: '800' },
  body: { flex: 1, backgroundColor: C.surface },
  bodyContent: { padding: 20, paddingBottom: 48 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 14 },
  rowText: { flex: 1 },
  rowTitle: { color: C.navy, fontSize: 15, fontWeight: '800', marginBottom: 3 },
  rowSub: { color: C.gray, fontSize: 12.5, lineHeight: 17 },
  divider: { height: 1, backgroundColor: C.border },
  error: { color: C.danger, fontSize: 13, marginTop: 14 },
  footnote: { color: C.gray, fontSize: 12, lineHeight: 17, marginTop: 18 },
});
