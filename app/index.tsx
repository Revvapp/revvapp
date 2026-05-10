import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

const COLORS = {
  background: '#0D1B2A',
  card: '#1A2B3C',
  gold: '#C9A227',
  white: '#FFFFFF',
  lightGray: '#B7C1CC',
};

const LETTER_SPACING_WIDE = 2.4;

export default function WelcomeScreen() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.07,
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

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        <Animated.View style={[styles.logoRing, { transform: [{ scale: pulse }] }]} />
        <Text style={styles.brand}>
          <Text style={styles.brandWhite}>RE</Text>
          <Text style={styles.brandGold}>VV</Text>
        </Text>
        <Text style={styles.tagline}>WHERE YOUR RIDE GETS ITS SHINE</Text>
      </View>

      <View style={styles.bottomActions}>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/onboarding')}>
          <Text style={styles.primaryButtonText}>GET STARTED</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.secondaryButtonText}>Already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
  },
  logoRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    marginBottom: 22,
  },
  brand: {
    fontSize: 50,
    fontWeight: '900',
    letterSpacing: 3.2,
    marginBottom: 18,
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
    letterSpacing: LETTER_SPACING_WIDE,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 14,
    lineHeight: 20,
  },
  bottomActions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: LETTER_SPACING_WIDE,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: COLORS.white,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '500',
  },
});
