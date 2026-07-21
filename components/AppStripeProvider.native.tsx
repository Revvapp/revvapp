import { StripeProvider } from '@stripe/stripe-react-native';
import type { ReactElement } from 'react';

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export function AppStripeProvider({ children }: { children: ReactElement | ReactElement[] }) {
  return (
    <StripeProvider publishableKey={publishableKey} urlScheme="revvapp">
      {children}
    </StripeProvider>
  );
}
