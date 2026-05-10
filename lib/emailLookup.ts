import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '@/firebaseConfig';
import type { UserType } from '@/types/firestore';

/** Normalized Firestore document id for `emailLookup/{id}`. */
export function emailLookupDocId(email: string): string {
  return email.trim().toLowerCase();
}

/** Call after successful signup so guests can resolve account type on email-already-in-use. */
export async function setEmailLookup(email: string, uid: string, userType: UserType): Promise<void> {
  try {
    const id = emailLookupDocId(email);
    await setDoc(doc(db, 'emailLookup', id), {
      uid,
      userType,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal: signup still succeeded
  }
}

export async function getUserTypeFromEmailLookup(email: string): Promise<UserType | null> {
  try {
    const id = emailLookupDocId(email);
    const snap = await getDoc(doc(db, 'emailLookup', id));
    if (!snap.exists()) return null;
    const t = snap.data().userType;
    return t === 'detailer' || t === 'client' ? t : null;
  } catch {
    return null;
  }
}
