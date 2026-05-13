import { onAuthStateChanged } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { auth, db } from '@/firebaseConfig';

export type OnboardingState = {
  fullName: string;
  businessName: string;
  phone: string;
  city: string;
  state: string;
  bio: string;
  services: string[];
  rates: Record<string, string>;
  workingDays: number[];
  workingHours: { from: string; to: string };
  serviceArea: string;
  maxJobsPerDay: number;
  incomeGoal: { daily: number; weekly: number };
  profilePhotoUrl: string;
  portfolioUrls: string[];
  idVerified: boolean;
};

const initialState = (): OnboardingState => ({
  fullName: '',
  businessName: '',
  phone: '',
  city: '',
  state: '',
  bio: '',
  services: [],
  rates: {},
  workingDays: [1, 2, 3, 4, 5, 6],
  workingHours: { from: '8:00 AM', to: '6:00 PM' },
  serviceArea: '',
  maxJobsPerDay: 3,
  incomeGoal: { daily: 0, weekly: 0 },
  profilePhotoUrl: '',
  portfolioUrls: [],
  idVerified: false,
});

type OnboardingContextValue = {
  state: OnboardingState;
  updateField: <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => void;
  reset: () => void;
  saveToFirebase: () => Promise<{ ok: true } | { ok: false; message: string }>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(initialState);

  const reset = useCallback(() => {
    setState(initialState());
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) reset();
    });
    return unsub;
  }, [reset]);

  const updateField = useCallback(<K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const saveToFirebase = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      return { ok: false, message: 'You must be signed in to save your profile.' };
    }

    try {
      await setDoc(
        doc(db, 'detailers', uid),
        {
          uid,
          fullName: state.fullName.trim(),
          businessName: state.businessName.trim(),
          phone: state.phone.trim(),
          city: state.city.trim(),
          state: state.state.trim().toUpperCase(),
          bio: state.bio.trim(),
          services: state.services,
          rates: state.rates,
          workingDays: state.workingDays,
          workingHours: state.workingHours,
          serviceArea: state.serviceArea.trim(),
          maxJobsPerDay: state.maxJobsPerDay,
          profilePhotoUrl: state.profilePhotoUrl,
          portfolioUrls: state.portfolioUrls,
          idVerified: state.idVerified,
          incomeGoal: state.incomeGoal,
          rating: 0,
          reviewCount: 0,
          isActive: true,
          profileComplete: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await setDoc(
        doc(db, 'users', uid),
        {
          onboardingComplete: true,
        },
        { merge: true }
      );
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : 'Could not save your profile. Try again.',
      };
    }
  }, [state]);

  const value = useMemo(
    () => ({
      state,
      updateField,
      reset,
      saveToFirebase,
    }),
    [state, updateField, reset, saveToFirebase]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}
