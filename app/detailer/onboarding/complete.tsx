import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#0D1B2A',
  card: '#1A2B3C',
  gold: '#C9A227',
  white: '#FFFFFF',
  gray: '#B7C1CC',
};

export default function DetailerOnboardingComplete() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 220);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={COLORS.gold} />
          </View>
        ) : (
          <>
            <View style={styles.top}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={56} color={COLORS.white} />
              </View>
              <Text style={styles.title}>YOU&apos;RE A REVV PRO</Text>
              <Text style={styles.subtitle}>
                Your profile is live and clients in Sacramento can now find and book you.
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>60</Text>
                  <Text style={styles.statLabel}>DAY FREE TRIAL</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>0%</Text>
                  <Text style={styles.statLabel}>FEE TO START</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>10%</Text>
                  <Text style={styles.statLabel}>PER BOOKING</Text>
                </View>
              </View>

              <View style={styles.nextCard}>
                <Text style={styles.nextTitle}>WHAT&apos;S NEXT</Text>
                <Text style={styles.bullet}>• Share your Revv Pro link with clients</Text>
                <Text style={styles.bullet}>• Set your first income goal</Text>
                <Text style={styles.bullet}>• Connect Instagram &amp; TikTok</Text>
              </View>
            </View>

            <Pressable style={styles.cta} onPress={() => router.replace('/detailer/dashboard')}>
              <Text style={styles.ctaText}>GO TO MY DASHBOARD</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { alignItems: 'center' },
  checkCircle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  title: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.gray,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: { color: COLORS.gold, fontSize: 26, fontWeight: '900' },
  statLabel: {
    marginTop: 4,
    color: COLORS.gray,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  nextCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
  },
  nextTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bullet: {
    color: COLORS.gold,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
    fontWeight: '600',
  },
  cta: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: COLORS.bg,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
});

