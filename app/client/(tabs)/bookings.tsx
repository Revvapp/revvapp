import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { toTitleCase } from '@/lib/format';
import type { BookingDocument } from '@/types/firestore';

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
  red: '#D93025',
  orange: '#E67E22',
};

type TabType = 'upcoming' | 'history';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Awaiting Acceptance', color: COLORS.orange, bg: '#FEF3E2' },
  active:    { label: 'In Progress',         color: COLORS.blue,   bg: '#E8F0FB' },
  confirmed: { label: 'Confirmed',           color: COLORS.green,  bg: '#E8F8EF' },
  completed: { label: 'Completed',           color: COLORS.green,  bg: '#E8F8EF' },
  declined:  { label: 'Declined',            color: COLORS.red,    bg: '#FDECEA' },
  cancelled: { label: 'Cancelled',           color: COLORS.muted,  bg: '#F0F2F5' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: toTitleCase(status), color: COLORS.muted, bg: '#F0F2F5' };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function BookingCard({ booking }: { booking: BookingDocument }) {
  const detailerLabel = booking.detailerName
    ? toTitleCase(booking.detailerName)
    : 'Your Detailer';

  const [y, m, d] = (booking.date ?? '').split('-').map(Number);
  const dateLabel = !isNaN(y)
    ? new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : booking.date;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <StatusBadge status={booking.status} />
        <Text style={styles.price}>
          ${typeof booking.price === 'number'
            ? booking.price % 1 === 0 ? booking.price.toFixed(0) : booking.price.toFixed(2)
            : booking.price}
        </Text>
      </View>

      <Text style={styles.serviceName}>{toTitleCase(booking.service ?? '')}</Text>
      <Text style={styles.detailerName}>with {detailerLabel}</Text>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={13} color={COLORS.muted} />
        <Text style={styles.metaText}>{dateLabel}</Text>
        <Text style={styles.dot}>·</Text>
        <Ionicons name="time-outline" size={13} color={COLORS.muted} />
        <Text style={styles.metaText}>{booking.time}</Text>
      </View>

      {booking.vehicleLabel && (
        <View style={styles.metaRow}>
          <Ionicons name="car-sport-outline" size={13} color={COLORS.muted} />
          <Text style={styles.metaText}>{booking.vehicleLabel}</Text>
        </View>
      )}

      {booking.address && (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={COLORS.muted} />
          <Text style={styles.metaText} numberOfLines={1}>{booking.address}</Text>
        </View>
      )}

      {booking.status === 'vir_submitted' && (
        <Pressable
          style={styles.signCTA}
          onPress={() => router.push({ pathname: '/client/vir/[id]', params: { id: booking.id } })}
        >
          <Ionicons name="pencil-outline" size={15} color={COLORS.blue} />
          <Text style={styles.signCTAText}>Review & Sign Inspection</Text>
        </Pressable>
      )}
    </View>
  );
}

function EmptyState({ tab }: { tab: TabType }) {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons
        name={tab === 'upcoming' ? 'calendar-outline' : 'checkmark-done-circle-outline'}
        size={48}
        color={COLORS.gray}
      />
      <Text style={styles.emptyTitle}>
        {tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
      </Text>
      <Text style={styles.emptyBody}>
        {tab === 'upcoming'
          ? 'Book a detailer from the Find tab to get started.'
          : 'Completed and declined bookings will appear here.'}
      </Text>
    </View>
  );
}

export default function ClientBookingsScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('upcoming');

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'bookings'), where('clientId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          clientId: String(x.clientId ?? ''),
          detailerId: String(x.detailerId ?? ''),
          detailerName: x.detailerName ? String(x.detailerName) : undefined,
          service: String(x.service ?? ''),
          price: Number(x.price ?? 0),
          status: String(x.status ?? '').toLowerCase(),
          date: String(x.date ?? ''),
          time: String(x.time ?? ''),
          vehicleId: String(x.vehicleId ?? ''),
          vehicleLabel: x.vehicleLabel ? String(x.vehicleLabel) : undefined,
          address: x.address ? String(x.address) : undefined,
          notes: x.notes ? String(x.notes) : undefined,
          clientName: x.clientName ? String(x.clientName) : undefined,
          createdAt: x.createdAt ?? null,
        } satisfies BookingDocument;
      });
      docs.sort((a, b) => a.date.localeCompare(b.date));
      setBookings(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const upcoming = bookings.filter((b) => ['pending', 'active', 'confirmed'].includes(b.status));
  const history = bookings.filter((b) => ['completed', 'declined', 'cancelled'].includes(b.status));
  const displayed = tab === 'upcoming' ? upcoming : history;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        {!loading && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{upcoming.length}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, tab === 'upcoming' && styles.tabBtnActive]}
            onPress={() => setTab('upcoming')}
          >
            <Text style={[styles.tabBtnText, tab === 'upcoming' && styles.tabBtnTextActive]}>
              Upcoming {upcoming.length > 0 ? `(${upcoming.length})` : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
            onPress={() => setTab('history')}
          >
            <Text style={[styles.tabBtnText, tab === 'history' && styles.tabBtnTextActive]}>
              History {history.length > 0 ? `(${history.length})` : ''}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {displayed.length === 0 ? (
              <EmptyState tab={tab} />
            ) : (
              displayed.map((b) => <BookingCard key={b.id} booking={b} />)
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerTitle: { color: COLORS.white, fontSize: 26, fontWeight: '900' },
  countBadge: {
    backgroundColor: COLORS.gold,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countText: { color: COLORS.blue, fontSize: 12, fontWeight: '900' },
  body: {
    flex: 1,
    backgroundColor: COLORS.content,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 16,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  tabBtnActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  tabBtnText: { color: COLORS.muted, fontSize: 13, fontWeight: '800' },
  tabBtnTextActive: { color: COLORS.white },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  price: { color: COLORS.blue, fontSize: 20, fontWeight: '900' },
  serviceName: { color: COLORS.blue, fontSize: 17, fontWeight: '900', marginBottom: 2 },
  detailerName: { color: COLORS.muted, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  metaText: { color: COLORS.muted, fontSize: 13, fontWeight: '600', flex: 1 },
  dot: { color: COLORS.gray },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 20 },
  emptyTitle: { color: COLORS.blue, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: COLORS.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  signCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    justifyContent: 'center',
  },
  signCTAText: { color: COLORS.blue, fontSize: 13, fontWeight: '900' },
});
