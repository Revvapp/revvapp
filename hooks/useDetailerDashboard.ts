import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import {
  dateKeyInRange,
  endOfMonth,
  endOfWeekSaturday,
  formatDisplayDate,
  getTodayKey,
  startOfMonth,
  startOfWeekSunday,
} from '@/lib/dateKeys';
import { toTitleCase } from '@/lib/format';
import type { BookingDocument } from '@/types/firestore';

export type DetailerDashboardModel = {
  loading: boolean;
  greeting: string;
  firstName: string;
  displayName: string;
  businessName: string;
  initials: string;
  profilePhotoUrl: string | null;
  todayLabel: string;
  dailyGoal: number;
  todayEarnings: number;
  progressFraction: number;
  awayFromGoal: number;
  goalReached: boolean;
  progressPercentLabel: string;
  weekEarnings: number;
  monthEarnings: number;
  jobsTodayTotal: number;
  jobsTodayDone: number;
  jobsTodayLeft: number;
  avgPerJob: number | null;
  hasBookingsToday: boolean;
  emptyToday: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

function initialsFromName(name: string, email: string | null | undefined) {
  const n = name.trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  if (email && email.length >= 2) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'RV';
}

function firstToken(name: string) {
  const n = name.trim();
  if (!n) return '';
  return n.split(/\s+/)[0] ?? '';
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function useDetailerDashboard(): DetailerDashboardModel {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [dailyGoal, setDailyGoal] = useState(0);
  const [bookings, setBookings] = useState<BookingDocument[]>([]);

  // Fetch detailer profile — called on mount and on pull-to-refresh
  const loadProfile = useCallback(async () => {
    if (!user?.uid) {
      setProfileLoaded(true);
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'detailers', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setFullName(String(d.fullName ?? ''));
        setBusinessName(String(d.businessName ?? ''));
        setProfilePhotoUrl(d.profilePhotoUrl ? String(d.profilePhotoUrl) : null);
        const goal = d.incomeGoal as { daily?: number } | undefined;
        setDailyGoal(goal?.daily ?? 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profile.');
    } finally {
      setProfileLoaded(true);
    }
  }, [user?.uid]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // Real-time bookings listener — auto-updates when jobs are accepted/completed
  useEffect(() => {
    if (!user?.uid) {
      setBookingsLoaded(true);
      return;
    }
    const q = query(collection(db, 'bookings'), where('detailerId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: BookingDocument[] = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            clientId: String(x.clientId ?? ''),
            detailerId: String(x.detailerId ?? ''),
            service: String(x.service ?? ''),
            price: Number(x.price ?? 0),
            status: String(x.status ?? '').toLowerCase(),
            date: String(x.date ?? ''),
            time: String(x.time ?? ''),
            vehicleId: String(x.vehicleId ?? ''),
            clientName: x.clientName ? String(x.clientName) : undefined,
            vehicleLabel: x.vehicleLabel ? String(x.vehicleLabel) : undefined,
            createdAt: x.createdAt ?? null,
          };
        });
        setBookings(docs);
        setBookingsLoaded(true);
      },
      (e) => {
        setError(e.message);
        setBookingsLoaded(true);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  const loading = !profileLoaded || !bookingsLoaded;

  // All derived values — computed from current state, no memos needed (arrays are small)
  const today = new Date();
  const todayKey = getTodayKey();
  const ws = startOfWeekSunday(today);
  const we = endOfWeekSaturday(today);
  const ms = startOfMonth(today);
  const me = endOfMonth(today);

  const todayBookings = bookings.filter((b) => b.date === todayKey);
  const completedToday = todayBookings.filter((b) => b.status === 'completed');
  const todayEarnings = completedToday.reduce((s, b) => s + b.price, 0);
  const jobsTodayTotal = todayBookings.length;
  const jobsTodayDone = completedToday.length;
  const jobsTodayLeft = Math.max(0, jobsTodayTotal - jobsTodayDone);

  const weekCompleted = bookings.filter(
    (b) => b.status === 'completed' && dateKeyInRange(b.date, ws, we)
  );
  const weekEarnings = weekCompleted.reduce((s, b) => s + b.price, 0);

  const monthCompleted = bookings.filter(
    (b) => b.status === 'completed' && dateKeyInRange(b.date, ms, me)
  );
  const monthEarnings = monthCompleted.reduce((s, b) => s + b.price, 0);

  const completedWeekCount = weekCompleted.length;
  const avgPerJob = completedWeekCount > 0 ? weekEarnings / completedWeekCount : null;

  const progressFraction = dailyGoal > 0 ? Math.min(1, todayEarnings / dailyGoal) : 0;
  const awayFromGoal = Math.max(0, dailyGoal - todayEarnings);
  const goalReached = dailyGoal > 0 && todayEarnings >= dailyGoal;
  const progressPercentLabel = `${Math.round(progressFraction * 100)}%`;
  const emptyToday = todayBookings.length === 0;

  return {
    loading,
    error,
    refetch: loadProfile,
    greeting: getGreeting(),
    firstName: toTitleCase(firstToken(fullName)),
    displayName: businessName.trim()
      ? toTitleCase(businessName.trim())
      : fullName.trim()
      ? toTitleCase(fullName.trim())
      : (user?.email ?? 'Detailer'),
    businessName: toTitleCase(businessName.trim()),
    initials: initialsFromName(fullName, user?.email),
    profilePhotoUrl,
    todayLabel: formatDisplayDate(today),
    dailyGoal,
    todayEarnings,
    progressFraction,
    awayFromGoal,
    goalReached,
    progressPercentLabel,
    weekEarnings,
    monthEarnings,
    jobsTodayTotal,
    jobsTodayDone,
    jobsTodayLeft,
    avgPerJob,
    hasBookingsToday: todayBookings.length > 0,
    emptyToday,
  };
}
