import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { sendPushToUser } from '@/lib/pushNotifications';
import { toTitleCase } from '@/lib/format';
import type { BookingDocument } from '@/types/firestore';

async function cancelBooking(id: string) {
  await updateDoc(doc(db, 'bookings', id), { status: 'cancelled' });
  const bookSnap = await getDoc(doc(db, 'bookings', id));
  if (bookSnap.exists()) {
    const detailerId = String(bookSnap.data().detailerId ?? '');
    const clientName = String(bookSnap.data().clientName ?? 'A client');
    if (detailerId) {
      const detailerSnap = await getDoc(doc(db, 'detailers', detailerId));
      if (detailerSnap.exists()) {
        sendPushToUser(
          detailerSnap.data().expoPushToken,
          'Booking Cancelled',
          `${clientName} has cancelled their booking.`
        );
      }
    }
  }
}

const C = {
  bg:      '#0A1628',
  content: '#F4F6F9',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  gray:    '#8A9BB0',
  muted:   '#6B7A8D',
  border:  '#E8EDF4',
  green:   '#27AE60',
  red:     '#D93025',
  white:   '#FFFFFF',
};

type TabType = 'upcoming' | 'history';

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  pending:       { label: 'Awaiting Acceptance', dot: C.gold },
  active:        { label: 'Confirmed',           dot: C.navy },
  confirmed:     { label: 'Confirmed',           dot: C.navy },
  vir_submitted: { label: 'Sign Inspection',     dot: '#E67E22' },
  vir_signed:    { label: 'Starting Soon',       dot: C.green },
  in_progress:   { label: 'In Progress',         dot: C.green },
  paused:        { label: 'Paused',              dot: C.gold },
  completed:     { label: 'Completed',           dot: C.green },
  declined:      { label: 'Declined',            dot: C.red },
  cancelled:     { label: 'Cancelled',           dot: C.gray },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: toTitleCase(status), dot: C.gray };
  return (
    <View style={styles.badge}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={styles.badgeText}>{cfg.label}</Text>
    </View>
  );
}

function BookingCard({ booking }: { booking: BookingDocument }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const detailerLabel = booking.detailerName ? toTitleCase(booking.detailerName) : 'Your Detailer';
  const [y, m, d] = (booking.date ?? '').split('-').map(Number);
  const dateLabel = !isNaN(y)
    ? new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : booking.date;

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
    >
    <Animated.View style={[styles.card, animStyle]}>
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

      <Text style={styles.metaText}>
        {[dateLabel, booking.time, booking.vehicleLabel].filter(Boolean).join(' · ')}
      </Text>

      {booking.address && (
        <Text style={styles.addressText} numberOfLines={1}>{booking.address}</Text>
      )}

      {booking.status === 'vir_submitted' && (
        <Pressable
          style={styles.ctaPrimary}
          onPress={() => router.push({ pathname: '/client/vir/[id]', params: { id: booking.id } })}
        >
          <Ionicons name="pencil-outline" size={15} color={C.navy} />
          <Text style={styles.ctaPrimaryText}>Review & Sign Inspection</Text>
        </Pressable>
      )}

      {booking.status === 'completed' && (
        <>
          {!(booking as any).hasReview ? (
            <Pressable
              style={styles.ctaPrimary}
              onPress={() => router.push({ pathname: '/client/review/[id]', params: { id: booking.id } })}
            >
              <Ionicons name="star-outline" size={15} color={C.navy} />
              <Text style={styles.ctaPrimaryText}>Leave a Review</Text>
            </Pressable>
          ) : (
            <View style={styles.reviewedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={C.green} />
              <Text style={styles.reviewedText}>Review Submitted</Text>
            </View>
          )}
          <Pressable
            style={styles.ctaSecondary}
            onPress={() => router.push({ pathname: '/client/invoice/[id]', params: { id: booking.id } })}
          >
            <Text style={styles.ctaSecondaryText}>View Receipt</Text>
            <Ionicons name="arrow-forward" size={13} color={C.navy} />
          </Pressable>
        </>
      )}

      {['active', 'confirmed', 'vir_submitted', 'vir_signed', 'in_progress', 'paused'].includes(booking.status) && (
        <Pressable
          style={styles.ctaMessage}
          onPress={() => router.push({ pathname: '/client/conversation/[id]', params: { id: booking.id } })}
        >
          <Ionicons name="chatbubble-outline" size={13} color={C.muted} />
          <Text style={styles.ctaMessageText}>Message Detailer</Text>
        </Pressable>
      )}

      {['pending', 'confirmed'].includes(booking.status) && (
        <Pressable
          style={styles.cancelBtn}
          onPress={() =>
            Alert.alert(
              'Cancel Booking',
              'Are you sure you want to cancel this booking?',
              [
                { text: 'Keep Booking', style: 'cancel' },
                {
                  text: 'Cancel Booking',
                  style: 'destructive',
                  onPress: () => cancelBooking(booking.id),
                },
              ]
            )
          }
        >
          <Ionicons name="close-circle-outline" size={13} color={C.muted} />
          <Text style={styles.cancelBtnText}>Cancel Booking</Text>
        </Pressable>
      )}

      {['pending', 'active', 'confirmed', 'vir_submitted', 'vir_signed', 'in_progress', 'paused'].includes(booking.status) && (
        <Pressable
          style={styles.reportBtn}
          onPress={() =>
            Alert.alert(
              'Report Off-Platform Request',
              'Did your detailer ask you to pay outside of REVV (cash, Venmo, Zelle, etc.)?\n\nThis violates our terms and removes your payment protection.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Submit Report',
                  style: 'destructive',
                  onPress: () =>
                    Alert.alert('Report Submitted', 'Thank you. Our team will review this booking.'),
                },
              ]
            )
          }
        >
          <Ionicons name="flag-outline" size={12} color={C.red} />
          <Text style={styles.reportBtnText}>Report Off-Platform Request</Text>
        </Pressable>
      )}
    </Animated.View>
    </Pressable>
  );
}

