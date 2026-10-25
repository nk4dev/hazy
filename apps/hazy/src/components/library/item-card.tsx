import type { SavedUrlDTO } from "@repo/api-client";
import { Favicon } from "@/components/favicon";
import { Link } from "@/i18n/navigation";

export function ItemCard({ item }: { item: SavedUrlDTO }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="group hz-surface flex w-full flex-col overflow-hidden transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 hover:ring-primary/40 active:scale-[0.985]"
    >
      <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden bg-secondary">
        {item.ogImageUrl ? (
          // biome-ignore lint/performance/noImgElement: arbitrary external OG image, not worth next/image's overhead
          <img
            src={item.ogImageUrl}
            alt=""
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <Favicon src={item.faviconUrl} domain={item.domain} size={28} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="line-clamp-2 text-[14px] font-medium leading-snug">
          {item.title || item.url}
        </div>
        <div className="mt-auto truncate text-xs text-muted-foreground">
          {item.domain}
          {item.estimatedReadMinutes ? ` · ${item.estimatedReadMinutes} min` : ""}
          {item.fetchStatus === "error" ? " · fetch failed" : ""}
        </div>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[10.5px] text-muted-foreground"
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
