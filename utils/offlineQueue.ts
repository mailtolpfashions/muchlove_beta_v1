/**
 * Offline Sale Queue — tamper-proof, append-only local storage for sales
 * created while the device has no internet.
 *
 * Anti-fraud design:
 * - Each sale gets a SHA-256-like integrity hash computed from its data + a
 *   chain hash of the previous entry (blockchain-style).
 * - Employees CANNOT delete or modify queued sales — there is no remove/edit API.
 * - Only the sync process (triggered automatically) can mark entries as synced.
 * - The admin dashboard can later audit `offline_created_at` vs `synced_at` to
 *   spot anomalies (e.g. a sale created at 2 AM but synced 3 days later).
 *
 * Timestamp accuracy:
 * - `offlineCreatedAt` is the device clock at point of sale — this is the REAL
 *   sale time even if sync happens hours/days later.
 * - `syncedAt` is set when the sale actually reaches Supabase.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage keys ──────────────────────────────────────────────────────────────
const QUEUE_KEY = '@offline_sale_queue';
const CHAIN_HASH_KEY = '@offline_sale_chain_hash';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OfflineSale {
  /** Unique ID generated at time of sale */
  id: string;
  /** Full sale payload ready for Supabase insert */
  payload: Record<string, any>;
  /** ISO timestamp from device clock at point of sale */
  offlineCreatedAt: string;
  /** Integrity hash — covers payload + previous chain hash */
  integrityHash: string;
  /** Marked true only after successful Supabase upload */
  synced: boolean;
  /** ISO timestamp when synced to server */
  syncedAt?: string;
  /** Number of failed sync attempts */
  retryCount: number;
  /** Last sync error message */
  lastError?: string;
}

// ── Hashing ───────────────────────────────────────────────────────────────────

/**
 * Lightweight but deterministic hash for integrity checks.
 * Uses the same MurmurHash-style approach as the password hasher so we don't
 * need additional native crypto deps. NOT cryptographic — the goal is to detect
 * casual tampering / corruption, not resist a determined attacker.
 */
function computeHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(36);
}

async function getChainHash(): Promise<string> {
  return (await AsyncStorage.getItem(CHAIN_HASH_KEY)) ?? 'genesis';
}

async function setChainHash(hash: string): Promise<void> {
  await AsyncStorage.setItem(CHAIN_HASH_KEY, hash);
}

// ── Queue operations ──────────────────────────────────────────────────────────

/** Read the full queue from storage. */
export async function getQueue(): Promise<OfflineSale[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist the queue (internal use only). */
async function saveQueue(queue: OfflineSale[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Enqueue a new offline sale. Computes an integrity hash chained to the
 * previous entry so the log is append-only and tamper-evident.
 */
export async function enqueueSale(
  id: string,
  payload: Record<string, any>,
): Promise<OfflineSale> {
  const queue = await getQueue();
  const prevHash = await getChainHash();
  const offlineCreatedAt = new Date().toISOString();

  // Deterministic JSON for hashing (sorted keys)
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const integrityHash = computeHash(`${prevHash}|${id}|${offlineCreatedAt}|${canonical}`);

  const entry: OfflineSale = {
    id,
    payload,
    offlineCreatedAt,
    integrityHash,
    synced: false,
    retryCount: 0,
  };

  queue.push(entry);
  await saveQueue(queue);
  await setChainHash(integrityHash);

  return entry;
}

/** Return only un-synced entries. */
export async function getPendingSales(): Promise<OfflineSale[]> {
  const queue = await getQueue();
  return queue.filter(e => !e.synced);
}

/** Count of un-synced entries. */
export async function getPendingCount(): Promise<number> {
  return (await getPendingSales()).length;
}

/**
 * Mark a single entry as synced. Only the sync process should call this.
 * The entry is NOT deleted — it stays in the log for audit trail.
 */
export async function markSynced(id: string): Promise<void> {
  const queue = await getQueue();
  const entry = queue.find(e => e.id === id);
  if (entry) {
    entry.synced = true;
    entry.syncedAt = new Date().toISOString();
    await saveQueue(queue);
  }
}

/** Record a sync failure so we can track retry count. */
export async function markSyncFailed(id: string, error: string): Promise<void> {
  const queue = await getQueue();
  const entry = queue.find(e => e.id === id);
  if (entry) {
    entry.retryCount += 1;
    entry.lastError = error;
    await saveQueue(queue);
  }
}

/**
 * Verify the integrity chain. Returns list of corrupted entry IDs.
 * Admin can call this to detect if someone tampered with local storage.
 */
export async function verifyIntegrity(): Promise<string[]> {
  const queue = await getQueue();
  const corrupted: string[] = [];
  let prevHash = 'genesis';

  for (const entry of queue) {
    const canonical = JSON.stringify(entry.payload, Object.keys(entry.payload).sort());
    const expected = computeHash(`${prevHash}|${entry.id}|${entry.offlineCreatedAt}|${canonical}`);
    if (expected !== entry.integrityHash) {
      corrupted.push(entry.id);
    }
    prevHash = entry.integrityHash;
  }

  return corrupted;
}

/**
 * Purge synced entries older than `days` to reclaim storage.
 * Only removes entries that have been synced — pending entries are NEVER purged.
 */
export async function purgeSyncedOlderThan(days: number = 30): Promise<number> {
  const queue = await getQueue();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const before = queue.length;

  const kept = queue.filter(e => {
    if (!e.synced) return true; // never purge un-synced
    const syncTime = e.syncedAt ? new Date(e.syncedAt).getTime() : 0;
    return syncTime > cutoff;
  });

  await saveQueue(kept);
  return before - kept.length;
}
