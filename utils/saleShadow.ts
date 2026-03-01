/**
 * Sale Shadow — sends a minimal sale record to the server instantly for
 * fraud detection. If the HTTP call fails (offline), queues the shadow
 * in AsyncStorage and retries every 10 seconds.
 *
 * The server uses shadows to detect:
 * - Reinstall with unsynced sales (evidence destruction)
 * - Shadow mismatch (sale shadow exists but full sale never synced)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { getInstallId } from '@/utils/deviceId';

const SHADOW_QUEUE_KEY = '@sale_shadow_queue';
const RETRY_INTERVAL = 10 * 1000; // 10 seconds

let retryTimer: ReturnType<typeof setInterval> | null = null;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaleShadow {
  id: string;
  sale_id: string;
  user_id: string;
  amount: number;
  payment_method: 'cash' | 'gpay';
  install_id: string;
  created_at: string;
}

// ── Queue operations ──────────────────────────────────────────────────────────

async function getQueue(): Promise<SaleShadow[]> {
  try {
    const raw = await AsyncStorage.getItem(SHADOW_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: SaleShadow[]): Promise<void> {
  await AsyncStorage.setItem(SHADOW_QUEUE_KEY, JSON.stringify(queue));
}

/** Get count of pending (unsent) shadows */
export async function getPendingShadowCount(): Promise<number> {
  return (await getQueue()).length;
}

// ── Send shadow ───────────────────────────────────────────────────────────────

/**
 * Send a sale shadow to the server immediately.
 * If it fails, queue it for retry.
 * This is fire-and-forget — never blocks the sale flow.
 */
export async function sendSaleShadow(
  saleId: string,
  userId: string,
  amount: number,
  paymentMethod: 'cash' | 'gpay',
): Promise<void> {
  const installId = await getInstallId();
  const shadow: SaleShadow = {
    id: `shadow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sale_id: saleId,
    user_id: userId,
    amount,
    payment_method: paymentMethod,
    install_id: installId,
    created_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from('sale_shadows').insert(shadow);
    if (error) throw error;
    // Shadow sent successfully — no need to queue
  } catch {
    // Failed (likely offline) — queue for retry
    const queue = await getQueue();
    queue.push(shadow);
    await saveQueue(queue);
  }
}

// ── Retry loop ────────────────────────────────────────────────────────────────

/** Attempt to sync all queued shadows */
export async function flushShadowQueue(): Promise<void> {
  const queue = await getQueue();
  if (queue.length === 0) return;

  const remaining: SaleShadow[] = [];

  for (const shadow of queue) {
    try {
      const { error } = await supabase.from('sale_shadows').insert(shadow);
      if (error) {
        // If it's a duplicate (already sent), skip it
        if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
          continue;
        }
        throw error;
      }
      // Sent successfully — don't add to remaining
    } catch {
      remaining.push(shadow);
    }
  }

  await saveQueue(remaining);
}

/** Start the 10-second retry loop. Safe to call multiple times. */
export function startShadowRetry(): void {
  stopShadowRetry();

  // Flush immediately on start
  flushShadowQueue();

  retryTimer = setInterval(() => {
    flushShadowQueue();
  }, RETRY_INTERVAL);
}

/** Stop the retry loop. */
export function stopShadowRetry(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

/**
 * Reconcile shadows with sales already on the server.
 * Marks any shadow as synced if its sale_id exists in the sales table.
 * This prevents false fraud alerts from timing gaps.
 */
export async function reconcileShadows(): Promise<void> {
  try {
    // Find unsynced shadows
    const { data: unsynced } = await supabase
      .from('sale_shadows')
      .select('id, sale_id')
      .eq('full_sale_synced', false)
      .limit(100);

    if (!unsynced || unsynced.length === 0) return;

    // Check which of those sale_ids actually exist in the sales table
    const saleIds = unsynced.map(s => s.sale_id);
    const { data: existingSales } = await supabase
      .from('sales')
      .select('id')
      .in('id', saleIds);

    if (!existingSales || existingSales.length === 0) return;

    const existingIds = new Set(existingSales.map(s => s.id));
    const shadowIdsToMark = unsynced
      .filter(s => existingIds.has(s.sale_id))
      .map(s => s.id);

    if (shadowIdsToMark.length > 0) {
      await supabase
        .from('sale_shadows')
        .update({ full_sale_synced: true })
        .in('id', shadowIdsToMark);
    }
  } catch {
    // Best effort — don't break anything
  }
}
