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
  bg: '#0A1628',
  card: '#F5F5F5',
  gold: '#C9A227',
  navy: '#1A3A5C',
  white: '#FFFFFF',
  border: '#D8DEE6',
  error: '#D32F2F',
  success: '#2E7D32',
  muted: '#6B7885',
  darkText: '#0A1628',
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

export default function ClientEditProfileScreen() {
  const { user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<SectionStatus>(null);

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailStatus, setEmailStatus] = useState<SectionStatus>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<SectionStatus>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.uid) { setProfileLoading(false); return; }
    try {
      const snap = await getDoc(doc(db, 'clients', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setFullName(String(d.fullName ?? ''));
        setPhone(String(d.phone ?? ''));
        setCity(String(d.city ?? ''));
        setState(String(d.state ?? ''));
      }
    } finally {
      setProfileLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function saveProfile() {
    if (!user?.uid) return;
    setProfileSaving(true);
    setProfileStatus(null);
    try {
      await updateDoc(doc(db, 'clients', user.uid), {
        fullName: fullName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
      });
      setProfileStatus({ ok: true, message: 'Profile updated.' });
    } catch (e) {
      setProfileStatus({ ok: false, message: e instanceof Error ? e.message : 'Could not save profile.' });
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveEmail() {
    setEmailStatus(null);
    if (!newEmail.trim()) { setEmailStatus({ ok: false, message: 'Enter a new email address.' }); return; }
    if (!emailPassword) { setEmailStatus({ ok: false, message: 'Enter your current password to confirm.' }); return; }
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
      } else {
        setEmailStatus({ ok: false, message: 'Could not update email. Try again.' });
      }
    } finally {
      setEmailSaving(false);
    }
  }

  async function savePassword() {
    setPasswordStatus(null);
    if (!currentPassword) { setPasswordStatus({ ok: false, message: 'Enter your current password.' }); return; }
    if (!newPassword || newPassword.length < 6) { setPasswordStatus({ ok: false, message: 'New password must be at least 6 characters.' }); return; }
    if (newPassword !== confirmPassword) { setPasswordStatus({ ok: false, message: 'New passwords do not match.' }); return; }
    const currentUser = auth.currentUser;
    if (!currentUser?.email) return;
    setPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setPasswordStatus({ ok: true, message: 'Password updated successfully.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setPasswordStatus({ ok: false, message: code === 'auth/wrong-password' || code === 'auth/invalid-credential' ? 'Current password is incorrect.' : 'Could not update password. Try again.' });
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Personal Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PERSONAL INFO</Text>

              <Label text="FULL NAME" optional />
              <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Jane Smith" placeholderTextColor="#9AA5B1" autoCapitalize="words" onFocus={() => setProfileStatus(null)} />

              <Label text="PHONE" optional />
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(555) 000-0000" placeholderTextColor="#9AA5B1" keyboardType="phone-pad" onFocus={() => setProfileStatus(null)} />

              <View style={styles.row}>
                <View style={styles.rowField}>
                  <Label text="CITY" optional />
                  <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Los Angeles" placeholderTextColor="#9AA5B1" autoCapitalize="words" onFocus={() => setProfileStatus(null)} />
                </View>
                <View style={styles.rowFieldSmall}>
                  <Label text="STATE" optional />
                  <TextInput style={styles.input} value={state} onChangeText={(v) => setState(v.toUpperCase())} placeholder="CA" placeholderTextColor="#9AA5B1" autoCapitalize="characters" maxLength={2} onFocus={() => setProfileStatus(null)} />
                </View>
              </View>

              <StatusBanner status={profileStatus} />
              <Pressable style={[styles.saveBtn, profileSaving && styles.saveBtnDisabled]} onPress={saveProfile} disabled={profileSaving}>
                {profileSaving ? <ActivityIndicator color={COLORS.darkText} /> : <Text style={styles.saveBtnText}>SAVE PROFILE</Text>}
              </Pressable>
            </View>

            {/* Change Email */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CHANGE EMAIL</Text>
              <Text style={styles.sectionHint}>Current: {auth.currentUser?.email ?? '—'}</Text>

              <Label text="NEW EMAIL" />
              <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} placeholder="new@email.com" placeholderTextColor="#9AA5B1" autoCapitalize="none" keyboardType="email-address" onFocus={() => setEmailStatus(null)} />

              <Label text="CURRENT PASSWORD" />
              <TextInput style={styles.input} value={emailPassword} onChangeText={setEmailPassword} placeholder="Required to confirm" placeholderTextColor="#9AA5B1" secureTextEntry onFocus={() => setEmailStatus(null)} />

              <StatusBanner status={emailStatus} />
              <Pressable style={[styles.saveBtn, emailSaving && styles.saveBtnDisabled]} onPress={saveEmail} disabled={emailSaving}>
                {emailSaving ? <ActivityIndicator color={COLORS.darkText} /> : <Text style={styles.saveBtnText}>UPDATE EMAIL</Text>}
              </Pressable>
            </View>

            {/* Change Password */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CHANGE PASSWORD</Text>

              <Label text="CURRENT PASSWORD" />
              <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Your current password" placeholderTextColor="#9AA5B1" secureTextEntry onFocus={() => setPasswordStatus(null)} />

              <Label text="NEW PASSWORD" />
              <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="At least 6 characters" placeholderTextColor="#9AA5B1" secureTextEntry onFocus={() => setPasswordStatus(null)} />

              <Label text="CONFIRM NEW PASSWORD" />
              <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat new password" placeholderTextColor="#9AA5B1" secureTextEntry onFocus={() => setPasswordStatus(null)} />

              <StatusBanner status={passwordStatus} />
              <Pressable style={[styles.saveBtn, passwordSaving && styles.saveBtnDisabled]} onPress={savePassword} disabled={passwordSaving}>
                {passwordSaving ? <ActivityIndicator color={COLORS.darkText} /> : <Text style={styles.saveBtnText}>UPDATE PASSWORD</Text>}
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
  headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: '900', letterSpacing: 1.2 },
  content: { paddingHorizontal: 18, paddingBottom: 40, gap: 16 },
  section: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16 },
  sectionTitle: { color: COLORS.navy, fontSize: 12, fontWeight: '900', letterSpacing: 1.6, marginBottom: 4 },
  sectionHint: { color: COLORS.muted, fontSize: 12, fontWeight: '600', marginBottom: 14 },
  label: { color: COLORS.darkText, fontSize: 11, fontWeight: '900', letterSpacing: 1.3, marginBottom: 6, marginTop: 12 },
  optional: { color: COLORS.muted, fontWeight: '500', fontSize: 11 },
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
  row: { flexDirection: 'row', gap: 12 },
  rowField: { flex: 2 },
  rowFieldSmall: { flex: 1 },
  statusText: { fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 2 },
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
  saveBtnText: { color: COLORS.darkText, fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
});
