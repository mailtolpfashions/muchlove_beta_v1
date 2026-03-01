import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { sendSaleNotification } from '@/utils/notifications';

/**
 * Maps Supabase table names to the React Query cache keys they should invalidate.
 * When a row changes in any of these tables, the corresponding queries are refetched automatically.
 */
const TABLE_QUERY_MAP: Record<string, string[]> = {
  profiles: ['users'],
  customers: ['customers'],
  services: ['services'],
  subscription_plans: ['subscriptions'],
  customer_subscriptions: ['customerSubscriptions'],
  offers: ['offers'],
  combos: ['combos'],
  combo_items: ['combos'],
  sales: ['sales'],
  sale_items: ['sales'],
  subscription_sale_items: ['sales'],
  upi_configs: ['upiConfigs'],
};

/** Debounce window — collect changes for 400ms then batch-invalidate once */
const DEBOUNCE_MS = 400;

interface RealtimeSyncOptions {
  /** The current authenticated user's ID (used to skip self-notifications) */
  currentUserId?: string;
  /** Whether the current user is an admin (only admins receive sale notifications) */
  isAdmin?: boolean;
}

/**
 * Subscribes to Supabase Realtime for all app tables.
 * On any INSERT / UPDATE / DELETE, the matching React Query cache key is invalidated
 * so the UI updates immediately without a manual refresh.
 *
 * Changes are **debounced** — rapid-fire events (e.g. a sale inserting rows into
 * sales + sale_items + subscription_sale_items) are batched into a single
 * invalidation pass, preventing redundant refetches and re-renders.
 *
 * Additionally, when a NEW sale is inserted by a *different* user, a local push
 * notification is fired so admin devices are alerted in real time.
 */
export function useRealtimeSync({ currentUserId, isAdmin }: RealtimeSyncOptions = {}) {
  const queryClient = useQueryClient();
  const pendingKeys = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushInvalidations = useCallback(() => {
    const keys = pendingKeys.current;
    if (keys.size === 0) return;
    keys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
    keys.clear();
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const table = payload.table;
          const queryKeys = TABLE_QUERY_MAP[table];
          if (queryKeys) {
            queryKeys.forEach((key) => pendingKeys.current.add(key));
            // Reset debounce timer so rapid events are batched
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(flushInvalidations, DEBOUNCE_MS);
          }

          // Fire a local notification for admins when someone else records a sale
          if (
            table === 'sales' &&
            payload.eventType === 'INSERT' &&
            isAdmin &&
            currentUserId
          ) {
            const newRow = payload.new as Record<string, unknown>;
            // Only notify if the sale was made by a different user
            if (newRow.employee_id && newRow.employee_id !== currentUserId) {
              sendSaleNotification(
                (newRow.customer_name as string) || 'Walk-in Customer',
                Number(newRow.total) || 0,
                (newRow.employee_name as string) || 'Staff',
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient, currentUserId, isAdmin, flushInvalidations]);
}
