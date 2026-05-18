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
  bg: '#0D1B2A',
  content: '#F5F5F5',
  card: '#FFFFFF',
  blue: '#1A3A5C',
  gold: '#C9A227',
  gray: '#B7C1CC',
  muted: '#6B7885',
  border: '#E2E8F0',
  white: '#FFFFFF',
  green: '#27AE60',
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
    });
    return () => unsub();
  }, [user?.uid]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Clients</Text>
          {!loading && clients.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{clients.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.gold} />
            </View>
          ) : clients.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={48} color={COLORS.gray} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTitle: { color: COLORS.white, fontSize: 26, fontWeight: '900' },
  countBadge: {
    backgroundColor: COLORS.gold,
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: COLORS.blue, fontSize: 12, fontWeight: '900' },
  body: {
    flex: 1,
    backgroundColor: COLORS.content,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 16,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 24 },
  emptyTitle: { color: COLORS.blue, fontSize: 17, fontWeight: '800' },
  emptyBody: { color: COLORS.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
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
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.blue, fontSize: 16, fontWeight: '900' },
  info: { flex: 1 },
  clientName: { color: COLORS.blue, fontSize: 15, fontWeight: '800', marginBottom: 3 },
  clientMeta: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  clientActive: { color: COLORS.green, fontSize: 11, fontWeight: '700', marginTop: 2 },
  jobsBadge: { alignItems: 'center' },
  jobsBadgeNum: { color: COLORS.blue, fontSize: 20, fontWeight: '900' },
  jobsBadgeLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
});
