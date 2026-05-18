import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
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
    if (!id) return;
    setActioning(true);
    try {
      await updateDoc(doc(db, 'bookings', id), { status });
      if (status === 'declined') router.back();
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

  const statusColor = isPending ? '#856404' : isActive ? COLORS.blue : isVirSubmitted ? '#856404' : isVirSigned ? COLORS.green : isInProgress ? COLORS.green : isPaused ? '#856404' : COLORS.muted;
  const statusBg = isPending ? '#FFF3CD' : isActive ? '#E8F0FB' : isVirSubmitted ? '#FFF3CD' : isVirSigned ? '#D4EDDA' : isInProgress ? '#D4EDDA' : isPaused ? '#FFF3CD' : '#E8F4FD';
  const statusLabel = isPending ? 'Pending' : isActive ? 'Accepted' : isVirSubmitted ? 'Awaiting Signature' : isVirSigned ? 'Ready to Start' : isInProgress ? 'In Progress' : isPaused ? 'Paused' : isCompleted ? 'Completed' : toTitleCase(booking.status);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusPillText, { color: statusColor }]}>
            {statusLabel}
          </Text>
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
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  statusPillText: { fontSize: 12, fontWeight: '800' },
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
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: { color: COLORS.blue, fontSize: 20, fontWeight: '900' },
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
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  waitingText: { color: '#856404', fontSize: 13, fontWeight: '700', flex: 1 },
  btnDisabled: { opacity: 0.6 },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D4EDDA',
    borderRadius: 12,
    padding: 14,
  },
  completedBannerText: { color: '#155724', fontSize: 14, fontWeight: '700' },
  errorText: { color: '#D93025', fontSize: 13, fontWeight: '600', marginBottom: 12 },
});
