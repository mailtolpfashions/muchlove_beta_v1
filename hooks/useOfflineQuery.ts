import { useQuery, useQueryClient, QueryKey } from '@tanstack/react-query';
import { useNetInfo } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';

/** Maximum offline cache age — 7 days in milliseconds */
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Build a stable cache key string from a React Query key */
function cacheKey(queryKey: QueryKey): string {
  return `@oq:${JSON.stringify(queryKey)}`;
}

/** Build a metadata key for cache-age tracking */
function metaKey(queryKey: QueryKey): string {
  return `@oq_meta:${JSON.stringify(queryKey)}`;
}

/** Format cache age for display (e.g. '2h ago', '3d ago') */
function formatCacheAge(cachedAt: number): string {
  const diffMs = Date.now() - cachedAt;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function useOfflineQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
) {
  const netInfo = useNetInfo();
  const queryClient = useQueryClient();
  const cacheLoaded = useRef(false);
  const [cacheAge, setCacheAge] = useState<string | null>(null);

  // Stable string representation of the query key to avoid array-reference deps
  const keyStr = useMemo(() => JSON.stringify(queryKey), [queryKey]);

  // ── 1. Hydrate query cache from AsyncStorage on first mount ──────────────
  //    This ensures the UI shows data instantly instead of blank + spinner.
  //    Uses cache-age metadata to skip expired entries (>7 days).
  useEffect(() => {
    if (cacheLoaded.current) return;
    cacheLoaded.current = true;

    const key: QueryKey = JSON.parse(keyStr);
    (async () => {
      try {
        const [json, meta] = await Promise.all([
          AsyncStorage.getItem(cacheKey(key)),
          AsyncStorage.getItem(metaKey(key)),
        ]);

        if (json != null) {
          // Check cache age — skip if expired
          if (meta) {
            const { cachedAt } = JSON.parse(meta);
            if (Date.now() - cachedAt > MAX_CACHE_AGE_MS) {
              // Cache expired — remove stale data
              await AsyncStorage.multiRemove([cacheKey(key), metaKey(key)]);
              return;
            }
            setCacheAge(formatCacheAge(cachedAt));
          }

          const cached = JSON.parse(json);
          // Only set if the query hasn't already fetched fresh data
          const current = queryClient.getQueryData(key);
          if (current === undefined) {
            queryClient.setQueryData(key, cached);
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

  // ── 3. Persist fresh data to AsyncStorage with metadata ───────────────────
  useEffect(() => {
    if (queryResult.data != null && isOnline) {
      const key: QueryKey = JSON.parse(keyStr);
      const now = Date.now();
      Promise.all([
        AsyncStorage.setItem(cacheKey(key), JSON.stringify(queryResult.data)),
        AsyncStorage.setItem(metaKey(key), JSON.stringify({ cachedAt: now })),
      ]).catch(() => {});
      setCacheAge(null); // fresh data, no age to show
    }
  }, [queryResult.data, isOnline, keyStr]);

  // ── 4. When going explicitly offline, hydrate from cache if data is empty ─
  useEffect(() => {
    if (netInfo.isConnected === false) {
      const key: QueryKey = JSON.parse(keyStr);
      (async () => {
        try {
          const [json, meta] = await Promise.all([
            AsyncStorage.getItem(cacheKey(key)),
            AsyncStorage.getItem(metaKey(key)),
          ]);
          if (json != null) {
            // Check cache age
            if (meta) {
              const { cachedAt } = JSON.parse(meta);
              if (Date.now() - cachedAt > MAX_CACHE_AGE_MS) return;
              setCacheAge(formatCacheAge(cachedAt));
            }
            queryClient.setQueryData(key, JSON.parse(json));
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [netInfo.isConnected, keyStr, queryClient]);

  const error = useMemo(() => {
    if (netInfo.isConnected === false) {
      return null; // Don't show error when offline — cached data is displayed
    }
    return queryResult.error;
  }, [netInfo.isConnected, queryResult.error]);

  return {
    ...queryResult,
    error,
    /** How old the cached data is (e.g. '2h ago'), null if fresh */
    cacheAge,
    /** Whether the data is coming from offline cache */
    isFromCache: netInfo.isConnected === false && queryResult.data != null,
  };
}
