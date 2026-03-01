/**
 * Heartbeat — sends a periodic ping to Supabase every 5 minutes with:
 *   - user_id, install_id
 *   - pending sale count, pending mutation count
 *   - app version
 *
 * Best-effort: silently fails if offline (no queue needed).
 * Also triggers server-side shadow mismatch detection on each heartbeat.
 */

import { supabase } from '@/lib/supabase';
import { getInstallId } from '@/utils/deviceId';
import { getPendingCount } from '@/utils/offlineQueue';
import { getPendingMutationCount } from '@/utils/offlineMutationQueue';
import { reconcileShadows } from '@/utils/saleShadow';

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const APP_VERSION = '1.1.5';

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/** Generate a simple unique ID for the heartbeat row */
function hbId(): string {
  return `hb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Send a single heartbeat ping */
async function sendHeartbeat(userId: string): Promise<void> {
  try {
    // Reconcile shadows before heartbeat so detect_reinstall sees correct state.
    // This marks shadows as synced when their sale already exists in the sales table,
    // preventing false-positive fraud detection on reinstall.
    try {
      await reconcileShadows();
    } catch { /* best effort */ }

    const [installId, pendingSales, pendingMutations] = await Promise.all([
      getInstallId(),
      getPendingCount(),
      getPendingMutationCount(),
    ]);

    await supabase.from('device_heartbeats').insert({
      id: hbId(),
      user_id: userId,
      install_id: installId,
      pending_sale_count: pendingSales,
      pending_mutation_count: pendingMutations,
      app_version: APP_VERSION,
    });

    // Also trigger server-side shadow mismatch check (best-effort)
    try {
      await supabase.rpc('detect_shadow_mismatch');
    } catch {
      // RPC may not exist yet or may fail — that's fine
    }
  } catch {
    // Best-effort — silently ignore errors (likely offline)
  }
}

/** Start the heartbeat interval. Safe to call multiple times. */
export function startHeartbeat(userId: string): void {
  stopHeartbeat();

  // Send immediately on start
  sendHeartbeat(userId);

  heartbeatTimer = setInterval(() => {
    sendHeartbeat(userId);
  }, HEARTBEAT_INTERVAL);
}

/** Stop the heartbeat interval. */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
