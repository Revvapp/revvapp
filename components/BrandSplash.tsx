import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export function BrandSplash() {
  const iconOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0.7);
  const brandOpacity = useSharedValue(0);
  const brandY = useSharedValue(14);
  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    iconOpacity.value = withTiming(1, { duration: 500 });
    iconScale.value = withSpring(1, { damping: 16, stiffness: 200 });
    brandOpacity.value = withDelay(220, withTiming(1, { duration: 400 }));
    brandY.value = withDelay(220, withSpring(0, { damping: 22, stiffness: 280 }));
    taglineOpacity.value = withDelay(620, withTiming(1, { duration: 500 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandY.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <View style={styles.iconRing}>
          <Ionicons name="car-sport-outline" size={36} color="#C9A227" />
        </View>
      </Animated.View>

      <Animated.View style={brandStyle}>
        <Text style={styles.brand}>
          <Text style={styles.brandWhite}>RE</Text>
          <Text style={styles.brandGold}>VV</Text>
        </Text>
      </Animated.View>

      <Animated.View style={[styles.taglineWrap, taglineStyle]}>
        <View style={styles.taglineLine} />
        <Text style={styles.tagline}>YOUR DETAIL. ELEVATED.</Text>
        <View style={styles.taglineLine} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  iconWrap: {
    marginBottom: 8,
  },
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: '#C9A227',
    backgroundColor: 'rgba(201,162,39,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 6,
  },
  brandWhite: { color: '#FFFFFF' },
  brandGold:  { color: '#C9A227' },
  taglineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  taglineLine: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(201,162,39,0.4)',
  },
  tagline: {
    color: '#8A9BB0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
});
