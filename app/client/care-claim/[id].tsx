import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db, storage } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { createCareClaim } from '@/lib/payments';

const C = {
  bg:      '#0A1628',
  surface: '#F5F7FA',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  goldDim: 'rgba(201,162,39,0.12)',
  gray:    '#8A9BB0',
  muted:   '#6B7A8D',
  border:  '#E8EDF4',
  white:   '#FFFFFF',
  red:     '#D93025',
  redDim:  'rgba(217,48,37,0.08)',
};

const MAX_PHOTOS = 8;
const MIN_DESCRIPTION = 20;
const COVERAGE_CAP_DOLLARS = 2_500;

async function uploadClaimPhoto(bookingId: string, userId: string, localUri: string, index: number): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Network error creating blob'));
    xhr.responseType = 'blob';
    xhr.open('GET', localUri, true);
    xhr.send(null);
  });
  const ref = storageRef(storage, `care-claims/${bookingId}/${userId}/${Date.now()}_${index}.jpg`);
  await uploadBytes(ref, blob);
  return getDownloadURL(ref);
}

/** Dollars typed by the client → integer cents for the callable. */
function toCents(amount: string): number {
  const n = parseFloat(amount.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

type ExistingClaim = {
  status: string;
  amountRequestedCents: number;
  approvedCents: number | null;
  resolutionNote: string | null;
};

const STATUS_COPY: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; title: string }> = {
  open:     { icon: 'time-outline',          color: '#C9A227', title: 'Under Review' },
  approved: { icon: 'checkmark-circle',      color: '#27AE60', title: 'Approved' },
  denied:   { icon: 'close-circle-outline',  color: '#D93025', title: 'Not Approved' },
};

export default function CareClaimScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [description, setDescription] = useState('');
  const [amount, setAmount]           = useState('');
  const [photos, setPhotos]           = useState<string[]>([]);
  const [uploading, setUploading]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  const [checkingExisting, setCheckingExisting] = useState(true);
  const [existingClaim, setExistingClaim]       = useState<ExistingClaim | null>(null);

  // A claim's doc id is its bookingId (one claim per booking), so this screen
  // doubles as both the filing form and the status view — check first whether
  // one already exists rather than only ever offering to file a new one.
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, 'careClaims', id),
      (snap) => {
        const d = snap.data();
        setExistingClaim(
          d
            ? {
                status: String(d.status ?? 'open'),
                amountRequestedCents: Number(d.amountRequestedCents ?? 0),
                approvedCents: d.approvedCents != null ? Number(d.approvedCents) : null,
                resolutionNote: d.resolutionNote ? String(d.resolutionNote) : null,
              }
            : null
        );
        setCheckingExisting(false);
      },
      () => setCheckingExisting(false)
    );
    return () => unsub();
  }, [id]);

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to document the damage.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled) return;
    setPhotos((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  }

  const amountCents = toCents(amount);
  const amountValid = amountCents > 0 && amountCents <= COVERAGE_CAP_DOLLARS * 100;
  const canSubmit =
    description.trim().length >= MIN_DESCRIPTION && photos.length > 0 && amountValid && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !user?.uid || !id) return;
    setSubmitting(true);
    setUploading(true);
    try {
      const photoUrls = await Promise.all(
        photos.map((uri, i) => uploadClaimPhoto(id, user.uid!, uri, i))
      );
      setUploading(false);

      await createCareClaim({
        bookingId: id,
        description: description.trim(),
        photoUrls,
        amountRequestedCents: amountCents,
      });

      Alert.alert(
        'Claim Filed',
        'Your Revv Care claim is with our team. We review claims within 3 business days and will contact you by email.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      setUploading(false);
      // The callable owns the 72-hour window, the one-claim-per-booking rule and
      // the coverage cap, so surface its message rather than guessing.
      const message =
        e instanceof Error && e.message
          ? e.message
          : 'Could not file your claim. Please try again.';
      Alert.alert('Could not file claim', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.eyebrow}>REVV CARE</Text>
            <Text style={styles.headerTitle}>
              {existingClaim ? 'Claim Status' : 'File a Damage Claim'}
            </Text>
          </View>
          <View style={{ width: 30 }} />
        </View>

        {checkingExisting ? (
          <View style={styles.centerBody}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : existingClaim ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {(() => {
              const copy = STATUS_COPY[existingClaim.status] ?? STATUS_COPY.open;
              return (
                <View style={[styles.statusCard, { borderColor: `${copy.color}40` }]}>
                  <Ionicons name={copy.icon} size={32} color={copy.color} />
                  <Text style={[styles.statusTitle, { color: copy.color }]}>{copy.title}</Text>
                  <Text style={styles.statusAmount}>
                    ${(existingClaim.amountRequestedCents / 100).toFixed(2)} requested
                  </Text>
                  {existingClaim.status === 'approved' && existingClaim.approvedCents != null && (
                    <Text style={styles.statusApproved}>
                      ${(existingClaim.approvedCents / 100).toFixed(2)} approved
                    </Text>
                  )}
                  {!!existingClaim.resolutionNote && (
                    <View style={styles.statusNoteBox}>
                      <Text style={styles.statusNoteLabel}>Note from our team</Text>
                      <Text style={styles.statusNoteText}>{existingClaim.resolutionNote}</Text>
                    </View>
                  )}
                  {existingClaim.status === 'open' && (
                    <Text style={styles.statusHint}>
                      We review Revv Care claims within 3 business days. You&apos;ll be notified the
                      moment there&apos;s a decision.
                    </Text>
                  )}
                </View>
              );
            })()}

            <Pressable style={styles.cancelLink} onPress={() => router.back()}>
              <Text style={styles.cancelLinkText}>Back</Text>
            </Pressable>
            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.noticeBox}>
            <Ionicons name="shield-checkmark-outline" size={18} color={C.gold} />
            <Text style={styles.noticeText}>
              Revv Care covers accidental damage caused during a detail, up to $
              {COVERAGE_CAP_DOLLARS.toLocaleString()} per job. Claims must be filed within 72 hours
              of completion — one claim per booking.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>What was damaged?</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the damage, where on the vehicle it is, and when you noticed it (minimum 20 characters)…"
            placeholderTextColor={C.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>

          <Text style={styles.sectionLabel}>Estimated repair cost</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={C.muted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              maxLength={9}
            />
          </View>
          <Text style={[styles.hint, !!amount && !amountValid && styles.hintError]}>
            {!!amount && !amountValid
              ? `Enter an amount between $0.01 and $${COVERAGE_CAP_DOLLARS.toLocaleString()}.`
              : `Coverage cap is $${COVERAGE_CAP_DOLLARS.toLocaleString()}. A quote or invoice speeds up review.`}
          </Text>

          <Text style={styles.sectionLabel}>Photo evidence</Text>
          <Text style={styles.hint}>
            Photograph the damage clearly. Wide shots plus close-ups help most. Up to {MAX_PHOTOS} photos.
          </Text>
          <View style={styles.photoRow}>
            {photos.map((uri) => (
              <View key={uri} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoImg} />
                <Pressable style={styles.photoRemove} onPress={() => removePhoto(uri)}>
                  <Ionicons name="close-circle" size={20} color={C.red} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <Pressable style={styles.photoAdd} onPress={takePhoto}>
                <Ionicons name="camera" size={24} color={photos.length === 0 ? C.red : C.muted} />
                <Text style={[styles.photoAddLabel, photos.length === 0 && styles.photoAddLabelRequired]}>
                  Take photo
                </Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.photoCount}>
            {photos.length === 0
              ? 'At least 1 photo required'
              : `${photos.length}/${MAX_PHOTOS} photo${photos.length !== 1 ? 's' : ''}`}
          </Text>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={16} color={C.muted} />
            <Text style={styles.infoText}>
              Revv Care is a goodwill damage fund, not an insurance policy. Approved claims are paid
              from the Revv Care reserve. Your claim is confidential — the detailer is not shown its
              contents.
            </Text>
          </View>

          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnOff]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color={C.navy} size="small" />
                <Text style={styles.submitBtnText}>{uploading ? 'Uploading photos…' : 'Filing claim…'}</Text>
              </View>
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={17} color={C.navy} />
                <Text style={styles.submitBtnText}>File Revv Care Claim</Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.cancelLink} onPress={() => router.back()}>
            <Text style={styles.cancelLinkText}>Never mind, go back</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  statusCard: {
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 28,
    gap: 6,
    marginTop: 8,
  },
  statusTitle:    { fontSize: 20, fontWeight: '900', marginTop: 6 },
  statusAmount:   { color: C.muted, fontSize: 14, fontWeight: '600' },
  statusApproved: { color: '#27AE60', fontSize: 16, fontWeight: '800', marginTop: 2 },
  statusHint:     { color: C.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  statusNoteBox: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    width: '100%',
  },
  statusNoteLabel: { color: C.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  statusNoteText:  { color: C.navy, fontSize: 13, lineHeight: 18 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn:      { padding: 4 },
  headerCenter: { flex: 1 },
  eyebrow:      { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 1 },
  headerTitle:  { color: C.white, fontSize: 20, fontWeight: '900' },

  scroll:        { flex: 1, backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  scrollContent: { padding: 22, paddingBottom: 48, gap: 8 },

  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.goldDim,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
    marginBottom: 8,
  },
  noticeText: { color: C.navy, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },

  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 10,
  },

  textArea: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: C.navy,
    minHeight: 130,
    borderWidth: 1,
    borderColor: C.border,
    lineHeight: 22,
  },
  charCount: { color: C.gray, fontSize: 11, fontWeight: '600', alignSelf: 'flex-end', marginBottom: 4 },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
  },
  currency:    { color: C.navy, fontSize: 20, fontWeight: '800', marginRight: 4 },
  amountInput: { flex: 1, paddingVertical: 16, fontSize: 20, fontWeight: '700', color: C.navy },

  hint:      { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 4 },
  hintError: { color: C.red },

  photoRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  photoThumb: { width: 80, height: 80, borderRadius: 12, overflow: 'visible' },
  photoImg:   { width: 80, height: 80, borderRadius: 12 },
  photoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: C.white,
    borderRadius: 10,
  },
  photoAdd: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddLabel:         { color: C.muted, fontSize: 10, fontWeight: '600' },
  photoAddLabelRequired: { color: C.red },
  photoCount:            { color: C.gray, fontSize: 11, fontWeight: '600', marginBottom: 4 },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginVertical: 4,
  },
  infoText: { color: C.muted, fontSize: 12, lineHeight: 17, flex: 1 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.gold,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitBtnOff:  { opacity: 0.4 },
  submitBtnText: { color: C.navy, fontSize: 15, fontWeight: '900' },

  cancelLink:     { alignItems: 'center', paddingVertical: 14 },
  cancelLinkText: { color: C.muted, fontSize: 14, fontWeight: '600' },
});
