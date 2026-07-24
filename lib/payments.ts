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

type FinalizeBookingInput = {
  paymentIntentId: string;
  date: string;
  time: string;
  vehicleId: string;
  vehicleLabel: string;
  address: string;
  notes?: string;
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

/** Finalize exactly one booking for a confirmed PaymentIntent hold. */
export async function finalizeBooking(input: FinalizeBookingInput): Promise<{ bookingId: string }> {
  const call = httpsCallable<FinalizeBookingInput, { bookingId: string }>(functions, 'finalizeBooking');
  return (await call(input)).data;
}

export async function transitionBooking(
  bookingId: string,
  action: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const call = httpsCallable<Record<string, unknown>, { ok: boolean }>(functions, 'transitionBooking');
  await call({ bookingId, action, ...data });
}

export async function attachAfterPhotos(bookingId: string, afterPhotos: string[]): Promise<void> {
  const call = httpsCallable<{ bookingId: string; afterPhotos: string[] }, { ok: boolean }>(
    functions,
    'attachAfterPhotos'
  );
  await call({ bookingId, afterPhotos });
}

export async function createDispute(input: {
  bookingId: string;
  category: string;
  description: string;
  photoUrls: string[];
}): Promise<{ disputeId: string }> {
  const call = httpsCallable<typeof input, { disputeId: string }>(functions, 'createDispute');
  return (await call(input)).data;
}

export async function respondToDispute(disputeId: string, response: string): Promise<void> {
  const call = httpsCallable<{ disputeId: string; response: string }, { ok: boolean }>(
    functions,
    'respondToDispute'
  );
  await call({ disputeId, response });
}

export async function updateInvoiceReach(
  invoiceId: string,
  input: { reachShared: boolean; reelUrl?: string }
): Promise<void> {
  const call = httpsCallable<Record<string, unknown>, { ok: boolean }>(functions, 'updateInvoiceReach');
  await call({ invoiceId, ...input });
}

export async function deleteMyAccount(): Promise<void> {
  const call = httpsCallable<void, { ok: boolean }>(functions, 'deleteMyAccount');
  await call();
}

type SubscriptionSetup = {
  subscriptionId: string;
  customerId: string;
  ephemeralKeySecret: string;
  setupIntentClientSecret: string | null;
  trialDays: number;
};

/**
 * Start the detailer's $34.99/mo subscription (with a 14- or 60-day trial). The
 * returned SetupIntent lets PaymentSheet collect the card that auto-charges at
 * trial end; subscription status/marketplace visibility is set server-side by the
 * Stripe webhook, never by the app.
 */
export async function createSubscription(): Promise<SubscriptionSetup> {
  const call = httpsCallable<void, SubscriptionSetup>(functions, 'createSubscription');
  return (await call()).data;
}

/** File a Revv Care damage-protection claim (allowed within 72h of completion). */
export async function createCareClaim(input: {
  bookingId: string;
  description: string;
  photoUrls: string[];
  amountRequestedCents: number;
}): Promise<{ claimId: string }> {
  const call = httpsCallable<typeof input, { claimId: string }>(functions, 'createCareClaim');
  return (await call(input)).data;
}
