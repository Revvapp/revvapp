import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

import { AC, AdminHeader, EmptyState, Row, money } from '@/components/admin/ui';
import { db } from '@/firebaseConfig';
import { resolveDispute, type DisputeResolution } from '@/lib/payments';

type Dispute = {
  id: string;
  category: string;
  description: string;
  photoUrls: string[];
  detailerResponse?: string;
  createdAt: { seconds: number } | null;
};

type Invoice = {
  clientName: string;
  detailerName: string;
  service: string;
  vehicleLabel: string;
  price: number;
  detailerPayout: number;
};

const RESOLUTIONS: { key: DisputeResolution; label: string; icon: keyof typeof Ionicons.glyphMap; blurb: string }[] = [
  {
    key: 'release_detailer',
    label: 'Release to detailer',
    icon: 'checkmark-circle-outline',
    blurb: 'Captures the hold and transfers 90% to the detailer. Use when the job was performed as agreed.',
  },
  {
    key: 'refund_client',
    label: 'Refund client in full',
    icon: 'arrow-undo-outline',
    blurb: 'Cancels the hold (or refunds the charge). The detailer is paid nothing.',
  },
  {
    key: 'partial_refund',
    label: 'Partial refund',
    icon: 'git-compare-outline',
    blurb: 'Refunds part of the charge; the detailer receives 90% of what is retained.',
  },
];

