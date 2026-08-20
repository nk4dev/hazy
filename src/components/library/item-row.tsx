import { ArrowUpRight, Loader2, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Favicon } from "@/components/favicon";
import { Button } from "@/components/ui/button";
import { useSummarizeItemMutation } from "@/hooks/use-item";
import { Link } from "@/i18n/navigation";
import type { SavedUrlDTO } from "@/types/api";

export function ItemRow({
  item,
  showSummarize = false,
  onRemove,
  removePending = false,
  removeLabel,
}: {
  item: SavedUrlDTO;
  showSummarize?: boolean;
  onRemove?: () => void;
  removePending?: boolean;
  removeLabel?: string;
}) {
  const t = useTranslations("common");
  const summarize = useSummarizeItemMutation(item.id);

  return (
    <div className="group flex items-center gap-1">
      <Link
        href={`/item/${item.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-3.5 -mx-2 transition-colors hover:bg-secondary/40"
      >
        <Favicon src={item.faviconUrl} domain={item.domain} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium">{item.title || item.url}</div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {item.domain}
            {item.estimatedReadMinutes ? ` · ${item.estimatedReadMinutes} min` : ""}
            {item.fetchStatus === "error" ? " · fetch failed" : ""}
          </div>
          {item.summary && (
            <div className="mt-1 line-clamp-2 text-[12px] text-foreground/80">{item.summary}</div>
          )}
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      {showSummarize && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={t("summarize")}
          disabled={summarize.isPending}
          onClick={() =>
            summarize.mutate(undefined, {
              onError: (error) =>
                toast.error(error instanceof Error ? error.message : "Something went wrong."),
            })
          }
        >
          {summarize.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
        </Button>
      )}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={removeLabel ?? t("delete")}
          disabled={removePending}
          onClick={onRemove}
        >
          {removePending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <X className="size-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}
