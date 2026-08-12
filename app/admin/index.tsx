import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AC, AdminHeader } from '@/components/admin/ui';
import { db } from '@/firebaseConfig';

/** Live count of docs matching `status == open` in a collection. */
function useOpenCount(collectionName: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const q = query(collection(db, collectionName), where('status', '==', 'open'));
    const unsub = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      () => setCount(null)
    );
    return () => unsub();
  }, [collectionName]);
  return count;
}

/** Live count of docs in `collectionName` sitting at `status`. */
function useStatusCount(collectionName: string, status: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const q = query(collection(db, collectionName), where('status', '==', status));
    const unsub = onSnapshot(q, (snap) => setCount(snap.size), () => setCount(null));
    return () => unsub();
  }, [collectionName, status]);
  return count;
}

function Tile({
  icon,
  title,
  body,
  badge,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  badge?: number | null;
  tone?: 'alert';
  onPress: () => void;
}) {
  const showBadge = typeof badge === 'number' && badge > 0;
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <View style={[styles.tileIcon, tone === 'alert' && showBadge && styles.tileIconAlert]}>
        <Ionicons name={icon} size={20} color={tone === 'alert' && showBadge ? AC.red : AC.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.tileTitleRow}>
          <Text style={styles.tileTitle}>{title}</Text>
          {showBadge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.tileBody}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={AC.gray} />
    </Pressable>
  );
}

export default function AdminHubScreen() {
  const openDisputes = useOpenCount('disputes');
  const openClaims   = useOpenCount('careClaims');
  const openReports  = useOpenCount('reports');
  const openFleet    = useStatusCount('fleetOrders', 'requested');

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AdminHeader title="Operations" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warnBox}>
          <Ionicons name="warning-outline" size={18} color={AC.gold} />
          <Text style={styles.warnText}>
            Actions here move real money and change what clients see. Every one is logged against
            your account.
          </Text>
        </View>

        <Tile
          icon="flag-outline"
          title="Disputes"
          body="Release, refund, or split a held payment."
          badge={openDisputes}
          tone="alert"
          onPress={() => router.push('/admin/disputes')}
        />
        <Tile
          icon="shield-checkmark-outline"
          title="Revv Care claims"
          body="Approve or deny damage-protection claims."
          badge={openClaims}
          tone="alert"
          onPress={() => router.push('/admin/claims')}
        />
        <Tile
          icon="warning-outline"
          title="Trust & safety reports"
          body="Off-platform solicitation, safety and conduct reports."
          badge={openReports}
          tone="alert"
          onPress={() => router.push('/admin/reports')}
        />
        <Tile
          icon="car-outline"
          title="Fleet orders"
          body="Quote dealership bulk requests."
          badge={openFleet}
          tone="alert"
          onPress={() => router.push('/admin/fleet')}
        />
        <Tile
          icon="person-circle-outline"
          title="Detailers"
          body="Verify identity and grant Founding Pro."
          onPress={() => router.push('/admin/detailers')}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: AC.bg },
  scroll:        { flex: 1, backgroundColor: AC.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  scrollContent: { padding: 22, paddingBottom: 48, gap: 12 },

  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: AC.goldDim,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
    marginBottom: 4,
  },
  warnText: { color: AC.navy, fontSize: 12.5, fontWeight: '600', flex: 1, lineHeight: 18 },

  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: AC.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: AC.border,
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: AC.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconAlert: { backgroundColor: AC.redDim },
  tileTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileTitle:     { color: AC.navy, fontSize: 15, fontWeight: '800' },
  tileBody:      { color: AC.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },

  badge: {
    backgroundColor: AC.red,
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: 'center',
  },
  badgeText: { color: AC.white, fontSize: 11, fontWeight: '900' },
});
