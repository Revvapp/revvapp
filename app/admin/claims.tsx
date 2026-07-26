import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
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
import { resolveCareClaim } from '@/lib/payments';

const COVERAGE_CAP_CENTS = 250_000;

type Claim = {
  id: string;
  description: string;
  photoUrls: string[];
  amountRequestedCents: number;
};

type Invoice = { clientName: string; detailerName: string; service: string; vehicleLabel: string };

function ClaimCard({ claim }: { claim: Claim }) {
  const [expanded, setExpanded]   = useState(false);
  const [invoice, setInvoice]     = useState<Invoice | null>(null);
  const [approved, setApproved]   = useState('');
  const [note, setNote]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!expanded || invoice) return;
    getDoc(doc(db, 'invoices', claim.id))
      .then((snap) => {
        const d = snap.data();
        if (!d) return;
        setInvoice({
          clientName:   String(d.clientName ?? ''),
          detailerName: String(d.detailerName ?? ''),
          service:      String(d.service ?? ''),
          vehicleLabel: String(d.vehicleLabel ?? ''),
        });
      })
      .catch(() => {});
  }, [expanded, invoice, claim.id]);

  // Pre-fill the approved amount with what was requested — the common case is
  // approving in full, and the reviewer can edit it down.
  useEffect(() => {
    if (expanded && !approved) setApproved((claim.amountRequestedCents / 100).toFixed(2));
  }, [expanded, approved, claim.amountRequestedCents]);

  const approvedCents = Math.round((parseFloat(approved.replace(/[^0-9.]/g, '')) || 0) * 100);
  const approvedValid = approvedCents > 0 && approvedCents <= COVERAGE_CAP_CENTS;

  async function decide(decision: 'approved' | 'denied') {
    if (decision === 'approved' && !approvedValid) return;
    const detail =
      decision === 'approved'
        ? `Approve ${money(approvedCents)} to be paid from the Revv Care reserve.`
        : 'Deny this claim. The client is notified and no payout is made.';

    Alert.alert(decision === 'approved' ? 'Approve claim?' : 'Deny claim?', detail, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: decision === 'denied' ? 'destructive' : 'default',
        onPress: async () => {
          setSubmitting(true);
          try {
            await resolveCareClaim({
              claimId: claim.id,
              decision,
              ...(decision === 'approved' ? { approvedCents } : {}),
              ...(note.trim() ? { note: note.trim() } : {}),
            });
            Alert.alert(
              decision === 'approved' ? 'Claim approved' : 'Claim denied',
              decision === 'approved'
                ? 'Record the payout against the Revv Care reserve — disbursement is handled off-platform.'
                : 'The decision has been recorded.'
            );
          } catch (e) {
            Alert.alert('Could not record decision', e instanceof Error && e.message ? e.message : 'Please try again.');
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
          <Ionicons name="shield-checkmark" size={16} color={AC.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{money(claim.amountRequestedCents)} requested</Text>
          <Text style={styles.cardSub} numberOfLines={expanded ? undefined : 1}>
            {claim.description}
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
            </>
          ) : (
            <ActivityIndicator color={AC.gold} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
          )}

          {claim.photoUrls.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
              {claim.photoUrls.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.photo} />
              ))}
            </ScrollView>
          )}

          <Text style={styles.sectionLabel}>Approved amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={AC.muted}
              value={approved}
              onChangeText={setApproved}
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={[styles.hint, !!approved && !approvedValid && styles.hintError]}>
            {!!approved && !approvedValid
              ? `Must be between $0.01 and ${money(COVERAGE_CAP_CENTS)}.`
              : `Coverage cap is ${money(COVERAGE_CAP_CENTS)} per job.`}
          </Text>

          <TextInput
            style={styles.noteInput}
            placeholder="Decision note (shared with the client)"
            placeholderTextColor={AC.muted}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.denyBtn, submitting && styles.btnOff]}
              onPress={() => decide('denied')}
              disabled={submitting}
            >
              <Text style={styles.denyText}>Deny</Text>
            </Pressable>
            <Pressable
              style={[styles.approveBtn, (!approvedValid || submitting) && styles.btnOff]}
              onPress={() => decide('approved')}
              disabled={!approvedValid || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={AC.navy} size="small" />
              ) : (
                <Text style={styles.approveText}>Approve</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default function AdminClaimsScreen() {
  const [claims, setClaims] = useState<Claim[] | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'careClaims'), where('status', '==', 'open'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setClaims(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              description: String(data.description ?? ''),
              photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : [],
              amountRequestedCents: Number(data.amountRequestedCents ?? 0),
            };
          })
        );
      },
      () => setClaims([])
    );
    return () => unsub();
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AdminHeader title="Revv Care Claims" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {claims === null ? (
            <ActivityIndicator color={AC.gold} style={{ marginTop: 40 }} />
          ) : claims.length === 0 ? (
            <EmptyState icon="checkmark-done-outline" text="No open claims." />
          ) : (
            claims.map((c) => <ClaimCard key={c.id} claim={c} />)
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
    backgroundColor: AC.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: AC.navy, fontSize: 14.5, fontWeight: '800' },
  cardSub:   { color: AC.muted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },

  cardBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: AC.border, paddingTop: 14 },

  photoStrip: { marginVertical: 10 },
  photo:      { width: 78, height: 78, borderRadius: 10, marginRight: 8 },

  sectionLabel: {
    color: AC.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
  },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AC.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AC.border,
    paddingHorizontal: 14,
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

  actionRow:  { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnOff:     { opacity: 0.4 },
  denyBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: AC.red,
  },
  denyText:   { color: AC.red, fontSize: 14.5, fontWeight: '800' },
  approveBtn: { flex: 1, backgroundColor: AC.gold, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  approveText:{ color: AC.navy, fontSize: 14.5, fontWeight: '900' },
});
