import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { toTitleCase } from '@/lib/format';
import type { ClientDocument } from '@/types/firestore';

const C = {
  bg:      '#0A1628',
  content: '#F4F6F9',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  white:   '#FFFFFF',
  gray:    '#8A9BB0',
  muted:   '#6B7A8D',
  border:  '#E8EDF4',
  danger:  '#D93025',
};

function initialsFrom(name: string, email: string | null | undefined) {
  const n = name.trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  if (email && email.length >= 2) return email.slice(0, 2).toUpperCase();
  return 'RV';
}

function StatCol({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={15} color={C.gold} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function ClientProfileScreen() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Partial<ClientDocument> | null>(null);
  const [error, setError] = useState('');
  const [completedJobs, setCompletedJobs] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  const load = useCallback(async () => {
    if (!user?.uid) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [profileSnap, bookingsSnap] = await Promise.all([
        getDoc(doc(db, 'clients', user.uid)),
        getDocs(query(collection(db, 'bookings'), where('clientId', '==', user.uid), where('status', '==', 'completed'))),
      ]);
      setProfile(profileSnap.exists() ? (profileSnap.data() as ClientDocument) : null);
      setCompletedJobs(bookingsSnap.size);
      setTotalSpent(bookingsSnap.docs.reduce((sum, d) => sum + Number(d.data().price ?? 0), 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { void load(); }, [load]);

  const onSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={C.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const fullName = toTitleCase((profile?.fullName ?? '').trim());
  const displayName = fullName || 'Car Owner';
  const phone = (profile?.phone ?? '').trim();
  const city = toTitleCase((profile?.city ?? '').trim());
  const stateCode = ((profile?.state ?? '').trim()).toUpperCase();
  const location = city && stateCode ? `${city}, ${stateCode}` : city || stateCode || '';
  const initials = initialsFrom(fullName, user?.email);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>REVV</Text>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        {!!location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={C.gray} />
            <Text style={styles.locationText}>{location}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.statsCard}>
          <StatCol value={String(completedJobs)} label="Jobs Done" />
          <View style={styles.statDivider} />
          <StatCol value={totalSpent > 0 ? `$${Math.round(totalSpent).toLocaleString()}` : '$0'} label="Total Spent" />
          <View style={styles.statDivider} />
          <StatCol value={completedJobs > 0 ? '⭐ Verified' : 'New'} label="Status" />
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
        <View style={styles.card}>
          <InfoRow icon="mail-outline" label="Email" value={user?.email ?? ''} />
          <View style={styles.rowDivider} />
          <InfoRow icon="call-outline" label="Phone" value={phone} />
          <View style={styles.rowDivider} />
          <InfoRow icon="location-outline" label="Location" value={location} />
        </View>

        <Pressable style={styles.editBtn} onPress={() => router.push('/client/edit-profile')}>
          <Ionicons name="pencil-outline" size={16} color={C.navy} />
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </Pressable>

        {__DEV__ && (
          <Pressable style={styles.devBtn} onPress={() => router.push('/client/dev-tools')}>
            <Ionicons name="construct-outline" size={14} color={C.gold} />
            <Text style={styles.devBtnText}>Dev Tools</Text>
          </Pressable>
        )}

        <Pressable style={styles.signOutBtn} onPress={onSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 28,
  },
  eyebrow: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  headerTitle: {
    color: C.white,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 20,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(201,162,39,0.08)',
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: C.gold,
    fontSize: 28,
    fontWeight: '900',
  },
  displayName: {
    color: C.white,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: C.gray,
    fontSize: 13,
    fontWeight: '600',
  },

  content: {
    flex: 1,
    backgroundColor: C.content,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 44,
  },
  errorText: { color: C.danger, fontSize: 13, fontWeight: '600', marginBottom: 12 },

  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(201,162,39,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  infoValue: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  rowDivider: {
    height: 1,
    backgroundColor: C.border,
    marginLeft: 44,
  },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 18,
    marginBottom: 22,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statValue: { color: C.navy, fontSize: 20, fontWeight: '900', marginBottom: 3 },
  statLabel: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },

  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 14,
  },
  editBtnText: { color: C.navy, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },

  devBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.35)',
    borderRadius: 12,
    paddingVertical: 11,
    marginBottom: 14,
  },
  devBtnText: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
  },

  signOutBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  signOutText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '700',
  },
});
