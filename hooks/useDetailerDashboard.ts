import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
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
import type { BookingDocument } from '@/types/firestore';

export type DetailerDashboardModel = {
  loading: boolean;
  firstName: string;
  displayName: string;
  initials: string;
  profilePhotoUrl: string | null;
  todayLabel: string;
  dailyGoal: number;
  todayEarnings: number;
  progressFraction: number;
  awayFromGoal: number;
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
  if (!n) return 'Pro';
  return n.split(/\s+/)[0] ?? 'Pro';
}

export function useDetailerDashboard(): DetailerDashboardModel {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<Omit<DetailerDashboardModel, 'loading' | 'error' | 'refetch'>>({
    firstName: 'Pro',
    displayName: '',
    initials: 'RV',
    profilePhotoUrl: null,
    todayLabel: formatDisplayDate(new Date()),
    dailyGoal: 500,
    todayEarnings: 0,
    progressFraction: 0,
    awayFromGoal: 500,
    progressPercentLabel: '0%',
    weekEarnings: 0,
    monthEarnings: 0,
    jobsTodayTotal: 0,
    jobsTodayDone: 0,
    jobsTodayLeft: 0,
    avgPerJob: null,
    hasBookingsToday: false,
    emptyToday: true,
  });

  const load = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const todayKey = getTodayKey();
      const ws = startOfWeekSunday(today);
      const we = endOfWeekSaturday(today);
      const ms = startOfMonth(today);
      const me = endOfMonth(today);

      const [detailerSnap, bookingsSnap] = await Promise.all([
        getDoc(doc(db, 'detailers', user.uid)),
        getDocs(query(collection(db, 'bookings'), where('detailerId', '==', user.uid))),
      ]);

      const fullName = detailerSnap.exists() ? String(detailerSnap.data().fullName ?? '') : '';
      const profilePhotoUrl = detailerSnap.exists()
        ? (detailerSnap.data().profilePhotoUrl as string | undefined) ?? null
        : null;
      const incomeGoal = detailerSnap.exists()
        ? (detailerSnap.data().incomeGoal as { daily?: number; weekly?: number } | undefined)
        : undefined;
      const dailyGoal = incomeGoal?.daily ?? 500;

      const bookings: BookingDocument[] = bookingsSnap.docs.map((d) => {
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
          createdAt: x.createdAt ?? null,
        };
      });

      const todayBookings = bookings.filter((b) => b.date === todayKey);
      const completedToday = todayBookings.filter((b) => b.status === 'completed');
      const todayEarnings = completedToday.reduce((s, b) => s + b.price, 0);
      const jobsTodayTotal = todayBookings.length;
      const jobsTodayDone = completedToday.length;
      const jobsTodayLeft = Math.max(0, jobsTodayTotal - jobsTodayDone);

      const weekBookings = bookings.filter((b) => dateKeyInRange(b.date, ws, we));
      const weekCompleted = weekBookings.filter((b) => b.status === 'completed');
      const weekEarnings = weekCompleted.reduce((s, b) => s + b.price, 0);

      const monthBookings = bookings.filter((b) => dateKeyInRange(b.date, ms, me));
      const monthCompleted = monthBookings.filter((b) => b.status === 'completed');
      const monthEarnings = monthCompleted.reduce((s, b) => s + b.price, 0);

      const completedWeekCount = weekCompleted.length;
      const avgPerJob = completedWeekCount > 0 ? weekEarnings / completedWeekCount : null;

      const progressFraction = dailyGoal > 0 ? Math.min(1, todayEarnings / dailyGoal) : 0;
      const awayFromGoal = Math.max(0, dailyGoal - todayEarnings);
      const progressPercentLabel = `${Math.round(progressFraction * 100)}%`;

      setModel({
        firstName: firstToken(fullName),
        displayName: fullName.trim() ? fullName.trim().toUpperCase() : (user.email ?? 'DETAILER').toUpperCase(),
        initials: initialsFromName(fullName, user.email),
        profilePhotoUrl,
        todayLabel: formatDisplayDate(today),
        dailyGoal,
        todayEarnings,
        progressFraction,
        awayFromGoal,
        progressPercentLabel,
        weekEarnings,
        monthEarnings,
        jobsTodayTotal,
        jobsTodayDone,
        jobsTodayLeft,
        avgPerJob,
        hasBookingsToday: todayBookings.length > 0,
        emptyToday: todayBookings.length === 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    error,
    refetch: load,
    ...model,
  };
}
