import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';

import { db } from './admin';
import {
  MAX_BOOKING_DAYS_AHEAD,
  MIN_BOOKING_DAYS_AHEAD,
  bookingDaysAhead,
} from './bookingRules';
import { careReserveCents, parseRateToCents, splitPartialRefund, splitPayout } from './money';
import { enforceRateLimit } from './rateLimit';
import { requireAdmin } from './workflows';

/**
 * Stripe payment layer — Phase 1 (Connect onboarding) and Phase 2 (card hold
 * at booking) of docs/STRIPE_PLAN.md.
 *
 * The secret key exists only here, injected via Secret Manager. The app holds
 * the publishable key and calls these functions; it never talks to Stripe
 * directly for anything sensitive, and it never supplies an amount — prices
 * are read from the detailer's own rate card server-side.
 */

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// The recurring price for the $34.99/mo detailer plan. A price id is not secret;
// set it as a param (env / functions config), e.g. STRIPE_SUBSCRIPTION_PRICE_ID=price_...
const STRIPE_SUBSCRIPTION_PRICE_ID = defineString('STRIPE_SUBSCRIPTION_PRICE_ID');

// Callables must be pinned to the same region as the Firestore-trigger
// functions (which follow the database's location) so the client can build a
// single region-scoped functions instance.
const REGION = 'us-west2';

// Ephemeral keys are minted for the mobile PaymentSheet against a pinned API
// version; this matches the bundled stripe-node SDK's version.
const EPHEMERAL_KEY_API_VERSION = '2026-06-24.dahlia';

// Express onboarding requires https redirect URLs, not app deep links. The
// hosted site is a landing target only — the app re-checks status when it
// regains focus, so nothing on that page has to do anything.
const CONNECT_RETURN_URL = 'https://revvapp.github.io/revvapp/?stripe=return';
const CONNECT_REFRESH_URL = 'https://revvapp.github.io/revvapp/?stripe=refresh';

function stripeClient(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value());
}

async function recipientTransfersActive(stripe: Stripe, accountId: string): Promise<boolean> {
  try {
    const account = await stripe.v2.core.accounts.retrieve(accountId, {
      include: ['configuration.recipient'],
    });
    return account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status === 'active';
  } catch {
    // Accounts created before the v2 migration remain usable during test-mode
    // transition. New accounts never enter this legacy path.
    const legacy = await stripe.accounts.retrieve(accountId);
    return !legacy.deleted && legacy.capabilities?.transfers === 'active';
  }
}

/**
 * Accrues the Revv Care reserve for a released booking. Writes an idempotent
 * per-booking ledger entry and increments the fund total — an accounting record
 * of platform-retained funds, never a money movement. Best-effort: a failure
 * must not fail the payment release.
 */
