import { logger } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { db } from './admin';

/**
 * Server-side push notifications.
 *
 * Notifications used to be sent from the *sender's* device, right after it wrote
 * the triggering document. That only fired if the app stayed foregrounded long
 * enough for the fetch to land — a client who booked and immediately closed the
 * app could leave the detailer never notified of the request. Moving the sends
 * to Firestore triggers makes them authoritative: the notification fires off the
 * committed write, regardless of what the sender's app did next.
 *
 * Each function looks up the recipient's Expo token in `pushTokens/{uid}` (the
 * Admin SDK bypasses security rules) and posts to Expo's push service. Sends are
 * best-effort and never throw — a failed push must not fail the trigger.
 */

type PushData = Record<string, string>;

/** Title-case a service slug like "full_interior" → "Full Interior". */
function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .trim();
}

async function getPushToken(uid: string): Promise<string | null> {
  const snap = await db.collection('pushTokens').doc(uid).get();
  if (!snap.exists) return null;
  const token = snap.data()?.token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/** Send one Expo push to a single user. Best-effort; never throws. */
async function notifyUser(
  uid: string | undefined | null,
  title: string,
  body: string,
  data: PushData = {}
): Promise<void> {
  if (!uid) return;
  try {
    const token = await getPushToken(uid);
    if (!token) return;

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
    });

    if (!res.ok) {
      logger.warn(`Expo push HTTP ${res.status} for ${uid}`);
    }
  } catch (err) {
    logger.warn(`Push to ${uid} failed`, err as Error);
  }
}

// 1. New booking → notify the detailer that a request came in.
export const onBookingCreated = onDocumentCreated('bookings/{bookingId}', async (event) => {
  const b = event.data?.data();
  if (!b || String(b.status) !== 'pending') return;

  const who = b.clientName ? String(b.clientName) : 'A client';
  const service = titleCase(String(b.service ?? 'a detail')) || 'a detail';
  await notifyUser(
    b.detailerId as string | undefined,
    'New Booking Request!',
    `${who} wants to book ${service}.`,
    { type: 'booking_request', bookingId: event.params.bookingId }
  );
});

// 2. Booking status change → notify whichever party is now waiting on the other.
export const onBookingStatusChanged = onDocumentUpdated('bookings/{bookingId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;

  const bookingId = event.params.bookingId;
  const clientId = after.clientId as string | undefined;
  const detailerId = after.detailerId as string | undefined;

  switch (String(after.status)) {
    case 'active':
      await notifyUser(clientId, 'Booking Accepted!', 'Your detailer accepted your booking.', {
        bookingId,
      });
      break;
    case 'declined':
      await notifyUser(
        clientId,
        'Booking Declined',
        "Your detailer couldn't take this booking. Browse others nearby.",
        { bookingId }
      );
      break;
    case 'vir_submitted':
      await notifyUser(
        clientId,
        'Inspection Ready to Sign',
        'Your detailer completed the pre-inspection. Review and sign to start the job.',
        { type: 'vir', bookingId }
      );
      break;
    case 'vir_signed':
      await notifyUser(
        detailerId,
        'Inspection Signed',
        'The client signed off — you can now start the job timer.',
        { bookingId }
      );
      break;
    case 'completed':
      await notifyUser(
        clientId,
        'Your Detail is Complete!',
        'Your detailer has finished. Check your invoice and leave a review.',
        { type: 'job_complete', bookingId }
      );
      break;
    case 'cancelled':
      await notifyUser(
        detailerId,
        'Booking Cancelled',
        `${after.clientName ? String(after.clientName) : 'A client'} cancelled their booking.`,
        { bookingId }
      );
      break;
    default:
      break;
  }
});

