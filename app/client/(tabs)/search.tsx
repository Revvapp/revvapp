import { StyleSheet, Text, View } from 'react-native';

export default function ClientSearchScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Client Search</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FA',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A3A5C',
  },
});
