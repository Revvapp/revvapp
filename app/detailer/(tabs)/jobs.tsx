import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDetailerJobs } from '@/hooks/useDetailerJobs';
import { formatJobDate } from '@/lib/dateKeys';
import { toTitleCase } from '@/lib/format';
import type { BookingDocument } from '@/types/firestore';

const COLORS = {
  bg: '#0D1B2A',
  content: '#F5F5F5',
  card: '#FFFFFF',
  blue: '#1A3A5C',
  gold: '#C9A227',
  gray: '#B7C1CC',
  muted: '#6B7885',
  border: '#E2E8F0',
  red: '#D93025',
  green: '#27AE60',
  white: '#FFFFFF',
};

type Tab = 'Pending' | 'Active' | 'Completed';

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  pending:       { label: 'Pending',            dot: COLORS.gold },
  active:        { label: 'Accepted',           dot: '#1A3A5C' },
  vir_submitted: { label: 'Awaiting Signature', dot: '#E67E22' },
  vir_signed:    { label: 'Ready to Start',     dot: COLORS.green },
  in_progress:   { label: 'In Progress',        dot: COLORS.green },
  paused:        { label: 'Paused',             dot: COLORS.gold },
  completed:     { label: 'Completed',          dot: COLORS.muted },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: toTitleCase(status), dot: COLORS.muted };
  return (
    <View style={styles.badge}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={styles.badgeText}>{cfg.label}</Text>
    </View>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, { title: string; body: string; icon: string }> = {
    Pending:   { title: 'No Pending Requests',  body: 'New booking requests from clients will appear here.', icon: 'time-outline' },
    Active:    { title: 'No Active Jobs',        body: 'Accept a request and it will show up here.',          icon: 'briefcase-outline' },
    Completed: { title: 'No Completed Jobs Yet', body: 'Jobs you finish will be recorded here.',              icon: 'checkmark-circle-outline' },
  };
  const { title, body, icon } = messages[tab];
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name={icon as 'time-outline'} size={40} color={COLORS.gray} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function ActiveAction({ job }: { job: BookingDocument }) {
  switch (job.status) {
    case 'active':
      return (
        <Pressable
          style={styles.btnFilled}
          onPress={() => router.push({ pathname: '/detailer/vir/[id]', params: { id: job.id } })}
        >
          <Text style={styles.btnFilledText}>Start Inspection</Text>
        </Pressable>
      );
    case 'vir_submitted':
      return (
        <View style={styles.btnWaiting}>
          <Text style={styles.btnWaitingText}>Awaiting Signature</Text>
        </View>
      );
    case 'vir_signed':
      return (
        <Pressable
          style={styles.btnFilled}
          onPress={() => router.push({ pathname: '/detailer/timer/[id]', params: { id: job.id } })}
        >
          <Text style={styles.btnFilledText}>Start Job</Text>
        </Pressable>
      );
    case 'in_progress':
      return (
        <Pressable
          style={styles.btnFilled}
          onPress={() => router.push({ pathname: '/detailer/timer/[id]', params: { id: job.id } })}
        >
          <Text style={styles.btnFilledText}>View Timer</Text>
        </Pressable>
      );
    case 'paused':
      return (
        <Pressable
          style={[styles.btnFilled, styles.btnGold]}
          onPress={() => router.push({ pathname: '/detailer/timer/[id]', params: { id: job.id } })}
        >
          <Text style={styles.btnFilledText}>Resume Job</Text>
        </Pressable>
      );
    default:
      return null;
  }
}

function JobCard({
  job,
  tab,
  onAccept,
  onDecline,
  actioning,
}: {
  job: BookingDocument;
  tab: Tab;
  onAccept?: () => void;
  onDecline?: () => void;
  actioning?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const meta = [formatJobDate(job.date), job.time, job.vehicleLabel].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/detailer/job/[id]', params: { id: job.id } })}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
    >
      <Animated.View style={[styles.card, animStyle]}>
        <View style={styles.cardTop}>
          <Text style={styles.clientName} numberOfLines={1}>
            {job.clientName ? toTitleCase(job.clientName) : 'Client'}
          </Text>
          <StatusBadge status={job.status} />
        </View>

        <Text style={styles.serviceName} numberOfLines={1}>{toTitleCase(job.service)}</Text>
        <Text style={styles.metaText} numberOfLines={1}>{meta}</Text>

        <View style={styles.cardBottom}>
          <Text style={styles.priceText}>${job.price}</Text>

          {tab === 'Pending' && (
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.btnOutline, actioning && styles.btnDisabled]}
                onPress={onDecline}
                disabled={actioning}
              >
                <Text style={styles.btnOutlineText}>Decline</Text>
              </Pressable>
              <Pressable
                style={[styles.btnFilled, actioning && styles.btnDisabled]}
                onPress={onAccept}
                disabled={actioning}
              >
                {actioning
                  ? <ActivityIndicator size="small" color={COLORS.blue} />
                  : <Text style={styles.btnFilledText}>Accept</Text>
                }
              </Pressable>
            </View>
          )}

          {tab === 'Active' && <ActiveAction job={job} />}

          {tab === 'Completed' && (
            <Pressable
              style={styles.btnOutline}
              onPress={() => router.push({ pathname: '/detailer/invoice/[id]', params: { id: job.id } })}
            >
              <Text style={styles.btnOutlineText}>View Invoice</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function DetailerJobsScreen() {
  const { loading, error, pending, active, completed, acceptJob, declineJob } = useDetailerJobs();
  const [selectedTab, setSelectedTab] = useState<Tab>('Pending');
  const [actioningId, setActioningId] = useState<string | null>(null);

  async function runAction(id: string, fn: () => Promise<void>) {
    setActioningId(id);
    try {
      await fn();
    } finally {
      setActioningId(null);
    }
  }

  const tabData: Record<Tab, BookingDocument[]> = { Pending: pending, Active: active, Completed: completed };
  const jobs = tabData[selectedTab];
  const tabs: Tab[] = ['Pending', 'Active', 'Completed'];

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>My Jobs</Text>
            {pending.length > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pending.length}</Text>
              </View>
            )}
          </View>
        </View>

        <Animated.View entering={FadeIn.duration(350)} style={styles.contentArea}>
          <View style={styles.tabRow}>
            {tabs.map((tab) => (
              <Pressable key={tab} style={styles.tabBtn} onPress={() => setSelectedTab(tab)}>
                <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                  {tab}{tab === 'Pending' && pending.length > 0 ? ` (${pending.length})` : ''}
                </Text>
                {selectedTab === tab && <View style={styles.tabUnderline} />}
              </Pressable>
            ))}
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.gold} />
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {!!error && <Text style={styles.errorText}>{error}</Text>}
              {jobs.length === 0 ? (
                <EmptyState tab={selectedTab} />
              ) : (
                jobs.map((job, index) => (
                  <Animated.View key={job.id} entering={FadeInDown.delay(index * 70).springify()}>
                    <JobCard
                      job={job}
                      tab={selectedTab}
                      actioning={actioningId === job.id}
                      onAccept={() => runAction(job.id, () => acceptJob(job.id))}
                      onDecline={() => runAction(job.id, () => declineJob(job.id))}
                    />
                  </Animated.View>
                ))
              )}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: COLORS.white, fontSize: 26, fontWeight: '900' },
  pendingBadge: {
    backgroundColor: COLORS.gold,
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pendingBadgeText: { color: COLORS.blue, fontSize: 12, fontWeight: '900' },
  contentArea: {
    flex: 1,
    backgroundColor: COLORS.content,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 16,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  tabBtn: { marginRight: 24, paddingTop: 12, paddingBottom: 10, alignItems: 'center' },
  tabText: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: COLORS.blue, fontWeight: '800' },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.gold,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  errorText: { color: '#D93025', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { color: COLORS.blue, fontSize: 17, fontWeight: '800' },
  emptyBody: { color: COLORS.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  clientName: { color: COLORS.blue, fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  serviceName: { color: COLORS.muted, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  metaText: { color: COLORS.gray, fontSize: 12, fontWeight: '600', marginBottom: 12 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceText: { color: COLORS.gold, fontSize: 20, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 8 },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: '#C0CBD6',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnOutlineText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  btnFilled: {
    backgroundColor: COLORS.blue,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  btnGold: { backgroundColor: COLORS.gold },
  btnFilledText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  btnWaiting: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  btnWaitingText: { color: '#7B3F00', fontSize: 12, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});
