"use client";

import type { AskCitationDTO, AskMessageDTO } from "@repo/api-client";
import { ArrowUp, ArrowUpRight, ChevronLeft, Loader2, Sparkle, Trash2 } from "lucide-react";
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

function CitationCard({ citation }: { citation: AskCitationDTO }) {
  return (
    <Link
      href={`/item/${citation.savedUrlId}`}
      className="hz-interactive flex min-h-11 items-center gap-3 px-3.5 py-2.5"
    >
      <span className="grid size-5 shrink-0 place-items-center rounded-md bg-secondary text-[10.5px] font-medium text-muted-foreground">
        {citation.rank}
      </span>
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-[14px] font-medium">{citation.title || citation.url}</span>
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
    <div className="animate-hz-rise mb-10">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/15">
          <Sparkle className="size-3.5 text-primary" />
        </span>
        <span className="hz-eyebrow text-primary">{t("thinkingOf")}</span>
      </div>
      <p className="mb-5 max-w-[64ch] whitespace-pre-wrap text-[16px] leading-relaxed">
        {message.content}
      </p>
      {citations.length > 0 && (
        <>
          <h3 className="hz-eyebrow mb-2 px-1">{t("fromLibrary")}</h3>
          <div className="hz-surface flex flex-col divide-y divide-border/70 overflow-hidden">
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
  const tNav = useTranslations("nav");
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
      <div className="hz-page max-w-2xl gap-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="hz-page max-w-2xl pb-0">
      <div className="mb-8 flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="-ml-2 shrink-0 text-muted-foreground"
          aria-label={tNav("ask")}
        >
          <Link href="/ask">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-medium">{data.thread.title}</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
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
          <div key={message.id} className="animate-hz-rise mb-6 flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] leading-relaxed">
              {message.content}
            </div>
          </div>
        )
      )}

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 mt-auto flex flex-col gap-2 bg-gradient-to-t from-background from-70% to-transparent px-4 pt-6 pb-4 sm:bottom-0 sm:-mx-6 sm:px-6 sm:pb-6"
      >
        <AttachedCollections
          selectedIds={collectionIds}
          onRemove={(id) => setCollectionIds((ids) => ids.filter((x) => x !== id))}
        />
        <div className="hz-surface flex items-center gap-2 py-1.5 pr-1.5 pl-3.5 transition-[box-shadow] focus-within:ring-2 focus-within:ring-primary/60">
          <CollectionMentionField
            value={question}
            onChange={setQuestion}
            selectedIds={collectionIds}
            onAdd={(id) => setCollectionIds((ids) => [...ids, id])}
            placeholder={t("followUp")}
            className="flex-1"
            inputClassName="h-9 text-[16px] placeholder:text-muted-foreground"
            menuPlacement="top"
            disabled={followUp.isPending}
          />
          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            aria-label={t("followUp")}
            disabled={followUp.isPending || !question.trim()}
          >
            {followUp.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
