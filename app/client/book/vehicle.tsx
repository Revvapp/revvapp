import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { toTitleCase } from '@/lib/format';
import type { VehicleDocument } from '@/types/firestore';

const COLORS = {
  bg: '#0D1B2A',
  content: '#F5F5F5',
  card: '#FFFFFF',
  blue: '#1A3A5C',
  gold: '#C9A227',
  gray: '#B7C1CC',
  muted: '#6B7885',
  border: '#E2E8F0',
  white: '#FFFFFF',
  red: '#D93025',
};

function StepBar({ step }: { step: number }) {
  return (
    <View style={styles.stepBar}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.stepDot, i <= step && styles.stepDotActive]} />
      ))}
    </View>
  );
}

type BookParams = {
  detailerId: string;
  detailerName: string;
  service: string;
  price: string;
  workingDaysJson: string;
  workingHoursFrom: string;
  workingHoursTo: string;
};

export default function BookVehicleScreen() {
  const params = useLocalSearchParams<BookParams>();
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState<VehicleDocument[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [newYear, setNewYear] = useState('');
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newColor, setNewColor] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    getDocs(collection(db, 'clients', user.uid, 'vehicles')).then((snap) => {
      const docs = snap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id,
          make: String(v.make ?? ''),
          model: String(v.model ?? ''),
          year: Number(v.year ?? 0),
          color: v.color ? String(v.color) : undefined,
          lastDetailedDate: v.lastDetailedDate != null ? String(v.lastDetailedDate) : null,
          ownerId: user.uid,
        } satisfies VehicleDocument;
      });
      setVehicles(docs);
      if (docs.length > 0) setSelectedId(docs[0].id);
      setLoadingVehicles(false);
    });
  }, [user?.uid]);

  async function handleAddVehicle() {
    setAddError('');
    const yearNum = parseInt(newYear);
    if (!newYear || isNaN(yearNum) || yearNum < 1970 || yearNum > new Date().getFullYear() + 1) {
      setAddError('Enter a valid year.');
      return;
    }
    if (!newMake.trim()) { setAddError('Enter the make.'); return; }
    if (!newModel.trim()) { setAddError('Enter the model.'); return; }
    if (!user?.uid) return;

    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'clients', user.uid, 'vehicles'), {
        make: newMake.trim().toLowerCase(),
        model: newModel.trim().toLowerCase(),
        year: yearNum,
        color: newColor.trim().toLowerCase() || null,
        lastDetailedDate: null,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      });
      const newVehicle: VehicleDocument = {
        id: ref.id,
        make: newMake.trim().toLowerCase(),
        model: newModel.trim().toLowerCase(),
        year: yearNum,
        color: newColor.trim().toLowerCase() || undefined,
        lastDetailedDate: null,
        ownerId: user.uid,
      };
      setVehicles((prev) => [...prev, newVehicle]);
      setSelectedId(ref.id);
      setShowAddForm(false);
      setNewYear(''); setNewMake(''); setNewModel(''); setNewColor('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to save vehicle.');
    } finally {
      setSaving(false);
    }
  }

  function handleContinue() {
    const vehicle = vehicles.find((v) => v.id === selectedId);
    if (!vehicle) return;
    const label = `${vehicle.year} ${toTitleCase(vehicle.make)} ${toTitleCase(vehicle.model)}`;
    router.push({
      pathname: '/client/book/schedule',
      params: {
        ...params,
        vehicleId: vehicle.id,
        vehicleLabel: label,
      },
    });
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Book a Detail</Text>
            <StepBar step={2} />
          </View>
          <View style={{ width: 30 }} />
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>Select Your Vehicle</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {loadingVehicles ? (
              <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 30 }} />
            ) : (
              vehicles.map((v) => {
                const isSelected = v.id === selectedId;
                const label = `${v.year} ${toTitleCase(v.make)} ${toTitleCase(v.model)}`;
                return (
                  <TouchableOpacity
                    key={v.id}
                    activeOpacity={0.75}
                    style={[styles.vehicleRow, isSelected && styles.vehicleRowSelected]}
                    onPress={() => { setSelectedId(v.id); setShowAddForm(false); }}
                  >
                    <Ionicons
                      name="car-sport-outline"
                      size={22}
                      color={isSelected ? COLORS.gold : COLORS.blue}
                    />
                    <View style={styles.vehicleInfo}>
                      <Text style={[styles.vehicleName, isSelected && styles.vehicleNameSelected]}>
                        {label}
                      </Text>
                      {v.color && (
                        <Text style={styles.vehicleColor}>{toTitleCase(v.color)}</Text>
                      )}
                    </View>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {!loadingVehicles && (
              <Pressable
                style={[styles.addRow, showAddForm && styles.addRowActive]}
                onPress={() => { setShowAddForm((v) => !v); setSelectedId(null); }}
              >
                <Ionicons
                  name={showAddForm ? 'remove-circle-outline' : 'add-circle-outline'}
                  size={20}
                  color={COLORS.gold}
                />
                <Text style={styles.addRowText}>Add a New Vehicle</Text>
              </Pressable>
            )}

            {showAddForm && (
              <View style={styles.addForm}>
                {addError ? <Text style={styles.addError}>{addError}</Text> : null}
                <View style={styles.formRow}>
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    placeholder="Year"
                    placeholderTextColor={COLORS.gray}
                    keyboardType="number-pad"
                    value={newYear}
                    onChangeText={setNewYear}
                    maxLength={4}
                  />
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    placeholder="Color (optional)"
                    placeholderTextColor={COLORS.gray}
                    value={newColor}
                    onChangeText={setNewColor}
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Make (e.g. Toyota)"
                  placeholderTextColor={COLORS.gray}
                  value={newMake}
                  onChangeText={setNewMake}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Model (e.g. Camry)"
                  placeholderTextColor={COLORS.gray}
                  value={newModel}
                  onChangeText={setNewModel}
                />
                <Pressable
                  style={[styles.saveVehicleBtn, saving && { opacity: 0.6 }]}
                  onPress={handleAddVehicle}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color={COLORS.white} />
                    : <Text style={styles.saveVehicleBtnText}>Save & Select</Text>
                  }
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.continueBtn, !selectedId && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!selectedId}
          >
            <Text style={styles.continueBtnText}>
              {selectedId ? 'Continue' : 'Select a Vehicle'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 8 },
  headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
  stepBar: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: '#2A3E52' },
  stepDotActive: { backgroundColor: COLORS.gold },
  body: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 20 },
  sectionLabel: { color: COLORS.blue, fontSize: 14, fontWeight: '900', paddingHorizontal: 16, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  vehicleRowSelected: { borderColor: COLORS.gold, backgroundColor: '#FFFBEF' },
  vehicleInfo: { flex: 1 },
  vehicleName: { color: COLORS.blue, fontSize: 15, fontWeight: '700' },
  vehicleNameSelected: { color: COLORS.blue },
  vehicleColor: { color: COLORS.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: COLORS.gold },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.gold },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: COLORS.card,
    marginBottom: 10,
  },
  addRowActive: { borderColor: COLORS.gold },
  addRowText: { color: COLORS.gold, fontSize: 14, fontWeight: '700' },
  addForm: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 10,
    gap: 10,
  },
  addError: { color: COLORS.red, fontSize: 13, fontWeight: '600' },
  formRow: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.blue,
    fontWeight: '600',
    flex: 1,
  },
  inputHalf: { flex: 1 },
  saveVehicleBtn: {
    backgroundColor: COLORS.blue,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveVehicleBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  footer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 20,
    paddingBottom: 34,
  },
  continueBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: '#E2CFA0' },
  continueBtnText: { color: COLORS.blue, fontSize: 15, fontWeight: '900' },
});
