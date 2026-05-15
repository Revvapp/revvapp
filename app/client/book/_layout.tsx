import { Stack } from 'expo-router';

export default function BookingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="service" />
      <Stack.Screen name="vehicle" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="confirm" />
    </Stack>
  );
}