async function accrueRevvCare(bookingId: string, priceCents: number): Promise<void> {
  const reserveCents = careReserveCents(priceCents);
  if (reserveCents <= 0) return;
  try {
    // create() throws if it already exists — accrual is idempotent per booking.
    await db.collection('revvCareLedger').doc(bookingId).create({
      bookingId, reserveCents, accruedAt: FieldValue.serverTimestamp(),
    });
    await db.collection('revvCareFund').doc('summary').set(
      { totalCents: FieldValue.increment(reserveCents), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch {
    // Already accrued for this booking — no-op.
  }
}

/**
 * Captures a manual-capture hold (if still uncaptured) and creates the idempotent
 * 90% Transfer to the detailer. Shared by the auto-release scheduler and admin
 * dispute resolution so both move money through exactly one code path.
 *
 * Returns the captured amount alongside the transfer id (null when the intent
 * uses the non-separate funds flow); callers need the amount to accrue the Revv
 * Care reserve against what Stripe actually charged rather than against the
 * booking document's copy of the price.
 */
async function captureAndTransfer(
  stripe: Stripe,
  bookingId: string,
  paymentIntentId: string
): Promise<{ transferId: string | null; amountCents: number }> {
  let intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
  if (intent.status === 'requires_capture') {
    intent = await stripe.paymentIntents.capture(paymentIntentId, { expand: ['latest_charge'] });
  }
  if (intent.status !== 'succeeded') throw new Error(`Unexpected PaymentIntent status: ${intent.status}`);
  if (intent.metadata?.fundsFlow !== 'separate') {
    return { transferId: null, amountCents: intent.amount };
  }

  const charge = intent.latest_charge;
  const chargeId = typeof charge === 'string' ? charge : charge?.id;
  const detailerAccountId = String(
    (await db.collection('detailers').doc(String(intent.metadata.detailerId)).get()).data()?.stripeAccountId ?? ''
  );
  if (!chargeId || !detailerAccountId) throw new Error('Captured payment is missing transfer details.');

  const transfer = await stripe.transfers.create({
    amount: splitPayout(intent.amount).detailerCents,
    currency: intent.currency,
    destination: detailerAccountId,
    source_transaction: chargeId,
    transfer_group: intent.transfer_group ?? undefined,
    metadata: { bookingId, paymentIntentId },
  }, { idempotencyKey: `release_${bookingId}` });
  return { transferId: transfer.id, amountCents: intent.amount };
}

/**
 * Resolves the subscription state for the detailer who owns `customerId`: mirrors
 * the Stripe status onto users.subscriptionStatus and gates marketplace visibility
 * via detailers.isActive (active/trialing → visible). Called from the webhook only,
 * so the state is always Stripe-authoritative.
 */
async function syncSubscriptionState(customerId: string, status: string): Promise<void> {
  const match = await db.collection('detailers').where('stripeCustomerId', '==', customerId).limit(1).get();
  if (match.empty) return;
  const uid = match.docs[0].id;
  const entitled = status === 'active' || status === 'trialing';
  await Promise.all([
    db.collection('users').doc(uid).set({ subscriptionStatus: status }, { merge: true }),
    match.docs[0].ref.set({ isActive: entitled }, { merge: true }),
  ]);
}

/**
 * Creates (or reuses) the detailer's connected account and returns a fresh
 * onboarding link. Links are single-use and expire, so one is minted per call.
 */
export const createConnectAccount = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const userRole = (await db.collection('users').doc(uid).get()).data()?.userType;
    if (userRole !== 'detailer') throw new HttpsError('permission-denied', 'Detailer access required.');
    await enforceRateLimit(uid, 'connect', 5, 60 * 60 * 1_000);

    const ref = db.collection('detailers').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'Detailer profile not found.');
    }

    const stripe = stripeClient();
    let accountId = snap.data()?.stripeAccountId as string | undefined;
    let accountVersion = snap.data()?.stripeAccountVersion as string | undefined;

    if (!accountId) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: (request.auth?.token.email as string | undefined) ?? undefined,
        dashboard: 'express',
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: { stripe_transfers: { requested: true } },
            },
          },
        },
        defaults: {
          responsibilities: {
            fees_collector: 'application',
            losses_collector: 'application',
          },
        },
        metadata: { uid },
      });
      accountId = account.id;
      accountVersion = 'v2';
      await ref.update({ stripeAccountId: accountId, stripeAccountVersion: 'v2', payoutsEnabled: false });
    }

    const link = accountVersion === 'v2'
      ? await stripe.v2.core.accountLinks.create({
        account: accountId,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            configurations: ['recipient'],
            collection_options: { fields: 'eventually_due', future_requirements: 'include' },
            return_url: CONNECT_RETURN_URL,
            refresh_url: CONNECT_REFRESH_URL,
          },
        },
      })
      : await stripe.accountLinks.create({
        account: accountId,
        type: 'account_onboarding',
        return_url: CONNECT_RETURN_URL,
        refresh_url: CONNECT_REFRESH_URL,
      });

    return { url: link.url };
  }
);

/**
 * Re-reads the connected account and syncs `payoutsEnabled` onto the detailer
 * doc. Called by the app when it returns from the onboarding browser; the
 * legacy `account.updated` webhook keeps v1 accounts in sync; every payment
 * also rechecks the capability directly with Stripe.
 */
export const getConnectStatus = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const userRole = (await db.collection('users').doc(uid).get()).data()?.userType;
    if (userRole !== 'detailer') throw new HttpsError('permission-denied', 'Detailer access required.');

    const ref = db.collection('detailers').doc(uid);
    const accountId = (await ref.get()).data()?.stripeAccountId as string | undefined;
    if (!accountId) return { payoutsEnabled: false, detailsSubmitted: false };

    const payoutsEnabled = await recipientTransfersActive(stripeClient(), accountId);
    await ref.update({ payoutsEnabled });

    return { payoutsEnabled, detailsSubmitted: payoutsEnabled };
  }
);

/**
 * Creates the escrow hold for a booking: a manual-capture PaymentIntent that
 * authorizes the client's card now and is captured only when the job
 * completes. Returns everything PaymentSheet needs.
 *
 * The amount is derived from the detailer's rate card, never from the client
 * (a tampered request could otherwise book a $250 detail for $1). The booking
 * doc is created by the app only after the sheet confirms, so an abandoned
 * payment leaves no phantom booking behind.
 */
