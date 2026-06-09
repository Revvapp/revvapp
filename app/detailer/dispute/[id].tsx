import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
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
import { toTitleCase } from '@/lib/format';

const C = {
  bg:      '#0A1628',
  surface: '#F5F7FA',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  muted:   '#6B7A8D',
  border:  '#E8EDF4',
  white:   '#FFFFFF',
  red:     '#D93025',
  redDim:  'rgba(217,48,37,0.08)',
  redBorder:'rgba(217,48,37,0.25)',
  green:   '#27AE60',
};

const CATEGORY_LABELS: Record<string, string> = {
  damage:          'Vehicle Damage',
  service_quality: 'Service Quality',
  no_show:         'Detailer No-Show',
  wrong_service:   'Wrong Service Done',
  overcharge:      'Incorrect Charge',
  other:           'Other',
};

type DisputeData = {
  id: string;
  category: string;
  description: string;
  photoUrls: string[];
  status: string;
  clientId: string;
  detailerResponse: string;
  createdAt: { seconds: number } | null;
};

export default function DetailerDisputeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [dispute, setDispute] = useState<DisputeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'disputes'), where('invoiceId', '==', id));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setDispute({
          id: d.id,
          category:    String(d.data().category ?? ''),
          description: String(d.data().description ?? ''),
          photoUrls:   Array.isArray(d.data().photoUrls) ? d.data().photoUrls : [],
          status:      String(d.data().status ?? 'open'),
          clientId:    String(d.data().clientId ?? ''),
          detailerResponse: String(d.data().detailerResponse ?? ''),
          createdAt:   d.data().createdAt ?? null,
        });
      }
      setLoading(false);
    }, (e) => {
      if (__DEV__) console.warn('[dispute listener]', e.message);
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  const isResolved = dispute?.status === 'resolved';

  async function submitResponse() {
    if (!dispute || !response.trim() || submitting) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'disputes', dispute.id), {
        detailerResponse: response.trim(),
        respondedAt: serverTimestamp(),
      });
      // The client is notified of the response server-side (onDisputeUpdated).
      setResponse('');
      Alert.alert('Response Sent', 'Your response has been added to the dispute.');
    } catch {
      Alert.alert('Error', 'Could not send your response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmResolve() {
    Alert.alert(
      'Mark as Resolved?',
      'Confirm you have settled this issue with the client. This releases the held payment and closes the dispute.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resolve', style: 'default', onPress: () => void resolveDispute() },
      ]
    );
  }

  async function resolveDispute() {
    if (!dispute || submitting) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'disputes', dispute.id), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: user?.uid ?? '',
      });
      if (id) await updateDoc(doc(db, 'invoices', id), { status: 'released' });
      // The client is notified of the resolution server-side (onDisputeUpdated).
      Alert.alert('Dispute Resolved', 'The dispute is closed and the payment has been released.');
    } catch {
      Alert.alert('Error', 'Could not resolve the dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>REVV</Text>
          <Text style={styles.headerTitle}>Dispute Details</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.gold} size="large" />
        </View>
      ) : !dispute ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle-outline" size={48} color={C.green} />
          <Text style={styles.noDisputeText}>No dispute found for this invoice.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Status banner */}
          <View style={[styles.statusBanner, isResolved ? styles.statusBannerGreen : styles.statusBannerRed]}>
            <Ionicons
              name={isResolved ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={isResolved ? C.green : C.red}
            />
            <Text style={[styles.statusText, { color: isResolved ? C.green : C.red }]}>
              {isResolved ? 'Dispute Resolved' : 'Dispute Open — Under Review'}
            </Text>
          </View>

          {/* Category */}
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.infoCard}>
            <Ionicons name="flag-outline" size={16} color={C.red} />
            <Text style={styles.infoValue}>
              {CATEGORY_LABELS[dispute.category] ?? toTitleCase(dispute.category)}
            </Text>
          </View>

          {/* Description */}
          <Text style={styles.sectionLabel}>Client&apos;s Description</Text>
          <View style={styles.descCard}>
            <Text style={styles.descText}>{dispute.description}</Text>
          </View>

          {/* Photos */}
          {dispute.photoUrls.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Photos Submitted</Text>
              <View style={styles.photoGrid}>
                {dispute.photoUrls.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.photo} contentFit="cover" />
                ))}
              </View>
            </>
          )}

          {/* Existing response */}
          {!!dispute.detailerResponse && (
            <>
              <Text style={styles.sectionLabel}>Your Response</Text>
              <View style={styles.descCard}>
                <Text style={styles.descText}>{dispute.detailerResponse}</Text>
              </View>
            </>
          )}

          {/* Resolution actions (open disputes only) */}
          {!isResolved ? (
            <>
              <Text style={styles.sectionLabel}>
                {dispute.detailerResponse ? 'Update Your Response' : 'Respond to the Client'}
              </Text>
              <TextInput
                style={styles.responseInput}
                placeholder="Explain your side or how you've addressed the issue…"
                placeholderTextColor={C.muted}
                value={response}
                onChangeText={setResponse}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />

              <Pressable
                style={[styles.responseBtn, (!response.trim() || submitting) && styles.btnDisabled]}
                onPress={submitResponse}
                disabled={!response.trim() || submitting}
              >
                {submitting
                  ? <ActivityIndicator color={C.white} size="small" />
                  : (
                    <>
                      <Ionicons name="send" size={16} color={C.white} />
                      <Text style={styles.responseBtnText}>Send Response</Text>
                    </>
                  )}
              </Pressable>

              <Pressable
                style={[styles.resolveBtn, submitting && styles.btnDisabled]}
                onPress={confirmResolve}
                disabled={submitting}
              >
                <Ionicons name="checkmark-circle" size={17} color={C.white} />
                <Text style={styles.resolveBtnText}>Mark as Resolved & Release Payment</Text>
              </Pressable>

              <Text style={styles.noteText}>
                Resolving confirms you have settled the issue with the client. This releases the held payment and closes the dispute.
              </Text>
            </>
          ) : (
            <View style={styles.noteCard}>
              <Ionicons name="checkmark-circle-outline" size={16} color={C.green} />
              <Text style={styles.noteText}>
                This dispute has been resolved and the payment released.
              </Text>
            </View>
          )}

          <Pressable style={styles.backBtn2} onPress={() => router.back()}>
            <Text style={styles.backBtn2Text}>Back to Invoice</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noDisputeText: { color: C.muted, fontSize: 15, fontWeight: '600' },

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
  scrollContent: { padding: 22, gap: 8, paddingBottom: 48 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  statusBannerRed:   { backgroundColor: C.redDim, borderColor: C.redBorder },
  statusBannerGreen: { backgroundColor: 'rgba(39,174,96,0.08)', borderColor: 'rgba(39,174,96,0.25)' },
  statusText: { fontSize: 14, fontWeight: '700', flex: 1 },

  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 6,
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoValue: { color: C.navy, fontSize: 14, fontWeight: '700', flex: 1 },

  descCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  descText: { color: C.navy, fontSize: 14, lineHeight: 21 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo:     { width: 100, height: 100, borderRadius: 10 },

  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 4,
  },
  noteText: { color: C.muted, fontSize: 12, lineHeight: 18, flex: 1 },

  backBtn2: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: C.navy,
    borderRadius: 14,
    marginTop: 8,
  },
  backBtn2Text: { color: C.white, fontSize: 15, fontWeight: '800' },

  responseInput: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: C.navy,
    minHeight: 100,
    borderWidth: 1,
    borderColor: C.border,
    lineHeight: 20,
  },
  responseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.navy,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  responseBtnText: { color: C.white, fontSize: 14, fontWeight: '800' },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.green,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  resolveBtnText: { color: C.white, fontSize: 14, fontWeight: '800' },
  btnDisabled: { opacity: 0.4 },
});
