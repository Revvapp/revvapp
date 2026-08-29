import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { listBlocked, unblockUser, type BlockedAccount } from '@/lib/blocks';

const C = {
  bg: '#0A1628', surface: '#F5F7FA', card: '#FFFFFF', navy: '#1A3A5C',
  gold: '#C9A227', gray: '#8A9BB0', muted: '#6B7A8D', border: '#E8EDF4',
  white: '#FFFFFF', danger: '#C0392B',
};

export default function BlockedAccountsScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BlockedAccount[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setRows(await listBlocked(user.uid));
    } catch {
      setRows([]);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const confirmUnblock = (row: BlockedAccount) => {
    Alert.alert(
      'Unblock this person?',
      `${row.name || 'They'} will be able to message you again on shared bookings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            if (!user?.uid) return;
            setBusy(row.uid);
            try {
              await unblockUser(user.uid, row.uid);
              await load();
            } catch {
              Alert.alert('Could not unblock', 'Please try again.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Blocked accounts</Text>
        <View style={styles.back} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.intro}>
          Blocked people can&rsquo;t message you. They aren&rsquo;t told that you blocked them.
        </Text>

        {rows === null && <ActivityIndicator color={C.gold} style={{ marginTop: 28 }} />}

        {rows?.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={26} color={C.gray} />
            <Text style={styles.emptyText}>You haven&rsquo;t blocked anyone.</Text>
          </View>
        )}

        {rows && rows.length > 0 && (
          <View style={styles.card}>
            {rows.map((r, i) => (
              <View key={r.uid} style={[styles.row, i > 0 && styles.rowDivided]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.name || 'Revv user'}</Text>
                  {r.blockedAt && (
                    <Text style={styles.sub}>
                      Blocked {r.blockedAt.toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <Pressable
                  style={styles.unblock}
                  onPress={() => confirmUnblock(r)}
                  disabled={busy === r.uid}
                >
                  {busy === r.uid
                    ? <ActivityIndicator size="small" color={C.navy} />
                    : <Text style={styles.unblockText}>Unblock</Text>}
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footnote}>
          To report someone, open the booking and choose Report a Problem. Reports go
          to our trust &amp; safety team and are never shown to the other person.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  back: { width: 28 },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: '800' },
  body: { flex: 1, backgroundColor: C.surface },
  bodyContent: { padding: 20, paddingBottom: 48 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  card: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  rowDivided: { borderTopWidth: 1, borderTopColor: C.border },
  name: { color: C.navy, fontSize: 15, fontWeight: '700' },
  sub: { color: C.gray, fontSize: 12.5, marginTop: 2 },
  unblock: {
    borderWidth: 1, borderColor: C.border, borderRadius: 9,
    paddingHorizontal: 14, paddingVertical: 8, minWidth: 84, alignItems: 'center',
  },
  unblockText: { color: C.navy, fontSize: 13.5, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: C.muted, fontSize: 14 },
  footnote: { color: C.gray, fontSize: 12, lineHeight: 17, marginTop: 18 },
});
