import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandSplash } from '@/components/BrandSplash';

export default function PreviewSplashScreen() {
  const [key, setKey] = useState(0);

  return (
    <View style={styles.container}>
      <View key={key} style={styles.splash}>
        <BrandSplash />
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.replayBtn} onPress={() => setKey((k) => k + 1)}>
          <Ionicons name="refresh" size={16} color="#C9A227" />
          <Text style={styles.replayText}>Replay</Text>
        </Pressable>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  splash: { flex: 1 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,162,39,0.15)',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.4)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  replayText: { color: '#C9A227', fontSize: 14, fontWeight: '700' },
  closeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  closeText: { color: '#6B7A8D', fontSize: 14, fontWeight: '700' },
});
