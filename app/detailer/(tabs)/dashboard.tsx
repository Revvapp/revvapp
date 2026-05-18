import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDetailerDashboard } from '@/hooks/useDetailerDashboard';

const COLORS = {
  bg: '#0D1B2A',
  darkCard: '#1A2B3C',
  lightContent: '#F5F5F5',
  gold: '#C9A227',
  white: '#FFFFFF',
  gray: '#B7C1CC',
  darkText: '#0D1B2A',
  progressTrack: '#9AA5B1',
};

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function SkeletonBlock({ style }: { style?: object }) {
  return <View style={[styles.skeleton, style]} />;
}

export default function DetailerDashboardScreen() {
  const d = useDetailerDashboard();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: d.progressFraction,
      duration: 550,
      useNativeDriver: false,
    }).start();
  }, [d.progressFraction, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await d.refetch();
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.refetch]);

  function goalFooterText(): string {
    if (d.emptyToday) return 'No Jobs Today Yet';
    if (d.goalReached) return 'Daily Goal Completed';
    return `${fmt(d.awayFromGoal)} Away From Today's Target`;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerBrand}>
            <Text style={styles.brandWhite}>RE</Text>
            <Text style={styles.brandGold}>VV</Text>
          </Text>
          <View style={styles.headerRight}>
            {__DEV__ && (
              <Pressable style={styles.devBtn} onPress={() => router.push('/detailer/dev-tools')}>
                <Text style={styles.devBtnText}>DEV</Text>
              </Pressable>
            )}
            <View style={styles.notificationWrap}>
              <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
              <View style={styles.notificationDot} />
            </View>
            <Pressable style={styles.headerAvatar} onPress={() => router.push('/detailer/profile')}>
              {d.profilePhotoUrl ? (
                <Image source={{ uri: d.profilePhotoUrl }} style={styles.headerAvatarImage} />
              ) : (
                <Text style={styles.headerAvatarText}>{d.initials}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {d.loading ? (
          <View style={styles.contentArea}>
            <View style={styles.content}>
              <SkeletonBlock style={{ height: 120, borderRadius: 16, marginBottom: 14 }} />
              <SkeletonBlock style={{ height: 200, borderRadius: 16, marginBottom: 14 }} />
              <View style={styles.grid}>
                <SkeletonBlock style={{ width: '48%', height: 108, borderRadius: 14 }} />
                <SkeletonBlock style={{ width: '48%', height: 108, borderRadius: 14 }} />
                <SkeletonBlock style={{ width: '48%', height: 108, borderRadius: 14 }} />
                <SkeletonBlock style={{ width: '48%', height: 108, borderRadius: 14 }} />
              </View>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.contentArea}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.gold}
                colors={[COLORS.gold]}
              />
            }
          >
            {!!d.error && <Text style={styles.bannerError}>{d.error}</Text>}

            <View style={styles.welcomeCard}>
              <Text style={styles.smallLabel}>
                {d.firstName ? `${d.greeting}, ${d.firstName}` : d.greeting}
              </Text>
              <Text
                style={styles.welcomeName}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {d.displayName}
              </Text>
              <Text style={styles.dateText}>{d.todayLabel}</Text>
              <View style={styles.cardAvatar}>
                {d.profilePhotoUrl ? (
                  <Image source={{ uri: d.profilePhotoUrl }} style={styles.cardAvatarImage} />
                ) : (
                  <Text style={styles.cardAvatarText}>{d.initials}</Text>
                )}
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.goalCard, pressed && styles.goalCardPressed]}
              onPress={() => router.navigate('/detailer/jobs')}
            >
              <View style={styles.goalTopRow}>
                <Text style={styles.smallLabel}>Today&apos;s Income</Text>
                <Pressable style={styles.editGoalBtn}>
                  <Text style={styles.editGoalText}>
                    {d.dailyGoal > 0 ? 'Edit Goal' : 'Set Your First Goal'}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.goalAmount}>{fmt(d.todayEarnings)}</Text>
              <Text style={styles.goalSub}>
                {d.dailyGoal > 0 ? `Daily Goal: ${fmt(d.dailyGoal)}` : 'No Daily Goal Set'}
              </Text>
              <View style={styles.goalScaleRow}>
                <Text style={styles.scaleText}>$0</Text>
                <Text style={styles.scaleText}>
                  {d.dailyGoal > 0 ? fmt(d.dailyGoal) : '—'}
                </Text>
              </View>
              <View style={styles.goalTrack}>
                <Animated.View style={[styles.goalFill, { width: progressWidth }]} />
              </View>
              <View style={styles.goalFooter}>
                <Text style={styles.goalFooterLeft}>{goalFooterText()}</Text>
                <Text style={[styles.goalFooterRight, d.goalReached && styles.goalFooterReached]}>
                  {d.progressPercentLabel}
                </Text>
              </View>
              <View style={styles.viewJobsRow}>
                <Text style={styles.viewJobsText}>View Today&apos;s Jobs</Text>
                <Ionicons name="chevron-forward" size={13} color={COLORS.gold} />
              </View>
            </Pressable>

            <View style={styles.grid}>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>THIS WEEK</Text>
                <Text style={styles.statValue}>{fmt(d.weekEarnings)}</Text>
                <Text style={styles.statMuted}>Completed Job Payouts (Calendar Week)</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>THIS MONTH</Text>
                <Text style={styles.statValue}>{fmt(d.monthEarnings)}</Text>
                <Text style={styles.statMuted}>Completed Job Payouts (Calendar Month)</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>JOBS TODAY</Text>
                <Text style={styles.statValue}>{d.jobsTodayTotal}</Text>
                <Text style={styles.statMuted}>
                  {d.emptyToday
                    ? 'No Jobs Today Yet'
                    : `${d.jobsTodayDone} Done · ${d.jobsTodayLeft} Left`}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>AVG PER JOB</Text>
                <Text style={styles.statValue}>
                  {d.avgPerJob != null ? fmt(Math.round(d.avgPerJob)) : '—'}
                </Text>
                <Text style={styles.statMuted}>
                  {d.avgPerJob != null
                    ? 'Based On Completed Jobs This Week'
                    : 'No Completed Jobs This Week'}
                </Text>
              </View>
            </View>
          </ScrollView>
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
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBrand: {
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 2.6,
  },
  brandWhite: { color: COLORS.white },
  brandGold: { color: COLORS.gold },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  notificationWrap: { position: 'relative' },
  notificationDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: { width: '100%', height: '100%' },
  headerAvatarText: { color: COLORS.white, fontWeight: '900', fontSize: 12 },
  bannerError: {
    color: '#F8BBD0',
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
    backgroundColor: COLORS.lightContent,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  skeleton: {
    backgroundColor: '#E0E4EA',
    width: '100%',
  },
  welcomeCard: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    position: 'relative',
  },
  smallLabel: { color: COLORS.gray, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  welcomeName: { color: COLORS.white, fontSize: 24, fontWeight: '900', marginBottom: 4, paddingRight: 66 },
  businessNameText: { color: COLORS.gold, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  dateText: { color: COLORS.gray, fontSize: 12, fontWeight: '600' },
  cardAvatar: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardAvatarImage: { width: '100%', height: '100%' },
  cardAvatarText: { color: COLORS.white, fontWeight: '900', fontSize: 15 },
  goalCard: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  goalCardPressed: {
    opacity: 0.85,
  },
  viewJobsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 3,
  },
  viewJobsText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  goalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editGoalBtn: {
    borderWidth: 1,
    borderColor: '#4E6275',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  editGoalText: { color: COLORS.gray, fontSize: 11, fontWeight: '700' },
  goalAmount: {
    color: COLORS.gold,
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 48,
    marginBottom: 2,
  },
  goalSub: { color: COLORS.gray, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  goalScaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  scaleText: { color: COLORS.gray, fontSize: 11, fontWeight: '700' },
  goalTrack: {
    height: 10,
    borderRadius: 10,
    backgroundColor: COLORS.progressTrack,
    overflow: 'hidden',
    marginBottom: 8,
  },
  goalFill: { height: '100%', borderRadius: 10, backgroundColor: COLORS.gold },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalFooterLeft: { color: COLORS.gray, fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  goalFooterRight: { color: COLORS.gold, fontSize: 13, fontWeight: '900' },
  goalFooterReached: { color: '#4CAF50' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 108,
  },
  statTitle: { color: '#5A6978', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  statValue: { color: COLORS.darkText, fontSize: 27, fontWeight: '900', marginBottom: 4 },
  statMuted: { color: '#6B7885', fontSize: 12, fontWeight: '600' },
  devBtn: {
    backgroundColor: '#C0392B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  devBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});
