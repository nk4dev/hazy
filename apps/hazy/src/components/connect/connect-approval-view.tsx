"use client";

import { ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthorizeConnectMutation } from "@/hooks/use-connected-apps";

/** Mirrors the API's `redirectUriSchema` — the server re-validates, this just avoids a dead-end click. */
function parseRedirectUri(raw: string | null): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.hash) return null;
  if (url.protocol === "https:") return url;
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return url;
  }
  return null;
}

function redirectBack(base: URL, params: Record<string, string>) {
  const target = new URL(base);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  window.location.assign(target.toString());
}

export function ConnectApprovalView() {
  const t = useTranslations("connect");
  const search = useSearchParams();
  const authorize = useAuthorizeConnectMutation();
  const [failed, setFailed] = useState(false);

  const clientName = search.get("client_name")?.trim() ?? "";
  const redirectUri = parseRedirectUri(search.get("redirect_uri"));
  const codeChallenge = search.get("code_challenge") ?? "";
  const state = search.get("state");
  const valid = Boolean(clientName && redirectUri && codeChallenge);

  if (!valid || !redirectUri) {
    return <p className="max-w-sm text-center text-sm text-muted-foreground">{t("invalid")}</p>;
  }

  const stateParam: Record<string, string> = state ? { state } : {};

  return (
    <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl bg-card p-6 ring-1 ring-border">
      <div className="flex flex-col gap-1.5">
        <ShieldCheck className="size-5 text-primary" />
        <h1 className="text-lg font-medium">{t("title", { name: clientName })}</h1>
        <p className="break-all text-xs text-muted-foreground">{redirectUri.origin}</p>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{t("scope")}</p>
      {failed && <p className="text-sm text-destructive">{t("failed")}</p>}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="flex-1"
          disabled={authorize.isPending}
          onClick={() => redirectBack(redirectUri, { error: "access_denied", ...stateParam })}
        >
          {t("deny")}
        </Button>
        <Button
          className="flex-1"
          disabled={authorize.isPending}
          onClick={() => {
            setFailed(false);
            authorize.mutate(
              {
                clientName,
                redirectUri: redirectUri.toString(),
                codeChallenge,
                codeChallengeMethod: "S256",
              },
              {
                onSuccess: ({ code }) => redirectBack(redirectUri, { code, ...stateParam }),
                onError: () => setFailed(true),
              }
            );
          }}
        >
          {t("approve")}
        </Button>
      </div>
    </div>
  );
}
