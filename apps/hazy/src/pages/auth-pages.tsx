import { SignIn, SignUp } from "@clerk/clerk-react";
import { HazyMark } from "@repo/ui/components/hazy-mark";
import { Navigate, Outlet, useSearchParams } from "react-router";
import { useLocale, useTranslations } from "@/i18n";
import { isClerkConfigured } from "@/lib/env";

export function AuthLayout() {
  const locale = useLocale();
  const t = useTranslations("auth");

  if (!isClerkConfigured()) {
    return <Navigate to={`/${locale}`} replace />;
  }

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

export function SignInPage() {
  const locale = useLocale();
  const [search] = useSearchParams();
  const redirectUrl = search.get("redirect_url") ?? undefined;

  return (
    <SignIn
      routing="path"
      path={`/${locale}/sign-in`}
      signUpUrl={`/${locale}/sign-up`}
      forceRedirectUrl={redirectUrl}
      fallbackRedirectUrl={`/${locale}/library`}
      appearance={{
        variables: {
          colorPrimary: "#9184d9",
          colorBackground: "#161826",
          borderRadius: "8px",
        },
      }}
    />
  );
}

export function SignUpPage() {
  const locale = useLocale();

  return (
    <SignUp
      routing="path"
      path={`/${locale}/sign-up`}
      signInUrl={`/${locale}/sign-in`}
      fallbackRedirectUrl={`/${locale}/library`}
      appearance={{
        variables: {
          colorPrimary: "#9184d9",
          colorBackground: "#161826",
          borderRadius: "8px",
        },
      }}
    />
  );
}
