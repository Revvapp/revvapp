import { useEffect } from 'react';

import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';
import { savePushToken } from '@/lib/pushTokens';

export function useRegisterPushToken(uid: string | null | undefined) {
  useEffect(() => {
    if (!uid) return;

    (async () => {
      // Handles permissions, device check, Android channel and (critically)
      // the EAS projectId required for tokens to issue in production builds.
      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      await savePushToken(uid, token);
    })();
  }, [uid]);
}
