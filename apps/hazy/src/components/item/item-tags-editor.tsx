"use client";

import { Loader2, Plus, Tag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateItemMutation } from "@/hooks/use-item";
import { useRouter } from "@/i18n/navigation";
import type { SavedUrlDTO } from "@repo/api-client";

export function ItemTagsEditor({ item }: { item: SavedUrlDTO }) {
  const t = useTranslations("item");
  const router = useRouter();
  const update = useUpdateItemMutation(item.id);
  const [draft, setDraft] = useState("");

  const tags = item.tags;

  function commit(next: string[]) {
    update.mutate(
      { tags: next },
      {
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Something went wrong."),
      }
    );
  }

  function addTag() {
    const value = draft.trim().toLowerCase();
    setDraft("");
    if (!value || tags.includes(value)) return;
    commit([...tags, value]);
  }

  function removeTag(tag: string) {
    commit(tags.filter((current) => current !== tag));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    } else if (event.key === "Backspace" && !draft && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Tag className="size-3" />
        {t("tags")}
        {update.isPending && <Loader2 className="size-3 animate-spin" />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            <button
              type="button"
              className="max-w-[12rem] truncate hover:underline"
              onClick={() => router.push(`/library?q=${encodeURIComponent(`tag:${tag}`)}`)}
            >
              {tag}
            </button>
            <button
              type="button"
              aria-label={t("removeTag", { tag })}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => removeTag(tag)}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={addTag}
            placeholder={t("addTag")}
            className="h-7 w-32 text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("addTag")}
            disabled={!draft.trim()}
            onClick={addTag}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
