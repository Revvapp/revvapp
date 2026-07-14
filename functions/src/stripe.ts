import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import Stripe from 'stripe';

import { db } from './admin';

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

const PLATFORM_FEE_RATE = 0.10;

function stripeClient(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value());
}

/**
 * Creates (or reuses) the detailer's Express account and returns a fresh
 * onboarding link. Links are single-use and expire, so one is minted per call.
 */
export const createConnectAccount = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const ref = db.collection('detailers').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'Detailer profile not found.');
    }

    const stripe = stripeClient();
    let accountId = snap.data()?.stripeAccountId as string | undefined;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: (request.auth?.token.email as string | undefined) ?? undefined,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { uid },
      });
      accountId = account.id;
      await ref.update({ stripeAccountId: accountId, payoutsEnabled: false });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: CONNECT_RETURN_URL,
      refresh_url: CONNECT_REFRESH_URL,
    });

    return { url: link.url };
  }
);

/**
 * Re-reads the Express account and syncs `payoutsEnabled` onto the detailer
 * doc. Called by the app when it returns from the onboarding browser; the
 * `account.updated` webhook keeps the flag honest afterwards.
 */
export const getConnectStatus = onCall(
  { region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const ref = db.collection('detailers').doc(uid);
    const accountId = (await ref.get()).data()?.stripeAccountId as string | undefined;
    if (!accountId) return { payoutsEnabled: false, detailsSubmitted: false };

    const account = await stripeClient().accounts.retrieve(accountId);
    const payoutsEnabled = account.payouts_enabled === true;
    await ref.update({ payoutsEnabled });

    return { payoutsEnabled, detailsSubmitted: account.details_submitted === true };
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
    const dollars = parseFloat(String(rate).replace(/[^0-9.]/g, ''));
    const amountCents = Math.round(dollars * 100);
    if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 1_000_000) {
      throw new HttpsError('failed-precondition', 'This service has an invalid price.');
    }

    const stripe = stripeClient();

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

    const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_RATE);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: customerId,
      capture_method: 'manual',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: accountId },
      metadata: { clientId: uid, detailerId, service },
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

    // create() throws if the doc exists — that's the idempotency check.
    try {
      await db.collection('stripeEvents').doc(event.id).create({
        type: event.type,
        receivedAt: FieldValue.serverTimestamp(),
      });
    } catch {
      res.json({ received: true, duplicate: true });
      return;
    }

    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object;
        const match = await db
          .collection('detailers')
          .where('stripeAccountId', '==', account.id)
          .limit(1)
          .get();
        if (!match.empty) {
          await match.docs[0].ref.update({ payoutsEnabled: account.payouts_enabled === true });
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
      default:
        break;
    }

    res.json({ received: true });
  }
);

/**
 * ⚠️ DRAFT — NOT YET DEPLOYED. Verify end-to-end in Stripe TEST mode before
 * enabling in production; this moves real money.
 *
 * Phase 3/4 of docs/STRIPE_PLAN.md — auto-release after the 24h dispute window.
 * The booking hold is a manual-capture *destination charge*, so capturing it
 * both charges the client and settles the payout to the detailer (minus the 10%
 * application fee) in one step. That is exactly the "auto-release" the business
 * rules describe, so we capture at window-close — not at job completion.
 *
 * Eligible booking: status `completed`, hold still `requires_capture`, completed
 * more than 24h ago, and its invoice (same id as the booking) is not `disputed`.
 * Capture → paymentStatus `captured` and invoice `released`. Stripe auth holds
 * last ~7 days, so a 30-minute cadence has ample margin.
 *
 * Follow-up (intentionally NOT here): Revv Care 1% accrual, partial capture for
 * partial-refund dispute outcomes, and removing the legacy client-side
 * `released` flip in app/client/invoice/[id].tsx once this is live.
 */
const DISPUTE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const releaseHoldsAfterDisputeWindow = onSchedule(
  { schedule: 'every 30 minutes', region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async () => {
    const cutoffMs = Date.now() - DISPUTE_WINDOW_MS;
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
      const completedAt = b.completedAt as Timestamp | undefined;
      if (!completedAt || completedAt.toMillis() > cutoffMs) continue; // window still open
      const paymentIntentId = b.paymentIntentId as string | undefined;
      if (!paymentIntentId) continue;

      // The invoice shares the booking id; never release one under dispute.
      const invoiceRef = db.collection('invoices').doc(bookingDoc.id);
      const invoiceSnap = await invoiceRef.get();
      if (invoiceSnap.data()?.status === 'disputed') continue;

      try {
        await stripe.paymentIntents.capture(paymentIntentId);
        await bookingDoc.ref.update({ paymentStatus: 'captured' });
        if (invoiceSnap.exists) {
          await invoiceRef.update({
            status: 'released',
            releasedAt: FieldValue.serverTimestamp(),
          });
        }
        logger.info(`Released hold ${paymentIntentId} for booking ${bookingDoc.id}`);
      } catch (err) {
        // Leave paymentStatus untouched so a transient failure retries next run.
        logger.error(
          `Capture failed for ${paymentIntentId} (booking ${bookingDoc.id})`,
          err as Error
        );
      }
    }
  }
);