export const createBookingPaymentIntent = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const userRole = (await db.collection('users').doc(uid).get()).data()?.userType;
    if (userRole !== 'client') throw new HttpsError('permission-denied', 'Client access required.');
    await enforceRateLimit(uid, 'payment_intent', 10, 60 * 60 * 1_000);

    const detailerId = String(request.data?.detailerId ?? '');
    const service = String(request.data?.service ?? '');
    if (!detailerId || !service) {
      throw new HttpsError('invalid-argument', 'detailerId and service are required.');
    }

    const detailer = (await db.collection('detailers').doc(detailerId).get()).data();
    if (!detailer) throw new HttpsError('not-found', 'Detailer not found.');
    const accountId = detailer.stripeAccountId as string | undefined;
    if (!accountId || detailer.payoutsEnabled !== true) {
      throw new HttpsError('failed-precondition', 'This detailer cannot accept payments yet.');
    }

    const rate = (detailer.rates as Record<string, string> | undefined)?.[service];
    if (!rate) throw new HttpsError('invalid-argument', 'Unknown service for this detailer.');
    const amountCents = parseRateToCents(rate);
    if (amountCents === null) {
      throw new HttpsError('failed-precondition', 'This service has an invalid price.');
    }

    const stripe = stripeClient();
    if (!(await recipientTransfersActive(stripe, accountId))) {
      await db.collection('detailers').doc(detailerId).update({ payoutsEnabled: false });
      throw new HttpsError('failed-precondition', 'This detailer must finish Stripe onboarding.');
    }

    const clientRef = db.collection('clients').doc(uid);
    const clientDoc = (await clientRef.get()).data() ?? {};
    let customerId = clientDoc.stripeCustomerId as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (request.auth?.token.email as string | undefined) ?? undefined,
        name: (clientDoc.fullName as string | undefined) ?? undefined,
        metadata: { uid },
      });
      customerId = customer.id;
      await clientRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: EPHEMERAL_KEY_API_VERSION }
    );

    const transferGroup = `booking_${randomUUID()}`;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: customerId,
      capture_method: 'manual',
      transfer_group: transferGroup,
      metadata: { clientId: uid, detailerId, service, fundsFlow: 'separate', transferGroup },
    });

    return {
      paymentIntentId: paymentIntent.id,
      paymentIntentClientSecret: paymentIntent.client_secret,
      ephemeralKeySecret: ephemeralKey.secret,
      customerId,
      amountCents,
    };
  }
);

/**
 * Creates the booking only after PaymentSheet has confirmed the server-priced
 * hold. The PaymentIntent id is also the booking id, making replay impossible:
 * Firestore create() succeeds exactly once for a given hold.
 */
