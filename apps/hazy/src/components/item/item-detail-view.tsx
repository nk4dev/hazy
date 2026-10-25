"use client";

import {
  Clock,
  Download,
  ExternalLink,
  Loader2,
  NotebookPen,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Favicon } from "@/components/favicon";
import { AddToCollectionButton } from "@/components/item/add-to-collection-button";
import { EditableField } from "@/components/item/editable-field";
import { ItemTagsEditor } from "@/components/item/item-tags-editor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDownloadItemImageMutation,
  useItemQuery,
  useRefetchItemMutation,
  useUpdateItemMutation,
} from "@/hooks/use-item";
import { useDeleteItemMutation } from "@/hooks/use-items";
import { useSetReadLaterStatus } from "@/hooks/use-read-later";
import { useRouter } from "@/i18n/navigation";

// x.com / twitter.com block image scraping outright — the "download image"
// action falls back to fxtwitter.com server-side (see apps/api's
// lib/metadata/x-fallback.ts), so it only makes sense to show for those hosts.
const X_DOMAINS = new Set(["x.com", "twitter.com"]);

export function ItemDetailView({ id }: { id: string }) {
  const t = useTranslations("item");
  const { data: item, isLoading } = useItemQuery(id);
  const refetch = useRefetchItemMutation(id);
  const update = useUpdateItemMutation(id);
  const del = useDeleteItemMutation();
  const downloadImage = useDownloadItemImageMutation(id);
  const router = useRouter();

  function handleDownloadImage() {
    downloadImage.mutate(undefined, {
      onSuccess: ({ blob, contentType }) => {
        const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
        const filename = `${item?.domain ?? "x"}-${id.slice(0, 8)}.${ext}`;
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Could not download the image."),
    });
  }

  function commitField(field: "title" | "domain", next: string | null) {
    update.mutate(
      { [field]: next },
      {
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Something went wrong."),
      }
    );
  }

  const setReadLaterStatus = useSetReadLaterStatus();
  const readLaterMutation = {
    mutate: (status: "inbox" | "archived") =>
      setReadLaterStatus.mutate(
        { itemId: id, status },
        { onSuccess: () => toast.success(t("readLater")) }
      ),
    isPending: setReadLaterStatus.isPending,
  };

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
        <EditableField
          value={item.domain}
          placeholder={t("addSite")}
          label={t("site")}
          pending={update.isPending}
          onCommit={(next) => commitField("domain", next)}
          className="text-sm"
          valueClassName="text-muted-foreground hover:text-foreground"
          onValueClick={() =>
            item.domain && router.push(`/library?q=${encodeURIComponent(`domain:${item.domain}`)}`)
          }
        />
        {item.estimatedReadMinutes && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {item.estimatedReadMinutes} min
          </span>
        )}
      </div>

      <h1 className="mb-3 text-[26px] font-medium leading-tight">
        <EditableField
          value={item.title}
          placeholder={item.url}
          label={t("title")}
          pending={update.isPending}
          onCommit={(next) => commitField("title", next)}
          inputClassName="text-[26px] font-medium h-auto"
        />
      </h1>

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
        {item.domain && X_DOMAINS.has(item.domain) && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleDownloadImage}
            disabled={downloadImage.isPending}
          >
            {downloadImage.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {t("downloadImage")}
          </Button>
        )}
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
