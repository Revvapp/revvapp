import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useClientDashboard } from '@/hooks/useClientDashboard';
import { toTitleCase } from '@/lib/format';
import type { BookingDocument, VehicleDocument } from '@/types/firestore';

const COLORS = {
  bg: '#0A1628',
  content: '#F4F6F9',
  card: '#FFFFFF',
  navy: '#1A3A5C',
  gold: '#C9A227',
  goldLight: 'rgba(201,162,39,0.1)',
  goldBorder: 'rgba(201,162,39,0.3)',
  white: '#FFFFFF',
  gray: '#8A9BB0',
  muted: '#6B7A8D',
  border: '#E8EDF4',
  green: '#27AE60',
  red: '#D93025',
  darkText: '#0A1628',
  cardDark: '#1A2B3C',
};

function formatVehicleTitle(v: VehicleDocument) {
  return `${v.year} ${toTitleCase(v.make)} ${toTitleCase(v.model)}`.trim();
}

function formatLastDetailed(raw: string | null) {
  if (!raw) return 'Not detailed yet on Revv';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return `Last detailed ${raw}`;
  return `Last detailed ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function Skeleton({ h }: { h: number }) {
  return <View style={[styles.skel, { height: h }]} />;
}

export default function ClientDashboardScreen() {
  const c = useClientDashboard();

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerEyebrow}>REVV</Text>
            <Text style={styles.headerTitle}>Home</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{c.initials}</Text>
          </View>
        </View>

        {c.loading ? (
          <View style={styles.scrollArea}>
            <View style={styles.content}>
              <Skeleton h={140} />
              <Skeleton h={22} />
              <Skeleton h={90} />
              <Skeleton h={90} />
              <Skeleton h={120} />
            </View>
          </View>
        ) : (
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {!!c.error && <Text style={styles.err}>{c.error}</Text>}

            <View style={styles.welcomeCard}>
              <Text style={styles.smallGray}>Welcome Back</Text>
              <Text style={styles.userName}>{c.displayName}</Text>
              <Text style={styles.smallGray}>{c.cityLine}</Text>
              <Pressable style={styles.bookBtn}>
                <Text style={styles.bookBtnText}>BOOK A DETAIL</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>YOUR VEHICLES</Text>
              <Pressable>
                <Text style={styles.sectionAction}>+ Add</Text>
              </Pressable>
            </View>

            {c.vehicles.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconRing}>
                  <Ionicons name="car-sport-outline" size={28} color={COLORS.gold} />
                </View>
                <Text style={styles.emptyTitle}>No vehicles yet</Text>
                <Text style={styles.emptyBody}>Add your first vehicle to speed up booking.</Text>
              </View>
            ) : (
              c.vehicles.map((v) => (
                <View key={v.id} style={styles.vehicleCard}>
                  <Ionicons name="car-sport-outline" size={22} color={COLORS.navy} />
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleName}>{formatVehicleTitle(v)}</Text>
                    <Text style={styles.vehicleMeta}>{formatLastDetailed(v.lastDetailedDate)}</Text>
                  </View>
                  <Pressable style={styles.outlineBtn}>
                    <Text style={styles.outlineBtnText}>Rebook</Text>
                  </Pressable>
                </View>
              ))
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ACTIVE BOOKING</Text>
              <Pressable>
                <Text style={styles.sectionAction}>View all</Text>
              </Pressable>
            </View>

            {c.activeBookings.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconRing}>
                  <Ionicons name="calendar-outline" size={28} color={COLORS.gold} />
                </View>
                <Text style={styles.emptyTitle}>No active bookings</Text>
                <Text style={styles.emptyBody}>Book your first detail to see it here.</Text>
              </View>
            ) : (
              c.activeBookings.map((b: BookingDocument) => (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={styles.bookingStatus}>
                    <View style={styles.badge}>
                      <View style={[styles.badgeDot, { backgroundColor: '#27AE60' }]} />
                      <Text style={styles.badgeText}>Confirmed</Text>
                    </View>
                  </View>
                  <Text style={styles.bookingTitle}>{toTitleCase(b.service)}</Text>
                  <Text style={styles.bookingMeta}>
                    {b.date} · {b.time}
                  </Text>
                  <View style={styles.bookingBottom}>
                    <Text style={styles.bookingPrice}>${b.price}</Text>
                    <Pressable style={styles.outlineBtn}>
                      <Text style={styles.outlineBtnText}>Message detailer</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flex: 1 },
  headerEyebrow: { color: '#C9A227', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: 12, fontWeight: '900' },
  scrollArea: {
    flex: 1,
    backgroundColor: '#F4F6F9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  content: { padding: 18, paddingBottom: 30 },
  skel: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#E0E4EA',
    marginBottom: 12,
  },
  err: { color: '#B00020', marginBottom: 10, fontWeight: '600' },
  welcomeCard: { backgroundColor: COLORS.cardDark, borderRadius: 16, padding: 16, marginBottom: 16 },
  smallGray: { color: COLORS.gray, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  userName: { color: COLORS.white, fontSize: 26, fontWeight: '900', marginBottom: 8 },
  bookBtn: { backgroundColor: COLORS.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  bookBtnText: { color: COLORS.darkText, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 2 },
  sectionTitle: { color: '#6B7A8D', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  sectionAction: { color: COLORS.gold, fontSize: 13, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 14, paddingHorizontal: 32, marginBottom: 12 },
  emptyIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: '#1A3A5C', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: '#6B7A8D', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  vehicleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  vehicleInfo: { flex: 1, marginLeft: 10, marginRight: 10 },
  vehicleName: { color: COLORS.darkText, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  vehicleMeta: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  outlineBtn: {
    borderWidth: 1.3,
    borderColor: COLORS.navy,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  outlineBtnText: { color: COLORS.navy, fontSize: 12, fontWeight: '700' },
  bookingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  bookingStatus: { marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { color: '#6B7A8D', fontSize: 12, fontWeight: '700' },
  bookingTitle: { color: COLORS.darkText, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  bookingMeta: { color: COLORS.muted, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  bookingBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingPrice: { color: COLORS.darkText, fontSize: 20, fontWeight: '900' },
});
