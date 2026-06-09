import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
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

const MAX_PHOTOS = 5;

const CATEGORIES = [
  { key: 'damage',          label: 'Vehicle Damage',       icon: 'car-sport-outline' as const },
  { key: 'service_quality', label: 'Service Quality',      icon: 'star-half-outline' as const },
  { key: 'no_show',         label: 'Detailer No-Show',     icon: 'person-remove-outline' as const },
  { key: 'wrong_service',   label: 'Wrong Service Done',   icon: 'construct-outline' as const },
  { key: 'overcharge',      label: 'Incorrect Charge',     icon: 'cash-outline' as const },
  { key: 'other',           label: 'Other',                icon: 'ellipsis-horizontal-outline' as const },
];

async function uploadDisputePhoto(userId: string, localUri: string, index: number): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Network error creating blob'));
    xhr.responseType = 'blob';
    xhr.open('GET', localUri, true);
    xhr.send(null);
  });
  const ref = storageRef(storage, `disputes/${userId}/${Date.now()}_${index}.jpg`);
  await uploadBytes(ref, blob);
  return getDownloadURL(ref);
}

export default function ClientDisputeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [category, setCategory]       = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos]           = useState<string[]>([]);
  const [uploading, setUploading]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take photos for your dispute.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (result.canceled) return;
    setPhotos((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  }

  async function handleSubmit() {
    if (!category || !description.trim() || !user?.uid || !id) return;
    setSubmitting(true);
    setUploading(photos.length > 0);
    try {
      const photoUrls = await Promise.all(
        photos.map((uri, i) => uploadDisputePhoto(user.uid!, uri, i))
      );
      setUploading(false);

      // Resolve the detailer up front so it can be stored on the dispute
      // (the detailer needs it to read the dispute under security rules).
      const invoiceSnap = await getDoc(doc(db, 'invoices', id));
      const detailerId = invoiceSnap.exists() ? String(invoiceSnap.data().detailerId ?? '') : '';

      await addDoc(collection(db, 'disputes'), {
        invoiceId: id,
        bookingId: id,
        clientId: user.uid,
        detailerId,
        category,
        description: description.trim(),
        photoUrls,
        status: 'open',
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'invoices', id), { status: 'disputed' });

      // The detailer is notified server-side by the onDisputeCreated Cloud Function.

      Alert.alert(
        'Dispute Submitted',
        'Our team will review your case within 24 hours. You will be contacted via email.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch {
      setUploading(false);
      Alert.alert('Error', 'Could not submit your dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!category && description.trim().length >= 20 && photos.length > 0 && !submitting;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.eyebrow}>REVV</Text>
            <Text style={styles.headerTitle}>Raise a Dispute</Text>
          </View>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.warningBox}>
            <Ionicons name="shield-outline" size={18} color={C.gold} />
            <Text style={styles.warningText}>
              Disputes pause payment release. Our team reviews all cases within 24 hours.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>What went wrong?</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(({ key, label, icon }) => {
              const active = category === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setCategory(key)}
                >
                  <Ionicons name={icon} size={18} color={active ? C.navy : C.muted} />
                  <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Describe the issue</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Please describe what happened in detail (minimum 20 characters)…"
            placeholderTextColor={C.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>

          {/* ── Photo evidence (required) ── */}
          <Text style={styles.sectionLabel}>Photo evidence</Text>
          <Text style={styles.photoHint}>Take at least one photo showing the issue. Up to {MAX_PHOTOS} photos.</Text>
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
              Disputes are reviewed by the REVV team. Both parties will be contacted. Resolution typically takes 1–3 business days.
            </Text>
          </View>

          <Pressable
            style={[styles.submitBtn, (!canSubmit) && styles.submitBtnOff]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color={C.white} size="small" />
                <Text style={styles.submitBtnText}>
                  {uploading ? 'Uploading photos…' : 'Submitting…'}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="flag" size={17} color={C.white} />
                <Text style={styles.submitBtnText}>Submit Dispute</Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.cancelLink} onPress={() => router.back()}>
            <Text style={styles.cancelLinkText}>Never mind, go back</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  backBtn:      { padding: 4 },
  headerCenter: { flex: 1 },
  eyebrow:      { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 1 },
  headerTitle:  { color: C.white, fontSize: 20, fontWeight: '900' },

  scroll:        { flex: 1, backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  scrollContent: { padding: 22, paddingBottom: 48, gap: 8 },

  warningBox: {
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
  warningText: { color: C.navy, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },

  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 10,
  },

  categoryGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.card,
  },
  categoryChipActive: { backgroundColor: C.gold, borderColor: C.gold },
  categoryLabel:      { color: C.muted, fontSize: 13, fontWeight: '600' },
  categoryLabelActive:{ color: C.navy, fontWeight: '700' },

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

  photoRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  photoThumb:   { width: 80, height: 80, borderRadius: 12, overflow: 'visible' },
  photoImg:     { width: 80, height: 80, borderRadius: 12 },
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
  photoHint:             { color: C.muted, fontSize: 12, lineHeight: 17, marginBottom: 10, marginTop: -4 },
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
    backgroundColor: C.red,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitBtnOff:  { opacity: 0.4 },
  submitBtnText: { color: C.white, fontSize: 15, fontWeight: '900' },

  cancelLink:     { alignItems: 'center', paddingVertical: 14 },
  cancelLinkText: { color: C.muted, fontSize: 14, fontWeight: '600' },
});
