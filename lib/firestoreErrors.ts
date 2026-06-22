// Maps Firestore SDK errors to friendly, user-facing strings.
//
// In development we surface the raw message so engineers still see useful
// detail — most importantly the "create index" link Firestore returns for a
// `failed-precondition` (missing composite index). In production builds users
// get a calm, human message instead of a wall of technical text.
//
// Mirrors the shape of mapAuthError in ./authErrors.ts.
export function mapFirestoreError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: string }).code);
    switch (code) {
      case 'failed-precondition':
        // Almost always a missing composite index while a query is new.
        return __DEV__
          ? `Query needs a Firestore index. ${(err as { message?: string }).message ?? ''}`
          : "We're getting things ready — please try again in a moment.";
      case 'permission-denied':
        return "You don't have access to this data.";
      case 'unauthenticated':
        return 'Your session expired. Please sign in again.';
      case 'unavailable':
      case 'deadline-exceeded':
        return 'Network issue. Check your connection and try again.';
      case 'resource-exhausted':
        return 'The service is busy right now. Please try again shortly.';
      case 'cancelled':
        return 'Request was cancelled. Please try again.';
      case 'not-found':
        return "We couldn't find what you were looking for.";
      default:
        break;
    }
  }
  if (__DEV__ && err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