export const finalizeBooking = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const userRole = (await db.collection('users').doc(uid).get()).data()?.userType;
    if (userRole !== 'client') throw new HttpsError('permission-denied', 'Client access required.');

    const paymentIntentId = String(request.data?.paymentIntentId ?? '');
    const date = String(request.data?.date ?? '').trim();
    const time = String(request.data?.time ?? '').trim();
    const vehicleId = String(request.data?.vehicleId ?? '').trim();
    const vehicleLabel = String(request.data?.vehicleLabel ?? '').trim();
    const address = String(request.data?.address ?? '').trim();
    const notes = String(request.data?.notes ?? '').trim();
    if (!paymentIntentId || !date || !time || !vehicleId || !address) {
      throw new HttpsError('invalid-argument', 'Required booking details are missing.');
    }
    if (date.length > 20 || time.length > 20 || vehicleLabel.length > 200 || address.length > 500 || notes.length > 1_000) {
      throw new HttpsError('invalid-argument', 'A booking field is too long.');
    }
    const daysAhead = bookingDaysAhead(date, Date.now());
    if (daysAhead === null) throw new HttpsError('invalid-argument', 'Booking date is invalid.');
    if (daysAhead < MIN_BOOKING_DAYS_AHEAD || daysAhead > MAX_BOOKING_DAYS_AHEAD) {
      throw new HttpsError('failed-precondition', 'Bookings must be scheduled 1–4 days ahead.');
    }

    const pi = await stripeClient().paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'requires_capture' || pi.metadata?.clientId !== uid) {
      throw new HttpsError('failed-precondition', 'A valid card hold is required.');
    }
    const detailerId = String(pi.metadata.detailerId ?? '');
    const service = String(pi.metadata.service ?? '');
    if (!detailerId || !service) throw new HttpsError('failed-precondition', 'Hold metadata is invalid.');

    const [detailerSnap, clientSnap, vehicleSnap] = await Promise.all([
      db.collection('detailers').doc(detailerId).get(),
      db.collection('clients').doc(uid).get(),
      db.collection('clients').doc(uid).collection('vehicles').doc(vehicleId).get(),
    ]);
    if (!detailerSnap.exists || detailerSnap.data()?.payoutsEnabled !== true) {
      throw new HttpsError('failed-precondition', 'Detailer is not eligible for bookings.');
    }
    if (!vehicleSnap.exists || vehicleSnap.data()?.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'Vehicle does not belong to this client.');
    }
    const detailer = detailerSnap.data()!;
    const client = clientSnap.data() ?? {};
    const ref = db.collection('bookings').doc(paymentIntentId);
    try {
      await ref.create({
        clientId: uid,
        detailerId,
        detailerName: String(detailer.businessName ?? detailer.fullName ?? ''),
        businessName: detailer.businessName ?? null,
        service,
        price: pi.amount / 100,
        status: 'pending',
        date,
        time,
        vehicleId,
        vehicleLabel,
        address,
        notes: notes || null,
        clientName: String(client.fullName ?? request.auth?.token.email ?? ''),
        paymentIntentId,
        paymentStatus: 'requires_capture',
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      if ((err as { code?: number | string }).code === 6 || (err as { code?: string }).code === 'already-exists') {
        throw new HttpsError('already-exists', 'This payment hold already has a booking.');
      }
      throw err;
    }
    return { bookingId: ref.id };
  }
);

/**
 * Releases the card hold when a booking dies before the job runs (client
 * cancels, or the detailer declines). Without this, the authorization would
 * sit on the client's card until it expired on its own.
 */
export const cancelHoldOnBookingEnd = onDocumentUpdated(
  { document: 'bookings/{bookingId}', region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;
    if (!['cancelled', 'declined'].includes(String(after.status))) return;

    const paymentIntentId = after.paymentIntentId as string | undefined;
    if (!paymentIntentId || after.paymentStatus !== 'requires_capture') return;

    try {
      await stripeClient().paymentIntents.cancel(paymentIntentId);
      await event.data!.after.ref.update({ paymentStatus: 'canceled' });
      logger.info(`Canceled hold ${paymentIntentId} for booking ${event.params.bookingId}`);
    } catch (err) {
      // Already captured or already canceled — the webhook reconciles state.
      logger.warn(`Could not cancel ${paymentIntentId}`, err as Error);
    }
  }
);

/**
 * Signature-verified webhook. Each handler reconciles exactly one Firestore
 * doc; the event-id ledger makes redelivery a no-op.
 */
