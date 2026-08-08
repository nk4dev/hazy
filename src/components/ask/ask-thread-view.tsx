"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkle, ArrowUpRight, Loader2, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { useAskThreadQuery, useAskFollowUpMutation } from "@/hooks/use-ask";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AskCitationDTO, AskMessageDTO } from "@/types/api";

function CitationCard({ citation }: { citation: AskCitationDTO }) {
  return (
    <Link
      href={`/item/${citation.savedUrlId}`}
      className="flex items-start gap-3 rounded-md bg-card p-3.5 transition-colors hover:bg-secondary/60"
    >
      <span className="grid size-[26px] shrink-0 place-items-center rounded-md bg-secondary text-[11px] text-muted-foreground">
        {citation.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          <span className="text-[15px] font-medium">{citation.title || citation.url}</span>
          <span className="text-[11.5px] text-muted-foreground">{citation.domain}</span>
        </div>
        {citation.snippet && (
          <p className="text-[13px] leading-relaxed text-foreground/75">{citation.snippet}</p>
        )}
      </div>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function AssistantMessage({ message, t }: { message: AskMessageDTO; t: ReturnType<typeof useTranslations> }) {
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
          <div className="flex flex-col gap-2">
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
  const { data, isLoading } = useAskThreadQuery(threadId);
  const followUp = useAskFollowUpMutation(threadId);
  const [question, setQuestion] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    followUp.mutate(question.trim(), {
      onSuccess: () => setQuestion(""),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong."),
    });
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
      <h1 className="mb-8 text-lg font-medium text-muted-foreground">{data.thread.title}</h1>

      {data.messages.map((message) =>
        message.role === "assistant" ? (
          <AssistantMessage key={message.id} message={message} t={t} />
        ) : (
          <div key={message.id} className="mb-4 flex items-center gap-2 text-[15px] text-foreground/90">
            <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
            {message.content}
          </div>
        )
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("followUp")}
          disabled={followUp.isPending}
        />
        <Button type="submit" size="sm" disabled={followUp.isPending || !question.trim()}>
          {followUp.isPending ? <Loader2 className="size-4 animate-spin" /> : t("followUp")}
        </Button>
      </form>
    </div>
  );
}
