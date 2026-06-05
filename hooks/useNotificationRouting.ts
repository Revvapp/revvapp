import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';

/**
 * Routes the user to the relevant screen when they tap a push notification.
 * Senders attach a `data.type` (and an id) to every notification; here we map
 * that to a route, respecting whether the recipient is a client or detailer.
 *
 * Handles both taps while the app is running and the tap that cold-starts it.
 */
export function useNotificationRouting() {
  const { userType } = useAuth();

  useEffect(() => {
    function handle(response: Notifications.NotificationResponse | null) {
      if (!response || !userType) return;
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const type = String(data.type ?? '');
      const conversationId = data.conversationId ? String(data.conversationId) : null;
      const invoiceId = data.invoiceId ? String(data.invoiceId) : null;
      const bookingId = data.bookingId ? String(data.bookingId) : null;
      const isDetailer = userType === 'detailer';

      if (type === 'message' && conversationId) {
        router.push(
          isDetailer
            ? { pathname: '/detailer/conversation/[id]', params: { id: conversationId } }
            : { pathname: '/client/conversation/[id]', params: { id: conversationId } }
        );
        return;
      }

      if (type === 'dispute' && invoiceId) {
        router.push(
          isDetailer
            ? { pathname: '/detailer/dispute/[id]', params: { id: invoiceId } }
            : { pathname: '/client/invoice/[id]', params: { id: invoiceId } }
        );
        return;
      }

      if (type === 'review' && isDetailer) {
        router.push('/detailer/(tabs)/profile');
        return;
      }

      if (type === 'vir' && bookingId && !isDetailer) {
        router.push({ pathname: '/client/vir/[id]', params: { id: bookingId } });
        return;
      }

      if (type === 'job_complete' && bookingId && !isDetailer) {
        router.push({ pathname: '/client/invoice/[id]', params: { id: bookingId } });
        return;
      }

      if (type === 'booking_request' && bookingId && isDetailer) {
        router.push({ pathname: '/detailer/job/[id]', params: { id: bookingId } });
        return;
      }

      // Fallback: a booking-related notification with no specific type — land the
      // user on a sensible list rather than doing nothing.
      if (bookingId) {
        router.push(isDetailer ? '/detailer/(tabs)/jobs' : '/client/(tabs)/bookings');
      }
    }

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    // If a notification tap launched the app from a cold start, handle it once.
    Notifications.getLastNotificationResponseAsync().then(handle);
    return () => sub.remove();
  }, [userType]);
}
