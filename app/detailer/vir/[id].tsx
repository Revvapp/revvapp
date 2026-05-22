import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
import { sendPushToUser } from '@/lib/pushNotification';

const C = {
  bg:      '#0D1B2A',
  card:    '#FFFFFF',
  diag:    '#0F1C2A',
  blue:    '#1A3A5C',
  gold:    '#C9A227',
  gray:    '#B7C1CC',
  muted:   '#6B7885',
  border:  '#E2E8F0',
  white:   '#FFFFFF',
  green:   '#27AE60',
  content: '#F5F7FA',
};

const PANELS = [
  { key: 'front',         label: 'Front',          short: 'FRONT'  },
  { key: 'rear',          label: 'Rear',           short: 'REAR'   },
  { key: 'driverSide',    label: 'Driver Side',    short: 'DRIVER' },
  { key: 'passengerSide', label: 'Passenger Side', short: 'PASS'   },
  { key: 'roof',          label: 'Roof / Top',     short: 'ROOF'   },
  { key: 'interior',      label: 'Interior',       short: 'INT'    },
] as const;

type PanelKey = typeof PANELS[number]['key'];

type PanelState = {
  localUri: string | null;
  photoUrl: string | null;
  notes: string;
  uploading: boolean;
};

const defaultPanel = (): PanelState => ({ localUri: null, photoUrl: null, notes: '', uploading: false });

async function uploadPanelPhoto(bookingId: string, panel: string, localUri: string): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Network error creating blob'));
    xhr.responseType = 'blob';
    xhr.open('GET', localUri, true);
    xhr.send(null);
  });
  const ref = storageRef(storage, `vir/${bookingId}/${panel}.jpg`);
  await uploadBytes(ref, blob);
  return getDownloadURL(ref);
}

function getZoneColors(done: boolean, selected: boolean) {
  if (selected && done)  return { bg: C.gold,                      border: C.gold,     text: '#0D1B2A' };
  if (selected && !done) return { bg: 'rgba(201,162,39,0.14)',      border: C.gold,     text: C.gold };
  if (!selected && done) return { bg: 'rgba(39,174,96,0.18)',       border: C.green,    text: C.green };
  return                        { bg: '#162537',                    border: '#1E3348',  text: '#3E5870' };
}

