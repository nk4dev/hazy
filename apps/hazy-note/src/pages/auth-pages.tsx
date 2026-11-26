import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import {
  noteAuthClient,
  noteQueries,
  sanitizeRedirectUrl,
  splitPathAndSearch,
} from "@/lib/clients";
import { useAuthSession } from "@/src/components/auth-provider";

function AuthCard() {
  const router = useRouter();
  const location = useLocation();
  const { refreshSessionAfterAuth } = useAuthSession();
  const authConfig = useQuery(noteQueries.authConfig());

  const redirectTarget = useMemo(() => {
    const raw = new URLSearchParams(location.searchStr).get("redirect_url");
    return sanitizeRedirectUrl(raw, "/notes");
  }, [location.searchStr]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"passkey" | "github" | null>(null);

  async function handlePasskey() {
    setError(null);
    setBusy("passkey");
    try {
      const res = await noteAuthClient.signIn.passkey();
      if (res?.error) {
        setError(res.error.message || "パスキーでのサインインに失敗しました。");
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
      setError("パスキーでのサインインがキャンセルされたか失敗しました。");
    } finally {
      setBusy(null);
    }
  }

  async function handleGithub() {
    setError(null);
    setBusy("github");
    try {
      await noteAuthClient.signIn.social({
        provider: "github",
        callbackURL: `${window.location.origin}${redirectTarget}`,
      });
    } catch {
      setError("GitHub でのサインインに失敗しました。");
      setBusy(null);
    }
  }

  const githubEnabled = authConfig.data?.github ?? true;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-7 px-4 py-12">
      <div className="flex items-center gap-2.5">
        <span className="h-[22px] w-[22px] rounded-[7px] bg-[radial-gradient(circle_at_30%_25%,var(--color-accent-400),var(--color-accent-700))] shadow-[0_0_14px_rgba(145,132,217,0.45)]" />
        <span className="text-[18px] font-medium tracking-[-0.01em] text-text">hazy note</span>
      </div>
      <p className="-mt-5 text-[13px] text-text/55">URLの霧を、自分の言葉に落とすまで</p>

      <div className="flex w-full max-w-sm flex-col gap-5 rounded-[12px] bg-surface p-6 shadow-[0_0_0_1px_var(--color-neutral-800),0_16px_40px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-1">
          <h1 className="text-[20px] font-medium tracking-[-0.02em] text-text">サインイン</h1>
          <p className="text-[12px] leading-[1.6] text-text/55">
            個人用ワークスペースのため、許可されたオーナーアカウントのみサインインできます。
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void handlePasskey()}
            className="btn btn-primary w-full"
          >
            <Icon name="fingerprint" size={16} />
            {busy === "passkey" ? "サインイン中…" : "パスキーでサインイン"}
          </button>

          <button
            type="button"
            disabled={busy !== null || !githubEnabled}
            onClick={() => void handleGithub()}
            className="btn btn-secondary w-full"
          >
            <Icon name="github-logo" size={16} />
            {busy === "github" ? "サインイン中…" : "GitHub で続行"}
          </button>

          {authConfig.data && !authConfig.data.github && (
            <p className="m-0 text-[12px] text-text/50">
              API サーバー側で GitHub OAuth が未設定です。
            </p>
          )}

          {error && <p className="m-0 text-[12px] text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function SignInPage() {
  return <AuthCard />;
}
