import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';
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

import { auth, db } from '@/firebaseConfig';
import { getUserTypeFromEmailLookup, setEmailLookup } from '@/lib/emailLookup';
import { mapAuthError } from '@/lib/authErrors';

const COLORS = {
  bg: '#0D1B2A',
  card: '#1A2B3C',
  gold: '#C9A227',
  white: '#FFFFFF',
  gray: '#B7C1CC',
  borderDefault: '#2A3F5C',
  borderFocus: '#C9A227',
  borderError: '#E74C3C',
  navyText: '#0D1B2A',
};

type FieldError = {
  email?: string;
  password?: string;
  confirm?: string;
};

function isNetworkError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code?: string }).code === 'auth/network-request-failed';
  }
  return false;
}

function isEmailInUse(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code?: string }).code === 'auth/email-already-in-use';
  }
  return false;
}

export default function ClientSignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [networkBanner, setNetworkBanner] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [focusField, setFocusField] = useState<'email' | 'password' | 'confirm' | null>(null);
  const [accountConflict, setAccountConflict] = useState<'detailer' | 'client' | 'unknown' | null>(null);

  const clearField = (key: keyof FieldError) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const inputBorder = (field: 'email' | 'password' | 'confirm') => {
    if (fieldErrors[field]) return { borderColor: COLORS.borderError, borderWidth: 1.5 };
    if (focusField === field) return { borderColor: COLORS.borderFocus, borderWidth: 1.5 };
    return { borderColor: COLORS.borderDefault, borderWidth: 1 };
  };

  const onSubmit = async () => {
    setNetworkBanner(false);
    const nextErrors: FieldError = {};
    if (!email.trim()) nextErrors.email = 'Email is required.';
    if (!password) nextErrors.password = 'Password is required.';
    else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }
    if (!confirmPassword) nextErrors.confirm = 'Please confirm your password.';
    else if (password !== confirmPassword) {
      nextErrors.confirm = 'Passwords do not match';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: cred.user.email,
        userType: 'client',
        createdAt: serverTimestamp(),
        onboardingComplete: false,
      });
      await setDoc(doc(db, 'clients', uid), {
        uid,
        email: cred.user.email,
        createdAt: serverTimestamp(),
      });
      if (cred.user.email) {
        await setEmailLookup(cred.user.email, uid, 'client');
      }
      router.replace('/client/onboarding');
    } catch (e) {
      if (isNetworkError(e)) {
        setNetworkBanner(true);
        setFieldErrors({});
        return;
      }
      if (isEmailInUse(e)) {
        setFieldErrors({});
        try {
          const existing = await getUserTypeFromEmailLookup(email);
          setAccountConflict(
            existing === 'detailer' ? 'detailer' : existing === 'client' ? 'client' : 'unknown'
          );
        } catch {
          setAccountConflict('unknown');
        }
        return;
      }
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code?: string }).code === 'auth/weak-password'
      ) {
        setFieldErrors({
          password: 'Password must be at least 8 characters',
        });
        return;
      }
      const msg = mapAuthError(e);
      setFieldErrors({ email: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {networkBanner && (
            <View style={styles.networkBanner}>
              <Text style={styles.networkBannerText}>
                Connection error. Please check your internet and try again.
              </Text>
            </View>
          )}

          <View style={styles.headerRow}>
            <Text style={styles.headerBrand}>
              <Text style={styles.brandWhite}>RE</Text>
              <Text style={styles.brandGold}>VV</Text>
            </Text>
          </View>

          <Text style={styles.heroWhite}>BOOK YOUR</Text>
          <Text style={styles.heroGold}>FIRST DETAIL</Text>
          <Text style={styles.heroSub}>
            Find trusted, verified detailers near you. Your car deserves the best.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                clearField('email');
                setNetworkBanner(false);
                setAccountConflict(null);
              }}
              onFocus={() => setFocusField('email')}
              onBlur={() => setFocusField((f) => (f === 'email' ? null : f))}
              editable={!loading}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="your@email.com"
              placeholderTextColor="#7B8794"
              style={[styles.input, inputBorder('email')]}
            />
            {!!fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}

            <Text style={[styles.label, styles.labelSpaced]}>PASSWORD</Text>
            <View style={[styles.inputRow, inputBorder('password')]}>
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  clearField('password');
                  setNetworkBanner(false);
                }}
                onFocus={() => setFocusField('password')}
                onBlur={() => setFocusField((f) => (f === 'password' ? null : f))}
                editable={!loading}
                secureTextEntry={!showPassword}
                placeholder="Min. 8 characters"
                placeholderTextColor="#7B8794"
                style={styles.inputInner}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={12}
                disabled={loading}
                style={styles.eyeBtn}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={COLORS.gold} />
              </Pressable>
            </View>
            {!!fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}

            <Text style={[styles.label, styles.labelSpaced]}>CONFIRM PASSWORD</Text>
            <View style={[styles.inputRow, inputBorder('confirm')]}>
              <TextInput
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  clearField('confirm');
                  setNetworkBanner(false);
                }}
                onFocus={() => setFocusField('confirm')}
                onBlur={() => setFocusField((f) => (f === 'confirm' ? null : f))}
                editable={!loading}
                secureTextEntry={!showConfirm}
                placeholder="Min. 8 characters"
                placeholderTextColor="#7B8794"
                style={styles.inputInner}
              />
              <Pressable
                onPress={() => setShowConfirm((s) => !s)}
                hitSlop={12}
                disabled={loading}
                style={styles.eyeBtn}
              >
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={22} color={COLORS.gold} />
              </Pressable>
            </View>
            {!!fieldErrors.confirm && <Text style={styles.fieldError}>{fieldErrors.confirm}</Text>}
          </View>

          {accountConflict === 'detailer' && (
            <View style={styles.conflictCard}>
              <Text style={styles.conflictText}>
                This email is registered as a Revv Pro detailer account. Would you like to log in as a detailer
                instead?
              </Text>
              <Pressable style={styles.conflictPrimary} onPress={() => router.push('/login')}>
                <Text style={styles.conflictPrimaryText}>LOG IN AS DETAILER</Text>
              </Pressable>
              <Pressable
                style={styles.conflictSecondary}
                onPress={() => {
                  setEmail('');
                  setAccountConflict(null);
                }}
              >
                <Text style={styles.conflictSecondaryText}>USE DIFFERENT EMAIL</Text>
              </Pressable>
            </View>
          )}

          {accountConflict === 'client' && (
            <View style={styles.conflictCard}>
              <Text style={styles.conflictText}>You already have a car owner account. Log in instead?</Text>
              <Pressable style={styles.conflictPrimary} onPress={() => router.push('/login')}>
                <Text style={styles.conflictPrimaryText}>LOG IN</Text>
              </Pressable>
            </View>
          )}

          {accountConflict === 'unknown' && (
            <View style={styles.conflictCard}>
              <Text style={styles.conflictText}>This email is already in use. Log in or use a different email.</Text>
              <Pressable style={styles.conflictPrimary} onPress={() => router.push('/login')}>
                <Text style={styles.conflictPrimaryText}>LOG IN</Text>
              </Pressable>
              <Pressable
                style={styles.conflictSecondary}
                onPress={() => {
                  setEmail('');
                  setAccountConflict(null);
                }}
              >
                <Text style={styles.conflictSecondaryText}>USE DIFFERENT EMAIL</Text>
              </Pressable>
            </View>
          )}

          <Pressable style={styles.cta} onPress={onSubmit} disabled={loading || accountConflict != null}>
            {loading ? (
              <View style={styles.ctaLoading}>
                <ActivityIndicator color={COLORS.navyText} />
                <Text style={styles.ctaLoadingText}>Creating your account...</Text>
              </View>
            ) : (
              <Text style={styles.ctaText}>CREATE MY ACCOUNT</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerGray}>Already have an account? </Text>
            <Link href="/login" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Log in</Text>
              </Pressable>
            </Link>
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
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  networkBanner: {
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  networkBannerText: {
    color: COLORS.navyText,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerBrand: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  brandWhite: { color: COLORS.white },
  brandGold: { color: COLORS.gold },
  heroWhite: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.2,
  },
  heroGold: {
    color: COLORS.gold,
    fontSize: 32,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    marginBottom: 12,
  },
  heroSub: {
    color: COLORS.gray,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  label: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  labelSpaced: { marginTop: 14 },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.white,
    fontSize: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingRight: 8,
  },
  inputInner: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.white,
    fontSize: 15,
  },
  eyeBtn: { padding: 6 },
  fieldError: {
    color: COLORS.borderError,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  cta: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ctaText: {
    color: COLORS.navyText,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  ctaLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaLoadingText: {
    color: COLORS.navyText,
    fontWeight: '800',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerGray: { color: COLORS.gray, fontSize: 14 },
  footerLink: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  conflictCard: {
    borderWidth: 1.5,
    borderColor: COLORS.borderError,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    backgroundColor: '#152535',
  },
  conflictText: {
    color: COLORS.white,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
    fontWeight: '600',
  },
  conflictPrimary: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  conflictPrimaryText: {
    color: COLORS.navyText,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  conflictSecondary: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  conflictSecondaryText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '800',
  },
});
