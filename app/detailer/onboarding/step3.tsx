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

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

export default function DetailerOnboardingStep3() {
  const { state: onboarding, updateField } = useOnboarding();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 220);
    return () => clearTimeout(t);
  }, []);

  const selectedDays = onboarding.workingDays;

  const toggleDay = (index: number) => {
    const next = selectedDays.includes(index)
      ? selectedDays.filter((d) => d !== index)
      : [...selectedDays, index].sort((a, b) => a - b);
    updateField('workingDays', next);
    const daily = onboarding.incomeGoal.daily;
    if (daily > 0) {
      updateField('incomeGoal', { daily, weekly: daily * Math.max(1, next.length) });
    }
    if (error) setError('');
  };

  const validate = () => {
    if (selectedDays.length === 0) return 'Select at least one working day.';
    if (!onboarding.workingHours.from.trim() || !onboarding.workingHours.to.trim()) {
      return 'Working hours are required.';
    }
    if (!onboarding.serviceArea.trim()) return 'Service area is required.';
    if (!onboarding.maxJobsPerDay || onboarding.maxJobsPerDay < 1) {
      return 'Max jobs per day is required.';
    }
    if (!onboarding.incomeGoal.daily || onboarding.incomeGoal.daily < 1) {
      return 'Daily income goal is required.';
    }
    return '';
  };

  const onDailyGoalChange = (text: string) => {
    const n = parseInt(text.replace(/\D/g, ''), 10);
    const daily = Number.isNaN(n) ? 0 : n;
    const days = selectedDays.length || 1;
    updateField('incomeGoal', { daily, weekly: daily * days });
    if (error) setError('');
  };

  const onNext = () => {
    const nextError = validate();
    if (nextError) {
      setError(nextError);
      return;
    }
    router.push('/detailer/onboarding/step4');
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
                <Text style={styles.stepBadgeText}>Step 3 of 4</Text>
              </View>

              <View style={styles.card}>
                <ProgressBar value={0.75} />
                <View style={styles.progressMeta}>
                  <Text style={styles.progressLabel}>Your availability</Text>
                  <Text style={styles.progressPercent}>75%</Text>
                </View>

                <Text style={styles.sectionTitle}>WHEN ARE YOU AVAILABLE?</Text>

                <Text style={styles.label}>WORKING DAYS</Text>
                <View style={styles.daysRow}>
                  {DAY_LABELS.map((day, index) => {
                    const selected = selectedDays.includes(index);
                    return (
                      <Pressable
                        key={`${day}-${index}`}
                        onPress={() => toggleDay(index)}
                        style={[styles.dayCircle, selected ? styles.daySelected : styles.dayUnselected]}
                      >
                        <Text style={[styles.dayText, selected ? styles.dayTextSelected : styles.dayTextUnselected]}>
                          {day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>WORKING HOURS</Text>
                <View style={styles.hoursRow}>
                  <View style={styles.hourBox}>
                    <Text style={styles.hourLabel}>From</Text>
                    <TextInput
                      value={onboarding.workingHours.from}
                      onChangeText={(t) =>
                        updateField('workingHours', { ...onboarding.workingHours, from: t })
                      }
                      style={styles.input}
                      placeholder="8:00 AM"
                      placeholderTextColor="#8A96A3"
                    />
                  </View>
                  <View style={styles.hourBox}>
                    <Text style={styles.hourLabel}>To</Text>
                    <TextInput
                      value={onboarding.workingHours.to}
                      onChangeText={(t) =>
                        updateField('workingHours', { ...onboarding.workingHours, to: t })
                      }
                      style={styles.input}
                      placeholder="6:00 PM"
                      placeholderTextColor="#8A96A3"
                    />
                  </View>
                </View>

                <Text style={styles.label}>SERVICE AREA</Text>
                <TextInput
                  value={onboarding.serviceArea}
                  onChangeText={(t) => updateField('serviceArea', t)}
                  style={styles.input}
                  placeholder="Sacramento, CA"
                  placeholderTextColor="#8A96A3"
                />
                <Text style={styles.helper}>You&apos;ll only receive bookings within your service radius.</Text>

                <Text style={styles.label}>MAX JOBS PER DAY</Text>
                <View style={styles.maxRow}>
                  <TextInput
                    value={`${onboarding.maxJobsPerDay} jobs`}
                    onChangeText={(t) => {
                      const n = parseInt(t.replace(/\D/g, ''), 10);
                      if (!Number.isNaN(n) && n > 0) updateField('maxJobsPerDay', n);
                    }}
                    style={[styles.input, styles.maxInput]}
                    placeholder="3 jobs"
                    placeholderTextColor="#8A96A3"
                  />
                  <Pressable
                    style={styles.changeBtn}
                    onPress={() => {
                      const n = onboarding.maxJobsPerDay >= 8 ? 1 : onboarding.maxJobsPerDay + 1;
                      updateField('maxJobsPerDay', n);
                    }}
                  >
                    <Text style={styles.changeText}>Change</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>DAILY INCOME GOAL</Text>
                <View style={styles.goalRow}>
                  <Text style={styles.goalPrefix}>$</Text>
                  <TextInput
                    value={onboarding.incomeGoal.daily ? String(onboarding.incomeGoal.daily) : ''}
                    onChangeText={onDailyGoalChange}
                    style={[styles.input, styles.goalInput]}
                    placeholder="500"
                    placeholderTextColor="#8A96A3"
                    keyboardType="numeric"
                    inputMode="numeric"
                  />
                </View>
                <Text style={styles.helper}>
                  We&apos;ll track your daily earnings against this. Weekly target auto-fills to ${onboarding.incomeGoal.weekly} based on your selected days.
                </Text>

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable style={styles.nextButton} onPress={onNext}>
                  <Text style={styles.nextText}>NEXT — VERIFY YOUR ACCOUNT</Text>
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
  progressTrack: { height: 10, borderRadius: 10, backgroundColor: COLORS.track, overflow: 'hidden' },
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
    marginBottom: 12,
  },
  label: {
    color: '#1A2B3C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 6,
  },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: COLORS.darkNavyButton },
  dayUnselected: { borderWidth: 1, borderColor: '#BEC8D2', backgroundColor: '#FFFFFF' },
  dayText: { fontWeight: '800', fontSize: 13 },
  dayTextSelected: { color: COLORS.white },
  dayTextUnselected: { color: '#60707F' },
  hoursRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  hourBox: { flex: 1 },
  hourLabel: { color: COLORS.muted, fontSize: 12, marginBottom: 5, fontWeight: '700' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8DEE6',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.darkText,
    fontSize: 15,
    fontWeight: '600',
  },
  helper: { color: COLORS.muted, marginTop: 6, marginBottom: 8, fontSize: 12, lineHeight: 18 },
  maxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  maxInput: { flex: 1 },
  changeBtn: {
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  changeText: { color: '#24415E', fontSize: 13, fontWeight: '700' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goalPrefix: {
    color: COLORS.darkText,
    fontSize: 18,
    fontWeight: '900',
  },
  goalInput: { flex: 1 },
  errorText: { color: COLORS.error, fontSize: 12, fontWeight: '700', marginTop: 8 },
  nextButton: {
    marginTop: 14,
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

