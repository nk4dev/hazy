"use client";

import { Loader2, MessageCircleQuestion, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <form onSubmit={handleSubmit} className="mb-10">
        <div
          className="flex flex-col gap-2 rounded-lg bg-card px-4 py-3.5"
          style={{ boxShadow: "0 0 0 1px var(--primary)" }}
        >
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
            {ask.isPending ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Button type="submit" size="sm" disabled={!question.trim()}>
                {t("newThread")}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{t("mentionHint")}</p>
        </div>
      </form>

      <div className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">
        {t("threads")}
      </div>

      {threads.isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static-length placeholder list, never reordered
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {threads.data && threads.data.items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <MessageCircleQuestion className="size-6" />
          <p className="text-sm">{t("noResults")}</p>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-border/60">
        {threads.data?.items.map((thread) => (
          <li key={thread.id} className="group flex items-center gap-1">
            <Link
              href={`/ask/${thread.id}`}
              className="block min-w-0 flex-1 truncate rounded-md px-2 py-3 text-sm transition-colors hover:bg-secondary/40"
            >
              {thread.title}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={tCommon("delete")}
              disabled={deleteThread.isPending}
              onClick={() => deleteThread.mutate(thread.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
