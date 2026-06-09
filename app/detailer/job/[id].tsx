import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { formatJobDate } from '@/lib/dateKeys';
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
};

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as 'time-outline'} size={18} color={COLORS.gold} />
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, 'bookings', id),
      (snap) => {
        if (!snap.exists()) {
          setError('Booking not found.');
          setLoading(false);
          return;
        }
        const x = snap.data();
        setBooking({
          id: snap.id,
          clientId: String(x.clientId ?? ''),
          detailerId: String(x.detailerId ?? ''),
          service: String(x.service ?? ''),
          price: Number(x.price ?? 0),
          status: String(x.status ?? '').toLowerCase(),
          date: String(x.date ?? ''),
          time: String(x.time ?? ''),
          vehicleId: String(x.vehicleId ?? ''),
          clientName: x.clientName ? String(x.clientName) : undefined,
          vehicleLabel: x.vehicleLabel ? String(x.vehicleLabel) : undefined,
          address: x.address ? String(x.address) : undefined,
          notes: x.notes ? String(x.notes) : undefined,
          createdAt: x.createdAt ?? null,
        });
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  async function runAction(status: string) {
    if (!id || !booking) return;
    setActioning(true);
    try {
      if (status === 'active') {
        // Don't let a detailer accept two jobs in the same date + time slot.
        const occupying = ['active', 'vir_submitted', 'vir_signed', 'in_progress', 'paused'];
        const mine = await getDocs(
          query(collection(db, 'bookings'), where('detailerId', '==', booking.detailerId))
        );
        const conflict = mine.docs.some((d) => {
          if (d.id === id) return false;
          const x = d.data();
          return (
            String(x.date ?? '') === booking.date &&
            String(x.time ?? '') === booking.time &&
            occupying.includes(String(x.status ?? '').toLowerCase())
          );
        });
        if (conflict) {
          setActioning(false);
          Alert.alert(
            'Time slot taken',
            'You already have an accepted job at this date and time. Decline or finish the other booking first.'
          );
          return;
        }
      }

      await updateDoc(doc(db, 'bookings', id), { status });
      // The client is notified of accept/decline server-side (onBookingStatusChanged).
      if (status === 'declined') {
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setActioning(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
      </SafeAreaView>
    );
  }

  const isPending = booking.status === 'pending';
  const isActive = booking.status === 'active';
  const isVirSubmitted = booking.status === 'vir_submitted';
  const isVirSigned = booking.status === 'vir_signed';
  const isInProgress = booking.status === 'in_progress';
  const isPaused = booking.status === 'paused';
  const isCompleted = booking.status === 'completed';

  const statusColor = isPending ? COLORS.gold : isActive ? COLORS.blue : isVirSubmitted ? '#E67E22' : isVirSigned ? COLORS.green : isInProgress ? COLORS.green : isPaused ? COLORS.gold : COLORS.muted;
  const statusLabel = isPending ? 'Pending' : isActive ? 'Accepted' : isVirSubmitted ? 'Awaiting Signature' : isVirSigned ? 'Ready to Start' : isInProgress ? 'In Progress' : isPaused ? 'Paused' : isCompleted ? 'Completed' : toTitleCase(booking.status);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={styles.statusDotWrap}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.statusDotLabel}>{statusLabel}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        <View style={styles.clientCard}>
          <View style={styles.clientAvatar}>
            <Text style={styles.clientAvatarText}>
              {(booking.clientName ?? 'C')[0].toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.clientLabel}>Client</Text>
            <Text style={styles.clientName}>
              {booking.clientName ? toTitleCase(booking.clientName) : 'Unknown Client'}
            </Text>
          </View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.cardSectionTitle}>Job Details</Text>
          <DetailRow icon="construct-outline" label="Service" value={toTitleCase(booking.service)} />
          <DetailRow icon="calendar-outline" label="Date" value={formatJobDate(booking.date)} />
          <DetailRow icon="time-outline" label="Time" value={booking.time} />
          {booking.vehicleLabel && (
            <DetailRow icon="car-sport-outline" label="Vehicle" value={booking.vehicleLabel} />
          )}
          {booking.address && (
            <DetailRow icon="location-outline" label="Address" value={booking.address} />
          )}
          {booking.notes && (
            <DetailRow icon="chatbubble-outline" label="Notes" value={booking.notes} />
          )}
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Job Payout</Text>
          <Text style={styles.priceValue}>${booking.price}</Text>
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {isPending && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.btnDecline, actioning && styles.btnDisabled]}
              onPress={() => runAction('declined')}
              disabled={actioning}
            >
              <Text style={styles.btnDeclineText}>Decline Job</Text>
            </Pressable>
            <Pressable
              style={[styles.btnAccept, actioning && styles.btnDisabled]}
              onPress={() => runAction('active')}
              disabled={actioning}
            >
              {actioning
                ? <ActivityIndicator size="small" color={COLORS.blue} />
                : <Text style={styles.btnAcceptText}>Accept Job</Text>
              }
            </Pressable>
          </View>
        )}

        {isActive && (
          <Pressable
            style={styles.btnInspect}
            onPress={() => router.push({ pathname: '/detailer/vir/[id]', params: { id: id! } })}
          >
            <Ionicons name="camera-outline" size={18} color={COLORS.blue} />
            <Text style={styles.btnInspectText}>Start Vehicle Inspection</Text>
          </Pressable>
        )}

        {isVirSubmitted && (
          <View style={styles.waitingBanner}>
            <ActivityIndicator size="small" color={COLORS.gold} />
            <Text style={styles.waitingText}>Waiting for client to sign the inspection report…</Text>
          </View>
        )}

        {isVirSigned && (
          <Pressable
            style={styles.btnInspect}
            onPress={() => router.push({ pathname: '/detailer/timer/[id]', params: { id: id! } })}
          >
            <Ionicons name="timer-outline" size={18} color={COLORS.blue} />
            <Text style={styles.btnInspectText}>Start Job Timer</Text>
          </Pressable>
        )}

        {(isInProgress || isPaused) && (
          <Pressable
            style={styles.btnInspect}
            onPress={() => router.push({ pathname: '/detailer/timer/[id]', params: { id: id! } })}
          >
            <Ionicons name="timer-outline" size={18} color={COLORS.blue} />
            <Text style={styles.btnInspectText}>{isPaused ? 'Resume Timer' : 'Open Timer'}</Text>
          </Pressable>
        )}

        {isCompleted && (
          <>
            <View style={styles.completedBanner}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
              <Text style={styles.completedBannerText}>This job has been completed.</Text>
            </View>
            <Pressable
              style={styles.btnInspect}
              onPress={() => router.push({ pathname: '/detailer/invoice/[id]', params: { id: id! } })}
            >
              <Ionicons name="document-text-outline" size={18} color={COLORS.blue} />
              <Text style={styles.btnInspectText}>View Invoice</Text>
            </Pressable>
          </>
        )}

        {!isPending && (
          <Pressable
            style={styles.btnMessage}
            onPress={() => router.push({ pathname: '/detailer/conversation/[id]', params: { id: id! } })}
          >
            <Ionicons name="chatbubble-outline" size={16} color={COLORS.muted} />
            <Text style={styles.btnMessageText}>Message Client</Text>
          </Pressable>
        )}

        {!isCompleted && (
          <Pressable
            style={styles.reportBtn}
            onPress={() =>
              Alert.alert(
                'Report Off-Platform Request',
                'Did your client ask to pay outside of REVV? This protects your Revv Care coverage and keeps your account in good standing.',
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
            <Ionicons name="flag-outline" size={13} color={COLORS.red} />
            <Text style={styles.reportBtnText}>Report Off-Platform Request</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: COLORS.white, fontSize: 20, fontWeight: '800', flex: 1 },
  statusDotWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusDotLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  content: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  contentInner: { padding: 20, paddingBottom: 40 },
  clientCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: { color: COLORS.gold, fontSize: 20, fontWeight: '900' },
  clientLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  clientName: { color: COLORS.blue, fontSize: 18, fontWeight: '800' },
  detailCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  cardSectionTitle: { color: COLORS.blue, fontSize: 14, fontWeight: '900', marginBottom: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailText: { flex: 1 },
  detailLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  detailValue: { color: COLORS.blue, fontSize: 14, fontWeight: '700' },
  priceCard: {
    backgroundColor: COLORS.blue,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  priceLabel: { color: COLORS.gray, fontSize: 14, fontWeight: '700' },
  priceValue: { color: COLORS.gold, fontSize: 32, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  btnDecline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#C0CBD6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDeclineText: { color: COLORS.muted, fontSize: 15, fontWeight: '700' },
  btnAccept: {
    flex: 2,
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnAcceptText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },
  btnComplete: {
    backgroundColor: COLORS.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  btnCompleteText: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  btnInspect: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  btnInspectText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A2B3C',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  waitingText: { color: COLORS.gold, fontSize: 13, fontWeight: '700', flex: 1 },
  btnDisabled: { opacity: 0.6 },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A2B3C',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  completedBannerText: { color: COLORS.green, fontSize: 14, fontWeight: '700' },
  errorText: { color: '#D93025', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  btnMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#C0CBD6',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  btnMessageText: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
    paddingVertical: 10,
  },
  reportBtnText: { color: COLORS.red, fontSize: 12, fontWeight: '700' },
});
