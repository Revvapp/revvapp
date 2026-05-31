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

const C = {
  bg:      '#0D1B2A',
  navy:    '#1A3A5C',
  navyDark:'#112338',
  gold:    '#C9A227',
  white:   '#FFFFFF',
  gray:    '#B7C1CC',
  muted:   '#6B7885',
  border:  '#E2E8F0',
  green:   '#27AE60',
  content: '#F5F7FA',
  card:    '#FFFFFF',
  red:     '#D93025',
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

function money(n: number) {
  return n % 1 === 0 ? `$${n.toLocaleString()}` : `$${n.toFixed(2)}`;
}

function releaseLabel(createdAtSeconds: number | null): { line1: string; line2: string } {
  if (!createdAtSeconds) return { line1: 'Releasing soon', line2: 'Auto-releases after the 24-hour dispute window.' };
  const releaseMs = createdAtSeconds * 1000 + 24 * 60 * 60 * 1000;
  const diffMs = releaseMs - Date.now();
  if (diffMs <= 0) return { line1: 'Released', line2: 'Funds have been sent to your payout account.' };
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return {
    line1: `Releases in ${h}h ${m}m`,
    line2: 'Auto-releases after the 24-hour client dispute window closes.',
  };
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
        clientName:     String(d.clientName ?? ''),
        detailerName:   String(d.detailerName ?? ''),
        businessName:   d.businessName ? String(d.businessName) : undefined,
        vehicleLabel:   String(d.vehicleLabel ?? ''),
        service:        String(d.service ?? ''),
        date:           String(d.date ?? ''),
        price:          Number(d.price ?? 0),
        platformFee:    Number(d.platformFee ?? 0),
        detailerPayout: Number(d.detailerPayout ?? 0),
        status:         String(d.status ?? ''),
        afterPhotos:    Array.isArray(d.afterPhotos) ? d.afterPhotos : [],
        createdAt:      d.createdAt ?? null,
      });
      setLoading(false);
    }, (e) => {
      if (__DEV__) console.warn('[invoice listener]', e.message);
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
        </View>
      </SafeAreaView>
    );
  }

  const invoiceNum = `REV-${invoice.date.replace(/-/g, '')}-${(id ?? '').slice(-4).toUpperCase()}`;
  const isReleased = invoice.status === 'released';
  const isDisputed = invoice.status === 'disputed';
  const release = releaseLabel(invoice.createdAt?.seconds ?? null);
  const detailerDisplay = invoice.businessName ? toTitleCase(invoice.businessName) : toTitleCase(invoice.detailerName);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {/* Nav bar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </Pressable>
        <Text style={styles.navTitle}>Invoice</Text>
        <View style={[styles.statusPill, isReleased ? styles.pillGreen : isDisputed ? styles.pillRed : styles.pillAmber]}>
          <Text style={[styles.statusPillText, isReleased ? styles.pillGreenText : isDisputed ? styles.pillRedText : styles.pillAmberText]}>
            {isReleased ? 'Paid Out' : isDisputed ? 'Disputed' : 'Pending'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner} showsVerticalScrollIndicator={false}>

        {/* Invoice document card */}
        <View style={styles.document}>

          {/* Document header band */}
          <View style={styles.docHeader}>
            <View>
              <Text style={styles.docBrand}>
                <Text style={styles.docBrandRe}>RE</Text>
                <Text style={styles.docBrandVV}>VV</Text>
                <Text style={styles.docBrandLabel}> Pro</Text>
              </Text>
              <Text style={styles.docTagline}>Detailing Invoice</Text>
            </View>
            <View style={styles.docMeta}>
              <Text style={styles.docMetaLabel}>INVOICE NO.</Text>
              <Text style={styles.docMetaValue}>{invoiceNum}</Text>
              <Text style={styles.docMetaDate}>{formatJobDate(invoice.date)}</Text>
            </View>
          </View>

          {/* FROM / TO */}
          <View style={styles.fromTo}>
            <View style={styles.fromToCol}>
              <Text style={styles.fromToLabel}>FROM</Text>
              <Text style={styles.fromToName}>{detailerDisplay}</Text>
              <Text style={styles.fromToSub}>via REVV Platform</Text>
            </View>
            <View style={styles.fromToDivider} />
            <View style={styles.fromToCol}>
              <Text style={styles.fromToLabel}>BILLED TO</Text>
              <Text style={styles.fromToName}>{toTitleCase(invoice.clientName)}</Text>
              <Text style={styles.fromToSub}>{invoice.vehicleLabel}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.hairline} />

          {/* Line items */}
          <View style={styles.lineItems}>
            <View style={styles.lineItemsHeader}>
              <Text style={styles.colDescription}>DESCRIPTION</Text>
              <Text style={styles.colAmount}>AMOUNT</Text>
            </View>
            <View style={styles.hairlineThin} />
            <View style={styles.lineRow}>
              <View style={styles.lineDesc}>
                <Text style={styles.lineTitle}>{toTitleCase(invoice.service)}</Text>
                <Text style={styles.lineSub}>Completed {formatJobDate(invoice.date)}</Text>
              </View>
              <Text style={styles.lineAmt}>{money(invoice.price)}</Text>
            </View>
          </View>

          <View style={styles.hairline} />

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalVal}>{money(invoice.price)}</Text>
            </View>
            <View style={styles.totalRow}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>REVV Platform Fee</Text>
                <View style={styles.feeBadge}><Text style={styles.feeBadgeText}>10%</Text></View>
              </View>
              <Text style={styles.feeVal}>−{money(invoice.platformFee)}</Text>
            </View>
          </View>

          <View style={styles.payoutBand}>
            <Text style={styles.payoutLabel}>YOUR PAYOUT</Text>
            <Text style={styles.payoutAmount}>{money(invoice.detailerPayout)}</Text>
          </View>
        </View>

        {/* Payment release card */}
        <View style={styles.releaseCard}>
          <View style={styles.releaseIconWrap}>
            <Ionicons name={isReleased ? 'checkmark-circle' : 'time'} size={22} color={isReleased ? C.green : C.gold} />
          </View>
          <View style={styles.releaseBody}>
            <Text style={styles.releaseLine1}>{release.line1}</Text>
            <Text style={styles.releaseLine2}>{release.line2}</Text>
          </View>
        </View>

        {/* After photos */}
        {invoice.afterPhotos.length > 0 && (
          <View style={styles.photosCard}>
            <Text style={styles.photosTitle}>After Photos</Text>
            <View style={styles.photoGrid}>
              {invoice.afterPhotos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photo} contentFit="cover" />
              ))}
            </View>
          </View>
        )}

        {isDisputed && (
          <Pressable
            style={styles.btnDispute}
            onPress={() => router.push({ pathname: '/detailer/dispute/[id]', params: { id: id ?? '' } })}
          >
            <Ionicons name="alert-circle-outline" size={17} color={C.white} />
            <Text style={styles.btnDisputeText}>View Dispute</Text>
          </Pressable>
        )}

        <Pressable style={styles.btnReach} onPress={() => router.push({ pathname: '/detailer/revv-reach/[id]', params: { id: id ?? '' } })}>
          <Ionicons name="megaphone" size={18} color={C.navy} />
          <Text style={styles.btnReachText}>Share to Social</Text>
        </Pressable>

        <Pressable style={styles.btnDone} onPress={() => router.push('/detailer/(tabs)/jobs')}>
          <Text style={styles.btnDoneText}>Back to Jobs</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: C.gray, fontSize: 16, fontWeight: '700' },

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
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  pillAmber: { backgroundColor: '#FFF3CD' },
  pillGreen: { backgroundColor: '#D4EDDA' },
  pillRed:   { backgroundColor: '#FDECEA' },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  pillAmberText: { color: '#856404' },
  pillGreenText: { color: '#155724' },
  pillRedText:   { color: '#D93025' },

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

  fromTo: { flexDirection: 'row', padding: 18, gap: 0 },
  fromToCol: { flex: 1 },
  fromToDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 16, marginVertical: 4 },
  fromToLabel: { color: C.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 },
  fromToName: { color: C.navy, fontSize: 14, fontWeight: '900', marginBottom: 2 },
  fromToSub: { color: C.muted, fontSize: 12, fontWeight: '500' },

  hairline: { height: 1, backgroundColor: C.border, marginHorizontal: 0 },
  hairlineThin: { height: 1, backgroundColor: '#F0F4F8', marginBottom: 10 },

  lineItems: { padding: 18, paddingBottom: 12 },
  lineItemsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  colDescription: { color: C.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  colAmount: { color: C.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lineDesc: { flex: 1, marginRight: 12 },
  lineTitle: { color: C.navy, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  lineSub: { color: C.muted, fontSize: 12, fontWeight: '500' },
  lineAmt: { color: C.navy, fontSize: 14, fontWeight: '800' },

  totals: { padding: 18, paddingTop: 14, paddingBottom: 14, gap: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: C.muted, fontSize: 13, fontWeight: '600' },
  totalVal: { color: C.navy, fontSize: 13, fontWeight: '700' },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feeLabel: { color: C.muted, fontSize: 13, fontWeight: '600' },
  feeBadge: { backgroundColor: '#F0F4F8', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  feeBadgeText: { color: C.muted, fontSize: 10, fontWeight: '800' },
  feeVal: { color: C.muted, fontSize: 13, fontWeight: '600' },

  payoutBand: {
    backgroundColor: C.navy,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutLabel: { color: C.gray, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  payoutAmount: { color: C.green, fontSize: 32, fontWeight: '900' },

  // Release card
  releaseCard: {
    backgroundColor: '#1A2B3C',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  releaseIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(201,162,39,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  releaseBody: { flex: 1 },
  releaseLine1: { color: C.gold, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  releaseLine2: { color: C.gray, fontSize: 12, lineHeight: 17 },

  // Photos
  photosCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  photosTitle: { color: C.navy, fontSize: 14, fontWeight: '800' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: '47%', aspectRatio: 4 / 3, borderRadius: 10 },

  btnReach: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  btnReachText: { color: C.navy, fontSize: 15, fontWeight: '900' },
  btnDone: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDoneText:    { color: C.muted, fontSize: 14, fontWeight: '600' },
  btnDispute:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D93025', borderRadius: 14, paddingVertical: 14, marginHorizontal: 0 },
  btnDisputeText: { color: C.white, fontSize: 14, fontWeight: '900' },
});
