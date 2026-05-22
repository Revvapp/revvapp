import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { lowestRate } from '@/hooks/useFindDetailers';
import { toTitleCase } from '@/lib/format';
import type { DetailerDocument } from '@/types/firestore';

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

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={COLORS.gold}
        />
      ))}
    </View>
  );
}

type Review = {
  id: string;
  clientName: string;
  rating: number;
  body: string;
  service: string;
  createdAt: any;
};

function ReviewCard({ review }: { review: Review }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTop}>
        <View style={styles.reviewStars}>
          {[1,2,3,4,5].map((i) => (
            <Ionicons key={i} name={i <= review.rating ? 'star' : 'star-outline'} size={12} color={COLORS.gold} />
          ))}
        </View>
        <Text style={styles.reviewService}>{review.service}</Text>
      </View>
      {!!review.body && <Text style={styles.reviewBody}>{review.body}</Text>}
      <Text style={styles.reviewAuthor}>{review.clientName || 'Verified Client'}</Text>
    </View>
  );
}

export default function DetailerPublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detailer, setDetailer] = useState<DetailerDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!id) return;
    getDocs(
      query(collection(db, 'reviews'), where('detailerId', '==', id), orderBy('createdAt', 'desc'), limit(10))
    ).then((snap) => {
      setReviews(snap.docs.map((d) => ({
        id: d.id,
        clientName: String(d.data().clientName ?? ''),
        rating: Number(d.data().rating ?? 0),
        body: String(d.data().body ?? ''),
        service: String(d.data().service ?? ''),
        createdAt: d.data().createdAt,
      })));
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, 'detailers', id),
      (snap) => {
        if (!snap.exists()) {
          setError('Detailer not found.');
        } else {
          setDetailer({ uid: snap.id, ...snap.data() } as DetailerDocument);
        }
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !detailer) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
      </SafeAreaView>
    );
  }

  const name = detailer.businessName?.trim() || detailer.fullName;
  const initials = name.slice(0, 2).toUpperCase();
  const from = lowestRate(detailer.rates ?? {});
  const workingDayLabels = (detailer.workingDays ?? [])
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(', ');

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {toTitleCase(name)}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            {detailer.profilePhotoUrl ? (
              <Image source={{ uri: detailer.profilePhotoUrl }} style={styles.heroAvatar} />
            ) : (
              <View style={styles.heroAvatarFallback}>
                <Text style={styles.heroAvatarText}>{initials}</Text>
              </View>
            )}
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName} numberOfLines={2}>
              {toTitleCase(name)}
            </Text>
            <View style={styles.heroBadges}>
              {detailer.idVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={11} color={COLORS.green} />
                  <Text style={styles.verifiedText}>Verified Pro</Text>
                </View>
              )}
              {detailer.isFoundingPro && (
                <View style={styles.foundingBadge}>
                  <Text style={styles.foundingText}>Founding Pro</Text>
                </View>
              )}
            </View>
            <View style={styles.ratingRow}>
              <StarRating rating={detailer.rating ?? 0} />
              <Text style={styles.ratingText}>
                {detailer.rating > 0
                  ? `${detailer.rating.toFixed(1)} · ${detailer.reviewCount ?? 0} reviews`
                  : 'No reviews yet'}
              </Text>
            </View>
            {from && <Text style={styles.fromText}>Starting from {from}</Text>}
          </View>
        </View>

        {!!detailer.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.bioText}>{detailer.bio}</Text>
            </View>
          </View>
        )}

        {Object.keys(detailer.rates ?? {}).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services & Pricing</Text>
            <View style={styles.sectionCard}>
              {Object.entries(detailer.rates ?? {}).map(([service, price], i, arr) => (
                <View
                  key={service}
                  style={[styles.serviceRow, i < arr.length - 1 && styles.serviceRowBorder]}
                >
                  <Text style={styles.serviceName}>{toTitleCase(service)}</Text>
                  <Text style={styles.servicePrice}>{price}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {(detailer.workingDays?.length > 0 || detailer.workingHours) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <View style={styles.sectionCard}>
              {workingDayLabels.length > 0 && (
                <View style={styles.availRow}>
                  <Ionicons name="calendar-outline" size={16} color={COLORS.gold} />
                  <Text style={styles.availText}>{workingDayLabels}</Text>
                </View>
              )}
              {detailer.workingHours && (
                <View style={styles.availRow}>
                  <Ionicons name="time-outline" size={16} color={COLORS.gold} />
                  <Text style={styles.availText}>
                    {detailer.workingHours.from} – {detailer.workingHours.to}
                  </Text>
                </View>
              )}
              {detailer.serviceArea && (
                <View style={styles.availRow}>
                  <Ionicons name="location-outline" size={16} color={COLORS.gold} />
                  <Text style={styles.availText}>{detailer.serviceArea}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {detailer.portfolioUrls?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
              {detailer.portfolioUrls.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.portfolioImg} />
              ))}
            </ScrollView>
          </View>
        )}

        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
            <View style={styles.sectionCard}>
              {reviews.map((r, i) => (
                <View key={r.id}>
                  {i > 0 && <View style={styles.serviceRowBorder} />}
                  <ReviewCard review={r} />
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bookBar}>
        <View style={styles.bookBarLeft}>
          {from && (
            <>
              <Text style={styles.bookBarFrom}>From</Text>
              <Text style={styles.bookBarPrice}>{from}</Text>
            </>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.bookNowBtn, pressed && { opacity: 0.85 }]}
          onPress={() => {
            router.push({ pathname: '/client/book/service', params: { detailerId: id } });
          }}
        >
          <Text style={styles.bookNowText}>Book Now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#D93025', fontSize: 13, fontWeight: '600', margin: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800', flex: 1 },
  scroll: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  scrollContent: { padding: 16 },
  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  heroLeft: {},
  heroAvatar: { width: 72, height: 72, borderRadius: 36 },
  heroAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: { color: COLORS.blue, fontSize: 26, fontWeight: '900' },
  heroInfo: { flex: 1 },
  heroName: { color: COLORS.blue, fontSize: 18, fontWeight: '900', marginBottom: 6 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#D4EDDA',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: { color: '#155724', fontSize: 10, fontWeight: '800' },
  foundingBadge: {
    backgroundColor: '#FFF3CD',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  foundingText: { color: '#856404', fontSize: 10, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  stars: { flexDirection: 'row', gap: 2 },
  ratingText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  fromText: { color: COLORS.gold, fontSize: 13, fontWeight: '800' },
  section: { marginBottom: 16 },
  sectionTitle: { color: COLORS.blue, fontSize: 14, fontWeight: '900', marginBottom: 8 },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  bioText: { color: COLORS.muted, fontSize: 14, lineHeight: 20, padding: 14 },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  serviceRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  serviceName: { color: COLORS.blue, fontSize: 14, fontWeight: '700' },
  servicePrice: { color: COLORS.gold, fontSize: 14, fontWeight: '800' },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  availText: { color: COLORS.blue, fontSize: 14, fontWeight: '600', flex: 1 },
  portfolioScroll: { marginHorizontal: -16 },
  portfolioImg: {
    width: 140,
    height: 100,
    borderRadius: 10,
    marginLeft: 16,
    marginBottom: 4,
  },
  bookBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
  },
  bookBarLeft: {},
  bookBarFrom: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  bookBarPrice: { color: COLORS.blue, fontSize: 22, fontWeight: '900' },
  bookNowBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  bookNowText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },

  reviewCard:    { padding: 14 },
  reviewTop:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  reviewStars:   { flexDirection: 'row', gap: 2 },
  reviewService: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewBody:    { color: COLORS.blue, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  reviewAuthor:  { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
});