export const stripeWebhook = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    let event: Stripe.Event;
    try {
      event = stripeClient().webhooks.constructEvent(
        req.rawBody,
        req.headers['stripe-signature'] as string,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      logger.warn('Webhook signature verification failed', err as Error);
      res.status(400).send('Invalid signature');
      return;
    }

    // Idempotency lock: create() throws if this event id was already claimed.
    // The doc is written as a lock BEFORE handling and only marked 'processed'
    // once the handler succeeds — if the handler throws we release the lock so
    // Stripe's automatic retry reprocesses the event instead of it being
    // permanently swallowed as a duplicate.
    const ledgerRef = db.collection('stripeEvents').doc(event.id);
    try {
      await ledgerRef.create({
        type: event.type,
        receivedAt: FieldValue.serverTimestamp(),
        status: 'processing',
      });
    } catch {
      res.json({ received: true, duplicate: true });
      return;
    }

    try {
      switch (event.type) {
        case 'account.updated': {
          const account = event.data.object;
          const match = await db
            .collection('detailers')
            .where('stripeAccountId', '==', account.id)
            .limit(1)
            .get();
          if (!match.empty) {
            const ready = await recipientTransfersActive(stripeClient(), account.id).catch(() => false);
            await match.docs[0].ref.update({ payoutsEnabled: ready });
          }
          break;
        }
        case 'payment_intent.amount_capturable_updated':
        case 'payment_intent.canceled': {
          const intent = event.data.object;
          const status = event.type === 'payment_intent.canceled' ? 'canceled' : 'requires_capture';
          const match = await db
            .collection('bookings')
            .where('paymentIntentId', '==', intent.id)
            .limit(1)
            .get();
          if (!match.empty) {
            await match.docs[0].ref.update({ paymentStatus: status });
          }
          break;
        }
        case 'charge.dispute.created': {
          // A cardholder filed a chargeback with their bank (distinct from an
          // in-app Revv dispute). Flag the booking so the trust & safety team can
          // respond in the Stripe Dashboard; funds handling stays a manual process.
          const dispute = event.data.object;
          const piId = typeof dispute.payment_intent === 'string'
            ? dispute.payment_intent
            : dispute.payment_intent?.id;
          if (piId) {
            const match = await db
              .collection('bookings')
              .where('paymentIntentId', '==', piId)
              .limit(1)
              .get();
            if (!match.empty) {
              await match.docs[0].ref.update({
                chargebackStatus: dispute.status,
                chargebackReason: dispute.reason,
                chargebackAt: FieldValue.serverTimestamp(),
              });
              logger.warn(`Chargeback opened on booking ${match.docs[0].id} (${dispute.reason})`);
            }
          }
          break;
        }
        case 'charge.refunded': {
          const charge = event.data.object;
          const piId = typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
          if (piId) {
            const match = await db
              .collection('bookings')
              .where('paymentIntentId', '==', piId)
              .limit(1)
              .get();
            if (!match.empty) {
              const fullyRefunded = charge.amount_refunded >= charge.amount;
              await match.docs[0].ref.update({
                refundedAmount: charge.amount_refunded,
                refundedAt: FieldValue.serverTimestamp(),
                ...(fullyRefunded ? { paymentStatus: 'refunded' } : {}),
              });
              logger.warn(`Refund recorded on booking ${match.docs[0].id}: ${charge.amount_refunded}`);
            }
          }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
          await syncSubscriptionState(String(sub.customer), status);
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          if (invoice.customer) await syncSubscriptionState(String(invoice.customer), 'past_due');
          break;
        }
        default:
          break;
      }

      await ledgerRef.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() });
      res.json({ received: true });
    } catch (err) {
      logger.error(`Webhook handler failed for ${event.type} (${event.id})`, err as Error);
      await ledgerRef.delete().catch(() => {});
      res.status(500).send('Handler error');
    }
  }
);

/**
 * Phase 3/4 of docs/STRIPE_PLAN.md — auto-release after the 24h dispute window.
 * The booking hold is a platform charge. At window-close we capture it and then
 * create an idempotent separate Transfer for 90% to the connected recipient.
 *
 * Eligible booking: status `completed`, hold still `requires_capture`, completed
 * more than 24h ago, and its invoice (same id as the booking) is not `disputed`.
 * Capture + Transfer → paymentStatus `captured` and invoice `released`. Booking
 * dates are limited to four days ahead to stay inside the card authorization
 * window with margin for the 24-hour dispute period.
 *
 * Follow-up (intentionally NOT here): Revv Care 1% accrual, partial capture for
 * partial-refund dispute outcomes, and removing the legacy client-side
 * `released` flip in app/client/invoice/[id].tsx once this is live.
 */
