import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { toTitleCase } from '@/lib/format';

const COLORS = {
  bg: '#0D1B2A',
  card: '#162232',
  content: '#F5F7FA',
  white: '#FFFFFF',
  gold: '#C9A227',
  blue: '#1A3A5C',
  teal: '#2ECC8F',
  red: '#C0392B',
  blueBtn: '#2D6BC4',
  gray: '#8FA3B1',
  muted: '#6B7885',
  border: '#E2E8F0',
  green: '#27AE60',
  panelClean: '#E6F7EE',
  panelCleanText: '#1A7A45',
  panelIssue: '#FDECEA',
  panelIssueText: '#C0392B',
};

const PAUSE_REASONS = ['Break', 'Product dry time', 'Client issue', 'Other'];

const PANEL_GRID = [
  { key: 'front', label: 'Front' },
  { key: 'roof', label: 'Roof' },
  { key: 'driverSide', label: 'Driver' },
  { key: 'passengerSide', label: 'Pass.' },
  { key: 'rear', label: 'Rear' },
  { key: 'interior', label: 'Interior' },
] as const;

interface ChecklistItem {
  name: string;
  estimatedMinutes: number;
  completed: boolean;
  completedMinutes?: number;
}

interface TimerBooking {
  id: string;
  clientId: string;
  clientName: string;
  vehicleLabel: string;
  service: string;
  price: number;
  status: string;
  virPanels?: Record<string, { notes: string; photoUrl: string }>;
  timerStartMs?: number | null;
  timerAccumulatedSeconds?: number;
  pauseReason?: string;
  serviceChecklist?: ChecklistItem[];
  preJobNotes?: string;
}

