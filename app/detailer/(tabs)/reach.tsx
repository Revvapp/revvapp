import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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
import { useAuth } from '@/hooks/useAuth';
import { toTitleCase } from '@/lib/format';

const C = {
  bg:      '#0D1B2A',
  content: '#F5F7FA',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  gray:    '#B7C1CC',
  muted:   '#6B7885',
  border:  '#E2E8F0',
  green:   '#27AE60',
  white:   '#FFFFFF',
  dark:    '#142030',
  dark2:   '#1A2B3C',
};

type CaptionStyle = 'professional' | 'casual' | 'hype';
type Topic = 'exterior' | 'interior' | 'ceramic' | 'paint' | 'full' | 'custom';

const CAPTION_STYLES: { key: CaptionStyle; label: string; icon: string }[] = [
  { key: 'professional', label: 'Professional', icon: 'briefcase-outline' },
  { key: 'casual',       label: 'Casual',       icon: 'chatbubble-outline' },
  { key: 'hype',         label: 'Hype',          icon: 'flame-outline' },
];

const TOPICS: { key: Topic; label: string }[] = [
  { key: 'exterior', label: 'Exterior Detail' },
  { key: 'interior', label: 'Interior Detail' },
  { key: 'ceramic',  label: 'Ceramic Coating' },
  { key: 'paint',    label: 'Paint Correction' },
  { key: 'full',     label: 'Full Detail' },
  { key: 'custom',   label: 'Custom...' },
];

const PLATFORMS = [
  { key: 'instagram', icon: 'logo-instagram', label: 'Instagram', scheme: 'instagram://', web: 'https://instagram.com' },
  { key: 'tiktok',    icon: 'logo-tiktok',    label: 'TikTok',    scheme: 'tiktok://',    web: 'https://tiktok.com' },
  { key: 'twitter',   icon: 'logo-twitter',   label: 'X / Twitter', scheme: 'twitter://', web: 'https://twitter.com' },
  { key: 'facebook',  icon: 'logo-facebook',  label: 'Facebook',  scheme: 'fb://',        web: 'https://facebook.com' },
];

function buildCaption(style: CaptionStyle, topic: Topic, custom: string): string {
  const topicLabel: Record<Topic, string> = {
    exterior: 'exterior detail',
    interior: 'interior detail',
    ceramic:  'ceramic coating',
    paint:    'paint correction',
    full:     'full detail',
    custom:   custom || 'detail',
  };
  const t = topicLabel[topic];

  switch (style) {
    case 'professional':
      return `Another flawless ${t} wrapped up. Every surface treated with the same standard — because your car deserves nothing less.\n\nBook your detail via the link in bio.\n\n#CarDetailing #${t.replace(/ /g, '')} #REVV #AutoDetailing #DetailLife`;
    case 'casual':
      return `Look at this transformation 🔥 ${toTitleCase(t)} done and dusted. Before vs after shots don't lie — this is what we do.\n\nWho's next? Drop a comment or hit the link in bio to book.\n\n#Detailing #CarCare #REVV #DetailLife #CarLovers`;
    case 'hype':
      return `NO SHORTCUTS. NO EXCUSES. ⚡\n\n${toTitleCase(t).toUpperCase()} — built different, detailed different.\n\nYour car is a reflection of you. Make it speak for itself.\n\n📲 Book now → link in bio\n\n#REVV #CarDetailing #BestDetailer #DetailLife #${t.replace(/ /g, '')}`;
  }
}

type JobContent = {
  id: string;
  service: string;
  vehicleLabel: string;
  date: string;
  afterPhotos: string[];
  reachShared: boolean;
};

