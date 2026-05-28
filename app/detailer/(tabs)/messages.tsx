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
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { isConversationUnread } from '@/lib/conversations';

const C = {
  bg:      '#0D1B2A',
  surface: '#F5F7FA',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  goldDim: 'rgba(201,162,39,0.12)',
  goldRing:'rgba(201,162,39,0.3)',
  gray:    '#B7C1CC',
  muted:   '#6B7885',
  border:  'rgba(0,0,0,0.06)',
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
  reads: Record<string, any>;
};

function timeAgo(ts: any): string {
  if (!ts?.toDate) return '';
  const now = Date.now();
  const diff = now - (ts.toDate() as Date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function ConversationRow({ conv, uid }: { conv: Conversation; uid: string }) {
  const displayName = conv.clientName || 'Client';
  const initial = displayName[0]?.toUpperCase() ?? 'C';
  const isUnread = isConversationUnread(conv, uid);
  const preview = conv.lastSenderId === uid
    ? `You: ${conv.lastMessage}`
    : conv.lastMessage || 'Start a conversation…';

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      onPress={() =>
        router.push({ pathname: '/detailer/conversation/[id]', params: { id: conv.id } })
      }
    >
      <View style={[styles.avatarWrap, isUnread && styles.avatarWrapUnread]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, isUnread && styles.rowNameUnread]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.rowTime, isUnread && styles.rowTimeUnread]}>
            {timeAgo(conv.lastMessageAt)}
          </Text>
        </View>

        {!!conv.vehicleLabel && (
          <View style={styles.vehiclePill}>
            <Text style={styles.vehiclePillText}>{conv.vehicleLabel}</Text>
          </View>
        )}

        <Text style={[styles.rowPreview, isUnread && styles.rowPreviewUnread]} numberOfLines={1}>
          {preview}
        </Text>
      </View>

      {isUnread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export default function DetailerMessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'conversations'),
      where('detailerId', '==', user.uid)
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
        reads: d.data().reads ?? {},
      }));
      docs.sort((a, b) => {
        const at = a.lastMessageAt?.toDate?.()?.getTime() ?? 0;
        const bt = b.lastMessageAt?.toDate?.()?.getTime() ?? 0;
        return bt - at;
      });
      setConversations(docs);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.clientName.toLowerCase().includes(search.toLowerCase()) ||
        c.vehicleLabel.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const unreadCount = conversations.filter(
    (c) => isConversationUnread(c, user?.uid ?? '')
  ).length;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>REVV</Text>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <Animated.View entering={FadeIn.duration(350)} style={styles.content}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="warning-outline" size={32} color={C.gold} />
            <Text style={[styles.emptyTitle, { marginTop: 14 }]}>Could not load messages</Text>
            <Text style={styles.emptyBody}>{error}</Text>
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.centered}>
            <View style={styles.emptyRing}>
              <Ionicons name="chatbubble-ellipses-outline" size={26} color={C.gold} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyBody}>
              Client messages will appear here once a booking is active.
            </Text>
          </View>
        ) : (
          <>
            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={C.muted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search clients or vehicles…"
                placeholderTextColor={C.muted}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={C.muted} />
                </Pressable>
              )}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listInner}
            >
              {filtered.length === 0 ? (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>No results for &quot;{search}&quot;</Text>
                </View>
              ) : (
                filtered.map((conv, index) => (
                  <Animated.View
                    key={conv.id}
                    entering={FadeInDown.delay(index * 50).springify()}
                  >
                    <ConversationRow conv={conv} uid={user?.uid ?? ''} />
                  </Animated.View>
                ))
              )}
            </ScrollView>
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 22,
  },
  eyebrow: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 4,
  },
  headerTitle: {
    color: C.white,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  unreadBadge: {
    backgroundColor: C.gold,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 4,
  },
  unreadBadgeText: {
    color: C.bg,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  content: {
    flex: 1,
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 44,
    paddingBottom: 60,
  },
  emptyRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.goldDim,
    borderWidth: 1.5,
    borderColor: C.goldRing,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptyBody: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 8,
    backgroundColor: C.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.navy,
    fontWeight: '500',
  },

  listInner: { paddingBottom: 40 },

  noResults: { alignItems: 'center', paddingTop: 48 },
  noResultsText: { color: C.muted, fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: C.card,
    marginHorizontal: 18,
    marginTop: 10,
    borderRadius: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },

  avatarWrap: {
    padding: 2,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarWrapUnread: {
    borderColor: C.gold,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.gold, fontSize: 18, fontWeight: '900' },

  rowBody: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowName: { color: C.navy, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  rowNameUnread: { fontWeight: '800' },
  rowTime: { color: C.gray, fontSize: 11, fontWeight: '500' },
  rowTimeUnread: { color: C.gold, fontWeight: '700' },

  vehiclePill: {
    alignSelf: 'flex-start',
    backgroundColor: C.goldDim,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 5,
  },
  vehiclePillText: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  rowPreview: { color: C.muted, fontSize: 13, lineHeight: 18 },
  rowPreviewUnread: { color: C.navy, fontWeight: '600' },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.gold,
    alignSelf: 'center',
  },
});
