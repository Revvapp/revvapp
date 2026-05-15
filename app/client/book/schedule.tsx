import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

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
};

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function StepBar({ step }: { step: number }) {
  return (
    <View style={styles.stepBar}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.stepDot, i <= step && styles.stepDotActive]} />
      ))}
    </View>
  );
}

function parseTimeTo24(str: string): number {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${m.toString().padStart(2, '0')} ${period}`;
}

function generateSlots(from: string, to: string): string[] {
  const start = parseTimeTo24(from);
  const end = parseTimeTo24(to);
  if (start >= end || start === 0) return [];
  const slots: string[] = [];
  for (let t = start; t < end; t += 30) {
    slots.push(minutesToLabel(t));
  }
  return slots;
}

function getBookableDates(workingDays: number[]): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 1; i <= 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    if (workingDays.length === 0 || workingDays.includes(d.getDay())) {
      dates.push(d);
    }
  }
  return dates;
}

function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateToLabel(d: Date): string {
  return `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

type BookParams = {
  detailerId: string;
  detailerName: string;
  service: string;
  price: string;
  workingDaysJson: string;
  workingHoursFrom: string;
  workingHoursTo: string;
  vehicleId: string;
  vehicleLabel: string;
};

export default function BookScheduleScreen() {
  const params = useLocalSearchParams<BookParams>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const workingDays: number[] = (() => {
    try { return JSON.parse(params.workingDaysJson ?? '[]'); }
    catch { return []; }
  })();

  const bookableDates = getBookableDates(workingDays);
  const timeSlots = generateSlots(params.workingHoursFrom ?? '', params.workingHoursTo ?? '');
  const fallbackSlots = ['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM'];
  const slots = timeSlots.length > 0 ? timeSlots : fallbackSlots;

  function handleContinue() {
    if (!selectedDate || !selectedTime) return;
    router.push({
      pathname: '/client/book/confirm',
      params: {
        detailerId: params.detailerId,
        detailerName: params.detailerName,
        service: params.service,
        price: params.price,
        vehicleId: params.vehicleId,
        vehicleLabel: params.vehicleLabel,
        date: dateToKey(selectedDate),
        dateLabel: dateToLabel(selectedDate),
        time: selectedTime,
      },
    });
  }

  const canContinue = !!selectedDate && !!selectedTime;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Book a Detail</Text>
          <StepBar step={3} />
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Pick a Date</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStrip}
        >
          {bookableDates.map((d) => {
            const key = dateToKey(d);
            const isSelected = selectedDate ? dateToKey(selectedDate) === key : false;
            return (
              <Pressable
                key={key}
                style={[styles.datePill, isSelected && styles.datePillSelected]}
                onPress={() => { setSelectedDate(d); setSelectedTime(null); }}
              >
                <Text style={[styles.datePillDay, isSelected && styles.datePillTextSelected]}>
                  {DAY_SHORT[d.getDay()]}
                </Text>
                <Text style={[styles.datePillNum, isSelected && styles.datePillTextSelected]}>
                  {d.getDate()}
                </Text>
                <Text style={[styles.datePillMonth, isSelected && styles.datePillTextSelected]}>
                  {MONTH_SHORT[d.getMonth()]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {selectedDate && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Pick a Time</Text>
            <View style={styles.timeGrid}>
              {slots.map((slot) => {
                const isSelected = selectedTime === slot;
                return (
                  <Pressable
                    key={slot}
                    style={[styles.timePill, isSelected && styles.timePillSelected]}
                    onPress={() => setSelectedTime(slot)}
                  >
                    <Text style={[styles.timePillText, isSelected && styles.timePillTextSelected]}>
                      {slot}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {!selectedDate && (
          <View style={styles.hintWrap}>
            <Ionicons name="calendar-outline" size={36} color={COLORS.gray} />
            <Text style={styles.hintText}>Select a date to see available time slots</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.continueBtnText}>
            {canContinue
              ? `Continue · ${dateToLabel(selectedDate!)} at ${selectedTime}`
              : 'Select Date & Time'}
          </Text>
        </Pressable>
      </View>
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
  body: { flex: 1, backgroundColor: COLORS.content, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  bodyContent: { paddingTop: 20, paddingBottom: 30 },
  sectionLabel: { color: COLORS.blue, fontSize: 14, fontWeight: '900', paddingHorizontal: 16, marginBottom: 12 },
  dateStrip: { paddingHorizontal: 16, gap: 8 },
  datePill: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 62,
  },
  datePillSelected: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  datePillDay: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  datePillNum: { color: COLORS.blue, fontSize: 20, fontWeight: '900' },
  datePillMonth: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  datePillTextSelected: { color: COLORS.blue },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  timePill: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  timePillSelected: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  timePillText: { color: COLORS.blue, fontSize: 13, fontWeight: '700' },
  timePillTextSelected: { color: COLORS.blue },
  hintWrap: { alignItems: 'center', paddingTop: 40, gap: 10 },
  hintText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
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
  continueBtnText: { color: COLORS.blue, fontSize: 14, fontWeight: '900' },
});
