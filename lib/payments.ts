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

// ── Admin-only callables ──────────────────────────────────────────────────────
// Every one of these is gated server-side on the `admin` custom claim; the app
// only hides the UI. Nothing here is trusted from the client.

export type DisputeResolution = 'release_detailer' | 'refund_client' | 'partial_refund';

/**
 * Resolve a dispute and move the money: release the hold to the detailer, refund
 * the client in full, or capture and split (partial). `clientRefundCents` is
 * required for — and only read on — `partial_refund`.
 */
export async function resolveDispute(input: {
  disputeId: string;
  resolution: DisputeResolution;
  clientRefundCents?: number;
  note?: string;
}): Promise<void> {
  const call = httpsCallable<typeof input, { ok: boolean }>(functions, 'resolveDispute');
  await call(input);
}

/** Approve (with an amount, capped at $2,500) or deny a Revv Care claim. */
export async function resolveCareClaim(input: {
  claimId: string;
  decision: 'approved' | 'denied';
  approvedCents?: number;
  note?: string;
}): Promise<void> {
  const call = httpsCallable<typeof input, { ok: boolean }>(functions, 'resolveCareClaim');
  await call(input);
}

/** Interim manual identity verification, standing in for Checkr. */
export async function setDetailerVerified(detailerId: string, verified: boolean): Promise<void> {
  const call = httpsCallable<{ detailerId: string; verified: boolean }, { ok: boolean }>(
    functions,
    'setDetailerVerified'
  );
  await call({ detailerId, verified });
}

/** Grant one of the 25 Founding Pro slots (60-day trial + permanent badge). */
export async function grantFoundingPro(detailerId: string): Promise<void> {
  const call = httpsCallable<{ detailerId: string }, { ok: boolean }>(functions, 'grantFoundingPro');
  await call({ detailerId });
}

/** Mark a trust & safety report reviewed or dismissed. */
export async function resolveReport(input: {
  reportId: string;
  decision: 'reviewed' | 'dismissed';
  note?: string;
}): Promise<void> {
  const call = httpsCallable<typeof input, { ok: boolean }>(functions, 'resolveReport');
  await call(input);
}

/**
 * Admin: return the binding quote on a fleet order. The estimate the dealership
 * saw is indicative; this is the figure they actually agree to, which is why it
 * can only be written here.
 */
export async function quoteFleetOrder(input: {
  orderId: string;
  quotedCents: number;
  note?: string;
}): Promise<{ ok: true }> {
  const call = httpsCallable<typeof input, { ok: true }>(functions, 'quoteFleetOrder');
  return (await call(input)).data;
}

/** Admin: grant or revoke fleet-ordering access for an account. */
export async function setDealershipStatus(input: {
  userId: string;
  isDealership: boolean;
  businessName?: string;
}): Promise<{ ok: true }> {
  const call = httpsCallable<typeof input, { ok: true }>(functions, 'setDealershipStatus');
  return (await call(input)).data;
}