function CarDiagram({
  panels,
  selected,
  onSelect,
}: {
  panels: Record<PanelKey, PanelState>;
  selected: PanelKey;
  onSelect: (k: PanelKey) => void;
}) {
  function Zone({
    pKey,
    style,
    vertical,
  }: {
    pKey: PanelKey;
    style?: object;
    vertical?: boolean;
  }) {
    const done = panels[pKey].photoUrl !== null;
    const sel = selected === pKey;
    const zc = getZoneColors(done, sel);
    const meta = PANELS.find((p) => p.key === pKey)!;
    return (
      <Pressable
        style={[diagStyles.zone, { backgroundColor: zc.bg, borderColor: zc.border }, style]}
        onPress={() => onSelect(pKey)}
      >
        {vertical ? (
          <Text style={[diagStyles.sideText, { color: zc.text }]}>
            {meta.short.split('').join('\n')}
          </Text>
        ) : (
          <Text style={[diagStyles.zoneText, { color: zc.text }]}>{meta.short}</Text>
        )}
        {done && (
          <View style={diagStyles.checkDot}>
            <Ionicons name="checkmark" size={9} color={sel ? '#0D1B2A' : C.white} />
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View style={diagStyles.wrap}>
      <View style={diagStyles.carBody}>
        <Zone pKey="front" style={diagStyles.zFront} />
        <View style={diagStyles.middleRow}>
          <Zone pKey="driverSide"    style={diagStyles.zSide} vertical />
          <Zone pKey="roof"          style={diagStyles.zRoof} />
          <Zone pKey="passengerSide" style={diagStyles.zSide} vertical />
        </View>
        <Zone pKey="rear" style={diagStyles.zRear} />
      </View>
      <Zone pKey="interior" style={diagStyles.zInterior} />
    </View>
  );
}

const diagStyles = StyleSheet.create({
  wrap: { backgroundColor: C.diag, borderRadius: 18, padding: 10, gap: 6, marginBottom: 14 },
  carBody: { gap: 3 },
  middleRow: { flexDirection: 'row', gap: 3 },
  zone: {
    borderWidth: 1.5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  zFront:    { height: 52, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  zSide:     { width: 52, height: 110 },
  zRoof:     { flex: 1, height: 110 },
  zRear:     { height: 52, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  zInterior: { height: 52, borderRadius: 10, flexDirection: 'row', gap: 6 },
  zoneText:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  sideText:  { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center', lineHeight: 13 },
  checkDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function VIRCaptureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [panels, setPanels] = useState<Record<PanelKey, PanelState>>(
    Object.fromEntries(PANELS.map((p) => [p.key, defaultPanel()])) as Record<PanelKey, PanelState>
  );
  const [selected, setSelected] = useState<PanelKey>('front');
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
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const localUri = result.assets[0].uri;
    updatePanel(key, { localUri, uploading: true, photoUrl: null });
    try {
      const url = await uploadPanelPhoto(id!, key, localUri);
      updatePanel(key, { photoUrl: url, uploading: false });
    } catch (err) {
      updatePanel(key, { uploading: false });
      Alert.alert('Upload failed', err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSubmit() {
    if (!PANELS.every((p) => panels[p.key].photoUrl !== null)) {
      Alert.alert('Missing photos', 'Please take a photo of every panel before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const virPanels: Record<string, { photoUrl: string; notes: string }> = {};
      for (const p of PANELS) {
        virPanels[p.key] = { photoUrl: panels[p.key].photoUrl!, notes: panels[p.key].notes.trim() };
      }
      await updateDoc(doc(db, 'bookings', id!), { status: 'vir_submitted', virSubmittedAt: serverTimestamp(), virPanels });
      const bookingSnap = await getDoc(doc(db, 'bookings', id!));
      const clientId = bookingSnap.data()?.clientId as string | undefined;
      if (clientId) {
        const clientSnap = await getDoc(doc(db, 'clients', clientId));
        const token = clientSnap.data()?.expoPushToken as string | undefined;
        await sendPushToUser(token, 'Inspection Ready to Sign', 'Your detailer has completed the pre-inspection. Please review and sign.', { bookingId: id! });
      }
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
  const selState = panels[selected];
  const selMeta = PANELS.find((p) => p.key === selected)!;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Vehicle Inspection</Text>
          <View style={styles.progressDots}>
            {PANELS.map((p) => (
              <View
                key={p.key}
                style={[styles.dot, panels[p.key].photoUrl ? styles.dotDone : styles.dotEmpty]}
              />
            ))}
          </View>
        </View>
        <Text style={styles.headerCount}>{completedCount}/{PANELS.length}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info tip */}
          <View style={styles.tip}>
            <Ionicons name="information-circle" size={15} color={C.gold} />
            <Text style={styles.tipText}>
              Tap each zone on the diagram, photograph it, and note any pre-existing damage. The client signs before the job starts.
            </Text>
          </View>

          {/* Car diagram */}
          <CarDiagram panels={panels} selected={selected} onSelect={setSelected} />

          {/* Selected panel detail card */}
          <View style={styles.panelCard}>
            <View style={styles.panelCardHeader}>
              <View style={styles.panelTitleRow}>
                <View style={[styles.panelDot, { backgroundColor: selState.photoUrl ? C.green : C.gold }]} />
                <Text style={styles.panelName}>{selMeta.label}</Text>
              </View>
              {selState.photoUrl && (
                <View style={styles.donePill}>
                  <Ionicons name="checkmark-circle" size={14} color={C.green} />
                  <Text style={styles.donePillText}>Photo captured</Text>
                </View>
              )}
            </View>

            {selState.localUri ? (
              <Pressable onPress={() => handleTakePhoto(selected)} style={styles.photoWrap}>
                <Image source={{ uri: selState.localUri }} style={styles.photo} contentFit="cover" />
                {selState.uploading && (
                  <View style={styles.overlay}>
                    <ActivityIndicator color={C.white} size="large" />
                    <Text style={styles.overlayText}>Uploading…</Text>
                  </View>
                )}
                {!selState.uploading && (
                  <View style={styles.retakeBadge}>
                    <Ionicons name="camera" size={13} color={C.white} />
                    <Text style={styles.retakeText}>Retake</Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <Pressable style={styles.cameraSlot} onPress={() => handleTakePhoto(selected)}>
                <View style={styles.cameraIcon}>
                  <Ionicons name="camera" size={28} color={C.gold} />
                </View>
                <Text style={styles.cameraSlotTitle}>Take Photo</Text>
                <Text style={styles.cameraSlotSub}>Tap to open camera</Text>
              </Pressable>
            )}

            <View style={styles.notesWrap}>
              <Text style={styles.notesLabel}>DAMAGE NOTES</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Note any pre-existing damage (optional)"
                placeholderTextColor="#9AA5B1"
                value={selState.notes}
                onChangeText={(t) => updatePanel(selected, { notes: t })}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Panel nav pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pillRow}>
            {PANELS.map((p) => {
              const done = panels[p.key].photoUrl !== null;
              const sel = selected === p.key;
              return (
                <Pressable
                  key={p.key}
                  style={[styles.pill, sel && styles.pillSelected, done && !sel && styles.pillDone]}
                  onPress={() => setSelected(p.key)}
                >
                  {done && <Ionicons name="checkmark-circle" size={12} color={sel ? '#0D1B2A' : C.green} />}
                  <Text style={[styles.pillText, sel && styles.pillTextSelected, done && !sel && styles.pillTextDone]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitBtn, (!allDone || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!allDone || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={C.blue} />
          ) : (
            <>
              <Ionicons name="send" size={16} color={allDone ? C.blue : C.muted} />
              <Text style={[styles.submitBtnText, !allDone && styles.submitBtnTextDisabled]}>
                Submit Inspection to Client
              </Text>
            </>
          )}
        </Pressable>
        {!allDone && (
          <Text style={styles.footerHint}>
            {PANELS.length - completedCount} panel{PANELS.length - completedCount !== 1 ? 's' : ''} still need photos
          </Text>
        )}
      </View>
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
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 6 },
  headerTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  progressDots: { flexDirection: 'row', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotDone:  { backgroundColor: C.gold },
  dotEmpty: { backgroundColor: '#2A3E55' },
  headerCount: { color: C.gold, fontSize: 15, fontWeight: '900', minWidth: 32, textAlign: 'right' },

  body: { flex: 1, backgroundColor: C.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bodyContent: { padding: 16 },

  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0D864',
    padding: 12,
    marginBottom: 14,
  },
  tipText: { color: C.blue, fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },

  panelCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
  },
  panelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelDot: { width: 10, height: 10, borderRadius: 5 },
  panelName: { color: C.blue, fontSize: 16, fontWeight: '900' },
  donePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F8EF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  donePillText: { color: C.green, fontSize: 11, fontWeight: '700' },

  cameraSlot: {
    height: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C9A22760',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cameraIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF8E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraSlotTitle: { color: C.blue, fontSize: 14, fontWeight: '800' },
  cameraSlotSub: { color: C.muted, fontSize: 12, fontWeight: '600' },

  photoWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 14, position: 'relative', height: 200 },
  photo: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  overlayText: { color: C.white, fontSize: 13, fontWeight: '700' },
  retakeBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  retakeText: { color: C.white, fontSize: 12, fontWeight: '700' },

  notesWrap: { gap: 6 },
  notesLabel: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  notesInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: C.blue,
    fontWeight: '600',
    minHeight: 60,
  },

  pillScroll: { marginBottom: 8 },
  pillRow: { gap: 8, paddingVertical: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.card,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillSelected: { backgroundColor: C.gold, borderColor: C.gold },
  pillDone:     { backgroundColor: '#E8F8EF', borderColor: C.green },
  pillText:     { color: C.muted, fontSize: 12, fontWeight: '700' },
  pillTextSelected: { color: '#0D1B2A' },
  pillTextDone:     { color: C.green },

  footer: {
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 18,
    paddingBottom: 34,
    gap: 8,
  },
  submitBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: { backgroundColor: '#E8D9A8' },
  submitBtnText: { color: C.blue, fontSize: 15, fontWeight: '900' },
  submitBtnTextDisabled: { color: C.muted },
  footerHint: { color: C.muted, fontSize: 12, textAlign: 'center' },
});
