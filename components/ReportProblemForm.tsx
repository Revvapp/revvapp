import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
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

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';

const C = {
  bg:      '#0A1628',
  surface: '#F5F7FA',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  goldDim: 'rgba(201,162,39,0.12)',
  gray:    '#8A9BB0',
  muted:   '#6B7A8D',
  border:  '#E8EDF4',
  white:   '#FFFFFF',
  red:     '#D93025',
};

type Category = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// Off-platform solicitation is the headline case (it voids Revv Care coverage and
// leaks the platform fee), so it leads. The rest cover the common safety issues.
const CATEGORIES: Category[] = [
  { key: 'off_platform', label: 'Asked to pay/book off REVV', icon: 'swap-horizontal-outline' },
  { key: 'no_show',      label: 'No-show',                    icon: 'person-remove-outline' },
  { key: 'safety',       label: 'Safety concern',             icon: 'shield-outline' },
  { key: 'harassment',   label: 'Inappropriate behavior',     icon: 'warning-outline' },
  { key: 'fraud',        label: 'Suspected scam or fraud',    icon: 'alert-circle-outline' },
  { key: 'other',        label: 'Something else',             icon: 'ellipsis-horizontal-outline' },
];

type BookingParties = {
  clientId: string;
  detailerId: string;
  vehicleLabel: string;
};

/**
 * Shared report flow for both roles. A report is a confidential flag to the REVV
 * trust & safety team (not a message to the other party) — it persists to the
 * `reports` collection and surfaces server-side via the onReportCreated function.
 * The two route wrappers (client/detailer) render this with the matching `role`.
 */
export default function ReportProblemForm({ role }: { role: 'client' | 'detailer' }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [parties, setParties] = useState<BookingParties | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Resolve the booking's two parties up front: the report stores both ids so the
  // security rule can confirm the reporter is on the booking, and so the team
  // knows who was reported.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) { setLoading(false); return; }
      try {
        const snap = await getDoc(doc(db, 'bookings', id));
        if (!active) return;
        if (snap.exists()) {
          const b = snap.data();
          setParties({
            clientId: String(b.clientId ?? ''),
            detailerId: String(b.detailerId ?? ''),
            vehicleLabel: String(b.vehicleLabel ?? ''),
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  async function handleSubmit() {
    if (!category || !user?.uid || !id || !parties || submitting) return;
    setSubmitting(true);
    try {
      const reportedUserId = role === 'client' ? parties.detailerId : parties.clientId;
      await addDoc(collection(db, 'reports'), {
        bookingId: id,
        reporterId: user.uid,
        reporterRole: role,
        reportedUserId,
        clientId: parties.clientId,
        detailerId: parties.detailerId,
        category,
        description: description.trim() || null,
        status: 'open',
        createdAt: serverTimestamp(),
      });
      Alert.alert(
        'Report Submitted',
        'Thank you. Our trust & safety team reviews every report and will follow up by email if we need more detail. Reports are confidential.',
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('Error', 'Could not submit your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!category && !!parties && !submitting;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.eyebrow}>REVV</Text>
            <Text style={styles.headerTitle}>Report a Problem</Text>
          </View>
          <View style={{ width: 30 }} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={C.gold} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.warningBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color={C.gold} />
              <Text style={styles.warningText}>
                Reports are confidential. The other party is never told who filed one. Keeping every
                job on REVV protects your Revv Care coverage.
              </Text>
            </View>

            <Text style={styles.sectionLabel}>What happened?</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(({ key, label, icon }) => {
                const active = category === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setCategory(key)}
                  >
                    <Ionicons name={icon} size={18} color={active ? C.navy : C.muted} />
                    <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Add detail (optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Tell us what happened. The more context, the faster we can act…"
              placeholderTextColor={C.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/1000</Text>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={16} color={C.muted} />
              <Text style={styles.infoText}>
                Urgent safety emergency? Contact local authorities first, then file this report so
                our team can act on your account.
              </Text>
            </View>

            <Pressable
              style={[styles.submitBtn, !canSubmit && styles.submitBtnOff]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color={C.white} size="small" />
                  <Text style={styles.submitBtnText}>Submitting…</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="flag" size={17} color={C.white} />
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.cancelLink} onPress={() => router.back()}>
              <Text style={styles.cancelLinkText}>Never mind, go back</Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn:      { padding: 4 },
  headerCenter: { flex: 1 },
  eyebrow:      { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 1 },
  headerTitle:  { color: C.white, fontSize: 20, fontWeight: '900' },

  scroll:        { flex: 1, backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  scrollContent: { padding: 22, paddingBottom: 48, gap: 8 },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.goldDim,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
    marginBottom: 8,
  },
  warningText: { color: C.navy, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },

  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 10,
  },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.card,
  },
  categoryChipActive:  { backgroundColor: C.gold, borderColor: C.gold },
  categoryLabel:       { color: C.muted, fontSize: 13, fontWeight: '600' },
  categoryLabelActive: { color: C.navy, fontWeight: '700' },

  textArea: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: C.navy,
    minHeight: 110,
    borderWidth: 1,
    borderColor: C.border,
    lineHeight: 22,
  },
  charCount: { color: C.gray, fontSize: 11, fontWeight: '600', alignSelf: 'flex-end', marginBottom: 4 },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginVertical: 4,
  },
  infoText: { color: C.muted, fontSize: 12, lineHeight: 17, flex: 1 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.red,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitBtnOff:  { opacity: 0.4 },
  submitBtnText: { color: C.white, fontSize: 15, fontWeight: '900' },

  cancelLink:     { alignItems: 'center', paddingVertical: 14 },
  cancelLinkText: { color: C.muted, fontSize: 14, fontWeight: '600' },
});
