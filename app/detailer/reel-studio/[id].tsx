import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  generateContent,
  renderReel,
  type ContentParams,
  type ReelMusic,
  type ReelTemplate,
} from '@/lib/reachService';

const C = {
  bg:     '#0D1B2A',
  card:   '#142030',
  card2:  '#1A2B3C',
  gold:   '#C9A227',
  white:  '#FFFFFF',
  gray:   '#8FA3B1',
  muted:  '#5A7080',
  border: '#243548',
  green:  '#27AE60',
  red:    '#D93025',
};

const TOTAL_STEPS = 5;

type JobData = {
  service: string;
  vehicleLabel: string;
  afterPhotos: string[];
  detailerName: string;
};

// ─── Step 1: Template ────────────────────────────────────────────────────────

const TEMPLATES: { key: ReelTemplate; label: string; icon: string; desc: string }[] = [
  {
    key: 'transformation',
    label: 'Transformation Reveal',
    icon: 'swap-horizontal',
    desc: 'Dramatic split-screen reveal — before on the left, after on the right.',
  },
  {
    key: 'slideshow',
    label: 'Before → After',
    icon: 'images-outline',
    desc: 'Photos flow sequentially with smooth fade transitions.',
  },
  {
    key: 'showcase',
    label: 'REVV Showcase',
    icon: 'star',
    desc: 'Branded REVV intro, your photos, and a professional outro with CTA.',
  },
  {
    key: 'highlights',
    label: 'Detail Highlights',
    icon: 'flash',
    desc: 'Quick cinematic cuts through all your after shots — built for TikTok speed.',
  },
];

