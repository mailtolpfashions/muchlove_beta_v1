import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,        // 10 min — realtime sync keeps data fresh
      gcTime: 30 * 60 * 1000,           // 30 min — keep cache longer for offline
      retry: 2,                          // retry failed fetches twice
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,       // realtime sync handles updates
      refetchOnReconnect: true,          // refetch when network comes back
    },
  },
});
