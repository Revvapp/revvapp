import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import { checkTransition, elapsedSeconds } from './bookingRules';
import { enforceRateLimit } from './rateLimit';

const REGION = 'us-west2';
const MAX_TEXT = 1_000;
const DISPUTE_CATEGORIES = new Set([
  'damage', 'service_quality', 'no_show', 'wrong_service', 'overcharge', 'other',
]);

function requireUid(auth: { uid: string; token: Record<string, unknown> } | undefined): string {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  return auth.uid;
}

function text(value: unknown, name: string, max = MAX_TEXT): string {
  const result = String(value ?? '').trim();
  if (!result || result.length > max) {
    throw new HttpsError('invalid-argument', `${name} is invalid.`);
  }
  return result;
}

function optionalText(value: unknown, max = MAX_TEXT): string | null {
  const result = String(value ?? '').trim();
  if (result.length > max) throw new HttpsError('invalid-argument', 'Text is too long.');
  return result || null;
}

function stringArray(value: unknown, name: string, maxItems: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new HttpsError('invalid-argument', `${name} is invalid.`);
  }
  const values = value.map((item) => String(item));
  if (values.some((item) => !item || item.length > 2_048)) {
    throw new HttpsError('invalid-argument', `${name} contains an invalid item.`);
  }
  return values;
}

type Booking = Record<string, unknown> & {
  clientId: string;
  detailerId: string;
  status: string;
};

function assertRole(booking: Booking, uid: string, role: 'client' | 'detailer'): void {
  const expected = role === 'client' ? booking.clientId : booking.detailerId;
  if (expected !== uid) throw new HttpsError('permission-denied', `${role} access required.`);
}

function assertStatus(booking: Booking, allowed: string[]): void {
  if (!allowed.includes(String(booking.status))) {
    throw new HttpsError('failed-precondition', 'Booking is not in the required state.');
  }
}

/**
 * Runs the pure transition rules and rethrows any refusal as the matching
 * HttpsError, so `bookingRules.ts` stays free of the Functions SDK.
 */
function assertTransition(booking: Booking, uid: string, action: string): void {
  const check = checkTransition(booking, uid, action);
  if (!check.ok) throw new HttpsError(check.code, check.message);
}

/**
 * Performs every security-sensitive booking transition server-side. Timestamps
 * and timer totals are derived here, never accepted from a participant device.
 */
