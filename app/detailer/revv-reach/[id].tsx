import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { toTitleCase } from '@/lib/format';

const C = {
  bg:      '#0D1B2A',
  card:    '#142030',
  card2:   '#1A2B3C',
  gold:    '#C9A227',
  white:   '#FFFFFF',
  gray:    '#8FA3B1',
  muted:   '#5A7080',
  border:  '#243548',
  green:   '#27AE60',
  purple:  '#9B59B6',
};

type Style = 'professional' | 'casual' | 'hype';

const STYLES: { key: Style; label: string; icon: string }[] = [
  { key: 'professional', label: 'Pro',   icon: 'briefcase-outline' },
  { key: 'casual',       label: 'Casual', icon: 'chatbubble-outline' },
  { key: 'hype',         label: 'Hype',   icon: 'flame-outline' },
];

function buildCaption(style: Style, service: string, vehicle: string): string {
  const s = toTitleCase(service);
  const v = vehicle;
  switch (style) {
    case 'professional':
      return `Just delivered an immaculate ${s} on a ${v}. Every panel, every detail — nothing missed. This is the standard.\n\n#CarDetailing #DetailLife #AutoDetailing #REVV`;
    case 'casual':
      return `This ${v} came in needing some love and left looking brand new 🔥 ${s} done right. Who's next?\n\n#Detailing #CarCare #REVV #DetailLife`;
    case 'hype':
      return `NO SHORTCUTS. NO EXCUSES. ⚡\n\n${s.toUpperCase()} on a ${v}. That's how we move.\n\nBook your detail → link in bio\n\n#CarDetailing #REVV #BestDetailer #DetailLife`;
  }
}

type ReachData = {
  service: string;
  vehicleLabel: string;
  afterPhotos: string[];
  shared?: boolean;
};

