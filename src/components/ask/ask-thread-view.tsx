"use client";

import { ArrowUpRight, CornerDownRight, Loader2, Sparkle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { AttachedCollections, CollectionMentionField } from "@/components/ask/collection-mention";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAskFollowUpMutation,
  useAskThreadQuery,
  useDeleteAskThreadMutation,
} from "@/hooks/use-ask";
import { Link, useRouter } from "@/i18n/navigation";
import type { AskCitationDTO, AskMessageDTO } from "@/types/api";

function CitationCard({ citation }: { citation: AskCitationDTO }) {
  return (
    <Link
      href={`/item/${citation.savedUrlId}`}
      className="flex items-center gap-2.5 rounded-md bg-card px-2.5 py-2 transition-colors hover:bg-secondary/60"
    >
      <span className="grid size-[18px] shrink-0 place-items-center rounded bg-secondary text-[10px] text-muted-foreground">
        {citation.rank}
      </span>
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-[13.5px] font-medium">{citation.title || citation.url}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{citation.domain}</span>
      </div>
      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function AssistantMessage({
  message,
  t,
}: {
  message: AskMessageDTO;
  t: ReturnType<typeof useTranslations>;
}) {
  const citations = message.citations ?? [];
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <Sparkle className="size-3.5 text-primary" />
        <span className="text-[10px] uppercase tracking-wide text-primary">{t("thinkingOf")}</span>
      </div>
      <p className="mb-5 max-w-[64ch] text-[16px] leading-relaxed">{message.content}</p>
      {citations.length > 0 && (
        <>
          <div className="mb-3 flex items-baseline gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("fromLibrary")}
          </div>
          <div className="flex flex-col gap-1">
            {citations.map((c) => (
              <CitationCard key={c.savedUrlId} citation={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AskThreadView({ threadId }: { threadId: string }) {
  const t = useTranslations("ask");
  const tCommon = useTranslations("common");
  const { data, isLoading } = useAskThreadQuery(threadId);
  const followUp = useAskFollowUpMutation(threadId);
  const deleteThread = useDeleteAskThreadMutation();
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);

  function handleDelete() {
    deleteThread.mutate(threadId, {
      onSuccess: () => router.push("/ask"),
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Something went wrong."),
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    followUp.mutate(
      { question: question.trim(), collectionIds },
      {
        onSuccess: () => {
          setQuestion("");
          setCollectionIds([]);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Something went wrong."),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-10">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
      <div className="mb-8 flex items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-lg font-medium text-muted-foreground">
          {data.thread.title}
        </h1>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={tCommon("delete")}
          disabled={deleteThread.isPending}
          onClick={handleDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {data.messages.map((message) =>
        message.role === "assistant" ? (
          <AssistantMessage key={message.id} message={message} t={t} />
        ) : (
          <div
            key={message.id}
            className="mb-4 flex items-center gap-2 text-[15px] text-foreground/90"
          >
            <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
            {message.content}
          </div>
        )
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
        <AttachedCollections
          selectedIds={collectionIds}
          onRemove={(id) => setCollectionIds((ids) => ids.filter((x) => x !== id))}
        />
        <div className="flex items-center gap-2">
          <CollectionMentionField
            value={question}
            onChange={setQuestion}
            selectedIds={collectionIds}
            onAdd={(id) => setCollectionIds((ids) => [...ids, id])}
            placeholder={t("followUp")}
            className="flex-1"
            inputClassName="h-8 rounded-lg border border-input px-2.5 text-sm focus-visible:border-ring"
            menuPlacement="top"
            disabled={followUp.isPending}
          />
          <Button type="submit" size="sm" disabled={followUp.isPending || !question.trim()}>
            {followUp.isPending ? <Loader2 className="size-4 animate-spin" /> : t("followUp")}
          </Button>
        </div>
      </form>
    </div>
  );
}
