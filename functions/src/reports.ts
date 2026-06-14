import { logger } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

/**
 * Surfaces new trust & safety reports in Cloud Logging so the team has a paper
 * trail — and a single hook to later add email/Slack alerts or auto-flagging of
 * accounts with repeat reports — without needing an admin UI yet.
 *
 * Logged at `warn` so off-platform reports (the revenue-relevant ones) stand out
 * in `firebase functions:log`. The free-text description is intentionally NOT
 * logged: it can contain PII, and it lives in Firestore for the team to read.
 */
export const onReportCreated = onDocumentCreated('reports/{reportId}', async (event) => {
  const r = event.data?.data();
  if (!r) return;

  logger.warn('Trust & safety report filed', {
    reportId: event.params.reportId,
    bookingId: r.bookingId ?? null,
    category: r.category ?? null,
    reporterRole: r.reporterRole ?? null,
    reporterId: r.reporterId ?? null,
    reportedUserId: r.reportedUserId ?? null,
  });
});
