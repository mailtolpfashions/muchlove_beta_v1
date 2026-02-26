import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
  sales: ['sales'],
  sale_items: ['sales'],
  subscription_sale_items: ['sales'],
  upi_configs: ['upiConfigs'],
};

const TABLES = Object.keys(TABLE_QUERY_MAP);

/**
 * Subscribes to Supabase Realtime for all app tables.
 * On any INSERT / UPDATE / DELETE, the matching React Query cache key is invalidated
 * so the UI updates immediately without a manual refresh.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();

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
            queryKeys.forEach((key) => {
              queryClient.invalidateQueries({ queryKey: [key] });
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
