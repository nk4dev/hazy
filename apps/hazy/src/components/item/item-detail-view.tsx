"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, ExternalLink, Loader2, NotebookPen, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Favicon } from "@/components/favicon";
import { AddToCollectionButton } from "@/components/item/add-to-collection-button";
import { ItemTagsEditor } from "@/components/item/item-tags-editor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useItemQuery, useRefetchItemMutation } from "@/hooks/use-item";
import { useDeleteItemMutation } from "@/hooks/use-items";
import { useRouter } from "@/i18n/navigation";

export function ItemDetailView({ id }: { id: string }) {
  const t = useTranslations("item");
  const { data: item, isLoading } = useItemQuery(id);
  const refetch = useRefetchItemMutation(id);
  const del = useDeleteItemMutation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const readLaterMutation = useMutation({
    mutationFn: async (status: "inbox" | "archived") => {
      const res = await fetch(`/api/v1/read-later/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update read later");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["read-later"] });
      toast.success(t("readLater"));
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-10">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!item) return null;

  // hazy-note is a separate app on the same database — the saved_urls row has
  // the same id there. Deep-link into its capture flow for this item.
  const hazyNoteUrl = process.env.NEXT_PUBLIC_HAZY_NOTE_URL || "http://localhost:3000";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-6 py-10">
      <div className="mb-4 flex items-center gap-3">
        <Favicon src={item.faviconUrl} domain={item.domain} size={22} />
        {item.domain ? (
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            onClick={() =>
              router.push(`/library?q=${encodeURIComponent(`domain:${item.domain}`)}`)
            }
          >
            {item.domain}
          </button>
        ) : null}
        {item.estimatedReadMinutes && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {item.estimatedReadMinutes} min
          </span>
        )}
      </div>

      <h1 className="mb-3 text-[26px] font-medium leading-tight">{item.title || item.url}</h1>

      {item.ogImageUrl && (
        // biome-ignore lint/performance/noImgElement: arbitrary external OG image, not worth next/image's overhead
        <img
          src={item.ogImageUrl}
          alt=""
          className="mb-5 w-full rounded-lg object-cover"
          style={{ maxHeight: 320 }}
        />
      )}

      {item.fetchStatus === "error" && (
        <div className="mb-5 rounded-md bg-secondary p-3 text-sm text-muted-foreground">
          {item.fetchError ?? "Could not fetch this page's details."}
        </div>
      )}

      {item.description && (
        <p className="mb-6 max-w-prose text-[15px] leading-relaxed text-foreground/90">
          {item.description}
        </p>
      )}

      <ItemTagsEditor item={item} />

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="gap-1.5">
          <a href={item.url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            {t("openOriginal")}
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={`${hazyNoteUrl}/capture?id=${id}`} target="_blank" rel="noreferrer">
            <NotebookPen className="size-3.5" />
            {t("openInNote")}
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => readLaterMutation.mutate("inbox")}
          disabled={readLaterMutation.isPending}
        >
          <Clock className="size-3.5" />
          {t("readLater")}
        </Button>
        <AddToCollectionButton savedUrlId={id} />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => refetch.mutate()}
          disabled={refetch.isPending}
        >
          {refetch.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {t("refetch")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={() =>
            del.mutate(id, {
              onSuccess: () => router.push("/library"),
            })
          }
          disabled={del.isPending}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