const DISPUTE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const releaseHoldsAfterDisputeWindow = onSchedule(
  { schedule: 'every 30 minutes', region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async () => {
    const snap = await db
      .collection('bookings')
      .where('status', '==', 'completed')
      .where('paymentStatus', '==', 'requires_capture')
      .limit(100)
      .get();
    if (snap.empty) return;

    const stripe = stripeClient();
    for (const bookingDoc of snap.docs) {
      const b = bookingDoc.data();
      const releaseEligibleAt = b.releaseEligibleAt as Timestamp | undefined;
      // Legacy documents may use completedAt, but all new writes use the
      // server-owned releaseEligibleAt timestamp.
      const completedAt = b.completedAt as Timestamp | undefined;
      const eligibleMs = releaseEligibleAt?.toMillis()
        ?? (completedAt ? completedAt.toMillis() + DISPUTE_WINDOW_MS : Number.POSITIVE_INFINITY);
      if (eligibleMs > Date.now()) continue;
      const paymentIntentId = b.paymentIntentId as string | undefined;
      if (!paymentIntentId) continue;

      // The invoice shares the booking id; never release one under dispute.
      const invoiceRef = db.collection('invoices').doc(bookingDoc.id);
      const disputeRef = db.collection('disputes').doc(bookingDoc.id);

      // Atomically claim the capture. createDispute reads the same booking doc,
      // so a dispute and capture cannot cross in flight unnoticed.
      const claimed = await db.runTransaction(async (tx) => {
        const [freshBooking, invoiceSnap, disputeSnap] = await Promise.all([
          tx.get(bookingDoc.ref), tx.get(invoiceRef), tx.get(disputeRef),
        ]);
        const fresh = freshBooking.data();
        if (!fresh || fresh.paymentStatus !== 'requires_capture' || fresh.captureState === 'processing') return false;
        if (invoiceSnap.data()?.status === 'disputed' || disputeSnap.data()?.status === 'open') return false;
        const eligible = fresh.releaseEligibleAt as Timestamp | undefined;
        if (!eligible || eligible.toMillis() > Date.now()) return false;
        tx.update(bookingDoc.ref, { captureState: 'processing', captureStartedAt: FieldValue.serverTimestamp() });
        return true;
      });
      if (!claimed) continue;

      try {
        const { transferId, amountCents } = await captureAndTransfer(
          stripe, bookingDoc.id, paymentIntentId
        );
        await bookingDoc.ref.update({
          paymentStatus: 'captured', captureState: 'complete', capturedAt: FieldValue.serverTimestamp(),
          ...(transferId ? { transferId } : {}),
        });
        if ((await invoiceRef.get()).exists) {
          await invoiceRef.update({
            status: 'released',
            releasedAt: FieldValue.serverTimestamp(),
          });
        }
        await accrueRevvCare(bookingDoc.id, amountCents);
        logger.info(`Released hold ${paymentIntentId} for booking ${bookingDoc.id}`);
      } catch (err) {
        // Leave paymentStatus untouched so a transient failure retries next run.
        await bookingDoc.ref.update({ captureState: 'failed', captureErrorAt: FieldValue.serverTimestamp() });
        logger.error(
          `Capture failed for ${paymentIntentId} (booking ${bookingDoc.id})`,
          err as Error
        );
      }
    }
  }
);

/**
 * Defense-in-depth validation of every new booking's card hold.
 *
 * Bookings can only be created by finalizeBooking — Firestore rules deny direct
 * client writes to the collection — and finalizeBooking already verifies the
 * hold, so this trigger is a belt-and-suspenders backstop rather than the
 * primary guard. It retrieves the PaymentIntent and voids the booking unless it
 * is a real, uncaptured hold whose amount and parties match the booking. Because
 * finalizeBooking derives all of those fields FROM the same PaymentIntent,
 * legitimate bookings always match and are never voided; only an out-of-band
 * write that disagreed with its hold would be caught here.
 */
export const validateBookingHold = onDocumentCreated(
  { document: 'bookings/{bookingId}', region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (event) => {
    const snap = event.data;
    const b = snap?.data();
    if (!b || String(b.status) !== 'pending') return;

    const bookingId = event.params.bookingId;
    const paymentIntentId = b.paymentIntentId as string | undefined;

    async function voidBooking(reason: string): Promise<void> {
      logger.warn(`Voiding booking ${bookingId}: ${reason}`);
      // Do NOT cancel the PaymentIntent here — on a parties mismatch it belongs
      // to someone else. Declining the booking removes the free-work incentive;
      // a genuinely orphaned hold expires on its own (~7 days).
      await snap!.ref.update({ status: 'declined', paymentStatus: 'invalid', voidReason: reason });
    }

    if (!paymentIntentId) return voidBooking('missing paymentIntentId');

    try {
      const pi = await stripeClient().paymentIntents.retrieve(paymentIntentId);
      if (pi.status !== 'requires_capture') return voidBooking(`hold not authorized (${pi.status})`);
      if (
        pi.metadata?.clientId !== String(b.clientId ?? '') ||
        pi.metadata?.detailerId !== String(b.detailerId ?? '')
      ) {
        return voidBooking('hold parties do not match booking');
      }
      const expectedCents = Math.round(Number(b.price ?? 0) * 100);
      if (pi.amount !== expectedCents) {
        return voidBooking(`amount mismatch (${pi.amount} vs ${expectedCents})`);
      }
      // Real, matching hold — nothing to change (paymentStatus is already
      // 'requires_capture' from the client write / webhook).
    } catch (err) {
      return voidBooking(`could not retrieve hold: ${(err as Error).message}`);
    }
  }
);

/**
 * Admin-only dispute resolution — the missing counterpart to createDispute.
 * Without it a disputed booking's hold is frozen indefinitely. Resolves one of
 * three ways and unfreezes the payment:
 *   • release_detailer — capture + 90% transfer (the detailer keeps the job).
 *   • refund_client    — cancel the uncaptured hold, or refund a captured charge.
 *   • partial_refund   — capture, refund `clientRefundCents` to the client, and
 *                        transfer the detailer 90% of the retained remainder.
 *
 * ⚠️ TEST MODE: this moves real money. Verify every branch in Stripe test mode
 * (uncaptured vs. captured holds, full/partial refunds) before live enablement,
 * and have finance sign off on the partial-refund math.
 */
export const resolveDispute = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    requireAdmin(request.auth);
    const disputeId = String(request.data?.disputeId ?? '').trim();
    const resolution = String(request.data?.resolution ?? '');
    const note = String(request.data?.note ?? '').trim().slice(0, 1_000);
    if (!disputeId) throw new HttpsError('invalid-argument', 'disputeId is required.');
    if (!['release_detailer', 'refund_client', 'partial_refund'].includes(resolution)) {
      throw new HttpsError('invalid-argument', 'Invalid resolution.');
    }
    const clientRefundCents = resolution === 'partial_refund'
      ? Math.round(Number(request.data?.clientRefundCents ?? 0))
      : 0;

    // dispute id == booking id == invoice id (all keyed by the booking).
    const bookingRef = db.collection('bookings').doc(disputeId);
    const invoiceRef = db.collection('invoices').doc(disputeId);
    const disputeRef = db.collection('disputes').doc(disputeId);

    // Atomically claim the resolution so it can't race the release scheduler or a
    // second admin action.
    const claim = await db.runTransaction(async (tx) => {
      const [bSnap, dSnap] = await Promise.all([tx.get(bookingRef), tx.get(disputeRef)]);
      if (!bSnap.exists || !dSnap.exists) throw new HttpsError('not-found', 'Dispute not found.');
      const b = bSnap.data()!;
      if (dSnap.data()!.status !== 'open') throw new HttpsError('failed-precondition', 'Dispute is not open.');
      if (b.captureState === 'processing') {
        throw new HttpsError('failed-precondition', 'A capture is already in progress.');
      }
      const paymentIntentId = b.paymentIntentId as string | undefined;
      if (!paymentIntentId) throw new HttpsError('failed-precondition', 'Booking has no payment.');
      const priceCents = Math.round(Number(b.price ?? 0) * 100);
      if (resolution === 'partial_refund' && !(clientRefundCents > 0 && clientRefundCents < priceCents)) {
        throw new HttpsError('invalid-argument', 'Partial refund must be between 0 and the full price.');
      }
      tx.update(bookingRef, { captureState: 'processing', captureStartedAt: FieldValue.serverTimestamp() });
      tx.update(disputeRef, { status: 'resolving' });
      return { paymentIntentId, detailerId: String(b.detailerId ?? ''), priceCents };
    });

    const stripe = stripeClient();
    try {
      if (resolution === 'refund_client') {
        const pi = await stripe.paymentIntents.retrieve(claim.paymentIntentId);
        if (pi.status === 'requires_capture') {
          await stripe.paymentIntents.cancel(claim.paymentIntentId);
        } else if (pi.status === 'succeeded') {
          await stripe.refunds.create(
            { payment_intent: claim.paymentIntentId },
            { idempotencyKey: `refund_${disputeId}` }
          );
        }
        await bookingRef.update({
          paymentStatus: 'refunded', captureState: 'complete', refundedAt: FieldValue.serverTimestamp(),
        });
        await invoiceRef.update({ status: 'refunded', resolvedAt: FieldValue.serverTimestamp() }).catch(() => {});
      } else if (resolution === 'release_detailer') {
        const { transferId, amountCents } = await captureAndTransfer(
          stripe, disputeId, claim.paymentIntentId
        );
        await bookingRef.update({
          paymentStatus: 'captured', captureState: 'complete', capturedAt: FieldValue.serverTimestamp(),
          ...(transferId ? { transferId } : {}),
        });
        await invoiceRef.update({ status: 'released', releasedAt: FieldValue.serverTimestamp() }).catch(() => {});
        await accrueRevvCare(disputeId, amountCents);
      } else {
        // partial_refund: capture the full hold, refund the client's portion, and
        // transfer the detailer 90% of the retained remainder (platform keeps 10%).
        let pi = await stripe.paymentIntents.retrieve(claim.paymentIntentId, { expand: ['latest_charge'] });
        if (pi.status === 'requires_capture') {
          pi = await stripe.paymentIntents.capture(claim.paymentIntentId, { expand: ['latest_charge'] });
        }
        if (pi.status !== 'succeeded') throw new Error(`Unexpected PaymentIntent status: ${pi.status}`);
        await stripe.refunds.create(
          { payment_intent: claim.paymentIntentId, amount: clientRefundCents },
          { idempotencyKey: `prefund_${disputeId}` }
        );
        const { retainedCents: retained, detailerCents: detailerAmount } =
          splitPartialRefund(claim.priceCents, clientRefundCents);
        const charge = pi.latest_charge;
        const chargeId = typeof charge === 'string' ? charge : charge?.id;
        const detailerAccountId = String(
          (await db.collection('detailers').doc(claim.detailerId).get()).data()?.stripeAccountId ?? ''
        );
        if (chargeId && detailerAccountId && detailerAmount > 0 && pi.metadata?.fundsFlow === 'separate') {
          await stripe.transfers.create({
            amount: detailerAmount, currency: pi.currency, destination: detailerAccountId,
            source_transaction: chargeId, transfer_group: pi.transfer_group ?? undefined,
            metadata: { bookingId: disputeId, partialResolution: 'true' },
          }, { idempotencyKey: `ptransfer_${disputeId}` });
        }
        await bookingRef.update({
          paymentStatus: 'captured', captureState: 'complete', capturedAt: FieldValue.serverTimestamp(),
          partialRefundCents: clientRefundCents,
        });
        await invoiceRef.update({ status: 'resolved_partial', resolvedAt: FieldValue.serverTimestamp() }).catch(() => {});
        await accrueRevvCare(disputeId, retained);
      }

      await disputeRef.update({
        status: 'resolved', resolution, resolutionNote: note || null,
        resolvedAt: FieldValue.serverTimestamp(),
      });
      return { ok: true };
    } catch (err) {
      // Reopen the dispute for retry; the payment is untouched unless a Stripe
      // call already succeeded (all are idempotent, so a retry is safe).
      await bookingRef.update({ captureState: 'failed', captureErrorAt: FieldValue.serverTimestamp() }).catch(() => {});
      await disputeRef.update({ status: 'open' }).catch(() => {});
      logger.error(`resolveDispute failed for ${disputeId}`, err as Error);
      throw new HttpsError('internal', 'Could not resolve the dispute; it was left open for retry.');
    }
  }
);

