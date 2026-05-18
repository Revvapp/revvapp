import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
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
  red: '#C0392B',
};

type InvoiceData = {
  clientName: string;
  detailerName: string;
  businessName?: string;
  vehicleLabel: string;
  service: string;
  date: string;
  price: number;
  status: string;
  afterPhotos: string[];
  createdAt: { seconds: number } | null;
};

function disputeWindowOpen(createdSeconds: number | null): boolean {
  if (!createdSeconds) return true;
  return Date.now() < createdSeconds * 1000 + 24 * 60 * 60 * 1000;
}

function windowLabel(createdSeconds: number | null): string {
  if (!createdSeconds) return '24 hours';
  const releaseMs = createdSeconds * 1000 + 24 * 60 * 60 * 1000;
  const diffMs = releaseMs - Date.now();
  if (diffMs <= 0) return 'Closed';
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${h}h ${m}m remaining`;
}

export default function ClientInvoiceScreen() {
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
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Invoice not found.</Text>
          <Text style={styles.errorSub}>It may not be ready yet — check back shortly.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const invoiceNumber = `REV-${invoice.date.replace(/-/g, '')}-${(id ?? '').slice(-4).toUpperCase()}`;
  const createdSeconds = invoice.createdAt?.seconds ?? null;
  const disputeOpen = disputeWindowOpen(createdSeconds);
  const detailerDisplay = invoice.businessName ? toTitleCase(invoice.businessName) : toTitleCase(invoice.detailerName);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Receipt</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>Completed</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner} showsVerticalScrollIndicator={false}>
        {/* Brand + Invoice number */}
        <View style={styles.invoiceHeader}>
          <Text style={styles.brandLine}>
            <Text style={styles.brandRe}>RE</Text>
            <Text style={styles.brandVV}>VV</Text>
          </Text>
          <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
          <Text style={styles.invoiceDate}>{formatJobDate(invoice.date)}</Text>
        </View>

        {/* Amount */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount charged</Text>
          <Text style={styles.amountValue}>
            ${invoice.price % 1 === 0 ? invoice.price.toFixed(0) : invoice.price.toFixed(2)}
          </Text>
        </View>

        {/* Service details */}
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <Ionicons name="construct-outline" size={16} color={COLORS.gold} />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Service</Text>
              <Text style={styles.detailValue}>{toTitleCase(invoice.service)}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={16} color={COLORS.gold} />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Detailer</Text>
              <Text style={styles.detailValue}>{detailerDisplay}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="car-sport-outline" size={16} color={COLORS.gold} />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Vehicle</Text>
              <Text style={styles.detailValue}>{invoice.vehicleLabel}</Text>
            </View>
          </View>
          <View style={[styles.detailRow, { marginBottom: 0 }]}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.gold} />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatJobDate(invoice.date)}</Text>
            </View>
          </View>
        </View>

        {/* After photos */}
        {invoice.afterPhotos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Finished Work</Text>
            <View style={styles.photoGrid}>
              {invoice.afterPhotos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.afterPhoto} contentFit="cover" />
              ))}
            </View>
          </View>
        )}

        {/* Dispute window */}
        <View style={[styles.disputeCard, !disputeOpen && styles.disputeCardClosed]}>
          <Ionicons
            name={disputeOpen ? 'shield-checkmark-outline' : 'lock-closed-outline'}
            size={20}
            color={disputeOpen ? COLORS.gold : COLORS.muted}
          />
          <View style={styles.disputeText}>
            <Text style={[styles.disputeTitle, !disputeOpen && styles.disputeTitleClosed]}>
              {disputeOpen ? 'Dispute window open' : 'Dispute window closed'}
            </Text>
            <Text style={styles.disputeSub}>
              {disputeOpen
                ? `${windowLabel(createdSeconds)} — raise a dispute if anything looks wrong.`
                : 'Payment has been released to your detailer.'}
            </Text>
          </View>
        </View>

        {disputeOpen && (
          <Pressable
            style={styles.btnDispute}
            onPress={() =>
              Alert.alert(
                'Raise a Dispute',
                'Dispute resolution is coming soon. For urgent issues, please contact support.',
                [{ text: 'OK' }]
              )
            }
          >
            <Ionicons name="flag-outline" size={16} color={COLORS.red} />
            <Text style={styles.btnDisputeText}>Raise a Dispute</Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 30 },
  errorText: { color: COLORS.gray, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  errorSub: { color: COLORS.muted, fontSize: 13, textAlign: 'center' },

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
  statusPill: { backgroundColor: '#D4EDDA', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  statusPillText: { color: '#155724', fontSize: 12, fontWeight: '800' },

  body: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bodyInner: { padding: 20 },

  invoiceHeader: {
    backgroundColor: COLORS.blue,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  brandLine: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  brandRe: { color: COLORS.white },
  brandVV: { color: COLORS.gold },
  invoiceNumber: { color: COLORS.gold, fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  invoiceDate: { color: COLORS.gray, fontSize: 13 },

  amountCard: {
    backgroundColor: COLORS.blue,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: { color: COLORS.gray, fontSize: 14, fontWeight: '600' },
  amountValue: { color: COLORS.gold, fontSize: 34, fontWeight: '900' },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  cardTitle: { color: COLORS.blue, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailText: { flex: 1 },
  detailLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  detailValue: { color: COLORS.blue, fontSize: 14, fontWeight: '700' },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  afterPhoto: { width: '47%', aspectRatio: 4 / 3, borderRadius: 10 },

  disputeCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  disputeCardClosed: {
    backgroundColor: '#F5F5F5',
    borderColor: COLORS.border,
  },
  disputeText: { flex: 1 },
  disputeTitle: { color: '#856404', fontSize: 13, fontWeight: '800', marginBottom: 3 },
  disputeTitleClosed: { color: COLORS.muted },
  disputeSub: { color: COLORS.muted, fontSize: 12, lineHeight: 17 },

  btnDispute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.red,
    paddingVertical: 14,
    marginBottom: 12,
  },
  btnDisputeText: { color: COLORS.red, fontSize: 14, fontWeight: '700' },
});
