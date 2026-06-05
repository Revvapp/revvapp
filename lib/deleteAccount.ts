import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';

import { auth, db } from '@/firebaseConfig';
import { emailLookupDocId } from '@/lib/emailLookup';

/**
 * Permanently deletes the signed-in user's account: reauthenticates, removes
 * their Firestore data (best-effort), then deletes the Firebase Auth user.
 * Deleting the auth user is what actually closes the account and triggers the
 * sign-out/redirect via the auth state listener.
 *
 * Required for App Store compliance (Guideline 5.1.1(v)).
 */
export async function deleteAccount(password: string, userType: 'client' | 'detailer'): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser?.email) throw new Error('No signed-in user.');
  const uid = currentUser.uid;
  const email = currentUser.email;

  // Reauthentication is required before a destructive auth operation.
  const credential = EmailAuthProvider.credential(email, password);
  await reauthenticateWithCredential(currentUser, credential);

  // Best-effort data cleanup before removing the auth user. If any of these
  // fail we still proceed to delete the account itself.
  try {
    if (userType === 'client') {
      const vehicles = await getDocs(collection(db, 'clients', uid, 'vehicles'));
      await Promise.all(vehicles.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'clients', uid));
    } else {
      await deleteDoc(doc(db, 'detailers', uid));
    }
    await deleteDoc(doc(db, 'users', uid));
    await deleteDoc(doc(db, 'pushTokens', uid));
    await deleteDoc(doc(db, 'emailLookup', emailLookupDocId(email)));
  } catch {
    // Non-fatal — the account deletion below is the operation that matters.
  }

  await deleteUser(currentUser);
}
