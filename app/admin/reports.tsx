import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { AC, AdminHeader, EmptyState, Row } from '@/components/admin/ui';
import { db } from '@/firebaseConfig';
import { toTitleCase } from '@/lib/format';
import { resolveReport } from '@/lib/payments';

const CATEGORY_LABELS: Record<string, string> = {
  off_platform: 'Asked to pay/book off REVV',
  no_show: 'No-show',
  safety: 'Safety concern',
  harassment: 'Inappropriate behavior',
  fraud: 'Suspected scam or fraud',
  other: 'Something else',
};

type Report = {
  id: string;
  bookingId: string;
  reporterId: string;
  reporterRole: string;
  reportedUserId: string;
  category: string;
  description: string | null;
};

function ReportCard({ report }: { report: Report }) {
  const [expanded, setExpanded]     = useState(false);
  const [note, setNote]             = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function decide(decision: 'reviewed' | 'dismissed') {
    Alert.alert(
      decision === 'reviewed' ? 'Mark as reviewed?' : 'Dismiss report?',
      'This just clears it from the queue — take any account action (warnings, suspension) separately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              await resolveReport({ reportId: report.id, decision, ...(note.trim() ? { note: note.trim() } : {}) });
            } catch (e) {
              Alert.alert('Could not resolve', e instanceof Error && e.message ? e.message : 'Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.card}>
      <Pressable style={styles.cardHead} onPress={() => setExpanded((v) => !v)}>
        <View style={styles.catIcon}>
          <Ionicons name="warning" size={16} color={AC.red} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{CATEGORY_LABELS[report.category] ?? toTitleCase(report.category)}</Text>
          <Text style={styles.cardSub}>Filed by the {report.reporterRole}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={AC.gray} />
      </Pressable>

      {expanded && (
        <View style={styles.cardBody}>
          <Row label="Booking" value={report.bookingId} />
          <Row label="Reporter" value={report.reporterId} />
          <Row label="Reported" value={report.reportedUserId} />
          {!!report.description && (
            <View style={styles.descBox}>
              <Text style={styles.descText}>{report.description}</Text>
            </View>
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

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.dismissBtn, submitting && styles.btnOff]}
              onPress={() => decide('dismissed')}
              disabled={submitting}
            >
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
            <Pressable
              style={[styles.reviewBtn, submitting && styles.btnOff]}
              onPress={() => decide('reviewed')}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color={AC.navy} size="small" /> : <Text style={styles.reviewText}>Mark Reviewed</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default function AdminReportsScreen() {
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'reports'), where('status', '==', 'open'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReports(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              bookingId: String(data.bookingId ?? ''),
              reporterId: String(data.reporterId ?? ''),
              reporterRole: String(data.reporterRole ?? ''),
              reportedUserId: String(data.reportedUserId ?? ''),
              category: String(data.category ?? 'other'),
              description: data.description ? String(data.description) : null,
            };
          })
        );
      },
      () => setReports([])
    );
    return () => unsub();
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AdminHeader title="Trust & Safety Reports" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {reports === null ? (
            <ActivityIndicator color={AC.gold} style={{ marginTop: 40 }} />
          ) : reports.length === 0 ? (
            <EmptyState icon="shield-checkmark-outline" text="No open reports." />
          ) : (
            reports.map((r) => <ReportCard key={r.id} report={r} />)
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
  cardTitle: { color: AC.navy, fontSize: 14.5, fontWeight: '800' },
  cardSub:   { color: AC.muted, fontSize: 12.5, marginTop: 2 },

  cardBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: AC.border, paddingTop: 14 },

  descBox: { backgroundColor: AC.surface, borderRadius: 12, padding: 12, marginTop: 6, marginBottom: 4 },
  descText: { color: AC.navy, fontSize: 12.5, lineHeight: 18 },

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
  dismissBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: AC.border,
  },
  dismissText: { color: AC.muted, fontSize: 14.5, fontWeight: '800' },
  reviewBtn:   { flex: 1, backgroundColor: AC.gold, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  reviewText:  { color: AC.navy, fontSize: 14.5, fontWeight: '900' },
});
