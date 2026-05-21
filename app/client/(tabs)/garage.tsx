import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarSilhouette } from '@/components/CarSilhouette';
import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import type { BodyType } from '@/types/firestore';

const C = {
  bg:      '#0A1628',
  surface: '#F5F7FA',
  card:    '#FFFFFF',
  navy:    '#1A3A5C',
  gold:    '#C9A227',
  goldDim: 'rgba(201,162,39,0.1)',
  goldRing:'rgba(201,162,39,0.3)',
  gray:    '#8A9BB0',
  muted:   '#6B7A8D',
  border:  '#E8EDF4',
  white:   '#FFFFFF',
  input:   '#F0F3F8',
};

const BODY_TYPES: { type: BodyType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { type: 'sedan',       label: 'Sedan',       icon: 'car-outline' },
  { type: 'suv',         label: 'SUV',         icon: 'car-sport-outline' },
  { type: 'truck',       label: 'Truck',       icon: 'construct-outline' },
  { type: 'coupe',       label: 'Coupe',       icon: 'flash-outline' },
  { type: 'minivan',     label: 'Minivan',     icon: 'people-outline' },
  { type: 'convertible', label: 'Convertible', icon: 'sunny-outline' },
];

type Vehicle = {
  id: string;
  year: string;
  make: string;
  model: string;
  color: string;
  licensePlate: string;
  bodyType: BodyType;
};

const BLANK = { year: '', make: '', model: '', color: '', licensePlate: '', bodyType: 'sedan' as BodyType };