export default function RevvReachScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ReachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [captionStyle, setCaptionStyle] = useState<Style>('professional');
  const [caption, setCaption] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const captionRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const invSnap = await getDoc(doc(db, 'invoices', id));
      if (!invSnap.exists()) { setLoading(false); return; }
      const d = invSnap.data();
      const rd: ReachData = {
        service:      String(d.service ?? ''),
        vehicleLabel: String(d.vehicleLabel ?? ''),
        afterPhotos:  Array.isArray(d.afterPhotos) ? d.afterPhotos : [],
        shared:       Boolean(d.reachShared),
      };
      setData(rd);
      setShared(Boolean(d.reachShared));
      setCaption(buildCaption('professional', rd.service, rd.vehicleLabel));
      setLoading(false);
    })();
  }, [id]);

  function onStyleChange(s: Style) {
    setCaptionStyle(s);
    if (data) setCaption(buildCaption(s, data.service, data.vehicleLabel));
  }

  async function handleShare() {
    setSharing(true);
    try {
      const result = await Share.share({ message: caption });
      if (result.action === Share.sharedAction) {
        setShared(true);
        if (id) {
          await updateDoc(doc(db, 'invoices', id), { reachShared: true });
        }
      }
    } catch {
      Alert.alert('Error', 'Could not open share sheet.');
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={C.gold} /></View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="megaphone-outline" size={40} color={C.muted} />
          <Text style={styles.errorText}>Content not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasPhotos = data.afterPhotos.length > 0;
  const featuredUri = hasPhotos ? data.afterPhotos[Math.min(featuredIdx, data.afterPhotos.length - 1)] : null;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.gray} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerBrand}>
            <Text style={styles.headerRe}>RE</Text>
            <Text style={styles.headerVV}>VV</Text>
            <Text style={styles.headerReach}> Reach</Text>
          </Text>
        </View>
        {shared ? (
          <View style={styles.sharedBadge}>
            <Ionicons name="checkmark" size={12} color={C.green} />
            <Text style={styles.sharedBadgeText}>Shared</Text>
          </View>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero block */}
        <View style={styles.hero}>
          <View style={styles.megaphoneRing}>
            <View style={styles.megaphoneCircle}>
              <Ionicons name="megaphone" size={28} color={C.gold} />
            </View>
          </View>
          <Text style={styles.heroTitle}>Your work deserves{'\n'}to be seen.</Text>
          <Text style={styles.heroSub}>
            Share your finished detail to social media in one tap. REVV generates the caption — you get the credit.
          </Text>
        </View>

        {/* Featured photo */}
        {hasPhotos && (
          <View style={styles.photoSection}>
            <View style={styles.featuredWrap}>
              <Image source={{ uri: featuredUri! }} style={styles.featuredPhoto} contentFit="cover" />
              <View style={styles.featuredLabel}>
                <Ionicons name="star" size={10} color={C.gold} />
                <Text style={styles.featuredLabelText}>Featured</Text>
              </View>
            </View>

            {data.afterPhotos.length > 1 && (
              <View style={styles.thumbRow}>
                {data.afterPhotos.map((uri, i) => (
                  <Pressable key={i} onPress={() => setFeaturedIdx(i)} style={[styles.thumb, i === featuredIdx && styles.thumbActive]}>
                    <Image source={{ uri }} style={styles.thumbImage} contentFit="cover" />
                    {i === featuredIdx && (
                      <View style={styles.thumbCheck}>
                        <Ionicons name="checkmark" size={10} color={C.white} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Caption card */}
        <View style={styles.captionCard}>
          <View style={styles.captionCardHeader}>
            <Text style={styles.captionCardTitle}>Caption</Text>
            <Pressable
              style={styles.regenBtn}
              onPress={() => {
                if (data) setCaption(buildCaption(captionStyle, data.service, data.vehicleLabel));
              }}
            >
              <Ionicons name="refresh" size={13} color={C.gold} />
              <Text style={styles.regenText}>Regenerate</Text>
            </Pressable>
          </View>

          {/* Style selector */}
          <View style={styles.stylePills}>
            {STYLES.map((s) => (
              <Pressable
                key={s.key}
                style={[styles.stylePill, captionStyle === s.key && styles.stylePillActive]}
                onPress={() => onStyleChange(s.key)}
              >
                <Ionicons
                  name={s.icon as any}
                  size={13}
                  color={captionStyle === s.key ? C.gold : C.muted}
                />
                <Text style={[styles.stylePillText, captionStyle === s.key && styles.stylePillTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Editable caption */}
          <TextInput
            ref={captionRef}
            style={styles.captionInput}
            value={caption}
            onChangeText={setCaption}
            multiline
            textAlignVertical="top"
            placeholderTextColor={C.muted}
          />

          <Pressable
            style={styles.copyBtn}
            onPress={async () => {
              // Copy to clipboard via Share (no Clipboard API needed)
              await Share.share({ message: caption });
            }}
          >
            <Ionicons name="copy-outline" size={14} color={C.muted} />
            <Text style={styles.copyBtnText}>Copy caption</Text>
          </Pressable>
        </View>

        {/* Platform hints */}
        <View style={styles.platformRow}>
          {(['logo-instagram', 'logo-tiktok', 'logo-twitter', 'logo-facebook'] as const).map((icon) => (
            <View key={icon} style={styles.platformIcon}>
              <Ionicons name={icon} size={22} color={C.muted} />
            </View>
          ))}
        </View>
        <Text style={styles.platformHint}>Opens your device&apos;s native share sheet — post to any platform</Text>

        {/* Share CTA */}
        <Pressable
          style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color={C.bg} />
          ) : (
            <>
              <Ionicons name="share-social" size={18} color={C.bg} />
              <Text style={styles.shareBtnText}>
                {shared ? 'Share Again' : 'Share to Social'}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.skipBtn} onPress={() => router.push('/detailer/(tabs)/jobs')}>
          <Text style={styles.skipText}>Back to Jobs</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: C.gray, fontSize: 16, fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: { padding: 4, width: 40 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBrand: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },
  headerRe: { color: C.white },
  headerVV: { color: C.gold },
  headerReach: { color: C.gray, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(39,174,96,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(39,174,96,0.3)',
    width: 64,
    justifyContent: 'center',
  },
  sharedBadgeText: { color: C.green, fontSize: 11, fontWeight: '800' },

  scroll: { paddingHorizontal: 20 },

  hero: { alignItems: 'center', paddingVertical: 28, gap: 12 },
  megaphoneRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(201,162,39,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  megaphoneCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(201,162,39,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: C.white,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 33,
    letterSpacing: 0.3,
  },
  heroSub: {
    color: C.gray,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 10,
  },

  photoSection: { marginBottom: 16, gap: 10 },
  featuredWrap: { borderRadius: 18, overflow: 'hidden', position: 'relative' },
  featuredPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 18 },
  featuredLabel: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  featuredLabelText: { color: C.gold, fontSize: 11, fontWeight: '800' },
  thumbRow: { flexDirection: 'row', gap: 8 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: C.border,
    position: 'relative',
  },
  thumbActive: { borderColor: C.gold },
  thumbImage: { width: '100%', height: '100%' },
  thumbCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: C.gold,
    borderRadius: 999,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  captionCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    gap: 14,
  },
  captionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  captionCardTitle: { color: C.white, fontSize: 15, fontWeight: '800' },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(201,162,39,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
  },
  regenText: { color: C.gold, fontSize: 12, fontWeight: '800' },

  stylePills: { flexDirection: 'row', gap: 8 },
  stylePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card2,
  },
  stylePillActive: { borderColor: C.gold, backgroundColor: 'rgba(201,162,39,0.1)' },
  stylePillText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  stylePillTextActive: { color: C.gold },

  captionInput: {
    backgroundColor: C.card2,
    borderRadius: 14,
    padding: 14,
    color: C.white,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    minHeight: 130,
    borderWidth: 1,
    borderColor: C.border,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  copyBtnText: { color: C.muted, fontSize: 12, fontWeight: '700' },

  platformRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 6,
  },
  platformIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformHint: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },

  shareBtn: {
    backgroundColor: C.gold,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  shareBtnDisabled: { opacity: 0.6 },
  shareBtnText: { color: C.bg, fontSize: 16, fontWeight: '900' },

  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
});
