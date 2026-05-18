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

const COLORS = {
  bg: '#0D1B2A',
  card: '#162232',
  content: '#F5F7FA',
  white: '#FFFFFF',
  gold: '#C9A227',
  blue: '#1A3A5C',
  gray: '#8FA3B1',
  muted: '#6B7885',
  border: '#E2E8F0',
  green: '#27AE60',
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
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
      // Check if invoice already exists (idempotent)
      const invoiceRef = doc(db, 'invoices', id);
      const existing = await getDoc(invoiceRef);
      if (existing.exists()) {
        router.replace({ pathname: '/detailer/invoice/[id]', params: { id } });
        return;
      }

      // Load booking data for invoice
      const bookingSnap = await getDoc(doc(db, 'bookings', id));
      if (!bookingSnap.exists()) throw new Error('Booking not found');
      const b = bookingSnap.data();

      let afterPhotos: string[] = [];

      if (!skipPhotos) {
        const filled = photos.map((uri, i) => ({ uri, i })).filter((x) => x.uri !== null) as { uri: string; i: number }[];
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
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', msg);
      setUploading(false);
    }
  }

  const filledCount = photos.filter(Boolean).length;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.gray} />
        </Pressable>
        <Text style={styles.brand}>
          <Text style={styles.brandRe}>RE</Text>
          <Text style={styles.brandVV}>VV</Text>
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.celebrationBlock}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={32} color={COLORS.white} />
          </View>
          <Text style={styles.celebrationTitle}>Job Complete!</Text>
          <Text style={styles.celebrationSub}>Upload after photos to finalize the job record, then generate the invoice.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>After Photos</Text>
          <Text style={styles.sectionSub}>Show the finished work. At least one photo recommended.</Text>

          <View style={styles.grid}>
            {photos.map((uri, i) => (
              <Pressable key={i} style={styles.photoCell} onPress={() => pickPhoto(i)}>
                {uri ? (
                  <Image source={{ uri }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={26} color={COLORS.muted} />
                    <Text style={styles.photoPlaceholderText}>Add photo</Text>
                  </View>
                )}
                {uri && (
                  <View style={styles.photoEditBadge}>
                    <Ionicons name="create-outline" size={12} color={COLORS.white} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {filledCount > 0 && (
            <Text style={styles.photoCount}>{filledCount} photo{filledCount !== 1 ? 's' : ''} ready</Text>
          )}
        </View>

        <Pressable
          style={[styles.btnSubmit, (uploading || filledCount === 0) && styles.btnDisabled]}
          onPress={() => handleSubmit(false)}
          disabled={uploading || filledCount === 0}
        >
          {uploading ? (
            <ActivityIndicator color={COLORS.blue} size="small" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={18} color={COLORS.blue} />
              <Text style={styles.btnSubmitText}>Upload & Generate Invoice</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={styles.btnSkip}
          onPress={() => handleSubmit(true)}
          disabled={uploading}
        >
          <Text style={styles.btnSkipText}>Skip photos — generate invoice now</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backBtn: { padding: 4 },
  brand: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  brandRe: { color: COLORS.white },
  brandVV: { color: COLORS.gold },

  scroll: { paddingHorizontal: 20 },

  celebrationBlock: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  checkCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationTitle: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '900',
  },
  celebrationSub: {
    color: COLORS.gray,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  section: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: { color: COLORS.blue, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sectionSub: { color: COLORS.muted, fontSize: 13, marginBottom: 16 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCell: {
    width: '47.5%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EEF2F7',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  photoEditBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    padding: 4,
  },
  photoCount: {
    color: COLORS.green,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },

  btnSubmit: {
    backgroundColor: COLORS.gold,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  btnDisabled: { opacity: 0.4 },
  btnSubmitText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },

  btnSkip: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  btnSkipText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
});
