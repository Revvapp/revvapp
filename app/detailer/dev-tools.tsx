import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';
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
import { useAuth } from '@/hooks/useAuth';

const COLORS = {
  bg: '#0D1B2A',
  card: '#FFFFFF',
  blue: '#1A3A5C',
  gold: '#C9A227',
  gray: '#B7C1CC',
  muted: '#6B7885',
  border: '#E2E8F0',
  white: '#FFFFFF',
  green: '#27AE60',
  red: '#C0392B',
  content: '#F5F5F5',
};

const MOCK_VIR_PANELS = {
  front:         { photoUrl: '', notes: '' },
  rear:          { photoUrl: '', notes: 'Small scuff on bumper' },
  driverSide:    { photoUrl: '', notes: '' },
  passengerSide: { photoUrl: '', notes: '' },
  roof:          { photoUrl: '', notes: '' },
  interior:      { photoUrl: '', notes: 'Minor stain on back seat' },
};

type Scenario = {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  navigate?: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: 'dev-pending',
    label: 'Pending Job',
    description: 'New job request waiting for detailer to accept',
    icon: 'time-outline',
    color: '#856404',
    navigate: undefined,
  },
  {
    id: 'dev-active',
    label: 'Accepted → Start VIR',
    description: 'Job accepted, detailer needs to start vehicle inspection',
    icon: 'camera-outline',
    color: COLORS.blue,
    navigate: undefined,
  },
  {
    id: 'dev-vir-signed',
    label: 'VIR Signed → Timer Ready',
    description: 'Client signed inspection — ready to start the job timer',
    icon: 'timer-outline',
    color: COLORS.green,
    navigate: '/detailer/timer/[id]',
  },
  {
    id: 'dev-in-progress',
    label: 'Timer Running',
    description: 'Job in progress with timer ticking',
    icon: 'play-circle-outline',
    color: '#2ECC8F',
    navigate: '/detailer/timer/[id]',
  },
  {
    id: 'dev-paused',
    label: 'Timer Paused',
    description: 'Job paused mid-way through',
    icon: 'pause-circle-outline',
    color: COLORS.gold,
    navigate: '/detailer/timer/[id]',
  },
  {
    id: 'dev-completed-no-invoice',
    label: 'Completed → Before/After',
    description: 'Job done but no invoice yet — tests the photo + invoice creation screen',
    icon: 'images-outline',
    color: '#8E44AD',
    navigate: '/detailer/before-after/[id]',
  },
  {
    id: 'dev-completed-invoiced',
    label: 'Completed + Invoice',
    description: 'Full completed job with invoice already generated',
    icon: 'document-text-outline',
    color: COLORS.green,
    navigate: '/detailer/invoice/[id]',
  },
];

async function seedScenario(uid: string, scenario: Scenario): Promise<void> {
  const bookingId = scenario.id;
  const baseBooking = {
    clientId: uid,
    detailerId: uid,
    clientName: 'Test Client',
    detailerName: 'Test Detailer',
    businessName: 'Test Detail Co.',
    vehicleLabel: '2022 BMW M3 · White',
    vehicleId: 'dev-vehicle',
    service: 'Full Interior & Exterior Detail',
    price: 280,
    date: '2026-05-17',
    time: '10:00 AM',
    address: '123 Test St, San Francisco, CA',
    notes: 'Dev test booking',
    createdAt: serverTimestamp(),
  };

  if (bookingId === 'dev-pending') {
    await setDoc(doc(db, 'bookings', bookingId), { ...baseBooking, status: 'pending' });
  } else if (bookingId === 'dev-active') {
    await setDoc(doc(db, 'bookings', bookingId), { ...baseBooking, status: 'active' });
  } else if (bookingId === 'dev-vir-signed') {
    await setDoc(doc(db, 'bookings', bookingId), {
      ...baseBooking,
      status: 'vir_signed',
      virPanels: MOCK_VIR_PANELS,
      virSubmittedAt: serverTimestamp(),
      virSignedAt: serverTimestamp(),
    });
  } else if (bookingId === 'dev-in-progress') {
    await setDoc(doc(db, 'bookings', bookingId), {
      ...baseBooking,
      status: 'in_progress',
      virPanels: MOCK_VIR_PANELS,
      virSignedAt: serverTimestamp(),
      timerStartMs: Date.now() - 45 * 60 * 1000, // 45 mins ago
      timerAccumulatedSeconds: 0,
      jobStartedAt: serverTimestamp(),
      serviceChecklist: [
        { name: 'Pre-wash & decontamination', estimatedMinutes: 20, completed: true, completedMinutes: 12 },
        { name: 'Interior vacuum & blow out', estimatedMinutes: 20, completed: true, completedMinutes: 31 },
        { name: 'Steam clean & scrub', estimatedMinutes: 30, completed: false },
        { name: 'Wipe down & dress', estimatedMinutes: 20, completed: false },
        { name: 'Final inspection', estimatedMinutes: 10, completed: false },
      ],
    });
  } else if (bookingId === 'dev-paused') {
    await setDoc(doc(db, 'bookings', bookingId), {
      ...baseBooking,
      status: 'paused',
      virPanels: MOCK_VIR_PANELS,
      virSignedAt: serverTimestamp(),
      timerStartMs: null,
      timerAccumulatedSeconds: 38 * 60, // 38 mins elapsed
      pauseReason: 'Product dry time',
      jobStartedAt: serverTimestamp(),
      serviceChecklist: [
        { name: 'Pre-wash & decontamination', estimatedMinutes: 20, completed: true, completedMinutes: 18 },
        { name: 'Interior vacuum & blow out', estimatedMinutes: 20, completed: false },
        { name: 'Steam clean & scrub', estimatedMinutes: 30, completed: false },
        { name: 'Wipe down & dress', estimatedMinutes: 20, completed: false },
        { name: 'Final inspection', estimatedMinutes: 10, completed: false },
      ],
    });
  } else if (bookingId === 'dev-completed-no-invoice') {
    await setDoc(doc(db, 'bookings', bookingId), {
      ...baseBooking,
      status: 'completed',
      virPanels: MOCK_VIR_PANELS,
      virSignedAt: serverTimestamp(),
      timerStartMs: null,
      timerAccumulatedSeconds: 2 * 3600 + 14 * 60, // 2h 14m
      completedAt: serverTimestamp(),
    });
    // Delete invoice if it exists so we can test the creation flow
    await deleteDoc(doc(db, 'invoices', bookingId)).catch(() => {});
  } else if (bookingId === 'dev-completed-invoiced') {
    await setDoc(doc(db, 'bookings', bookingId), {
      ...baseBooking,
      status: 'completed',
      virPanels: MOCK_VIR_PANELS,
      virSignedAt: serverTimestamp(),
      timerStartMs: null,
      timerAccumulatedSeconds: 2 * 3600 + 14 * 60,
      completedAt: serverTimestamp(),
      afterPhotos: [],
    });
    await setDoc(doc(db, 'invoices', bookingId), {
      bookingId,
      clientId: uid,
      detailerId: uid,
      clientName: 'Test Client',
      detailerName: 'Test Detailer',
      businessName: 'Test Detail Co.',
      vehicleLabel: '2022 BMW M3 · White',
      service: 'Full Interior & Exterior Detail',
      date: '2026-05-17',
      price: 280,
      platformFee: 28,
      detailerPayout: 252,
      status: 'pending_release',
      afterPhotos: [],
      createdAt: serverTimestamp(),
    });
  }
}

