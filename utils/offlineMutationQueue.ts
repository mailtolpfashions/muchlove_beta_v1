/**
 * Generic Offline Mutation Queue — queues any CRUD operation when offline
 * and replays it when connectivity returns.
 *
 * Supports: customers, services, subscriptions, offers, combos, customerSubscriptions
 * Operations: add, update, delete
 *
 * Unlike the sale queue (which is tamper-proof/blockchain-hashed), this queue
 * uses a simpler design since these are admin-only operations.
 *
 * Conflict resolution: last-write-wins with `updatedAt` timestamps.
 * If a server record was modified after the offline mutation was created,
 * the sync process will detect the conflict and keep the server version
 * (since someone else already updated it while we were offline).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage key ───────────────────────────────────────────────────────────────
const MUTATION_QUEUE_KEY = '@offline_mutation_queue';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MutationEntity =
  | 'customers'
  | 'services'
  | 'subscriptions'
  | 'offers'
  | 'combos'
  | 'customerSubscriptions';

export type MutationOperation = 'add' | 'update' | 'delete';

export interface OfflineMutation {
  /** Unique ID for this queue entry */
  id: string;
  /** Which entity table this mutation targets */
  entity: MutationEntity;
  /** The CRUD operation */
  operation: MutationOperation;
  /** The entity ID being mutated (for update/delete) or the new ID (for add) */
  entityId: string;
  /** Full payload for add/update; undefined for delete */
  payload?: Record<string, any>;
  /** ISO timestamp when the mutation was created (device clock) */
  createdAt: string;
  /** Whether this mutation has been synced to the server */
  synced: boolean;
  /** ISO timestamp when synced */
  syncedAt?: string;
  /** Number of failed sync attempts */
  retryCount: number;
  /** Last error message */
  lastError?: string;
  /** Conflict status: 'none' | 'resolved-server' | 'resolved-local' */
  conflictResolution?: 'none' | 'resolved-server' | 'resolved-local';
}

// ── Queue operations ──────────────────────────────────────────────────────────

/** Read the full mutation queue from storage */
export async function getMutationQueue(): Promise<OfflineMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(MUTATION_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist the queue (internal) */
async function saveMutationQueue(queue: OfflineMutation[]): Promise<void> {
  await AsyncStorage.setItem(MUTATION_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Enqueue a new offline mutation.
 * For sequential operations on the same entity/id, later operations
 * supersede earlier ones (e.g. add then update → only latest update matters).
 */
export async function enqueueMutation(
  id: string,
  entity: MutationEntity,
  operation: MutationOperation,
  entityId: string,
  payload?: Record<string, any>,
): Promise<OfflineMutation> {
  const queue = await getMutationQueue();

  // Optimization: if there's an unsynced 'add' for the same entityId and we're
  // now doing an 'update', merge the update into the add payload.
  // If we're doing a 'delete' after an 'add', remove the add entirely.
  if (operation === 'update') {
    const existingAdd = queue.find(
      m => !m.synced && m.entity === entity && m.entityId === entityId && m.operation === 'add'
    );
    if (existingAdd && payload) {
      // Merge update into the original add payload
      existingAdd.payload = { ...existingAdd.payload, ...payload };
      existingAdd.createdAt = new Date().toISOString();
      await saveMutationQueue(queue);
      return existingAdd;
    }

    // If there's an existing unsynced update for the same entity, replace it
    const existingUpdate = queue.find(
      m => !m.synced && m.entity === entity && m.entityId === entityId && m.operation === 'update'
    );
    if (existingUpdate && payload) {
      existingUpdate.payload = { ...existingUpdate.payload, ...payload };
      existingUpdate.createdAt = new Date().toISOString();
      await saveMutationQueue(queue);
      return existingUpdate;
    }
  }

  if (operation === 'delete') {
    const existingAddIdx = queue.findIndex(
      m => !m.synced && m.entity === entity && m.entityId === entityId && m.operation === 'add'
    );
    if (existingAddIdx !== -1) {
      // The entity was created offline and never synced — just remove the add
      queue.splice(existingAddIdx, 1);
      // Also remove any updates for it
      const filtered = queue.filter(
        m => !(m.entity === entity && m.entityId === entityId && !m.synced)
      );
      await saveMutationQueue(filtered);
      // Return a synthetic entry marked as already synced (nothing to do)
      return {
        id, entity, operation, entityId, createdAt: new Date().toISOString(),
        synced: true, syncedAt: new Date().toISOString(), retryCount: 0,
        conflictResolution: 'none',
      };
    }
  }

  const entry: OfflineMutation = {
    id,
    entity,
    operation,
    entityId,
    payload,
    createdAt: new Date().toISOString(),
    synced: false,
    retryCount: 0,
    conflictResolution: 'none',
  };

  queue.push(entry);
  await saveMutationQueue(queue);
  return entry;
}

/** Return only un-synced mutations */
export async function getPendingMutations(): Promise<OfflineMutation[]> {
  const queue = await getMutationQueue();
  return queue.filter(e => !e.synced);
}

/** Count of un-synced mutations */
export async function getPendingMutationCount(): Promise<number> {
  return (await getPendingMutations()).length;
}

/** Mark a mutation as synced */
export async function markMutationSynced(
  id: string,
  resolution: 'none' | 'resolved-server' | 'resolved-local' = 'none',
): Promise<void> {
  const queue = await getMutationQueue();
  const entry = queue.find(e => e.id === id);
  if (entry) {
    entry.synced = true;
    entry.syncedAt = new Date().toISOString();
    entry.conflictResolution = resolution;
    await saveMutationQueue(queue);
  }
}

/** Record a sync failure */
export async function markMutationFailed(id: string, error: string): Promise<void> {
  const queue = await getMutationQueue();
  const entry = queue.find(e => e.id === id);
  if (entry) {
    entry.retryCount += 1;
    entry.lastError = error;
    await saveMutationQueue(queue);
  }
}

/** Get all pending entity IDs for a specific entity type (for UI indicators) */
export async function getPendingEntityIds(entity: MutationEntity): Promise<Set<string>> {
  const pending = await getPendingMutations();
  return new Set(
    pending.filter(m => m.entity === entity).map(m => m.entityId)
  );
}

/** Get the operation type for a pending entity (for UI: 'add' shows "New", 'update' shows "Modified") */
export async function getPendingOperations(
  entity: MutationEntity,
): Promise<Map<string, MutationOperation>> {
  const pending = await getPendingMutations();
  const ops = new Map<string, MutationOperation>();
  for (const m of pending) {
    if (m.entity === entity) {
      ops.set(m.entityId, m.operation);
    }
  }
  return ops;
}

/** Purge synced mutations older than N days */
export async function purgeSyncedMutations(days: number = 7): Promise<number> {
  const queue = await getMutationQueue();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const before = queue.length;
  const kept = queue.filter(e => {
    if (!e.synced) return true;
    const syncTime = e.syncedAt ? new Date(e.syncedAt).getTime() : 0;
    return syncTime > cutoff;
  });
  await saveMutationQueue(kept);
  return before - kept.length;
}
