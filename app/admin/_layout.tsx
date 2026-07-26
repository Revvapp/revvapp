import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AC } from '@/components/admin/ui';
import { useIsAdmin } from '@/hooks/useIsAdmin';

/**
 * Gate for the REVV admin console.
 *
 * This is a convenience guard, not the security boundary: it only decides what
 * renders. Every action these screens take is an admin-only callable that
 * re-checks the `admin` custom claim server-side, and the widened Firestore read
 * rules check the same claim — so someone who navigates here directly still sees
 * nothing and can do nothing.
 */
export default function AdminLayout() {
  const { isAdmin, checking } = useIsAdmin();

  if (checking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={AC.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={AC.gray} />
          <Text style={styles.deniedTitle}>Admin access required</Text>
          <Text style={styles.deniedBody}>
            This area is limited to the REVV team. If you were just granted access, sign out and
            back in to refresh your session.
          </Text>
          <Pressable style={styles.btn} onPress={() => router.replace('/')}>
            <Text style={styles.btnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: AC.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },

  deniedTitle: { color: AC.white, fontSize: 18, fontWeight: '800', marginTop: 4 },
  deniedBody:  { color: AC.gray, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },

  btn:     { marginTop: 12, backgroundColor: AC.gold, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28 },
  btnText: { color: AC.navy, fontSize: 14, fontWeight: '800' },
});
