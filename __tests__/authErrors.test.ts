import { mapAuthError } from '@/lib/authErrors';

describe('mapAuthError', () => {
  it('maps known Firebase auth codes to friendly copy', () => {
    expect(mapAuthError({ code: 'auth/invalid-email' })).toBe('Enter a valid email address.');
    expect(mapAuthError({ code: 'auth/email-already-in-use' })).toContain('already registered');
    expect(mapAuthError({ code: 'auth/wrong-password' })).toBe('Incorrect email or password.');
    expect(mapAuthError({ code: 'auth/invalid-credential' })).toBe('Incorrect email or password.');
  });

  it('falls back to the Error message for unmapped Errors', () => {
    expect(mapAuthError(new Error('boom'))).toBe('boom');
  });

  it('returns a generic message for non-Error, non-coded values', () => {
    expect(mapAuthError('weird')).toBe('Something went wrong. Please try again.');
  });
});
