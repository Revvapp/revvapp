/**
 * One-time backfill: compute every detailer's rating aggregate from the existing
 * reviews collection and write it onto their detailer doc. Run this once after
 * first deploying the aggregateDetailerRating trigger so detailers created before
 * the trigger existed get accurate `rating` / `reviewCount` / `ratingSum` fields.
 *
 * Usage (from the functions/ directory):
 *   1. Download a service-account key from the Firebase console
 *      (Project settings → Service accounts → Generate new private key).
 *   2. export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
 *   3. npm run backfill
 *
 * Safe to re-run — it only overwrites the aggregate fields.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function main(): Promise<void> {
  const reviews = await db.collection('reviews').get();

  const agg: Record<string, { sum: number; count: number }> = {};
  reviews.forEach((doc) => {
    const detailerId = String(doc.data().detailerId ?? '');
    const r = Number(doc.data().rating ?? 0);
    if (!detailerId || !(r > 0)) return;
    agg[detailerId] = agg[detailerId]
      ? { sum: agg[detailerId].sum + r, count: agg[detailerId].count + 1 }
      : { sum: r, count: 1 };
  });

  const entries = Object.entries(agg);
  console.log(`Found reviews for ${entries.length} detailer(s). Writing aggregates...`);

  let batch = db.batch();
  let pending = 0;
  for (const [detailerId, { sum, count }] of entries) {
    const rating = Math.round((sum / count) * 100) / 100;
    batch.set(
      db.collection('detailers').doc(detailerId),
      { rating, reviewCount: count, ratingSum: sum, ratingUpdatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    pending += 1;
    // Firestore batches cap at 500 writes; commit well under that.
    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();

  console.log('Backfill complete.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
