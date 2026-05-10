import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#0D1B2A',
  gold: '#C9A227',
  white: '#FFFFFF',
  gray: '#B7C1CC',
};

const TRACKING_WIDE = 2.4;

export default function DetailerOnboardingWelcome() {
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 220);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={COLORS.gold} />
          </View>
        ) : (
          <>
            <View style={styles.center}>
              <Animated.View style={[styles.logoOuter, { transform: [{ scale: pulse }] }]}>
                <View style={styles.logoInnerRing} />
              </Animated.View>

              <Text style={styles.brand}>
                <Text style={styles.brandWhite}>RE</Text>
                <Text style={styles.brandGold}>VV</Text>
              </Text>

              <Text style={styles.tagline}>WHERE YOUR RIDE GETS ITS SHINE</Text>

              <Text style={styles.headline}>RUN YOUR DETAILING BUSINESS LIKE A PRO</Text>

              <Text style={styles.subtitle}>
                Bookings, invoices, income tracking, and social marketing — all in one app.
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable style={styles.primary} onPress={() => router.push('/detailer/onboarding/signup')}>
                <Text style={styles.primaryText}>JOIN AS A REVV PRO</Text>
              </Pressable>

              <Pressable style={styles.secondary} onPress={() => router.push('/login')}>
                <Text style={styles.secondaryText}>I already have an account</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 22,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  logoOuter: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.gold,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    marginBottom: 18,
  },
  logoInnerRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: COLORS.bg,
    opacity: 0.9,
  },
  brand: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 3.4,
    marginBottom: 14,
  },
  brandWhite: {
    color: COLORS.white,
  },
  brandGold: {
    color: COLORS.gold,
  },
  tagline: {
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: TRACKING_WIDE,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  headline: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  subtitle: {
    color: COLORS.gray,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  actions: {
    gap: 12,
  },
  primary: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: {
    color: COLORS.bg,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.2,
    borderColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
