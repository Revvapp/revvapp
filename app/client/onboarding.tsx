import { router } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { useAuth } from '@/hooks/useAuth';
import { auth, db } from '@/firebaseConfig';

const COLORS = {
  bg: '#0D1B2A',
  card: '#1A2B3C',
  gold: '#C9A227',
  white: '#FFFFFF',
  gray: '#B7C1CC',
  error: '#E57373',
  borderDefault: '#2A3F5C',
  borderError: '#E74C3C',
  navyText: '#0D1B2A',
};

type FieldErrors = {
  fullName?: string;
  phone?: string;
  city?: string;
  stateCode?: string;
};

export default function ClientOnboardingScreen() {
  const { refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');

  const normalizedState = useMemo(() => stateCode.trim().toUpperCase(), [stateCode]);

  const onContinue = async () => {
    const next: FieldErrors = {};
    if (!fullName.trim()) next.fullName = 'Full name is required.';
    if (!phone.trim()) next.phone = 'Phone number is required.';
    if (!city.trim()) next.city = 'City is required.';
    if (!normalizedState) next.stateCode = 'State is required.';
    else if (normalizedState.length !== 2) next.stateCode = 'Use 2-letter state code.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setSubmitError('You must be signed in.');
      return;
    }

    setLoading(true);
    setSubmitError('');
    try {
      await setDoc(
        doc(db, 'clients', uid),
        {
          uid,
          fullName: fullName.trim(),
          phone: phone.trim(),
          city: city.trim(),
          state: normalizedState,
        },
        { merge: true }
      );
      await setDoc(
        doc(db, 'users', uid),
        { onboardingComplete: true },
        { merge: true }
      );
      await refreshProfile();
      router.replace('/client/dashboard');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not save your details.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (err?: string) => [
    styles.input,
    err ? styles.inputError : null,
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.brand}>
            <Text style={styles.brandWhite}>RE</Text>
            <Text style={styles.brandGold}>VV</Text>
          </Text>

          <View style={styles.card}>
            <Text style={styles.title}>TELL US ABOUT YOU</Text>
            <Text style={styles.body}>
              We use these details to personalize your home screen and connect you with detailers near you.
            </Text>

            <Text style={styles.label}>
              FULL NAME <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              value={fullName}
              onChangeText={(t) => {
                setFullName(t);
                if (errors.fullName) setErrors((e) => ({ ...e, fullName: undefined }));
              }}
              placeholder="Jordan Lee"
              placeholderTextColor="#7B8794"
              autoCapitalize="words"
              editable={!loading}
              style={inputStyle(errors.fullName)}
            />
            {!!errors.fullName && <Text style={styles.fieldError}>{errors.fullName}</Text>}

            <Text style={[styles.label, styles.labelSpaced]}>
              PHONE NUMBER <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
              }}
              placeholder="(555) 123-4567"
              placeholderTextColor="#7B8794"
              keyboardType="phone-pad"
              editable={!loading}
              style={inputStyle(errors.phone)}
            />
            {!!errors.phone && <Text style={styles.fieldError}>{errors.phone}</Text>}

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={[styles.label, styles.labelSpaced]}>
                  CITY <Text style={styles.asterisk}>*</Text>
                </Text>
                <TextInput
                  value={city}
                  onChangeText={(t) => {
                    setCity(t);
                    if (errors.city) setErrors((e) => ({ ...e, city: undefined }));
                  }}
                  placeholder="Your city"
                  placeholderTextColor="#7B8794"
                  autoCapitalize="words"
                  editable={!loading}
                  style={inputStyle(errors.city)}
                />
                {!!errors.city && <Text style={styles.fieldError}>{errors.city}</Text>}
              </View>
              <View style={styles.half}>
                <Text style={[styles.label, styles.labelSpaced]}>
                  STATE <Text style={styles.asterisk}>*</Text>
                </Text>
                <TextInput
                  value={stateCode}
                  onChangeText={(t) => {
                    setStateCode(t);
                    if (errors.stateCode) setErrors((e) => ({ ...e, stateCode: undefined }));
                  }}
                  placeholder="CA"
                  placeholderTextColor="#7B8794"
                  autoCapitalize="characters"
                  maxLength={2}
                  editable={!loading}
                  style={inputStyle(errors.stateCode)}
                />
                {!!errors.stateCode && <Text style={styles.fieldError}>{errors.stateCode}</Text>}
              </View>
            </View>

            {!!submitError && <Text style={styles.submitError}>{submitError}</Text>}

            <Pressable style={styles.btn} onPress={onContinue} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={COLORS.navyText} />
              ) : (
                <Text style={styles.btnText}>CONTINUE TO HOME</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 32,
  },
  brand: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 24,
  },
  brandWhite: { color: COLORS.white },
  brandGold: { color: COLORS.gold },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2C3F52',
  },
  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  body: {
    color: COLORS.gray,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  label: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  labelSpaced: { marginTop: 14 },
  asterisk: { color: COLORS.gold },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.white,
    fontSize: 15,
  },
  inputError: {
    borderColor: COLORS.borderError,
    borderWidth: 1.5,
  },
  fieldError: {
    color: COLORS.borderError,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  submitError: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
  },
  btn: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  btnText: {
    color: COLORS.navyText,
    fontWeight: '900',
    letterSpacing: 1.2,
    fontSize: 13,
  },
});
