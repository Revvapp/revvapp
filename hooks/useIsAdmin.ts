import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';

/**
 * Reads the `admin` custom claim off the signed-in user's ID token.
 *
 * This only decides whether admin UI is *shown*. Every admin action is a
 * callable that re-checks the same claim server-side (`requireAdmin`), so a user
 * who forces their way onto an admin screen still cannot do anything.
 *
 * The claim is minted into the token at sign-in, so a freshly granted admin has
 * to sign out and back in (or wait for the hourly refresh) before it appears.
 */
export function useIsAdmin(): { isAdmin: boolean; checking: boolean } {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    user
      .getIdTokenResult()
      .then((result) => {
        if (!cancelled) setIsAdmin(result.claims.admin === true);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isAdmin, checking };
}
