/**
 * Grants (or revokes) the `admin` custom claim on a REVV team account.
 *
 * The claim is the single gate for every admin capability: the `requireAdmin`
 * check on the dispute/claim/verification callables, and the widened Firestore
 * read rules that let the in-app console list open cases. Nothing in the app can
 * grant it — that is the point — so it has to be set out-of-band from here.
 *
 * Usage (from the functions/ directory):
 *   1. Download a service-account key from the Firebase console
 *      (Project settings → Service accounts → Generate new private key).
 *   2. export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
 *   3. npm run set-admin -- admin@revvapp.net          # grant
 *      npm run set-admin -- admin@revvapp.net --revoke # revoke
 *
 * The claim is minted into the ID token at sign-in, so the account must sign out
 * and back in (or wait for the hourly token refresh) before the console appears.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ credential: applicationDefault() });

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith('--'));
  const revoke = args.includes('--revoke');

  if (!email) {
    console.error('Usage: npm run set-admin -- <email> [--revoke]');
    process.exitCode = 1;
    return;
  }

  const auth = getAuth();
  const user = await auth.getUserByEmail(email);

  // Merge rather than replace — clobbering existing claims would silently drop
  // anything else attached to the account.
  const claims = { ...(user.customClaims ?? {}) };
  if (revoke) {
    delete claims.admin;
  } else {
    claims.admin = true;
  }

  await auth.setCustomUserClaims(user.uid, claims);
  // Force existing sessions to pick up the change on their next token refresh.
  await auth.revokeRefreshTokens(user.uid);

  console.log(
    `${revoke ? 'Revoked' : 'Granted'} admin for ${email} (${user.uid}). ` +
      'They must sign out and back in for it to take effect.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
