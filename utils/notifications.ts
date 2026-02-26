import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

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
  if (isExpoGo) return false;
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
