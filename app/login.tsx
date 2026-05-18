import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useState } from 'react';
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

import { auth } from '@/firebaseConfig';

const COLORS = {
  bg: '#0D1B2A',
  card: '#1A2B3C',
  gold: '#C9A227',
  white: '#FFFFFF',
  gray: '#B7C1CC',
  borderDefault: '#2A4A6B',
  borderFocus: '#C9A227',
  borderError: '#E74C3C',
  navyText: '#0D1B2A',
  ringBg: '#132231',
};

function isNetworkError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code?: string }).code === 'auth/network-request-failed';
  }
  return false;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [networkBanner, setNetworkBanner] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [focusField, setFocusField] = useState<'email' | 'password' | null>(null);

  const inputBorder = (field: 'email' | 'password') => {
    if (field === 'email' && emailError) return { borderColor: COLORS.borderError, borderWidth: 1.5 };
    if (field === 'password' && passwordError) return { borderColor: COLORS.borderError, borderWidth: 1.5 };
    if (focusField === field) return { borderColor: COLORS.borderFocus, borderWidth: 1.5 };
    return { borderColor: COLORS.borderDefault, borderWidth: 1 };
  };

  const handleLogin = async () => {
    setNetworkBanner(false);
    setEmailError('');
    setPasswordError('');
    if (!email.trim() || !password) {
      if (!email.trim()) setEmailError('Email is required.');
      if (!password) setPasswordError('Password is required.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (isNetworkError(e)) {
        setNetworkBanner(true);
        return;
      }
      if (code === 'auth/invalid-email') {
        setEmailError('Enter a valid email address.');
      } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setEmailError('__NO_ACCOUNT__');
      } else if (code === 'auth/wrong-password') {
        setPasswordError('Incorrect password. Try again.');
      } else {
        setPasswordError('Incorrect email or password. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    setNetworkBanner(false);
    setEmailError('');
    setPasswordError('');
    if (!email.trim()) {
      setEmailError('Enter your email address first, then tap Forgot password.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setEmailError('');
      setPasswordError('');
      Alert.alert('Check your inbox', 'We sent a link to reset your password.');
    } catch (e) {
      if (isNetworkError(e)) {
        setNetworkBanner(true);
        return;
      }
      setEmailError('Could not send reset email. Check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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

          <View style={styles.heroCenter}>
            <View style={styles.goldCircle}>
              <Ionicons name="car-sport-outline" size={32} color={COLORS.gold} />
            </View>
            <Text style={styles.headerBrand}>
              <Text style={styles.brandWhite}>RE</Text>
              <Text style={styles.brandGold}>VV</Text>
            </Text>
            <Text style={styles.welcomeTitle}>WELCOME BACK</Text>
            <Text style={styles.welcomeSub}>Sign in to your Revv account</Text>
          </View>

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setEmailError('');
              setNetworkBanner(false);
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
          {!!emailError &&
            (emailError === '__NO_ACCOUNT__' ? (
              <View style={styles.noAccountBlock}>
                <Text style={styles.fieldError}>No account found with this email.</Text>
                <Pressable onPress={() => router.push('/onboarding')} hitSlop={8}>
                  <Text style={styles.inlineGold}>Sign up instead?</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.fieldError}>{emailError}</Text>
            ))}

          <Text style={[styles.label, styles.labelSpaced]}>PASSWORD</Text>
          <View style={[styles.inputRow, inputBorder('password')]}>
            <TextInput
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setPasswordError('');
                setNetworkBanner(false);
              }}
              onFocus={() => setFocusField('password')}
              onBlur={() => setFocusField((f) => (f === 'password' ? null : f))}
              editable={!loading}
              secureTextEntry={!showPassword}
              placeholder="Your password"
              placeholderTextColor="#7B8794"
              style={styles.inputInner}
            />
            <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={12} disabled={loading} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={COLORS.gold} />
            </Pressable>
          </View>
          {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}

          <View style={styles.forgotRow}>
            <Pressable onPress={onForgotPassword} disabled={loading} hitSlop={8}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>

          <Pressable style={styles.cta} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <View style={styles.ctaLoading}>
                <ActivityIndicator color={COLORS.navyText} />
                <Text style={styles.ctaLoadingText}>Signing in...</Text>
              </View>
            ) : (
              <Text style={styles.ctaText}>SIGN IN TO REVV</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}> or </Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.outlineBtn}
            onPress={() => router.push('/detailer/onboarding/welcome')}
            disabled={loading}
          >
            <Text style={styles.outlineBtnText}>Continue as Detailer</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => router.push('/client/welcome')} disabled={loading}>
            <Text style={styles.outlineBtnText}>Continue as Car Owner</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerGray}>Don&apos;t have an account? </Text>
            <Pressable onPress={() => router.push('/onboarding')} hitSlop={8}>
              <Text style={styles.footerGold}>Sign up</Text>
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
    paddingBottom: 36,
    paddingTop: 12,
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
  heroCenter: {
    alignItems: 'center',
    marginBottom: 28,
  },
  goldCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.ringBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerBrand: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginBottom: 14,
  },
  brandWhite: { color: COLORS.white },
  brandGold: { color: COLORS.gold },
  welcomeTitle: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  welcomeSub: {
    color: COLORS.gray,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
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
    paddingHorizontal: 16,
    height: 54,
    color: COLORS.white,
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    height: 54,
    paddingRight: 8,
  },
  inputInner: {
    flex: 1,
    paddingHorizontal: 16,
    color: COLORS.white,
    fontSize: 16,
  },
  eyeBtn: { padding: 6 },
  noAccountBlock: {
    marginTop: 6,
  },
  fieldError: {
    color: COLORS.borderError,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  inlineGold: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
    marginTop: 6,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: 10,
    marginBottom: 8,
  },
  forgotText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  cta: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: {
    color: COLORS.navyText,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A4A6B',
  },
  dividerText: {
    color: COLORS.gray,
    fontSize: 13,
    paddingHorizontal: 10,
    fontWeight: '600',
  },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  outlineBtnText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerGray: { color: COLORS.gray, fontSize: 14 },
  footerGold: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
  },
});