/**
 * Detailer subscription billing (⚠️ TEST MODE) — the $34.99/mo plan that gates
 * marketplace visibility. Creates the detailer's Stripe customer and starts a
 * subscription on STRIPE_SUBSCRIPTION_PRICE_ID with a trial (60 days for Founding
 * Pro, else 14), using a SetupIntent so the app can collect the card that auto-
 * charges at trial end. Subscription STATE is owned by the webhook
 * (customer.subscription.*), which sets users.subscriptionStatus and
 * detailers.isActive — never trusted from the client.
 *
 * Verify the trial → active → past_due → canceled lifecycle in Stripe test mode
 * before live enablement. Requires STRIPE_SUBSCRIPTION_PRICE_ID to be set.
 */
export const createSubscription = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.data()?.userType !== 'detailer') {
      throw new HttpsError('permission-denied', 'Detailer access required.');
    }
    await enforceRateLimit(uid, 'subscription', 5, 60 * 60 * 1_000);

    const priceId = STRIPE_SUBSCRIPTION_PRICE_ID.value();
    if (!priceId) throw new HttpsError('failed-precondition', 'Subscription plan is not configured.');

    const stripe = stripeClient();
    const detailerRef = db.collection('detailers').doc(uid);
    const detailer = (await detailerRef.get()).data() ?? {};
    let customerId = detailer.stripeCustomerId as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (request.auth?.token.email as string | undefined) ?? undefined,
        name: (detailer.businessName as string | undefined)
          ?? (detailer.fullName as string | undefined)
          ?? undefined,
        metadata: { uid, role: 'detailer' },
      });
      customerId = customer.id;
      await detailerRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const trialDays = userSnap.data()?.isFoundingPro === true ? 60 : 14;
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: trialDays,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      metadata: { uid },
      expand: ['pending_setup_intent'],
    });

    const setupIntent = subscription.pending_setup_intent as Stripe.SetupIntent | null;
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: EPHEMERAL_KEY_API_VERSION }
    );

    return {
      subscriptionId: subscription.id,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
      setupIntentClientSecret: setupIntent?.client_secret ?? null,
      trialDays,
    };
  }
);
