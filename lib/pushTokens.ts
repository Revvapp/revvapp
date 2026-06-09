import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '@/firebaseConfig';

/**
 * Push tokens live in their own `pushTokens/{uid}` collection rather than on the
 * client/detailer profile docs. Profile docs hold PII and are only readable by
 * their owner, so a detailer could never read a client's token to notify them.
 * This collection is readable by any signed-in user (a token is not sensitive)
 * and writable only by its owner — see firebase/securityRules.txt.
 */

export async function savePushToken(uid: string, token: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'pushTokens', uid),
      { token, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch {
    // Best-effort — never block on token persistence.
  }
}

// Recipient-token lookups now happen server-side (functions/src/notifications.ts),
// where the Admin SDK reads pushTokens/{uid} to send the notification. The app
// only writes its own token here; it never reads another user's.