export const transitionBooking = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  const bookingId = text(request.data?.bookingId, 'bookingId', 200);
  const action = text(request.data?.action, 'action', 40);
  const ref = db.collection('bookings').doc(bookingId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const booking = snap.data() as Booking;
    // Role, source status and per-action preconditions all live in the pure
    // rules module; the cases below only describe the resulting write.
    assertTransition(booking, uid, action);

    switch (action) {
      case 'accept':
        tx.update(ref, { status: 'active', acceptedAt: FieldValue.serverTimestamp() });
        break;
      case 'decline':
        tx.update(ref, { status: 'declined', declinedAt: FieldValue.serverTimestamp() });
        break;
      case 'cancel':
        tx.update(ref, { status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
        break;
      case 'submit_vir': {
        const panels = request.data?.virPanels;
        if (!panels || typeof panels !== 'object' || Array.isArray(panels)) {
          throw new HttpsError('invalid-argument', 'VIR panels are required.');
        }
        const entries = Object.entries(panels as Record<string, unknown>);
        if (entries.length < 1 || entries.length > 12) {
          throw new HttpsError('invalid-argument', 'VIR panel count is invalid.');
        }
        for (const [, raw] of entries) {
          const panel = raw as Record<string, unknown>;
          text(panel?.photoUrl, 'photoUrl', 2_048);
          if (String(panel?.notes ?? '').length > 500) {
            throw new HttpsError('invalid-argument', 'VIR notes are too long.');
          }
        }
        tx.update(ref, {
          status: 'vir_submitted', virPanels: panels, virSubmittedAt: FieldValue.serverTimestamp(),
        });
        break;
      }
      case 'sign_vir':
        tx.update(ref, { status: 'vir_signed', virSignedAt: FieldValue.serverTimestamp() });
        break;
      case 'start':
        tx.update(ref, {
          status: 'in_progress', timerStartAt: FieldValue.serverTimestamp(),
          timerStartMs: Date.now(), timerAccumulatedSeconds: 0,
          serviceChecklist: Array.isArray(request.data?.serviceChecklist)
            ? request.data.serviceChecklist.slice(0, 30)
            : [],
        });
        break;
      case 'pause':
        tx.update(ref, {
          status: 'paused', timerStartAt: null, timerStartMs: null,
          timerAccumulatedSeconds: elapsedSeconds(booking, Date.now(), true),
          pauseReason: optionalText(request.data?.pauseReason, 200),
        });
        break;
      case 'resume':
        tx.update(ref, {
          status: 'in_progress', timerStartAt: FieldValue.serverTimestamp(), timerStartMs: Date.now(),
        });
        break;
      case 'complete':
        tx.update(ref, {
          status: 'completed', timerStartAt: null, timerStartMs: null,
          // Only a running job has an open segment to add; a paused one already
          // banked its time when it was paused.
          timerAccumulatedSeconds: elapsedSeconds(booking, Date.now(), booking.status === 'in_progress'),
          completedAt: FieldValue.serverTimestamp(),
          releaseEligibleAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1_000),
        });
        break;
      case 'update_checklist':
        if (!Array.isArray(request.data?.serviceChecklist) || request.data.serviceChecklist.length > 30) {
          throw new HttpsError('invalid-argument', 'Checklist is invalid.');
        }
        tx.update(ref, { serviceChecklist: request.data.serviceChecklist });
        break;
      default:
        throw new HttpsError('invalid-argument', 'Unknown booking action.');
    }
  });

  return { ok: true };
});

/** Attaches immutable job-completion photos without granting invoice writes. */
export const attachAfterPhotos = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  const bookingId = text(request.data?.bookingId, 'bookingId', 200);
  const afterPhotos = stringArray(request.data?.afterPhotos, 'afterPhotos', 20);
  const bookingRef = db.collection('bookings').doc(bookingId);
  const invoiceRef = db.collection('invoices').doc(bookingId);
  await db.runTransaction(async (tx) => {
    const [bookingSnap, invoiceSnap] = await Promise.all([tx.get(bookingRef), tx.get(invoiceRef)]);
    if (!bookingSnap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const booking = bookingSnap.data() as Booking;
    assertRole(booking, uid, 'detailer');
    assertStatus(booking, ['completed']);
    if (booking.afterPhotosFinalizedAt) {
      throw new HttpsError('already-exists', 'Completion photos are already finalized.');
    }
    tx.update(bookingRef, { afterPhotos, afterPhotosFinalizedAt: FieldValue.serverTimestamp() });
    if (invoiceSnap.exists) tx.update(invoiceRef, { afterPhotos });
  });
  return { ok: true };
});

