"use client";

import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { Plug } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Favicon } from "@/components/favicon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnectedAppsQuery, useRevokeConnectedAppMutation } from "@/hooks/use-connected-apps";

export function ConnectedAppsView() {
  const t = useTranslations("settings.connections");
  const locale = useLocale();
  const { data, isLoading, isError, refetch } = useConnectedAppsQuery();
  const revoke = useRevokeConnectedAppMutation();
  const dateLocale = locale === "ja" ? ja : undefined;

  return (
    <div className="flex flex-col">

      {isLoading && <Skeleton className="h-36 w-full rounded-xl" />}

      {isError && (
        <div className="hz-surface flex items-center justify-between gap-4 px-4 py-3.5 text-sm text-muted-foreground">
          {t("loadFailed")}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="hz-surface animate-hz-rise flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
          <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
            <Plug className="size-5" />
          </span>
          {t("empty")}
        </div>
      )}

      {data && data.items.length > 0 && (
        <ul className="hz-surface animate-hz-rise divide-y divide-border/70 overflow-hidden">
          {data.items.map((app) => {
            const domain = new URL(app.clientOrigin).hostname;
            return (
              <li key={app.id} className="flex items-center gap-3 px-4 py-3.5">
                <Favicon src={null} domain={domain} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px]">{app.clientName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {domain} ·{" "}
                    {app.lastUsedAt
                      ? t("lastUsed", {
                          when: formatDistanceToNow(new Date(app.lastUsedAt), {
                            addSuffix: true,
                            locale: dateLocale,
                          }),
                        })
                      : t("neverUsed")}
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 rounded-full px-3.5"
                  disabled={revoke.isPending && revoke.variables === app.id}
                  onClick={() =>
                    revoke.mutate(app.id, {
                      onSuccess: () => toast.success(t("revoked", { name: app.clientName })),
                      onError: () => toast.error(t("revokeFailed")),
                    })
                  }
                >
                  {t("revoke")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 px-1 text-[13px] leading-relaxed text-muted-foreground">{t("note")}</p>
    </div>
  );
}
