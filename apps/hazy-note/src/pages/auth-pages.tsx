import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import {
  noteAuthClient,
  noteQueries,
  sanitizeRedirectUrl,
  splitPathAndSearch,
} from "@/lib/clients";
import { NoteLink } from "@/lib/navigation";
import { useAuthSession } from "@/src/components/auth-provider";

function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const location = useLocation();
  const { refreshSessionAfterAuth } = useAuthSession();
  const authConfig = useQuery(noteQueries.authConfig());

  const redirectTarget = useMemo(() => {
    const raw = new URLSearchParams(location.searchStr).get("redirect_url");
    return sanitizeRedirectUrl(raw, "/notes");
  }, [location.searchStr]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === "sign-up";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSignUp) {
        const res = await noteAuthClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim().split("@")[0] || "Owner",
        });
        if (res.error) {
          setError(
            res.error.message ||
              "アカウントを作成できませんでした。許可されたオーナーアカウントのみ登録できます。"
          );
          return;
        }
      } else {
        const res = await noteAuthClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (res.error) {
          setError(
            res.error.message ||
              "メールアドレスまたはパスワードが正しくないか、許可されていないアカウントです。"
          );
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
      setError(
        isSignUp
          ? "アカウントを作成できませんでした。"
          : "サインインに失敗しました。もう一度お試しください。"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      await noteAuthClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}${redirectTarget}`,
      });
    } catch {
      setError("Google でのサインインに失敗しました。");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-7 px-4 py-12">
      <div className="flex items-center gap-2.5">
        <span className="h-[22px] w-[22px] rounded-[7px] bg-[radial-gradient(circle_at_30%_25%,var(--color-accent-400),var(--color-accent-700))] shadow-[0_0_14px_rgba(145,132,217,0.45)]" />
        <span className="text-[18px] font-medium tracking-[-0.01em] text-text">hazy note</span>
      </div>
      <p className="-mt-5 text-[13px] text-text/55">URLの霧を、自分の言葉に落とすまで</p>

      <div className="flex w-full max-w-sm flex-col gap-5 rounded-[12px] bg-surface p-6 shadow-[0_0_0_1px_var(--color-neutral-800),0_16px_40px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-1">
          <h1 className="text-[20px] font-medium tracking-[-0.02em] text-text">
            {isSignUp ? "アカウントを作成" : "サインイン"}
          </h1>
          {isSignUp && (
            <p className="text-[12px] leading-[1.6] text-text/55">
              個人用ワークスペースのため、許可されたオーナーのメールアドレスのみ登録できます。
            </p>
          )}
        </div>

        {authConfig.data?.google && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGoogle()}
              className="btn btn-secondary w-full"
            >
              Google で続行
            </button>
            <div className="flex items-center gap-3 text-[11px] text-text/45">
              <span className="h-px flex-1 bg-white/[0.08]" />
              <span>またはメールで続行</span>
              <span className="h-px flex-1 bg-white/[0.08]" />
            </div>
          </>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3.5">
          {isSignUp && (
            <label className="flex flex-col gap-1.5 text-[12px] text-text/75">
              名前
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="表示名"
                disabled={busy}
                required
                className="input"
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-[12px] text-text/75">
            メールアドレス
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={busy}
              required
              className="input"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[12px] text-text/75">
            パスワード
            <input
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={busy}
              required
              className="input"
            />
          </label>

          {error && <p className="m-0 text-[12px] text-red-400">{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-primary mt-1 w-full">
            {busy
              ? isSignUp
                ? "アカウント作成中…"
                : "サインイン中…"
              : isSignUp
                ? "アカウントを作成"
                : "サインイン"}
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[12px] text-text/55">
          <span>{isSignUp ? "すでにアカウントをお持ちですか？" : "アカウントをお持ちでない場合"}</span>
          <NoteLink
            href={
              isSignUp
                ? `/sign-in?redirect_url=${encodeURIComponent(redirectTarget)}`
                : `/sign-up?redirect_url=${encodeURIComponent(redirectTarget)}`
            }
            className="text-accent hover:underline"
          >
            {isSignUp ? "サインイン" : "アカウント作成"}
          </NoteLink>
        </div>
      </div>
    </div>
  );
}

export function SignInPage() {
  return <AuthForm mode="sign-in" />;
}

export function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
