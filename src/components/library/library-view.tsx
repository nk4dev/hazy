"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Inbox, Search, X } from "lucide-react";
import { useItemsQuery } from "@/hooks/use-items";
import { useSearchQuery } from "@/hooks/use-search";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemRow } from "@/components/library/item-row";

export function LibraryView() {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const tSearch = useTranslations("search");
  const [query, setQuery] = useState("");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useItemsQuery("newest");
  const search = useSearchQuery(query);

  const isSearching = query.trim().length > 0;
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const searchResults = search.data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
      <div className="mb-5 flex items-baseline gap-3">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        {!isLoading && !isSearching && (
          <span className="text-xs text-muted-foreground">
            {t("itemCount", { count: items.length })}
          </span>
        )}
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
          <ul className="flex flex-col divide-y divide-border/60">
            {searchResults.map((item) => (
              <li key={item.id}>
                <ItemRow item={item} />
              </li>
            ))}
          </ul>
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

          <ul className="flex flex-col divide-y divide-border/60">
            {items.map((item) => (
              <li key={item.id}>
                <ItemRow item={item} />
              </li>
            ))}
          </ul>

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
