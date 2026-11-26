import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuthSession } from "@/components/providers/auth-provider";
import { useLocale, useTranslations } from "@/i18n";
import { authClient, hazyQueries, sanitizeRedirectUrl, splitPathAndSearch } from "@/lib/clients";

function AuthCard() {
  const locale = useLocale();
  const t = useTranslations("auth");
  const router = useRouter();
  const location = useLocation();
  const { refreshSessionAfterAuth } = useAuthSession();
  const authConfig = useQuery(hazyQueries.authConfig());

  const redirectTarget = useMemo(() => {
    const raw = new URLSearchParams(location.searchStr).get("redirect_url");
    return sanitizeRedirectUrl(raw, `/${locale}/library`);
  }, [location.searchStr, locale]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"passkey" | "github" | null>(null);

  async function handlePasskey() {
    setError(null);
    setSubmitting("passkey");
    try {
      const res = await authClient.signIn.passkey();
      if (res?.error) {
        setError(res.error.message || t("passkeyError"));
        return;
      }
      await refreshSessionAfterAuth();
      const target = splitPathAndSearch(redirectTarget);
      await router.navigate({
        to: target.to as never,
        ...(target.search ? { search: target.search as never } : {}),
        replace: true,
      });
    } catch {
      setError(t("passkeyError"));
    } finally {
      setSubmitting(null);
    }
  }

  async function handleGithub() {
    setError(null);
    setSubmitting("github");
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: `${window.location.origin}${redirectTarget}`,
      });
    } catch {
      setError(t("signInError"));
      setSubmitting(null);
    }
  }

  const githubEnabled = authConfig.data?.github ?? true;

  return (
    <div className="flex w-full max-w-sm flex-col gap-5 rounded-xl bg-card p-6 ring-1 ring-border">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">{t("signInTitle")}</h1>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("restrictedHint")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          className="w-full"
          disabled={submitting !== null}
          onClick={() => void handlePasskey()}
        >
          <KeyRound className="mr-2 size-4" />
          {submitting === "passkey" ? t("signingIn") : t("continueWithPasskey")}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={submitting !== null || !githubEnabled}
          onClick={() => void handleGithub()}
        >
          {submitting === "github" ? t("signingIn") : t("continueWithGithub")}
        </Button>

        {authConfig.data && !authConfig.data.github && (
          <p className="text-xs text-muted-foreground">{t("githubNotConfigured")}</p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

export function SignInPage() {
  return <AuthCard />;
}
