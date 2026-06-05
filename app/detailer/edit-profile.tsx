import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { DeleteAccountSection } from '@/components/DeleteAccountSection';
import { auth, db, storage } from '@/firebaseConfig';
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
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<SectionStatus>(null);

  // Services & rates
  const [services, setServices] = useState<string[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [servicesSaving, setServicesSaving] = useState(false);
  const [servicesStatus, setServicesStatus] = useState<SectionStatus>(null);

  // Availability
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [hoursFrom, setHoursFrom] = useState('');
  const [hoursTo, setHoursTo] = useState('');
  const [maxJobs, setMaxJobs] = useState('');
  const [availSaving, setAvailSaving] = useState(false);
  const [availStatus, setAvailStatus] = useState<SectionStatus>(null);

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
        setProfilePhotoUrl(d.profilePhotoUrl ? String(d.profilePhotoUrl) : null);
        const svcList: string[] = Array.isArray(d.services) ? d.services : [];
        setServices(svcList);
        const ratesRaw = d.rates && typeof d.rates === 'object' ? d.rates as Record<string, number> : {};
        const ratesStr: Record<string, string> = {};
        svcList.forEach((s) => { ratesStr[s] = ratesRaw[s] != null ? String(ratesRaw[s]) : ''; });
        setRates(ratesStr);
        const wh = d.workingHours && typeof d.workingHours === 'object' ? d.workingHours as Record<string, string> : {};
        setWorkingDays(Array.isArray(d.workingDays) ? d.workingDays : []);
        setHoursFrom(String(wh.from ?? ''));
        setHoursTo(String(wh.to ?? ''));
        setMaxJobs(d.maxJobsPerDay != null ? String(d.maxJobsPerDay) : '');
      }
    } finally {
      setProfileLoading(false);
    }
  }, [user?.uid]);

  async function pickAndUploadPhoto() {
    if (!user?.uid) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    const localUri = result.assets[0].uri;
    setPhotoUploading(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.responseType = 'blob';
        xhr.open('GET', localUri, true);
        xhr.send(null);
      });
      const ref = storageRef(storage, `detailers/${user.uid}/profile.jpg`);
      await uploadBytes(ref, blob);
      const url = await getDownloadURL(ref);
      await updateDoc(doc(db, 'detailers', user.uid), { profilePhotoUrl: url });
      setProfilePhotoUrl(url);
      setProfileStatus({ ok: true, message: 'Profile photo updated.' });
    } catch {
      Alert.alert('Error', 'Could not upload photo. Try again.');
    } finally {
      setPhotoUploading(false);
    }
  }

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function toggleDay(day: string) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function saveServices() {
    if (!user?.uid) return;
    setServicesSaving(true);
    setServicesStatus(null);
    try {
      const numericRates: Record<string, number> = {};
      services.forEach((s) => {
        const n = parseFloat(rates[s] ?? '0');
        numericRates[s] = isNaN(n) ? 0 : n;
      });
      await updateDoc(doc(db, 'detailers', user.uid), { rates: numericRates });
      setServicesStatus({ ok: true, message: 'Rates updated.' });
    } catch {
      setServicesStatus({ ok: false, message: 'Could not save rates. Try again.' });
    } finally {
      setServicesSaving(false);
    }
  }

  async function saveAvailability() {
    if (!user?.uid) return;
    setAvailSaving(true);
    setAvailStatus(null);
    try {
      await updateDoc(doc(db, 'detailers', user.uid), {
        workingDays,
        workingHours: { from: hoursFrom.trim(), to: hoursTo.trim() },
        maxJobsPerDay: parseInt(maxJobs, 10) || 0,
      });
      setAvailStatus({ ok: true, message: 'Availability updated.' });
    } catch {
      setAvailStatus({ ok: false, message: 'Could not save availability. Try again.' });
    } finally {
      setAvailSaving(false);
    }
  }

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

              <Pressable style={styles.photoWrap} onPress={pickAndUploadPhoto} disabled={photoUploading}>
                {profilePhotoUrl ? (
                  <Image source={{ uri: profilePhotoUrl }} style={styles.photoImage} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoInitial}>
                      {(auth.currentUser?.email ?? 'D')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.photoBadge}>
                  {photoUploading
                    ? <ActivityIndicator size="small" color={COLORS.white} />
                    : <Text style={styles.photoBadgeText}>Edit</Text>
                  }
                </View>
              </Pressable>

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

            {/* ── Services & Rates ──────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SERVICES & RATES</Text>
              {services.length === 0 ? (
                <Text style={styles.sectionHint}>No services set up. Complete onboarding to add services.</Text>
              ) : (
                services.map((svc) => (
                  <View key={svc}>
                    <Label text={svc.toUpperCase()} />
                    <View style={styles.rateRow}>
                      <Text style={styles.rateDollar}>$</Text>
                      <TextInput
                        value={rates[svc] ?? ''}
                        onChangeText={(v) => setRates((prev) => ({ ...prev, [svc]: v }))}
                        placeholder="0"
                        placeholderTextColor="#9AA5B1"
                        style={[styles.input, styles.rateInput]}
                        keyboardType="numeric"
                        onFocus={() => setServicesStatus(null)}
                      />
                    </View>
                  </View>
                ))
              )}
              <StatusBanner status={servicesStatus} />
              {services.length > 0 && (
                <Pressable
                  style={[styles.saveBtn, servicesSaving && styles.saveBtnDisabled]}
                  onPress={saveServices}
                  disabled={servicesSaving}
                >
                  {servicesSaving
                    ? <ActivityIndicator color={COLORS.darkText} />
                    : <Text style={styles.saveBtnText}>SAVE RATES</Text>}
                </Pressable>
              )}
            </View>

            {/* ── Availability ──────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AVAILABILITY</Text>

              <Label text="WORKING DAYS" />
              <View style={styles.daysRow}>
                {DAYS.map((day) => (
                  <Pressable
                    key={day}
                    style={[styles.dayChip, workingDays.includes(day) && styles.dayChipActive]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[styles.dayChipText, workingDays.includes(day) && styles.dayChipTextActive]}>
                      {day[0]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.hoursRow}>
                <View style={styles.hourField}>
                  <Label text="FROM" />
                  <TextInput
                    value={hoursFrom}
                    onChangeText={setHoursFrom}
                    placeholder="9:00 AM"
                    placeholderTextColor="#9AA5B1"
                    style={styles.input}
                    onFocus={() => setAvailStatus(null)}
                  />
                </View>
                <View style={styles.hourField}>
                  <Label text="TO" />
                  <TextInput
                    value={hoursTo}
                    onChangeText={setHoursTo}
                    placeholder="6:00 PM"
                    placeholderTextColor="#9AA5B1"
                    style={styles.input}
                    onFocus={() => setAvailStatus(null)}
                  />
                </View>
              </View>

              <Label text="MAX JOBS PER DAY" />
              <View style={styles.stepperRow}>
                <Pressable
                  style={styles.stepperBtn}
                  onPress={() => setMaxJobs((v) => String(Math.max(1, parseInt(v || '1', 10) - 1)))}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{maxJobs || '0'}</Text>
                <Pressable
                  style={styles.stepperBtn}
                  onPress={() => setMaxJobs((v) => String(Math.min(20, parseInt(v || '0', 10) + 1)))}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>

              <StatusBanner status={availStatus} />
              <Pressable
                style={[styles.saveBtn, availSaving && styles.saveBtnDisabled]}
                onPress={saveAvailability}
                disabled={availSaving}
              >
                {availSaving
                  ? <ActivityIndicator color={COLORS.darkText} />
                  : <Text style={styles.saveBtnText}>SAVE AVAILABILITY</Text>}
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

            <View style={styles.section}>
              <DeleteAccountSection userType="detailer" />
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
  photoWrap: {
    alignSelf: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  photoImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitial: { color: COLORS.darkText, fontSize: 32, fontWeight: '900' },
  photoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.navy,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: COLORS.card,
    minWidth: 36,
    alignItems: 'center',
  },
  photoBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  rateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingLeft: 13 },
  rateDollar: { color: COLORS.darkText, fontSize: 15, fontWeight: '700' },
  rateInput: { flex: 1, borderWidth: 0, borderRadius: 0, paddingLeft: 4 },
  daysRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  dayChip: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  dayChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  dayChipText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  dayChipTextActive: { color: COLORS.white },
  hoursRow: { flexDirection: 'row', gap: 12 },
  hourField: { flex: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  stepperBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { color: COLORS.navy, fontSize: 20, fontWeight: '700', lineHeight: 24 },
  stepperValue: { color: COLORS.darkText, fontSize: 22, fontWeight: '900', minWidth: 30, textAlign: 'center' },
});
