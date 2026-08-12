import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import { FLEET_RATE_CARD, fleetEstimate } from './money';
import { enforceRateLimit } from './rateLimit';
import { requireAdmin } from './workflows';

/**
 * Fleet ordering for dealerships — the B2B side of the business portal.
 *
 * A dealership describes the vehicles and the service; the platform returns an
 * indicative estimate immediately and a firm quote once a detailer is
 * confirmed. Deliberately *not* a booking: no card is held and no detailer is
 * assigned at request time, because a twenty-car job needs a human to confirm
 * capacity before anyone is committed. The consumer booking flow in `stripe.ts`
 * is untouched by any of this.
 *
 * Money is never accepted from the client. The estimate is recomputed here from
 * the same pure helper the portal displays, and the binding `quotedCents` can
 * only be written by an admin.
 */

const REGION = 'us-west2';
const MAX_VEHICLES = 200;
const MAX_TEXT = 1_000;

type Status = 'requested' | 'quoted' | 'accepted' | 'declined' | 'scheduled' | 'complete';

function text(value: unknown, name: string, max: number, required = true): string {
  const out = String(value ?? '').trim();
  if (required && !out) throw new HttpsError('invalid-argument', `${name} is required.`);
  if (out.length > max) throw new HttpsError('invalid-argument', `${name} is too long.`);
  return out;
}

function requireUid(auth: { uid: string; token: Record<string, unknown> } | undefined): string {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  return auth.uid;
}

/** A `YYYY-MM-DD` date that is today or later. Fleet work is scheduled, not instant. */
function futureDate(value: unknown): string {
  const date = text(value, 'preferredDate', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError('invalid-argument', 'Preferred date is invalid.');
  }
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) throw new HttpsError('invalid-argument', 'Preferred date is in the past.');
  return date;
}

/**
 * A dealership raises a fleet request. Status starts at `requested`; the
 * estimate stored here is indicative and is recomputed server-side so a tampered
 * client cannot pre-set what it will be quoted.
 */
export const createFleetOrder = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);

  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.data()?.isDealership !== true) {
    throw new HttpsError('permission-denied', 'Fleet ordering is available to dealership accounts.');
  }
  await enforceRateLimit(uid, 'fleet_order', 20, 24 * 60 * 60 * 1_000);

  const service = text(request.data?.service, 'service', 60);
  if (!(service in FLEET_RATE_CARD)) {
    throw new HttpsError('invalid-argument', 'That service is not available for fleet orders.');
  }

  const raw = request.data?.vehicles;
  if (!Array.isArray(raw) || raw.length < 1) {
    throw new HttpsError('invalid-argument', 'Add at least one vehicle.');
  }
  if (raw.length > MAX_VEHICLES) {
    throw new HttpsError('invalid-argument', `A single order is limited to ${MAX_VEHICLES} vehicles.`);
  }
  const vehicles = raw.map((v: unknown) => {
    const item = (v ?? {}) as Record<string, unknown>;
    return {
      description: text(item.description, 'vehicle description', 120),
      reference: text(item.reference, 'vehicle reference', 60, false) || null,
    };
  });

  const estimate = fleetEstimate(service, vehicles.length);
  if (!estimate) throw new HttpsError('invalid-argument', 'Could not price that order.');

  const ref = db.collection('fleetOrders').doc();
  await ref.set({
    dealershipId: uid,
    dealershipName: String(userSnap.data()?.businessName ?? userSnap.data()?.email ?? ''),
    contactEmail: String(request.auth?.token.email ?? ''),
    service,
    vehicles,
    vehicleCount: vehicles.length,
    preferredDate: futureDate(request.data?.preferredDate),
    address: text(request.data?.address, 'address', 500),
    notes: text(request.data?.notes, 'notes', MAX_TEXT, false) || null,
    estimateCents: estimate.totalCents,
    estimateGrossCents: estimate.grossCents,
    estimateDiscountCents: estimate.discountCents,
    quotedCents: null,
    status: 'requested' satisfies Status,
    createdAt: FieldValue.serverTimestamp(),
  });

  logger.info(`Fleet order ${ref.id}: ${vehicles.length} × ${service} for ${uid}`);
  return { orderId: ref.id, estimateCents: estimate.totalCents };
});

/**
 * Admin returns a firm quote. This is the only writer of `quotedCents` — the
 * figure the dealership actually agrees to — which is why it is a callable
 * behind the admin claim rather than a client write.
 */
export const quoteFleetOrder = onCall({ region: REGION }, async (request) => {
  requireAdmin(request.auth);
  const orderId = text(request.data?.orderId, 'orderId', 200);
  const quotedCents = Math.round(Number(request.data?.quotedCents ?? 0));
  if (!Number.isFinite(quotedCents) || quotedCents <= 0 || quotedCents > 100_000_000) {
    throw new HttpsError('invalid-argument', 'Quote must be a positive amount.');
  }
  const note = text(request.data?.note, 'note', MAX_TEXT, false) || null;

  const ref = db.collection('fleetOrders').doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Fleet order not found.');
    const status = String(snap.data()?.status);
    if (status !== 'requested' && status !== 'quoted') {
      throw new HttpsError('failed-precondition', 'This order can no longer be quoted.');
    }
    tx.update(ref, {
      quotedCents, quoteNote: note, status: 'quoted' satisfies Status,
      quotedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

/**
 * The dealership accepts or declines the quote. Accepting is the commitment
 * point; scheduling and payment are handled off-platform for now, which is why
 * this records the decision rather than moving money.
 */
export const respondToFleetQuote = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  const orderId = text(request.data?.orderId, 'orderId', 200);
  const accept = request.data?.accept === true;

  const ref = db.collection('fleetOrders').doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Fleet order not found.');
    const order = snap.data()!;
    if (order.dealershipId !== uid) {
      throw new HttpsError('permission-denied', 'This is not your order.');
    }
    if (order.status !== 'quoted') {
      throw new HttpsError('failed-precondition', 'There is no open quote to respond to.');
    }
    tx.update(ref, {
      status: (accept ? 'accepted' : 'declined') satisfies Status,
      respondedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

/**
 * Admin grants or revokes dealership status. Firestore rules forbid a user from
 * setting `isDealership` on themselves, so this is the only legitimate writer.
 */
export const setDealershipStatus = onCall({ region: REGION }, async (request) => {
  requireAdmin(request.auth);
  const userId = text(request.data?.userId, 'userId', 200);
  const isDealership = request.data?.isDealership === true;
  const businessName = text(request.data?.businessName, 'businessName', 200, false);

  const ref = db.collection('users').doc(userId);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Account not found.');
  await ref.set({
    isDealership,
    ...(businessName ? { businessName } : {}),
    dealershipUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});
