import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
};

const SUPPORT_EMAIL = 'support@revvapp.net';
const PRIVACY_URL = 'https://revvapp.github.io/revvapp/';

const FAQS = [
  {
    q: 'How does payment work?',
    a: 'When you book, your card is authorized (a hold, not a charge) for the job price. The detailer is paid once the job is marked complete and a 24-hour dispute window passes with no dispute raised — Revv takes a 10% platform fee from every job.',
  },
  {
    q: 'What is the dispute window?',
    a: "You have 24 hours after a job is marked complete to raise a dispute if something is wrong. Our team reviews every dispute and decides between releasing the payment, refunding you, or a partial refund — payment is held until that decision is made.",
  },
  {
    q: 'What is Revv Care?',
    a: 'Revv Care is damage protection on every completed job, covering up to $2,500 in accidental damage. File a claim from your invoice within 72 hours of the job completing, with photos — our team reviews and decides within a few business days.',
  },
  {
    q: 'How does the detailer subscription work?',
    a: 'Detailers pay $34.99/month to appear in client search and take bookings, with a free trial (60 days for Founding Pro, 14 days otherwise). If a payment fails, the profile is temporarily hidden from search until it is resolved.',
  },
  {
    q: 'How do I report a problem with a booking?',
    a: 'Open the booking or job in question and use "Report a Problem" — reports go directly and confidentially to our trust & safety team, and are never shown to the other party.',
  },
];

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable style={styles.faqCard} onPress={() => setOpen((v) => !v)}>
      <View style={styles.faqHead}>
        <Text style={styles.faqQ}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.gray} />
      </View>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </Pressable>
  );
}

export default function HelpScreen() {
  const { userType } = useAuth();

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>REVV</Text>
          <Text style={styles.headerTitle}>Help & Support</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.contactCard}
          onPress={() =>
            Linking.openURL(
              `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                `Revv support — ${userType === 'detailer' ? 'Detailer' : 'Client'} account`
              )}`
            )
          }
        >
          <View style={styles.contactIcon}>
            <Ionicons name="mail" size={20} color={C.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Contact Support</Text>
            <Text style={styles.contactSub}>{SUPPORT_EMAIL}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.gray} />
        </Pressable>

        <Text style={styles.sectionLabel}>Common questions</Text>
        {FAQS.map((f) => (
          <FaqRow key={f.q} q={f.q} a={f.a} />
        ))}

        <Pressable style={styles.linkRow} onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={15} color={C.muted} />
        </Pressable>

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
  scrollContent: { padding: 22, paddingBottom: 48, gap: 10 },

  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  contactIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: C.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTitle: { color: C.navy, fontSize: 15, fontWeight: '800' },
  contactSub:   { color: C.muted, fontSize: 12.5, marginTop: 2 },

  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 4,
  },

  faqCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  faqQ:    { color: C.navy, fontSize: 14, fontWeight: '700', flex: 1 },
  faqA:    { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 10 },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    marginTop: 8,
  },
  linkText: { color: C.muted, fontSize: 13, fontWeight: '600' },
});
