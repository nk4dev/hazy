"use client";

import { useTranslations } from "next-intl";
import { useCollectionQuery } from "@/hooks/use-collections";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemRow } from "@/components/library/item-row";

export function CollectionDetailView({ id }: { id: string }) {
  const t = useTranslations("collections");
  const { data, isLoading } = useCollectionQuery(id);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
      <h1 className="mb-1 text-2xl font-medium">{data.name}</h1>
      {data.description && (
        <p className="mb-6 text-sm text-muted-foreground">{data.description}</p>
      )}
      {data.items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {data.items.map((item) => (
            <li key={item.id}>
              <ItemRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
