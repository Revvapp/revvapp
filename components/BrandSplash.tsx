import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const COLORS = {
  bg: '#0A1628',
  gold: '#C9A227',
  white: '#FFFFFF',
};

export function BrandSplash() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.brand}>
        <Text style={styles.brandWhite}>RE</Text>
        <Text style={styles.brandGold}>VV</Text>
      </Text>
      <ActivityIndicator size="large" color={COLORS.gold} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 28,
  },
  brandWhite: { color: COLORS.white },
  brandGold: { color: COLORS.gold },
  spinner: { marginTop: 8 },
});
