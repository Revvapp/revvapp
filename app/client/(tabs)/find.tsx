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
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DetailerWithDistance,
  formatDistance,
  lowestRate,
  useFindDetailers,
} from '@/hooks/useFindDetailers';
import { toTitleCase } from '@/lib/format';

const C = {
  bg:         '#0A1628',
  content:    '#F4F6F9',
  card:       '#FFFFFF',
  navy:       '#1A3A5C',
  navyLight:  '#1E3A5C',
  gold:       '#C9A227',
  goldLight:  'rgba(201,162,39,0.1)',
  goldBorder: 'rgba(201,162,39,0.4)',
  white:      '#FFFFFF',
  gray:       '#8A9BB0',
  muted:      '#6B7A8D',
  border:     '#E2E8F2',
  green:      '#27AE60',
  text:       '#1A2B3C',
};

type ViewMode = 'list' | 'map';

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={11}
          color={C.gold}
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
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const name = detailer.businessName?.trim() || detailer.fullName;
  const initials = name.slice(0, 2).toUpperCase();
  const from = lowestRate(detailer.rates ?? {});
  const topServices = (detailer.services ?? []).slice(0, 3);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
    >
    <Animated.View style={[styles.card, compact && styles.cardCompact, animStyle]}>
      <View style={styles.cardRow}>
        <View style={styles.avatarWrap}>
          {detailer.profilePhotoUrl ? (
            <Image source={{ uri: detailer.profilePhotoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {detailer.idVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={8} color={C.white} />
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <Text style={styles.detailerName} numberOfLines={1}>
              {toTitleCase(name)}
            </Text>
            {from && (
              <View style={styles.pricePill}>
                <Text style={styles.priceText}>from {from}</Text>
              </View>
            )}
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
                <View style={styles.ratingDot} />
                <Ionicons name="location-outline" size={11} color={C.muted} />
                <Text style={styles.distanceText}>{formatDistance(detailer.distanceMi)}</Text>
              </>
            )}
          </View>

          {!compact && topServices.length > 0 && (
            <View style={styles.chips}>
              {topServices.map((s) => (
                <View key={s} style={styles.chip}>
                  <Text style={styles.chipText}>{toTitleCase(s)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {!compact && (
        <View style={styles.cardFooter}>
          <View style={styles.footerDivider} />
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>View Profile</Text>
            <Ionicons name="arrow-forward" size={13} color={C.white} />
          </View>
        </View>
      )}
    </Animated.View>
    </Pressable>
  );
}

function EmptyState({ locationDenied }: { locationDenied: boolean }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconRing}>
        <Ionicons name="search-outline" size={28} color={C.gold} />
      </View>
      <Text style={styles.emptyTitle}>
        {locationDenied ? 'Location Access Needed' : 'No Detailers Found'}
      </Text>
      <Text style={styles.emptyBody}>
        {locationDenied
          ? 'Enable location in Settings so we can find detailers near you.'
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

      {/* Dark header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerEyebrow}>REVV</Text>
            <Text style={styles.headerTitle}>Find Detailers</Text>
          </View>
          <View style={styles.togglePill}>
            <Pressable
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list" size={15} color={viewMode === 'list' ? C.navy : C.gray} />
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons name="map" size={15} color={viewMode === 'map' ? C.navy : C.gray} />
            </Pressable>
          </View>
        </View>

        {!loading && !locationDenied && (
          <View style={styles.headerMeta}>
            <View style={styles.metaDot} />
            <Text style={styles.headerSub}>
              {detailers.length > 0
                ? `${detailers.length} verified detailer${detailers.length !== 1 ? 's' : ''} near you`
                : 'No detailers found nearby'}
            </Text>
          </View>
        )}
      </View>

      {/* Light content area */}
      <Animated.View entering={FadeIn.duration(350)} style={styles.contentArea}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={C.gold} />
            <Text style={styles.loadingText}>Finding detailers near you…</Text>
          </View>
        ) : viewMode === 'list' ? (
          <ScrollView
            style={styles.listArea}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {!!error && (
              <View style={styles.errorBanner}>
                <Ionicons name="warning-outline" size={15} color="#E57373" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {detailers.length === 0 ? (
              <EmptyState locationDenied={locationDenied} />
            ) : (
              detailers.map((d, index) => (
                <Animated.View key={d.uid} entering={FadeInDown.delay(index * 60).springify()}>
                  <DetailerCard detailer={d} onPress={() => goToProfile(d.uid)} />
                </Animated.View>
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
                      <Text style={[styles.pinText, selectedId === d.uid && styles.pinTextSelected]}>
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
                  <Ionicons name="close" size={16} color={C.muted} />
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
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: C.bg,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerEyebrow: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 2,
  },
  headerTitle: {
    color: C.white,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  togglePill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    width: 36,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: C.gold,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },
  headerSub: {
    color: C.gray,
    fontSize: 13,
    fontWeight: '600',
  },

  contentArea: {
    flex: 1,
    backgroundColor: C.content,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
  },

  listArea:    { flex: 1 },
  listContent: { padding: 16, paddingBottom: 36, gap: 12 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(229,115,115,0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,115,115,0.25)',
  },
  errorText: { color: '#E57373', fontSize: 13, fontWeight: '600', flex: 1 },

  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.goldLight,
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },

  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    overflow: 'hidden',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardCompact: { borderRadius: 14 },

  cardRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: C.goldBorder,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.navy,
    borderWidth: 2,
    borderColor: C.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.gold, fontSize: 18, fontWeight: '900' },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: C.green,
    borderWidth: 2,
    borderColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardBody:  { flex: 1, justifyContent: 'center', gap: 5 },
  nameRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  detailerName: { color: C.text, fontSize: 15, fontWeight: '800', flex: 1 },

  pricePill: {
    backgroundColor: C.goldLight,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  priceText: { color: C.gold, fontSize: 11, fontWeight: '800' },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stars:     { flexDirection: 'row', gap: 1 },
  ratingText:   { color: C.muted, fontSize: 11, fontWeight: '600' },
  ratingDot:    { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.gray, marginHorizontal: 2 },
  distanceText: { color: C.muted, fontSize: 11, fontWeight: '600' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip:  {
    backgroundColor: '#EEF2F7',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipText: { color: C.navy, fontSize: 10, fontWeight: '700' },

  cardFooter:   { paddingHorizontal: 14, paddingBottom: 14 },
  footerDivider: { height: 1, backgroundColor: '#F0F3F8', marginBottom: 12 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.navy,
    borderRadius: 10,
    paddingVertical: 10,
  },
  viewBtnText: { color: C.white, fontSize: 13, fontWeight: '800' },

  mapWrap: { flex: 1, position: 'relative' },
  map:     { flex: 1 },

  pin: {
    backgroundColor: C.white,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: C.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pinSelected:      { backgroundColor: C.gold, borderColor: C.navy },
  pinText:          { color: C.navy, fontSize: 11, fontWeight: '900' },
  pinTextSelected:  { color: C.white },

  mapCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  mapCardClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F0F3F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapEmptyOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(244,246,249,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
