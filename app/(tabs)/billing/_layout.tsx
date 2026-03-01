import { Stack } from 'expo-router';
import { BillingProvider } from '@/providers/BillingProvider';

export default function BillingLayout() {
  return (
    <BillingProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="checkout" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
    </BillingProvider>
  );
}
