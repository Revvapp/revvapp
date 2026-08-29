import {
  collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc,
} from 'firebase/firestore';

import { db } from '@/firebaseConfig';

/**
 * Blocking, as required for user-generated content (App Store guideline 1.2).
 *
 * A block lives at `blocks/{blockerUid}/blocked/{blockedUid}` and is readable
 * and writable only by the blocker. It is deliberately one-directional and
 * invisible to the person blocked: Firestore rules stop them posting into a
 * shared thread, but nothing tells them why, because "you have been blocked" is
 * itself an invitation to retaliate off-platform.
 */

export type BlockedAccount = { uid: string; name: string; blockedAt: Date | null };

/** Block `uid`. Idempotent — blocking twice is a no-op, not an error. */
export async function blockUser(myUid: string, uid: string, name: string): Promise<void> {
  if (!myUid || !uid || myUid === uid) return;
  await setDoc(doc(db, 'blocks', myUid, 'blocked', uid), {
    name: name || '',
    createdAt: serverTimestamp(),
  });
}

/** Lift a block. Also idempotent. */
export async function unblockUser(myUid: string, uid: string): Promise<void> {
  if (!myUid || !uid) return;
  await deleteDoc(doc(db, 'blocks', myUid, 'blocked', uid));
}

/** Everyone the signed-in user has blocked, newest first. */
export async function listBlocked(myUid: string): Promise<BlockedAccount[]> {
  if (!myUid) return [];
  const snap = await getDocs(collection(db, 'blocks', myUid, 'blocked'));
  return snap.docs
    .map((d) => ({
      uid: d.id,
      name: String(d.data().name ?? ''),
      blockedAt: d.data().createdAt?.toDate?.() ?? null,
    }))
    .sort((a, b) => (b.blockedAt?.getTime() ?? 0) - (a.blockedAt?.getTime() ?? 0));
}

/** Just the ids, for filtering lists client-side. */
export async function blockedIds(myUid: string): Promise<Set<string>> {
  return new Set((await listBlocked(myUid)).map((b) => b.uid));
}
