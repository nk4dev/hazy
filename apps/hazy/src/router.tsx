import type { HazyClient } from "@repo/api-client";
import type { HazyAuthClient } from "@repo/api-client/auth";
import { hazyQueryKeys } from "@repo/api-client/query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/components/providers/auth-provider";
import i18n from "@/i18n";
import { detectDefaultLocale, isAppLocale } from "@/i18n/routing";
import {
  apiClient,
  authClient,
  hazyQueries,
  queryClient,
  sanitizeRedirectUrl,
  sessionQueryOptions,
  setUnauthorizedHandler,
  splitPathAndSearch,
} from "@/lib/clients";
import { AppLayout, AppLoadingScreen, AuthLayout, ConnectLayout, SettingsLayout } from "@/pages/app-shell";

export type HazyRouterContext = {
  queryClient: QueryClient;
  apiClient: HazyClient;
  authClient: HazyAuthClient;
};

async function ensureSession(context: HazyRouterContext) {
  return context.queryClient.ensureQueryData(sessionQueryOptions);
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

function RootNotFound() {
  return <Navigate to="/$locale/library" params={{ locale: detectDefaultLocale() }} replace />;
}

function LocaleShell() {
  const { locale } = localeRoute.useParams();

  useEffect(() => {
    if (!isAppLocale(locale)) return;
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  return <Outlet />;
}

const rootRoute = createRootRouteWithContext<HazyRouterContext>()({
  component: RootComponent,
  notFoundComponent: RootNotFound,
});

const rootIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({
      to: "/$locale/library",
      params: { locale: detectDefaultLocale() },
      replace: true,
    });
  },
});

const localeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$locale",
  beforeLoad: ({ params, location }) => {
    if (!isAppLocale(params.locale)) {
      const targetLocale = detectDefaultLocale();
      const path = location.pathname === "/" ? "" : location.pathname;
      throw redirect({
        to: `/${targetLocale}${path}` as never,
        search: location.search as never,
        replace: true,
      });
    }
  },
  component: LocaleShell,
});

const localeIndexRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "/",
  beforeLoad: async ({ context, params }) => {
    if (!isAppLocale(params.locale)) return;
    const session = await ensureSession(context);
    throw redirect({
      to: session?.user ? "/$locale/library" : "/$locale/sign-in",
      params: { locale: params.locale },
      replace: true,
    });
  },
});

const docsRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "/docs",
  component: lazyRouteComponent(() => import("@/pages/docs-page"), "DocsPage"),
});

const authLayoutRoute = createRoute({
  getParentRoute: () => localeRoute,
  id: "_auth",
  component: AuthLayout,
});

const validateAuthSearch = (raw: Record<string, unknown>): { redirect_url?: string } => ({
  redirect_url: typeof raw.redirect_url === "string" ? raw.redirect_url : undefined,
});

const signInRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/sign-in",
  validateSearch: validateAuthSearch,
  beforeLoad: async ({ context, params, search }) => {
    if (!isAppLocale(params.locale)) return;
    const session = await ensureSession(context);
    if (session?.user) {
      const safe = sanitizeRedirectUrl(search.redirect_url, `/${params.locale}/library`);
      const target = splitPathAndSearch(safe);
      throw redirect({
        to: target.to as never,
        ...(target.search ? { search: target.search as never } : {}),
        replace: true,
      });
    }
  },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(hazyQueries.authConfig());
  },
  component: lazyRouteComponent(() => import("@/pages/auth-pages"), "SignInPage"),
});

const signUpRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/sign-up",
  validateSearch: validateAuthSearch,
  beforeLoad: ({ params, search }) => {
    if (!isAppLocale(params.locale)) return;
    throw redirect({
      to: "/$locale/sign-in",
      params: { locale: params.locale },
      ...(search.redirect_url ? { search: { redirect_url: search.redirect_url } } : {}),
      replace: true,
    });
  },
});

const connectorRedirectRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "/connector",
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$locale/settings/connections",
      params: { locale: params.locale },
      replace: true,
    });
  },
});

const connectLayoutRoute = createRoute({
  getParentRoute: () => localeRoute,
  id: "_connect",
  component: ConnectLayout,
});

const connectAddRoute = createRoute({
  getParentRoute: () => connectLayoutRoute,
  path: "/connector/add",
  validateSearch: (raw: Record<string, unknown>) => raw,
  beforeLoad: async ({ context, params, location }) => {
    if (!isAppLocale(params.locale)) return;
    const session = await ensureSession(context);
    if (!session?.user) {
      const back = `${location.pathname}${location.searchStr}`;
      throw redirect({
        to: "/$locale/sign-in",
        params: { locale: params.locale },
        search: { redirect_url: back },
        replace: true,
      });
    }
  },
  component: lazyRouteComponent(() => import("@/pages/connect-pages"), "ConnectAddPage"),
});

const authedLayoutRoute = createRoute({
  getParentRoute: () => localeRoute,
  id: "_authed",
  beforeLoad: async ({ context, params, location }) => {
    if (!isAppLocale(params.locale)) return;
    const session = await ensureSession(context);
    if (!session?.user) {
      const back = `${location.pathname}${location.searchStr}`;
      throw redirect({
        to: "/$locale/sign-in",
        params: { locale: params.locale },
        search: { redirect_url: back },
        replace: true,
      });
    }
  },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(hazyQueries.me());
  },
  component: AppLayout,
});

const libraryRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/library",
  validateSearch: (raw: Record<string, unknown>): { q?: string } => ({
    q: typeof raw.q === "string" ? raw.q : undefined,
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchInfiniteQuery(hazyQueries.itemsInfinite("newest"));
    void context.queryClient.prefetchQuery(hazyQueries.collections());
  },
  component: lazyRouteComponent(() => import("@/pages/library-page"), "LibraryPage"),
});

const itemRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/item/$id",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(hazyQueries.item(params.id));
    void context.queryClient.prefetchQuery(hazyQueries.collections());
  },
  component: lazyRouteComponent(() => import("@/pages/item-page"), "ItemPage"),
});

const collectionsRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/collections",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(hazyQueries.collections());
  },
  component: lazyRouteComponent(() => import("@/pages/collections-page"), "CollectionsPage"),
});

const collectionDetailRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/collections/$id",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(hazyQueries.collection(params.id));
  },
  component: lazyRouteComponent(
    () => import("@/pages/collection-detail-page"),
    "CollectionDetailPage"
  ),
});

const askRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/ask",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(hazyQueries.askThreads());
    void context.queryClient.prefetchQuery(hazyQueries.collections());
  },
  component: lazyRouteComponent(() => import("@/pages/ask-page"), "AskPage"),
});

const askThreadRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/ask/$threadId",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(hazyQueries.askThreads());
    void context.queryClient.prefetchQuery(hazyQueries.askThread(params.threadId));
    void context.queryClient.prefetchQuery(hazyQueries.collections());
  },
  component: lazyRouteComponent(() => import("@/pages/ask-thread-page"), "AskThreadPage"),
});

const readLaterRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/read-later",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(hazyQueries.readLaterQueue());
    void context.queryClient.prefetchQuery(hazyQueries.readLaterStats());
    void context.queryClient.prefetchQuery(hazyQueries.me());
  },
  component: lazyRouteComponent(() => import("@/pages/read-later-page"), "ReadLaterPage"),
});

const settingsLayoutRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/settings",
  component: SettingsLayout,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/",
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$locale/settings/language",
      params: { locale: params.locale },
      replace: true,
    });
  },
});

const languageSettingsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/language",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(hazyQueries.me());
  },
  component: lazyRouteComponent(
    () => import("@/pages/language-settings-page"),
    "LanguageSettingsPage"
  ),
});

const connectionsSettingsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/connections",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(hazyQueries.connectedApps());
  },
  component: lazyRouteComponent(() => import("@/pages/connected-apps-page"), "ConnectedAppsPage"),
});

const profilesSettingsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/profiles",
  component: lazyRouteComponent(
    () => import("@/components/settings/profiles-settings-view"),
    "ProfilesSettingsView"
  ),
});

const blogsSettingsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/blogs",
  component: lazyRouteComponent(
    () => import("@/components/settings/blogs-settings-view"),
    "BlogsSettingsView"
  ),
});

const localeCatchAllRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: "/$",
  beforeLoad: ({ params }) => {
    const targetLocale = isAppLocale(params.locale) ? params.locale : detectDefaultLocale();
    throw redirect({
      to: "/$locale/library",
      params: { locale: targetLocale },
      replace: true,
    });
  },
});

const routeTree = rootRoute.addChildren([
  rootIndexRoute,
  localeRoute.addChildren([
    localeIndexRoute,
    docsRoute,
    authLayoutRoute.addChildren([signInRoute, signUpRoute]),
    connectorRedirectRoute,
    connectLayoutRoute.addChildren([connectAddRoute]),
    authedLayoutRoute.addChildren([
      libraryRoute,
      itemRoute,
      collectionsRoute,
      collectionDetailRoute,
      askRoute,
      askThreadRoute,
      readLaterRoute,
      settingsLayoutRoute.addChildren([
        settingsIndexRoute,
        languageSettingsRoute,
        connectionsSettingsRoute,
        profilesSettingsRoute,
        blogsSettingsRoute,
      ]),
    ]),
    localeCatchAllRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
    apiClient,
    authClient,
  },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  defaultPendingComponent: AppLoadingScreen,
});

setUnauthorizedHandler(() => {
  queryClient.clear();
  queryClient.setQueryData(hazyQueryKeys.auth.session(), null);
  const loc = router.state.location;
  const segs = loc.pathname.split("/");
  const locale = isAppLocale(segs[1]) ? segs[1] : detectDefaultLocale();
  const subPath = `/${segs.slice(2).join("/")}`;
  if (
    subPath.startsWith("/sign-in") ||
    subPath.startsWith("/sign-up") ||
    subPath.startsWith("/docs")
  ) {
    return;
  }
  const back = `${loc.pathname}${loc.searchStr}`;
  void router.navigate({
    to: "/$locale/sign-in",
    params: { locale },
    search: { redirect_url: back },
    replace: true,
  });
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
