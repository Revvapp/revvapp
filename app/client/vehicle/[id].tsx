import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarSilhouette } from '@/components/CarSilhouette';
import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { toTitleCase } from '@/lib/format';
import type { BodyType } from '@/types/firestore';

const C = {
  bg:      '#0A1628',
  surface: '#F5F7FA',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  goldDim: 'rgba(201,162,39,0.1)',
  goldRing:'rgba(201,162,39,0.3)',
  gray:    '#8A9BB0',
  muted:   '#6B7A8D',
  border:  '#E8EDF4',
  white:   '#FFFFFF',
  green:   '#27AE60',
};

type Vehicle = {
  year: string;
  make: string;
  model: string;
  color: string;
  licensePlate: string;
  bodyType: BodyType;
  lastDetailedDate: string | null;
};

type HistoryRow = {
  id: string;
  service: string;
  price: number;
  date: string;
  detailerId: string;
  detailerLabel: string;
  afterPhoto: string | null;
};

function parseDate(dateStr: string): Date | null {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
}

function fmtFullDate(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function relTime(dateStr: string | null): string {
  if (!dateStr) return 'Never detailed';
  const then = parseDate(dateStr);
  if (!then) return dateStr;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) { const mo = Math.round(days / 30); return `${mo} month${mo !== 1 ? 's' : ''} ago`; }
  const yr = Math.round(days / 365);
  return `${yr} year${yr !== 1 ? 's' : ''} ago`;
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function VehicleHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleMissing, setVehicleMissing] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !id) { setLoading(false); return; }
    const unsubVehicle = onSnapshot(doc(db, 'clients', user.uid, 'vehicles', id), (snap) => {
      if (!snap.exists()) { setVehicleMissing(true); return; }
      const v = snap.data();
      setVehicle({
        year: String(v.year ?? ''),
        make: String(v.make ?? ''),
        model: String(v.model ?? ''),
        color: String(v.color ?? ''),
        licensePlate: String(v.licensePlate ?? ''),
        bodyType: (v.bodyType as BodyType) ?? 'sedan',
        lastDetailedDate: v.lastDetailedDate != null ? String(v.lastDetailedDate) : null,
      });
    }, (e) => {
      if (__DEV__) console.warn('[vehicle listener]', e.message);
    });

    // Equality-only query — no composite index required. Completed jobs are
    // filtered and sorted client-side.
    const q = query(
      collection(db, 'bookings'),
      where('clientId', '==', user.uid),
      where('vehicleId', '==', id),
    );
    const unsubBookings = onSnapshot(q, (snap) => {
      const rows: HistoryRow[] = snap.docs
        .filter((d) => String(d.data().status ?? '').toLowerCase() === 'completed')
        .map((d) => {
          const x = d.data();
          const after = Array.isArray(x.afterPhotos) ? x.afterPhotos.filter(Boolean) : [];
          return {
            id: d.id,
            service: String(x.service ?? ''),
            price: Number(x.price ?? 0),
            date: String(x.date ?? ''),
            detailerId: String(x.detailerId ?? ''),
            detailerLabel: toTitleCase(String(x.businessName || x.detailerName || 'Your Detailer')),
            afterPhoto: after.length > 0 ? String(after[0]) : null,
          };
        });
      rows.sort((a, b) => b.date.localeCompare(a.date));
      setHistory(rows);
      setLoading(false);
    }, (e) => {
      if (__DEV__) console.warn('[vehicle history listener]', e.message);
      setLoading(false);
    });

    return () => { unsubVehicle(); unsubBookings(); };
  }, [user?.uid, id]);

  const totalSpent = useMemo(() => history.reduce((s, r) => s + r.price, 0), [history]);
  // Prefer the stored field, but fall back to the most recent completed job.
  const lastDetailed = vehicle?.lastDetailedDate ?? (history[0]?.date ?? null);

  const label = vehicle
    ? `${vehicle.year} ${toTitleCase(vehicle.make)} ${toTitleCase(vehicle.model)}`.trim()
    : 'Vehicle';
  const subParts = vehicle
    ? [vehicle.color && toTitleCase(vehicle.color), vehicle.licensePlate].filter(Boolean)
    : [];

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>REVV</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>Service History</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      {vehicleMissing ? (
        <View style={styles.content}>
          <View style={styles.centered}>
            <Ionicons name="car-outline" size={36} color={C.muted} />
            <Text style={styles.emptyTitle}>Vehicle not found</Text>
            <Text style={styles.emptyBody}>It may have been removed from your garage.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
              <Text style={styles.primaryBtnText}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      ) : loading ? (
        <View style={styles.content}>
          <View style={styles.centered}>
            <ActivityIndicator color={C.gold} />
          </View>
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(300)} style={styles.content}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.heroSilhouette}>
                <CarSilhouette bodyType={vehicle?.bodyType ?? 'sedan'} animate={false} />
              </View>
              <Text style={styles.heroLabel}>{label}</Text>
              {subParts.length > 0 && (
                <Text style={styles.heroSub}>{subParts.join('  ·  ')}</Text>
              )}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{history.length}</Text>
                <Text style={styles.statLabel}>Detail{history.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{fmtMoney(totalSpent)}</Text>
                <Text style={styles.statLabel}>Invested</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, styles.statValueSm]}>{relTime(lastDetailed)}</Text>
                <Text style={styles.statLabel}>Last Detail</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Detail History</Text>

            {history.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyRing}>
                  <Ionicons name="sparkles-outline" size={24} color={C.gold} />
                </View>
                <Text style={styles.emptyTitle}>No details yet</Text>
                <Text style={styles.emptyBody}>
                  Once this vehicle is detailed on Revv, every job shows up here.
                </Text>
              </View>
            ) : (
              history.map((row, i) => (
                <Animated.View key={row.id} entering={FadeInDown.delay(i * 50).springify()}>
                  <View style={styles.historyCard}>
                    <View style={styles.historyTop}>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyDate}>{fmtFullDate(row.date)}</Text>
                        <Text style={styles.historyService}>{toTitleCase(row.service)}</Text>
                        <Text style={styles.historyDetailer}>with {row.detailerLabel}</Text>
                      </View>
                      {row.afterPhoto ? (
                        <Image source={{ uri: row.afterPhoto }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <View style={styles.thumbFallback}>
                          <Ionicons name="sparkles" size={18} color={C.gold} />
                        </View>
                      )}
                    </View>
                    <View style={styles.historyBottom}>
                      <Text style={styles.historyPrice}>{fmtMoney(row.price)}</Text>
                      <View style={styles.historyActions}>
                        <Pressable
                          style={styles.linkBtn}
                          onPress={() => router.push({ pathname: '/client/invoice/[id]', params: { id: row.id } })}
                        >
                          <Ionicons name="receipt-outline" size={13} color={C.muted} />
                          <Text style={styles.linkBtnText}>Receipt</Text>
                        </Pressable>
                        {!!row.detailerId && (
                          <Pressable
                            style={styles.rebookBtn}
                            onPress={() => router.push({ pathname: '/client/book/service', params: { detailerId: row.detailerId } })}
                          >
                            <Ionicons name="refresh" size={13} color={C.navy} />
                            <Text style={styles.rebookBtnText}>Book again</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ))
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Bottom CTA */}
          <View style={styles.footer}>
            <Pressable style={styles.bookBtn} onPress={() => router.push('/client/find')}>
              <Ionicons name="search" size={16} color={C.navy} />
              <Text style={styles.bookBtnText}>Book a Detail</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  eyebrow: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 1 },
  headerTitle: { color: C.white, fontSize: 20, fontWeight: '900' },

  content: {
    flex: 1,
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  scroll: { padding: 18, paddingBottom: 24 },

  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  heroSilhouette: {
    height: 108,
    width: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroLabel: { color: C.navy, fontSize: 20, fontWeight: '900', letterSpacing: -0.4, textAlign: 'center' },
  heroSub: { color: C.muted, fontSize: 13, fontWeight: '600', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 22 },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: { color: C.navy, fontSize: 19, fontWeight: '900' },
  statValueSm: { fontSize: 13 },
  statLabel: { color: C.muted, fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' },

  sectionTitle: { color: C.navy, fontSize: 15, fontWeight: '800', marginBottom: 12 },

  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.goldDim,
    borderWidth: 1,
    borderColor: C.goldRing,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: { color: C.navy, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },

  historyCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
  },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  historyInfo: { flex: 1 },
  historyDate: { color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  historyService: { color: C.navy, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  historyDetailer: { color: C.muted, fontSize: 13, fontWeight: '600' },
  thumb: { width: 54, height: 54, borderRadius: 12, backgroundColor: C.border },
  thumbFallback: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: C.goldDim,
    borderWidth: 1,
    borderColor: C.goldRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  historyPrice: { color: C.navy, fontSize: 18, fontWeight: '900' },
  historyActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10 },
  linkBtnText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  rebookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.goldDim,
    borderWidth: 1,
    borderColor: C.goldRing,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  rebookBtnText: { color: C.navy, fontSize: 13, fontWeight: '800' },

  footer: {
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 15,
  },
  bookBtnText: { color: C.navy, fontSize: 15, fontWeight: '900' },

  primaryBtn: {
    marginTop: 8,
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  primaryBtnText: { color: C.navy, fontSize: 14, fontWeight: '900' },
});
