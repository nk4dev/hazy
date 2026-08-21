"use client";

import { FolderPlus, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollectionsQuery, useCreateCollectionMutation } from "@/hooks/use-collections";
import { Link } from "@/i18n/navigation";

export function CollectionsView() {
  const t = useTranslations("collections");
  const tCommon = useTranslations("common");
  const { data, isLoading } = useCollectionsQuery();
  const create = useCreateCollectionMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
        },
      }
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="ml-auto gap-1.5">
              <FolderPlus className="size-4" />
              {t("create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>{t("create")}</DialogTitle>
              </DialogHeader>
              <Input
                autoFocus
                className="my-4"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
              <DialogFooter>
                <Button type="submit" disabled={create.isPending || !name.trim()}>
                  {tCommon("save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static-length placeholder list, never reordered
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("empty")}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data?.items.map((collection) => (
          <Link
            key={collection.id}
            href={`/collections/${collection.id}`}
            className="flex flex-col gap-2 rounded-lg bg-card p-4 transition-colors hover:bg-secondary/60"
          >
            <Layers className="size-4 text-primary" />
            <div className="text-sm font-medium">{collection.name}</div>
            <div className="text-xs text-muted-foreground">{collection.itemCount}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
