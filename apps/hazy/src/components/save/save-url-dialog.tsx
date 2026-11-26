"use client";

import { Check, ClipboardPaste, Download, Loader2, Plus } from "lucide-react";
import { useTranslations } from "@/i18n";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useCollectionsQuery } from "@/hooks/use-collections";
import { useSaveUrlMutation } from "@/hooks/use-items";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** x.com / twitter.com URLs block scraping, so metadata + images never come
 *  through — fxtwitter.com mirrors the same path and actually serves them. */
function fxtwitterUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "x.com" && host !== "twitter.com") return null;
  parsed.hostname = "fxtwitter.com";
  return parsed.toString();
}

export function SaveUrlDialog({
  triggerLabel,
  trigger,
}: {
  triggerLabel: string;
  /** Custom trigger element (the mobile bottom bar); defaults to the header button. */
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("save");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const { data: collectionsData } = useCollectionsQuery();
  const mutation = useSaveUrlMutation();
  const router = useRouter();

  const fxUrl = useMemo(() => fxtwitterUrl(url.trim()), [url]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelectedCollectionIds([]);
    }
  }

  function toggleCollection(id: string) {
    setSelectedCollectionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handlePaste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) setUrl(text);
      else toast.error(t("pasteEmpty"));
    } catch {
      // Permission denied, insecure context, or no clipboard API (some in-app browsers).
      toast.error(t("pasteFailed"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    mutation.mutate(
      { url: url.trim(), collectionIds: selectedCollectionIds },
      {
        onSuccess: (saved) => {
          setOpen(false);
          setUrl("");
          setSelectedCollectionIds([]);
          toast.success(saved.title ?? saved.url);
          router.push(`/item/${saved.id}`);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Could not save that link.");
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-10 gap-1.5 rounded-full px-3.5 sm:h-9">
            <Plus className="size-4" />
            <span className="hidden sm:inline">{triggerLabel}</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {mutation.isPending ? t("fetching") : t("urlPlaceholder")}
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 flex flex-col gap-2">
            <Label htmlFor="save-url-input">{t("urlLabel")}</Label>
            <div className="flex gap-2">
              <Input
                id="save-url-input"
                autoFocus
                placeholder={t("urlPlaceholder")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={mutation.isPending}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={handlePaste}
                disabled={mutation.isPending}
              >
                <ClipboardPaste className="size-4" />
                {t("paste")}
              </Button>
            </div>
            {fxUrl && (
              <a
                href={fxUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <Download className="size-3" />
                {t("fxtwitterHint")}
              </a>
            )}
            {(collectionsData?.items.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                <Label>{t("collectionsLabel")}</Label>
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {collectionsData?.items.map((collection) => {
                    const selected = selectedCollectionIds.includes(collection.id);
                    return (
                      <button
                        key={collection.id}
                        type="button"
                        aria-pressed={selected}
                        disabled={mutation.isPending}
                        onClick={() => toggleCollection(collection.id)}
                        className={cn(
                          "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                          selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        )}
                      >
                        {selected && <Check className="size-3 shrink-0 text-primary" />}
                        <span className="truncate">{collection.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || !url.trim()} className="gap-2">
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
