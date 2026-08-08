import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Favicon } from "@/components/favicon";
import type { SavedUrlDTO } from "@/types/api";

export function ItemRow({ item }: { item: SavedUrlDTO }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="flex items-center gap-3 rounded-md px-2 py-3.5 -mx-2 transition-colors hover:bg-secondary/40"
    >
      <Favicon src={item.faviconUrl} domain={item.domain} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{item.title || item.url}</div>
        <div className="truncate text-[11.5px] text-muted-foreground">
          {item.domain}
          {item.estimatedReadMinutes ? ` · ${item.estimatedReadMinutes} min` : ""}
          {item.fetchStatus === "error" ? " · fetch failed" : ""}
        </div>
      </div>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