export default function DevToolsScreen() {
  if (!__DEV__) {
    return <Redirect href="/detailer/dashboard" />;
  }
  return <DevToolsContent />;
}

function DevToolsContent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSeed(scenario: Scenario) {
    if (!user?.uid) return;
    setLoading(scenario.id);
    try {
      await seedScenario(user.uid, scenario);
      if (scenario.navigate) {
        router.push({ pathname: scenario.navigate as any, params: { id: scenario.id } });
      } else {
        Alert.alert('Seeded', `"${scenario.label}" booking created. Find it in your Jobs tab.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', msg);
    } finally {
      setLoading(null);
    }
  }

  async function handleClear() {
    setLoading('clear');
    try {
      const ids = SCENARIOS.map((s) => s.id);
      await Promise.all([
        ...ids.map((id) => deleteDoc(doc(db, 'bookings', id)).catch(() => {})),
        ...ids.map((id) => deleteDoc(doc(db, 'invoices', id)).catch(() => {})),
      ]);
      Alert.alert('Cleared', 'All dev test data deleted.');
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Dev Tools</Text>
          <Text style={styles.headerSub}>Test data seeds — dev builds only</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner}>
        <Text style={styles.sectionLabel}>SEED A SCENARIO</Text>
        <Text style={styles.sectionHint}>
          Seeds data into Firestore using your UID, then navigates directly to the relevant screen.
        </Text>

        {SCENARIOS.map((scenario) => {
          const isLoading = loading === scenario.id;
          return (
            <Pressable
              key={scenario.id}
              style={styles.card}
              onPress={() => handleSeed(scenario)}
              disabled={!!loading}
            >
              <View style={[styles.iconWrap, { backgroundColor: scenario.color + '22' }]}>
                <Ionicons name={scenario.icon as any} size={22} color={scenario.color} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardLabel}>{scenario.label}</Text>
                <Text style={styles.cardDesc}>{scenario.description}</Text>
                {scenario.navigate && (
                  <Text style={styles.cardNav}>→ navigates to screen</Text>
                )}
              </View>
              {isLoading
                ? <ActivityIndicator size="small" color={COLORS.gold} />
                : <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
              }
            </Pressable>
          );
        })}

        <View style={styles.divider} />

        <Pressable
          style={styles.clearBtn}
          onPress={handleClear}
          disabled={!!loading}
        >
          {loading === 'clear'
            ? <ActivityIndicator size="small" color={COLORS.red} />
            : <Ionicons name="trash-outline" size={18} color={COLORS.red} />
          }
          <Text style={styles.clearText}>Clear All Dev Data</Text>
        </Pressable>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Your UID</Text>
          <Text style={styles.infoValue} selectable>{user?.uid ?? 'Not logged in'}</Text>
          <Text style={styles.infoHint}>Bookings use this UID as both detailerId and clientId so they show on both sides.</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingBottom: 16,
    gap: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  headerSub: { color: COLORS.muted, fontSize: 12, fontWeight: '500', marginTop: 1 },

  body: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bodyInner: { padding: 20 },

  sectionLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  sectionHint: { color: COLORS.muted, fontSize: 13, lineHeight: 18, marginBottom: 16 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardLabel: { color: COLORS.blue, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  cardDesc: { color: COLORS.muted, fontSize: 12, lineHeight: 17 },
  cardNav: { color: COLORS.gold, fontSize: 11, fontWeight: '700', marginTop: 3 },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },

  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.red,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  clearText: { color: COLORS.red, fontSize: 14, fontWeight: '700' },

  infoCard: {
    backgroundColor: '#162232',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  infoTitle: { color: COLORS.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  infoValue: { color: COLORS.gold, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  infoHint: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
});
