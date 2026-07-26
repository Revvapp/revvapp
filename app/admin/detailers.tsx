import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AC, AdminHeader, EmptyState } from '@/components/admin/ui';
import { db } from '@/firebaseConfig';
import { grantFoundingPro, setDetailerVerified } from '@/lib/payments';

type Detailer = {
  id: string;
  name: string;
  businessName: string;
  idVerified: boolean;
  isActive: boolean;
};

function DetailerCard({ detailer }: { detailer: Detailer }) {
  const [busy, setBusy] = useState<'verify' | 'founding' | null>(null);

  async function toggleVerified() {
    const next = !detailer.idVerified;
    Alert.alert(
      next ? 'Mark as verified?' : 'Remove verification?',
      next
        ? 'Only do this after you have reviewed their government ID and business details. This is the interim stand-in for a Checkr background check.'
        : 'Their verified badge will be removed immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: next ? 'default' : 'destructive',
          onPress: async () => {
            setBusy('verify');
            try {
              await setDetailerVerified(detailer.id, next);
            } catch (e) {
              Alert.alert('Could not update', e instanceof Error && e.message ? e.message : 'Please try again.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  async function grantFounding() {
    Alert.alert(
      'Grant Founding Pro?',
      'Gives a 60-day trial and a permanent badge. Limited to the first 25 detailers — the counter is enforced server-side.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Grant',
          onPress: async () => {
            setBusy('founding');
            try {
              await grantFoundingPro(detailer.id);
              Alert.alert('Granted', `${detailer.name} is now a Founding Pro.`);
            } catch (e) {
              Alert.alert(
                'Could not grant',
                e instanceof Error && e.message ? e.message : 'Please try again.'
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{detailer.businessName || detailer.name || detailer.id}</Text>
          {!!detailer.businessName && !!detailer.name && (
            <Text style={styles.sub}>{detailer.name}</Text>
          )}
          <View style={styles.pillRow}>
            <View style={[styles.pill, detailer.idVerified ? styles.pillGood : styles.pillOff]}>
              <Text style={[styles.pillText, detailer.idVerified && styles.pillTextGood]}>
                {detailer.idVerified ? 'Verified' : 'Unverified'}
              </Text>
            </View>
            <View style={[styles.pill, detailer.isActive ? styles.pillGood : styles.pillOff]}>
              <Text style={[styles.pillText, detailer.isActive && styles.pillTextGood]}>
                {detailer.isActive ? 'Subscribed' : 'Not subscribed'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.action, detailer.idVerified && styles.actionDanger, !!busy && styles.actionOff]}
          onPress={toggleVerified}
          disabled={!!busy}
        >
          {busy === 'verify' ? (
            <ActivityIndicator size="small" color={AC.navy} />
          ) : (
            <>
              <Ionicons
                name={detailer.idVerified ? 'close-circle-outline' : 'checkmark-circle-outline'}
                size={16}
                color={detailer.idVerified ? AC.red : AC.navy}
              />
              <Text style={[styles.actionText, detailer.idVerified && styles.actionTextDanger]}>
                {detailer.idVerified ? 'Unverify' : 'Verify'}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.action, !!busy && styles.actionOff]}
          onPress={grantFounding}
          disabled={!!busy}
        >
          {busy === 'founding' ? (
            <ActivityIndicator size="small" color={AC.navy} />
          ) : (
            <>
              <Ionicons name="ribbon-outline" size={16} color={AC.navy} />
              <Text style={styles.actionText}>Founding Pro</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminDetailersScreen() {
  const [detailers, setDetailers] = useState<Detailer[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'detailers'),
      (snap) => {
        setDetailers(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.fullName ?? data.name ?? ''),
              businessName: String(data.businessName ?? ''),
              idVerified: data.idVerified === true,
              isActive: data.isActive === true,
            };
          })
        );
      },
      () => setDetailers([])
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!detailers) return null;
    const q = search.trim().toLowerCase();
    const matches = q
      ? detailers.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.businessName.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q)
        )
      : detailers;
    // Unverified first — that's the queue an admin is actually working through.
    return [...matches].sort((a, b) => Number(a.idVerified) - Number(b.idVerified));
  }, [detailers, search]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AdminHeader title="Detailers" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchRow}>
            <Ionicons name="search" size={17} color={AC.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, business or uid"
              placeholderTextColor={AC.muted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>

          {filtered === null ? (
            <ActivityIndicator color={AC.gold} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <EmptyState icon="person-outline" text="No detailers match that search." />
          ) : (
            filtered.map((d) => <DetailerCard key={d.id} detailer={d} />)
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: AC.bg },
  scroll:        { flex: 1, backgroundColor: AC.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  scrollContent: { padding: 22, paddingBottom: 48, gap: 12 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AC.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AC.border,
    paddingHorizontal: 14,
    marginBottom: 2,
  },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 14, color: AC.navy },

  card: {
    backgroundColor: AC.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AC.border,
    padding: 16,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  name:     { color: AC.navy, fontSize: 15, fontWeight: '800' },
  sub:      { color: AC.muted, fontSize: 12.5, marginTop: 1 },

  pillRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pill:    { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  pillGood:{ backgroundColor: AC.greenDim },
  pillOff: { backgroundColor: AC.surface },
  pillText:     { color: AC.muted, fontSize: 11, fontWeight: '700' },
  pillTextGood: { color: AC.green },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: AC.border,
  },
  actionDanger:     { borderColor: 'rgba(217,48,37,0.35)' },
  actionOff:        { opacity: 0.4 },
  actionText:       { color: AC.navy, fontSize: 13, fontWeight: '800' },
  actionTextDanger: { color: AC.red },
});
