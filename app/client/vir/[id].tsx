import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
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
import { toTitleCase } from '@/lib/format';
import type { BookingDocument } from '@/types/firestore';

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
  red: '#D93025',
};

const PANEL_LABELS: Record<string, string> = {
  front: 'Front',
  rear: 'Rear',
  driverSide: 'Driver Side',
  passengerSide: 'Passenger Side',
  roof: 'Roof / Top',
  interior: 'Interior',
};

const PANEL_ORDER = ['front', 'rear', 'driverSide', 'passengerSide', 'roof', 'interior'];

export default function ClientVIRSignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'bookings', id), (snap) => {
      if (snap.exists()) {
        setBooking({ id: snap.id, ...snap.data() } as BookingDocument);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  async function handleSign() {
    Alert.alert(
      'Sign Inspection Report',
      'By signing, you confirm that the vehicle photos are accurate and authorize the detailer to begin work. The job timer will start immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign & Start Job',
          onPress: async () => {
            setSigning(true);
            try {
              await updateDoc(doc(db, 'bookings', id!), {
                status: 'vir_signed',
                virSignedAt: serverTimestamp(),
              });
              Alert.alert(
                'Inspection Signed!',
                'Your detailer has been notified and can now start the job timer.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to sign.');
            } finally {
              setSigning(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const panels = booking?.virPanels ?? {};
  const orderedPanels = PANEL_ORDER.filter((k) => panels[k]);
  const alreadySigned = booking?.status === 'in_progress' || booking?.status === 'completed';

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Inspection Report</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.blue} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Vehicle Pre-Inspection</Text>
            <Text style={styles.infoBody}>
              Review the photos your detailer took of each panel. These document the vehicle&apos;s condition before work begins. Sign to start the job timer.
            </Text>
          </View>
        </View>

        {orderedPanels.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No inspection photos available yet.</Text>
          </View>
        ) : (
          orderedPanels.map((key) => {
            const panel = panels[key];
            return (
              <View key={key} style={styles.panelCard}>
                <Text style={styles.panelLabel}>{PANEL_LABELS[key] ?? toTitleCase(key)}</Text>
                <Image
                  source={{ uri: panel.photoUrl }}
                  style={styles.panelPhoto}
                  contentFit="cover"
                />
                {panel.notes ? (
                  <View style={styles.notesRow}>
                    <Ionicons name="warning-outline" size={14} color={COLORS.gold} />
                    <Text style={styles.notesText}>{panel.notes}</Text>
                  </View>
                ) : (
                  <View style={styles.notesRow}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.green} />
                    <Text style={[styles.notesText, { color: COLORS.green }]}>No pre-existing damage noted</Text>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        {alreadySigned ? (
          <View style={styles.signedBanner}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
            <Text style={styles.signedText}>You have signed this inspection report.</Text>
          </View>
        ) : (
          <>
            <Pressable
              style={[styles.signBtn, (signing || orderedPanels.length === 0) && styles.signBtnDisabled]}
              onPress={handleSign}
              disabled={signing || orderedPanels.length === 0}
            >
              {signing
                ? <ActivityIndicator color={COLORS.blue} />
                : (
                  <>
                    <Ionicons name="pencil-outline" size={18} color={COLORS.blue} />
                    <Text style={styles.signBtnText}>Sign & Start Job Timer</Text>
                  </>
                )
              }
            </Pressable>
            <Text style={styles.disclaimer}>
              Your signature confirms the vehicle condition shown above and authorizes the detailer to begin work.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  body: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bodyContent: { padding: 16 },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  infoTitle: { color: COLORS.blue, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  infoBody: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  emptyWrap: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: COLORS.muted, fontSize: 14 },
  panelCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  panelLabel: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: '800',
    padding: 12,
    paddingBottom: 10,
  },
  panelPhoto: { width: '100%', height: 200 },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
  },
  notesText: { color: COLORS.muted, fontSize: 13, fontWeight: '600', flex: 1 },
  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 20,
    paddingBottom: 34,
    gap: 8,
  },
  signBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  signBtnDisabled: { backgroundColor: '#E2CFA0' },
  signBtnText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },
  disclaimer: { color: COLORS.muted, fontSize: 11, textAlign: 'center', lineHeight: 15 },
  signedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#D4EDDA',
    borderRadius: 12,
    padding: 14,
  },
  signedText: { color: '#155724', fontSize: 14, fontWeight: '700' },
});
