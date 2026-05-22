import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';

import { db } from '@/firebaseConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useRegisterPushToken(uid: string | null | undefined, collection: 'clients' | 'detailers') {
  useEffect(() => {
    if (!uid) return;

    (async () => {
      const { status: existing } = await Notifications.getPermissionsAsync();
      const { status } = existing === 'granted'
        ? { status: existing }
        : await Notifications.requestPermissionsAsync();

      if (status !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      await updateDoc(doc(db, collection, uid), { expoPushToken: token });
    })();
  }, [uid, collection]);
}
