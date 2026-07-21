import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';

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

function assertParty(booking: Booking, uid: string): void {
  if (booking.clientId !== uid && booking.detailerId !== uid) {
    throw new HttpsError('permission-denied', 'You are not a party to this booking.');
  }
}

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
    assertParty(booking, uid);

    switch (action) {
      case 'accept':
        assertRole(booking, uid, 'detailer');
        assertStatus(booking, ['pending']);
        if (booking.paymentStatus !== 'requires_capture') {
          throw new HttpsError('failed-precondition', 'A valid card hold is required.');
        }
        tx.update(ref, { status: 'active', acceptedAt: FieldValue.serverTimestamp() });
        break;
      case 'decline':
        assertRole(booking, uid, 'detailer');
        assertStatus(booking, ['pending']);
        tx.update(ref, { status: 'declined', declinedAt: FieldValue.serverTimestamp() });
        break;
      case 'cancel':
        assertRole(booking, uid, 'client');
        assertStatus(booking, ['pending', 'active']);
        tx.update(ref, { status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
        break;
      case 'submit_vir': {
        assertRole(booking, uid, 'detailer');
        assertStatus(booking, ['active']);
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
        assertRole(booking, uid, 'client');
        assertStatus(booking, ['vir_submitted']);
        if (!booking.virPanels) throw new HttpsError('failed-precondition', 'VIR is missing.');
        tx.update(ref, { status: 'vir_signed', virSignedAt: FieldValue.serverTimestamp() });
        break;
      case 'start':
        assertRole(booking, uid, 'detailer');
        assertStatus(booking, ['vir_signed']);
        tx.update(ref, {
          status: 'in_progress', timerStartAt: FieldValue.serverTimestamp(),
          timerStartMs: Date.now(), timerAccumulatedSeconds: 0,
          serviceChecklist: Array.isArray(request.data?.serviceChecklist)
            ? request.data.serviceChecklist.slice(0, 30)
            : [],
        });
        break;
      case 'pause': {
        assertRole(booking, uid, 'detailer');
        assertStatus(booking, ['in_progress']);
        const started = Number(booking.timerStartMs ?? Date.now());
        const accumulated = Number(booking.timerAccumulatedSeconds ?? 0);
        const elapsed = accumulated + Math.max(0, Math.floor((Date.now() - started) / 1_000));
        tx.update(ref, {
          status: 'paused', timerStartAt: null, timerStartMs: null,
          timerAccumulatedSeconds: elapsed,
          pauseReason: optionalText(request.data?.pauseReason, 200),
        });
        break;
      }
      case 'resume':
        assertRole(booking, uid, 'detailer');
        assertStatus(booking, ['paused']);
        tx.update(ref, {
          status: 'in_progress', timerStartAt: FieldValue.serverTimestamp(), timerStartMs: Date.now(),
        });
        break;
      case 'complete': {
        assertRole(booking, uid, 'detailer');
        assertStatus(booking, ['in_progress', 'paused']);
        if (!booking.virSignedAt) throw new HttpsError('failed-precondition', 'Signed VIR required.');
        const started = Number(booking.timerStartMs ?? Date.now());
        const accumulated = Number(booking.timerAccumulatedSeconds ?? 0);
        const running = booking.status === 'in_progress'
          ? Math.max(0, Math.floor((Date.now() - started) / 1_000))
          : 0;
        tx.update(ref, {
          status: 'completed', timerStartAt: null, timerStartMs: null,
          timerAccumulatedSeconds: accumulated + running,
          completedAt: FieldValue.serverTimestamp(),
          releaseEligibleAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1_000),
        });
        break;
      }
      case 'update_checklist':
        assertRole(booking, uid, 'detailer');
        assertStatus(booking, ['in_progress', 'paused']);
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
    const completedAt = booking.completedAt as Timestamp | undefined;
    if (!completedAt || Date.now() > completedAt.toMillis() + 24 * 60 * 60 * 1_000) {
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
