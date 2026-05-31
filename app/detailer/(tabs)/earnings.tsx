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
import {
  endOfMonth,
  startOfMonth,
  startOfWeekSunday,
  endOfWeekSaturday,
  dateKeyInRange,
} from '@/lib/dateKeys';

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
  darkText: '#0A1628',
};

type InvoiceRow = {
  id: string;
  detailerPayout: number;
  service: string;
  clientName: string;
  date: string;
  status: string;
};

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (isNaN(y)) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DetailerEarningsScreen() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const q = query(collection(db, 'invoices'), where('detailerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const rows: InvoiceRow[] = snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          detailerPayout: Number(x.detailerPayout ?? 0),
          service: String(x.service ?? ''),
          clientName: x.clientName ? String(x.clientName) : 'Client',
          date: String(x.date ?? ''),
          status: String(x.status ?? ''),
        };
      });
      rows.sort((a, b) => b.date.localeCompare(a.date));
      setInvoices(rows);
      setLoading(false);
    }, (e) => {
      if (__DEV__) console.warn('[earnings listener]', e.message);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const today = new Date();
  const ws = startOfWeekSunday(today);
  const we = endOfWeekSaturday(today);
  const ms = startOfMonth(today);
  const me = endOfMonth(today);

  const thisMonth = invoices.filter((i) => dateKeyInRange(i.date, ms, me));
  const lastMonthStart = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const lastMonthEnd = endOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const lastMonth = invoices.filter((i) => dateKeyInRange(i.date, lastMonthStart, lastMonthEnd));
  const thisWeek = invoices.filter((i) => dateKeyInRange(i.date, ws, we));

  const monthTotal = thisMonth.reduce((s, i) => s + i.detailerPayout, 0);
  const lastMonthTotal = lastMonth.reduce((s, i) => s + i.detailerPayout, 0);
  const weekTotal = thisWeek.reduce((s, i) => s + i.detailerPayout, 0);
  const allTimeTotal = invoices.reduce((s, i) => s + i.detailerPayout, 0);

  const monthChange = lastMonthTotal > 0
    ? Math.round(((monthTotal - lastMonthTotal) / lastMonthTotal) * 100)
    : null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>REVV</Text>
          <Text style={styles.headerTitle}>Earnings</Text>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyInner}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.gold} />
            </View>
          ) : (
            <>
              {/* Month hero card */}
              <View style={styles.heroCard}>
                <Text style={styles.heroLabel}>This Month&apos;s Payout</Text>
                <Text style={styles.heroAmount}>{fmt(monthTotal)}</Text>
                {monthChange !== null ? (
                  <View style={styles.changeRow}>
                    <Ionicons
                      name={monthChange >= 0 ? 'trending-up' : 'trending-down'}
                      size={14}
                      color={monthChange >= 0 ? '#27AE60' : '#D93025'}
                    />
                    <Text style={[styles.changeText, { color: monthChange >= 0 ? '#27AE60' : '#D93025' }]}>
                      {Math.abs(monthChange)}% vs last month
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.heroSub}>No data from last month to compare</Text>
                )}
              </View>

              {/* Stat grid */}
              <View style={styles.grid}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>THIS WEEK</Text>
                  <Text style={styles.statValue}>{fmt(weekTotal)}</Text>
                  <Text style={styles.statSub}>{thisWeek.length} invoice{thisWeek.length !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>ALL TIME</Text>
                  <Text style={styles.statValue}>{fmt(allTimeTotal)}</Text>
                  <Text style={styles.statSub}>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</Text>
                </View>
              </View>

              {/* Invoice history */}
              <Text style={styles.sectionTitle}>Invoice History</Text>

              {invoices.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconRing}>
                    <Ionicons name="receipt-outline" size={28} color={COLORS.gold} />
                  </View>
                  <Text style={styles.emptyTitle}>No invoices yet</Text>
                  <Text style={styles.emptyBody}>Completed jobs will generate invoices that appear here.</Text>
                </View>
              ) : (
                invoices.map((inv) => (
                  <View key={inv.id} style={styles.invoiceCard}>
                    <View style={styles.invoiceLeft}>
                      <Text style={styles.invoiceClient}>{inv.clientName}</Text>
                      <Text style={styles.invoiceService} numberOfLines={1}>{inv.service}</Text>
                      <Text style={styles.invoiceDate}>{fmtDate(inv.date)}</Text>
                    </View>
                    <View style={styles.invoiceRight}>
                      <Text style={styles.invoiceAmount}>{fmt(inv.detailerPayout)}</Text>
                      <View style={styles.badge}>
                        <View style={[styles.badgeDot, { backgroundColor: inv.status === 'released' ? '#27AE60' : inv.status === 'disputed' ? '#D93025' : '#C9A227' }]} />
                        <Text style={styles.badgeText}>{inv.status === 'released' ? 'Paid Out' : inv.status === 'disputed' ? 'Disputed' : 'Pending'}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 18 },
  headerEyebrow: { color: '#C9A227', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 2 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  body: {
    flex: 1,
    backgroundColor: '#F4F6F9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  bodyInner: { padding: 20, paddingBottom: 40 },
  loadingWrap: { paddingTop: 60, alignItems: 'center' },
  heroCard: {
    backgroundColor: COLORS.gold,
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  heroLabel: { color: COLORS.darkText, fontSize: 13, fontWeight: '700', marginBottom: 4, opacity: 0.75 },
  heroAmount: { color: COLORS.darkText, fontSize: 38, fontWeight: '900', marginBottom: 6 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  changeText: { fontSize: 13, fontWeight: '700' },
  heroSub: { color: COLORS.darkText, fontSize: 13, fontWeight: '500', opacity: 0.7 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  statLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
  statValue: { color: COLORS.navy, fontSize: 22, fontWeight: '900', marginBottom: 2 },
  statSub: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  sectionTitle: { color: COLORS.navy, fontSize: 16, fontWeight: '800', marginBottom: 12 },
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
  invoiceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  invoiceLeft: { flex: 1, marginRight: 12 },
  invoiceClient: { color: COLORS.navy, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  invoiceService: { color: COLORS.muted, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  invoiceDate: { color: COLORS.gray, fontSize: 11, fontWeight: '600' },
  invoiceRight: { alignItems: 'flex-end', gap: 6 },
  invoiceAmount: { color: COLORS.green, fontSize: 18, fontWeight: '900' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { color: '#6B7A8D', fontSize: 12, fontWeight: '700' },
});