function VehicleCard({ vehicle, onDelete }: { vehicle: Vehicle; onDelete: () => void }) {
  const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();

  return (
    <View style={styles.card}>
      <View style={styles.cardSilhouette}>
        <CarSilhouette bodyType={vehicle.bodyType} animate={false} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardLabel} numberOfLines={1}>{label || 'Vehicle'}</Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {[vehicle.color, vehicle.licensePlate].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Pressable
        style={styles.deleteBtn}
        onPress={() =>
          Alert.alert('Remove Vehicle', `Remove ${label} from your garage?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: onDelete },
          ])
        }
      >
        <Ionicons name="trash-outline" size={18} color={C.muted} />
      </Pressable>
    </View>
  );
}

export default function ClientGarageScreen() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const q = query(collection(db, 'clients', user.uid, 'vehicles'));
    const unsub = onSnapshot(q, (snap) => {
      setVehicles(
        snap.docs.map((d) => ({
          id: d.id,
          year: String(d.data().year ?? ''),
          make: String(d.data().make ?? ''),
          model: String(d.data().model ?? ''),
          color: String(d.data().color ?? ''),
          licensePlate: String(d.data().licensePlate ?? ''),
          bodyType: (d.data().bodyType as BodyType) ?? 'sedan',
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  async function saveVehicle() {
    if (!form.make.trim() || !form.model.trim() || !user?.uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'clients', user.uid, 'vehicles'), {
        year: form.year.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        color: form.color.trim(),
        licensePlate: form.licensePlate.trim(),
        bodyType: form.bodyType,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
      });
      setForm(BLANK);
      setModalVisible(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteVehicle(id: string) {
    if (!user?.uid) return;
    await deleteDoc(doc(db, 'clients', user.uid, 'vehicles', id));
  }

  const canSave = form.make.trim().length > 0 && form.model.trim().length > 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>REVV</Text>
          <Text style={styles.headerTitle}>My Garage</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => { setForm(BLANK); setModalVisible(true); }}>
          <Ionicons name="add" size={22} color={C.navy} />
        </Pressable>
      </View>

      <Animated.View entering={FadeIn.duration(350)} style={styles.content}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.centered}>
            <View style={styles.emptyRing}>
              <Ionicons name="car-sport-outline" size={28} color={C.gold} />
            </View>
            <Text style={styles.emptyTitle}>No vehicles yet</Text>
            <Text style={styles.emptyBody}>
              Add your vehicles so detailers know exactly what to expect.
            </Text>
            <Pressable style={styles.emptyAddBtn} onPress={() => { setForm(BLANK); setModalVisible(true); }}>
              <Text style={styles.emptyAddBtnText}>Add Your First Vehicle</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {vehicles.map((v, i) => (
              <Animated.View key={v.id} entering={FadeInDown.delay(i * 60).springify()}>
                <VehicleCard vehicle={v} onDelete={() => deleteVehicle(v.id)} />
              </Animated.View>
            ))}
          </ScrollView>
        )}
      </Animated.View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalDismiss} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Vehicle</Text>

            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Year</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="2022"
                  placeholderTextColor={C.muted}
                  value={form.year}
                  onChangeText={(v) => setForm((f) => ({ ...f, year: v }))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              <View style={[styles.field, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>Make *</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="BMW"
                  placeholderTextColor={C.muted}
                  value={form.make}
                  onChangeText={(v) => setForm((f) => ({ ...f, make: v }))}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Model *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="M3"
                placeholderTextColor={C.muted}
                value={form.model}
                onChangeText={(v) => setForm((f) => ({ ...f, model: v }))}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Color</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="White"
                  placeholderTextColor={C.muted}
                  value={form.color}
                  onChangeText={(v) => setForm((f) => ({ ...f, color: v }))}
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Plate</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="ABC 1234"
                  placeholderTextColor={C.muted}
                  value={form.licensePlate}
                  onChangeText={(v) => setForm((f) => ({ ...f, licensePlate: v.toUpperCase() }))}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Body type picker */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Body Type</Text>
              <View style={styles.bodyTypeRow}>
                {BODY_TYPES.map(({ type, label, icon }) => {
                  const active = form.bodyType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.bodyTypeChip, active && styles.bodyTypeChipActive]}
                      onPress={() => setForm((f) => ({ ...f, bodyType: type }))}
                    >
                      <Ionicons name={icon} size={14} color={active ? C.navy : C.muted} />
                      <Text style={[styles.bodyTypeLabel, active && styles.bodyTypeLabelActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
              onPress={saveVehicle}
              disabled={!canSave || saving}
            >
              {saving
                ? <ActivityIndicator color={C.navy} size="small" />
                : <Text style={styles.saveBtnText}>Add to Garage</Text>
              }
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 22,
  },
  eyebrow: { color: C.gold, fontSize: 11, fontWeight: '800', letterSpacing: 3, marginBottom: 4 },
  headerTitle: { color: C.white, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  content: {
    flex: 1,
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 44,
    paddingBottom: 60,
  },
  emptyRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.goldDim,
    borderWidth: 1.5,
    borderColor: C.goldRing,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: C.navy, fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptyBody: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  emptyAddBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  emptyAddBtnText: { color: C.navy, fontSize: 14, fontWeight: '900' },

  list: { padding: 18, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardSilhouette: {
    width: 100,
    overflow: 'hidden',
    transform: [{ scale: 0.5 }],
    marginLeft: -20,
  },
  cardBody: { flex: 1 },
  cardLabel: { color: C.navy, fontSize: 15, fontWeight: '800', marginBottom: 3 },
  cardSub: { color: C.muted, fontSize: 13, fontWeight: '500' },
  deleteBtn: { padding: 6 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
    gap: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: { color: C.navy, fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },

  fieldRow: { flexDirection: 'row', gap: 12 },
  field: { gap: 6 },
  fieldLabel: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  fieldInput: {
    backgroundColor: C.input,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.navy,
    fontWeight: '600',
  },

  bodyTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  bodyTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.3,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: C.input,
  },
  bodyTypeChipActive: {
    backgroundColor: 'rgba(201,162,39,0.12)',
    borderColor: C.gold,
  },
  bodyTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
  },
  bodyTypeLabelActive: {
    color: C.navy,
  },

  saveBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnOff: { opacity: 0.4 },
  saveBtnText: { color: C.navy, fontSize: 15, fontWeight: '900' },
});
