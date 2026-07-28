import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { db } from './admin';

/**
 * Fixed-window per-user rate limit backed by one Firestore doc per action/uid
 * pair. Shared across modules so every money- or review-adjacent callable uses
 * the same throttle instead of each reimplementing it slightly differently.
 */
export async function enforceRateLimit(
  uid: string,
  action: string,
  max: number,
  windowMs: number
): Promise<void> {
  const ref = db.collection('rateLimits').doc(`${action}_${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const startedAt = data?.startedAt as Timestamp | undefined;
    const withinWindow = startedAt && Date.now() - startedAt.toMillis() < windowMs;
    const count = withinWindow ? Number(data?.count ?? 0) : 0;
    if (count >= max) throw new HttpsError('resource-exhausted', 'Too many requests. Try again later.');
    tx.set(ref, {
      uid,
      action,
      count: count + 1,
      startedAt: withinWindow ? startedAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