// 3. New chat message → notify the other party in the conversation.
export const onMessageCreated = onDocumentCreated(
  'conversations/{conversationId}/messages/{messageId}',
  async (event) => {
    const m = event.data?.data();
    if (!m) return;

    const conversationId = event.params.conversationId;
    const senderId = m.senderId as string | undefined;

    const convoSnap = await db.collection('conversations').doc(conversationId).get();
    const convo = convoSnap.data();
    if (!convo) return;

    const clientId = convo.clientId as string | undefined;
    const detailerId = convo.detailerId as string | undefined;
    // The recipient is whichever party did not send this message.
    const recipientId = senderId === clientId ? detailerId : clientId;
    if (!recipientId) return;

    // Derive the display name from the conversation's participant fields (which
    // security rules bind to the booking) rather than trusting a per-message
    // `senderName` a sender could set to anything — that value drives the push
    // title and is a phishing surface.
    const senderName =
      senderId === clientId ? String(convo.clientName ?? '') : String(convo.detailerName ?? '');
    const title = senderName || 'New message';
    const body = String(m.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || 'Sent you a message.';
    await notifyUser(recipientId, title, body, { type: 'message', conversationId });
  }
);

// 4. Dispute opened → notify the detailer that payment is paused.
export const onDisputeCreated = onDocumentCreated('disputes/{disputeId}', async (event) => {
  const d = event.data?.data();
  if (!d) return;

  const invoiceId = String(d.invoiceId ?? d.bookingId ?? event.params.disputeId);
  await notifyUser(
    d.detailerId as string | undefined,
    'Dispute Raised',
    'A client raised a dispute on a recent job. Payment is paused pending review.',
    { type: 'dispute', invoiceId }
  );
});

// 5. Dispute response / resolution → notify both parties of the actual outcome.
//
// resolveDispute (functions/src/stripe.ts) writes one of three `resolution`
// values, each of which moves money differently — a single "resolved, payment
// released" message was wrong for two of the three, and previously only the
// client was ever told the outcome at all; the detailer had no way to learn a
// dispute against them had been decided.
const DISPUTE_OUTCOME_COPY: Record<string, { client: string; detailer: string }> = {
  release_detailer: {
    client: 'Your dispute was reviewed and the payment has been released to your detailer.',
    detailer: 'Good news — a dispute on your job was resolved in your favor and payment has been released to you.',
  },
  refund_client: {
    client: 'Your dispute was resolved and you have been refunded in full.',
    detailer:
      "A dispute on your job was resolved in the client's favor. The charge was refunded and no payout will be made.",
  },
  partial_refund: {
    client: 'Your dispute was resolved with a partial refund to your card.',
    detailer:
      'A dispute on your job was resolved with a partial refund to the client. You will receive your share of the remaining amount.',
  },
};

export const onDisputeUpdated = onDocumentUpdated('disputes/{disputeId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const clientId = after.clientId as string | undefined;
  const detailerId = after.detailerId as string | undefined;
  const invoiceId = String(after.invoiceId ?? after.bookingId ?? event.params.disputeId);

  if (before.status !== 'resolved' && after.status === 'resolved') {
    const copy = DISPUTE_OUTCOME_COPY[String(after.resolution ?? '')];
    await Promise.all([
      notifyUser(clientId, 'Dispute Resolved', copy?.client ?? 'Your dispute has been resolved.', {
        type: 'dispute',
        invoiceId,
      }),
      notifyUser(detailerId, 'Dispute Resolved', copy?.detailer ?? 'A dispute on your job has been resolved.', {
        type: 'dispute',
        invoiceId,
      }),
    ]);
    return;
  }

  // A detailer response was just added (the field went from empty to set).
  if (!before.detailerResponse && after.detailerResponse) {
    await notifyUser(clientId, 'Detailer Responded', 'The detailer responded to your dispute.', {
      type: 'dispute',
      invoiceId,
    });
  }
});

// 6. Revv Care claim decision → notify the filing client of the outcome. There
// was previously no trigger here at all: a client who filed a claim had no way
// to learn it was approved/denied short of emailing support.
export const onCareClaimUpdated = onDocumentUpdated('careClaims/{claimId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status !== 'open' || after.status === 'open') return;

  const clientId = after.clientId as string | undefined;
  const bookingId = String(after.bookingId ?? event.params.claimId);

  if (after.status === 'approved') {
    const amount = (Number(after.approvedCents ?? 0) / 100).toFixed(2);
    await notifyUser(
      clientId,
      'Revv Care Claim Approved',
      `Your damage claim was approved for $${amount}. Our team will follow up on payout details.`,
      { type: 'care_claim', bookingId }
    );
  } else if (after.status === 'denied') {
    await notifyUser(
      clientId,
      'Revv Care Claim Update',
      'Your damage claim was reviewed and was not approved. Open the claim for details.',
      { type: 'care_claim', bookingId }
    );
  }
});

// 7. Subscription state changes → notify the detailer when their marketplace
// visibility is at risk or has changed. The Stripe webhook is the only writer
// of subscriptionStatus (syncSubscriptionState in stripe.ts), so this is the
// one place these transitions can be observed; previously they were silent —
// a detailer could lose visibility to clients with no idea why.
export const onSubscriptionStatusChanged = onDocumentUpdated('users/{uid}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const prev = String(before.subscriptionStatus ?? '');
  const next = String(after.subscriptionStatus ?? '');
  if (prev === next) return;

  const uid = event.params.uid;
  if (next === 'past_due') {
    await notifyUser(
      uid,
      'Payment Failed',
      'We could not charge your card for Revv Pro. Update your payment method or you will lose marketplace visibility.',
      { type: 'subscription' }
    );
  } else if (next === 'canceled') {
    await notifyUser(
      uid,
      'Subscription Canceled',
      'Your Revv Pro subscription has ended and your profile is no longer visible to clients.',
      { type: 'subscription' }
    );
  } else if (next === 'active' && (prev === 'past_due' || prev === 'canceled')) {
    await notifyUser(uid, 'Subscription Active', 'Your payment succeeded — you are visible to clients again.', {
      type: 'subscription',
    });
  }
});

// 8. New review → notify the detailer.
export const onReviewCreated = onDocumentCreated('reviews/{reviewId}', async (event) => {
  const r = event.data?.data();
  if (!r) return;

  const rating = Number(r.rating ?? 0);
  const stars = rating > 0 ? `${rating}-star ` : '';
  await notifyUser(
    r.detailerId as string | undefined,
    'New Review!',
    `You received a ${stars}review. Open your profile to read it.`,
    { type: 'review' }
  );
});
