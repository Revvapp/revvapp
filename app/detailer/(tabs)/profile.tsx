import { Image } from 'expo-image';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import type { DetailerDocument } from '@/types/firestore';

const COLORS = {
  blue: '#1A3A5C',
  gold: '#C9A227',
  mutedBlue: '#6E8299',
  bg: '#F5F7FA',
  danger: '#C0392B',
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

export default function DetailerProfileScreen() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Partial<DetailerDocument> | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const snap = await getDoc(doc(db, 'detailers', user.uid));
      setProfile(snap.exists() ? (snap.data() as DetailerDocument) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  const fullName = (profile?.fullName ?? '').trim();
  const displayName = fullName || user?.email || 'Your profile';
  const rating = typeof profile?.rating === 'number' ? profile.rating : 0;
  const reviewCount = typeof profile?.reviewCount === 'number' ? profile.reviewCount : 0;
  const services = Array.isArray(profile?.services) ? profile?.services : [];
  const city = (profile?.city ?? '').trim();
  const stateCode = (profile?.state ?? '').trim();
  const location = city && stateCode ? `${city}, ${stateCode}` : city || stateCode || '';
  const initials = initialsFrom(fullName, user?.email);
  const photoUrl = (profile?.profilePhotoUrl ?? '').trim();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>My Profile</Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <Text style={styles.name}>{displayName}</Text>
        {!!location && <Text style={styles.location}>{location}</Text>}
        <Text style={styles.rating}>
          {reviewCount > 0 ? `${rating.toFixed(1)} ★ • ${reviewCount} reviews` : 'No reviews yet'}
        </Text>
      </View>

      <View style={styles.servicesCard}>
        <Text style={styles.sectionTitle}>Services Offered</Text>
        {services.length === 0 ? (
          <Text style={styles.emptyText}>No services added yet.</Text>
        ) : (
          <View style={styles.servicesList}>
            {services.map((service: string) => (
              <View key={service} style={styles.servicePill}>
                <Text style={styles.serviceText}>{service}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Pressable style={styles.editButton}>
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </Pressable>

      <Pressable style={styles.signOutButton} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
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
  error: { color: COLORS.danger, fontSize: 13, fontWeight: '600', marginBottom: 12 },
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
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatarImage: { width: '100%', height: '100%' },
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
    textAlign: 'center',
  },
  location: {
    color: COLORS.mutedBlue,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
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
  emptyText: { color: COLORS.mutedBlue, fontSize: 14, fontWeight: '600' },
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
    marginBottom: 12,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  signOutButton: {
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});
