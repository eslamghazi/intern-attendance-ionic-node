import { QueryClient } from '@tanstack/react-query';
import { QUERY } from './config';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY.staleTimeMs,
      retry: QUERY.retry,
      refetchOnWindowFocus: false,
    },
  },
});
