import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { toTitleCase } from '@/lib/format';

const COLORS = {
  bg: '#0A1628',
  content: '#F4F6F9',
  card: '#FFFFFF',
  navy: '#1A3A5C',
  gold: '#C9A227',
  goldLight: 'rgba(201,162,39,0.1)',
  goldBorder: 'rgba(201,162,39,0.3)',
  white: '#FFFFFF',
  gray: '#8A9BB0',
  muted: '#6B7A8D',
  border: '#E8EDF4',
  green: '#27AE60',
  red: '#D93025',
};

type ClientSummary = {
  clientId: string;
  name: string;
  jobsTotal: number;
  jobsDone: number;
  totalSpent: number;
  lastDate: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function DetailerClientsScreen() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const q = query(collection(db, 'bookings'), where('detailerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const map = new Map<string, ClientSummary>();
      snap.docs.forEach((d) => {
        const x = d.data();
        const clientId = String(x.clientId ?? '');
        if (!clientId) return;
        const name = x.clientName ? toTitleCase(String(x.clientName)) : 'Unknown Client';
        const status = String(x.status ?? '');
        const price = Number(x.price ?? 0);
        const date = String(x.date ?? '');
        const existing = map.get(clientId);
        if (existing) {
          existing.jobsTotal += 1;
          if (status === 'completed') { existing.jobsDone += 1; existing.totalSpent += price; }
          if (date > existing.lastDate) existing.lastDate = date;
        } else {
          map.set(clientId, {
            clientId,
            name,
            jobsTotal: 1,
            jobsDone: status === 'completed' ? 1 : 0,
            totalSpent: status === 'completed' ? price : 0,
            lastDate: date,
          });
        }
      });
      const sorted = Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
      setClients(sorted);
      setLoading(false);
    }, (e) => {
      if (__DEV__) console.warn('[clients listener]', e.message);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>REVV</Text>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Clients</Text>
            {!loading && clients.length > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countText}>{clients.length}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.gold} />
            </View>
          ) : clients.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconRing}>
                <Ionicons name="people-outline" size={28} color={COLORS.gold} />
              </View>
              <Text style={styles.emptyTitle}>No clients yet</Text>
              <Text style={styles.emptyBody}>Clients will appear here once you accept and complete bookings.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {clients.map((c) => (
                <View key={c.clientId} style={styles.card}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(c.name)}</Text>
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.clientName}>{c.name}</Text>
                    <Text style={styles.clientMeta}>
                      {c.jobsDone} job{c.jobsDone !== 1 ? 's' : ''} completed
                      {c.totalSpent > 0 ? ` · $${Math.round(c.totalSpent).toLocaleString()} total` : ''}
                    </Text>
                    {c.jobsTotal > c.jobsDone && (
                      <Text style={styles.clientActive}>
                        {c.jobsTotal - c.jobsDone} booking{c.jobsTotal - c.jobsDone !== 1 ? 's' : ''} in progress
                      </Text>
                    )}
                  </View>
                  <View style={styles.jobsBadge}>
                    <Text style={styles.jobsBadgeNum}>{c.jobsTotal}</Text>
                    <Text style={styles.jobsBadgeLabel}>jobs</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 18 },
  headerEyebrow: { color: '#C9A227', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  countPill: {
    backgroundColor: '#C9A227',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countText: { color: '#1A3A5C', fontSize: 12, fontWeight: '900' },
  body: {
    flex: 1,
    backgroundColor: '#F4F6F9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingTop: 16,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 14, paddingHorizontal: 32 },
  emptyIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: '#1A3A5C', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: '#6B7A8D', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  list: { paddingHorizontal: 20, paddingBottom: 30, gap: 10 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1A3A5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#C9A227', fontSize: 16, fontWeight: '900' },
  info: { flex: 1 },
  clientName: { color: COLORS.navy, fontSize: 15, fontWeight: '800', marginBottom: 3 },
  clientMeta: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  clientActive: { color: COLORS.green, fontSize: 11, fontWeight: '700', marginTop: 2 },
  jobsBadge: { alignItems: 'center' },
  jobsBadgeNum: { color: COLORS.navy, fontSize: 20, fontWeight: '900' },
  jobsBadgeLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
});
