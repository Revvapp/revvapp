import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C9A227',
    });
  }

  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId && __DEV__) {
    console.warn(
      '[push] No EAS projectId found (app.json → extra.eas.projectId). ' +
        'getExpoPushTokenAsync will fail, so no push token is saved and ' +
        'server-side notifications have nothing to deliver to. Run `eas init`.'
    );
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data;
  } catch (err) {
    if (__DEV__) console.warn('[push] Could not get Expo push token:', err);
    return null;
  }
}

// Outbound push sends live server-side in functions/src/notifications.ts, where
// they fire authoritatively off Firestore writes. The app only registers a
// token (above) and routes taps (hooks/useNotificationRouting.ts); it never
// sends pushes itself, so a backgrounded sender can't drop a notification.
