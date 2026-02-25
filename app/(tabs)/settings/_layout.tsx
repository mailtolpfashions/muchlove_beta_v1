import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { HeaderRight } from '@/components/HeaderRight';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleAlign: 'left',
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Settings', headerRight: () => <HeaderRight /> }}
      />
      <Stack.Screen name="customers" options={{ title: 'Customers' }} />
      <Stack.Screen
        name="customer-subscriptions"
        options={{ title: 'Customer Subscriptions' }}
      />
      <Stack.Screen name="staff" options={{ title: 'Staff' }} />
      <Stack.Screen name="offers" options={{ title: 'Offers' }} />
      <Stack.Screen name="payments" options={{ title: 'Payments' }} />
      <Stack.Screen name="inventory" options={{ title: 'Inventory' }} />
      <Stack.Screen name="subscription-plans" options={{ title: 'Subscription Plans' }} />
    </Stack>
  );
}
