import { FlatList, StyleSheet, Text, View } from 'react-native';

const COLORS = {
  blue: '#1A3A5C',
  gold: '#C9A227',
  mutedBlue: '#6E8299',
  bg: '#F5F7FA',
};

const CLIENTS = [
  { id: '1', name: 'Olivia Martinez', jobs: 4, rating: 4.9 },
  { id: '2', name: 'Ethan Clark', jobs: 2, rating: 4.8 },
  { id: '3', name: 'Mia Johnson', jobs: 1, rating: 5.0 },
];

export default function DetailerClientsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Clients</Text>
      <FlatList
        data={CLIENTS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.jobs} jobs completed - {item.rating.toFixed(1)} rating
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    paddingTop: 64,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.blue,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.blue,
    fontSize: 20,
    fontWeight: '800',
  },
  info: {
    marginLeft: 12,
    flex: 1,
  },
  name: {
    color: COLORS.blue,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    color: COLORS.mutedBlue,
    fontSize: 13,
    fontWeight: '500',
  },
});
