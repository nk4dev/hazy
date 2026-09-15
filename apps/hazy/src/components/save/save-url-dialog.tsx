"use client";

import { Download, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveUrlMutation } from "@/hooks/use-items";
import { useRouter } from "@/i18n/navigation";

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

export function SaveUrlDialog({ triggerLabel }: { triggerLabel: string }) {
  const t = useTranslations("save");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const mutation = useSaveUrlMutation();
  const router = useRouter();

  const fxUrl = useMemo(() => fxtwitterUrl(url.trim()), [url]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    mutation.mutate(url.trim(), {
      onSuccess: (saved) => {
        setOpen(false);
        setUrl("");
        toast.success(saved.title ?? saved.url);
        router.push(`/item/${saved.id}`);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Could not save that link.");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">{triggerLabel}</span>
        </Button>
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
            <Input
              id="save-url-input"
              autoFocus
              placeholder={t("urlPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={mutation.isPending}
            />
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
