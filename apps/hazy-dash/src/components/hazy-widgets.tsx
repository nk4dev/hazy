"use client";

import type { SavedUrlDTO } from "@repo/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Check, ClipboardPaste, Globe, Loader2, Plus, Sparkle } from "lucide-react";
import { useState } from "react";
import { useDash } from "@/components/dash-provider";
import { HAZY_URL } from "@/lib/env";
import { cn, firstUrl, plainPreview } from "@/lib/utils";

function itemHref(id: string) {
  return new URL(`/item/${id}`, HAZY_URL).toString();
}

function Favicon({ src }: { src: string | null }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
      {src ? (
        // biome-ignore lint/performance/noImgElement: tiny external favicon
        <img src={src} alt="" className="size-4" />
      ) : (
        <Globe className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}

function Card({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("hz-surface flex min-w-0 flex-col gap-3 p-5", className)}>
      <div className="flex items-center gap-2">
        <h2 className="hz-eyebrow flex-1">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Placeholder({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={`row-${i.toString()}`}
          className="h-11 animate-pulse rounded-lg bg-secondary/60"
        />
      ))}
    </div>
  );
}

function ItemLink({ item, meta }: { item: SavedUrlDTO; meta?: string }) {
  return (
    <a
      href={itemHref(item.id)}
      target="_blank"
      rel="noreferrer"
      className="hz-interactive -mx-2 flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2 py-2.5"
    >
      <Favicon src={item.faviconUrl} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 text-[14px] font-medium leading-snug [overflow-wrap:anywhere]">
          {item.title || item.url}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {[item.domain, meta].filter(Boolean).join(" · ")}
        </span>
      </span>
    </a>
  );
}

export function QuickSave() {
  const { client, t } = useDash();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const save = useMutation({
    mutationFn: (value: string) => client.items.save(value),
    onSuccess: (item) => {
      setUrl("");
      setMessage({ ok: true, text: `${t.saved}: ${item.title ?? item.url}` });
      queryClient.invalidateQueries({ queryKey: ["recent"] });
      queryClient.invalidateQueries({ queryKey: ["read-later"] });
    },
    onError: () => setMessage({ ok: false, text: t.saveError }),
  });

  return (
    <Card title={t.quickSave}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) save.mutate(url.trim());
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          inputMode="url"
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3.5 text-[16px] outline-none focus-visible:border-ring sm:text-sm"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              const found = firstUrl(await navigator.clipboard.readText());
              if (found) setUrl(found);
              else setMessage({ ok: false, text: t.clipboardEmpty });
            } catch {
              setMessage({ ok: false, text: t.clipboardEmpty });
            }
          }}
          aria-label={t.paste}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-input text-muted-foreground transition-colors hover:text-foreground"
        >
          <ClipboardPaste className="size-4" />
        </button>
        <button
          type="submit"
          disabled={save.isPending || !url.trim()}
          aria-label={t.save}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-[opacity,transform] active:scale-95 disabled:opacity-50"
        >
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-5" />
          )}
        </button>
      </form>
      {message && (
        <p
          className={cn(
            "truncate text-xs",
            message.ok ? "text-muted-foreground" : "text-destructive"
          )}
        >
          {message.text}
        </p>
      )}
    </Card>
  );
}

