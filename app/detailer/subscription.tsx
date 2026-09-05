import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
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
  green:   '#27AE60',
  greenDim:'rgba(39,174,96,0.10)',
  red:     '#D93025',
  redDim:  'rgba(217,48,37,0.08)',
};

const PLAN_PRICE = '$34.99';

// Billing lives on the web. Revv Pro unlocks marketplace visibility, which reads
// as in-app functionality under App Store guideline 3.1.1, so the purchase is
// not presented here — this screen reflects status and sends people to the web.
const SUBSCRIBE_URL = 'https://revvapp.github.io/revvapp/subscribe/';

const BENEFITS = [
  { icon: 'search-outline'        as const, text: 'Appear in client search and on the map' },
  { icon: 'calendar-outline'      as const, text: 'Accept unlimited bookings — no per-job fee beyond the 10% platform rate' },
  { icon: 'shield-checkmark-outline' as const, text: 'Revv Care damage protection on every job you complete' },
  { icon: 'videocam-outline'      as const, text: 'Revv Reach — auto-generated before/after reels for your socials' },
  { icon: 'star-outline'          as const, text: 'Verified badge and rating profile' },
];

/**
 * Maps the Stripe-owned subscription status onto what the detailer sees. The app
 * never writes these — the webhook mirrors Stripe onto users.subscriptionStatus,
 * so this screen is purely a reflection of it.
 */
function statusCopy(status: string | null): {
  tone: 'good' | 'warn' | 'none';
  title: string;
  body: string;
} {
  switch (status) {
    case 'trialing':
      return { tone: 'good', title: 'Free trial active', body: 'Your card is on file and will be charged automatically when the trial ends.' };
    case 'active':
      return { tone: 'good', title: 'Subscription active', body: `You're billed ${PLAN_PRICE} monthly. Your profile is visible to clients.` };
    case 'past_due':
      return { tone: 'warn', title: 'Payment failed', body: 'We could not charge your card. Update it in Stripe to stay visible to clients.' };
    case 'incomplete':
      return { tone: 'warn', title: 'Setup incomplete', body: 'Your card was not confirmed. Start again to finish setting up billing.' };
    case 'canceled':
      return { tone: 'warn', title: 'Subscription canceled', body: 'Your profile is hidden from clients. Resubscribe to go live again.' };
    default:
      return { tone: 'none', title: 'Not subscribed', body: 'Start your free trial to appear in client search.' };
  }
}

export default function DetailerSubscriptionScreen() {
  const { user } = useAuth();

  const [status, setStatus]           = useState<string | null>(null);
  const [isFoundingPro, setFounding]  = useState(false);
  const [loading, setLoading]         = useState(true);

  // Live-follow the user doc so the screen flips to "active" the moment the
  // Stripe webhook lands, without the detailer having to pull to refresh.
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const d = snap.data();
        setStatus(d?.subscriptionStatus ? String(d.subscriptionStatus) : null);
        setFounding(d?.isFoundingPro === true);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user?.uid]);

  const entitled  = status === 'active' || status === 'trialing';
  const trialDays = isFoundingPro ? 60 : 14;

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={C.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const copy = statusCopy(status);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>REVV PRO</Text>
          <Text style={styles.headerTitle}>Your Subscription</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.statusCard,
            copy.tone === 'good' && styles.statusCardGood,
            copy.tone === 'warn' && styles.statusCardWarn,
          ]}
        >
          <Ionicons
            name={copy.tone === 'good' ? 'checkmark-circle' : copy.tone === 'warn' ? 'alert-circle' : 'information-circle-outline'}
            size={20}
            color={copy.tone === 'good' ? C.green : copy.tone === 'warn' ? C.red : C.muted}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{copy.title}</Text>
            <Text style={styles.statusBody}>{copy.body}</Text>
          </View>
        </View>

        {isFoundingPro && (
          <View style={styles.foundingCard}>
            <Ionicons name="ribbon" size={18} color={C.gold} />
            <Text style={styles.foundingText}>
              Founding Pro — one of Revv’s first 25 detailers. You get a 60-day trial and a permanent badge.
            </Text>
          </View>
        )}

        <View style={styles.planCard}>
          <Text style={styles.planName}>Revv Pro</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{PLAN_PRICE}</Text>
            <Text style={styles.per}>/month</Text>
          </View>
          {!entitled && (
            <Text style={styles.trialLine}>
              {trialDays} days free, then {PLAN_PRICE}/mo. Cancel anytime.
            </Text>
          )}

          <View style={styles.divider} />

          {BENEFITS.map((b) => (
            <View key={b.text} style={styles.benefitRow}>
              <Ionicons name={b.icon} size={17} color={C.gold} />
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        {entitled ? (
          <View style={styles.manageCard}>
            <Ionicons name="information-circle-outline" size={16} color={C.muted} />
            <Text style={styles.manageText}>
              To update your card or cancel, contact support@revvapp.net. Billing changes are
              handled by our team so your marketplace visibility stays in sync.
            </Text>
          </View>
        ) : (
          <View>
            <Text style={styles.webNote}>
              {status === 'canceled' || status === 'past_due'
                ? 'Resubscribe at revvapp.github.io to go live again.'
                : `Start your ${trialDays}-day free trial at revvapp.github.io. Sign in with this same email — your status here updates as soon as it goes through.`}
            </Text>
            <Pressable style={styles.cta} onPress={() => Linking.openURL(SUBSCRIBE_URL)}>
              <Ionicons name="open-outline" size={17} color={C.navy} />
              <Text style={styles.ctaText}>
                {status === 'canceled' || status === 'past_due' ? 'Resubscribe' : 'Manage on the web'}
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.finePrint}>
          Your subscription is separate from job payouts. Revv takes a 10% platform fee on each
          completed job; the remaining 90% is transferred to your connected Stripe account.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  scrollContent: { padding: 22, paddingBottom: 48, gap: 14 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  statusCardGood: { backgroundColor: C.greenDim, borderColor: 'rgba(39,174,96,0.25)' },
  statusCardWarn: { backgroundColor: C.redDim,   borderColor: 'rgba(217,48,37,0.25)' },
  statusTitle:    { color: C.navy, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  statusBody:     { color: C.muted, fontSize: 12.5, lineHeight: 18 },

  foundingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.goldDim,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
  },
  foundingText: { color: C.navy, fontSize: 12.5, fontWeight: '600', flex: 1, lineHeight: 18 },

  planCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  planName:  { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  priceRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 6 },
  price:     { color: C.navy, fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  per:       { color: C.muted, fontSize: 15, fontWeight: '600', marginBottom: 7 },
  trialLine: { color: C.gold, fontSize: 13, fontWeight: '700', marginTop: 4 },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 16 },

  benefitRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  benefitText: { color: C.navy, fontSize: 13.5, flex: 1, lineHeight: 19 },


  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.gold,
    borderRadius: 16,
    paddingVertical: 17,
  },
  ctaText: { color: C.navy, fontSize: 15, fontWeight: '900' },
  webNote: { color: C.muted, fontSize: 12.5, lineHeight: 18, marginBottom: 12, textAlign: 'center' },

  manageCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  manageText: { color: C.muted, fontSize: 12, lineHeight: 17, flex: 1 },

  finePrint: { color: C.gray, fontSize: 11.5, lineHeight: 16, textAlign: 'center', paddingHorizontal: 8 },
});