function EmptyState({ tab }: { tab: TabType }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconRing}>
        <Ionicons
          name={tab === 'upcoming' ? 'calendar-outline' : 'checkmark-circle-outline'}
          size={28}
          color={C.gold}
        />
      </View>
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

  const upcoming = bookings.filter((b) =>
    ['pending', 'active', 'confirmed', 'vir_submitted', 'vir_signed', 'in_progress', 'paused'].includes(b.status)
  );
  const history = bookings.filter((b) =>
    ['completed', 'declined', 'cancelled'].includes(b.status)
  );
  const displayed = tab === 'upcoming' ? upcoming : history;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>My Bookings</Text>
          {!loading && upcoming.length > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{upcoming.length}</Text>
            </View>
          )}
        </View>
      </View>

      <Animated.View entering={FadeIn.duration(350)} style={styles.contentArea}>
        {/* Underline tab row */}
        <View style={styles.tabRow}>
          {(['upcoming', 'history'] as TabType[]).map((t) => (
            <Pressable key={t} style={styles.tabBtn} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'upcoming' ? `Upcoming${upcoming.length > 0 ? ` (${upcoming.length})` : ''}` : 'History'}
              </Text>
              {tab === t && <View style={styles.tabUnderline} />}
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={C.gold} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {displayed.length === 0 ? (
              <EmptyState tab={tab} />
            ) : (
              displayed.map((b, index) => (
                <Animated.View key={b.id} entering={FadeInDown.delay(index * 70).springify()}>
                  <BookingCard booking={b} />
                </Animated.View>
              ))
            )}
          </ScrollView>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: C.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  countPill: {
    backgroundColor: C.gold,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countText: { color: C.navy, fontSize: 12, fontWeight: '900' },

  contentArea: {
    flex: 1,
    backgroundColor: C.content,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 16,
  },
  tabBtn: {
    marginRight: 28,
    paddingTop: 14,
    paddingBottom: 12,
    alignItems: 'center',
  },
  tabText: { color: C.gray, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: C.navy, fontWeight: '800' },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.gold,
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 36, gap: 12 },

  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { color: C.muted, fontSize: 12, fontWeight: '700' },

  price: { color: C.navy, fontSize: 22, fontWeight: '900' },
  serviceName: { color: C.navy, fontSize: 17, fontWeight: '800', marginBottom: 3 },
  detailerName: { color: C.muted, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  metaText: { color: C.gray, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  addressText: { color: C.gray, fontSize: 12, fontWeight: '500' },

  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  ctaPrimaryText: { color: C.navy, fontSize: 13, fontWeight: '900' },

  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  ctaSecondaryText: { color: C.navy, fontSize: 13, fontWeight: '700' },
  ctaMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 10,
  },
  ctaMessageText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
    paddingVertical: 8,
  },
  cancelBtnText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 2,
    paddingVertical: 8,
  },
  reportBtnText: { color: C.red, fontSize: 11, fontWeight: '700' },

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
  emptyTitle: { color: C.navy, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 21 },

  reviewedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  reviewedText:  { color: C.green, fontSize: 13, fontWeight: '700' },
});
