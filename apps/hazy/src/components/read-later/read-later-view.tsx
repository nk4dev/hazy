"use client";

import { Check, Clock, GripVertical, Sparkle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Favicon } from "@/components/favicon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useReadLaterQuery,
  useReadLaterStatsQuery,
  useSetReadLaterStatus,
} from "@/hooks/use-read-later";
import { Link } from "@/i18n/navigation";
import type { SavedUrlDTO } from "@repo/api-client";

function ReadLaterRow({ item }: { item: SavedUrlDTO }) {
  const t = useTranslations("readLater");
  const mutate = useSetReadLaterStatus();

  function snooze() {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    mutate.mutate(
      { itemId: item.id, status: "snoozed", snoozedUntil: tomorrow },
      { onSuccess: () => toast.success(t("later")) }
    );
  }

  function markRead() {
    mutate.mutate(
      { itemId: item.id, status: "read" },
      { onSuccess: () => toast.success(t("readIt")) }
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/40" />
      <Link href={`/item/${item.id}`} className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.title || item.url}</div>
        <div className="truncate text-xs text-muted-foreground">
          {item.domain}
          {item.estimatedReadMinutes ? ` · ${item.estimatedReadMinutes} min` : ""}
        </div>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground"
        onClick={snooze}
      >
        <Clock className="size-3.5" />
        {t("later")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground"
        onClick={markRead}
      >
        <Check className="size-3.5" />
        {t("readIt")}
      </Button>
    </div>
  );
}

export function ReadLaterView() {
  const t = useTranslations("readLater");
  const { data, isLoading } = useReadLaterQuery();
  const { data: stats } = useReadLaterStatsQuery();

  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 px-6 py-8 md:px-9">
        <div className="mb-1 flex items-baseline gap-3">
          <h1 className="text-[22px] font-medium">{t("title")}</h1>
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.totalCount} · {data.totalMinutes} min
            </span>
          )}
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{t("subtitle")}</p>

        {isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        )}

        {data && data.todaysThree.length > 0 && (
          <div
            className="mb-6 rounded-lg bg-card p-4"
            style={{ boxShadow: "0 0 0 1px var(--accent-800)" }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Sparkle className="size-3.5 text-primary" />
              <span className="text-[10.5px] uppercase tracking-wide text-primary">
                {t("todaysThree")} · {data.todaysThreeMinutes} min
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {data.todaysThree.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-md bg-secondary px-3 py-2.5"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded bg-[var(--accent-800)] text-[10px] text-[var(--accent-100)]">
                    {i + 1}
                  </span>
                  <Link href={`/item/${item.id}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.title || item.url}</div>
                    <div className="truncate text-[11.5px] text-muted-foreground">
                      {item.domain}
                      {item.estimatedReadMinutes ? ` · ${item.estimatedReadMinutes} min` : ""}
                    </div>
                  </Link>
                  <Favicon src={item.faviconUrl} domain={item.domain} />
                </div>
              ))}
            </div>
          </div>
        )}

        {data && data.fiveMinutes.length > 0 && (
          <>
            <div className="mb-2 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              {t("fiveMinutes")}
            </div>
            <div className="mb-6">
              {data.fiveMinutes.map((item) => (
                <ReadLaterRow key={item.id} item={item} />
              ))}
            </div>
          </>
        )}

        {data && data.sitDown.length > 0 && (
          <>
            <div className="mb-2 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              {t("sitDown")}
            </div>
            <div>
              {data.sitDown.map((item) => (
                <ReadLaterRow key={item.id} item={item} />
              ))}
            </div>
          </>
        )}
      </div>

      <aside className="border-t border-border px-6 py-8 lg:border-l lg:border-t-0">
        <div className="mb-3 text-[10.5px] uppercase tracking-wide text-muted-foreground">
          {t("yourWeek")}
        </div>
        <div className="mb-2 flex h-14 items-end gap-1.5">
          {(stats?.days ?? Array.from({ length: 7 }, () => ({ heightPct: 10, count: 0 }))).map(
            (day, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-day window in stable order, never reordered
                key={i}
                className="flex-1 rounded-sm bg-secondary"
                style={{ height: `${Math.max(day.heightPct, 6)}%` }}
                title={`${day.count}`}
              />
            )
          )}
        </div>
        {stats && (
          <p className="mb-5 text-[12.5px] leading-relaxed text-muted-foreground">
            {stats.readThisWeek} / {stats.savedThisWeek}
          </p>
        )}

        <div className="hz-rule mb-4" />
        <div className="mb-3 text-[10.5px] uppercase tracking-wide text-muted-foreground">
          {t("notifications")}
        </div>
        <div className="mb-5 flex flex-col gap-3">
          <label
            htmlFor="notify-digest"
            className="flex items-center justify-between gap-3 text-[13px]"
          >
            <span>{t("notifyDigest")}</span>
            <Switch id="notify-digest" defaultChecked />
          </label>
          <label
            htmlFor="notify-retire"
            className="flex items-center justify-between gap-3 text-[13px]"
          >
            <span>{t("notifyRetire")}</span>
            <Switch id="notify-retire" />
          </label>
        </div>
        <div className="hz-rule mb-4" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{t("safeToSkip")}</p>
      </aside>
    </div>
  );
}
