/**
 * Qore Project Information System
 * 
 * Designed, architected, and engineered by Unwana J.
 * @author Unwana J
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { safety } from './lib/safety.ts';

// Console Easter Egg Signature for posterity
console.log(
  "%c Qore Dashboard %c Engineered with care by Unwana J %c",
  "background:#14b8a6;color:#fff;padding:4px 6px;border-radius:4px 0 0 4px;font-weight:bold;",
  "background:#1e293b;color:#fff;padding:4px 6px;border-radius:0 4px 4px 0;",
  "background:transparent"
);

// Global safety check before anything renders
safety.checkStorageVersion();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute stale-while-revalidate default
      refetchOnWindowFocus: false, // Prevent aggressive refetches
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        {import.meta.env.MODE === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
