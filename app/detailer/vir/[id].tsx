import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  red: '#D93025',
};

const PANELS = [
  { key: 'front',         label: 'Front',          icon: 'arrow-up-circle-outline' },
  { key: 'rear',          label: 'Rear',            icon: 'arrow-down-circle-outline' },
  { key: 'driverSide',    label: 'Driver Side',     icon: 'arrow-back-circle-outline' },
  { key: 'passengerSide', label: 'Passenger Side',  icon: 'arrow-forward-circle-outline' },
  { key: 'roof',          label: 'Roof / Top',      icon: 'chevron-up-circle-outline' },
  { key: 'interior',      label: 'Interior',        icon: 'color-palette-outline' },
] as const;

type PanelKey = typeof PANELS[number]['key'];

type PanelState = {
  localUri: string | null;
  photoUrl: string | null;
  notes: string;
  uploading: boolean;
};

const defaultPanel = (): PanelState => ({
  localUri: null,
  photoUrl: null,
  notes: '',
  uploading: false,
});

async function uploadPanelPhoto(bookingId: string, panel: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const ref = storageRef(storage, `vir/${bookingId}/${panel}.jpg`);
  await uploadBytes(ref, blob);
  return getDownloadURL(ref);
}

export default function VIRCaptureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [panels, setPanels] = useState<Record<PanelKey, PanelState>>(
    Object.fromEntries(PANELS.map((p) => [p.key, defaultPanel()])) as Record<PanelKey, PanelState>
  );
  const [submitting, setSubmitting] = useState(false);

  function updatePanel(key: PanelKey, patch: Partial<PanelState>) {
    setPanels((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function handleTakePhoto(key: PanelKey) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access required', 'Please allow camera access to take inspection photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.75,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const localUri = result.assets[0].uri;
    updatePanel(key, { localUri, uploading: true, photoUrl: null });

    try {
      const url = await uploadPanelPhoto(id!, key, localUri);
      updatePanel(key, { photoUrl: url, uploading: false });
    } catch {
      updatePanel(key, { uploading: false });
      Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
    }
  }

  async function handleSubmit() {
    const allDone = PANELS.every((p) => panels[p.key].photoUrl !== null);
    if (!allDone) {
      Alert.alert('Missing photos', 'Please take a photo of every panel before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const virPanels: Record<string, { photoUrl: string; notes: string }> = {};
      for (const p of PANELS) {
        virPanels[p.key] = {
          photoUrl: panels[p.key].photoUrl!,
          notes: panels[p.key].notes.trim(),
        };
      }
      await updateDoc(doc(db, 'bookings', id!), {
        status: 'vir_submitted',
        virSubmittedAt: serverTimestamp(),
        virPanels,
      });
      Alert.alert(
        'Inspection Submitted',
        'The client has been notified to review and sign the inspection report.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit inspection.');
    } finally {
      setSubmitting(false);
    }
  }

  const completedCount = PANELS.filter((p) => panels[p.key].photoUrl !== null).length;
  const allDone = completedCount === PANELS.length;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Vehicle Inspection</Text>
          <Text style={styles.headerSub}>{completedCount} of {PANELS.length} panels complete</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.gold} />
            <Text style={styles.infoText}>
              Photograph each panel of the vehicle. Note any pre-existing damage. The client must sign this report before the job timer starts.
            </Text>
          </View>

          {PANELS.map((panel) => {
            const state = panels[panel.key];
            const hasPhoto = state.photoUrl !== null;

            return (
              <View key={panel.key} style={[styles.panelCard, hasPhoto && styles.panelCardDone]}>
                <View style={styles.panelHeader}>
                  <View style={styles.panelLabelRow}>
                    <Ionicons
                      name={panel.icon as any}
                      size={18}
                      color={hasPhoto ? COLORS.green : COLORS.blue}
                    />
                    <Text style={styles.panelLabel}>{panel.label}</Text>
                  </View>
                  {hasPhoto && (
                    <View style={styles.doneBadge}>
                      <Ionicons name="checkmark" size={12} color={COLORS.white} />
                    </View>
                  )}
                </View>

                {state.localUri ? (
                  <Pressable onPress={() => handleTakePhoto(panel.key)} style={styles.photoWrap}>
                    <Image source={{ uri: state.localUri }} style={styles.photo} />
                    {state.uploading && (
                      <View style={styles.uploadOverlay}>
                        <ActivityIndicator color={COLORS.white} />
                        <Text style={styles.uploadingText}>Uploading…</Text>
                      </View>
                    )}
                    {!state.uploading && (
                      <View style={styles.retakeOverlay}>
                        <Ionicons name="camera" size={16} color={COLORS.white} />
                        <Text style={styles.retakeText}>Retake</Text>
                      </View>
                    )}
                  </Pressable>
                ) : (
                  <Pressable style={styles.cameraBtn} onPress={() => handleTakePhoto(panel.key)}>
                    <Ionicons name="camera-outline" size={28} color={COLORS.gold} />
                    <Text style={styles.cameraBtnText}>Take Photo</Text>
                  </Pressable>
                )}

                <TextInput
                  style={styles.notesInput}
                  placeholder="Note pre-existing damage (optional)"
                  placeholderTextColor={COLORS.gray}
                  value={state.notes}
                  onChangeText={(t) => updatePanel(panel.key, { notes: t })}
                  multiline
                  numberOfLines={2}
                />
              </View>
            );
          })}

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.submitBtn, (!allDone || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!allDone || submitting}
        >
          {submitting
            ? <ActivityIndicator color={COLORS.blue} />
            : (
              <>
                <Ionicons name="send-outline" size={18} color={COLORS.blue} />
                <Text style={styles.submitBtnText}>Submit Inspection to Client</Text>
              </>
            )
          }
        </Pressable>
        {!allDone && (
          <Text style={styles.footerHint}>{PANELS.length - completedCount} panel{PANELS.length - completedCount !== 1 ? 's' : ''} still need photos</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
  headerSub: { color: COLORS.gold, fontSize: 12, fontWeight: '700', marginTop: 2 },
  body: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bodyContent: { padding: 16 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0D070',
    padding: 12,
    marginBottom: 16,
  },
  infoText: { color: COLORS.blue, fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 },
  panelCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  panelCardDone: { borderColor: COLORS.green },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelLabel: { color: COLORS.blue, fontSize: 15, fontWeight: '800' },
  doneBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    height: 110,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAFBFC',
    marginBottom: 10,
  },
  cameraBtnText: { color: COLORS.gold, fontSize: 13, fontWeight: '700' },
  photoWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 10, position: 'relative' },
  photo: { width: '100%', height: 160, borderRadius: 12 },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadingText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  retakeOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retakeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  notesInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.blue,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 20,
    paddingBottom: 34,
    gap: 8,
  },
  submitBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: { backgroundColor: '#E2CFA0' },
  submitBtnText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },
  footerHint: { color: COLORS.muted, fontSize: 12, textAlign: 'center' },
});
