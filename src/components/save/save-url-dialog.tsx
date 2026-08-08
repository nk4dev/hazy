"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSaveUrlMutation } from "@/hooks/use-items";
import { useRouter } from "@/i18n/navigation";

export function SaveUrlDialog({ triggerLabel }: { triggerLabel: string }) {
  const t = useTranslations("save");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const mutation = useSaveUrlMutation();
  const router = useRouter();

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
