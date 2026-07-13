import { getFunctions, httpsCallable } from 'firebase/functions';

import app from '@/firebaseConfig';

// All callables live in the same region as the Firestore-trigger functions
// (us-west2, pinned to the database location) — the default instance would
// look in us-central1 and 404.
const functions = getFunctions(app, 'us-west2');

type ConnectLink = { url: string };
type ConnectStatus = { payoutsEnabled: boolean; detailsSubmitted: boolean };
type BookingPaymentSheet = {
  paymentIntentId: string;
  paymentIntentClientSecret: string;
  ephemeralKeySecret: string;
  customerId: string;
  amountCents: number;
};

/** Mint a fresh Stripe Express onboarding link for the signed-in detailer. */
export async function createConnectAccount(): Promise<ConnectLink> {
  const call = httpsCallable<void, ConnectLink>(functions, 'createConnectAccount');
  return (await call()).data;
}

/** Re-sync payout status from Stripe onto the detailer doc. */
export async function getConnectStatus(): Promise<ConnectStatus> {
  const call = httpsCallable<void, ConnectStatus>(functions, 'getConnectStatus');
  return (await call()).data;
}

/**
 * Create the manual-capture PaymentIntent (card hold) for a booking. The
 * server derives the amount from the detailer's rate card; the returned
 * amountCents is what the client's card is actually authorized for.
 */
export async function createBookingPaymentIntent(
  detailerId: string,
  service: string
): Promise<BookingPaymentSheet> {
  const call = httpsCallable<{ detailerId: string; service: string }, BookingPaymentSheet>(
    functions,
    'createBookingPaymentIntent'
  );
  return (await call({ detailerId, service })).data;
}
