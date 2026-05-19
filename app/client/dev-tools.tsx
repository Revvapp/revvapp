import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';

function makeTestDetailerDoc(uid: string) {
  return {
    uid,
    fullName: 'Marcus Rivera',
    businessName: 'Rivera Detail Co.',
    phone: '4155550101',
    city: 'San Francisco',
    state: 'CA',
    bio: 'Premium mobile detailing. 5 years experience. Certified paint correction specialist.',
    services: ['Full Detail', 'Paint Correction', 'Interior Detail', 'Ceramic Coating'],
    rates: { 'Full Detail': '$250', 'Interior Detail': '$120', 'Paint Correction': '$400' },
    workingDays: [1, 2, 3, 4, 5],
    workingHours: { from: '8:00 AM', to: '6:00 PM' },
    serviceArea: '20 miles',
    maxJobsPerDay: 3,
    profilePhotoUrl: '',
    portfolioUrls: [],
    idVerified: true,
    incomeGoal: { daily: 500, weekly: 2500 },
    rating: 4.8,
    reviewCount: 47,
    lat: 37.7749,
    lng: -122.4194,
    isFoundingPro: true,
    isActive: true,
    profileComplete: true,
  };
}
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
    id: 'client-dev-pending',
    label: 'Upcoming Booking',
    description: 'Booking confirmed, detailer hasn\'t arrived yet',
    icon: 'calendar-outline',
    color: '#856404',
    navigate: undefined,
  },
  {
    id: 'client-dev-active',
    label: 'Detailer En Route',
    description: 'Job accepted, detailer is on the way',
    icon: 'car-outline',
    color: COLORS.blue,
    navigate: undefined,
  },
  {
    id: 'client-dev-vir-ready',
    label: 'Sign VIR',
    description: 'Detailer submitted inspection — client needs to sign off',
    icon: 'create-outline',
    color: '#8E44AD',
    navigate: '/client/vir/[id]',
  },
  {
    id: 'client-dev-in-progress',
    label: 'Job In Progress',
    description: 'Detailer is actively working on the vehicle',
    icon: 'timer-outline',
    color: COLORS.green,
    navigate: undefined,
  },
  {
    id: 'client-dev-invoiced',
    label: 'Invoice — Dispute Window Open',
    description: 'Job complete with invoice. 24hr dispute window is open.',
    icon: 'document-text-outline',
    color: COLORS.gold,
    navigate: '/client/invoice/[id]',
  },
  {
    id: 'client-dev-paid',
    label: 'Invoice — Payment Released',
    description: 'Dispute window closed, payment released to detailer',
    icon: 'checkmark-circle-outline',
    color: COLORS.green,
    navigate: '/client/invoice/[id]',
  },
];

const BASE_BOOKING = {
  clientName: 'Test Client',
  detailerName: 'Test Detailer',
  businessName: 'Test Detail Co.',
  vehicleLabel: '2022 BMW M3 · White',
  vehicleId: 'client-dev-vehicle',
  service: 'Full Interior & Exterior Detail',
  price: 280,
  date: '2026-05-19',
  time: '10:00 AM',
  address: '123 Test St, San Francisco, CA',
  notes: 'Client dev test booking',
  createdAt: serverTimestamp(),
};

