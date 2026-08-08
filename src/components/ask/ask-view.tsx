"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2, MessageCircleQuestion } from "lucide-react";
import { toast } from "sonner";
import { useAskMutation, useAskThreadsQuery } from "@/hooks/use-ask";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AskView() {
  const t = useTranslations("ask");
  const [question, setQuestion] = useState("");
  const ask = useAskMutation();
  const threads = useAskThreadsQuery();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    ask.mutate(question.trim(), {
      onSuccess: (result) => router.push(`/ask/${result.thread.id}`),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong."),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <form onSubmit={handleSubmit} className="mb-10">
        <div
          className="flex items-center gap-3 rounded-lg bg-card px-4 py-3.5"
          style={{ boxShadow: "0 0 0 1px var(--primary)" }}
        >
          <Search className="size-[18px] shrink-0 text-primary" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("placeholder")}
            className="w-full bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
            disabled={ask.isPending}
            autoFocus
          />
          {ask.isPending ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Button type="submit" size="sm" disabled={!question.trim()}>
              {t("newThread")}
            </Button>
          )}
        </div>
      </form>

      <div className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">
        {t("threads")}
      </div>

      {threads.isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
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
          <li key={thread.id}>
            <Link
              href={`/ask/${thread.id}`}
              className="block truncate rounded-md px-2 py-3 text-sm transition-colors hover:bg-secondary/40"
            >
              {thread.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
