import { HazyClientProvider } from "@repo/api-client/react";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { apiClient, queryClient } from "@/lib/clients";
import { router } from "@/router";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HazyClientProvider client={apiClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          {/* Clear the mobile tab bar (~63px, sm:hidden) on narrow screens. */}
          <Toaster mobileOffset={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }} />
        </TooltipProvider>
      </HazyClientProvider>
    </QueryClientProvider>
  );
}
