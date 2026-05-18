import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth, db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';

const COLORS = {
  bg: '#0D1B2A',
  card: '#F5F5F5',
  gold: '#C9A227',
  navy: '#1A3A5C',
  white: '#FFFFFF',
  gray: '#B7C1CC',
  darkText: '#0D1B2A',
  border: '#D8DEE6',
  error: '#D32F2F',
  success: '#2E7D32',
  muted: '#6B7885',
};

type SectionStatus = { message: string; ok: boolean } | null;

function Label({ text, optional }: { text: string; optional?: boolean }) {
  return (
    <Text style={styles.label}>
      {text}
      {optional && <Text style={styles.optional}> (optional)</Text>}
    </Text>
  );
}

function StatusBanner({ status }: { status: SectionStatus }) {
  if (!status) return null;
  return (
    <Text style={[styles.statusText, status.ok ? styles.statusOk : styles.statusErr]}>
      {status.message}
    </Text>
  );
}

export default function EditProfileScreen() {
  const { user } = useAuth();

  // Profile fields
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<SectionStatus>(null);

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailStatus, setEmailStatus] = useState<SectionStatus>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<SectionStatus>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.uid) { setProfileLoading(false); return; }
    try {
      const snap = await getDoc(doc(db, 'detailers', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setBusinessName(String(d.businessName ?? ''));
        setBio(String(d.bio ?? ''));
      }
    } finally {
      setProfileLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  // ── Save profile info ────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!user?.uid) return;
    setProfileSaving(true);
    setProfileStatus(null);
    try {
      await updateDoc(doc(db, 'detailers', user.uid), {
        businessName: businessName.trim(),
        bio: bio.trim(),
      });
      setProfileStatus({ ok: true, message: 'Profile updated.' });
    } catch (e) {
      setProfileStatus({
        ok: false,
        message: e instanceof Error ? e.message : 'Could not save profile.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Update email ─────────────────────────────────────────────────────────────
  const saveEmail = async () => {
    setEmailStatus(null);
    if (!newEmail.trim()) {
      setEmailStatus({ ok: false, message: 'Enter a new email address.' });
      return;
    }
    if (!emailPassword) {
      setEmailStatus({ ok: false, message: 'Enter your current password to confirm.' });
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser?.email) return;
    setEmailSaving(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, emailPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updateEmail(currentUser, newEmail.trim());
      setEmailStatus({ ok: true, message: 'Email updated successfully.' });
      setNewEmail('');
      setEmailPassword('');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setEmailStatus({ ok: false, message: 'Current password is incorrect.' });
      } else if (code === 'auth/email-already-in-use') {
        setEmailStatus({ ok: false, message: 'That email is already in use.' });
      } else if (code === 'auth/invalid-email') {
        setEmailStatus({ ok: false, message: 'Enter a valid email address.' });
      } else {
        setEmailStatus({ ok: false, message: 'Could not update email. Try again.' });
      }
    } finally {
      setEmailSaving(false);
    }
  };

  // ── Update password ──────────────────────────────────────────────────────────
  const savePassword = async () => {
    setPasswordStatus(null);
    if (!currentPassword) {
      setPasswordStatus({ ok: false, message: 'Enter your current password.' });
      return;
    }
    if (!newPassword) {
      setPasswordStatus({ ok: false, message: 'Enter a new password.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ ok: false, message: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ ok: false, message: 'New passwords do not match.' });
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser?.email) return;
    setPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setPasswordStatus({ ok: true, message: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPasswordStatus({ ok: false, message: 'Current password is incorrect.' });
      } else {
        setPasswordStatus({ ok: false, message: 'Could not update password. Try again.' });
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.backBtn} />
        </View>

        {profileLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.gold} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Profile Info ──────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PROFILE INFO</Text>

              <Label text="BUSINESS NAME" optional />
              <TextInput
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g. Elite Auto Detailing"
                placeholderTextColor="#9AA5B1"
                style={styles.input}
                autoCapitalize="words"
                onFocus={() => setProfileStatus(null)}
              />

              <Label text="BIO" optional />
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell clients what you specialise in…"
                placeholderTextColor="#9AA5B1"
                style={[styles.input, styles.textArea]}
                multiline
                textAlignVertical="top"
                onFocus={() => setProfileStatus(null)}
              />

              <StatusBanner status={profileStatus} />

              <Pressable
                style={[styles.saveBtn, profileSaving && styles.saveBtnDisabled]}
                onPress={saveProfile}
                disabled={profileSaving}
              >
                {profileSaving
                  ? <ActivityIndicator color={COLORS.darkText} />
                  : <Text style={styles.saveBtnText}>SAVE PROFILE</Text>}
              </Pressable>
            </View>

            {/* ── Email ─────────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CHANGE EMAIL</Text>
              <Text style={styles.sectionHint}>
                Current: {auth.currentUser?.email ?? '—'}
              </Text>

              <Label text="NEW EMAIL" />
              <TextInput
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="new@email.com"
                placeholderTextColor="#9AA5B1"
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setEmailStatus(null)}
              />

              <Label text="CURRENT PASSWORD" />
              <TextInput
                value={emailPassword}
                onChangeText={setEmailPassword}
                placeholder="Required to confirm"
                placeholderTextColor="#9AA5B1"
                style={styles.input}
                secureTextEntry
                onFocus={() => setEmailStatus(null)}
              />

              <StatusBanner status={emailStatus} />

              <Pressable
                style={[styles.saveBtn, emailSaving && styles.saveBtnDisabled]}
                onPress={saveEmail}
                disabled={emailSaving}
              >
                {emailSaving
                  ? <ActivityIndicator color={COLORS.darkText} />
                  : <Text style={styles.saveBtnText}>UPDATE EMAIL</Text>}
              </Pressable>
            </View>

            {/* ── Password ──────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CHANGE PASSWORD</Text>

              <Label text="CURRENT PASSWORD" />
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Your current password"
                placeholderTextColor="#9AA5B1"
                style={styles.input}
                secureTextEntry
                onFocus={() => setPasswordStatus(null)}
              />

              <Label text="NEW PASSWORD" />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 6 characters"
                placeholderTextColor="#9AA5B1"
                style={styles.input}
                secureTextEntry
                onFocus={() => setPasswordStatus(null)}
              />

              <Label text="CONFIRM NEW PASSWORD" />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat new password"
                placeholderTextColor="#9AA5B1"
                style={styles.input}
                secureTextEntry
                onFocus={() => setPasswordStatus(null)}
              />

              <StatusBanner status={passwordStatus} />

              <Pressable
                style={[styles.saveBtn, passwordSaving && styles.saveBtnDisabled]}
                onPress={savePassword}
                disabled={passwordSaving}
              >
                {passwordSaving
                  ? <ActivityIndicator color={COLORS.darkText} />
                  : <Text style={styles.saveBtnText}>UPDATE PASSWORD</Text>}
              </Pressable>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: { width: 60 },
  backText: { color: COLORS.gold, fontSize: 14, fontWeight: '700' },
  headerTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 40,
    gap: 16,
  },
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  sectionHint: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 14,
  },
  label: {
    color: '#1A2B3C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: 6,
    marginTop: 12,
  },
  optional: {
    color: COLORS.muted,
    fontWeight: '500',
    fontSize: 11,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.darkText,
    fontSize: 15,
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 2,
  },
  statusOk: { color: COLORS.success },
  statusErr: { color: COLORS.error },
  saveBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: COLORS.darkText,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
});