export function TodaysThree() {
  const { client, t } = useDash();
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ["read-later"], queryFn: () => client.readLater.queue() });
  const markRead = useMutation({
    mutationFn: (itemId: string) => client.readLater.setStatus({ itemId, status: "read" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["read-later"] });
      queryClient.invalidateQueries({ queryKey: ["week"] });
    },
  });

  return (
    <Card
      title={t.todaysThree}
      aside={
        queue.data && (
          <span className="text-xs text-muted-foreground">
            {t.minutes(queue.data.todaysThreeMinutes)}
          </span>
        )
      }
    >
      {queue.isLoading && <Placeholder />}
      {queue.isError && <p className="text-sm text-muted-foreground">{t.loadError}</p>}
      {queue.data?.todaysThree.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">{t.nothingQueued}</p>
      )}
      <ul className="flex flex-col">
        {queue.data?.todaysThree.map((item) => (
          <li key={item.id} className="flex items-center gap-1">
            <ItemLink
              item={item}
              meta={item.estimatedReadMinutes ? t.minutes(item.estimatedReadMinutes) : undefined}
            />
            <button
              type="button"
              aria-label={t.markRead}
              title={t.markRead}
              disabled={markRead.isPending && markRead.variables === item.id}
              onClick={() => markRead.mutate(item.id)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
            >
              <Check className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function WeekStats() {
  const { client, t, locale } = useDash();
  const stats = useQuery({ queryKey: ["week"], queryFn: () => client.readLater.stats() });
  const labels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(d);
  });

  return (
    <Card
      title={t.week}
      aside={
        stats.data && (
          <span className="text-xs text-muted-foreground">
            {t.readSaved(stats.data.readThisWeek, stats.data.savedThisWeek)}
          </span>
        )
      }
    >
      {stats.isLoading && <div className="h-24 animate-pulse rounded-lg bg-secondary/60" />}
      {stats.isError && <p className="text-sm text-muted-foreground">{t.loadError}</p>}
      {stats.data && (
        <div className="flex h-24 items-end gap-2">
          {stats.data.days.map((d, i) => (
            <div
              key={labels[i] + i.toString()}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <div
                className="w-full rounded-md bg-primary/80"
                style={{ height: `${Math.max(d.heightPct, 4)}%` }}
                title={String(d.count)}
              />
              <span className="text-[10px] text-muted-foreground">{labels[i]}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function RecentSaves() {
  const { client, t } = useDash();
  const recent = useQuery({
    queryKey: ["recent"],
    queryFn: () => client.items.list({ sort: "newest", limit: 6 }),
  });

  return (
    <Card title={t.recent}>
      {recent.isLoading && <Placeholder rows={4} />}
      {recent.isError && <p className="text-sm text-muted-foreground">{t.loadError}</p>}
      <ul className="flex flex-col">
        {recent.data?.items.map((item) => (
          <li key={item.id} className="flex flex-col">
            <ItemLink item={item} />
            {item.summary && (
              <p className="-mt-1 mb-1 line-clamp-2 pl-11 text-xs leading-relaxed text-foreground/70 [overflow-wrap:anywhere]">
                {plainPreview(item.summary)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AskBox() {
  const { client, t } = useDash();
  const [question, setQuestion] = useState("");
  const ask = useMutation({ mutationFn: (q: string) => client.ask.ask({ question: q }) });

  return (
    <Card title={t.ask}>
      <form
        className="flex items-center gap-2 rounded-xl border border-input bg-background py-1.5 pr-1.5 pl-3.5 transition-[box-shadow] focus-within:ring-2 focus-within:ring-primary/60"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) ask.mutate(question.trim());
        }}
      >
        <Sparkle className="size-4 shrink-0 text-primary" />
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t.askPlaceholder}
          className="h-9 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        <button
          type="submit"
          aria-label={t.askSubmit}
          disabled={ask.isPending || !question.trim()}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          {ask.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </button>
      </form>
      {ask.isError && <p className="text-sm text-destructive">{t.loadError}</p>}
      {ask.data && (
        <div className="animate-hz-rise flex flex-col gap-3">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed [overflow-wrap:anywhere]">
            {ask.data.message.content}
          </p>
          {ask.data.citations.length > 0 && (
            <>
              <h3 className="hz-eyebrow">{t.sources}</h3>
              <ul className="flex flex-col">
                {ask.data.citations.map((c) => (
                  <li key={c.savedUrlId}>
                    <a
                      href={itemHref(c.savedUrlId)}
                      target="_blank"
                      rel="noreferrer"
                      className="hz-interactive -mx-2 flex items-center gap-3 rounded-xl px-2 py-2"
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-md bg-secondary text-[10.5px] text-muted-foreground">
                        {c.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{c.title || c.url}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{c.domain}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
