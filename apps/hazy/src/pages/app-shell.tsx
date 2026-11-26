import { useAuth } from "@clerk/clerk-react";
import { HazyMark } from "@repo/ui/components/hazy-mark";
import { Navigate, Outlet } from "react-router";
import { Header } from "@/components/layout/header";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SettingsNav } from "@/components/settings/settings-nav";
import { useLocale, useTranslations } from "@/i18n";
import { isClerkConfigured } from "@/lib/env";

export function AppLoadingScreen() {
  const t = useTranslations("common");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
      <HazyMark size={32} className="animate-hz-breathe" />
      <p className="text-xs text-muted-foreground">{t("loading")}</p>
    </div>
  );
}

export function AppLayout() {
  const locale = useLocale();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isClerkConfigured()) {
    return <Navigate to={`/${locale}`} replace />;
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-dvh flex-col overflow-x-clip">
        <AppLoadingScreen />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to={`/${locale}/sign-in`} replace />;
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <Header />
      <main className="flex flex-1 flex-col pt-[env(safe-area-inset-top)] pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pt-0 sm:pb-0">
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
}

export function SettingsLayout() {
  const t = useTranslations("common");

  return (
    <div className="hz-page max-w-xl">
      <h1 className="mb-5 text-2xl font-medium tracking-tight">{t("settings")}</h1>
      <SettingsNav />
      <Outlet />
    </div>
  );
}
