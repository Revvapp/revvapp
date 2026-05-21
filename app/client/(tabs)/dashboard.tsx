import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarSilhouette } from '@/components/CarSilhouette';
import { useClientDashboard } from '@/hooks/useClientDashboard';
import { toTitleCase } from '@/lib/format';
import type { BodyType, BookingDocument } from '@/types/firestore';

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
  pending:     { label: 'Pending',     color: '#F59E0B' },
  confirmed:   { label: 'Confirmed',   color: '#27AE60' },
  in_progress: { label: 'In Progress', color: '#3B82F6' },
  paused:      { label: 'Paused',      color: '#F97316' },
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
    opacity:   shadow.value * 0.45,
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
  const c       = useClientDashboard();
  const primary = c.vehicles[0] ?? null;

  return (
    <SafeAreaView edges={['top']} style={s.safe}>

      {/* ── Dark hero ── */}
      <View style={s.dark}>

        <Animated.View entering={FadeIn.duration(300)} style={s.header}>
          <View>
            <Text style={s.wordmark}>REVV</Text>
            <Text style={s.headerTitle}>Home</Text>
          </View>
          <Pressable style={s.avatar} onPress={() => router.push('/client/profile')}>
            <Text style={s.avatarText}>{c.initials}</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(340)} style={s.vehicleRow}>
          {c.loading ? (
            <View style={s.nameSkel} />
          ) : primary ? (
            <Pressable style={s.vehicleNameBtn} onPress={() => router.push('/client/garage')}>
              <Text style={s.vehicleName}>
                {primary.year ? `${primary.year} ` : ''}
                {toTitleCase(primary.make)} {toTitleCase(primary.model)}
              </Text>
              <Ionicons name="chevron-down" size={14} color={C.gray} />
            </Pressable>
          ) : (
            <Text style={s.vehicleEmpty}>My Garage</Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeIn.delay(120).duration(500)} style={s.carArea}>
          {c.loading ? (
            <View style={s.carSkeleton} />
          ) : primary?.bodyType ? (
            <FloatingCar bodyType={primary.bodyType as BodyType} />
          ) : (
            <Pressable style={s.noCarPrompt} onPress={() => router.push('/client/garage')}>
              <View style={s.noCarRing}>
                <Ionicons name="car-sport-outline" size={36} color={C.gold} />
              </View>
              <Text style={s.noCarTitle}>Add your vehicle</Text>
              <Text style={s.noCarSub}>It'll appear here</Text>
            </Pressable>
          )}
        </Animated.View>

        {!c.loading && primary && (
          <Animated.View entering={FadeInUp.delay(220).duration(340)} style={s.lastDetailedRow}>
            <Text style={s.lastDetailedText}>{lastDetailedLabel(primary.lastDetailedDate)}</Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(280).duration(340)} style={s.bookWrap}>
          <Pressable style={s.bookBtn} onPress={() => router.push('/client/find')}>
            <Text style={s.bookBtnText}>BOOK A DETAIL</Text>
          </Pressable>
        </Animated.View>

      </View>

      {/* ── Light scroll ── */}
      <ScrollView
        style={s.light}
        contentContainerStyle={s.lightInner}
        showsVerticalScrollIndicator={false}
      >
        {!!c.error && <Text style={s.err}>{c.error}</Text>}

        <Animated.View entering={FadeInDown.delay(320).duration(340)} style={s.sectionRow}>
          <Text style={s.sectionLabel}>UPCOMING</Text>
          <Pressable onPress={() => router.push('/client/bookings')}>
            <Text style={s.sectionLink}>View all</Text>
          </Pressable>
        </Animated.View>

        {c.loading ? (
          <>
            <View style={s.cardSkel} />
            <View style={s.cardSkel} />
          </>
        ) : c.activeBookings.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(360).duration(340)} style={s.emptyRow}>
            <Text style={s.emptyText}>No upcoming appointments</Text>
          </Animated.View>
        ) : (
          c.activeBookings.map((b: BookingDocument, i) => {
            const meta = STATUS[b.status] ?? { label: b.status, color: C.gray };
            return (
              <Animated.View key={b.id} entering={FadeInDown.delay(360 + i * 70).duration(340)}>
                <Pressable style={s.card} onPress={() => router.push('/client/bookings')}>
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
              </Animated.View>
            );
          })
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  dark: { backgroundColor: C.bg, paddingBottom: 22 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 18,
  },
  wordmark:    { color: C.gold, fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 2 },
  headerTitle: { color: C.white, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.navy,
    borderWidth: 1.5,
    borderColor: C.goldRim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.gold, fontSize: 11, fontWeight: '900' },

  vehicleRow: { paddingHorizontal: 24, marginBottom: 4 },
  nameSkel: { height: 22, width: 180, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.07)' },
  vehicleNameBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  vehicleName:  { color: C.white, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  vehicleEmpty: { color: C.gray,  fontSize: 18, fontWeight: '600' },

  carArea: { height: 240, justifyContent: 'center', alignItems: 'center' },
  carSkeleton: { width: '80%', height: 180, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  silhouetteWrap: { alignItems: 'center', justifyContent: 'center', height: 240 },
  carGlow: {
    width: 200,
    height: 12,
    borderRadius: 100,
    backgroundColor: 'rgba(201,162,39,0.2)',
    alignSelf: 'center',
    marginTop: -4,
  },
  noCarPrompt: { alignItems: 'center', gap: 12 },
  noCarRing: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: C.goldDim, borderWidth: 1.5, borderColor: C.goldRim,
    alignItems: 'center', justifyContent: 'center',
  },
  noCarTitle: { color: C.white, fontSize: 16, fontWeight: '700' },
  noCarSub:   { color: C.gray,  fontSize: 13, fontWeight: '500' },

  lastDetailedRow:  { alignItems: 'center', marginBottom: 18 },
  lastDetailedText: { color: C.gray, fontSize: 12, fontWeight: '500', letterSpacing: 0.2 },

  bookWrap: { paddingHorizontal: 20 },
  bookBtn:  { backgroundColor: C.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  bookBtnText: { color: C.dark, fontSize: 13, fontWeight: '900', letterSpacing: 2 },

  light:      { flex: 1, backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  lightInner: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 48 },

  err: { color: '#B00020', fontWeight: '600', marginBottom: 12 },

  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionLabel: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  sectionLink:  { color: C.gold,  fontSize: 13, fontWeight: '700' },

  cardSkel: { height: 110, borderRadius: 16, backgroundColor: '#F0F2F5', marginBottom: 10 },
  emptyRow: { paddingVertical: 36, alignItems: 'center' },
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
});