/** Creates one immutable dispute per booking and atomically freezes release. */
export const createDispute = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  await enforceRateLimit(uid, 'dispute', 5, 24 * 60 * 60 * 1_000);
  const bookingId = text(request.data?.bookingId, 'bookingId', 200);
  const category = text(request.data?.category, 'category', 40);
  if (!DISPUTE_CATEGORIES.has(category)) throw new HttpsError('invalid-argument', 'Invalid category.');
  const description = text(request.data?.description, 'description', MAX_TEXT);
  if (description.length < 20) throw new HttpsError('invalid-argument', 'Description is too short.');
  const photoUrls = stringArray(request.data?.photoUrls, 'photoUrls', 5);
  if (photoUrls.length < 1) throw new HttpsError('invalid-argument', 'Photo evidence is required.');

  const bookingRef = db.collection('bookings').doc(bookingId);
  const invoiceRef = db.collection('invoices').doc(bookingId);
  const disputeRef = db.collection('disputes').doc(bookingId);
  await db.runTransaction(async (tx) => {
    const [bookingSnap, invoiceSnap, disputeSnap] = await Promise.all([
      tx.get(bookingRef), tx.get(invoiceRef), tx.get(disputeRef),
    ]);
    if (!bookingSnap.exists || !invoiceSnap.exists) {
      throw new HttpsError('not-found', 'Booking invoice not found.');
    }
    const booking = bookingSnap.data() as Booking;
    assertRole(booking, uid, 'client');
    assertStatus(booking, ['completed']);
    // Anchor the window to the same server-owned field the release scheduler
    // uses (releaseEligibleAt), falling back to completedAt+24h for legacy docs,
    // so "dispute still open" and "auto-release eligible" can never disagree.
    const releaseEligibleAt = booking.releaseEligibleAt as Timestamp | undefined;
    const completedAt = booking.completedAt as Timestamp | undefined;
    const windowClosesAt = releaseEligibleAt?.toMillis()
      ?? (completedAt ? completedAt.toMillis() + 24 * 60 * 60 * 1_000 : undefined);
    if (!windowClosesAt || Date.now() > windowClosesAt) {
      throw new HttpsError('failed-precondition', 'The dispute window has closed.');
    }
    if (booking.paymentStatus === 'captured') {
      throw new HttpsError('failed-precondition', 'Payment has already been released.');
    }
    if (booking.captureState === 'processing' || booking.captureState === 'complete') {
      throw new HttpsError('failed-precondition', 'Payment release has already begun.');
    }
    if (disputeSnap.exists) throw new HttpsError('already-exists', 'A dispute already exists.');
    tx.create(disputeRef, {
      invoiceId: bookingId, bookingId, clientId: booking.clientId,
      detailerId: booking.detailerId, category, description, photoUrls,
      status: 'open', createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(invoiceRef, { status: 'disputed', disputedAt: FieldValue.serverTimestamp() });
  });
  return { disputeId: bookingId };
});

/** Lets the detailer append one response without mutating the client's evidence. */
export const respondToDispute = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  const disputeId = text(request.data?.disputeId, 'disputeId', 200);
  const response = text(request.data?.response, 'response', MAX_TEXT);
  const ref = db.collection('disputes').doc(disputeId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Dispute not found.');
    const dispute = snap.data()!;
    if (dispute.detailerId !== uid) throw new HttpsError('permission-denied', 'Detailer access required.');
    if (dispute.status !== 'open') throw new HttpsError('failed-precondition', 'Dispute is closed.');
    if (dispute.detailerResponse) throw new HttpsError('already-exists', 'A response was already submitted.');
    tx.update(ref, { detailerResponse: response, detailerRespondedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});

/** Updates only non-financial social-studio metadata on a detailer's invoice. */
export const updateInvoiceReach = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  const invoiceId = text(request.data?.invoiceId, 'invoiceId', 200);
  const ref = db.collection('invoices').doc(invoiceId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Invoice not found.');
  if (snap.data()?.detailerId !== uid) throw new HttpsError('permission-denied', 'Detailer access required.');
  const update: Record<string, unknown> = {
    reachShared: request.data?.reachShared === true,
    reachUpdatedAt: FieldValue.serverTimestamp(),
  };
  if (request.data?.reelUrl != null) update.reelUrl = text(request.data.reelUrl, 'reelUrl', 2_048);
  await ref.update(update);
  return { ok: true };
});

/**
 * Deletes private profile data after recent client-side reauthentication.
 * Transaction records are anonymized rather than destroyed so financial and
 * dispute records retain integrity.
 */
export const deleteMyAccount = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  const authTime = Number(request.auth?.token.auth_time ?? 0) * 1_000;
  if (!authTime || Date.now() - authTime > 5 * 60 * 1_000) {
    throw new HttpsError('failed-precondition', 'Please reauthenticate before deleting your account.');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const email = String(userSnap.data()?.email ?? request.auth?.token.email ?? '').toLowerCase();
  const batch = db.batch();
  batch.delete(db.collection('users').doc(uid));
  batch.delete(db.collection('clients').doc(uid));
  batch.delete(db.collection('detailers').doc(uid));
  batch.delete(db.collection('pushTokens').doc(uid));
  if (email) batch.delete(db.collection('emailLookup').doc(email));
  await batch.commit();

  // Delete nested private data and user-owned uploads. Missing paths are no-ops.
  await Promise.allSettled([
    db.recursiveDelete(db.collection('clients').doc(uid)),
    db.recursiveDelete(db.collection('detailers').doc(uid)),
    getStorage().bucket().deleteFiles({ prefix: `detailers/${uid}/` }),
  ]);
  await getAuth().deleteUser(uid);
  return { ok: true };
});

