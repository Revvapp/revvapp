import { router } from 'expo-router';

import { navigateAfterAuth } from '@/lib/routing';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const replace = router.replace as jest.Mock;

/**
 * Post-auth routing decides where a user lands every single launch. Sending a
 * half-onboarded detailer to the dashboard strands them on a screen with no
 * profile; sending a finished one back to onboarding makes the app look broken.
 */
describe('navigateAfterAuth', () => {
  beforeEach(() => replace.mockClear());

  it('sends a signed-out user to the root', () => {
    navigateAfterAuth(null);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('sends an onboarded detailer to the detailer dashboard', () => {
    navigateAfterAuth({ userType: 'detailer', onboardingComplete: true } as never);
    expect(replace).toHaveBeenCalledWith('/detailer/dashboard');
  });

  it('sends an unfinished detailer back into onboarding', () => {
    navigateAfterAuth({ userType: 'detailer', onboardingComplete: false } as never);
    expect(replace).toHaveBeenCalledWith('/detailer/onboarding/welcome');
  });

  it('sends an onboarded client to the client dashboard', () => {
    navigateAfterAuth({ userType: 'client', onboardingComplete: true } as never);
    expect(replace).toHaveBeenCalledWith('/client/dashboard');
  });

  it('sends an unfinished client back into onboarding', () => {
    navigateAfterAuth({ userType: 'client', onboardingComplete: false } as never);
    expect(replace).toHaveBeenCalledWith('/client/onboarding');
  });

  it('treats a missing onboardingComplete flag as not finished', () => {
    // Accounts created before the flag existed must not skip onboarding.
    navigateAfterAuth({ userType: 'detailer' } as never);
    expect(replace).toHaveBeenCalledWith('/detailer/onboarding/welcome');
  });

  it('requires the flag to be exactly true, not merely truthy', () => {
    navigateAfterAuth({ userType: 'client', onboardingComplete: 'yes' } as never);
    expect(replace).toHaveBeenCalledWith('/client/onboarding');
  });

  it('defaults an unknown or missing role to the client path', () => {
    // A detailer must never be reached by accident; client is the safe default.
    navigateAfterAuth({ onboardingComplete: true } as never);
    expect(replace).toHaveBeenCalledWith('/client/dashboard');
  });

  it('navigates exactly once per call', () => {
    navigateAfterAuth({ userType: 'detailer', onboardingComplete: true } as never);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
