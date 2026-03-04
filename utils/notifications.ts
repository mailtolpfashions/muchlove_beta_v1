import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/utils/hash';

// Detect Expo Go — push notifications are not available there.
// Check both appOwnership AND executionEnvironment for reliability.
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  (Constants as any).executionEnvironment === 'storeClient';

// Configure how notifications appear when app is in foreground
try {
  if (!isExpoGo) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch {
  // Silently ignore in environments where notifications are unsupported
}

export async function registerForNotifications(): Promise<boolean> {
  if (isExpoGo) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('sales', {
        name: 'Sales Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E91E63',
      });
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get the Expo push token for this device and save it to Supabase.
 * Call this after login when the user is authenticated.
 * The Edge Function uses these tokens to send background push notifications.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (isExpoGo) return;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // Upsert: insert or update if this user+token combo already exists
    // updated_at refreshes on each login so stale tokens can be flushed
    await supabase
      .from('push_tokens')
      .upsert(
        { id: generateId('PTK'), user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );
  } catch {
    // Push token registration failed — non-critical
  }
}

/**
 * Remove all push tokens for this user from Supabase.
 * Call this on logout so the device stops receiving push notifications.
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  if (isExpoGo) return;
  try {
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);
  } catch {
    // Push token removal failed — non-critical
  }
}

export async function sendSaleNotification(
  customerName: string,
  total: number,
  employeeName: string,
) {
  if (isExpoGo) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 New Sale Recorded',
        body: `${employeeName} billed ₹${total.toFixed(2)} to ${customerName}`,
        data: { type: 'sale' },
        sound: 'default',
      },
      trigger: null, // immediate
    });
  } catch {
    // Notification delivery failed — non-critical
  }
}
