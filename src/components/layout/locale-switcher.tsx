"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABEL: Record<string, string> = {
  en: "English",
  ja: "日本語",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function setLocale(next: string) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
      // Best-effort persist; ignored if not signed in yet.
      fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interfaceLocale: next }),
      }).catch(() => {});
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          disabled={isPending}
          aria-label={t("language")}
        >
          <Languages className="size-3.5" />
          {LOCALE_LABEL[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => setLocale(l)}>
            {LOCALE_LABEL[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
