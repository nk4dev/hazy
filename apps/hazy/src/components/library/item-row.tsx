import type { SavedUrlDTO } from "@repo/api-client";
import { ArrowUpRight, Loader2, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Favicon } from "@/components/favicon";
import { Button } from "@/components/ui/button";
import { useSummarizeItemMutation } from "@/hooks/use-item";
import { Link } from "@/i18n/navigation";
import { plainPreview } from "@/lib/utils";

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
        className="hz-interactive -mx-3 flex min-w-0 flex-1 items-start gap-3 rounded-xl px-3 py-3.5"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Favicon src={item.faviconUrl} domain={item.domain} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[14.5px] font-medium leading-snug">
            {item.title || item.url}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.domain}
            {item.estimatedReadMinutes ? ` · ${item.estimatedReadMinutes} min` : ""}
            {item.fetchStatus === "error" ? " · fetch failed" : ""}
          </div>
          {item.summary && (
            <div className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-foreground/75">
              {plainPreview(item.summary)}
            </div>
          )}
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground/60 transition-[color,transform] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-muted-foreground" />
      </Link>
      {showSummarize && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hz-reveal shrink-0 text-muted-foreground hover:text-primary"
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
          size="icon"
          className="hz-reveal shrink-0 text-muted-foreground hover:text-destructive"
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
