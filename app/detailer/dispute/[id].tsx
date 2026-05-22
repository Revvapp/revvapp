import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
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
  createdAt: { seconds: number } | null;
};

export default function DetailerDisputeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dispute, setDispute] = useState<DisputeData | null>(null);
  const [loading, setLoading] = useState(true);

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
          createdAt:   d.data().createdAt ?? null,
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  const isResolved = dispute?.status === 'resolved';

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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
          <Text style={styles.sectionLabel}>Client's Description</Text>
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

          {/* Resolution note */}
          <View style={styles.noteCard}>
            <Ionicons name="information-circle-outline" size={16} color={C.muted} />
            <Text style={styles.noteText}>
              The REVV team is reviewing this dispute. Payment is paused until a resolution is reached. You will be contacted via email within 1–3 business days.
            </Text>
          </View>

          <Pressable style={styles.backBtn2} onPress={() => router.back()}>
            <Text style={styles.backBtn2Text}>Back to Invoice</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
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
});
