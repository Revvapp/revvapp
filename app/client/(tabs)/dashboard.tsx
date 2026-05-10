import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useClientDashboard } from '@/hooks/useClientDashboard';
import type { BookingDocument, VehicleDocument } from '@/types/firestore';

const COLORS = {
  bg: '#0D1B2A',
  bgDeep: '#0D1B2A',
  cardDark: '#1A2B3C',
  cardLight: '#FFFFFF',
  gold: '#C9A227',
  white: '#FFFFFF',
  gray: '#B7C1CC',
  darkText: '#0D1B2A',
  green: '#27AE60',
  mutedDark: '#6B7885',
  avatarBlue: '#1A3A5C',
};

function formatVehicleTitle(v: VehicleDocument) {
  return `${v.year} ${v.make} ${v.model}`.trim();
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
          <View style={styles.brandRow}>
            <Text style={styles.headerBrand}>
              <Text style={styles.brandWhite}>RE</Text>
              <Text style={styles.brandGold}>VV</Text>
            </Text>
            <View style={styles.statusDot} />
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
              <Text style={styles.smallGray}>Welcome back</Text>
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
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No vehicles yet</Text>
                <Text style={styles.emptyBody}>+ Add your first vehicle to speed up booking.</Text>
              </View>
            ) : (
              c.vehicles.map((v) => (
                <View key={v.id} style={styles.vehicleCard}>
                  <Ionicons name="car-sport-outline" size={22} color={COLORS.avatarBlue} />
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
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No active bookings</Text>
                <Text style={styles.emptyBody}>Book your first detail to see it here.</Text>
              </View>
            ) : (
              c.activeBookings.map((b: BookingDocument) => (
                <View key={b.id} style={styles.bookingCard}>
                  <View style={styles.bookingStatus}>
                    <View style={styles.greenDot} />
                    <Text style={styles.bookingStatusText}>Confirmed</Text>
                  </View>
                  <Text style={styles.bookingTitle}>{b.service}</Text>
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
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBrand: { fontSize: 23, fontWeight: '900', letterSpacing: 2.6 },
  brandWhite: { color: COLORS.white },
  brandGold: { color: COLORS.gold },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold, marginTop: 2 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.avatarBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: 12, fontWeight: '900' },
  scrollArea: { flex: 1, backgroundColor: '#F5F5F5', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
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
  bookBtnText: { color: COLORS.bgDeep, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 2 },
  sectionTitle: { color: '#1D2B39', fontSize: 13, fontWeight: '900', letterSpacing: 1.3 },
  sectionAction: { color: COLORS.gold, fontSize: 13, fontWeight: '800' },
  emptyCard: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  emptyTitle: { color: COLORS.darkText, fontWeight: '800', marginBottom: 4 },
  emptyBody: { color: COLORS.mutedDark, fontSize: 13, lineHeight: 18 },
  vehicleCard: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  vehicleInfo: { flex: 1, marginLeft: 10, marginRight: 10 },
  vehicleName: { color: COLORS.darkText, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  vehicleMeta: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '600' },
  outlineBtn: {
    borderWidth: 1.3,
    borderColor: COLORS.avatarBlue,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  outlineBtnText: { color: COLORS.avatarBlue, fontSize: 12, fontWeight: '700' },
  bookingCard: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  bookingStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green },
  bookingStatusText: { color: COLORS.green, fontSize: 12, fontWeight: '800' },
  bookingTitle: { color: COLORS.darkText, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  bookingMeta: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  bookingBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingPrice: { color: COLORS.darkText, fontSize: 20, fontWeight: '900' },
});
