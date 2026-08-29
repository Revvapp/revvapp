import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
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

import { AC, AdminHeader, EmptyState, Row, money } from '@/components/admin/ui';
import { db } from '@/firebaseConfig';
import { quoteFleetOrder } from '@/lib/payments';

type Vehicle = { description: string; reference: string | null };

type Order = {
  id: string;
  dealershipName: string;
  contactEmail: string;
  service: string;
  vehicles: Vehicle[];
  vehicleCount: number;
  preferredDate: string;
  address: string;
  notes: string | null;
  estimateCents: number;
  estimateGrossCents: number;
  estimateDiscountCents: number;
};

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  // Pre-fill with the estimate: most quotes land on it, and the ones that don't
  // are easier to adjust from a real number than from an empty box.
  const [amount, setAmount] = useState((order.estimateCents / 100).toFixed(2));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cents = Math.round(parseFloat(amount.replace(/[^0-9.]/g, '')) * 100);
  const valid = Number.isFinite(cents) && cents > 0;

  const submit = () => {
    if (!valid) return;
    const delta = cents - order.estimateCents;
    const drift = Math.abs(delta) / order.estimateCents;
    const warn = drift > 0.25
      ? `\n\nThat is ${delta > 0 ? 'above' : 'below'} the estimate they were shown by ${Math.round(drift * 100)}%.`
      : '';
    Alert.alert(
      'Send this quote?',
      `${order.dealershipName} will be able to accept ${money(cents)} for ${order.vehicleCount} `
        + `vehicles.${warn}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send quote',
          onPress: async () => {
            setSubmitting(true);
            try {
              await quoteFleetOrder({ orderId: order.id, quotedCents: cents, note: note.trim() });
            } catch (e) {
              Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.head} onPress={() => setExpanded((v) => !v)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{order.dealershipName || 'Dealership'}</Text>
          <Text style={styles.sub}>
            {order.vehicleCount} × {order.service} · {order.preferredDate}
          </Text>
        </View>
        <Text style={styles.est}>{money(order.estimateCents)}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={AC.gray} />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <Row label="Contact" value={order.contactEmail || '—'} />
          <Row label="Where" value={order.address} />
          <Row label="List price" value={money(order.estimateGrossCents)} />
          <Row
            label="Volume discount"
            value={order.estimateDiscountCents > 0 ? `−${money(order.estimateDiscountCents)}` : 'None'}
          />
          {order.notes ? <Row label="Notes" value={order.notes} /> : null}

          <Text style={styles.label}>Vehicles</Text>
          {order.vehicles.map((v, i) => (
            <Text key={i} style={styles.veh}>
              {v.description}
              {v.reference ? <Text style={styles.ref}>  {v.reference}</Text> : null}
            </Text>
          ))}

          <Text style={styles.label}>Quote</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={AC.gray}
          />
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder="Note to the dealership (optional)"
            placeholderTextColor={AC.gray}
            multiline
          />

          <Pressable
            style={[styles.btn, (!valid || submitting) && styles.btnOff]}
            onPress={submit}
            disabled={!valid || submitting}
          >
            {submitting
              ? <ActivityIndicator color={AC.navy} />
              : <Text style={styles.btnText}>Send quote</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function AdminFleetScreen() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Only orders awaiting a quote — once quoted, the ball is in their court.
    const q = query(collection(db, 'fleetOrders'), where('status', '==', 'requested'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
        rows.sort((a, b) => a.preferredDate.localeCompare(b.preferredDate));
        setOrders(rows);
      },
      () => setFailed(true)
    );
    return () => unsub();
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <AdminHeader title="Fleet orders" subtitle="Dealership requests awaiting a quote" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {failed && (
            <EmptyState
              icon="cloud-offline-outline"
              text="Could not load fleet requests. Check your connection and reopen this screen."
            />
          )}
          {!failed && orders === null && (
            <ActivityIndicator color={AC.gold} style={{ marginTop: 40 }} />
          )}
          {!failed && orders?.length === 0 && (
            <EmptyState icon="car-outline" text="No fleet requests waiting on a quote." />
          )}
          {orders?.map((o) => <OrderCard key={o.id} order={o} />)}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AC.bg },
  scroll: { padding: 16 },
  card: {
    backgroundColor: AC.card, borderRadius: 14, borderWidth: 1, borderColor: AC.border,
    marginBottom: 12, overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15 },
  title: { color: AC.white, fontSize: 15, fontWeight: '800' },
  sub: { color: AC.gray, fontSize: 12.5, marginTop: 2 },
  est: { color: AC.gold, fontSize: 15, fontWeight: '800' },
  body: { paddingHorizontal: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: AC.border },
  label: {
    color: AC.gray, fontSize: 11, fontWeight: '800', letterSpacing: 1,
    textTransform: 'uppercase', marginTop: 16, marginBottom: 7,
  },
  veh: { color: AC.white, fontSize: 13.5, marginBottom: 4 },
  ref: { color: AC.gray },
  input: {
    backgroundColor: AC.bg, borderWidth: 1, borderColor: AC.border, borderRadius: 10,
    paddingHorizontal: 13, paddingVertical: 11, color: AC.white, fontSize: 15, marginBottom: 10,
  },
  noteInput: { minHeight: 66, textAlignVertical: 'top' },
  btn: {
    backgroundColor: AC.gold, borderRadius: 11, paddingVertical: 13, alignItems: 'center',
    marginTop: 4,
  },
  btnOff: { opacity: 0.5 },
  btnText: { color: AC.navy, fontSize: 15, fontWeight: '800' },
});
