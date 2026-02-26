/**
 * OfflineSyncProvider — watches network state and automatically syncs queued
 * offline sales to Supabase when connectivity returns.
 *
 * Features:
 * - Auto-sync on reconnect (with debounce to avoid hammering)
 * - Exposes `pendingCount`, `isSyncing`, `lastSyncResult` to the UI
 * - `isOffline` flag for showing offline banners
 * - Manual `syncNow()` for pull-to-refresh-style triggers
 * - Integrity verification on each sync cycle
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';

import { supabase } from '@/lib/supabase';
import { generateId } from '@/utils/hash';
import {
  getPendingSales,
  getPendingCount,
  markSynced,
  markSyncFailed,
  verifyIntegrity,
  purgeSyncedOlderThan,
  OfflineSale,
} from '@/utils/offlineQueue';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
  corruptedIds: string[];
  timestamp: string;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const [OfflineSyncProvider, useOfflineSync] = createContextHook(() => {
  const netInfo = useNetInfo();
  const queryClient = useQueryClient();

  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const syncLock = useRef(false);

  const isOffline = netInfo.isConnected === false;

  // ── Refresh pending count ─────────────────────────────────────────────────
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  // ── Upload a single offline sale to Supabase ─────────────────────────────
  const uploadSale = async (entry: OfflineSale): Promise<void> => {
    const { payload } = entry;
    const { items, subscription_items, ...saleData } = payload;

    // Use the offline-generated ID as the sale ID
    const saleId = entry.id;

    const saleToInsert: Record<string, any> = {
      ...saleData,
      id: saleId,
      // Use the device timestamp from when the sale was actually made
      created_at: entry.offlineCreatedAt,
      offline_created_at: entry.offlineCreatedAt,
      synced_at: new Date().toISOString(),
      is_offline_sale: true,
    };

    const { error: saleError } = await supabase.from('sales').insert(saleToInsert);
    if (saleError) throw new Error(`Sale insert: ${saleError.message}`);

    // Increment customer visit count
    if (saleToInsert.customer_id) {
      const { data: customerData, error: customerFetchError } = await supabase
        .from('customers')
        .select('visit_count')
        .eq('id', saleToInsert.customer_id)
        .single();

      if (!customerFetchError && customerData) {
        await supabase
          .from('customers')
          .update({ visit_count: (customerData.visit_count || 0) + 1 })
          .eq('id', saleToInsert.customer_id);
      }
    }

    // Insert sale line items
    if (items && items.length > 0) {
      const saleItemsToInsert = items.map((item: any) => ({
        id: item.id || generateId(),
        sale_id: saleId,
        service_id: item.itemId,
        service_name: item.itemName,
        service_code: item.itemCode,
        price: item.price,
        quantity: item.quantity,
        kind: item.kind,
      }));
      const { error } = await supabase.from('sale_items').insert(saleItemsToInsert);
      if (error) throw new Error(`Sale items: ${error.message}`);
    }

    // Insert subscription sale items + customer subscriptions
    if (subscription_items && subscription_items.length > 0) {
      const subItemsToInsert = subscription_items.map((item: any) => ({
        ...item,
        sale_id: saleId,
      }));
      const { error } = await supabase.from('subscription_sale_items').insert(subItemsToInsert);
      if (error) throw new Error(`Subscription items: ${error.message}`);

      // Fetch plan durations
      const planIds = subscription_items.map((item: any) => item.plan_id);
      const { data: plans, error: plansError } = await supabase
        .from('subscription_plans')
        .select('id, duration_months')
        .in('id', planIds);

      if (!plansError && plans) {
        const planDurations = plans.reduce<Record<string, number>>((acc, plan) => {
          acc[plan.id] = plan.duration_months;
          return acc;
        }, {});

        const customerSubscriptionsToInsert = subscription_items.map((item: any) => ({
          id: generateId(),
          customer_id: saleToInsert.customer_id,
          customer_name: saleToInsert.customer_name,
          plan_id: item.plan_id,
          plan_name: item.plan_name,
          plan_duration_months: planDurations[item.plan_id],
          plan_price: item.price,
          status: 'active',
          start_date: entry.offlineCreatedAt,
          assigned_by_user_id: saleToInsert.employee_id,
          assigned_by_name: saleToInsert.employee_name,
          created_at: entry.offlineCreatedAt,
        }));

        await supabase.from('customer_subscriptions').insert(customerSubscriptionsToInsert);
      }
    }
  };

  // ── Main sync loop ────────────────────────────────────────────────────────
  const syncNow = useCallback(async (): Promise<SyncResult | null> => {
    // Prevent concurrent syncs
    if (syncLock.current || isOffline) return null;
    syncLock.current = true;
    setIsSyncing(true);

    const result: SyncResult = {
      synced: 0,
      failed: 0,
      errors: [],
      corruptedIds: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // 1. Verify chain integrity — flag corrupted but still try to sync them
      result.corruptedIds = await verifyIntegrity();

      // 2. Get all pending sales
      const pending = await getPendingSales();
      if (pending.length === 0) {
        return result;
      }

      // 3. Upload each sale sequentially (ordering matters for visit counts)
      for (const entry of pending) {
        try {
          await uploadSale(entry);
          await markSynced(entry.id);
          result.synced++;
        } catch (err: any) {
          const msg = err?.message || 'Unknown error';
          // If it's a duplicate key error, the sale was already synced
          if (msg.includes('duplicate') || msg.includes('already exists')) {
            await markSynced(entry.id);
            result.synced++;
          } else {
            await markSyncFailed(entry.id, msg);
            result.failed++;
            result.errors.push(`${entry.id}: ${msg}`);
          }
        }
      }

      // 4. Invalidate queries so UI shows fresh data
      if (result.synced > 0) {
        await queryClient.invalidateQueries({ queryKey: ['sales'] });
        await queryClient.invalidateQueries({ queryKey: ['customers'] });
        await queryClient.invalidateQueries({ queryKey: ['customerSubscriptions'] });
      }

      // 5. Purge old synced entries (keep 30 days for audit)
      await purgeSyncedOlderThan(30);
    } catch (err: any) {
      result.errors.push(err?.message || 'Sync loop error');
    } finally {
      await refreshPendingCount();
      setIsSyncing(false);
      setLastSyncResult(result);
      syncLock.current = false;
    }

    return result;
  }, [isOffline, queryClient, refreshPendingCount]);

  // ── Auto-sync when connectivity returns ───────────────────────────────────
  const prevConnected = useRef<boolean | null>(null);

  useEffect(() => {
    const wasOffline = prevConnected.current === false;
    const isNowOnline = netInfo.isConnected === true;

    if (wasOffline && isNowOnline) {
      // Debounce: wait 2s after reconnect to let network stabilise
      const timer = setTimeout(() => syncNow(), 2000);
      return () => clearTimeout(timer);
    }

    prevConnected.current = netInfo.isConnected;
  }, [netInfo.isConnected, syncNow]);

  // ── Auto-sync on app foreground ───────────────────────────────────────────
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active' && !isOffline) {
        syncNow();
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [isOffline, syncNow]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  return {
    /** true when device has no internet */
    isOffline,
    /** Number of sales waiting to be synced */
    pendingCount,
    /** true during active sync */
    isSyncing,
    /** Result of most recent sync attempt */
    lastSyncResult,
    /** Trigger a manual sync */
    syncNow,
    /** Refresh the pending count (e.g. after enqueuing) */
    refreshPendingCount,
  };
});
