import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

import { db } from './admin';

// Server-side push notifications (booking, message, dispute and review events).
export * from './notifications';

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
