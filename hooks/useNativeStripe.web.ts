export function useNativeStripe() {
  return {
    initPaymentSheet: async (_options?: unknown) => ({ error: { message: 'Card payments are available in the Revv mobile app.' } }),
    presentPaymentSheet: async () => ({ error: { code: 'Unsupported', message: 'Card payments are available in the Revv mobile app.' } }),
  };
}
