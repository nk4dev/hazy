"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowUp, Loader2, MessageCircleQuestion, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { AttachedCollections, CollectionMentionField } from "@/components/ask/collection-mention";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAskMutation, useAskThreadsQuery, useDeleteAskThreadMutation } from "@/hooks/use-ask";
import { Link, useRouter } from "@/i18n/navigation";

export function AskView() {
  const t = useTranslations("ask");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const dateLocale = useLocale() === "ja" ? ja : undefined;
  const [question, setQuestion] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const ask = useAskMutation();
  const threads = useAskThreadsQuery();
  const deleteThread = useDeleteAskThreadMutation();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    ask.mutate(
      { question: question.trim(), collectionIds },
      {
        onSuccess: (result) => router.push(`/ask/${result.thread.id}`),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Something went wrong."),
      }
    );
  }

  return (
    <div className="hz-page max-w-2xl sm:pt-14">
      <h1 className="mb-5 text-2xl font-medium tracking-tight">{tNav("ask")}</h1>
      <form onSubmit={handleSubmit} className="mb-10">
        <div className="hz-surface flex flex-col gap-2.5 px-4 pt-3.5 pb-3 transition-[box-shadow] focus-within:ring-2 focus-within:ring-primary/60">
          <AttachedCollections
            selectedIds={collectionIds}
            onRemove={(id) => setCollectionIds((ids) => ids.filter((x) => x !== id))}
          />
          <div className="flex items-center gap-3">
            <Search className="size-[18px] shrink-0 text-primary" />
            <CollectionMentionField
              value={question}
              onChange={setQuestion}
              selectedIds={collectionIds}
              onAdd={(id) => setCollectionIds((ids) => [...ids, id])}
              placeholder={t("placeholder")}
              className="flex-1"
              inputClassName="text-[16px] placeholder:text-muted-foreground"
              disabled={ask.isPending}
            />
          </div>
          <div className="flex items-center gap-3 border-t border-border/70 pt-2.5">
            <p className="min-w-0 flex-1 text-[11.5px] text-muted-foreground">{t("mentionHint")}</p>
            <Button
              type="submit"
              className="h-9 shrink-0 gap-1.5 rounded-full px-4"
              disabled={ask.isPending || !question.trim()}
            >
              {ask.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
              {t("newThread")}
            </Button>
          </div>
        </div>
      </form>

      <h2 className="hz-eyebrow mb-2 px-1">{t("threads")}</h2>

      {threads.isLoading && (
        <div className="flex flex-col gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static-length placeholder list, never reordered
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      )}

      {threads.data && threads.data.items.length === 0 && (
        <div className="hz-surface animate-hz-rise flex flex-col items-center gap-3 px-6 py-12 text-center text-muted-foreground">
          <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
            <MessageCircleQuestion className="size-5" />
          </span>
          <p className="text-sm">{t("noResults")}</p>
        </div>
      )}

      <ul className="flex flex-col">
        {threads.data?.items.map((thread, i) => (
          <li
            key={thread.id}
            className="group animate-hz-rise flex items-center gap-1"
            style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
          >
            <Link
              href={`/ask/${thread.id}`}
              className="hz-interactive -mx-3 flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5"
            >
              <MessageCircleQuestion className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[14.5px]">{thread.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNowStrict(new Date(thread.updatedAt), { locale: dateLocale })}
              </span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hz-reveal shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={tCommon("delete")}
              disabled={deleteThread.isPending}
              onClick={() => deleteThread.mutate(thread.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
