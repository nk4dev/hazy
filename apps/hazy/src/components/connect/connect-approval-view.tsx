import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuthorizeConnectMutation } from "@/hooks/use-connected-apps";
import { useTranslations } from "@/i18n";
import { apiClient } from "@/lib/clients";

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
  const location = useLocation();
  const search = useMemo(() => new URLSearchParams(location.searchStr), [location.searchStr]);
  const authorize = useAuthorizeConnectMutation();
  const [failed, setFailed] = useState(false);
  const { data: profilesData } = useQuery({
    queryKey: ["profiles", "list"],
    queryFn: ({ signal }) => apiClient.profiles.list(signal),
  });
  const profiles = profilesData?.items ?? [];
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  useEffect(() => {
    if (!selectedProfileId && profiles.length > 0) {
      const def = profiles.find((p) => p.isDefault) ?? profiles[0];
      if (def) setSelectedProfileId(def.id);
    }
  }, [profiles, selectedProfileId]);

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
      {profiles.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="connect-profile-select" className="text-xs font-medium text-muted-foreground">
            Profile
          </label>
          <select
            id="connect-profile-select"
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.slug})
              </option>
            ))}
          </select>
        </div>
      )}
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
                ...(selectedProfileId ? { profileId: selectedProfileId } : {}),
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
