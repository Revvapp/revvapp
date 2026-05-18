import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
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
  red: '#D93025',
};

function StepBar({ step }: { step: number }) {
  return (
    <View style={styles.stepBar}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.stepDot, i <= step && styles.stepDotActive]} />
      ))}
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={COLORS.gold} />
      <View style={styles.detailInfo}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

type ConfirmParams = {
  detailerId: string;
  detailerName: string;
  service: string;
  price: string;
  vehicleId: string;
  vehicleLabel: string;
  date: string;
  dateLabel: string;
  time: string;
};

export default function BookConfirmScreen() {
  const params = useLocalSearchParams<ConfirmParams>();
  const { user } = useAuth();

  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const priceNum = parseFloat((params.price ?? '').replace(/[^0-9.]/g, '')) || 0;

  async function handleConfirm() {
    if (!address.trim()) { setError('Please enter a service address.'); return; }
    if (!user?.uid) return;
    setError('');
    setSubmitting(true);

    try {
      const clientSnap = await getDoc(doc(db, 'clients', user.uid));
      const clientName = clientSnap.exists()
        ? String(clientSnap.data().fullName ?? user.email ?? '')
        : (user.email ?? '');

      await addDoc(collection(db, 'bookings'), {
        clientId: user.uid,
        detailerId: params.detailerId,
        detailerName: params.detailerName ?? '',
        service: params.service,
        price: priceNum,
        status: 'pending',
        date: params.date,
        time: params.time,
        vehicleId: params.vehicleId,
        vehicleLabel: params.vehicleLabel,
        address: address.trim(),
        notes: notes.trim() || null,
        clientName,
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={COLORS.green} />
          </View>
          <Text style={styles.successTitle}>Booking Sent!</Text>
          <Text style={styles.successBody}>
            Your request has been sent to {toTitleCase(params.detailerName ?? '')}. You&apos;ll be notified once they accept.
          </Text>
          <Pressable
            style={styles.doneBtn}
            onPress={() => router.replace('/client/(tabs)/bookings' as any)}
          >
            <Text style={styles.doneBtnText}>View My Bookings</Text>
          </Pressable>
          <Pressable
            style={styles.homeLink}
            onPress={() => router.replace('/client/(tabs)/dashboard' as any)}
          >
            <Text style={styles.homeLinkText}>Go to Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Book a Detail</Text>
            <StepBar step={4} />
          </View>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Booking Summary</Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.detailerName}>{toTitleCase(params.detailerName ?? '')}</Text>
            </View>
            <View style={styles.divider} />
            <DetailRow icon="construct-outline" label="Service" value={toTitleCase(params.service ?? '')} />
            <DetailRow icon="car-sport-outline" label="Vehicle" value={params.vehicleLabel ?? ''} />
            <DetailRow icon="calendar-outline" label="Date" value={params.dateLabel ?? params.date ?? ''} />
            <DetailRow icon="time-outline" label="Time" value={params.time ?? ''} />
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Total Due</Text>
            <Text style={styles.priceValue}>${priceNum % 1 === 0 ? priceNum.toFixed(0) : priceNum.toFixed(2)}</Text>
            <Text style={styles.priceNote}>Charged only after your detailer accepts</Text>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Service Location</Text>
          <View style={styles.inputCard}>
            <Ionicons name="location-outline" size={18} color={COLORS.gold} style={{ marginTop: 2 }} />
            <TextInput
              style={styles.addressInput}
              placeholder="Enter your address"
              placeholderTextColor={COLORS.gray}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
            />
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Notes for Detailer</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Gate code, parking instructions, special requests… (optional)"
            placeholderTextColor={COLORS.gray}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {error ? (
            <View style={styles.errorWrap}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.confirmBtn, submitting && { opacity: 0.7 }]}
            onPress={handleConfirm}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color={COLORS.blue} />
              : <Text style={styles.confirmBtnText}>Confirm Booking</Text>
            }
          </Pressable>
          <Text style={styles.disclaimer}>
            Your detailer will receive this request and must accept before payment is collected.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 8 },
  headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
  stepBar: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: '#2A3E52' },
  stepDotActive: { backgroundColor: COLORS.gold },
  body: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bodyContent: { padding: 16, paddingBottom: 30 },
  sectionLabel: { color: COLORS.blue, fontSize: 14, fontWeight: '900', marginBottom: 10 },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  summaryHeader: {
    backgroundColor: COLORS.blue,
    padding: 14,
  },
  detailerName: { color: COLORS.white, fontSize: 16, fontWeight: '900' },
  divider: { height: 1, backgroundColor: COLORS.border },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailInfo: { flex: 1 },
  detailLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  detailValue: { color: COLORS.blue, fontSize: 14, fontWeight: '700' },
  priceCard: {
    backgroundColor: COLORS.blue,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  priceLabel: { color: COLORS.gray, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  priceValue: { color: COLORS.gold, fontSize: 36, fontWeight: '900' },
  priceNote: { color: COLORS.gray, fontSize: 11, fontWeight: '600', marginTop: 4 },
  inputCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addressInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.blue,
    fontWeight: '600',
    lineHeight: 20,
  },
  notesInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.blue,
    fontWeight: '600',
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#FDECEA',
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: COLORS.red, fontSize: 13, fontWeight: '600', flex: 1 },
  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 20,
    paddingBottom: 34,
    gap: 10,
  },
  confirmBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },
  disclaimer: { color: COLORS.muted, fontSize: 11, textAlign: 'center', lineHeight: 15 },
  successWrap: { alignItems: 'center', paddingHorizontal: 32, gap: 14, backgroundColor: COLORS.content, flex: 1, justifyContent: 'center' },
  successIcon: { marginBottom: 6 },
  successTitle: { color: COLORS.blue, fontSize: 28, fontWeight: '900' },
  successBody: { color: COLORS.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  doneBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 10,
  },
  doneBtnText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },
  homeLink: { paddingVertical: 8 },
  homeLinkText: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
});
