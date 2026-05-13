import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  gray: '#B7C1CC',
  darkText: '#0D1B2A',
  darkNavyButton: '#1A3A5C',
  track: '#D3D8DE',
  error: '#D32F2F',
};

const TRACKING = 2.2;

function ProgressBar({ value }: { value: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.max(0, Math.min(1, value)),
      duration: 450,
      useNativeDriver: false,
    }).start();
  }, [value, widthAnim]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width }]} />
    </View>
  );
}

export default function DetailerOnboardingStep1() {
  const { state: onboarding, updateField } = useOnboarding();
  const [loading, setLoading] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 220);
    return () => clearTimeout(t);
  }, []);

  const percent = 25;
  const progress = 0.25;

  const normalizedState = useMemo(() => onboarding.state.trim().toUpperCase(), [onboarding.state]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!onboarding.fullName.trim()) next.fullName = 'Full name is required.';
    if (!onboarding.phone.trim()) next.phone = 'Phone number is required.';
    if (!onboarding.city.trim()) next.city = 'City is required.';
    if (!normalizedState) next.stateCode = 'State is required.';
    if (normalizedState && normalizedState.length !== 2) next.stateCode = 'Use 2-letter state code.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onNext = () => {
    if (!validate()) return;
    updateField('state', normalizedState);
    router.push('/detailer/onboarding/step2');
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
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.badgeRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>Step 1 of 4</Text>
                </View>
              </View>

              <View style={styles.card}>
                <ProgressBar value={progress} />
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>Basic info</Text>
                  <Text style={styles.progressPercent}>{percent}%</Text>
                </View>

                <Text style={styles.cardTitle}>TELL US ABOUT YOU</Text>
                <Text style={styles.cardSubtitle}>
                  This helps clients trust your profile and helps Revv route bookings to you.
                </Text>

                <View style={styles.field}>
                  <Text style={styles.label}>
                    FULL NAME <Text style={styles.asterisk}>*</Text>
                  </Text>
                  <TextInput
                    value={onboarding.fullName}
                    onChangeText={(t) => {
                      updateField('fullName', t);
                      if (errors.fullName) setErrors((e) => ({ ...e, fullName: '' }));
                    }}
                    placeholder="Marcus Roberts"
                    placeholderTextColor="#7B8794"
                    style={[styles.input, !!errors.fullName && styles.inputError]}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                  {!!errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>BUSINESS NAME</Text>
                  <TextInput
                    value={onboarding.businessName}
                    onChangeText={(t) => updateField('businessName', t)}
                    placeholder="Elite Auto Detailing (optional)"
                    placeholderTextColor="#7B8794"
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                  <Text style={styles.fieldHint}>
                    This is what clients see when browsing detailers.
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>
                    PHONE NUMBER <Text style={styles.asterisk}>*</Text>
                  </Text>
                  <TextInput
                    value={onboarding.phone}
                    onChangeText={(t) => {
                      updateField('phone', t);
                      if (errors.phone) setErrors((e) => ({ ...e, phone: '' }));
                    }}
                    placeholder="(916) 555-0199"
                    placeholderTextColor="#7B8794"
                    style={[styles.input, !!errors.phone && styles.inputError]}
                    keyboardType="phone-pad"
                    returnKeyType="next"
                  />
                  {!!errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
                </View>

                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>
                      CITY <Text style={styles.asterisk}>*</Text>
                    </Text>
                    <TextInput
                      value={onboarding.city}
                      onChangeText={(t) => {
                        updateField('city', t);
                        if (errors.city) setErrors((e) => ({ ...e, city: '' }));
                      }}
                      placeholder="Sacramento"
                      placeholderTextColor="#7B8794"
                      style={[styles.input, !!errors.city && styles.inputError]}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                    {!!errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>
                      STATE <Text style={styles.asterisk}>*</Text>
                    </Text>
                    <TextInput
                      value={onboarding.state}
                      onChangeText={(t) => {
                        updateField('state', t);
                        if (errors.stateCode) setErrors((e) => ({ ...e, stateCode: '' }));
                      }}
                      placeholder="CA"
                      placeholderTextColor="#7B8794"
                      style={[styles.input, !!errors.stateCode && styles.inputError]}
                      autoCapitalize="characters"
                      maxLength={2}
                      returnKeyType="next"
                    />
                    {!!errors.stateCode && <Text style={styles.errorText}>{errors.stateCode}</Text>}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>BIO</Text>
                  <TextInput
                    value={onboarding.bio}
                    onChangeText={(t) => updateField('bio', t)}
                    placeholder="Tell clients what you specialize in."
                    placeholderTextColor="#7B8794"
                    style={[styles.input, styles.textArea]}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <Pressable style={styles.nextButton} onPress={onNext}>
                  <Text style={styles.nextText}>NEXT — SERVICES &amp; PRICING</Text>
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
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: COLORS.bg,
  },
  headerBrand: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2.6,
  },
  brandWhite: { color: COLORS.white },
  brandGold: { color: COLORS.gold },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 22,
  },
  badgeRow: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gold,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepBadgeText: {
    color: COLORS.bg,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 18,
    padding: 16,
  },
  progressTrack: {
    height: 10,
    borderRadius: 10,
    backgroundColor: COLORS.track,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 10,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  progressLabel: {
    color: '#3B4B5C',
    fontSize: 13,
    fontWeight: '700',
  },
  progressPercent: {
    color: '#3B4B5C',
    fontSize: 13,
    fontWeight: '800',
  },
  cardTitle: {
    color: COLORS.darkText,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: TRACKING,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#556575',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  field: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  half: { flex: 1 },
  label: {
    color: '#1A2B3C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  asterisk: {
    color: COLORS.gold,
    fontWeight: '900',
  },
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
  textArea: {
    height: 110,
    paddingTop: 12,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    marginTop: 6,
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
  },
  fieldHint: {
    marginTop: 5,
    color: '#7B8794',
    fontSize: 12,
    fontWeight: '500',
  },
  nextButton: {
    marginTop: 10,
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

