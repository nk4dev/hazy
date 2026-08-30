import { Favicon } from "@/components/favicon";
import { Link } from "@/i18n/navigation";
import type { SavedUrlDTO } from "@repo/api-client";

export function ItemCard({ item }: { item: SavedUrlDTO }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="flex flex-col overflow-hidden rounded-lg bg-card transition-colors hover:bg-secondary/60"
    >
      <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden bg-secondary">
        {item.ogImageUrl ? (
          // biome-ignore lint/performance/noImgElement: arbitrary external OG image, not worth next/image's overhead
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
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="max-w-full truncate rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
