import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
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
  teal: '#2ECC8F',
};

type InvoiceData = {
  clientName: string;
  detailerName: string;
  businessName?: string;
  vehicleLabel: string;
  service: string;
  date: string;
  price: number;
  platformFee: number;
  detailerPayout: number;
  status: string;
  afterPhotos: string[];
  createdAt: { seconds: number } | null;
};

function fmt(n: number): string {
  return n.toFixed(2);
}

function releaseLabel(createdAtSeconds: number | null): string {
  if (!createdAtSeconds) return 'within 24 hours';
  const releaseMs = createdAtSeconds * 1000 + 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diffMs = releaseMs - now;
  if (diffMs <= 0) return 'Released';
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `in ~${h}h ${m}m`;
}

export default function DetailerInvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'invoices', id), (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const d = snap.data();
      setInvoice({
        clientName: String(d.clientName ?? ''),
        detailerName: String(d.detailerName ?? ''),
        businessName: d.businessName ? String(d.businessName) : undefined,
        vehicleLabel: String(d.vehicleLabel ?? ''),
        service: String(d.service ?? ''),
        date: String(d.date ?? ''),
        price: Number(d.price ?? 0),
        platformFee: Number(d.platformFee ?? 0),
        detailerPayout: Number(d.detailerPayout ?? 0),
        status: String(d.status ?? ''),
        afterPhotos: Array.isArray(d.afterPhotos) ? d.afterPhotos : [],
        createdAt: d.createdAt ?? null,
      });
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Invoice not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const invoiceNumber = `REV-${invoice.date.replace(/-/g, '')}-${(id ?? '').slice(-4).toUpperCase()}`;
  const isReleased = invoice.status === 'released';
  const createdSeconds = invoice.createdAt?.seconds ?? null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Invoice</Text>
        <View style={[styles.statusPill, isReleased ? styles.pillReleased : styles.pillPending]}>
          <Text style={[styles.statusPillText, isReleased ? styles.pillReleasedText : styles.pillPendingText]}>
            {isReleased ? 'Paid Out' : 'Pending'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner} showsVerticalScrollIndicator={false}>
        {/* Invoice header */}
        <View style={styles.invoiceHeader}>
          <Text style={styles.brandLine}>
            <Text style={styles.brandRe}>RE</Text>
            <Text style={styles.brandVV}>VV</Text>
            <Text style={styles.brandLabel}> Invoice</Text>
          </Text>
          <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
          <Text style={styles.invoiceDate}>{formatJobDate(invoice.date)}</Text>
        </View>

        {/* Client info */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Billed to</Text>
          <Text style={styles.cardValue}>{toTitleCase(invoice.clientName)}</Text>
          <Text style={styles.cardSub}>{invoice.vehicleLabel}</Text>
        </View>

        {/* Service details */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Service</Text>
          <Text style={styles.cardValue}>{toTitleCase(invoice.service)}</Text>
        </View>

        {/* Price breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Payment Breakdown</Text>
          <View style={styles.lineRow}>
            <Text style={styles.lineKey}>Service charge</Text>
            <Text style={styles.lineVal}>${fmt(invoice.price)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.lineRow}>
            <Text style={styles.lineFeeKey}>REVV platform fee (10%)</Text>
            <Text style={styles.lineFeeVal}>−${fmt(invoice.platformFee)}</Text>
          </View>
          <View style={[styles.divider, { marginBottom: 12 }]} />
          <View style={styles.lineRow}>
            <Text style={styles.linePayoutKey}>Your payout</Text>
            <Text style={styles.linePayoutVal}>${fmt(invoice.detailerPayout)}</Text>
          </View>
        </View>

        {/* Payment release info */}
        <View style={styles.releaseCard}>
          <Ionicons name="time-outline" size={20} color={COLORS.gold} />
          <View style={styles.releaseText}>
            <Text style={styles.releaseTitle}>
              {isReleased ? 'Payment Released' : `Payment releases ${releaseLabel(createdSeconds)}`}
            </Text>
            <Text style={styles.releaseSub}>
              {isReleased
                ? 'Funds have been sent to your account.'
                : 'Auto-releases after the 24-hour dispute window closes.'}
            </Text>
          </View>
        </View>

        {/* After photos */}
        {invoice.afterPhotos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>After Photos</Text>
            <View style={styles.photoGrid}>
              {invoice.afterPhotos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.afterPhoto} contentFit="cover" />
              ))}
            </View>
          </View>
        )}

        <Pressable
          style={styles.btnDone}
          onPress={() => router.push('/detailer/(tabs)/jobs')}
        >
          <Text style={styles.btnDoneText}>Back to Jobs</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: COLORS.gray, fontSize: 15 },

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
  pillPending: { backgroundColor: '#FFF3CD' },
  pillReleased: { backgroundColor: '#D4EDDA' },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  pillPendingText: { color: '#856404' },
  pillReleasedText: { color: '#155724' },

  body: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bodyInner: { padding: 20, paddingBottom: 40 },

  invoiceHeader: {
    backgroundColor: COLORS.blue,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  brandLine: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  brandRe: { color: COLORS.white },
  brandVV: { color: COLORS.gold },
  brandLabel: { color: COLORS.gray, fontWeight: '600', letterSpacing: 0.5 },
  invoiceNumber: { color: COLORS.gold, fontSize: 14, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  invoiceDate: { color: COLORS.gray, fontSize: 13, fontWeight: '500' },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  cardLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardValue: { color: COLORS.blue, fontSize: 17, fontWeight: '800' },
  cardSub: { color: COLORS.muted, fontSize: 13, fontWeight: '500' },

  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineKey: { color: COLORS.blue, fontSize: 14, fontWeight: '600' },
  lineVal: { color: COLORS.blue, fontSize: 14, fontWeight: '700' },
  lineFeeKey: { color: COLORS.muted, fontSize: 13, fontWeight: '500' },
  lineFeeVal: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  linePayoutKey: { color: COLORS.blue, fontSize: 16, fontWeight: '800' },
  linePayoutVal: { color: COLORS.green, fontSize: 22, fontWeight: '900' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },

  releaseCard: {
    backgroundColor: '#1A2B3C',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  releaseText: { flex: 1 },
  releaseTitle: { color: COLORS.gold, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  releaseSub: { color: COLORS.gray, fontSize: 13, lineHeight: 18 },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  afterPhoto: {
    width: '47%',
    aspectRatio: 4 / 3,
    borderRadius: 10,
  },

  btnDone: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDoneText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },
});
