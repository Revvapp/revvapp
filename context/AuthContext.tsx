import { router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
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
import { navigateAfterAuth } from '@/lib/routing';
import type { UserDocument, UserType } from '@/types/firestore';

void SplashScreen.preventAutoHideAsync();

const PUBLIC_PATHS = new Set(['/', '/onboarding', '/login', '/signup', '/client/signup', '/client/welcome']);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname === '/detailer/onboarding/welcome') return true;
  if (pathname === '/detailer/onboarding/signup') return true;
  return false;
}

function isClientSidePath(pathname: string): boolean {
  return pathname.startsWith('/client');
}

function isDetailerSidePath(pathname: string): boolean {
  return pathname.startsWith('/detailer');
}

type AuthContextValue = {
  user: User | null;
  userProfile: UserDocument | null;
  userType: UserType | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadUserProfile(uid: string): Promise<UserDocument | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserDocument;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setUserProfile(null);
      return;
    }
    const p = await loadUserProfile(auth.currentUser.uid);
    setUserProfile(p);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }
      try {
        const p = await loadUserProfile(nextUser.uid);
        setUserProfile(p);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  useEffect(() => {
    if (loading || !pathname) return;

    if (!user) {
      if (!isPublicPath(pathname)) {
        router.replace('/');
      }
      return;
    }

    if (!userProfile) {
      router.replace('/');
      return;
    }

    const onClient = isClientSidePath(pathname);
    const onDetailer = isDetailerSidePath(pathname);

    if (onClient && userProfile.userType === 'detailer') {
      navigateAfterAuth(userProfile);
      return;
    }
    if (onDetailer && userProfile.userType === 'client') {
      navigateAfterAuth(userProfile);
      return;
    }

    if (
      pathname === '/login' ||
      pathname === '/signup' ||
      pathname === '/client/signup' ||
      pathname === '/client/welcome' ||
      pathname === '/detailer/onboarding/signup' ||
      pathname === '/' ||
      pathname === '/onboarding'
    ) {
      navigateAfterAuth(userProfile);
      return;
    }

    if (userProfile.userType === 'detailer' && userProfile.onboardingComplete === true) {
      if (pathname.startsWith('/detailer/onboarding')) {
        router.replace('/detailer/dashboard');
        return;
      }
    }

    if (userProfile.userType === 'client' && userProfile.onboardingComplete === true) {
      if (pathname.startsWith('/client/onboarding')) {
        router.replace('/client/dashboard');
        return;
      }
    }

    if (userProfile.userType === 'detailer' && userProfile.onboardingComplete !== true) {
      if (!pathname.startsWith('/detailer/onboarding')) {
        router.replace('/detailer/onboarding/welcome');
      }
      return;
    }

    if (userProfile.userType === 'client' && userProfile.onboardingComplete !== true) {
      if (!pathname.startsWith('/client/onboarding')) {
        router.replace('/client/onboarding');
      }
    }
  }, [loading, user, userProfile, pathname]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } finally {
      router.replace('/');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userProfile,
      userType: userProfile?.userType ?? null,
      loading,
      signOut,
      refreshProfile,
    }),
    [user, userProfile, loading, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return ctx;
}
