import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

import { auth } from '@/firebaseConfig';
import { deleteMyAccount } from '@/lib/payments';

/**
 * Permanently deletes the signed-in user's account: reauthenticates, removes
 * their Firestore data (best-effort), then deletes the Firebase Auth user.
 * Deleting the auth user is what actually closes the account and triggers the
 * sign-out/redirect via the auth state listener.
 *
 * Required for App Store compliance (Guideline 5.1.1(v)).
 */
export async function deleteAccount(password: string, _userType: 'client' | 'detailer'): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser?.email) throw new Error('No signed-in user.');
  const email = currentUser.email;

  // Reauthentication is required before a destructive auth operation.
  const credential = EmailAuthProvider.credential(email, password);
  await reauthenticateWithCredential(currentUser, credential);

  // The callable verifies the token's recent auth_time, performs authoritative
  // cleanup with the Admin SDK, then deletes the Auth identity.
  await deleteMyAccount();
}
