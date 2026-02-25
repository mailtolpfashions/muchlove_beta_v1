import { useQuery, useQueryClient, QueryKey } from '@tanstack/react-query';
import { useNetInfo } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo } from 'react';

export function useOfflineQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
) {
  const netInfo = useNetInfo();
  const queryClient = useQueryClient();

  const queryResult = useQuery({
    queryKey,
    queryFn,
    enabled: netInfo.isConnected ?? true,
  });

  const error = useMemo(() => {
    if (netInfo.isConnected === false) {
        return new Error('You are offline. Please check your internet connection.');
    }
    return queryResult.error;
  }, [netInfo.isConnected, queryResult.error]);

  useEffect(() => {
    const persistData = async () => {
      if (queryResult.data) {
        try {
          const jsonValue = JSON.stringify(queryResult.data);
          await AsyncStorage.setItem(JSON.stringify(queryKey), jsonValue);
        } catch (e) {
          console.error("Failed to save data to async storage", e);
        }
      }
    };

    if (netInfo.isConnected) {
      persistData();
    }
  }, [queryResult.data, netInfo.isConnected, queryKey]);

  useEffect(() => {
    const loadDataFromCache = async () => {
      if (netInfo.isConnected === false) { // Explicitly check for offline
        try {
          const jsonValue = await AsyncStorage.getItem(JSON.stringify(queryKey));
          if (jsonValue != null) {
            const data = JSON.parse(jsonValue);
            queryClient.setQueryData(queryKey, data);
          }
        } catch (e) {
          console.error("Failed to load data from async storage", e);
        }
      }
    };

    loadDataFromCache();
  }, [netInfo.isConnected, queryKey, queryClient]);

  return { ...queryResult, error };
}
