import { router, usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { navigateAfterAuth } from '@/lib/routing';
import type { UserType } from '@/types/firestore';

type ProtectedRouteProps = {
  requiredType: UserType;
  /** Exact pathnames guests may open without auth (e.g. welcome / signup). */
  publicPaths?: string[];
  children: ReactNode;
};

export function ProtectedRoute({ requiredType, publicPaths = [], children }: ProtectedRouteProps) {
  const pathname = usePathname();
  const { user, userProfile, loading } = useAuth();

  const isPublic = pathname ? publicPaths.includes(pathname) : false;

  useEffect(() => {
    if (!pathname || loading) return;

    if (user && userProfile && userProfile.userType !== requiredType) {
      navigateAfterAuth(userProfile);
      return;
    }

    if (isPublic) return;

    if (!user) {
      router.replace('/');
      return;
    }
    if (!userProfile) {
      router.replace('/');
      return;
    }
  }, [pathname, isPublic, loading, user, userProfile, requiredType]);

  const wrongType = !!(user && userProfile && userProfile.userType !== requiredType);

  if (isPublic) {
    if (!loading && wrongType) {
      return (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#C9A227" />
        </View>
      );
    }
    return <>{children}</>;
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#C9A227" />
      </View>
    );
  }

  if (!user || !userProfile || userProfile.userType !== requiredType) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#C9A227" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#0D1B2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