/**
 * Requires an authenticated caller carrying the `admin` custom claim. Admin-only
 * operations (dispute resolution, detailer verification, Founding Pro grants, Care
 * claim decisions) gate on this. Set the claim out-of-band with the Admin SDK:
 * `getAuth().setCustomUserClaims(uid, { admin: true })`.
 */
export function requireAdmin(auth: { uid: string; token: Record<string, unknown> } | undefined): string {
  const uid = requireUid(auth);
  if (auth?.token?.admin !== true) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }
  return uid;
}

/**
 * Admin-only manual identity verification — the interim standing in for the
 * Checkr background-check integration. Sets the server-owned `idVerified` flag
 * that Firestore rules forbid a detailer from granting themselves. Replace the
 * call site with the Checkr webhook once that integration exists.
 */
export const setDetailerVerified = onCall({ region: REGION }, async (request) => {
  requireAdmin(request.auth);
  const detailerId = text(request.data?.detailerId, 'detailerId', 200);
  const verified = request.data?.verified === true;
  const ref = db.collection('detailers').doc(detailerId);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Detailer not found.');
  await ref.update({
    idVerified: verified,
    idVerifiedAt: verified ? FieldValue.serverTimestamp() : null,
  });
  return { ok: true };
});

const FOUNDING_PRO_LIMIT = 25;
const FOUNDING_PRO_TRIAL_DAYS = 60;

/**
 * Admin-only: grants Founding Pro status to one of the first 25 detailers — a
 * 60-day trial with no card and a permanent badge. A transactional counter caps
 * the program. isFoundingPro/trial fields are server-owned (rules lock them), so
 * this is the only legitimate writer.
 */
