import { HazyMark } from "@repo/ui/components/hazy-mark";
import { Outlet } from "@tanstack/react-router";
import { Header } from "@/components/layout/header";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SettingsNav } from "@/components/settings/settings-nav";
import { useTranslations } from "@/i18n";

export function AppLoadingScreen() {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-3 py-24">
      <HazyMark size={32} className="animate-hz-breathe" />
      <p className="text-xs text-muted-foreground">{t("loading")}</p>
    </div>
  );
}

export function AppLayout() {
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

export function AuthLayout() {
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <div className="flex items-center gap-2">
        <HazyMark size={28} />
        <span className="text-lg font-medium">Hazy</span>
      </div>
      <p className="-mt-6 text-sm text-muted-foreground">{t("tagline")}</p>
      <Outlet />
    </div>
  );
}

export function ConnectLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <div className="flex items-center gap-2">
        <HazyMark size={28} />
        <span className="text-lg font-medium">Hazy</span>
      </div>
      <Outlet />
    </div>
  );
}
