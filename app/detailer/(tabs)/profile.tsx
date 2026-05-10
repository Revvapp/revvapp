import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const COLORS = {
  blue: '#1A3A5C',
  gold: '#C9A227',
  mutedBlue: '#6E8299',
  bg: '#F5F7FA',
};

const SERVICES = [
  'Premium Exterior Detail',
  'Interior Deep Cleaning',
  'Paint Correction',
  'Ceramic Coating Prep',
];

export default function DetailerProfileScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>My Profile</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AP</Text>
        </View>
        <Text style={styles.name}>Alex Parker</Text>
        <Text style={styles.rating}>4.9 ★ • 132 reviews</Text>
      </View>

      <View style={styles.servicesCard}>
        <Text style={styles.sectionTitle}>Services Offered</Text>
        <View style={styles.servicesList}>
          {SERVICES.map((service) => (
            <View key={service} style={styles.servicePill}>
              <Text style={styles.serviceText}>{service}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable style={styles.editButton}>
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </Pressable>
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
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    padding: 20,
    marginBottom: 14,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: COLORS.blue,
    fontSize: 28,
    fontWeight: '800',
  },
  name: {
    color: COLORS.blue,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  rating: {
    color: COLORS.mutedBlue,
    fontSize: 14,
    fontWeight: '600',
  },
  servicesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.blue,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  servicesList: {
    gap: 10,
  },
  servicePill: {
    borderRadius: 10,
    backgroundColor: '#F2F6FB',
    borderWidth: 1,
    borderColor: '#D9E3EE',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  serviceText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
