import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { markConversationRead } from '@/lib/conversations';
import { sendPushToUser } from '@/lib/pushNotifications';
import { getRecipientPushToken } from '@/lib/pushTokens';

const C = {
  bg:      '#0D1B2A',
  blue:    '#1A3A5C',
  gold:    '#C9A227',
  gray:    '#B7C1CC',
  muted:   '#6B7885',
  white:   '#FFFFFF',
  border:  '#E2E8F0',
  content: '#F4F6F9',
};

type Message = {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
};

type BookingMeta = {
  clientId: string;
  clientName: string;
  detailerId: string;
  detailerName: string;
  vehicleLabel: string;
};

export default function DetailerConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [booking, setBooking] = useState<BookingMeta | null>(null);

  useEffect(() => {
    if (!id) return;

    getDoc(doc(db, 'bookings', id)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setBooking({
          clientId: String(d.clientId ?? ''),
          clientName: String(d.clientName ?? 'Client'),
          detailerId: String(d.detailerId ?? ''),
          detailerName: String(d.detailerName ?? 'Detailer'),
          vehicleLabel: String(d.vehicleLabel ?? ''),
        });
      }
    });

    const q = query(
      collection(db, 'conversations', id, 'messages'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({
          id: d.id,
          senderId: String(d.data().senderId ?? ''),
          text: String(d.data().text ?? ''),
          createdAt: d.data().createdAt,
        }))
      );
      // Opening (and staying in) the thread clears the unread badge.
      if (user?.uid) markConversationRead(id, user.uid);
    });

    return () => unsub();
  }, [id, user?.uid]);

  async function send() {
    if (!text.trim() || !user?.uid || !id || !booking) return;
    setSending(true);
    const msgText = text.trim();
    setText('');
    try {
      await addDoc(collection(db, 'conversations', id, 'messages'), {
        senderId: user.uid,
        senderName: booking.detailerName,
        senderRole: 'detailer',
        text: msgText,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, 'conversations', id),
        {
          bookingId: id,
          clientId: booking.clientId,
          detailerId: booking.detailerId,
          clientName: booking.clientName,
          detailerName: booking.detailerName,
          vehicleLabel: booking.vehicleLabel,
          lastMessage: msgText,
          lastMessageAt: serverTimestamp(),
          lastSenderId: user.uid,
          reads: { [user.uid]: serverTimestamp() },
        },
        { merge: true }
      );

      // Notify the client of the new message (best-effort — never break send).
      try {
        const token = await getRecipientPushToken(booking.clientId);
        sendPushToUser(
          token,
          booking.detailerName || 'New message',
          msgText,
          { type: 'message', conversationId: id }
        );
      } catch {
        // ignore — messaging must succeed even if the push lookup fails
      }
    } finally {
      setSending(false);
    }
  }

  function formatTime(ts: any): string {
    if (!ts?.toDate) return '';
    return (ts.toDate() as Date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderMessage({ item }: { item: Message }) {
    const isOwn = item.senderId === user?.uid;
    return (
      <View style={[styles.msgRow, isOwn ? styles.msgOwn : styles.msgTheir]}>
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleTheir]}>
          <Text style={[styles.bubbleText, isOwn ? styles.textOwn : styles.textTheir]}>
            {item.text}
          </Text>
        </View>
        <Text style={styles.msgTime}>{formatTime(item.createdAt)}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>REVV</Text>
          <Text style={styles.headerTitle}>{booking?.clientName ?? '…'}</Text>
          {!!booking?.vehicleLabel && (
            <Text style={styles.headerSub}>{booking.vehicleLabel}</Text>
          )}
        </View>
        <View style={{ width: 30 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.listContent}
          style={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
        />

        <SafeAreaView edges={['bottom']} style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor={C.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendBtn, (!text.trim() || sending || !booking) && styles.sendBtnOff]}
            onPress={send}
            disabled={!text.trim() || sending || !booking}
          >
            {sending
              ? <ActivityIndicator size="small" color={C.blue} />
              : <Ionicons name="send" size={18} color={C.blue} />
            }
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1, backgroundColor: C.content },

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
  headerTitle: { color: C.white, fontSize: 18, fontWeight: '800' },
  headerSub: { color: C.gray, fontSize: 12, fontWeight: '500', marginTop: 1 },

  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 8 },

  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: C.muted, fontSize: 14 },

  msgRow: { marginBottom: 10, maxWidth: '75%' },
  msgOwn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgTheir: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleOwn: { backgroundColor: C.blue, borderBottomRightRadius: 4 },
  bubbleTheir: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  textOwn: { color: C.white },
  textTheir: { color: C.blue },
  msgTime: { color: C.muted, fontSize: 10, marginTop: 3, marginHorizontal: 4 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 10,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  input: {
    flex: 1,
    backgroundColor: C.content,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: C.blue,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
});
