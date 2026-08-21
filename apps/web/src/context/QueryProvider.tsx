"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Wraps interactive client-side server state (execution status, grading
// results, hints, progress) - the "good candidates" per prompt.md §22, not
// every request. Read-heavy/static pages (assignment list) stay
// server-rendered. One QueryClient per component instance (via useState,
// not module scope) so server-rendered requests never share cached data
// across users - the standard TanStack Query + Next.js App Router pattern.
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