function TemplateStep({
  selected,
  onSelect,
}: {
  selected: ReelTemplate;
  onSelect: (t: ReelTemplate) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Choose a Template</Text>
      <Text style={styles.stepSub}>This controls how your photos are arranged and animated.</Text>
      <View style={styles.templateGrid}>
        {TEMPLATES.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.templateCard, selected === t.key && styles.templateCardActive]}
            onPress={() => onSelect(t.key)}
          >
            <View style={[styles.templateIconWrap, selected === t.key && styles.templateIconWrapActive]}>
              <Ionicons name={t.icon as any} size={22} color={selected === t.key ? C.gold : C.muted} />
            </View>
            <Text style={[styles.templateLabel, selected === t.key && styles.templateLabelActive]}>
              {t.label}
            </Text>
            <Text style={styles.templateDesc}>{t.desc}</Text>
            {selected === t.key && (
              <View style={styles.templateCheck}>
                <Ionicons name="checkmark" size={12} color={C.bg} />
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Step 2: Media ───────────────────────────────────────────────────────────

function MediaStep({
  afterPhotos,
  selectedPhotos,
  onToggle,
}: {
  afterPhotos: string[];
  selectedPhotos: Set<number>;
  onToggle: (i: number) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Your Photos</Text>
      <Text style={styles.stepSub}>
        Choose which after photos go into the reel. Tap to include or exclude.
      </Text>

      <Text style={styles.mediaGroupLabel}>AFTER PHOTOS</Text>
      {afterPhotos.length === 0 ? (
        <View style={styles.noPhotosWrap}>
          <Ionicons name="camera-outline" size={32} color={C.muted} />
          <Text style={styles.noPhotosText}>No after photos on this job</Text>
        </View>
      ) : (
        <View style={styles.photoGrid}>
          {afterPhotos.map((uri, i) => {
            const on = selectedPhotos.has(i);
            return (
              <Pressable key={i} style={[styles.photoSlot, on && styles.photoSlotOn]} onPress={() => onToggle(i)}>
                <Image source={{ uri }} style={styles.photoImg} contentFit="cover" />
                <View style={[styles.photoOverlay, on && styles.photoOverlayOn]}>
                  {on
                    ? <Ionicons name="checkmark-circle" size={22} color={C.gold} />
                    : <Ionicons name="add-circle-outline" size={22} color={C.white} />
                  }
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.beforeNotice}>
        <Ionicons name="information-circle-outline" size={16} color={C.muted} />
        <Text style={styles.beforeNoticeText}>
          Before photos (from your VIR) will be automatically pulled in when the Shotstack API is connected.
        </Text>
      </View>
    </View>
  );
}

// ─── Step 3: AI Content ──────────────────────────────────────────────────────

const TONES: { key: ContentParams['tone']; label: string; desc: string }[] = [
  { key: 'bold',      label: 'Bold',      desc: 'Direct, confident, high-energy' },
  { key: 'refined',   label: 'Refined',   desc: 'Professional, premium, minimal' },
  { key: 'relatable', label: 'Relatable', desc: 'Conversational, fun, scroll-stopping' },
];

function ContentStep({
  service,
  vehicleLabel,
  hook,
  caption,
  hashtags,
  tone,
  generating,
  onToneChange,
  onGenerate,
  onHookChange,
  onCaptionChange,
  onHashtagsChange,
}: {
  service: string;
  vehicleLabel: string;
  hook: string;
  caption: string;
  hashtags: string;
  tone: ContentParams['tone'];
  generating: boolean;
  onToneChange: (t: ContentParams['tone']) => void;
  onGenerate: () => void;
  onHookChange: (v: string) => void;
  onCaptionChange: (v: string) => void;
  onHashtagsChange: (v: string) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>AI Content</Text>
      <Text style={styles.stepSub}>
        Generate a hook, caption, and hashtags — then tweak them to your voice.
      </Text>

      <Text style={styles.fieldLabel}>CONTENT TONE</Text>
      <View style={styles.toneRow}>
        {TONES.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.toneCard, tone === t.key && styles.toneCardActive]}
            onPress={() => onToneChange(t.key)}
          >
            <Text style={[styles.toneLabel, tone === t.key && styles.toneLabelActive]}>{t.label}</Text>
            <Text style={styles.toneDesc}>{t.desc}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={[styles.generateBtn, generating && { opacity: 0.6 }]} onPress={onGenerate} disabled={generating}>
        {generating ? (
          <ActivityIndicator size="small" color={C.bg} />
        ) : (
          <>
            <Ionicons name="sparkles" size={15} color={C.bg} />
            <Text style={styles.generateBtnText}>{hook ? 'Regenerate' : 'Generate with AI'}</Text>
          </>
        )}
      </Pressable>

      {hook !== '' && (
        <>
          <View style={styles.aiBadgeRow}>
            <Ionicons name="sparkles" size={11} color={C.gold} />
            <Text style={styles.aiBadgeText}>AI Generated · tap fields to edit</Text>
          </View>

          <Text style={styles.fieldLabel}>HOOK (first 3 seconds)</Text>
          <TextInput
            style={styles.hookInput}
            value={hook}
            onChangeText={onHookChange}
            placeholderTextColor={C.muted}
          />

          <Text style={styles.fieldLabel}>CAPTION</Text>
          <TextInput
            style={styles.captionInput}
            value={caption}
            onChangeText={onCaptionChange}
            multiline
            textAlignVertical="top"
            placeholderTextColor={C.muted}
          />

          <Text style={styles.fieldLabel}>HASHTAGS</Text>
          <TextInput
            style={styles.hashtagInput}
            value={hashtags}
            onChangeText={onHashtagsChange}
            multiline
            textAlignVertical="top"
            placeholderTextColor={C.muted}
          />
        </>
      )}
    </View>
  );
}

// ─── Step 4: Music ───────────────────────────────────────────────────────────

const MUSIC: { key: ReelMusic; label: string; icon: string; desc: string; bpm: string }[] = [
  { key: 'luxury',     label: 'Luxury',     icon: 'diamond-outline',   desc: 'Smooth, aspirational',      bpm: '90 BPM' },
  { key: 'energetic',  label: 'Energetic',  icon: 'flash-outline',     desc: 'Upbeat and driving',         bpm: '128 BPM' },
  { key: 'satisfying', label: 'Satisfying', icon: 'water-outline',     desc: 'Calm, ASMR-feel',           bpm: '75 BPM' },
  { key: 'hype',       label: 'Hype',       icon: 'flame-outline',     desc: 'High energy, trap-style',   bpm: '140 BPM' },
];

function MusicStep({
  selected,
  onSelect,
}: {
  selected: ReelMusic;
  onSelect: (m: ReelMusic) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Pick a Vibe</Text>
      <Text style={styles.stepSub}>Background music that matches your brand. Royalty-free tracks included with every reel.</Text>
      <View style={styles.musicList}>
        {MUSIC.map((m) => (
          <Pressable
            key={m.key}
            style={[styles.musicCard, selected === m.key && styles.musicCardActive]}
            onPress={() => onSelect(m.key)}
          >
            <View style={[styles.musicIconWrap, selected === m.key && styles.musicIconWrapActive]}>
              <Ionicons name={m.icon as any} size={20} color={selected === m.key ? C.gold : C.muted} />
            </View>
            <View style={styles.musicInfo}>
              <Text style={[styles.musicLabel, selected === m.key && styles.musicLabelActive]}>{m.label}</Text>
              <Text style={styles.musicDesc}>{m.desc} · {m.bpm}</Text>
            </View>
            {selected === m.key && (
              <Ionicons name="radio-button-on" size={20} color={C.gold} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Step 5: Render ──────────────────────────────────────────────────────────

function RenderStep({
  template,
  music,
  selectedCount,
  hook,
  rendering,
  renderDone,
  isMock,
  onRender,
  caption,
  hashtags,
}: {
  template: ReelTemplate;
  music: ReelMusic;
  selectedCount: number;
  hook: string;
  rendering: boolean;
  renderDone: boolean;
  isMock: boolean;
  onRender: () => void;
  caption: string;
  hashtags: string;
}) {
  const templateLabel = TEMPLATES.find((t) => t.key === template)?.label ?? template;
  const musicLabel    = MUSIC.find((m) => m.key === music)?.label ?? music;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {renderDone ? (isMock ? 'Structure Ready' : 'Reel Ready!') : 'Create Your Reel'}
      </Text>
      <Text style={styles.stepSub}>
        {renderDone && isMock
          ? 'Connect Shotstack or Creatomate to render real MP4 videos. Your settings are saved.'
          : renderDone
          ? 'Your reel has been rendered. Download it and post across all your platforms.'
          : 'Review your settings, then hit create. Rendering takes about 30–60 seconds.'}
      </Text>

      {!renderDone && (
        <View style={styles.summaryCard}>
          <SummaryRow icon="layers-outline"    label="Template"  value={templateLabel} />
          <SummaryRow icon="images-outline"    label="Photos"    value={`${selectedCount} selected`} />
          <SummaryRow icon="musical-note"      label="Music"     value={musicLabel} />
          <SummaryRow icon="text-outline"      label="Hook"      value={hook || 'None — go back to add one'} last />
        </View>
      )}

      {rendering && (
        <View style={styles.renderingWrap}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={styles.renderingText}>Rendering your reel…</Text>
          <Text style={styles.renderingSub}>Processing photos, applying template & music</Text>
        </View>
      )}

      {renderDone && isMock && (
        <View style={styles.mockReadyCard}>
          <View style={styles.mockReadyIcon}>
            <Ionicons name="construct-outline" size={26} color={C.gold} />
          </View>
          <Text style={styles.mockReadyTitle}>API Integration Pending</Text>
          <Text style={styles.mockReadyDesc}>
            The full pipeline is built. Add your Shotstack or Creatomate API key to a Firebase Cloud Function and real MP4 videos will render here automatically.
          </Text>
          <View style={styles.mockReadySteps}>
            {[
              'Set up Firebase Cloud Functions (Blaze plan)',
              'Add Shotstack API key to function config',
              'Uncomment the live block in lib/reachService.ts',
            ].map((step, i) => (
              <View key={i} style={styles.mockReadyStep}>
                <View style={styles.mockStepNum}><Text style={styles.mockStepNumText}>{i + 1}</Text></View>
                <Text style={styles.mockStepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {renderDone && !isMock && (
        <View style={styles.readyCard}>
          <View style={styles.readyIcon}>
            <Ionicons name="checkmark-circle" size={40} color={C.green} />
          </View>
          <Text style={styles.readyTitle}>Your reel is ready</Text>
          <Pressable style={styles.downloadBtn}>
            <Ionicons name="download-outline" size={17} color={C.bg} />
            <Text style={styles.downloadBtnText}>Save to Camera Roll</Text>
          </Pressable>
        </View>
      )}

      {!rendering && (
        <>
          {!renderDone && (
            <Pressable style={styles.createBtn} onPress={onRender}>
              <Ionicons name="videocam" size={18} color={C.bg} />
              <Text style={styles.createBtnText}>Create Reel</Text>
            </Pressable>
          )}

          {renderDone && (
            <Pressable
              style={styles.shareBtn}
              onPress={() => Share.share({ message: `${caption}\n\n${hashtags}` })}
            >
              <Ionicons name="share-social" size={17} color={C.bg} />
              <Text style={styles.shareBtnText}>Share Caption</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

function SummaryRow({
  icon, label, value, last,
}: {
  icon: string; label: string; value: string; last?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, last && { borderBottomWidth: 0 }]}>
      <Ionicons name={icon as any} size={15} color={C.muted} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ReelStudioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [jobData, setJobData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);

  // Step state
  const [step, setStep] = useState(1);

  // Step 1
  const [template, setTemplate] = useState<ReelTemplate>('transformation');

  // Step 2
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());

  // Step 3
  const [tone, setTone]           = useState<ContentParams['tone']>('bold');
  const [hook, setHook]           = useState('');
  const [caption, setCaption]     = useState('');
  const [hashtags, setHashtags]   = useState('');
  const [generating, setGenerating] = useState(false);

  // Step 4
  const [music, setMusic] = useState<ReelMusic>('energetic');

  // Step 5
  const [rendering, setRendering]   = useState(false);
  const [renderDone, setRenderDone] = useState(false);
  const [isMock, setIsMock]         = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const snap = await getDoc(doc(db, 'invoices', id));
      if (!snap.exists()) { setLoading(false); return; }
      const d = snap.data();
      const photos: string[] = Array.isArray(d.afterPhotos) ? d.afterPhotos : [];
      setJobData({
        service:      String(d.service ?? ''),
        vehicleLabel: String(d.vehicleLabel ?? ''),
        afterPhotos:  photos,
        detailerName: String(d.detailerName ?? ''),
      });
      setSelectedPhotos(new Set(photos.map((_, i) => i)));
      setLoading(false);
    })();
  }, [id]);

  function togglePhoto(i: number) {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  async function handleGenerate() {
    if (!jobData) return;
    setGenerating(true);
    const result = await generateContent({ service: jobData.service, vehicleLabel: jobData.vehicleLabel, tone });
    setHook(result.hook);
    setCaption(result.caption);
    setHashtags(result.hashtags);
    setGenerating(false);
  }

  async function handleRender() {
    if (!jobData || !id) return;
    setRendering(true);
    const afterSelected = (jobData.afterPhotos ?? []).filter((_, i) => selectedPhotos.has(i));
    const result = await renderReel({
      bookingId: id,
      template,
      afterPhotos: afterSelected,
      beforePhotos: [],
      hook,
      caption,
      hashtags,
      music,
      detailerName: jobData.detailerName,
      service: jobData.service,
      vehicleLabel: jobData.vehicleLabel,
    });
    if (result.status !== 'mock') {
      await updateDoc(doc(db, 'invoices', id), { reachShared: true, reelUrl: result.videoUrl });
    }
    setIsMock(result.status === 'mock');
    setRendering(false);
    setRenderDone(true);
  }

  const canNext = () => {
    if (step === 2) return selectedPhotos.size > 0;
    if (step === 3) return hook !== '';
    return true;
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={C.gold} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => (step > 1 && !renderDone ? setStep(step - 1) : router.back())} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.gray} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Reel Studio</Text>
          {!renderDone && <Text style={styles.headerStep}>Step {step} of {TOTAL_STEPS}</Text>}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      {!renderDone && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && <TemplateStep selected={template} onSelect={setTemplate} />}
        {step === 2 && (
          <MediaStep
            afterPhotos={jobData?.afterPhotos ?? []}
            selectedPhotos={selectedPhotos}
            onToggle={togglePhoto}
          />
        )}
        {step === 3 && (
          <ContentStep
            service={jobData?.service ?? ''}
            vehicleLabel={jobData?.vehicleLabel ?? ''}
            hook={hook}
            caption={caption}
            hashtags={hashtags}
            tone={tone}
            generating={generating}
            onToneChange={setTone}
            onGenerate={handleGenerate}
            onHookChange={setHook}
            onCaptionChange={setCaption}
            onHashtagsChange={setHashtags}
          />
        )}
        {step === 4 && <MusicStep selected={music} onSelect={setMusic} />}
        {step === 5 && (
          <RenderStep
            template={template}
            music={music}
            selectedCount={selectedPhotos.size}
            hook={hook}
            rendering={rendering}
            renderDone={renderDone}
            isMock={isMock}
            onRender={handleRender}
            caption={caption}
            hashtags={hashtags}
          />
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer nav */}
      {!renderDone && (
        <View style={styles.footer}>
          {step < TOTAL_STEPS ? (
            <Pressable
              style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
              onPress={() => setStep(step + 1)}
              disabled={!canNext()}
            >
              <Text style={[styles.nextBtnText, !canNext() && styles.nextBtnTextDisabled]}>
                {step === 4 ? 'Review & Create' : 'Next'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={canNext() ? C.bg : C.muted} />
            </Pressable>
          ) : null}
        </View>
      )}

      {renderDone && (
        <View style={styles.footer}>
          <Pressable style={styles.doneBtn} onPress={() => router.push('/detailer/(tabs)/reach')}>
            <Text style={styles.doneBtnText}>Back to Reach</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  backBtn: { padding: 4, width: 40 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: C.white, fontSize: 16, fontWeight: '900' },
  headerStep:  { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },

  progressBar: { height: 3, backgroundColor: C.card2, marginHorizontal: 20, borderRadius: 2, marginBottom: 8 },
  progressFill: { height: 3, backgroundColor: C.gold, borderRadius: 2 },

  scroll: { paddingHorizontal: 20, paddingBottom: 20 },

  stepContent: { paddingTop: 16, gap: 4 },
  stepTitle: { color: C.white, fontSize: 22, fontWeight: '900', marginBottom: 4 },
  stepSub:   { color: C.gray, fontSize: 14, lineHeight: 21, marginBottom: 20 },

  // Template
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  templateCard: {
    width: '47%',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 16,
    gap: 10,
    position: 'relative',
  },
  templateCardActive: { borderColor: C.gold, backgroundColor: 'rgba(201,162,39,0.07)' },
  templateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateIconWrapActive: { backgroundColor: 'rgba(201,162,39,0.15)' },
  templateLabel: { color: C.gray, fontSize: 13, fontWeight: '800' },
  templateLabelActive: { color: C.gold },
  templateDesc:  { color: C.muted, fontSize: 11, lineHeight: 16 },
  templateCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Media
  mediaGroupLabel: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  photoSlot: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: C.border,
    position: 'relative',
  },
  photoSlotOn: { borderColor: C.gold },
  photoImg: { width: '100%', height: '100%' },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlayOn: { backgroundColor: 'rgba(0,0,0,0.1)' },
  noPhotosWrap: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  noPhotosText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  beforeNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  beforeNoticeText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },

  // Content
  fieldLabel: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10, marginTop: 6 },
  toneRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toneCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 12,
    gap: 4,
    alignItems: 'center',
  },
  toneCardActive: { borderColor: C.gold, backgroundColor: 'rgba(201,162,39,0.07)' },
  toneLabel: { color: C.gray, fontSize: 13, fontWeight: '800' },
  toneLabelActive: { color: C.gold },
  toneDesc:  { color: C.muted, fontSize: 10, textAlign: 'center', lineHeight: 14 },
  generateBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  generateBtnText: { color: C.bg, fontSize: 15, fontWeight: '900' },
  aiBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  aiBadgeText: { color: C.gold, fontSize: 11, fontWeight: '700' },
  hookInput: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    color: C.white,
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  captionInput: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    color: C.white,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 120,
    marginBottom: 16,
  },
  hashtagInput: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    color: C.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 60,
  },

  // Music
  musicList: { gap: 10 },
  musicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 16,
  },
  musicCardActive: { borderColor: C.gold, backgroundColor: 'rgba(201,162,39,0.07)' },
  musicIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicIconWrapActive: { backgroundColor: 'rgba(201,162,39,0.15)' },
  musicInfo: { flex: 1 },
  musicLabel: { color: C.gray, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  musicLabelActive: { color: C.gold },
  musicDesc:  { color: C.muted, fontSize: 12 },

  // Render
  summaryCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  summaryLabel: { color: C.muted, fontSize: 12, fontWeight: '700', width: 70 },
  summaryValue: { flex: 1, color: C.white, fontSize: 13, fontWeight: '600' },
  renderingWrap: { alignItems: 'center', paddingVertical: 30, gap: 14 },
  renderingText: { color: C.white, fontSize: 16, fontWeight: '800' },
  renderingSub:  { color: C.muted, fontSize: 13 },
  createBtn: {
    backgroundColor: C.gold,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createBtnText: { color: C.bg, fontSize: 16, fontWeight: '900' },
  shareBtn: {
    backgroundColor: C.gold,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareBtnText: { color: C.bg, fontSize: 15, fontWeight: '900' },
  mockReadyCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    gap: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  mockReadyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(201,162,39,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  mockReadyTitle: { color: C.gold, fontSize: 16, fontWeight: '900' },
  mockReadyDesc:  { color: C.gray, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  mockReadySteps: { width: '100%', gap: 10, marginTop: 4 },
  mockReadyStep:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  mockStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(201,162,39,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mockStepNumText: { color: C.gold, fontSize: 11, fontWeight: '900' },
  mockStepText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  readyCard: { alignItems: 'center', gap: 16, paddingVertical: 20 },
  readyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(39,174,96,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyTitle: { color: C.green, fontSize: 18, fontWeight: '900' },
  downloadBtn: {
    backgroundColor: C.green,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadBtnText: { color: C.white, fontSize: 14, fontWeight: '900' },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  nextBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnDisabled: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  nextBtnText: { color: C.bg, fontSize: 15, fontWeight: '900' },
  nextBtnTextDisabled: { color: C.muted },
  doneBtn: {
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  doneBtnText: { color: C.gray, fontSize: 14, fontWeight: '700' },
});
