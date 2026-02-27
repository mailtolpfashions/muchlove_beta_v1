import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/utils/hash';

// expo-notifications remote features are unavailable in Expo Go (SDK 53+).
// Detect Expo Go so we can silently skip notification calls.
const isExpoGo = Constants.appOwnership === 'expo';

// Configure how notifications appear when app is in foreground
try {
  if (!isExpoGo) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
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
  if (isExpoGo) {
    console.warn('[Push] Running in Expo Go — notifications not supported');
    return false;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('sales', {
        name: 'Sales Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E91E63',
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to register for notifications:', error);
    return false;
  }
}

/**
 * Get the Expo push token for this device and save it to Supabase.
 * Call this after login when the user is authenticated.
 * The Edge Function uses these tokens to send background push notifications.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (isExpoGo) {
    console.warn('[Push] Running in Expo Go — push token registration skipped');
    return;
  }
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[Push] No EAS projectId found, skipping push token registration');
      return;
    }

    console.log('[Push] Requesting push token with projectId:', projectId);
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data; // e.g. "ExponentPushToken[xxxx]"
    console.log('[Push] Got token:', token);

    // Upsert: insert or update if this user+token combo already exists
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        { id: generateId(), user_id: userId, token },
        { onConflict: 'user_id,token' }
      );

    if (error) {
      console.error('[Push] Failed to save push token:', error.message);
    } else {
      console.log('[Push] Token saved to push_tokens table successfully');
    }
  } catch (error) {
    console.error('[Push] Failed to register push token:', error);
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
  } catch (error) {
    console.error('Failed to remove push token:', error);
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
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}
