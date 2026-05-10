import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';

const COLORS = {
  bg: '#0D1B2A',
  cardLight: '#F5F5F5',
  gold: '#C9A227',
  white: '#FFFFFF',
  darkText: '#0D1B2A',
  muted: '#556575',
  track: '#D3D8DE',
  darkNavyButton: '#1A3A5C',
  green: '#27AE60',
  badgeGray: '#D9DEE5',
  error: '#D32F2F',
};

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

type Item = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  badge: 'Done' | 'Required' | 'Optional';
};

const ITEMS: Item[] = [
  { icon: 'checkmark-circle', title: 'Phone number', subtitle: 'Verified via SMS code', badge: 'Done' },
  { icon: 'checkmark-circle', title: 'Email address', subtitle: 'Verified via confirmation link', badge: 'Done' },
  { icon: 'document-text', title: 'Government ID', subtitle: 'Upload a valid photo ID', badge: 'Required' },
  { icon: 'person', title: 'Profile photo', subtitle: 'A clear photo of your face', badge: 'Required' },
  { icon: 'star', title: 'Work portfolio', subtitle: 'Upload 3+ before/after photos', badge: 'Optional' },
];

export default function DetailerOnboardingStep4() {
  const { saveToFirebase } = useOnboarding();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 220);
    return () => clearTimeout(t);
  }, []);

  const onComplete = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await saveToFirebase();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await refreshProfile();
      router.push('/detailer/onboarding/complete');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete setup.');
    } finally {
      setSaving(false);
    }
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

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={COLORS.gold} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>Step 4 of 4</Text>
            </View>

            <View style={styles.card}>
              <ProgressBar value={0.9} />
              <View style={styles.progressMeta}>
                <Text style={styles.progressLabel}>Verification</Text>
                <Text style={styles.progressPercent}>90%</Text>
              </View>

              <Text style={styles.title}>BUILD CLIENT TRUST</Text>
              <Text style={styles.subtitle}>
                Verified detailers get 3x more bookings. Complete these to earn your Revv Pro badge.
              </Text>

              <View style={styles.uploadRow}>
                <View style={styles.placeholderBox}>
                  <Text style={styles.placeholderText}>Photo upload coming soon</Text>
                </View>
                <View style={styles.placeholderBoxSecondary}>
                  <Text style={styles.placeholderTextSecondary}>Photo upload coming soon</Text>
                </View>
              </View>

              <View style={styles.list}>
                {ITEMS.map((item) => {
                  const done = item.badge === 'Done';
                  return (
                    <View key={item.title} style={styles.item}>
                      <View style={styles.iconWrap}>
                        <Ionicons name={item.icon} size={18} color={done ? COLORS.green : COLORS.darkNavyButton} />
                      </View>
                      <View style={styles.itemText}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          item.badge === 'Done'
                            ? styles.badgeDone
                            : item.badge === 'Required'
                              ? styles.badgeRequired
                              : styles.badgeOptional,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            item.badge === 'Done' ? styles.badgeTextDone : styles.badgeTextOther,
                          ]}
                        >
                          {item.badge}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable style={styles.completeBtn} onPress={onComplete} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.completeText}>COMPLETE SETUP</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
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
  progressMeta: { marginTop: 10, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: '#3B4B5C', fontSize: 13, fontWeight: '700' },
  progressPercent: { color: '#3B4B5C', fontSize: 13, fontWeight: '800' },
  title: {
    color: COLORS.darkText,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  uploadRow: { gap: 10, marginBottom: 12 },
  placeholderBox: {
    backgroundColor: '#EEF2F7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#C5CED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderBoxSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: COLORS.darkNavyButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: COLORS.darkNavyButton,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  placeholderTextSecondary: {
    color: COLORS.muted,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  list: { gap: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE2EA',
    borderRadius: 12,
    padding: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemText: { flex: 1 },
  itemTitle: { color: '#15222F', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  itemSubtitle: { color: COLORS.muted, fontSize: 12, lineHeight: 16 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDone: { backgroundColor: '#DDF4E7' },
  badgeRequired: { backgroundColor: '#F4E3AD' },
  badgeOptional: { backgroundColor: COLORS.badgeGray },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextDone: { color: COLORS.green },
  badgeTextOther: { color: '#344657' },
  errorText: { color: COLORS.error, fontSize: 13, fontWeight: '600', marginTop: 8 },
  completeBtn: {
    marginTop: 16,
    backgroundColor: COLORS.darkNavyButton,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  completeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
});
