import { HazyClientProvider } from "@repo/api-client/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { noteApiClient, noteQueryClient } from "@/lib/clients";
import { router } from "@/src/router";

export function App() {
  return (
    <QueryClientProvider client={noteQueryClient}>
      <HazyClientProvider client={noteApiClient}>
        <RouterProvider router={router} />
      </HazyClientProvider>
    </QueryClientProvider>
  );
}
