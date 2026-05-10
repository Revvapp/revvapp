import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const COLORS = {
  bg: '#0D1B2A',
  card: '#1A2B3C',
  gold: '#C9A227',
  white: '#FFFFFF',
  gray: '#B7C1CC',
};

export default function ClientFindScreen() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={COLORS.gold} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.title}>FIND DETAILERS</Text>
          <Text style={styles.subtitle}>Explore trusted professionals near you.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
  },
  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  subtitle: { color: COLORS.gray, fontSize: 14, lineHeight: 20 },
});

