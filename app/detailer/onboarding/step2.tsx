import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useOnboarding } from '@/hooks/useOnboarding';
import {
  ActivityIndicator,
  Animated,
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

const COLORS = {
  bg: '#0D1B2A',
  cardLight: '#F5F5F5',
  gold: '#C9A227',
  white: '#FFFFFF',
  darkText: '#0D1B2A',
  muted: '#556575',
  track: '#D3D8DE',
  darkNavyButton: '#1A3A5C',
  error: '#D32F2F',
};

const SERVICES = ['Full detail', 'Paint correction', 'Ceramic coat', 'Interior'] as const;
type Service = (typeof SERVICES)[number];

function ProgressBar({ value }: { value: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: value, duration: 450, useNativeDriver: false }).start();
  }, [value, widthAnim]);
  const width = widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width }]} />
    </View>
  );
}

export default function DetailerOnboardingStep2() {
  const { state: onboarding, updateField } = useOnboarding();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 220);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (onboarding.services.length === 0) {
      const seedServices: Service[] = ['Full detail', 'Interior'];
      updateField('services', seedServices);
      updateField('rates', {
        'Full detail': '180',
        'Paint correction': '',
        'Ceramic coat': '',
        Interior: '120',
      });
    }
  }, [onboarding.services.length, updateField]);

  const selected = onboarding.services.filter((s): s is Service =>
    (SERVICES as readonly string[]).includes(s)
  ) as Service[];

  const rates = SERVICES.reduce(
    (acc, s) => {
      acc[s] = onboarding.rates[s] ?? '';
      return acc;
    },
    {} as Record<Service, string>
  );

  const toggleService = (service: Service) => {
    const next = selected.includes(service)
      ? selected.filter((s) => s !== service)
      : [...selected, service];
    updateField('services', next);
  };

  const updateRate = (service: Service, value: string) => {
    updateField('rates', {
      ...onboarding.rates,
      [service]: value.replace(/[^0-9]/g, ''),
    });
    if (error) setError('');
  };

  const onNext = () => {
    if (selected.length === 0) {
      setError('Select at least one service.');
      return;
    }
    const missingRate = selected.some((service) => !rates[service]);
    if (missingRate) {
      setError('Enter rates for all selected services.');
      return;
    }
    router.push('/detailer/onboarding/step3');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerBrand}>
            <Text style={styles.brandWhite}>RE</Text>
            <Text style={styles.brandGold}>VV</Text>
          </Text>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={COLORS.gold} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step 2 of 4</Text>
              </View>

              <View style={styles.card}>
                <ProgressBar value={0.5} />
                <View style={styles.progressMeta}>
                  <Text style={styles.progressLabel}>Services and pricing</Text>
                  <Text style={styles.progressPercent}>50%</Text>
                </View>

                <Text style={styles.sectionTitle}>YOUR SERVICES</Text>
                <View style={styles.chipsWrap}>
                  {SERVICES.map((service) => {
                    const isSelected = selected.includes(service);
                    return (
                      <Pressable
                        key={service}
                        onPress={() => toggleService(service)}
                        style={[styles.chip, isSelected ? styles.chipSelected : styles.chipOutlined]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected ? styles.chipTextSelected : styles.chipTextOutlined,
                          ]}
                        >
                          {service}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable style={styles.chipOutlined}>
                    <Text style={[styles.chipText, styles.chipTextOutlined]}>+ Add</Text>
                  </Pressable>
                </View>

                <Text style={styles.sectionTitle}>YOUR RATES</Text>
                {SERVICES.map((service) => (
                  <View key={service} style={styles.rateRow}>
                    <Text style={styles.rateLabel}>{service}</Text>
                    <View style={styles.rateInputWrap}>
                      <Text style={styles.dollar}>$</Text>
                      <TextInput
                        value={rates[service]}
                        onChangeText={(v) => updateRate(service, v)}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor="#8A96A3"
                        style={styles.rateInput}
                      />
                    </View>
                  </View>
                ))}

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable style={styles.nextButton} onPress={onNext}>
                  <Text style={styles.nextText}>NEXT — AVAILABILITY</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  headerBrand: { fontSize: 22, fontWeight: '900', letterSpacing: 2.6 },
  brandWhite: { color: COLORS.white },
  brandGold: { color: COLORS.gold },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 22 },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gold,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 10,
  },
  stepBadgeText: { color: COLORS.bg, fontSize: 12, fontWeight: '900' },
  card: { backgroundColor: COLORS.cardLight, borderRadius: 18, padding: 16 },
  progressTrack: {
    height: 10,
    borderRadius: 10,
    backgroundColor: COLORS.track,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 10, backgroundColor: COLORS.gold },
  progressMeta: {
    marginTop: 10,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: { color: '#3B4B5C', fontSize: 13, fontWeight: '700' },
  progressPercent: { color: '#3B4B5C', fontSize: 13, fontWeight: '800' },
  sectionTitle: {
    color: COLORS.darkText,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 6,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  chipSelected: { backgroundColor: COLORS.darkNavyButton },
  chipOutlined: { borderWidth: 1, borderColor: '#9CACBC', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  chipText: { fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: COLORS.white },
  chipTextOutlined: { color: COLORS.darkNavyButton },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rateLabel: { color: '#1A2B3C', fontSize: 14, fontWeight: '700', flex: 1, marginRight: 10 },
  rateInputWrap: {
    minWidth: 130,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8DEE6',
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  dollar: { color: '#2E3B49', fontSize: 16, fontWeight: '800', marginRight: 4 },
  rateInput: {
    flex: 1,
    paddingVertical: 10,
    color: COLORS.darkText,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: { color: COLORS.error, fontSize: 12, fontWeight: '700', marginTop: 6 },
  nextButton: {
    marginTop: 12,
    backgroundColor: COLORS.darkNavyButton,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
});

