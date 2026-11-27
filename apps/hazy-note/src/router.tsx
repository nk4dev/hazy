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
import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/loading";
import {
  noteApiClient,
  noteAuthClient,
  noteQueries,
  noteQueryClient,
  noteSessionQueryOptions,
  sanitizeRedirectUrl,
  setNoteUnauthorizedHandler,
  splitPathAndSearch,
} from "@/lib/clients";
import { AuthProvider } from "@/src/components/auth-provider";

export type HazyNoteRouterContext = {
  queryClient: QueryClient;
  apiClient: HazyClient;
  authClient: HazyAuthClient;
};

async function ensureSession(context: HazyNoteRouterContext) {
  return context.queryClient.ensureQueryData(noteSessionQueryOptions);
}

function AppLoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <Spinner className="size-6 text-accent" />
    </div>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

function RootNotFound() {
  return <Navigate to="/notes" replace />;
}

function AuthedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const rootRoute = createRootRouteWithContext<HazyNoteRouterContext>()({
  component: RootComponent,
  notFoundComponent: RootNotFound,
});

const validateAuthSearch = (raw: Record<string, unknown>): { redirect_url?: string } => ({
  redirect_url: typeof raw.redirect_url === "string" ? raw.redirect_url : undefined,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: validateAuthSearch,
  beforeLoad: async ({ context, search }) => {
    const session = await ensureSession(context);
    if (session?.user) {
      const safe = sanitizeRedirectUrl(search.redirect_url, "/notes");
      const target = splitPathAndSearch(safe);
      throw redirect({
        to: target.to as never,
        ...(target.search ? { search: target.search as never } : {}),
        replace: true,
      });
    }
  },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(noteQueries.authConfig());
  },
  component: lazyRouteComponent(() => import("@/src/pages/auth-pages"), "SignInPage"),
});

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-up",
  validateSearch: validateAuthSearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/sign-in",
      ...(search.redirect_url ? { search: { redirect_url: search.redirect_url } } : {}),
      replace: true,
    });
  },
});

const rootIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => {
    const session = await ensureSession(context);
    throw redirect({
      to: session?.user ? "/notes" : "/sign-in",
      replace: true,
    });
  },
});

const authedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authed",
  beforeLoad: async ({ context, location }) => {
    const session = await ensureSession(context);
    if (!session?.user) {
      const back = `${location.pathname}${location.searchStr}`;
      throw redirect({
        to: "/sign-in",
        search: { redirect_url: back },
        replace: true,
      });
    }
  },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.projects());
    void context.queryClient.prefetchQuery(noteQueries.note.tags());
  },
  component: AuthedLayout,
});

const notesRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/notes",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.notes());
  },
  component: lazyRouteComponent(() => import("@/src/pages/notes-page"), "NotesPage"),
});

const newNoteRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/notes/new",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.projects());
  },
  component: lazyRouteComponent(() => import("@/src/pages/note-page"), "NewNotePage"),
});

const noteDetailRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/notes/$id",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.note(params.id));
    void context.queryClient.prefetchQuery(noteQueries.note.projects());
  },
  component: lazyRouteComponent(() => import("@/src/pages/note-page"), "NoteDetailPage"),
});

const libraryRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/library",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.items());
    void context.queryClient.prefetchQuery(noteQueries.note.projects());
  },
  component: lazyRouteComponent(() => import("@/src/pages/library-page"), "LibraryPage"),
});

const itemDetailRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/library/$id",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.item(params.id));
    void context.queryClient.prefetchQuery(noteQueries.note.projects());
  },
  component: lazyRouteComponent(() => import("@/src/pages/item-detail-page"), "ItemDetailPage"),
});

const captureRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/capture",
  validateSearch: (raw: Record<string, unknown>): { id?: string; from?: string } => ({
    id: typeof raw.id === "string" ? raw.id : undefined,
    from: typeof raw.from === "string" ? raw.from : undefined,
  }),
  loaderDeps: ({ search }) => ({ id: search.id, from: search.from }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.projects());
    if (deps.id) {
      void context.queryClient.prefetchQuery(noteQueries.note.item(deps.id));
    }
    if (deps.from === "hazy") {
      void context.queryClient.prefetchQuery(noteQueries.note.importableItems());
    }
  },
  component: lazyRouteComponent(() => import("@/src/pages/capture-page"), "CapturePage"),
});

const projectRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/projects/$id",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.project(params.id));
  },
  component: lazyRouteComponent(() => import("@/src/pages/project-page"), "ProjectPage"),
});

const tagsRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/tags",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.tags());
  },
  component: lazyRouteComponent(() => import("@/src/pages/tags-page"), "TagsPage"),
});

const searchRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/search",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.notes());
    void context.queryClient.prefetchQuery(noteQueries.note.items());
  },
  component: lazyRouteComponent(() => import("@/src/pages/search-page"), "SearchPage"),
});

const analyzeRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/analyze",
  validateSearch: (raw: Record<string, unknown>): { project?: string } => ({
    project: typeof raw.project === "string" ? raw.project : undefined,
  }),
  loaderDeps: ({ search }) => ({ project: search.project }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.analyze(deps.project));
    void context.queryClient.prefetchQuery(noteQueries.note.projects());
  },
  component: lazyRouteComponent(() => import("@/src/pages/analyze-page"), "AnalyzePage"),
});

const exportRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/export",
  validateSearch: (raw: Record<string, unknown>): { noteId?: string } => ({
    noteId: typeof raw.noteId === "string" ? raw.noteId : undefined,
  }),
  loaderDeps: ({ search }) => ({ noteId: search.noteId }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.notes());
    if (deps.noteId) {
      void context.queryClient.prefetchQuery(noteQueries.note.exportPreview(deps.noteId, "blog"));
    }
  },
  component: lazyRouteComponent(() => import("@/src/pages/export-page"), "ExportPage"),
});

const profileScopeRoute = createRoute({
  getParentRoute: () => authedLayoutRoute,
  path: "/p/$profile",
  component: Outlet,
});

const pNotesRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/notes",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.notes());
  },
  component: lazyRouteComponent(() => import("@/src/pages/notes-page"), "NotesPage"),
});

const pNewNoteRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/notes/new",
  component: lazyRouteComponent(() => import("@/src/pages/note-page"), "NewNotePage"),
});

const pNoteDetailRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/notes/$id",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.note(params.id));
  },
  component: lazyRouteComponent(() => import("@/src/pages/note-page"), "NoteDetailPage"),
});

const pLibraryRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/library",
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.items());
  },
  component: lazyRouteComponent(() => import("@/src/pages/library-page"), "LibraryPage"),
});

const pItemDetailRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/library/$id",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.item(params.id));
  },
  component: lazyRouteComponent(() => import("@/src/pages/item-detail-page"), "ItemDetailPage"),
});

const pCaptureRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/capture",
  component: lazyRouteComponent(() => import("@/src/pages/capture-page"), "CapturePage"),
});

const pProjectRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/projects/$id",
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.project(params.id));
  },
  component: lazyRouteComponent(() => import("@/src/pages/project-page"), "ProjectPage"),
});

const pTagsRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/tags",
  component: lazyRouteComponent(() => import("@/src/pages/tags-page"), "TagsPage"),
});

const pSearchRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/search",
  component: lazyRouteComponent(() => import("@/src/pages/search-page"), "SearchPage"),
});

const pAnalyzeRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/analyze",
  component: lazyRouteComponent(() => import("@/src/pages/analyze-page"), "AnalyzePage"),
});

const pExportRoute = createRoute({
  getParentRoute: () => profileScopeRoute,
  path: "/export",
  validateSearch: (raw: Record<string, unknown>): { noteId?: string } => ({
    noteId: typeof raw.noteId === "string" ? raw.noteId : undefined,
  }),
  loaderDeps: ({ search }) => ({ noteId: search.noteId }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(noteQueries.note.notes());
    if (deps.noteId) {
      void context.queryClient.prefetchQuery(noteQueries.note.exportPreview(deps.noteId, "blog"));
    }
  },
  component: lazyRouteComponent(() => import("@/src/pages/export-page"), "ExportPage"),
});

const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$",
  beforeLoad: () => {
    throw redirect({ to: "/notes", replace: true });
  },
});

const routeTree = rootRoute.addChildren([
  rootIndexRoute,
  signInRoute,
  signUpRoute,
  authedLayoutRoute.addChildren([
    notesRoute,
    newNoteRoute,
    noteDetailRoute,
    libraryRoute,
    itemDetailRoute,
    captureRoute,
    projectRoute,
    tagsRoute,
    searchRoute,
    analyzeRoute,
    exportRoute,
    profileScopeRoute.addChildren([
      pNotesRoute,
      pNewNoteRoute,
      pNoteDetailRoute,
      pLibraryRoute,
      pItemDetailRoute,
      pCaptureRoute,
      pProjectRoute,
      pTagsRoute,
      pSearchRoute,
      pAnalyzeRoute,
      pExportRoute,
    ]),
  ]),
  catchAllRoute,
]);

export const router = createRouter({
  routeTree,
  context: {
    queryClient: noteQueryClient,
    apiClient: noteApiClient,
    authClient: noteAuthClient,
  },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  defaultPendingComponent: AppLoadingScreen,
});

setNoteUnauthorizedHandler(() => {
  noteQueryClient.clear();
  noteQueryClient.setQueryData(hazyQueryKeys.auth.session(), null);
  const loc = router.state.location;
  if (loc.pathname.startsWith("/sign-in") || loc.pathname.startsWith("/sign-up")) {
    return;
  }
  const back = `${loc.pathname}${loc.searchStr}`;
  void router.navigate({
    to: "/sign-in",
    search: { redirect_url: back },
    replace: true,
  });
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
