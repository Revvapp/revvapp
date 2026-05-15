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

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const bg =
    s === 'pending' ? '#FFF3CD' :
    s === 'active' ? '#D4EDDA' :
    s === 'completed' ? '#E8F4FD' :
    '#F0F0F0';
  const color =
    s === 'pending' ? '#856404' :
    s === 'active' ? '#155724' :
    s === 'completed' ? '#0C5460' :
    COLORS.muted;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{toTitleCase(status)}</Text>
    </View>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, { title: string; body: string; icon: string }> = {
    Pending: { title: 'No Pending Requests', body: 'New booking requests from clients will appear here.', icon: 'time-outline' },
    Active: { title: 'No Active Jobs', body: 'Accept a request and it will show up here.', icon: 'briefcase-outline' },
    Completed: { title: 'No Completed Jobs Yet', body: 'Jobs you finish will be recorded here.', icon: 'checkmark-circle-outline' },
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

function JobCard({
  job,
  tab,
  onAccept,
  onDecline,
  onComplete,
  actioning,
}: {
  job: BookingDocument;
  tab: Tab;
  onAccept: () => void;
  onDecline: () => void;
  onComplete: () => void;
  actioning: boolean;
}) {
  const meta = [
    formatJobDate(job.date),
    job.time,
    job.vehicleLabel,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: '/detailer/job/[id]', params: { id: job.id } })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.clientName} numberOfLines={1}>
          {job.clientName ? toTitleCase(job.clientName) : 'Client'}
        </Text>
        <StatusBadge status={job.status} />
      </View>

      <Text style={styles.serviceName} numberOfLines={1}>
        {toTitleCase(job.service)}
      </Text>

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
              {actioning ? (
                <ActivityIndicator size="small" color={COLORS.blue} />
              ) : (
                <Text style={styles.btnFilledText}>Accept</Text>
              )}
            </Pressable>
          </View>
        )}

        {tab === 'Active' && (
          <Pressable
            style={[styles.btnFilled, actioning && styles.btnDisabled]}
            onPress={onComplete}
            disabled={actioning}
          >
            {actioning ? (
              <ActivityIndicator size="small" color={COLORS.blue} />
            ) : (
              <Text style={styles.btnFilledText}>Mark Complete</Text>
            )}
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export default function DetailerJobsScreen() {
  const { loading, error, pending, active, completed, acceptJob, declineJob, completeJob } =
    useDetailerJobs();
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

        <View style={styles.contentArea}>
          <View style={styles.tabRow}>
            {tabs.map((tab) => (
              <Pressable
                key={tab}
                style={[styles.tabBtn, selectedTab === tab && styles.tabBtnActive]}
                onPress={() => setSelectedTab(tab)}
              >
                <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                  {tab}
                  {tab === 'Pending' && pending.length > 0 ? ` (${pending.length})` : ''}
                </Text>
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
                jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    tab={selectedTab}
                    actioning={actioningId === job.id}
                    onAccept={() => runAction(job.id, () => acceptJob(job.id))}
                    onDecline={() => runAction(job.id, () => declineJob(job.id))}
                    onComplete={() => runAction(job.id, () => completeJob(job.id))}
                  />
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
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
    backgroundColor: '#DFE7EF',
    borderRadius: 12,
    marginHorizontal: 20,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.blue },
  tabText: { color: COLORS.blue, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: COLORS.white },
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
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
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
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  btnFilledText: { color: COLORS.blue, fontSize: 13, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
});
