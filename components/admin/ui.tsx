import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Shared chrome for the REVV admin console. The console is a handful of
 * operational screens rather than a product surface, so they share one palette
 * and header instead of each restyling themselves like the client/detailer
 * screens do.
 */
export const AC = {
  bg:      '#0A1628',
  surface: '#F5F7FA',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  goldDim: 'rgba(201,162,39,0.12)',
  gray:    '#8A9BB0',
  muted:   '#6B7A8D',
  border:  '#E8EDF4',
  white:   '#FFFFFF',
  green:   '#27AE60',
  greenDim:'rgba(39,174,96,0.10)',
  red:     '#D93025',
  redDim:  'rgba(217,48,37,0.08)',
};

export function AdminHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      {router.canGoBack() ? (
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={AC.white} />
        </Pressable>
      ) : (
        <View style={{ width: 30 }} />
      )}
      <View style={styles.headerCenter}>
        <Text style={styles.eyebrow}>{subtitle ?? 'REVV ADMIN'}</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={{ width: 30 }} />
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={34} color={AC.gray} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

/** Formats integer cents as a plain dollar string. */
export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn:      { padding: 4 },
  headerCenter: { flex: 1 },
  eyebrow:      { color: AC.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 1 },
  headerTitle:  { color: AC.white, fontSize: 20, fontWeight: '900' },

  empty:     { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyText: { color: AC.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },

  row:      { flexDirection: 'row', gap: 10, marginBottom: 6 },
  rowLabel: { color: AC.muted, fontSize: 12, fontWeight: '700', width: 92 },
  rowValue: { color: AC.navy, fontSize: 12.5, flex: 1, lineHeight: 17 },
});
