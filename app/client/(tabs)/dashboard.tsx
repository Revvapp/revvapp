import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarSilhouette } from '@/components/CarSilhouette';
import { useAuth } from '@/hooks/useAuth';
import { useClientDashboard } from '@/hooks/useClientDashboard';
import { useRegisterPushToken } from '@/hooks/useRegisterPushToken';
import { toTitleCase } from '@/lib/format';
import type { BodyType, BookingDocument } from '@/types/firestore';

const { height: SCREEN_H } = Dimensions.get('window');
const HERO_H   = Math.round(SCREEN_H * 0.62);
const SPACER_H = HERO_H - 72; // white sheet peeks 72px before any scroll

const C = {
  bg:      '#06101D',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  goldDim: 'rgba(201,162,39,0.14)',
  goldRim: 'rgba(201,162,39,0.32)',
  white:   '#FFFFFF',
  gray:    '#8A9BB0',
  muted:   '#6B7A8D',
  surface: '#FFFFFF',
  dark:    '#0A1628',
};

const STATUS: Record<string, { label: string; color: string }> = {
  pending:       { label: 'Pending',         color: '#F59E0B' },
  confirmed:     { label: 'Confirmed',       color: '#27AE60' },
  in_progress:   { label: 'In Progress',     color: '#3B82F6' },
  paused:        { label: 'Paused',          color: '#F97316' },
  vir_submitted: { label: 'Sign Inspection', color: '#8B5CF6' },
  vir_signed:    { label: 'Detail Starting', color: '#0EA5E9' },
};

