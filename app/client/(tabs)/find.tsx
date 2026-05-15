import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DetailerWithDistance,
  formatDistance,
  lowestRate,
  useFindDetailers,
} from '@/hooks/useFindDetailers';
import { toTitleCase } from '@/lib/format';

const COLORS = {
  bg: '#0D1B2A',
  content: '#F5F5F5',
  card: '#FFFFFF',
  blue: '#1A3A5C',
  gold: '#C9A227',
  gray: '#B7C1CC',
  muted: '#6B7885',
  border: '#E2E8F0',
  white: '#FFFFFF',
  green: '#27AE60',
};

type ViewMode = 'map' | 'list';

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={11}
          color={COLORS.gold}
        />
      ))}
    </View>
  );
}

function DetailerCard({
  detailer,
  onPress,
  compact = false,
}: {
  detailer: DetailerWithDistance;
  onPress: () => void;
  compact?: boolean;
}) {
  const name = detailer.businessName?.trim() || detailer.fullName;
  const initials = name.slice(0, 2).toUpperCase();
  const from = lowestRate(detailer.rates ?? {});
  const topServices = (detailer.services ?? []).slice(0, 3);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, compact && styles.cardCompact, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardLeft}>
        {detailer.profilePhotoUrl ? (
          <Image source={{ uri: detailer.profilePhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        {detailer.idVerified && (
          <View style={styles.verifiedDot}>
            <Ionicons name="checkmark" size={8} color={COLORS.white} />
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.detailerName} numberOfLines={1}>
            {toTitleCase(name)}
          </Text>
          <View style={styles.badges}>
            {detailer.isFoundingPro && (
              <View style={styles.foundingBadge}>
                <Text style={styles.foundingBadgeText}>Founding Pro</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.ratingRow}>
          <StarRating rating={detailer.rating ?? 0} />
          <Text style={styles.ratingText}>
            {detailer.rating > 0
              ? `${detailer.rating.toFixed(1)} (${detailer.reviewCount ?? 0})`
              : 'New'}
          </Text>
          {detailer.distanceMi != null && (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.distanceText}>{formatDistance(detailer.distanceMi)}</Text>
            </>
          )}
        </View>

        {!compact && topServices.length > 0 && (
          <View style={styles.serviceChips}>
            {topServices.map((s) => (
              <View key={s} style={styles.chip}>
                <Text style={styles.chipText}>{toTitleCase(s)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.cardBottom}>
          {from && <Text style={styles.fromText}>From {from}</Text>}
          <View style={styles.bookBtn}>
            <Text style={styles.bookBtnText}>View Profile</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState({ locationDenied }: { locationDenied: boolean }) {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="search-circle-outline" size={52} color={COLORS.gray} />
      <Text style={styles.emptyTitle}>
        {locationDenied ? 'Location Access Needed' : 'No Detailers Found'}
      </Text>
      <Text style={styles.emptyBody}>
        {locationDenied
          ? 'Enable location access in Settings so we can find detailers near you.'
          : 'No verified detailers are active in your area yet.'}
      </Text>
    </View>
  );
}

export default function ClientFindScreen() {
  const { loading, locationDenied, error, detailers, clientLat, clientLng } = useFindDetailers();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  const selected = detailers.find((d) => d.uid === selectedId) ?? null;

  const defaultRegion: Region = {
    latitude: clientLat ?? 37.7749,
    longitude: clientLng ?? -122.4194,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  };

  function goToProfile(id: string) {
    router.push({ pathname: '/client/detailer/[id]', params: { id } });
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Find Detailers</Text>
            <View style={styles.viewToggle}>
              <Pressable
                style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
                onPress={() => setViewMode('list')}
              >
                <Ionicons name="list" size={16} color={viewMode === 'list' ? COLORS.blue : COLORS.gray} />
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
                onPress={() => setViewMode('map')}
              >
                <Ionicons name="map" size={16} color={viewMode === 'map' ? COLORS.blue : COLORS.gray} />
              </Pressable>
            </View>
          </View>
          {!loading && !locationDenied && (
            <Text style={styles.headerSub}>
              {detailers.length > 0
                ? `${detailers.length} verified detailer${detailers.length !== 1 ? 's' : ''} near you`
                : 'No detailers found nearby'}
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.gold} />
            <Text style={styles.loadingText}>Finding detailers near you…</Text>
          </View>
        ) : viewMode === 'list' ? (
          <ScrollView
            style={styles.listArea}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {detailers.length === 0 ? (
              <EmptyState locationDenied={locationDenied} />
            ) : (
              detailers.map((d) => (
                <DetailerCard
                  key={d.uid}
                  detailer={d}
                  onPress={() => goToProfile(d.uid)}
                />
              ))
            )}
          </ScrollView>
        ) : (
          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={defaultRegion}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {detailers
                .filter((d) => d.lat != null && d.lng != null)
                .map((d) => (
                  <Marker
                    key={d.uid}
                    coordinate={{ latitude: d.lat!, longitude: d.lng! }}
                    onPress={() => setSelectedId(d.uid)}
                  >
                    <View style={[styles.pin, selectedId === d.uid && styles.pinSelected]}>
                      <Text style={styles.pinText}>
                        {lowestRate(d.rates ?? {}) ?? '★'}
                      </Text>
                    </View>
                  </Marker>
                ))}
            </MapView>

            {selected && (
              <View style={styles.mapCard}>
                <DetailerCard
                  detailer={selected}
                  onPress={() => goToProfile(selected.uid)}
                  compact
                />
                <Pressable style={styles.mapCardClose} onPress={() => setSelectedId(null)}>
                  <Ionicons name="close" size={18} color={COLORS.muted} />
                </Pressable>
              </View>
            )}

            {detailers.length === 0 && (
              <View style={styles.mapEmptyOverlay}>
                <EmptyState locationDenied={locationDenied} />
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitle: { color: COLORS.white, fontSize: 26, fontWeight: '900' },
  headerSub: { color: COLORS.gray, fontSize: 13, fontWeight: '600' },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A2B3C',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  toggleBtn: { padding: 6, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: COLORS.gold },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: COLORS.gray, fontSize: 14, fontWeight: '600' },
  listArea: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  listContent: { padding: 16, paddingBottom: 30 },
  errorText: { color: '#D93025', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 20 },
  emptyTitle: { color: COLORS.blue, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: COLORS.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: 'row',
    marginBottom: 12,
  },
  cardCompact: { marginBottom: 0, borderRadius: 12 },
  cardPressed: { opacity: 0.9 },
  cardLeft: { marginRight: 12, position: 'relative' },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.blue, fontSize: 18, fontWeight: '900' },
  verifiedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  detailerName: { color: COLORS.blue, fontSize: 15, fontWeight: '800', flex: 1 },
  badges: { flexDirection: 'row', gap: 4 },
  foundingBadge: {
    backgroundColor: '#FFF3CD',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  foundingBadgeText: { color: '#856404', fontSize: 9, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  stars: { flexDirection: 'row', gap: 1 },
  ratingText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  dot: { color: COLORS.gray, fontSize: 12 },
  distanceText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  serviceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  chip: {
    backgroundColor: '#EEF2F7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { color: COLORS.blue, fontSize: 11, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fromText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  bookBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  bookBtnText: { color: COLORS.blue, fontSize: 12, fontWeight: '800' },
  mapWrap: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  pin: {
    backgroundColor: COLORS.blue,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pinSelected: { backgroundColor: COLORS.gold, borderColor: COLORS.blue },
  pinText: { color: COLORS.white, fontSize: 11, fontWeight: '900' },
  mapCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  mapCardClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
  mapEmptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(245,245,245,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
