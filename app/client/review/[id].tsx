import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
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

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { sendPushToUser } from '@/lib/pushNotifications';
import { getRecipientPushToken } from '@/lib/pushTokens';

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
  input:   '#F0F3F8',
};

export default function ClientReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const unsub = onSnapshot(doc(db, 'bookings', id), async (snap) => {
      if (cancelled) return;
      if (!snap.exists() || snap.data().status !== 'completed') {
        setGateError('Reviews can only be submitted for completed bookings.');
        setGateLoading(false);
        return;
      }
      const existing = await getDocs(query(collection(db, 'reviews'), where('bookingId', '==', id)));
      if (!cancelled) {
        if (existing.size > 0) setGateError('You have already reviewed this booking.');
        setGateLoading(false);
      }
    });
    return () => { cancelled = true; unsub(); };
  }, [id]);

  async function submit() {
    if (rating === 0 || !user?.uid || !id) return;
    setSubmitting(true);
    try {
      const bookingSnap = await getDoc(doc(db, 'bookings', id));
      if (!bookingSnap.exists()) throw new Error('Booking not found');
      const b = bookingSnap.data();

      // Keyed by bookingId so the database physically allows only one review
      // per booking (rules forbid updates, so a duplicate write is rejected).
      await setDoc(doc(db, 'reviews', id), {
        bookingId: id,
        clientId: user.uid,
        clientName: String(b.clientName ?? ''),
        detailerId: String(b.detailerId ?? ''),
        detailerName: String(b.detailerName ?? ''),
        businessName: String(b.businessName ?? ''),
        service: String(b.service ?? ''),
        vehicleLabel: String(b.vehicleLabel ?? ''),
        rating,
        body: body.trim(),
        createdAt: serverTimestamp(),
        verified: true,
      });

      await updateDoc(doc(db, 'bookings', id), { hasReview: true });

      const detailerId = String(b.detailerId ?? '');
      if (detailerId) {
        const token = await getRecipientPushToken(detailerId);
        sendPushToUser(
          token,
          'New Review!',
          `You received a ${rating}-star review. Check your profile to see what they said.`,
          { type: 'review' }
        );
      }

      Alert.alert(
        'Review Submitted',
        'Thank you! Your verified review has been posted.',
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('Error', 'Could not submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hovered || rating;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.eyebrow}>REVV</Text>
            <Text style={styles.headerTitle}>Leave a Review</Text>
          </View>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {gateLoading ? null : gateError ? (
            <View style={styles.gateWrap}>
              <Ionicons name="lock-closed-outline" size={36} color={C.muted} />
              <Text style={styles.gateTitle}>Review Locked</Text>
              <Text style={styles.gateBody}>{gateError}</Text>
              <Pressable style={styles.gateBtn} onPress={() => router.back()}>
                <Text style={styles.gateBtnText}>Go Back</Text>
              </Pressable>
            </View>
          ) : (
          <>
          {/* Verified badge */}
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={14} color={C.gold} />
            <Text style={styles.verifiedText}>Verified Revv Pay Review</Text>
          </View>

          {/* Stars */}
          <Text style={styles.sectionLabel}>Your Rating</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPressIn={() => setHovered(star)}
                onPressOut={() => setHovered(0)}
                onPress={() => setRating(star)}
                style={styles.starBtn}
              >
                <Ionicons
                  name={star <= displayRating ? 'star' : 'star-outline'}
                  size={38}
                  color={star <= displayRating ? C.gold : C.gray}
                />
              </Pressable>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
            </Text>
          )}

          {/* Review body */}
          <Text style={styles.sectionLabel}>Your Review</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Share your experience with this detailer…"
            placeholderTextColor={C.muted}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{body.length}/500</Text>

          <Pressable
            style={[styles.submitBtn, (rating === 0 || submitting) && styles.submitBtnOff]}
            onPress={submit}
            disabled={rating === 0 || submitting}
          >
            {submitting
              ? <ActivityIndicator color={C.navy} size="small" />
              : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={C.navy} />
                  <Text style={styles.submitBtnText}>Submit Review</Text>
                </>
              )
            }
          </Pressable>

          <Text style={styles.disclaimer}>
            Reviews are permanently tied to a completed Revv Pay transaction and cannot be edited after submission.
          </Text>
          </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  eyebrow: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 1 },
  headerTitle: { color: C.white, fontSize: 20, fontWeight: '900' },

  scroll: { flex: 1, backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  scrollContent: { padding: 24, paddingBottom: 48, gap: 8 },

  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.goldDim,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  verifiedText: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },

  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 12,
  },

  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  starBtn: { padding: 4 },
  ratingLabel: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 16,
  },

  textArea: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: C.navy,
    minHeight: 140,
    borderWidth: 1,
    borderColor: C.border,
    lineHeight: 22,
  },
  charCount: { color: C.gray, fontSize: 11, fontWeight: '600', alignSelf: 'flex-end', marginBottom: 8 },

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
  submitBtnOff: { opacity: 0.4 },
  submitBtnText: { color: C.navy, fontSize: 15, fontWeight: '900' },

  disclaimer: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 12,
  },

  gateWrap: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 24 },
  gateTitle: { color: C.navy, fontSize: 18, fontWeight: '800' },
  gateBody: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  gateBtn: {
    marginTop: 8,
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  gateBtnText: { color: C.navy, fontSize: 14, fontWeight: '900' },
});
