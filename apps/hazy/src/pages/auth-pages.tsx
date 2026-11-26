import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import { useAuthSession } from "@/components/providers/auth-provider";
import { useLocale, useTranslations } from "@/i18n";
import { Link } from "@/i18n/navigation";
import { authClient, hazyQueries, sanitizeRedirectUrl, splitPathAndSearch } from "@/lib/clients";

function EmailAuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const locale = useLocale();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const location = useLocation();
  const { refreshSessionAfterAuth } = useAuthSession();
  const authConfig = useQuery(hazyQueries.authConfig());

  const redirectTarget = useMemo(() => {
    const raw = new URLSearchParams(location.searchStr).get("redirect_url");
    return sanitizeRedirectUrl(raw, `/${locale}/library`);
  }, [location.searchStr, locale]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "sign-up") {
        const res = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim().split("@")[0] || "Owner",
        });
        if (res.error) {
          setError(res.error.message || t("signUpError"));
          return;
        }
      } else {
        const res = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (res.error) {
          setError(res.error.message || t("signInError"));
          return;
        }
      }
      await refreshSessionAfterAuth();
      const target = splitPathAndSearch(redirectTarget);
      await router.navigate({
        to: target.to as never,
        ...(target.search ? { search: target.search as never } : {}),
        replace: true,
      });
    } catch {
      setError(mode === "sign-up" ? t("signUpError") : t("signInError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}${redirectTarget}`,
      });
    } catch {
      setError(t("signInError"));
      setSubmitting(false);
    }
  }

  const isSignUp = mode === "sign-up";

  return (
    <div className="flex w-full max-w-sm flex-col gap-5 rounded-xl bg-card p-6 ring-1 ring-border">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">
          {isSignUp ? t("signUpTitle") : t("signInTitle")}
        </h1>
        {isSignUp && (
          <p className="text-xs leading-relaxed text-muted-foreground">{t("restrictedHint")}</p>
        )}
      </div>

      {authConfig.data?.google && (
        <>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={submitting}
            onClick={() => void handleGoogle()}
          >
            {t("continueWithGoogle")}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>{t("orContinueWithEmail")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        {isSignUp && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-name">{t("name")}</Label>
            <Input
              id="auth-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              disabled={submitting}
              required
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auth-email">{t("email")}</Label>
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            disabled={submitting}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auth-password">{t("password")}</Label>
          <Input
            id="auth-password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            disabled={submitting}
            required
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting
            ? isSignUp
              ? t("signingUp")
              : t("signingIn")
            : isSignUp
              ? tCommon("signUp")
              : tCommon("signIn")}
        </Button>
      </form>

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <span>{isSignUp ? t("hasAccount") : t("noAccount")}</span>
        <Link
          href={
            isSignUp
              ? `/sign-in?redirect_url=${encodeURIComponent(redirectTarget)}`
              : `/sign-up?redirect_url=${encodeURIComponent(redirectTarget)}`
          }
          className="text-primary hover:underline"
        >
          {isSignUp ? tCommon("signIn") : tCommon("signUp")}
        </Link>
      </div>
    </div>
  );
}

export function SignInPage() {
  return <EmailAuthForm mode="sign-in" />;
}

export function SignUpPage() {
  return <EmailAuthForm mode="sign-up" />;
}