function DisputeCard({ dispute }: { dispute: Dispute }) {
  const [expanded, setExpanded]     = useState(false);
  const [invoice, setInvoice]       = useState<Invoice | null>(null);
  const [resolution, setResolution] = useState<DisputeResolution | null>(null);
  const [refund, setRefund]         = useState('');
  const [note, setNote]             = useState('');
  const [submitting, setSubmitting] = useState(false);

  // The invoice (same id as the dispute) carries the money and the party names —
  // fetched lazily so the list itself stays one query.
  useEffect(() => {
    if (!expanded || invoice) return;
    getDoc(doc(db, 'invoices', dispute.id))
      .then((snap) => {
        const d = snap.data();
        if (!d) return;
        setInvoice({
          clientName:     String(d.clientName ?? ''),
          detailerName:   String(d.detailerName ?? ''),
          service:        String(d.service ?? ''),
          vehicleLabel:   String(d.vehicleLabel ?? ''),
          price:          Number(d.price ?? 0),
          detailerPayout: Number(d.detailerPayout ?? 0),
        });
      })
      .catch(() => {});
  }, [expanded, invoice, dispute.id]);

  const priceCents  = invoice ? Math.round(invoice.price * 100) : 0;
  const refundCents = Math.round((parseFloat(refund.replace(/[^0-9.]/g, '')) || 0) * 100);
  const partialValid = refundCents > 0 && refundCents < priceCents;
  const canSubmit =
    !!resolution && !submitting && (resolution !== 'partial_refund' || partialValid);

  async function confirmAndResolve() {
    if (!resolution) return;
    const chosen = RESOLUTIONS.find((r) => r.key === resolution)!;
    const detail =
      resolution === 'partial_refund'
        ? `Refund ${money(refundCents)} to the client and pay the detailer 90% of the remaining ${money(priceCents - refundCents)}.`
        : chosen.blurb;

    Alert.alert(`${chosen.label}?`, `${detail}\n\nThis moves money and cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try {
            await resolveDispute({
              disputeId: dispute.id,
              resolution,
              ...(resolution === 'partial_refund' ? { clientRefundCents: refundCents } : {}),
              ...(note.trim() ? { note: note.trim() } : {}),
            });
            // The card disappears on its own — the list only watches open disputes.
            Alert.alert('Resolved', 'The dispute has been closed and the payment settled.');
          } catch (e) {
            Alert.alert(
              'Could not resolve',
              e instanceof Error && e.message ? e.message : 'Please try again.'
            );
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      <Pressable style={styles.cardHead} onPress={() => setExpanded((v) => !v)}>
        <View style={styles.catIcon}>
          <Ionicons name="flag" size={16} color={AC.red} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{dispute.category.replace(/_/g, ' ')}</Text>
          <Text style={styles.cardSub} numberOfLines={expanded ? undefined : 1}>
            {dispute.description}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={AC.gray} />
      </Pressable>

      {expanded && (
        <View style={styles.cardBody}>
          {invoice ? (
            <>
              <Row label="Client" value={invoice.clientName} />
              <Row label="Detailer" value={invoice.detailerName} />
              <Row label="Job" value={`${invoice.service} — ${invoice.vehicleLabel}`} />
              <Row label="Charged" value={money(priceCents)} />
              <Row label="Payout" value={`${money(Math.round(invoice.detailerPayout * 100))} if released`} />
            </>
          ) : (
            <ActivityIndicator color={AC.gold} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
          )}

          {dispute.photoUrls.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
              {dispute.photoUrls.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.photo} />
              ))}
            </ScrollView>
          )}

          {!!dispute.detailerResponse && (
            <View style={styles.responseBox}>
              <Text style={styles.responseLabel}>Detailer’s response</Text>
              <Text style={styles.responseText}>{dispute.detailerResponse}</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Resolution</Text>
          {RESOLUTIONS.map((r) => {
            const active = resolution === r.key;
            return (
              <Pressable
                key={r.key}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => setResolution(r.key)}
              >
                <Ionicons name={r.icon} size={18} color={active ? AC.navy : AC.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{r.label}</Text>
                  <Text style={styles.optionBlurb}>{r.blurb}</Text>
                </View>
              </Pressable>
            );
          })}

          {resolution === 'partial_refund' && (
            <>
              <View style={styles.amountRow}>
                <Text style={styles.currency}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor={AC.muted}
                  value={refund}
                  onChangeText={setRefund}
                  keyboardType="decimal-pad"
                />
              </View>
              <Text style={[styles.hint, !!refund && !partialValid && styles.hintError]}>
                {!!refund && !partialValid
                  ? `Refund must be more than $0 and less than ${money(priceCents)}.`
                  : `Client refund. Must be less than the ${money(priceCents)} charged.`}
              </Text>
            </>
          )}

          <TextInput
            style={styles.noteInput}
            placeholder="Internal note (optional)"
            placeholderTextColor={AC.muted}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnOff]}
            onPress={confirmAndResolve}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={AC.white} size="small" />
            ) : (
              <Text style={styles.submitText}>Resolve dispute</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function AdminDisputesScreen() {
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);

  const subscribe = useCallback(() => {
    const q = query(collection(db, 'disputes'), where('status', '==', 'open'));
    return onSnapshot(
      q,
      (snap) => {
        setDisputes(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              category: String(data.category ?? 'other'),
              description: String(data.description ?? ''),
              photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : [],
              detailerResponse: data.detailerResponse ? String(data.detailerResponse) : undefined,
              createdAt: data.createdAt ?? null,
            };
          })
        );
      },
      () => setDisputes([])
    );
  }, []);

  useEffect(() => subscribe(), [subscribe]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AdminHeader title="Open Disputes" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {disputes === null ? (
            <ActivityIndicator color={AC.gold} style={{ marginTop: 40 }} />
          ) : disputes.length === 0 ? (
            <EmptyState icon="checkmark-done-outline" text="No open disputes. Every held payment is on track." />
          ) : (
            disputes.map((d) => <DisputeCard key={d.id} dispute={d} />)
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: AC.bg },
  scroll:        { flex: 1, backgroundColor: AC.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  scrollContent: { padding: 22, paddingBottom: 48, gap: 12 },

  card: {
    backgroundColor: AC.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AC.border,
    overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  catIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: AC.redDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: AC.navy, fontSize: 14.5, fontWeight: '800', textTransform: 'capitalize' },
  cardSub:   { color: AC.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },

  cardBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: AC.border, paddingTop: 14 },

  photoStrip: { marginVertical: 10 },
  photo:      { width: 78, height: 78, borderRadius: 10, marginRight: 8 },

  responseBox: {
    backgroundColor: AC.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  responseLabel: { color: AC.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  responseText:  { color: AC.navy, fontSize: 12.5, lineHeight: 18 },

  sectionLabel: {
    color: AC.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1.5,
    borderColor: AC.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  optionActive:      { borderColor: AC.gold, backgroundColor: AC.goldDim },
  optionLabel:       { color: AC.muted, fontSize: 13.5, fontWeight: '700' },
  optionLabelActive: { color: AC.navy },
  optionBlurb:       { color: AC.muted, fontSize: 11.5, lineHeight: 16, marginTop: 2 },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AC.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AC.border,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  currency:    { color: AC.navy, fontSize: 18, fontWeight: '800', marginRight: 4 },
  amountInput: { flex: 1, paddingVertical: 13, fontSize: 18, fontWeight: '700', color: AC.navy },

  hint:      { color: AC.muted, fontSize: 11.5, lineHeight: 16, marginTop: 6 },
  hintError: { color: AC.red },

  noteInput: {
    backgroundColor: AC.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AC.border,
    padding: 12,
    fontSize: 13,
    color: AC.navy,
    minHeight: 64,
    marginTop: 12,
  },

  submitBtn: {
    backgroundColor: AC.red,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnOff: { opacity: 0.4 },
  submitText:   { color: AC.white, fontSize: 14.5, fontWeight: '900' },
});
