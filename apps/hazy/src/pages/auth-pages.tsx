import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "@/i18n";
import { authClient, hazyQueries, sanitizeRedirectUrl } from "@/lib/clients";

function AuthCard() {
  const locale = useLocale();
  const t = useTranslations("auth");
  const location = useLocation();
  const authConfig = useQuery(hazyQueries.authConfig());

  const redirectTarget = useMemo(() => {
    const raw = new URLSearchParams(location.searchStr).get("redirect_url");
    return sanitizeRedirectUrl(raw, `/${locale}/library`);
  }, [location.searchStr, locale]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleGithub() {
    setError(null);
    setSubmitting(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: `${window.location.origin}${redirectTarget}`,
      });
    } catch {
      setError(t("signInError"));
      setSubmitting(false);
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
          disabled={submitting || !githubEnabled}
          onClick={() => void handleGithub()}
        >
          {submitting ? t("signingIn") : t("continueWithGithub")}
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
