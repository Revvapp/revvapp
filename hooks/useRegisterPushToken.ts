import { doc, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';

import { db } from '@/firebaseConfig';
import { registerForPushNotificationsAsync } from '@/lib/pushNotifications';

export function useRegisterPushToken(uid: string | null | undefined, collection: 'clients' | 'detailers') {
  useEffect(() => {
    if (!uid) return;

    (async () => {
      // Handles permissions, device check, Android channel and (critically)
      // the EAS projectId required for tokens to issue in production builds.
      const token = await registerForPushNotificationsAsync();
      if (!token) return;

      try {
        await updateDoc(doc(db, collection, uid), { expoPushToken: token });
      } catch {
        // Best-effort — never block the dashboard on token persistence.
      }
    })();
  }, [uid, collection]);
}
