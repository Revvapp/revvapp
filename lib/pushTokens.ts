import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

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

/** Look up a recipient's Expo push token. Returns null if unknown. */
export async function getRecipientPushToken(uid: string | null | undefined): Promise<string | null> {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'pushTokens', uid));
    return snap.exists() ? (snap.data().token ?? null) : null;
  } catch {
    return null;
  }
}
