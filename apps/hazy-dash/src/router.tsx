import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
  Outlet,
} from "@tanstack/react-router";
import { dashQueries, dashQueryClient } from "@/lib/clients";
import { getToken } from "@/lib/connect";

function RootNotFound() {
  return <Navigate to="/" replace />;
}

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: RootNotFound,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: () => {
    if (!getToken()) return;
    void dashQueryClient.prefetchQuery(dashQueries.readLaterQueue());
    void dashQueryClient.prefetchQuery(dashQueries.readLaterStats());
    void dashQueryClient.prefetchQuery(dashQueries.itemsRecent(6));
  },
  component: lazyRouteComponent(() => import("@/pages/dashboard-page"), "DashboardPage"),
});

const callbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/callback",
  component: lazyRouteComponent(() => import("@/pages/callback-page"), "CallbackPage"),
});

const routeTree = rootRoute.addChildren([dashboardRoute, callbackRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
