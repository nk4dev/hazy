"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox, LayoutGrid, List, Search, X } from "lucide-react";
import { useItemsQuery } from "@/hooks/use-items";
import { useSearchQuery } from "@/hooks/use-search";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemRow } from "@/components/library/item-row";
import { ItemCard } from "@/components/library/item-card";
import type { SavedUrlDTO } from "@/types/api";

type ViewMode = "list" | "grid";
const VIEW_MODE_STORAGE_KEY = "hazy:library-view-mode";

function useViewMode() {
  // Starts as "list" to match server-rendered HTML (no access to
  // localStorage there), then syncs from the stored preference once
  // mounted on the client — reading a browser-only external store on
  // mount, not a state loop, so setState-in-effect is the right call here.
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === "grid") setView("grid");
  }, []);

  function updateView(next: ViewMode) {
    setView(next);
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
  }

  return [view, updateView] as const;
}

function ItemList({ items, view }: { items: SavedUrlDTO[]; view: ViewMode }) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border/60">
      {items.map((item) => (
        <li key={item.id}>
          <ItemRow item={item} />
        </li>
      ))}
    </ul>
  );
}

export function LibraryView() {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const tSearch = useTranslations("search");
  const [query, setQuery] = useState("");
  const [view, setView] = useViewMode();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useItemsQuery("newest");
  const search = useSearchQuery(query);

  const isSearching = query.trim().length > 0;
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const searchResults = search.data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
      <div className="mb-5 flex items-center gap-3">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        {!isLoading && !isSearching && (
          <span className="text-xs text-muted-foreground">
            {t("itemCount", { count: items.length })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5">
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("viewList")}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("viewGrid")}
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tSearch("placeholder")}
          className="pl-9 pr-9"
        />
        {isSearching && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={tCommon("close")}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {isSearching ? (
        <>
          {search.isLoading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}
          {!search.isLoading && (
            <p className="mb-2 text-xs text-muted-foreground">
              {tSearch("resultCount", { count: searchResults.length })}
            </p>
          )}
          {!search.isLoading && searchResults.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{tSearch("noResults")}</p>
          )}
          <ItemList items={searchResults} view={view} />
        </>
      ) : (
        <>
          {isLoading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-lg bg-card py-16 text-center">
              <Inbox className="size-8 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          )}

          <ItemList items={items} view={view} />

          {hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 self-center"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? tCommon("loading") : "More"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