function lastDetailedLabel(raw: string | null) {
  if (!raw) return 'Never detailed on Revv';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return `Last detailed ${raw}`;
  return `Last detailed ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function FloatingCar({ bodyType }: { bodyType: BodyType }) {
  const float  = useSharedValue(0);
  const shadow = useSharedValue(1);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,   { duration: 2600, easing: Easing.inOut(Easing.sin) })
      ), -1, false
    );
    shadow.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1,   { duration: 2600, easing: Easing.inOut(Easing.sin) })
      ), -1, false
    );
  }, []);

  const carStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity:   shadow.value * 0.4,
    transform: [{ scaleX: shadow.value }],
  }));

  return (
    <View style={s.silhouetteWrap}>
      <Animated.View style={carStyle}>
        <CarSilhouette bodyType={bodyType} animate={false} />
      </Animated.View>
      <Animated.View style={[s.carGlow, shadowStyle]} />
    </View>
  );
}

export default function ClientDashboardScreen() {
  const { user } = useAuth();
  const c        = useClientDashboard();
  const primary  = c.vehicles[0] ?? null;
  const insets   = useSafeAreaInsets();
  useRegisterPushToken(user?.uid, 'clients');

  useFocusEffect(useCallback(() => { c.refetch(); }, []));

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  // Hero parallax + fade
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(scrollY.value, [0, SPACER_H], [0, -SPACER_H * 0.38], Extrapolation.CLAMP),
    }],
    opacity: interpolate(scrollY.value, [0, SPACER_H * 0.65], [1, 0], Extrapolation.CLAMP),
  }));

  // Book button fades out faster as scroll starts
  const bookBtnStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 90], [1, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(scrollY.value, [0, 90], [0, -12], Extrapolation.CLAMP),
    }],
  }));

  const heroPadTop = insets.top + 74; // safe area + header height

  return (
    <View style={s.root}>

      {/* ── Layer 1: Hero — behind everything ── */}
      <Animated.View style={[s.hero, heroStyle]}>
        <View style={{ paddingTop: heroPadTop }}>

          {/* Vehicle name pill */}
          <View style={s.vehicleRow}>
            {!c.loading && (primary ? (
              <Pressable style={s.vehicleNameBtn} onPress={() => router.push('/client/garage')}>
                <Text style={s.vehicleName}>
                  {primary.year ? `${primary.year} ` : ''}
                  {toTitleCase(primary.make)} {toTitleCase(primary.model)}
                </Text>
                <Ionicons name="chevron-down" size={14} color={C.gray} />
              </Pressable>
            ) : (
              <Text style={s.vehicleEmpty}>My Garage</Text>
            ))}
          </View>

          {/* Car silhouette */}
          <View style={s.carArea}>
            {c.loading ? (
              <View style={s.carSkeleton} />
            ) : primary?.bodyType ? (
              <FloatingCar bodyType={primary.bodyType as BodyType} />
            ) : (
              <Pressable style={s.noCarPrompt} onPress={() => router.push('/client/garage')}>
                <View style={s.noCarRing}>
                  <Ionicons name="car-sport-outline" size={40} color={C.gold} />
                </View>
                <Text style={s.noCarTitle}>Add your vehicle</Text>
                <Text style={s.noCarSub}>It'll appear here</Text>
              </Pressable>
            )}
          </View>

          {/* Last detailed */}
          {!c.loading && primary && (
            <Text style={s.lastDetailedText}>{lastDetailedLabel(primary.lastDetailedDate)}</Text>
          )}

          {/* Book button fades as scroll starts */}
          <Animated.View style={[s.bookWrap, bookBtnStyle]}>
            <Pressable style={s.bookBtn} onPress={() => router.push('/client/find')}>
              <Text style={s.bookBtnText}>BOOK A DETAIL</Text>
            </Pressable>
          </Animated.View>

        </View>
      </Animated.View>

      {/* ── Layer 2: Scroll — transparent spacer then white sheet ── */}
      <Animated.ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Transparent spacer: hero shows through here */}
        <View style={{ height: SPACER_H }} />

        {/* White content sheet */}
        <View style={[s.sheet, { minHeight: SCREEN_H }]}>

          {!!c.error && <Text style={s.err}>{c.error}</Text>}

          {c.activeBookings.some((b) => ['in_progress', 'paused'].includes(b.status)) && (
            <Pressable
              style={s.liveBanner}
              onPress={() => router.push('/client/(tabs)/bookings' as any)}
            >
              <View style={s.liveDot} />
              <Text style={s.liveBannerText}>Detail in progress</Text>
              <Ionicons name="chevron-forward" size={14} color={C.gold} />
            </Pressable>
          )}

          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>UPCOMING</Text>
            <Pressable onPress={() => router.push('/client/bookings')}>
              <Text style={s.sectionLink}>View all</Text>
            </Pressable>
          </View>

          {c.loading ? (
            <>
              <View style={s.cardSkel} />
              <View style={s.cardSkel} />
            </>
          ) : c.activeBookings.length === 0 ? (
            <View style={s.emptyRow}>
              <Text style={s.emptyText}>No upcoming appointments</Text>
            </View>
          ) : (
            c.activeBookings.map((b: BookingDocument) => {
              const meta = STATUS[b.status] ?? { label: b.status, color: C.gray };
              return (
                <Pressable key={b.id} style={s.card} onPress={() => router.push('/client/bookings')}>
                  <View style={s.cardTop}>
                    <View style={[s.statusPill, { backgroundColor: `${meta.color}18` }]}>
                      <View style={[s.statusDot, { backgroundColor: meta.color }]} />
                      <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text style={s.price}>${b.price}</Text>
                  </View>
                  <Text style={s.service}>{toTitleCase(b.service)}</Text>
                  <Text style={s.datetime}>{b.date} · {b.time}</Text>
                  <View style={s.cardActions}>
                    <Pressable
                      style={s.msgBtn}
                      onPress={() => router.push(`/client/conversation/${b.id}`)}
                      hitSlop={8}
                    >
                      <Ionicons name="chatbubble-outline" size={13} color={C.navy} />
                      <Text style={s.msgText}>Message</Text>
                    </Pressable>
                    <View style={s.cardChevron}>
                      <Text style={s.cardChevronText}>Details</Text>
                      <Ionicons name="chevron-forward" size={13} color={C.gold} />
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </Animated.ScrollView>

      {/* ── Layer 3: Header — always on top ── */}
      <View style={[StyleSheet.absoluteFillObject, s.headerOverlay]} pointerEvents="box-none">
        <View style={[s.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View pointerEvents="none">
            <Text style={s.wordmark}>REVV</Text>
            <Text style={s.headerTitle}>Home</Text>
          </View>
          <View style={s.headerRight} pointerEvents="box-none">
            {__DEV__ && (
              <Pressable style={s.devBtn} onPress={() => router.push('/client/dev-tools')}>
                <Ionicons name="construct-outline" size={18} color={C.gold} />
              </Pressable>
            )}
            <Pressable style={s.avatar} onPress={() => router.push('/client/profile')}>
              <Text style={s.avatarText}>{c.initials}</Text>
            </Pressable>
          </View>
        </View>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Hero ──
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_H,
    backgroundColor: C.bg,
  },
  vehicleRow: {
    paddingHorizontal: 28,
    marginBottom: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  vehicleNameBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  vehicleName:    { color: C.white, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  vehicleEmpty:   { color: C.gray,  fontSize: 18, fontWeight: '600' },

  carArea: { height: 280, justifyContent: 'center', alignItems: 'center' },
  carSkeleton: { width: '80%', height: 200, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  silhouetteWrap: { alignItems: 'center', justifyContent: 'center', height: 280 },
  carGlow: {
    width: 260,
    height: 14,
    borderRadius: 100,
    backgroundColor: 'rgba(201,162,39,0.18)',
    alignSelf: 'center',
    marginTop: -8,
  },
  noCarPrompt: { alignItems: 'center', gap: 12 },
  noCarRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.goldDim, borderWidth: 1.5, borderColor: C.goldRim,
    alignItems: 'center', justifyContent: 'center',
  },
  noCarTitle: { color: C.white, fontSize: 16, fontWeight: '700' },
  noCarSub:   { color: C.gray,  fontSize: 13, fontWeight: '500' },

  lastDetailedText: {
    color: C.gray, fontSize: 12, fontWeight: '500', letterSpacing: 0.2,
    textAlign: 'center', marginBottom: 18,
  },

  bookWrap: { paddingHorizontal: 24 },
  bookBtn:  { backgroundColor: C.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  bookBtnText: { color: C.dark, fontSize: 13, fontWeight: '900', letterSpacing: 2 },

  // ── Scroll ──
  scroll: { flex: 1 },

  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 28,
  },

  // ── Header overlay ──
  headerOverlay: { justifyContent: 'flex-start' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  wordmark:    { color: C.gold, fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 2 },
  headerTitle: { color: C.white, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  devBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.navy, borderWidth: 1.5, borderColor: C.goldRim,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: C.gold, fontSize: 11, fontWeight: '900' },

  // ── Content ──
  err: { color: '#B00020', fontWeight: '600', marginBottom: 12 },

  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionLabel: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  sectionLink:  { color: C.gold,  fontSize: 13, fontWeight: '700' },

  cardSkel:  { height: 110, borderRadius: 16, backgroundColor: '#F0F2F5', marginBottom: 10 },
  emptyRow:  { paddingVertical: 36, alignItems: 'center' },
  emptyText: { color: C.muted, fontSize: 14, fontWeight: '500' },

  card: {
    backgroundColor: C.surface, borderRadius: 18, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2,
  },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  price:      { color: C.dark, fontSize: 22, fontWeight: '900' },
  service:    { color: C.dark, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  datetime:   { color: C.muted, fontSize: 12, fontWeight: '500', marginBottom: 14 },
  cardActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#F0F2F5', paddingTop: 12,
  },
  msgBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5 },
  msgText:         { color: C.navy, fontSize: 13, fontWeight: '600' },
  cardChevron:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardChevronText: { color: C.gold, fontSize: 13, fontWeight: '700' },

  liveBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12,
  },
  liveDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
  liveBannerText: { color: C.navy, fontSize: 14, fontWeight: '700', flex: 1 },
});
