import { ScrollView, StyleSheet, Text, View } from 'react-native';

const COLORS = {
  blue: '#1A3A5C',
  gold: '#C9A227',
  mutedBlue: '#6E8299',
  bg: '#F5F7FA',
};

const PAYOUTS = [
  { id: '1', date: 'May 3, 2026', amount: '$480.00', method: 'Instant payout' },
  { id: '2', date: 'Apr 30, 2026', amount: '$620.00', method: 'Weekly payout' },
  { id: '3', date: 'Apr 23, 2026', amount: '$710.00', method: 'Weekly payout' },
];

export default function DetailerEarningsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Earnings</Text>

      <View style={styles.monthCard}>
        <Text style={styles.monthLabel}>Total this month</Text>
        <Text style={styles.monthAmount}>$4,820.00</Text>
        <Text style={styles.monthSubtext}>Up 12% compared with last month</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Subscription status</Text>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Next payout date</Text>
          <Text style={styles.infoValue}>May 10, 2026</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Payout History</Text>
      <View style={styles.payoutList}>
        {PAYOUTS.map((payout) => (
          <View key={payout.id} style={styles.payoutCard}>
            <View>
              <Text style={styles.payoutDate}>{payout.date}</Text>
              <Text style={styles.payoutMethod}>{payout.method}</Text>
            </View>
            <Text style={styles.payoutAmount}>{payout.amount}</Text>
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
    paddingBottom: 28,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.blue,
    marginBottom: 16,
  },
  monthCard: {
    backgroundColor: COLORS.gold,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  monthLabel: {
    color: '#243447',
    fontSize: 13,
    fontWeight: '700',
  },
  monthAmount: {
    color: COLORS.blue,
    fontSize: 34,
    fontWeight: '800',
    marginVertical: 4,
  },
  monthSubtext: {
    color: '#243447',
    fontSize: 13,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: COLORS.mutedBlue,
    fontSize: 14,
    fontWeight: '600',
  },
  infoValue: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: '#DDEEE1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadgeText: {
    color: '#24513B',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: COLORS.blue,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  payoutList: {
    gap: 10,
  },
  payoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payoutDate: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  payoutMethod: {
    color: COLORS.mutedBlue,
    fontSize: 12,
    fontWeight: '500',
  },
  payoutAmount: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '800',
  },
});