function buildChecklist(service: string): ChecklistItem[] {
  const s = service.toLowerCase();
  if (s.includes('paint correction') || s.includes('ceramic')) {
    return [
      { name: 'Pre-wash & decontamination', estimatedMinutes: 20, completed: false },
      { name: 'Clay bar treatment', estimatedMinutes: 25, completed: false },
      { name: 'Paint correction stage 1', estimatedMinutes: 60, completed: false },
      { name: 'Paint correction stage 2', estimatedMinutes: 60, completed: false },
      { name: 'Ceramic coating application', estimatedMinutes: 45, completed: false },
    ];
  }
  if (s.includes('interior') || s.includes('full detail')) {
    return [
      { name: 'Vacuum & blow out', estimatedMinutes: 20, completed: false },
      { name: 'Steam clean & scrub', estimatedMinutes: 30, completed: false },
      { name: 'Spot treatment', estimatedMinutes: 15, completed: false },
      { name: 'Wipe down & dress', estimatedMinutes: 20, completed: false },
      { name: 'Final inspection', estimatedMinutes: 10, completed: false },
    ];
  }
  if (s.includes('wash') || s.includes('basic')) {
    return [
      { name: 'Pre-rinse & foam wash', estimatedMinutes: 15, completed: false },
      { name: 'Hand wash & rinse', estimatedMinutes: 20, completed: false },
      { name: 'Dry & polish', estimatedMinutes: 15, completed: false },
      { name: 'Tire & trim dressing', estimatedMinutes: 10, completed: false },
    ];
  }
  return [
    { name: 'Pre-service prep', estimatedMinutes: 15, completed: false },
    { name: 'Main service', estimatedMinutes: 60, completed: false },
    { name: 'Detail work', estimatedMinutes: 30, completed: false },
    { name: 'Final inspection', estimatedMinutes: 15, completed: false },
  ];
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function initials(name: string): string {
  return name.trim().split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function TimerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<TimerBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [selectedPauseReason, setSelectedPauseReason] = useState('Break');
  const [saving, setSaving] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to booking
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'bookings', id), (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const d = snap.data();
      const b: TimerBooking = {
        id: snap.id,
        clientId: String(d.clientId ?? ''),
        clientName: String(d.clientName ?? 'Client'),
        vehicleLabel: String(d.vehicleLabel ?? ''),
        service: String(d.service ?? ''),
        price: Number(d.price ?? 0),
        status: String(d.status ?? ''),
        virPanels: d.virPanels ?? {},
        timerStartMs: d.timerStartMs ?? null,
        timerAccumulatedSeconds: Number(d.timerAccumulatedSeconds ?? 0),
        pauseReason: d.pauseReason ?? '',
        serviceChecklist: d.serviceChecklist ?? null,
        preJobNotes: d.preJobNotes ?? '',
      };
      setBooking(b);

      // Sync display seconds from Firestore
      if (b.status === 'in_progress' && b.timerStartMs) {
        const elapsed = b.timerAccumulatedSeconds! + Math.floor((Date.now() - b.timerStartMs) / 1000);
        setDisplaySeconds(elapsed);
      } else {
        setDisplaySeconds(b.timerAccumulatedSeconds ?? 0);
      }

      setLoading(false);
    }, (e) => {
      if (__DEV__) console.warn('[timer listener]', e.message);
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // Local tick when running
  useEffect(() => {
    if (booking?.status === 'in_progress') {
      tickRef.current = setInterval(() => setDisplaySeconds((s) => s + 1), 1000);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [booking?.status]);

  async function handleStart() {
    if (!id || !booking) return;
    setSaving(true);
    try {
      const checklist = buildChecklist(booking.service);
      await updateDoc(doc(db, 'bookings', id), {
        status: 'in_progress',
        timerStartMs: Date.now(),
        timerAccumulatedSeconds: 0,
        serviceChecklist: checklist,
      });
    } catch {
      Alert.alert('Error', 'Could not start timer.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePause() {
    if (!id || !booking) return;
    setSaving(true);
    try {
      const elapsed = (booking.timerAccumulatedSeconds ?? 0) +
        Math.floor((Date.now() - (booking.timerStartMs ?? Date.now())) / 1000);
      await updateDoc(doc(db, 'bookings', id), {
        status: 'paused',
        timerStartMs: null,
        timerAccumulatedSeconds: elapsed,
        pauseReason: selectedPauseReason,
      });
    } catch {
      Alert.alert('Error', 'Could not pause timer.');
    } finally {
      setSaving(false);
    }
  }

  async function handleResume() {
    if (!id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'bookings', id), {
        status: 'in_progress',
        timerStartMs: Date.now(),
      });
    } catch {
      Alert.alert('Error', 'Could not resume timer.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEndJob() {
    if (!id || !booking) return;
    Alert.alert(
      'End Job?',
      'This will mark the job as complete and stop the timer.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Job',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const elapsed = booking.timerAccumulatedSeconds ?? displaySeconds;
              await updateDoc(doc(db, 'bookings', id), {
                status: 'completed',
                timerStartMs: null,
                timerAccumulatedSeconds: elapsed,
                completedAt: serverTimestamp(),
              });
              // The client is notified server-side (onBookingStatusChanged → completed).
              router.replace({ pathname: '/detailer/before-after/[id]', params: { id: id! } });
            } catch {
              Alert.alert('Error', 'Could not end job.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  async function toggleChecklistItem(index: number) {
    if (!id || !booking?.serviceChecklist) return;
    const updated = booking.serviceChecklist.map((item, i) => {
      if (i !== index) return item;
      return {
        ...item,
        completed: !item.completed,
        completedMinutes: !item.completed ? Math.floor(displaySeconds / 60) : undefined,
      };
    });
    await updateDoc(doc(db, 'bookings', id), { serviceChecklist: updated });
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}><Text style={styles.errorText}>Booking not found.</Text></View>
      </SafeAreaView>
    );
  }

  const isNotStarted = booking.status === 'vir_signed';
  const isRunning = booking.status === 'in_progress';
  const isPaused = booking.status === 'paused';

  const stepLabel = isNotStarted
    ? '1 — PRE-JOB INSPECTION'
    : isRunning
    ? '2 — TIMER RUNNING'
    : isPaused
    ? '3 — TIMER PAUSED'
    : '4 — JOB COMPLETE';

  const statusBadgeLabel = isNotStarted ? 'Ready' : isRunning ? 'In progress' : isPaused ? 'Paused' : 'Done';
  const statusBadgeColor = isNotStarted ? COLORS.gray : isRunning ? COLORS.teal : isPaused ? '#E57373' : COLORS.teal;

  const virPanels = booking.virPanels ?? {};
  const panelsWithIssues = PANEL_GRID.filter((p) => virPanels[p.key]?.notes?.trim());
  const checklist = booking.serviceChecklist ?? [];
  const completedCount = checklist.filter((i) => i.completed).length;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.gray} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>REVV</Text>
          <Text style={styles.headerTitle}>Job Timer</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <Text style={styles.stepLabel}>{stepLabel}</Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Job Card */}
        <View style={styles.jobCard}>
          <View style={styles.jobCardTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(booking.clientName)}</Text>
            </View>
            <View style={styles.jobInfo}>
              <Text style={styles.clientName}>{toTitleCase(booking.clientName)}</Text>
              <Text style={styles.vehicleLabel}>{booking.vehicleLabel}</Text>
              <Text style={styles.serviceLabel}>{toTitleCase(booking.service)}</Text>
            </View>
            <View style={styles.statusDotWrap}>
              <View style={[styles.statusDotCircle, { backgroundColor: statusBadgeColor }]} />
              <Text style={styles.statusDotText}>{statusBadgeLabel}</Text>
            </View>
          </View>

          {/* Timer Display */}
          {isRunning ? (
            <View style={styles.timerRunningBlock}>
              <View style={styles.ringWrap}>
                <View style={styles.ringOuter}>
                  <View style={styles.ringInner} />
                </View>
                <View style={styles.ringTimeOverlay}>
                  <Text style={styles.elapsedLabel}>ELAPSED TIME</Text>
                  <Text style={styles.timerRunning}>{formatTime(displaySeconds)}</Text>
                </View>
              </View>
            </View>
          ) : isPaused ? (
            <View style={styles.timerPausedBlock}>
              <Text style={styles.timerPausedLabel}>TIMER PAUSED</Text>
              <Text style={styles.timerPaused}>{formatTime(displaySeconds)}</Text>
              <Text style={styles.timerMeta}>Tap resume to continue</Text>
            </View>
          ) : (
            <View style={styles.timerNotStartedBlock}>
              <Text style={styles.timerNotStartedLabel}>TIMER — NOT STARTED</Text>
              <Text style={styles.timerNotStarted}>{formatTime(0)}</Text>
              <Text style={styles.timerMeta}>Complete inspection to start</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {isNotStarted && (
              <>
                <Pressable
                  style={[styles.btnStart, styles.btnDisabledStyle]}
                  onPress={handleStart}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.btnStartText}>START TIMER</Text>}
                </Pressable>
                <Pressable style={styles.btnNotes}>
                  <Text style={styles.btnNotesText}>Notes</Text>
                </Pressable>
              </>
            )}
            {isRunning && (
              <>
                <Pressable style={styles.btnPause} onPress={handlePause} disabled={saving}>
                  {saving ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.btnPauseText}>PAUSE</Text>}
                </Pressable>
                <Pressable style={styles.btnNotes}>
                  <Text style={styles.btnNotesText}>Notes</Text>
                </Pressable>
              </>
            )}
            {isPaused && (
              <>
                <Pressable style={styles.btnResume} onPress={handleResume} disabled={saving}>
                  {saving ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.btnResumeText}>RESUME</Text>}
                </Pressable>
                <Pressable style={styles.btnEndJob} onPress={handleEndJob} disabled={saving}>
                  <Text style={styles.btnEndJobText}>End job</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* VIR Panel Grid (not started or paused) */}
        {(isNotStarted || isPaused) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle inspection</Text>
            <Text style={styles.sectionSub}>Log condition before starting. Client must sign off.</Text>

            <View style={styles.panelGrid}>
              {PANEL_GRID.map((panel) => {
                const data = virPanels[panel.key];
                const hasIssue = !!data?.notes?.trim();
                const conditionLabel = hasIssue ? data.notes.trim() : 'Clean';
                return (
                  <View
                    key={panel.key}
                    style={[
                      styles.panelCell,
                      { backgroundColor: hasIssue ? COLORS.panelIssue : COLORS.panelClean },
                    ]}
                  >
                    <Text style={[styles.panelCellTitle, { color: hasIssue ? COLORS.panelIssueText : COLORS.panelCleanText }]}>
                      {panel.label}
                    </Text>
                    <Text style={[styles.panelCellCondition, { color: hasIssue ? COLORS.panelIssueText : COLORS.panelCleanText }]} numberOfLines={2}>
                      {conditionLabel}
                    </Text>
                  </View>
                );
              })}
            </View>

            {panelsWithIssues.length > 0 && (
              <View style={styles.issuesSummary}>
                <Text style={styles.issuesSummaryTitle}>{panelsWithIssues.length} issue{panelsWithIssues.length > 1 ? 's' : ''} noted</Text>
                <Text style={styles.issuesSummaryBody}>
                  {panelsWithIssues.map((p) => virPanels[p.key]?.notes?.trim()).join(' · ')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Service Checklist (running or paused) */}
        {(isRunning || isPaused) && checklist.length > 0 && (
          <View style={styles.section}>
            <View style={styles.checklistHeader}>
              <Text style={styles.sectionTitle}>Service checklist</Text>
              <Text style={styles.checklistCount}>{completedCount} of {checklist.length} complete</Text>
            </View>

            <View style={styles.checklistCard}>
              {checklist.map((item, index) => {
                const isNext = !item.completed && checklist.slice(0, index).every((i) => i.completed);
                return (
                  <Pressable
                    key={item.name}
                    style={[styles.checklistItem, index < checklist.length - 1 && styles.checklistItemBorder]}
                    onPress={() => toggleChecklistItem(index)}
                  >
                    <View style={item.completed ? styles.checkDone : isNext ? styles.checkNext : styles.checkEmpty}>
                      {item.completed
                        ? <Ionicons name="checkmark" size={14} color={COLORS.white} />
                        : isNext
                        ? <Text style={styles.checkNextNum}>{index + 1}</Text>
                        : null}
                    </View>
                    <View style={styles.checklistItemInfo}>
                      <Text style={[styles.checklistItemName, item.completed && styles.checklistItemDone]}>
                        {item.name}
                      </Text>
                      {isNext && <Text style={styles.checklistNextLabel}>Next up</Text>}
                    </View>
                    <Text style={styles.checklistTime}>
                      {item.completed && item.completedMinutes != null
                        ? `${item.completedMinutes} min`
                        : '—'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Pause Reason (paused only) */}
        {isPaused && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pause reason</Text>
            <View style={styles.pauseReasons}>
              {PAUSE_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  style={[styles.pauseChip, selectedPauseReason === reason && styles.pauseChipSelected]}
                  onPress={() => setSelectedPauseReason(reason)}
                >
                  <Text style={[styles.pauseChipText, selectedPauseReason === reason && styles.pauseChipTextSelected]}>
                    {reason}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: COLORS.gray, fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backBtn: { padding: 4 },
  headerCenter: { alignItems: 'center' },
  eyebrow: { color: COLORS.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },
  headerTitle: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  headerRight: { width: 40 },

  stepLabel: {
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 12,
  },

  scroll: { paddingHorizontal: 16, paddingBottom: 20 },

  // Job Card
  jobCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  jobCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.gold, fontSize: 16, fontWeight: '900' },
  jobInfo: { flex: 1 },
  clientName: { color: COLORS.white, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  vehicleLabel: { color: COLORS.gray, fontSize: 13, fontWeight: '500', marginBottom: 1 },
  serviceLabel: { color: COLORS.gray, fontSize: 13, fontWeight: '500' },
  statusDotWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDotCircle: { width: 7, height: 7, borderRadius: 3.5 },
  statusDotText: { color: COLORS.gray, fontSize: 12, fontWeight: '700' },

  // Timer states
  timerNotStartedBlock: { alignItems: 'center', paddingVertical: 10, gap: 6 },
  timerNotStartedLabel: { color: COLORS.gray, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  timerNotStarted: { color: COLORS.gold, fontSize: 48, fontWeight: '800', letterSpacing: 2, fontVariant: ['tabular-nums'] },

  timerRunningBlock: { alignItems: 'center', paddingVertical: 10 },
  ringWrap: { alignItems: 'center', justifyContent: 'center', width: 160, height: 160 },
  ringOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 6,
    borderColor: COLORS.teal,
    position: 'absolute',
    opacity: 0.3,
  },
  ringInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 6,
    borderTopColor: COLORS.teal,
    borderRightColor: COLORS.teal,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
  },
  ringTimeOverlay: { alignItems: 'center' },
  elapsedLabel: { color: COLORS.gray, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  timerRunning: { color: COLORS.teal, fontSize: 38, fontWeight: '800', letterSpacing: 2, fontVariant: ['tabular-nums'] },

  timerPausedBlock: { alignItems: 'center', paddingVertical: 10, gap: 6 },
  timerPausedLabel: { color: COLORS.gray, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  timerPaused: { color: '#5A6A7A', fontSize: 48, fontWeight: '800', letterSpacing: 2, fontVariant: ['tabular-nums'] },

  timerMeta: { color: COLORS.muted, fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnStart: {
    flex: 2,
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabledStyle: { opacity: 0.7 },
  btnStartText: { color: COLORS.blue, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  btnPause: {
    flex: 2,
    backgroundColor: COLORS.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPauseText: { color: COLORS.white, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  btnResume: {
    flex: 2,
    backgroundColor: COLORS.blueBtn,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnResumeText: { color: COLORS.white, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  btnEndJob: {
    flex: 1,
    backgroundColor: '#2A3040',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnEndJobText: { color: COLORS.gray, fontSize: 14, fontWeight: '600' },
  btnNotes: {
    flex: 1,
    backgroundColor: '#2A3040',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnNotesText: { color: COLORS.gray, fontSize: 14, fontWeight: '600' },

  // Sections
  lightArea: {
    backgroundColor: '#F4F6F9',
    borderRadius: 20,
    padding: 4,
    marginBottom: 12,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { color: COLORS.blue, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sectionSub: { color: COLORS.muted, fontSize: 13, marginBottom: 14 },

  // Panel grid
  panelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  panelCell: {
    width: '30.5%',
    borderRadius: 12,
    padding: 10,
    minHeight: 64,
    justifyContent: 'center',
  },
  panelCellTitle: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  panelCellCondition: { fontSize: 11, fontWeight: '600' },
  issuesSummary: {
    marginTop: 12,
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    padding: 12,
  },
  issuesSummaryTitle: { color: COLORS.red, fontSize: 13, fontWeight: '800', marginBottom: 3 },
  issuesSummaryBody: { color: '#8B2020', fontSize: 12, fontWeight: '500', lineHeight: 18 },

  // Checklist
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checklistCount: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  checklistCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.white,
  },
  checklistItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  checkDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkNext: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkNextNum: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  checkEmpty: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D0D8E0',
  },
  checklistItemInfo: { flex: 1 },
  checklistItemName: { color: COLORS.blue, fontSize: 14, fontWeight: '700' },
  checklistItemDone: {
    textDecorationLine: 'line-through',
    color: COLORS.muted,
  },
  checklistNextLabel: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  checklistTime: { color: COLORS.muted, fontSize: 13, fontWeight: '600', minWidth: 40, textAlign: 'right' },

  // Pause reasons
  pauseReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  pauseChip: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#D0D8E0',
    backgroundColor: COLORS.white,
  },
  pauseChipSelected: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  pauseChipText: { color: COLORS.blue, fontSize: 14, fontWeight: '600' },
  pauseChipTextSelected: { color: COLORS.white },
});
