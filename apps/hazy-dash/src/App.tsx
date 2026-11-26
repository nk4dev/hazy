import { RouterProvider } from "@tanstack/react-router";
import { DashProvider } from "@/components/dash-provider";
import { router } from "@/router";

export function App() {
  return (
    <DashProvider>
      <RouterProvider router={router} />
    </DashProvider>
  );
}
