/**
 * Device Install ID — generates a unique UUID on first launch and persists it
 * in AsyncStorage. On reinstall or clear data, a new ID is generated.
 * This lets the server detect reinstalls/data clears for fraud detection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALL_ID_KEY = '@install_id';

let cachedInstallId: string | null = null;

/** Generate a UUID v4 without native crypto deps */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the current install ID. Creates one on first call.
 * Cached in memory after first read for performance.
 */
export async function getInstallId(): Promise<string> {
  if (cachedInstallId) return cachedInstallId;

  try {
    const stored = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (stored) {
      cachedInstallId = stored;
      return stored;
    }
  } catch {
    // AsyncStorage read failed — generate new
  }

  const newId = uuid();
  cachedInstallId = newId;

  try {
    await AsyncStorage.setItem(INSTALL_ID_KEY, newId);
  } catch {
    // Best effort — if storage fails, in-memory ID still works for this session
  }

  return newId;
}
