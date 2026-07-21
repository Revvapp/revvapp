import type { PropsWithChildren } from 'react';

// PaymentSheet is native-only. Keeping the web tree free of the native Stripe
// package allows Expo static rendering and makes the unsupported boundary clear.
export function AppStripeProvider({ children }: PropsWithChildren) {
  return children;
}
