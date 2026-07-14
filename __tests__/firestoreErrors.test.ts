import { mapFirestoreError } from '@/lib/firestoreErrors';

// jest-expo sets __DEV__ = true, so the dev branches are exercised here.
describe('mapFirestoreError', () => {
  it('maps permission-denied regardless of environment', () => {
    expect(mapFirestoreError({ code: 'permission-denied' })).toBe(
      "You don't have access to this data."
    );
  });

  it('maps unauthenticated to a re-auth prompt', () => {
    expect(mapFirestoreError({ code: 'unauthenticated' })).toBe(
      'Your session expired. Please sign in again.'
    );
  });

  it('maps network-ish codes to a connection message', () => {
    expect(mapFirestoreError({ code: 'unavailable' })).toContain('Network');
    expect(mapFirestoreError({ code: 'deadline-exceeded' })).toContain('Network');
  });

  it('surfaces the raw index detail for failed-precondition in dev', () => {
    const msg = mapFirestoreError({
      code: 'failed-precondition',
      message: 'The query requires an index',
    });
    expect(msg).toContain('index');
  });

  it('returns a generic message for a plain unknown value', () => {
    expect(mapFirestoreError('nope')).toBe('Something went wrong. Please try again.');
  });
});