async function seedScenario(uid: string, scenario: Scenario): Promise<void> {
  const id = scenario.id;

  if (id === 'client-dev-pending') {
    await setDoc(doc(db, 'bookings', id), {
      ...BASE_BOOKING,
      clientId: uid,
      detailerId: uid,
      status: 'pending',
    });

  } else if (id === 'client-dev-active') {
    await setDoc(doc(db, 'bookings', id), {
      ...BASE_BOOKING,
      clientId: uid,
      detailerId: uid,
      status: 'active',
    });

  } else if (id === 'client-dev-vir-ready') {
    await setDoc(doc(db, 'bookings', id), {
      ...BASE_BOOKING,
      clientId: uid,
      detailerId: uid,
      status: 'active',
      virPanels: MOCK_VIR_PANELS,
      virSubmittedAt: serverTimestamp(),
    });

  } else if (id === 'client-dev-in-progress') {
    await setDoc(doc(db, 'bookings', id), {
      ...BASE_BOOKING,
      clientId: uid,
      detailerId: uid,
      status: 'in_progress',
      virPanels: MOCK_VIR_PANELS,
      virSignedAt: serverTimestamp(),
      timerStartMs: Date.now() - 45 * 60 * 1000,
      timerAccumulatedSeconds: 0,
      jobStartedAt: serverTimestamp(),
    });

  } else if (id === 'client-dev-invoiced') {
    await setDoc(doc(db, 'bookings', id), {
      ...BASE_BOOKING,
      clientId: uid,
      detailerId: uid,
      status: 'completed',
      virPanels: MOCK_VIR_PANELS,
      virSignedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
      afterPhotos: [],
    });
    await setDoc(doc(db, 'invoices', id), {
      bookingId: id,
      clientId: uid,
      detailerId: uid,
      clientName: BASE_BOOKING.clientName,
      detailerName: BASE_BOOKING.detailerName,
      businessName: BASE_BOOKING.businessName,
      vehicleLabel: BASE_BOOKING.vehicleLabel,
      service: BASE_BOOKING.service,
      date: BASE_BOOKING.date,
      price: 280,
      platformFee: 28,
      detailerPayout: 252,
      status: 'pending_release',
      afterPhotos: [],
      createdAt: serverTimestamp(),
      disputeWindowOpenUntil: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    });

  } else if (id === 'client-dev-paid') {
    await setDoc(doc(db, 'bookings', id), {
      ...BASE_BOOKING,
      clientId: uid,
      detailerId: uid,
      status: 'completed',
      virPanels: MOCK_VIR_PANELS,
      virSignedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
      afterPhotos: [],
    });
    await setDoc(doc(db, 'invoices', id), {
      bookingId: id,
      clientId: uid,
      detailerId: uid,
      clientName: BASE_BOOKING.clientName,
      detailerName: BASE_BOOKING.detailerName,
      businessName: BASE_BOOKING.businessName,
      vehicleLabel: BASE_BOOKING.vehicleLabel,
      service: BASE_BOOKING.service,
      date: BASE_BOOKING.date,
      price: 280,
      platformFee: 28,
      detailerPayout: 252,
      status: 'released',
      afterPhotos: [],
      createdAt: serverTimestamp(),
      disputeWindowOpenUntil: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });
  }
}

export default function ClientDevToolsScreen() {
  if (!__DEV__) {
    return <Redirect href="/client/dashboard" />;
  }
  return <ClientDevToolsContent />;
}

function ClientDevToolsContent() {
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
        Alert.alert('Seeded', `"${scenario.label}" booking created. Check your Bookings tab.`);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleSeedDetailer() {
    if (!user?.uid) return;
    setLoading('seed-detailer');
    try {
      await setDoc(doc(db, 'detailers', user.uid), { ...makeTestDetailerDoc(user.uid), createdAt: serverTimestamp() });
      Alert.alert('Detailer Seeded', 'Rivera Detail Co. is now live in Firestore. Open the Find tab to see them.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleClearDetailer() {
    if (!user?.uid) return;
    setLoading('clear-detailer');
    try {
      await deleteDoc(doc(db, 'detailers', user.uid));
      Alert.alert('Cleared', 'Test detailer removed from Firestore.');
    } catch (err) {
      Alert.alert('Error', String(err));
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
      Alert.alert('Cleared', 'All client dev data deleted.');
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
          <Text style={styles.headerTitle}>Client Dev Tools</Text>
          <Text style={styles.headerSub}>Test data seeds — dev builds only</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner}>
        <Text style={styles.sectionLabel}>SEED A SCENARIO</Text>
        <Text style={styles.sectionHint}>
          Seeds a booking using your UID as the client. Navigate to the Bookings tab to see it, or tap a scenario that goes directly to a screen.
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

        <Text style={styles.sectionLabel}>FIND DETAILERS TEST</Text>
        <Text style={styles.sectionHint}>
          Seeds a fake detailer with isActive + profileComplete so the Find tab shows results.
        </Text>

        <Pressable
          style={styles.card}
          onPress={handleSeedDetailer}
          disabled={!!loading}
        >
          <View style={[styles.iconWrap, { backgroundColor: COLORS.green + '22' }]}>
            <Ionicons name="person-add-outline" size={22} color={COLORS.green} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardLabel}>Seed Test Detailer</Text>
            <Text style={styles.cardDesc}>Rivera Detail Co. · SF · 4.8★ · Founding Pro</Text>
          </View>
          {loading === 'seed-detailer'
            ? <ActivityIndicator size="small" color={COLORS.gold} />
            : <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          }
        </Pressable>

        <Pressable
          style={[styles.clearBtn, { marginBottom: 16 }]}
          onPress={handleClearDetailer}
          disabled={!!loading}
        >
          {loading === 'clear-detailer'
            ? <ActivityIndicator size="small" color={COLORS.red} />
            : <Ionicons name="person-remove-outline" size={18} color={COLORS.red} />
          }
          <Text style={styles.clearText}>Remove Test Detailer</Text>
        </Pressable>

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
          <Text style={styles.infoHint}>Used as clientId on all seeded bookings.</Text>
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
