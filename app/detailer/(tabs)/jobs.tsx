import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type JobStatus = 'Scheduled' | 'In Progress' | 'Completed';
type JobTab = 'Active' | 'Completed';

type JobItem = {
  id: string;
  clientName: string;
  serviceType: string;
  time: string;
  price: string;
  status: JobStatus;
};

const COLORS = {
  blue: '#1A3A5C',
  gold: '#C9A227',
  mutedBlue: '#6E8299',
  bg: '#F5F7FA',
};

const JOBS: JobItem[] = [
  {
    id: '1',
    clientName: 'Olivia Martinez',
    serviceType: 'Premium Exterior + Interior',
    time: '10:30 AM',
    price: '$180',
    status: 'In Progress',
  },
  {
    id: '2',
    clientName: 'Ethan Clark',
    serviceType: 'Express Interior Detail',
    time: '2:00 PM',
    price: '$120',
    status: 'Scheduled',
  },
  {
    id: '3',
    clientName: 'Mia Johnson',
    serviceType: 'Full Ceramic Prep',
    time: 'Yesterday, 5:30 PM',
    price: '$320',
    status: 'Completed',
  },
];

export default function DetailerJobsScreen() {
  const [selectedTab, setSelectedTab] = useState<JobTab>('Active');
  const filteredJobs = useMemo(
    () =>
      JOBS.filter((job) =>
        selectedTab === 'Active' ? job.status !== 'Completed' : job.status === 'Completed'
      ),
    [selectedTab]
  );

  const getBadgeStyle = (status: JobStatus) => {
    if (status === 'Completed') {
      return styles.statusBadgeCompleted;
    }
    if (status === 'In Progress') {
      return styles.statusBadgeProgress;
    }
    return styles.statusBadgeScheduled;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>My Jobs</Text>

      <View style={styles.tabSwitch}>
        {(['Active', 'Completed'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.jobsList}>
        {filteredJobs.map((job) => (
          <View key={job.id} style={styles.jobCard}>
            <View style={styles.jobTopRow}>
              <Text style={styles.clientName}>{job.clientName}</Text>
              <View style={[styles.statusBadge, getBadgeStyle(job.status)]}>
                <Text style={styles.statusText}>{job.status}</Text>
              </View>
            </View>
            <Text style={styles.serviceText}>{job.serviceType}</Text>
            <View style={styles.jobBottomRow}>
              <Text style={styles.metaText}>{job.time}</Text>
              <Text style={styles.priceText}>{job.price}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.blue,
    marginBottom: 16,
  },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: '#DFE7EF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: COLORS.blue,
  },
  tabText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  jobsList: {
    gap: 12,
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  jobTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  clientName: {
    color: COLORS.blue,
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeScheduled: {
    backgroundColor: '#E5EAF0',
  },
  statusBadgeProgress: {
    backgroundColor: '#F4E5AF',
  },
  statusBadgeCompleted: {
    backgroundColor: '#DDEEE1',
  },
  statusText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  serviceText: {
    color: COLORS.mutedBlue,
    fontSize: 14,
    marginBottom: 12,
  },
  jobBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    color: COLORS.mutedBlue,
    fontSize: 13,
    fontWeight: '500',
  },
  priceText: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '800',
  },
});
