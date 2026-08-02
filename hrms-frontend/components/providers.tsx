'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 2 * 60 * 1000,    // 2min — safe default; pages override down for real-time data
            gcTime: 5 * 60 * 1000,       // 5min garbage collection
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
