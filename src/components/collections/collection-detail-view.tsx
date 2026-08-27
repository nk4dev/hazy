"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CollectionPreview } from "@/components/collections/collection-preview";
import { ItemCard } from "@/components/library/item-card";
import { ItemRow } from "@/components/library/item-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import {
  useCollectionQuery,
  useRemoveFromCollectionMutation,
  useSummarizeCollectionMutation,
} from "@/hooks/use-collections";
import { useViewMode } from "@/hooks/use-view-mode";

export function CollectionDetailView({ id }: { id: string }) {
  const t = useTranslations("collections");
  const { data, isLoading } = useCollectionQuery(id);
  const removeFromCollection = useRemoveFromCollectionMutation();
  const summarize = useSummarizeCollectionMutation(id);
  const [view, setView] = useViewMode("hazy:collection-detail-view-mode");

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const previewImages = data.items
    .map((item) => item.ogImageUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, 4);

  const runSummarize = () =>
    summarize.mutate(undefined, {
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : t("aiSummaryError")),
    });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
      {previewImages.length > 0 && (
        <div className="mb-5 max-w-md overflow-hidden rounded-lg">
          <CollectionPreview images={previewImages} name={data.name} />
        </div>
      )}
      <div className="mb-1 flex items-start gap-3">
        <h1 className="text-2xl font-medium">{data.name}</h1>
        {data.items.length > 0 && (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={summarize.isPending}
              onClick={runSummarize}
            >
              {summarize.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {summarize.isPending ? t("aiSummaryPending") : t("aiSummarize")}
            </Button>
            <ViewModeToggle view={view} onChange={setView} />
          </div>
        )}
      </div>
      {data.description && <p className="mb-4 text-sm text-muted-foreground">{data.description}</p>}

      {data.summary && (
        <div className="mb-6 rounded-lg border border-border/60 bg-card p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" />
            {t("aiSummary")}
          </div>
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90">
            {data.summary}
          </p>
        </div>
      )}

      {data.items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {data.items.map((item) => (
            <li key={item.id}>
              <ItemRow
                item={item}
                showSummarize
                removeLabel={t("remove")}
                removePending={
                  removeFromCollection.isPending &&
                  removeFromCollection.variables?.savedUrlId === item.id
                }
                onRemove={() =>
                  removeFromCollection.mutate(
                    { collectionId: id, savedUrlId: item.id },
                    {
                      onSuccess: () => toast.success(t("removed")),
                      onError: (error) =>
                        toast.error(
                          error instanceof Error ? error.message : "Something went wrong."
                        ),
                    }
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
