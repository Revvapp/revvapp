import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';

const C = {
  bg:      '#0A1628',
  content: '#F4F6F9',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  gray:    '#8A9BB0',
  muted:   '#6B7A8D',
  border:  '#E8EDF4',
  white:   '#FFFFFF',
};

type Conversation = {
  id: string;
  clientId: string;
  detailerId: string;
  clientName: string;
  detailerName: string;
  businessName: string;
  vehicleLabel: string;
  lastMessage: string;
  lastMessageAt: any;
  lastSenderId: string;
};

function timeAgo(ts: any): string {
  if (!ts?.toDate) return '';
  const now = Date.now();
  const diff = now - (ts.toDate() as Date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ConversationRow({ conv, uid }: { conv: Conversation; uid: string }) {
  const displayName = conv.businessName || conv.detailerName || 'Detailer';
  const initial = displayName[0]?.toUpperCase() ?? 'D';
  const isUnread = conv.lastSenderId && conv.lastSenderId !== uid;

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push({ pathname: '/client/conversation/[id]', params: { id: conv.id } })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, isUnread && styles.rowNameBold]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.rowTime}>{timeAgo(conv.lastMessageAt)}</Text>
        </View>
        {!!conv.vehicleLabel && (
          <Text style={styles.rowVehicle} numberOfLines={1}>{conv.vehicleLabel}</Text>
        )}
        <Text style={[styles.rowPreview, isUnread && styles.rowPreviewBold]} numberOfLines={1}>
          {conv.lastMessage || 'Start a conversation…'}
        </Text>
      </View>
      {isUnread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export default function ClientMessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'conversations'),
      where('clientId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs: Conversation[] = snap.docs.map((d) => ({
        id: d.id,
        clientId: String(d.data().clientId ?? ''),
        detailerId: String(d.data().detailerId ?? ''),
        clientName: String(d.data().clientName ?? ''),
        detailerName: String(d.data().detailerName ?? ''),
        businessName: String(d.data().businessName ?? ''),
        vehicleLabel: String(d.data().vehicleLabel ?? ''),
        lastMessage: String(d.data().lastMessage ?? ''),
        lastMessageAt: d.data().lastMessageAt ?? null,
        lastSenderId: String(d.data().lastSenderId ?? ''),
      }));
      // Sort newest first client-side
      docs.sort((a, b) => {
        const at = a.lastMessageAt?.toDate?.()?.getTime() ?? 0;
        const bt = b.lastMessageAt?.toDate?.()?.getTime() ?? 0;
        return bt - at;
      });
      setConversations(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>REVV</Text>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <Animated.View entering={FadeIn.duration(350)} style={styles.content}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconRing}>
              <Ionicons name="chatbubble-outline" size={28} color={C.gold} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyBody}>
              Messages with your detailer will appear here once a booking is active.
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listInner}>
            {conversations.map((conv, index) => (
              <Animated.View key={conv.id} entering={FadeInDown.delay(index * 60).springify()}>
                <ConversationRow conv={conv} uid={user?.uid ?? ''} />
              </Animated.View>
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  eyebrow: { color: C.gold, fontSize: 11, fontWeight: '800', letterSpacing: 2.5, marginBottom: 4 },
  headerTitle: { color: C.white, fontSize: 28, fontWeight: '900' },

  content: {
    flex: 1,
    backgroundColor: C.content,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  listInner: { paddingTop: 8, paddingBottom: 32 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 60 },
  emptyIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(201,162,39,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(201,162,39,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { color: C.navy, fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyBody: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.gold, fontSize: 20, fontWeight: '900' },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  rowName: { color: C.navy, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  rowNameBold: { fontWeight: '900' },
  rowTime: { color: C.muted, fontSize: 11, fontWeight: '500' },
  rowVehicle: { color: C.gold, fontSize: 11, fontWeight: '700', marginBottom: 2, letterSpacing: 0.3 },
  rowPreview: { color: C.muted, fontSize: 13, lineHeight: 18 },
  rowPreviewBold: { color: C.navy, fontWeight: '600' },
  unreadDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: C.gold },
});
