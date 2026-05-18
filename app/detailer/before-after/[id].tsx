import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db, storage } from '@/firebaseConfig';

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
  blue:   '#1A3A5C',
};

async function uploadAfterPhoto(bookingId: string, index: number, localUri: string): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Network error uploading photo'));
    xhr.responseType = 'blob';
    xhr.open('GET', localUri, true);
    xhr.send(null);
  });
  const ref = storageRef(storage, `after-photos/${bookingId}/after_${index}.jpg`);
  await uploadBytes(ref, blob);
  return getDownloadURL(ref);
}

export default function BeforeAfterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [uploading, setUploading] = useState(false);

  async function pickPhoto(index: number) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const updated = [...photos];
      updated[index] = result.assets[0].uri;
      setPhotos(updated);
    }
  }

  async function handleSubmit(skipPhotos: boolean) {
    if (!id) return;
    setUploading(true);
    try {
      const invoiceRef = doc(db, 'invoices', id);
      const existing = await getDoc(invoiceRef);
      if (existing.exists()) {
        router.replace({ pathname: '/detailer/invoice/[id]', params: { id } });
        return;
      }

      const bookingSnap = await getDoc(doc(db, 'bookings', id));
      if (!bookingSnap.exists()) throw new Error('Booking not found');
      const b = bookingSnap.data();

      let afterPhotos: string[] = [];
      if (!skipPhotos) {
        const filled = photos
          .map((uri, i) => ({ uri, i }))
          .filter((x) => x.uri !== null) as { uri: string; i: number }[];
        afterPhotos = await Promise.all(filled.map(({ uri, i }) => uploadAfterPhoto(id, i, uri)));
        await updateDoc(doc(db, 'bookings', id), { afterPhotos });
      }

      const price = Number(b.price ?? 0);
      const platformFee = Math.round(price * 0.1 * 100) / 100;
      const detailerPayout = Math.round((price - platformFee) * 100) / 100;

      await setDoc(invoiceRef, {
        bookingId: id,
        clientId: String(b.clientId ?? ''),
        detailerId: String(b.detailerId ?? ''),
        clientName: String(b.clientName ?? ''),
        detailerName: String(b.detailerName ?? ''),
        businessName: b.businessName ?? null,
        vehicleLabel: String(b.vehicleLabel ?? ''),
        service: String(b.service ?? ''),
        date: String(b.date ?? ''),
        price,
        platformFee,
        detailerPayout,
        status: 'pending_release',
        afterPhotos,
        createdAt: serverTimestamp(),
      });

      router.replace({ pathname: '/detailer/invoice/[id]', params: { id } });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
      setUploading(false);
    }
  }

  const filledCount = photos.filter(Boolean).length;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.gray} />
        </Pressable>
        <Text style={styles.brand}>
          <Text style={styles.brandRe}>RE</Text>
          <Text style={styles.brandVV}>VV</Text>
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Celebration block */}
        <View style={styles.celebBlock}>
          <View style={styles.checkRing}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={30} color={C.white} />
            </View>
          </View>
          <Text style={styles.celebTitle}>Job Complete!</Text>
          <Text style={styles.celebSub}>
            Document your work with after photos, then generate the invoice.
          </Text>
        </View>

        {/* Photo section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>After Photos</Text>
            {filledCount > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{filledCount} added</Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSub}>Showcase your finished work — recommended for professional invoices</Text>

          <View style={styles.grid}>
            {photos.map((uri, i) => (
              <Pressable key={i} style={[styles.photoSlot, uri && styles.photoSlotFilled]} onPress={() => pickPhoto(i)}>
                {uri ? (
                  <>
                    <Image source={{ uri }} style={styles.photo} contentFit="cover" />
                    <View style={styles.editBadge}>
                      <Ionicons name="create" size={11} color={C.white} />
                    </View>
                    <View style={styles.doneCorner}>
                      <Ionicons name="checkmark" size={10} color={C.white} />
                    </View>
                  </>
                ) : (
                  <View style={styles.emptySlot}>
                    <View style={styles.cameraRing}>
                      <Ionicons name="camera-outline" size={22} color={C.gold} />
                    </View>
                    <Text style={styles.addPhotoText}>Add photo</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btnPrimary, (uploading || filledCount === 0) && styles.btnPrimaryDisabled]}
            onPress={() => handleSubmit(false)}
            disabled={uploading || filledCount === 0}
          >
            {uploading ? (
              <ActivityIndicator color={C.blue} size="small" />
            ) : (
              <>
                <Ionicons name="document-text" size={18} color={filledCount > 0 ? C.blue : C.muted} />
                <Text style={[styles.btnPrimaryText, filledCount === 0 && styles.btnPrimaryTextDisabled]}>
                  Upload & Generate Invoice
                </Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.btnSkip} onPress={() => handleSubmit(true)} disabled={uploading}>
            <Text style={styles.btnSkipText}>Skip photos — generate invoice now</Text>
            <Ionicons name="chevron-forward" size={14} color={C.muted} />
          </Pressable>
        </View>

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
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: { padding: 4, width: 40 },
  brand: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  brandRe: { color: C.white },
  brandVV: { color: C.gold },

  scroll: { paddingHorizontal: 20 },

  celebBlock: { alignItems: 'center', paddingVertical: 32, gap: 14 },
  checkRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: 'rgba(201,162,39,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebTitle: { color: C.white, fontSize: 28, fontWeight: '900', letterSpacing: 0.5 },
  celebSub: {
    color: C.gray,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  section: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  countPill: { backgroundColor: 'rgba(201,162,39,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(201,162,39,0.3)' },
  countPillText: { color: C.gold, fontSize: 11, fontWeight: '800' },
  sectionSub: { color: C.muted, fontSize: 12, lineHeight: 17, marginBottom: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoSlot: {
    width: '47.5%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    position: 'relative',
  },
  photoSlotFilled: { borderStyle: 'solid', borderColor: C.gold },
  photo: { width: '100%', height: '100%' },
  emptySlot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  cameraRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(201,162,39,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  editBadge: {
    position: 'absolute',
    bottom: 7,
    right: 7,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    padding: 5,
  },
  doneCorner: {
    position: 'absolute',
    top: 7,
    left: 7,
    backgroundColor: C.green,
    borderRadius: 999,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actions: { gap: 12 },
  btnPrimary: {
    backgroundColor: C.gold,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimaryDisabled: { backgroundColor: '#2A3A4A', borderWidth: 1, borderColor: C.border },
  btnPrimaryText: { color: C.blue, fontSize: 15, fontWeight: '900' },
  btnPrimaryTextDisabled: { color: C.muted },
  btnSkip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
  },
  btnSkipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
});
