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

const C = {
  bg:       '#0D1B2A',
  navyDark: '#112338',
  navy:     '#1A3A5C',
  gold:     '#C9A227',
  white:    '#FFFFFF',
  gray:     '#B7C1CC',
  muted:    '#6B7885',
  border:   '#E2E8F0',
  green:    '#27AE60',
  content:  '#F5F7FA',
  card:     '#FFFFFF',
  red:      '#D93025',
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

function money(n: number) {
  return n % 1 === 0 ? `$${n.toLocaleString()}` : `$${n.toFixed(2)}`;
}

function disputeWindowOpen(createdSeconds: number | null): boolean {
  if (!createdSeconds) return true;
  return Date.now() < createdSeconds * 1000 + 24 * 60 * 60 * 1000;
}

function windowLabel(createdSeconds: number | null): { line1: string; line2: string } {
  if (!createdSeconds) return { line1: 'Dispute window open', line2: 'Auto-closes 24 hours after job completion.' };
  const releaseMs = createdSeconds * 1000 + 24 * 60 * 60 * 1000;
  const diffMs = releaseMs - Date.now();
  if (diffMs <= 0) return {
    line1: 'Dispute window closed',
    line2: 'Payment has been released to your detailer.',
  };
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return {
    line1: `${h}h ${m}m remaining`,
    line2: 'Raise a dispute before this window closes if anything looks wrong.',
  };
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
        clientName:   String(d.clientName ?? ''),
        detailerName: String(d.detailerName ?? ''),
        businessName: d.businessName ? String(d.businessName) : undefined,
        vehicleLabel: String(d.vehicleLabel ?? ''),
        service:      String(d.service ?? ''),
        date:         String(d.date ?? ''),
        price:        Number(d.price ?? 0),
        status:       String(d.status ?? ''),
        afterPhotos:  Array.isArray(d.afterPhotos) ? d.afterPhotos : [],
        createdAt:    d.createdAt ?? null,
      });
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={C.gold} /></View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="document-outline" size={40} color={C.muted} />
          <Text style={styles.errorText}>Invoice not found</Text>
          <Text style={styles.errorSub}>It may not be ready yet — check back shortly.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const invoiceNum = `REV-${invoice.date.replace(/-/g, '')}-${(id ?? '').slice(-4).toUpperCase()}`;
  const createdSeconds = invoice.createdAt?.seconds ?? null;
  const disputeOpen = disputeWindowOpen(createdSeconds);
  const window = windowLabel(createdSeconds);
  const detailerDisplay = invoice.businessName ? toTitleCase(invoice.businessName) : toTitleCase(invoice.detailerName);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {/* Nav bar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </Pressable>
        <Text style={styles.navTitle}>Receipt</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>Completed</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner} showsVerticalScrollIndicator={false}>

        {/* Document card */}
        <View style={styles.document}>

          {/* Document header band */}
          <View style={styles.docHeader}>
            <View>
              <Text style={styles.docBrand}>
                <Text style={styles.docBrandRe}>RE</Text>
                <Text style={styles.docBrandVV}>VV</Text>
                <Text style={styles.docBrandLabel}> Pro</Text>
              </Text>
              <Text style={styles.docTagline}>Detailing Receipt</Text>
            </View>
            <View style={styles.docMeta}>
              <Text style={styles.docMetaLabel}>RECEIPT NO.</Text>
              <Text style={styles.docMetaValue}>{invoiceNum}</Text>
              <Text style={styles.docMetaDate}>{formatJobDate(invoice.date)}</Text>
            </View>
          </View>

          {/* Amount paid hero */}
          <View style={styles.amountBand}>
            <Text style={styles.amountLabel}>AMOUNT PAID</Text>
            <Text style={styles.amountValue}>{money(invoice.price)}</Text>
            <View style={styles.paidBadge}>
              <Ionicons name="checkmark-circle" size={13} color={C.green} />
              <Text style={styles.paidBadgeText}>Payment confirmed</Text>
            </View>
          </View>

          <View style={styles.hairline} />

          {/* Service detail rows */}
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Ionicons name="construct-outline" size={14} color={C.gold} />
              </View>
              <View style={styles.detailBody}>
                <Text style={styles.detailLabel}>SERVICE</Text>
                <Text style={styles.detailValue}>{toTitleCase(invoice.service)}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Ionicons name="person-outline" size={14} color={C.gold} />
              </View>
              <View style={styles.detailBody}>
                <Text style={styles.detailLabel}>DETAILER</Text>
                <Text style={styles.detailValue}>{detailerDisplay}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Ionicons name="car-sport-outline" size={14} color={C.gold} />
              </View>
              <View style={styles.detailBody}>
                <Text style={styles.detailLabel}>VEHICLE</Text>
                <Text style={styles.detailValue}>{invoice.vehicleLabel}</Text>
              </View>
            </View>
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <View style={styles.detailIconWrap}>
                <Ionicons name="calendar-outline" size={14} color={C.gold} />
              </View>
              <View style={styles.detailBody}>
                <Text style={styles.detailLabel}>DATE</Text>
                <Text style={styles.detailValue}>{formatJobDate(invoice.date)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* After photos */}
        {invoice.afterPhotos.length > 0 && (
          <View style={styles.photosCard}>
            <View style={styles.photosHeader}>
              <Text style={styles.photosTitle}>Finished Work</Text>
              <Text style={styles.photosCount}>{invoice.afterPhotos.length} photo{invoice.afterPhotos.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.photoGrid}>
              {invoice.afterPhotos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photo} contentFit="cover" />
              ))}
            </View>
          </View>
        )}

        {/* Dispute window card */}
        <View style={[styles.disputeCard, !disputeOpen && styles.disputeCardClosed]}>
          <View style={[styles.disputeIconWrap, !disputeOpen && styles.disputeIconWrapClosed]}>
            <Ionicons
              name={disputeOpen ? 'shield-checkmark-outline' : 'lock-closed-outline'}
              size={20}
              color={disputeOpen ? C.gold : C.muted}
            />
          </View>
          <View style={styles.disputeBody}>
            <Text style={[styles.disputeLine1, !disputeOpen && styles.disputeLine1Closed]}>
              {window.line1}
            </Text>
            <Text style={styles.disputeLine2}>{window.line2}</Text>
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
            <Ionicons name="flag-outline" size={16} color={C.red} />
            <Text style={styles.btnDisputeText}>Raise a Dispute</Text>
          </Pressable>
        )}

        <Pressable style={styles.btnDone} onPress={() => router.push('/client/(tabs)/bookings')}>
          <Text style={styles.btnDoneText}>Back to Bookings</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 30 },
  errorText: { color: C.gray, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  errorSub: { color: C.muted, fontSize: 13, textAlign: 'center' },

  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  navTitle: { color: C.white, fontSize: 20, fontWeight: '800', flex: 1 },
  statusPill: { backgroundColor: '#D4EDDA', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  statusPillText: { color: '#155724', fontSize: 12, fontWeight: '800' },

  body: { flex: 1, backgroundColor: C.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bodyInner: { padding: 18, paddingBottom: 40 },

  // Document card
  document: {
    backgroundColor: C.card,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  docHeader: {
    backgroundColor: C.navyDark,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  docBrand: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  docBrandRe: { color: C.white },
  docBrandVV: { color: C.gold },
  docBrandLabel: { color: C.gray, fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  docTagline: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 3, letterSpacing: 0.5 },
  docMeta: { alignItems: 'flex-end' },
  docMetaLabel: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  docMetaValue: { color: C.gold, fontSize: 13, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  docMetaDate: { color: C.gray, fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Amount paid band
  amountBand: {
    backgroundColor: C.navy,
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 6,
  },
  amountLabel: { color: C.gray, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  amountValue: { color: C.gold, fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  paidBadgeText: { color: C.green, fontSize: 12, fontWeight: '700' },

  hairline: { height: 1, backgroundColor: C.border },

  // Detail rows
  details: { padding: 18, gap: 16 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
  },
  detailRowLast: { paddingBottom: 0, borderBottomWidth: 0 },
  detailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(201,162,39,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBody: { flex: 1 },
  detailLabel: { color: C.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 3 },
  detailValue: { color: C.navy, fontSize: 14, fontWeight: '800' },

  // After photos
  photosCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  photosHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photosTitle: { color: C.navy, fontSize: 14, fontWeight: '800' },
  photosCount: { color: C.muted, fontSize: 12, fontWeight: '600' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: '47%', aspectRatio: 4 / 3, borderRadius: 10 },

  // Dispute card
  disputeCard: {
    backgroundColor: '#1A2B3C',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  disputeCardClosed: { backgroundColor: '#F5F7FA', borderWidth: 1, borderColor: C.border },
  disputeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(201,162,39,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeIconWrapClosed: { backgroundColor: '#EAECEF' },
  disputeBody: { flex: 1 },
  disputeLine1: { color: C.gold, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  disputeLine1Closed: { color: C.muted },
  disputeLine2: { color: C.gray, fontSize: 12, lineHeight: 17 },

  btnDispute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.red,
    paddingVertical: 15,
    marginBottom: 12,
  },
  btnDisputeText: { color: C.red, fontSize: 14, fontWeight: '700' },

  btnDone: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnDoneText: { color: C.navy, fontSize: 15, fontWeight: '900' },
});
