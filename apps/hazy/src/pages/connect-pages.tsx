import { useAuth } from "@clerk/clerk-react";
import { HazyMark } from "@repo/ui/components/hazy-mark";
import { Suspense } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { ConnectApprovalView } from "@/components/connect/connect-approval-view";
import { useLocale, useTranslations } from "@/i18n";

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

export function ConnectAddPage() {
  const locale = useLocale();
  const t = useTranslations("common");
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <HazyMark size={28} className="animate-hz-breathe" />
        <p className="text-xs text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!isSignedIn) {
    const back = `${location.pathname}${location.search}`;
    return (
      <Navigate to={`/${locale}/sign-in?redirect_url=${encodeURIComponent(back)}`} replace />
    );
  }

  return (
    <Suspense>
      <ConnectApprovalView />
    </Suspense>
  );
}
