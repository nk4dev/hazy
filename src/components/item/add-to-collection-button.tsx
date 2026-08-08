"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { useCollectionsQuery, useAddToCollectionMutation } from "@/hooks/use-collections";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AddToCollectionButton({ savedUrlId }: { savedUrlId: string }) {
  const t = useTranslations("item");
  const tCollections = useTranslations("collections");
  const { data } = useCollectionsQuery();
  const addTo = useAddToCollectionMutation();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FolderPlus className="size-3.5" />
          {t("addToCollection")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(data?.items.length ?? 0) === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">{tCollections("empty")}</div>
        )}
        {data?.items.map((collection) => (
          <DropdownMenuItem
            key={collection.id}
            onSelect={() =>
              addTo.mutate(
                { collectionId: collection.id, savedUrlId },
                { onSuccess: () => toast.success(collection.name) }
              )
            }
          >
            {collection.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
