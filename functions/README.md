# Revv Cloud Functions

Server-side logic that runs on Firebase. Currently this maintains each detailer's
aggregate rating so the apps can read one number instead of scanning the whole
`reviews` collection.

## What's here

- **`aggregateDetailerRating`** (`src/index.ts`) — a Firestore trigger on
  `reviews/{reviewId}`. On every review create/update/delete it recomputes the
  detailer's average rating and count and writes `rating`, `reviewCount` and
  `ratingSum` onto `detailers/{detailerId}`.
- **`scripts/backfillRatings.ts`** — a one-time script to populate those fields
  for reviews that already existed before the trigger was deployed.

## Prerequisites

- The Firebase project must be on the **Blaze (pay-as-you-go)** plan — Cloud
  Functions require it. Aggregating ratings stays comfortably inside the free
  monthly quota at normal volume.
- Firebase CLI: `npm install -g firebase-tools` then `firebase login`.

## Deploy

```bash
cd functions
npm install
firebase use <your-project-id>     # the value of EXPO_PUBLIC_FIREBASE_PROJECT_ID
npm run deploy                      # = firebase deploy --only functions
```

## Backfill existing reviews (run once, after the first deploy)

```bash
cd functions
# 1. Firebase console → Project settings → Service accounts → Generate new private key
# 2. point Google credentials at the downloaded file:
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
npm run backfill
```

Safe to re-run; it only overwrites the aggregate fields. Keep the key out of git
(`.gitignore` already excludes `service-account*.json`).

## Optional: simplify the client after deploying

Once the trigger is live and the backfill has run, `detailers/{uid}.rating` and
`.reviewCount` are always accurate, so the apps can read them directly instead of
querying reviews:

- `hooks/useFindDetailers.ts` — drop the batched reviews queries and just use
  `d.rating` / `d.reviewCount` straight off each detailer doc.
- `app/client/detailer/[id].tsx` and `app/detailer/(tabs)/profile.tsx` — keep
  fetching reviews for the visible review **list**, but you can source the headline
  rating/count from the detailer doc.

This is optional — the current client computes ratings correctly on its own; the
trigger just makes those reads O(1) at scale.
