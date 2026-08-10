"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FolderPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useCollectionsQuery,
  useAddToCollectionMutation,
  useCreateCollectionMutation,
} from "@/hooks/use-collections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AddToCollectionButton({ savedUrlId }: { savedUrlId: string }) {
  const t = useTranslations("item");
  const tCollections = useTranslations("collections");
  const tCommon = useTranslations("common");
  const { data } = useCollectionsQuery();
  const addTo = useAddToCollectionMutation();
  const create = useCreateCollectionMutation();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: (collection) => {
          addTo.mutate(
            { collectionId: collection.id, savedUrlId },
            { onSuccess: () => toast.success(collection.name) }
          );
          setCreateOpen(false);
          setName("");
        },
      }
    );
  }

  return (
    <>
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
          {(data?.items.length ?? 0) > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setOpen(false);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            {tCollections("create")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>{tCollections("create")}</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              className="my-4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tCollections("namePlaceholder")}
            />
            <DialogFooter>
              <Button type="submit" disabled={create.isPending || !name.trim()}>
                {tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
