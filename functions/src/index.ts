import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

import { db } from './admin';

// Server-side push notifications (booking, message, dispute and review events).
export * from './notifications';

// Trust & safety report logging (off-platform / safety reports).
export * from './reports';

// Stripe payment layer: Connect onboarding, booking card holds, webhook.
export * from './stripe';

/**
 * Keeps each detailer's aggregate rating in sync with the reviews collection.
 *
 * Whenever a review under `reviews/{reviewId}` is created, changed or deleted,
 * we recompute the affected detailer's average and count from their reviews and
 * write `rating`, `reviewCount` and `ratingSum` onto `detailers/{detailerId}`.
 *
 * Clients can then read those fields directly (one document read) instead of
 * scanning the reviews collection — the O(1) path that scales regardless of how
 * many reviews exist. The Admin SDK bypasses Firestore security rules, so no
 * rule change is needed for the function to write the detailer doc.
 *
 * A full recompute per write is simple and self-correcting (handles deletes and
 * manual edits). If a single detailer ever accumulates a very large number of
 * reviews, switch to FieldValue.increment deltas instead.
 */
export const aggregateDetailerRating = onDocumentWritten('reviews/{reviewId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  const detailerId = (after?.detailerId ?? before?.detailerId) as string | undefined;
  if (!detailerId) return;

  const snap = await db.collection('reviews').where('detailerId', '==', detailerId).get();

  let sum = 0;
  let count = 0;
  snap.forEach((doc) => {
    const r = Number(doc.data().rating ?? 0);
    if (r > 0) {
      sum += r;
      count += 1;
    }
  });

  const rating = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;

  await db
    .collection('detailers')
    .doc(detailerId)
    .set(
      { rating, reviewCount: count, ratingSum: sum, ratingUpdatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

  logger.info(`Updated rating for detailer ${detailerId}: ${rating} (${count} reviews)`);
});

/**
 * Stamps lastDetailedDate on the client's vehicle when a booking completes.
 *
 * The app used to write this from the detailer's device, but Firestore rules
 * (correctly) restrict `clients/{uid}/vehicles/*` to the owning client, so the
 * write was always denied. The Admin SDK bypasses rules, making this the one
 * legitimate writer. The garage/history screens also fall back to the most
 * recent completed booking, so a missed stamp degrades gracefully.
 */
export const syncVehicleLastDetailed = onDocumentUpdated('bookings/{bookingId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === after.status || String(after.status) !== 'completed') return;

  const clientId = String(after.clientId ?? '');
  const vehicleId = String(after.vehicleId ?? '');
  const jobDate = String(after.date ?? '');
  if (!clientId || !vehicleId || !jobDate) return;

  try {
    // update() (not set+merge) so a vehicle deleted from the garage isn't
    // resurrected as a stub doc with only a lastDetailedDate.
    await db
      .collection('clients')
      .doc(clientId)
      .collection('vehicles')
      .doc(vehicleId)
      .update({ lastDetailedDate: jobDate });
  } catch (err) {
    // The vehicle may have been deleted from the garage — nothing to stamp.
    logger.warn(`Could not stamp lastDetailedDate for vehicle ${vehicleId}`, err as Error);
  }
});

/**
 * Creates the Revv invoice the instant a booking completes, server-side.
 *
 * Invoices used to be written only by the detailer's before/after screen, so a
 * detailer who finished a job but never opened that screen left the client with
 * no invoice to view or dispute — while the hold could still auto-release. This
 * guarantees the invoice exists the moment the job is marked complete. Idempotent
 * (skips if the before/after screen already created it); the detailer's screen
 * now attaches after-photos to whichever doc exists.
 */
export const createInvoiceOnCompletion = onDocumentUpdated('bookings/{bookingId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === after.status || String(after.status) !== 'completed') return;

  const bookingId = event.params.bookingId;
  const invoiceRef = db.collection('invoices').doc(bookingId);
  if ((await invoiceRef.get()).exists) return; // already created client-side

  const price = Number(after.price ?? 0);
  const platformFee = Math.round(price * 0.1 * 100) / 100;
  const detailerPayout = Math.round((price - platformFee) * 100) / 100;

  await invoiceRef.set({
    bookingId,
    clientId: String(after.clientId ?? ''),
    detailerId: String(after.detailerId ?? ''),
    clientName: String(after.clientName ?? ''),
    detailerName: String(after.detailerName ?? ''),
    businessName: after.businessName ?? null,
    vehicleLabel: String(after.vehicleLabel ?? ''),
    service: String(after.service ?? ''),
    date: String(after.date ?? ''),
    price,
    platformFee,
    detailerPayout,
    status: 'pending_release',
    afterPhotos: Array.isArray(after.afterPhotos) ? after.afterPhotos : [],
    createdAt: FieldValue.serverTimestamp(),
  });
  logger.info(`Created invoice for completed booking ${bookingId}`);
});
