import { useAuthContext } from '@/context/AuthContext';

export function useAuth() {
  const ctx = useAuthContext();
  const isDetailer = ctx.userType === 'detailer';
  const isClient = ctx.userType === 'client';
  return {
    user: ctx.user,
    userProfile: ctx.userProfile,
    userType: ctx.userType,
    isDetailer,
    isClient,
    loading: ctx.loading,
    initialized: ctx.initialized,
    signOut: ctx.signOut,
    refreshProfile: ctx.refreshProfile,
  };
}