export default function ReachTab() {
  const { user } = useAuth();

  // Studio state
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('professional');
  const [topic, setTopic] = useState<Topic>('exterior');
  const [customTopic, setCustomTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Jobs feed state
  const [jobs, setJobs] = useState<JobContent[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const customRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!user?.uid) { setLoadingJobs(false); return; }
    const q = query(collection(db, 'invoices'), where('detailerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const rows: JobContent[] = snap.docs
        .map((d) => {
          const x = d.data();
          return {
            id: d.id,
            service: String(x.service ?? ''),
            vehicleLabel: String(x.vehicleLabel ?? ''),
            date: String(x.date ?? ''),
            afterPhotos: Array.isArray(x.afterPhotos) ? x.afterPhotos : [],
            reachShared: Boolean(x.reachShared),
          };
        })
        .filter((j) => j.afterPhotos.length > 0)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10);
      setJobs(rows);
      setLoadingJobs(false);
    });
    return () => unsub();
  }, [user?.uid]);

  function handleGenerate() {
    setGenerating(true);
    setGenerated(false);
    // Simulate AI generation delay for UX
    setTimeout(() => {
      setCaption(buildCaption(captionStyle, topic, customTopic));
      setGenerating(false);
      setGenerated(true);
    }, 900);
  }

  async function handleShare() {
    await Share.share({ message: caption });
  }

  async function openPlatform(scheme: string, web: string) {
    const canOpen = await Linking.canOpenURL(scheme);
    if (canOpen) {
      await Linking.openURL(scheme);
    } else {
      await Linking.openURL(web);
    }
  }

  function fmtDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (isNaN(y)) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const sharedCount = jobs.filter((j) => j.reachShared).length;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerBrand}>
            <Text style={styles.headerRe}>RE</Text>
            <Text style={styles.headerVV}>VV</Text>
            <Text style={styles.headerReach}> Reach</Text>
          </Text>
          <Text style={styles.headerSub}>Grow your brand on social</Text>
        </View>
        {sharedCount > 0 && (
          <View style={styles.sharedCountBadge}>
            <Ionicons name="share-social" size={12} color={C.gold} />
            <Text style={styles.sharedCountText}>{sharedCount} shared</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Reel Studio CTA */}
        {jobs.length > 0 && (
          <Pressable
            style={styles.reelCta}
            onPress={() => router.push({ pathname: '/detailer/reel-studio/[id]', params: { id: jobs[0].id } })}
          >
            <View style={styles.reelCtaIcon}>
              <Ionicons name="videocam" size={20} color={C.bg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reelCtaTitle}>Create a Reel</Text>
              <Text style={styles.reelCtaSub}>Turn your latest detail into short-form content</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={C.bg} />
          </Pressable>
        )}

        {/* AI Caption Studio */}
        <View style={styles.studioCard}>
          {/* Studio header */}
          <View style={styles.studioHeader}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={16} color={C.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.studioTitle}>AI Caption Studio</Text>
              <Text style={styles.studioSub}>Generate a ready-to-post caption in seconds</Text>
            </View>
          </View>

          {/* Topic selector */}
          <Text style={styles.fieldLabel}>WHAT TYPE OF POST?</Text>
          <View style={styles.topicGrid}>
            {TOPICS.map((t) => (
              <Pressable
                key={t.key}
                style={[styles.topicChip, topic === t.key && styles.topicChipActive]}
                onPress={() => {
                  setTopic(t.key);
                  setGenerated(false);
                  if (t.key === 'custom') setTimeout(() => customRef.current?.focus(), 100);
                }}
              >
                <Text style={[styles.topicChipText, topic === t.key && styles.topicChipTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {topic === 'custom' && (
            <TextInput
              ref={customRef}
              style={styles.customInput}
              placeholder="e.g. Show car wax application on a Ferrari..."
              placeholderTextColor={C.muted}
              value={customTopic}
              onChangeText={(v) => { setCustomTopic(v); setGenerated(false); }}
            />
          )}

          {/* Caption style */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>CAPTION STYLE</Text>
          <View style={styles.stylePills}>
            {CAPTION_STYLES.map((s) => (
              <Pressable
                key={s.key}
                style={[styles.stylePill, captionStyle === s.key && styles.stylePillActive]}
                onPress={() => { setCaptionStyle(s.key); setGenerated(false); }}
              >
                <Ionicons name={s.icon as any} size={13} color={captionStyle === s.key ? C.gold : C.muted} />
                <Text style={[styles.stylePillText, captionStyle === s.key && styles.stylePillTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Generate button */}
          <Pressable
            style={[styles.generateBtn, generating && styles.generateBtnLoading]}
            onPress={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator size="small" color={C.navy} />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color={C.navy} />
                <Text style={styles.generateBtnText}>
                  {generated ? 'Regenerate Caption' : 'Generate Caption'}
                </Text>
              </>
            )}
          </Pressable>

          {/* Generated caption */}
          {generated && (
            <>
              <View style={styles.captionBox}>
                <View style={styles.captionBoxHeader}>
                  <View style={styles.aiBadge}>
                    <Ionicons name="sparkles" size={10} color={C.gold} />
                    <Text style={styles.aiBadgeText}>AI Generated</Text>
                  </View>
                  <Pressable onPress={() => { setCaption(buildCaption(captionStyle, topic, customTopic)); }}>
                    <Ionicons name="refresh" size={16} color={C.muted} />
                  </Pressable>
                </View>
                <TextInput
                  style={styles.captionInput}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor={C.muted}
                />
              </View>

              {/* Platform buttons */}
              <Text style={styles.fieldLabel}>SHARE TO</Text>
              <View style={styles.platformRow}>
                {PLATFORMS.map((p) => (
                  <Pressable key={p.key} style={styles.platformBtn} onPress={() => openPlatform(p.scheme, p.web)}>
                    <Ionicons name={p.icon as any} size={20} color={C.navy} />
                    <Text style={styles.platformBtnLabel}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable style={styles.shareAllBtn} onPress={handleShare}>
                <Ionicons name="share-social" size={16} color={C.navy} />
                <Text style={styles.shareAllBtnText}>Share via…</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Content from jobs */}
        <Text style={styles.sectionTitle}>From Your Jobs</Text>
        <Text style={styles.sectionSub}>Turn your finished details into ready-to-post content</Text>

        {loadingJobs ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={C.gold} />
          </View>
        ) : jobs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="images-outline" size={38} color={C.gray} />
            <Text style={styles.emptyTitle}>No content yet</Text>
            <Text style={styles.emptyBody}>Complete a job and upload after photos — they&apos;ll appear here ready to share.</Text>
          </View>
        ) : (
          jobs.map((job) => (
            <Pressable
              key={job.id}
              style={styles.jobCard}
              onPress={() => router.push({ pathname: '/detailer/reel-studio/[id]', params: { id: job.id } })}
            >
              <Image source={{ uri: job.afterPhotos[0] }} style={styles.jobThumb} contentFit="cover" />
              <View style={styles.jobInfo}>
                <Text style={styles.jobService} numberOfLines={1}>{toTitleCase(job.service)}</Text>
                <Text style={styles.jobVehicle} numberOfLines={1}>{job.vehicleLabel}</Text>
                <Text style={styles.jobDate}>{fmtDate(job.date)}</Text>
                {job.afterPhotos.length > 1 && (
                  <Text style={styles.jobPhotoCount}>{job.afterPhotos.length} photos</Text>
                )}
              </View>
              <View style={styles.jobAction}>
                {job.reachShared && (
                  <View style={styles.jobSharedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={C.green} />
                    <Text style={styles.jobSharedText}>Shared</Text>
                  </View>
                )}
                <View style={styles.jobArrow}>
                  <Ionicons name="chevron-forward" size={16} color={C.navy} />
                </View>
              </View>
            </Pressable>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerBrand: { fontSize: 24, fontWeight: '900', letterSpacing: 1.5 },
  headerRe: { color: C.white },
  headerVV: { color: C.gold },
  headerReach: { color: C.gray, fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  headerSub: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  sharedCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(201,162,39,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
  },
  sharedCountText: { color: C.gold, fontSize: 12, fontWeight: '800' },

  body: { flex: 1, backgroundColor: C.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bodyInner: { padding: 18, paddingBottom: 40 },

  // Studio card
  studioCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
  },
  studioHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  aiIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(201,162,39,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioTitle: { color: C.navy, fontSize: 15, fontWeight: '900', marginBottom: 2 },
  studioSub: { color: C.muted, fontSize: 12, fontWeight: '500' },

  fieldLabel: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },

  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#F5F7FA',
  },
  topicChipActive: { borderColor: C.gold, backgroundColor: 'rgba(201,162,39,0.1)' },
  topicChipText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  topicChipTextActive: { color: C.gold },

  customInput: {
    marginTop: 10,
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 12,
    color: C.navy,
    fontSize: 13,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: C.border,
  },

  stylePills: { flexDirection: 'row', gap: 8 },
  stylePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#F5F7FA',
  },
  stylePillActive: { borderColor: C.gold, backgroundColor: 'rgba(201,162,39,0.1)' },
  stylePillText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  stylePillTextActive: { color: C.gold },

  generateBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  generateBtnLoading: { opacity: 0.7 },
  generateBtnText: { color: C.navy, fontSize: 15, fontWeight: '900' },

  captionBox: {
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  captionBoxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(201,162,39,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
  },
  aiBadgeText: { color: C.gold, fontSize: 10, fontWeight: '800' },
  captionInput: {
    color: C.navy,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    minHeight: 120,
  },

  platformRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 10 },
  platformBtn: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 5,
  },
  platformBtnLabel: { color: C.navy, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  shareAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: C.navy,
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareAllBtnText: { color: C.navy, fontSize: 14, fontWeight: '800' },

  sectionTitle: { color: C.navy, fontSize: 17, fontWeight: '900', marginBottom: 4 },
  sectionSub: { color: C.muted, fontSize: 13, fontWeight: '500', marginBottom: 14 },

  loadingWrap: { paddingVertical: 30, alignItems: 'center' },
  emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  emptyTitle: { color: C.navy, fontSize: 15, fontWeight: '800' },
  emptyBody: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },

  jobCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  jobThumb: { width: 80, height: 80 },
  jobInfo: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  jobService: { color: C.navy, fontSize: 14, fontWeight: '800' },
  jobVehicle: { color: C.muted, fontSize: 12, fontWeight: '600' },
  jobDate: { color: C.gray, fontSize: 11, fontWeight: '600' },
  jobPhotoCount: { color: C.gold, fontSize: 11, fontWeight: '700', marginTop: 2 },
  jobAction: { paddingRight: 14, alignItems: 'flex-end', gap: 6 },
  jobSharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(39,174,96,0.1)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  jobSharedText: { color: C.green, fontSize: 10, fontWeight: '800' },
  jobArrow: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(201,162,39,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  reelCta: {
    backgroundColor: C.gold,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  reelCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(13,27,42,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelCtaTitle: { color: C.bg, fontSize: 15, fontWeight: '900' },
  reelCtaSub:   { color: 'rgba(13,27,42,0.65)', fontSize: 12, fontWeight: '600', marginTop: 2 },
});
