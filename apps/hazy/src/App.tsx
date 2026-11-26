import { ClerkProvider } from "@clerk/clerk-react";
import { HazyClientProvider } from "@repo/api-client/react";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router";
import { ClerkHazyClientProvider } from "@/components/providers/clerk-hazy-client-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import i18n from "@/i18n";
import { detectDefaultLocale, isAppLocale } from "@/i18n/routing";
import { env, isClerkConfigured } from "@/lib/env";
import { AppLayout, SettingsLayout } from "@/pages/app-shell";
import { AuthLayout, SignInPage, SignUpPage } from "@/pages/auth-pages";
import { ConnectAddPage, ConnectLayout } from "@/pages/connect-pages";
import { DocsPage } from "@/pages/docs-page";
import {
  AskPage,
  AskThreadPage,
  CollectionDetailPage,
  CollectionsPage,
  ConnectedAppsPage,
  ItemPage,
  LanguageSettingsPage,
  LibraryPage,
  LocaleIndexPage,
  ReadLaterPage,
} from "@/pages/route-wrappers";

function LocaleShell() {
  const { locale } = useParams<{ locale?: string }>();
  const location = useLocation();

  useEffect(() => {
    if (!isAppLocale(locale)) return;
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  if (!isAppLocale(locale)) {
    const targetLocale = detectDefaultLocale();
    const path = location.pathname === "/" ? "" : location.pathname;
    return <Navigate to={`/${targetLocale}${path}${location.search}`} replace />;
  }

  return <Outlet />;
}

function UnlocalizedRedirect() {
  const location = useLocation();
  const targetLocale = detectDefaultLocale();
  const path = location.pathname === "/" ? "" : location.pathname;
  return <Navigate to={`/${targetLocale}${path}${location.search}`} replace />;
}

export function App() {
  const clerkEnabled = isClerkConfigured();

  const inner = (
    <QueryProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/:locale" element={<LocaleShell />}>
              <Route index element={<LocaleIndexPage />} />
              <Route path="docs" element={<DocsPage />} />
              <Route element={<AuthLayout />}>
                <Route path="sign-in/*" element={<SignInPage />} />
                <Route path="sign-up/*" element={<SignUpPage />} />
              </Route>
              <Route path="connector" element={<Navigate to="../settings/connections" replace />} />
              <Route element={<ConnectLayout />}>
                <Route path="connector/add" element={<ConnectAddPage />} />
              </Route>
              <Route element={<AppLayout />}>
                <Route path="library" element={<LibraryPage />} />
                <Route path="item/:id" element={<ItemPage />} />
                <Route path="collections" element={<CollectionsPage />} />
                <Route path="collections/:id" element={<CollectionDetailPage />} />
                <Route path="ask" element={<AskPage />} />
                <Route path="ask/:threadId" element={<AskThreadPage />} />
                <Route path="read-later" element={<ReadLaterPage />} />
                <Route path="settings" element={<SettingsLayout />}>
                  <Route index element={<Navigate to="language" replace />} />
                  <Route path="language" element={<LanguageSettingsPage />} />
                  <Route path="connections" element={<ConnectedAppsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="library" replace />} />
            </Route>
            <Route path="*" element={<UnlocalizedRedirect />} />
          </Routes>
        </BrowserRouter>
        {/* Clear the mobile tab bar (~63px, sm:hidden) on narrow screens. */}
        <Toaster mobileOffset={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }} />
      </TooltipProvider>
    </QueryProvider>
  );

  if (!clerkEnabled || !env.CLERK_PUBLISHABLE_KEY) {
    return (
      <HazyClientProvider baseUrl={env.API_URL} getToken={async () => null}>
        {inner}
      </HazyClientProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={env.CLERK_PUBLISHABLE_KEY}>
      <ClerkHazyClientProvider>{inner}</ClerkHazyClientProvider>
    </ClerkProvider>
  );
}