export const grantFoundingPro = onCall({ region: REGION }, async (request) => {
  requireAdmin(request.auth);
  const detailerId = text(request.data?.detailerId, 'detailerId', 200);
  const userRef = db.collection('users').doc(detailerId);
  const counterRef = db.collection('programCounters').doc('foundingPro');
  await db.runTransaction(async (tx) => {
    const [userSnap, counterSnap] = await Promise.all([tx.get(userRef), tx.get(counterRef)]);
    if (!userSnap.exists || userSnap.data()?.userType !== 'detailer') {
      throw new HttpsError('not-found', 'Detailer account not found.');
    }
    if (userSnap.data()?.isFoundingPro === true) return; // idempotent
    const granted = Number(counterSnap.data()?.count ?? 0);
    if (granted >= FOUNDING_PRO_LIMIT) {
      throw new HttpsError('resource-exhausted', 'All Founding Pro slots have been claimed.');
    }
    tx.set(counterRef, { count: granted + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(userRef, {
      isFoundingPro: true,
      trialDays: FOUNDING_PRO_TRIAL_DAYS,
      trialStartDate: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  return { ok: true };
});

const CARE_CLAIM_WINDOW_MS = 72 * 60 * 60 * 1_000;
const CARE_CLAIM_CAP_CENTS = 250_000; // $2,500 coverage cap per booking.

/**
 * A client files a Revv Care damage-protection claim. Allowed only within 72h of
 * job completion (a documented business rule) and one per booking — the doc id is
 * the booking id. Created server-side so the window, party, and cap are
 * authoritative. Disbursement of an approved claim is handled off-platform.
 */
export const createCareClaim = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request.auth);
  await enforceRateLimit(uid, 'care_claim', 5, 24 * 60 * 60 * 1_000);
  const bookingId = text(request.data?.bookingId, 'bookingId', 200);
  const description = text(request.data?.description, 'description', MAX_TEXT);
  if (description.length < 20) {
    throw new HttpsError('invalid-argument', 'Please describe the damage in more detail.');
  }
  const photoUrls = stringArray(request.data?.photoUrls, 'photoUrls', 8);
  if (photoUrls.length < 1) throw new HttpsError('invalid-argument', 'Photo evidence is required.');
  const amountRequestedCents = Math.round(Number(request.data?.amountRequestedCents ?? 0));
  if (!(amountRequestedCents > 0 && amountRequestedCents <= CARE_CLAIM_CAP_CENTS)) {
    throw new HttpsError('invalid-argument', 'Requested amount must be within the $2,500 coverage cap.');
  }

  const bookingRef = db.collection('bookings').doc(bookingId);
  const claimRef = db.collection('careClaims').doc(bookingId);
  await db.runTransaction(async (tx) => {
    const [bookingSnap, claimSnap] = await Promise.all([tx.get(bookingRef), tx.get(claimRef)]);
    if (!bookingSnap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const booking = bookingSnap.data() as Booking;
    assertRole(booking, uid, 'client');
    assertStatus(booking, ['completed']);
    const completedAt = booking.completedAt as Timestamp | undefined;
    if (!completedAt || Date.now() > completedAt.toMillis() + CARE_CLAIM_WINDOW_MS) {
      throw new HttpsError('failed-precondition', 'Revv Care claims must be filed within 72 hours of completion.');
    }
    if (claimSnap.exists) throw new HttpsError('already-exists', 'A claim already exists for this booking.');
    tx.create(claimRef, {
      bookingId,
      clientId: booking.clientId,
      detailerId: booking.detailerId,
      description,
      photoUrls,
      amountRequestedCents,
      status: 'open',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { claimId: bookingId };
});

/**
 * Admin-only Revv Care claim decision. Records the outcome and approved amount
 * (capped at $2,500) as the audited decision record. Payout to the client is made
 * off-platform from the platform reserve — Revv Care is not a Connect transfer —
 * so this moves no money.
 */
export const resolveCareClaim = onCall({ region: REGION }, async (request) => {
  requireAdmin(request.auth);
  const claimId = text(request.data?.claimId, 'claimId', 200);
  const decision = text(request.data?.decision, 'decision', 20);
  if (decision !== 'approved' && decision !== 'denied') {
    throw new HttpsError('invalid-argument', 'Decision must be approved or denied.');
  }
  const note = optionalText(request.data?.note, MAX_TEXT);
  const approvedCents = decision === 'approved' ? Math.round(Number(request.data?.approvedCents ?? 0)) : 0;
  if (decision === 'approved' && !(approvedCents > 0 && approvedCents <= CARE_CLAIM_CAP_CENTS)) {
    throw new HttpsError('invalid-argument', 'Approved amount must be within the $2,500 cap.');
  }
  const ref = db.collection('careClaims').doc(claimId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Claim not found.');
    if (snap.data()?.status !== 'open') throw new HttpsError('failed-precondition', 'Claim is already resolved.');
    tx.update(ref, {
      status: decision,
      approvedCents,
      resolutionNote: note,
      resolvedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

/**
 * Admin-only: marks a trust & safety report reviewed or dismissed.
 *
 * Reports were previously logged to Cloud Logging only (onReportCreated in
 * reports.ts) with no way to ever clear one — the admin console's queue would
 * only ever grow. Resolution here is bookkeeping for the team, not a money or
 * account action; it doesn't touch the reported user's account directly.
 */
export const resolveReport = onCall({ region: REGION }, async (request) => {
  requireAdmin(request.auth);
  const reportId = text(request.data?.reportId, 'reportId', 200);
  const decision = text(request.data?.decision, 'decision', 20);
  if (decision !== 'reviewed' && decision !== 'dismissed') {
    throw new HttpsError('invalid-argument', 'Decision must be reviewed or dismissed.');
  }
  const note = optionalText(request.data?.note, MAX_TEXT);
  const ref = db.collection('reports').doc(reportId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Report not found.');
    if (snap.data()?.status !== 'open') throw new HttpsError('failed-precondition', 'Report is already resolved.');
    tx.update(ref, {
      status: decision,
      adminNote: note,
      resolvedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});
