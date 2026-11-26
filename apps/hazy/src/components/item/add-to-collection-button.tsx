"use client";

import { FolderPlus, Loader2, Plus } from "lucide-react";
import { useTranslations } from "@/i18n";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import {
  useCollectionsQuery,
  useCreateCollectionMutation,
  useSetItemCollectionsMutation,
} from "@/hooks/use-collections";

function sameSelection(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

export function AddToCollectionButton({
  savedUrlId,
  collectionIds,
}: {
  savedUrlId: string;
  collectionIds: string[];
}) {
  const t = useTranslations("item");
  const tCollections = useTranslations("collections");
  const tCommon = useTranslations("common");
  const { data } = useCollectionsQuery();
  const setCollections = useSetItemCollectionsMutation(savedUrlId);
  const create = useCreateCollectionMutation();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(collectionIds);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setDraftIds(collectionIds);
    setOpen(nextOpen);
  }

  function toggleCollection(collectionId: string, checked: boolean) {
    setDraftIds((prev) =>
      checked
        ? prev.includes(collectionId)
          ? prev
          : [...prev, collectionId]
        : prev.filter((id) => id !== collectionId)
    );
  }

  function handleSave() {
    setCollections.mutate(draftIds, {
      onSuccess: () => {
        setOpen(false);
        toast.success(t("collectionsUpdated"));
      },
      onError: () => toast.error(t("collectionsSaveFailed")),
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: (collection) => {
          const nextIds = [...new Set([...draftIds, collection.id])];
          setDraftIds(nextIds);
          setCollections.mutate(nextIds, {
            onSuccess: () => toast.success(collection.name),
            onError: () => toast.error(t("collectionsSaveFailed")),
          });
          setCreateOpen(false);
          setName("");
        },
      }
    );
  }

  const hasChanges = !sameSelection(draftIds, collectionIds);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FolderPlus className="size-3.5" />
            {t("addToCollection")}
            {collectionIds.length > 0 && (
              <span className="rounded-full bg-secondary px-1.5 text-[11px] font-medium text-foreground">
                {collectionIds.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          collisionPadding={16}
          className="w-auto max-w-72 min-w-52"
        >
          {(data?.items.length ?? 0) === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">{tCollections("empty")}</div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {data?.items.map((collection) => (
                <DropdownMenuCheckboxItem
                  key={collection.id}
                  checked={draftIds.includes(collection.id)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) => toggleCollection(collection.id, Boolean(checked))}
                >
                  <span className="truncate">{collection.name}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          )}
          <DropdownMenuSeparator />
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
          {(data?.items.length ?? 0) > 0 && (
            <div className="p-1 pt-1.5">
              <Button
                type="button"
                size="sm"
                className="w-full gap-1.5"
                disabled={!hasChanges || setCollections.isPending}
                onClick={handleSave}
              >
                {setCollections.isPending && <Loader2 className="size-3.5 animate-spin" />}
                {tCommon("save")}
              </Button>
            </div>
          )}
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
