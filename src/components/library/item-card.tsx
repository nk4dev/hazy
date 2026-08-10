import { Link } from "@/i18n/navigation";
import { Favicon } from "@/components/favicon";
import type { SavedUrlDTO } from "@/types/api";

export function ItemCard({ item }: { item: SavedUrlDTO }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="flex flex-col overflow-hidden rounded-lg bg-card transition-colors hover:bg-secondary/60"
    >
      <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden bg-secondary">
        {item.ogImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.ogImageUrl} alt="" className="size-full object-cover" />
        ) : (
          <Favicon src={item.faviconUrl} domain={item.domain} size={28} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="line-clamp-2 text-[13.5px] font-medium leading-snug">
          {item.title || item.url}
        </div>
        <div className="mt-auto truncate text-[11px] text-muted-foreground">
          {item.domain}
          {item.estimatedReadMinutes ? ` · ${item.estimatedReadMinutes} min` : ""}
          {item.fetchStatus === "error" ? " · fetch failed" : ""}
        </div>
      </div>
    </Link>
  );
}
