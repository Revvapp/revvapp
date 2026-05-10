import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#0D1B2A',
  gold: '#C9A227',
  white: '#FFFFFF',
  gray: '#B7C1CC',
};

const TRACKING = 2.4;

export default function ClientWelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.headerBrand}>
            <Text style={styles.brandWhite}>RE</Text>
            <Text style={styles.brandGold}>VV</Text>
          </Text>
        </View>

        <View style={styles.center}>
          <View style={styles.goldCircle}>
            <Ionicons name="car-sport-outline" size={36} color={COLORS.gold} />
          </View>

          <Text style={styles.headline}>FIND YOUR PERFECT DETAIL</Text>

          <Text style={styles.subtitle}>
            Book trusted, verified detailers near you. Every booking comes with Revv Care damage protection.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primary} onPress={() => router.push('/client/signup')}>
            <Text style={styles.primaryText}>FIND A DETAILER</Text>
          </Pressable>

          <Pressable style={styles.secondary} onPress={() => router.push('/login')}>
            <Text style={styles.secondaryText}>I already have an account</Text>
          </Pressable>
        </View>
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
  },
  top: {
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  headerBrand: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  brandWhite: { color: COLORS.white },
  brandGold: { color: COLORS.gold },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  goldCircle: {
    width: 88,
    height: 88,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    backgroundColor: '#132231',
  },
  headline: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: TRACKING,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 16,
  },
  subtitle: {
    color: COLORS.gray,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: 340,
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
    letterSpacing: TRACKING,
  },
  secondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    color: COLORS.gray,
    fontSize: 15,
    fontWeight: '600',
  },
});
