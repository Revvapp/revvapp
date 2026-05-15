import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
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
import type { DetailerDocument } from '@/types/firestore';

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
};

function StepBar({ step }: { step: number }) {
  return (
    <View style={styles.stepBar}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.stepDot, i <= step && styles.stepDotActive]} />
      ))}
    </View>
  );
}

export default function BookServiceScreen() {
  const { detailerId } = useLocalSearchParams<{ detailerId: string }>();
  const [detailer, setDetailer] = useState<DetailerDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ service: string; price: string } | null>(null);

  useEffect(() => {
    if (!detailerId) return;
    getDoc(doc(db, 'detailers', detailerId)).then((snap) => {
      if (snap.exists()) {
        setDetailer({ uid: snap.id, ...snap.data() } as DetailerDocument);
      }
      setLoading(false);
    });
  }, [detailerId]);

  function handleContinue() {
    if (!selected || !detailer) return;
    const name = detailer.businessName?.trim() || detailer.fullName;
    router.push({
      pathname: '/client/book/vehicle',
      params: {
        detailerId,
        detailerName: name,
        service: selected.service,
        price: selected.price,
        workingDaysJson: JSON.stringify(detailer.workingDays ?? []),
        workingHoursFrom: detailer.workingHours?.from ?? '',
        workingHoursTo: detailer.workingHours?.to ?? '',
      },
    });
  }

  const entries = Object.entries(detailer?.rates ?? {});

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Book a Detail</Text>
          <StepBar step={1} />
        </View>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>Choose a Service</Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>This detailer has no services listed yet.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {entries.map(([service, price]) => {
              const isSelected = selected?.service === service;
              return (
                <Pressable
                  key={service}
                  style={[styles.serviceRow, isSelected && styles.serviceRowSelected]}
                  onPress={() => setSelected({ service, price })}
                >
                  <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceName, isSelected && styles.serviceNameSelected]}>
                      {toTitleCase(service)}
                    </Text>
                    <Text style={[styles.servicePrice, isSelected && styles.servicePriceSelected]}>
                      {price}
                    </Text>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={styles.continueBtnText}>
            {selected ? `Continue · ${selected.price}` : 'Select a Service'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 8 },
  headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
  stepBar: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: '#2A3E52' },
  stepDotActive: { backgroundColor: COLORS.gold },
  body: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 20 },
  sectionLabel: { color: COLORS.blue, fontSize: 14, fontWeight: '900', paddingHorizontal: 16, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyWrap: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: COLORS.muted, fontSize: 14 },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 10,
  },
  serviceRowSelected: { borderColor: COLORS.gold, backgroundColor: '#FFFBEF' },
  serviceInfo: { flex: 1 },
  serviceName: { color: COLORS.blue, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  serviceNameSelected: { color: COLORS.blue },
  servicePrice: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
  servicePriceSelected: { color: COLORS.gold },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: COLORS.gold },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.gold },
  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 20,
    paddingBottom: 34,
  },
  continueBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: '#E2CFA0' },
  continueBtnText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },
});
