import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerShadowVisible: true,
        headerTintColor: Colors.headerText,
        headerTitleAlign: 'left',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="customers" options={{ title: 'Customers' }} />
      <Stack.Screen
        name="customer-subscriptions"
        options={{ title: 'Customer Subscriptions' }}
      />
      <Stack.Screen name="staff" options={{ title: 'Staff' }} />
      <Stack.Screen name="offers" options={{ title: 'Offers' }} />
      <Stack.Screen name="combos" options={{ title: 'Combos' }} />
      <Stack.Screen name="payments" options={{ title: 'Payments' }} />
      <Stack.Screen name="inventory" options={{ title: 'Inventory' }} />
      <Stack.Screen name="subscription-plans" options={{ title: 'Subscription Plans' }} />
      <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />
      <Stack.Screen name="attendance" options={{ title: 'My Attendance' }} />
      <Stack.Screen name="attendance-management" options={{ title: 'Attendance Records' }} />
      <Stack.Screen name="leave-approvals" options={{ title: 'Leave & Permission Approvals' }} />
      <Stack.Screen name="salary-management" options={{ title: 'Salary Management' }} />
      <Stack.Screen name="my-salary" options={{ title: 'My Salary' }} />
      <Stack.Screen name="attendance-config" options={{ title: 'Attendance Config' }} />
    </Stack>
  );
}
