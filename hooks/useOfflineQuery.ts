import { useQuery, useQueryClient, QueryKey } from '@tanstack/react-query';
import { useNetInfo } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useCallback } from 'react';

/** Build a stable cache key string from a React Query key */
function cacheKey(queryKey: QueryKey): string {
  return `@oq:${JSON.stringify(queryKey)}`;
}

export function useOfflineQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
) {
  const netInfo = useNetInfo();
  const queryClient = useQueryClient();
  const cacheLoaded = useRef(false);

  // ── 1. Hydrate query cache from AsyncStorage on first mount ──────────────
  //    This ensures the UI shows data instantly instead of blank + spinner.
  useEffect(() => {
    if (cacheLoaded.current) return;
    cacheLoaded.current = true;

    (async () => {
      try {
        const json = await AsyncStorage.getItem(cacheKey(queryKey));
        if (json != null) {
          const cached = JSON.parse(json);
          // Only set if the query hasn't already fetched fresh data
          const current = queryClient.getQueryData(queryKey);
          if (current === undefined) {
            queryClient.setQueryData(queryKey, cached);
          }
        }
      } catch {
        // ignore parse/read errors
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── 2. Network-aware query ────────────────────────────────────────────────
  //    `netInfo.isConnected` starts as `null`; treat null as "maybe online" so
  //    the query fires immediately instead of waiting for the net-info check.
  const isOnline = netInfo.isConnected !== false;

  const queryResult = useQuery({
    queryKey,
    queryFn,
    enabled: isOnline,
  });

  // ── 3. Persist fresh data to AsyncStorage ─────────────────────────────────
  useEffect(() => {
    if (queryResult.data != null && isOnline) {
      AsyncStorage.setItem(cacheKey(queryKey), JSON.stringify(queryResult.data)).catch(() => {});
    }
  }, [queryResult.data, isOnline, queryKey]);

  // ── 4. When going explicitly offline, hydrate from cache if data is empty ─
  useEffect(() => {
    if (netInfo.isConnected === false) {
      (async () => {
        try {
          const json = await AsyncStorage.getItem(cacheKey(queryKey));
          if (json != null) {
            queryClient.setQueryData(queryKey, JSON.parse(json));
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [netInfo.isConnected, queryKey, queryClient]);

  const error = useMemo(() => {
    if (netInfo.isConnected === false) {
      return new Error('You are offline. Please check your internet connection.');
    }
    return queryResult.error;
  }, [netInfo.isConnected, queryResult.error]);

  return { ...queryResult, error };
}
