"use client";

import type { SavedUrlDTO } from "@repo/api-client";
import { Inbox, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ItemCard } from "@/components/library/item-card";
import { ItemRow } from "@/components/library/item-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { useItemsQuery } from "@/hooks/use-items";
import { useSearchQuery } from "@/hooks/use-search";
import { useViewMode, type ViewMode } from "@/hooks/use-view-mode";
import { cn } from "@/lib/utils";

/** Staggers the first screenful of items in; later pages appear without delay. */
function riseDelay(index: number) {
  return { animationDelay: `${Math.min(index, 12) * 25}ms` };
}

function ItemList({ items, view }: { items: SavedUrlDTO[]; view: ViewMode }) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {items.map((item, i) => (
          <div key={item.id} className="animate-hz-rise flex" style={riseDelay(i)}>
            <ItemCard item={item} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className="flex flex-col">
      {items.map((item, i) => (
        <li key={item.id} className="animate-hz-rise" style={riseDelay(i)}>
          <ItemRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: rows }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static-length placeholder list, never reordered
        <div key={i} className="flex items-start gap-3 py-3.5">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LibraryView({ initialQuery = "" }: { initialQuery?: string }) {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const tSearch = useTranslations("search");
  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useViewMode("hazy:library-view-mode");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useItemsQuery("newest");
  const search = useSearchQuery(query);

  const isSearching = query.trim().length > 0;
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const searchResults = search.data?.items ?? [];

  return (
    <div
      className={cn(
        "hz-page transition-[max-width] duration-200",
        view === "grid" ? "max-w-[110rem] lg:px-8 xl:px-12" : "max-w-3xl"
      )}
    >
      <div className="mb-4 flex items-end gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-2xl font-medium tracking-tight">{t("title")}</h1>
          <span className="h-4 text-xs text-muted-foreground">
            {isSearching
              ? !search.isLoading && tSearch("resultCount", { count: searchResults.length })
              : !isLoading && t("itemCount", { count: items.length })}
          </span>
        </div>
        <div className="ml-auto">
          <ViewModeToggle view={view} onChange={setView} />
        </div>
      </div>

      <div className="sticky top-[env(safe-area-inset-top)] sm:top-14 z-10 -mx-4 mb-4 bg-background/80 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-[22px] size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tSearch("placeholder")}
            className="peer h-11 rounded-xl bg-card pl-10 pr-10 dark:bg-card"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-[22px] flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={tCommon("close")}
            >
              <X className="size-4" />
            </button>
          )}
          <p className="hidden px-1 pt-1.5 text-[11px] text-muted-foreground peer-focus:block">
            {tSearch("filterHint")}
          </p>
        </div>
      </div>

      {isSearching ? (
        <>
          {search.isLoading && <ListSkeleton rows={3} />}
          {!search.isLoading && searchResults.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {tSearch("noResults")}
            </p>
          )}
          <ItemList items={searchResults} view={view} />
        </>
      ) : (
        <>
          {isLoading && <ListSkeleton rows={6} />}

          {!isLoading && items.length === 0 && (
            <div className="hz-surface animate-hz-rise flex flex-col items-center gap-4 px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
                <Inbox className="size-5 text-muted-foreground" />
              </span>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{t("empty")}</p>
            </div>
          )}

          <ItemList items={items} view={view} />

          {hasNextPage && (
            <Button
              variant="outline"
              className="mt-6 h-10 self-center rounded-full px-5"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? tCommon("loading") : t("more")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
